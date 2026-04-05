'use client'
 
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'
 
export interface Theme {
  id         : string
  name       : string
  description: string
  vars: Record<string, string>
}
 
export const THEMES: Theme[] = [
  { id: 'default',  name: 'parchment', description: 'warm off-white · the original',
    vars: { '--bg':'#F7F6F3','--surface':'#EEECEA','--border':'#E0DDD8','--text':'#1A1917','--muted':'#8B8680','--faint':'#C8C4BE' } },
  { id: 'midnight', name: 'midnight',  description: 'dark mode · easier on the eyes at night',
    vars: { '--bg':'#141414','--surface':'#1E1E1E','--border':'#2A2A2A','--text':'#E8E6E3','--muted':'#666360','--faint':'#3A3836' } },
  { id: 'forest',   name: 'forest',    description: 'deep greens · focus and calm',
    vars: { '--bg':'#F2F5F2','--surface':'#E8EDE8','--border':'#D4DCD4','--text':'#1A2B1A','--muted':'#5A7A5A','--faint':'#B8CCB8' } },
  { id: 'sand',     name: 'sand',      description: 'warm desert tones · open and easy',
    vars: { '--bg':'#F5F0E8','--surface':'#EDE6D6','--border':'#D4C8B0','--text':'#2B2416','--muted':'#8B7A5A','--faint':'#C8B898' } },
  { id: 'slate',    name: 'slate',     description: 'cool blue-grey · professional and sharp',
    vars: { '--bg':'#F0F2F5','--surface':'#E4E8EE','--border':'#CDD3DC','--text':'#1A1F2B','--muted':'#5A6880','--faint':'#A8B4C8' } },
]
 
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v))
  // Keep localStorage in sync so layout.tsx script applies it on next load
  localStorage.setItem('taskflow-theme', theme.id)
}
 
interface ThemePickerProps { userId: string | null }
 
export default function ThemePicker({ userId }: ThemePickerProps) {
  const supabase           = createBrowserClient()
  const [activeId, setActiveId] = useState('default')
  const [saving,   setSaving]   = useState(false)
 
  // Load from Supabase on mount — syncs across devices
  useEffect(() => {
    if (!userId) return
    supabase
      .from('user_preferences')
      .select('color_palette')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        const savedId = data?.color_palette ?? localStorage.getItem('taskflow-theme') ?? 'default'
        const theme   = THEMES.find(t => t.id === savedId) ?? THEMES[0]
        applyTheme(theme)
        setActiveId(savedId)
      })
  }, [userId])
 
  const handlePick = async (theme: Theme) => {
    applyTheme(theme)   // applies + saves to localStorage
    setActiveId(theme.id)
    if (!userId) return
    setSaving(true)
    await supabase
      .from('user_preferences')
      .upsert({ user_id: userId, color_palette: theme.id }, { onConflict: 'user_id' })
    setSaving(false)
  }
 
  return (
    <>
      <div className="section-label" style={{ marginTop: 20 }}>
        appearance {saving && <span style={{ color: 'var(--faint)' }}>// saving...</span>}
      </div>
      {THEMES.map(theme => (
        <div key={theme.id} className="setting-row"
          style={{ cursor: 'pointer', alignItems: 'flex-start', paddingTop: 12 }}
          onClick={() => handlePick(theme)}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12,
              color: activeId === theme.id ? 'var(--text)' : 'var(--muted)',
              fontWeight: activeId === theme.id ? 600 : 400, marginBottom: 2 }}>
              {activeId === theme.id ? '// ' : '   '}{theme.name}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--faint)', letterSpacing: '0.04em' }}>
              {theme.description}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0 }}>
            {['--text','--muted','--surface'].map((k, i) => (
              <div key={i} style={{ width: 14, height: 14, borderRadius: 2,
                background: theme.vars[k], border: `1px solid ${theme.vars['--border']}` }} />
            ))}
          </div>
        </div>
      ))}
    </>
  )
}