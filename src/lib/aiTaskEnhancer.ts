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