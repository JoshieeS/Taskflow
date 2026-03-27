import { NextRequest } from 'next/server'
import { getGeminiClient, GEMINI_MODEL } from '@/lib/gemini-client'

export async function POST(req: NextRequest) {
  const { title } = await req.json()
  if (!title?.trim()) {
    return Response.json({ title, due: null, subtasks: [], isComplex: false })
  }

  const today = new Date()
  const toISO = (d: Date) => d.toISOString().split('T')[0]
  const todayISO = toISO(today)
  const dayName = today.toLocaleDateString('en-GB', { weekday: 'long' }).toLowerCase()

  const prompt = `Today is ${dayName}, ${todayISO}.

The user typed this task: "${title}"

Respond with ONLY a JSON object, no markdown, no explanation:

{
  "title": "cleaned task title with date phrases removed",
  "due": "YYYY-MM-DD or null",
  "isComplex": true or false,
  "subtasks": ["step 1", "step 2"] or []
}

Rules:
- title: remove date phrases like "by sunday", "before monday", "due tomorrow". Keep the core task only.
- due: resolve to actual ISO date. "this sunday" = next Sunday from today. "tomorrow" = ${toISO(new Date(today.setDate(today.getDate() + 1)))}. "next week" = 7 days from today. Return null if no date mentioned.
- isComplex: true ONLY if task needs 3+ distinct steps. "Buy milk" = false. "Prepare quarterly presentation" = true.
- subtasks: only if isComplex is true, max 5 concrete steps. Otherwise [].`

  try {
    const gemini  = getGeminiClient()
    const result  = await gemini.models.generateContent({
      model:    GEMINI_MODEL,
      contents: prompt,
    })

    const raw  = result.text
    if (!raw) throw new Error("Empty Gemini Response")
    const clean = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    return Response.json({
      title:     parsed.title     ?? title,
      due:       parsed.due       ?? null,
      subtasks:  Array.isArray(parsed.subtasks) ? parsed.subtasks : [],
      isComplex: parsed.isComplex ?? false,
    })
  } catch (err) {
    console.error('[parse-task]', err)
    return Response.json({ title, due: null, subtasks: [], isComplex: false })
  }
}