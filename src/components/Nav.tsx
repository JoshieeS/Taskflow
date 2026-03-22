'use client'
 
import type { TabId } from '@/types'
 
interface NavProps {
  activeTab   : TabId
  onTabChange : (tab: TabId) => void
}
 
const NAV_ITEMS: { id: TabId; label: string; icon: string }[] = [
  { id: 'today',  label: 'today',  icon: '✓' },
  { id: 'all',    label: 'all',    icon: '≡' },
  { id: 'stats',  label: 'stats',  icon: '◦' },
  { id: 'config', label: 'config', icon: '⚙' },
]
 
export default function Nav({ activeTab, onTabChange }: NavProps) {
  return (
    <nav className="nav">
      <div className="nav-brand">task<span>flow</span></div>
      {NAV_ITEMS.map(item => (
        <button
          key={item.id}
          className={`nav-item${activeTab === item.id ? ' active' : ''}`}
          onClick={() => onTabChange(item.id)}
          aria-label={item.label}
          // aria-current marks the active page for screen readers
          aria-current={activeTab === item.id ? 'page' : undefined}
        >
          <span className="nav-item-icon">{item.icon}</span>
          <span className="nav-item-label">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}