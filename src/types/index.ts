export type Priority = 'high' | 'medium' | 'low'
export type Category = 'personal' | 'work' | 'health' | 'finance' | 'learning'
export type Due = 'today' | 'this week' | 'someday' | string

export interface Task {
    id: string      
    user_id: string      
    title: string
    category: Category
    priority: Priority
    due: Due
    notes: string
    done: boolean
    created_at: string     
    updated_at: string
}


export type NewTask = Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>

export type TabId = 'pending' | 'done' | 'stats' | 'config'