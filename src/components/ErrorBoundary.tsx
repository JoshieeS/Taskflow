'use client'
import { Component, ReactNode } from 'react'
 
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
        height:'100dvh', fontFamily:'var(--mono)', fontSize:12, color:'var(--muted)',
        flexDirection:'column', gap:16 }}>
        <div>task<span style={{color:'var(--text)'}}>flow</span></div>
        <div style={{color:'var(--faint)'}}>// something went wrong</div>
        <button onClick={() => window.location.reload()}
          style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text)',
            background:'none', border:'1px solid var(--border)', borderRadius:3,
            padding:'6px 14px', cursor:'pointer' }}>
          reload
        </button>
      </div>
    )
    return this.props.children
  }
}