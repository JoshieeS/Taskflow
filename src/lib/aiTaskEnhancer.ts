// THEORY: Background enhancement pattern
//
// This module is called AFTER a task is already saved to Supabase.
// The user never waits for this — their task appears instantly.
// If AI enhancement fails, the task still works perfectly.
//
// Flow:
//   1. Task saved to Supabase (instant, user sees it)
//   2. aiTaskEnhancer called in the background (fire-and-forget)
//   3. Gemini analyses the task title for complexity
//   4. If complex, generates subtasks
//   5. Patches the task in Supabase with subtasks + ai_enhanced: true
//   6. Real-time subscription on all devices picks up the UPDATE
//   7. Next time user opens the task detail, they see subtasks with AI badge
//
// The subtask merge logic:
//   - If task has NO existing subtasks: replace with AI subtasks
//   - If task has existing MANUAL subtasks: append AI subtasks, keep manual ones
//   - If task already has AI subtasks: replace only the AI ones, keep manual ones
//   - This means user edits are NEVER overwritten by AI

import type { SubTask, Task } from '@/types'

export async function enhanceTaskInBackground(
  taskId: string,
  taskTitle: string,
  existingSubtasks: SubTask[] = []
): Promise<void> {
  try {
    const res = await fetch('/api/enhance-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, taskTitle, existingSubtasks }),
    })

    if (!res.ok) {
      console.warn('[aiTaskEnhancer] API returned', res.status)
    }
  } catch (err) {
    console.warn('[aiTaskEnhancer] background call failed:', err)
  }
}