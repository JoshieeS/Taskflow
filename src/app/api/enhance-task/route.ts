// src/app/api/enhance-task/route.ts
//
// This runs on the SERVER — has access to GEMINI_API_KEY and
// the Supabase service role key for updating any task.
// Never exposed to the browser.

import { NextRequest } from 'next/server'
import { getGeminiClient, GEMINI_MODEL } from '@/lib/gemini-client'
import { createClient } from '@supabase/supabase-js'
import type { SubTask } from '@/types'

function getServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!,
    )
}

function generateId(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export async function POST(req: NextRequest) {
    const { taskId, taskTitle, existingSubtasks = [] } = await req.json()

    if (!taskId || !taskTitle) {
        return Response.json({ ok: false, reason: 'missing fields' }, { status: 400 })
    }

    // ── Step 1: Ask Gemini if task is complex and needs breakdown ─────────────
    const prompt = `You are a task management assistant. Analyse this task:

"${taskTitle}"

Determine if this task is COMPLEX (requires 3 or more distinct actionable steps to complete) or SIMPLE.

Examples of SIMPLE tasks (do NOT break down):
- "Buy groceries"
- "Call John"  
- "Send email to team"
- "Pay electricity bill"
- "Go for a run"

Examples of COMPLEX tasks (DO break down):
- "Prepare Q3 financial report for board presentation"
- "Plan and execute team offsite event"
- "Research and purchase new laptop"
- "Complete machine learning course module 3"
- "Set up CI/CD pipeline for the new service"

Respond with ONLY a JSON object:
{
  "isComplex": true or false,
  "subtasks": ["concrete step 1", "concrete step 2", "concrete step 3"] or []
}

Rules for subtasks:
- Maximum 5 subtasks
- Each must be a concrete, actionable step (not vague)
- If isComplex is false, subtasks must be []
- Do not repeat the parent task in subtasks
- Keep each subtask under 60 characters`

    try {
        const gemini = getGeminiClient()
        const result = await gemini.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
        })

        const text = result.text
        console.log(text)
        if (!text) {
            throw new Error('Gemini returned empty response')
        }
        const clean = text.replace(/```json|```/g, '').trim()
        const parsed = JSON.parse(clean)
        console.log(parsed)

        if (!parsed.isComplex || !parsed.subtasks?.length) {
            // Simple task — no subtasks needed, just mark as AI-checked
            const supabase = getServiceClient()
            await supabase
                .from('tasks')
                .update({ ai_enhanced: true })
                .eq('id', taskId)

            return Response.json({ ok: true, isComplex: false })
        }

        // ── Step 2: Merge with existing subtasks ──────────────────────────────
        // Keep all MANUAL subtasks (ai_generated: false)
        // Replace AI subtasks with new ones
        const manualSubtasks = existingSubtasks.filter(
            (s: SubTask) => !s.ai_generated
        )

        const newAiSubtasks: SubTask[] = parsed.subtasks.map((title: string) => ({
            id: generateId(),
            title: title.trim(),
            done: false,
            ai_generated: true,
            created_at: new Date().toISOString(),
        }))
        console.log(newAiSubtasks)

        const mergedSubtasks = [...manualSubtasks, ...newAiSubtasks]

        // ── Step 3: Patch the task in Supabase ────────────────────────────────
        const supabase = await getServiceClient()
        const { error } = await supabase
            .from('tasks')
            .update({
                subtasks: mergedSubtasks,
                ai_enhanced: true,
                updated_at: new Date().toISOString(),
            })
            .eq('id', taskId)

        if (error) {
            console.error('[enhance-task] supabase update failed:', error.message)
            return Response.json({ ok: false, reason: error.message }, { status: 500 })
        }

        return Response.json({ ok: true, isComplex: true, subtasksAdded: newAiSubtasks.length })

    } catch (err) {
        console.error('[enhance-task] AI call failed:', err)
        return Response.json({ ok: false, reason: 'AI call failed' }, { status: 500 })
    }
}