'use client'

// src/components/SharedCart.tsx — REPLACE ENTIRE FILE

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'

interface CartItem {
  id        : string
  cart_id   : string
  added_by  : string | null
  title     : string
  quantity  : string
  done      : boolean
  created_at: string
}

interface Cart {
  id        : string
  creator_id: string
  name      : string
  share_code: string
  created_at: string
}

interface SharedCartProps {
  userId: string
}

const primaryBtn: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 11, background: 'var(--text)',
  color: 'var(--bg)', border: 'none', borderRadius: 3,
  padding: '7px 12px', cursor: 'pointer', flexShrink: 0, letterSpacing: '0.04em',
}
const ghostBtn: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)',
  background: 'none', border: '1px solid var(--border)', borderRadius: 3,
  padding: '5px 10px', cursor: 'pointer', letterSpacing: '0.04em',
}

export default function SharedCart({ userId }: SharedCartProps) {
  const supabase = createBrowserClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const [carts,      setCarts]      = useState<Cart[]>([])
  const [activeCart, setActiveCart] = useState<Cart | null>(null)
  const [items,      setItems]      = useState<CartItem[]>([])
  const [newItem,    setNewItem]    = useState('')
  const [newQty,     setNewQty]     = useState('1')
  const [joinCode,   setJoinCode]   = useState('')
  const [loading,    setLoading]    = useState(true)
  const [view,       setView]       = useState<'list' | 'cart' | 'join'>('list')
  const [copied,     setCopied]     = useState(false)
  const [cartName,   setCartName]   = useState('my list')
  const [creating,   setCreating]   = useState(false)
  const [joinErr,    setJoinErr]    = useState('')
  const [renaming,   setRenaming]   = useState(false)
  const [renameVal,  setRenameVal]  = useState('')

  // ── Load carts ──────────────────────────────────────────────────────────────
  useEffect(() => {
    loadCarts()
  }, [userId])

  async function loadCarts() {
    setLoading(true)

    // Fetch owned carts
    const { data: owned } = await supabase
      .from('shopping_carts')
      .select('*')
      .eq('creator_id', userId)
      .order('created_at', { ascending: false })

    // Fetch joined cart IDs
    const { data: memberships } = await supabase
      .from('cart_members')
      .select('cart_id')
      .eq('user_id', userId)

    let joined: Cart[] = []
    if (memberships?.length) {
      const ids = memberships.map(m => m.cart_id)
      const { data } = await supabase
        .from('shopping_carts')
        .select('*')
        .in('id', ids)
      joined = (data ?? []).filter(j =>
        // FIX: deduplicate — exclude joined carts that are also owned
        !owned?.find(o => o.id === j.id)
      )
    }

    const all = [...(owned ?? []), ...joined]
    setCarts(all)
    setLoading(false)
  }

  // ── Open cart — subscribe to real-time items ────────────────────────────────
  async function openCart(cart: Cart) {
    // Unsubscribe from previous cart channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    setActiveCart(cart)
    setItems([])
    setView('cart')

    // Fetch items once
    const { data } = await supabase
      .from('cart_items')
      .select('*')
      .eq('cart_id', cart.id)
      .order('created_at', { ascending: true })
    setItems(data ?? [])

    // Subscribe to real-time changes for this cart
    const channel = supabase
      .channel(`cart-items-${cart.id}`)
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'cart_items',
        filter: `cart_id=eq.${cart.id}`,
      }, payload => {
        if (payload.eventType === 'INSERT') {
          setItems(prev => {
            // Skip if we already have this item (added optimistically)
            if (prev.find(i => i.id === payload.new.id)) return prev
            return [...prev, payload.new as CartItem]
          })
        }
        if (payload.eventType === 'UPDATE') {
          setItems(prev => prev.map(i =>
            i.id === payload.new.id ? payload.new as CartItem : i
          ))
        }
        if (payload.eventType === 'DELETE') {
          setItems(prev => prev.filter(i => i.id !== payload.old.id))
        }
      })
      .subscribe()

    channelRef.current = channel
  }

  // Cleanup channel on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  // ── Create cart — optimistic ────────────────────────────────────────────────
  async function createCart() {
    if (!cartName.trim()) return
    setCreating(true)

    // Optimistic: add a placeholder cart immediately
    const tempId   = `temp-${Date.now()}`
    const tempCart: Cart = {
      id:         tempId,
      creator_id: userId,
      name:       cartName.trim(),
      share_code: '--------',
      created_at: new Date().toISOString(),
    }
    setCarts(prev => [tempCart, ...prev])
    setCartName('my list')
    setCreating(false)

    // Real insert
    const { data, error } = await supabase
      .from('shopping_carts')
      .insert({ creator_id: userId, name: tempCart.name })
      .select()
      .single()

    if (!error && data) {
      // Replace temp cart with real one
      setCarts(prev => prev.map(c => c.id === tempId ? data : c))
      openCart(data)
    } else {
      // Roll back on error
      setCarts(prev => prev.filter(c => c.id !== tempId))
      console.error('[createCart]', error)
    }
  }

  // ── Add item — optimistic ───────────────────────────────────────────────────
  async function addItem() {
    if (!newItem.trim() || !activeCart) return

    // Generate a local id for the optimistic item
    const tempId   = crypto.randomUUID()
    const tempItem: CartItem = {
      id:         tempId,
      cart_id:    activeCart.id,
      added_by:   userId,
      title:      newItem.trim(),
      quantity:   newQty,
      done:       false,
      created_at: new Date().toISOString(),
    }

    // Optimistic: add immediately
    setItems(prev => [...prev, tempItem])
    setNewItem('')
    setNewQty('1')

    const { data, error } = await supabase
      .from('cart_items')
      .insert({
        cart_id:  activeCart.id,
        added_by: userId,
        title:    tempItem.title,
        quantity: tempItem.quantity,
      })
      .select()
      .single()

    if (!error && data) {
      // Replace temp item with real one (has server-generated id)
      setItems(prev => prev.map(i => i.id === tempId ? data : i))
    } else {
      // Roll back
      setItems(prev => prev.filter(i => i.id !== tempId))
      console.error('[addItem]', error)
    }
  }

  // ── Toggle item — optimistic ────────────────────────────────────────────────
  async function toggleItem(item: CartItem) {
    // Optimistic
    setItems(prev => prev.map(i =>
      i.id === item.id ? { ...i, done: !i.done } : i
    ))

    const { error } = await supabase
      .from('cart_items')
      .update({ done: !item.done })
      .eq('id', item.id)

    if (error) {
      // Roll back
      setItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, done: item.done } : i
      ))
    }
  }

  // ── Delete item — optimistic ────────────────────────────────────────────────
  async function deleteItem(id: string) {
    const snapshot = items.find(i => i.id === id)

    // Optimistic
    setItems(prev => prev.filter(i => i.id !== id))

    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', id)

    if (error && snapshot) {
      // Roll back
      setItems(prev => [...prev, snapshot].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ))
    }
  }

  // ── Rename cart ─────────────────────────────────────────────────────────────
  async function saveRename() {
    if (!renameVal.trim() || !activeCart) return

    const oldName = activeCart.name

    // Optimistic
    const updated = { ...activeCart, name: renameVal.trim() }
    setActiveCart(updated)
    setCarts(prev => prev.map(c => c.id === activeCart.id ? updated : c))
    setRenaming(false)

    const { error } = await supabase
      .from('shopping_carts')
      .update({ name: renameVal.trim() })
      .eq('id', activeCart.id)

    if (error) {
      // Roll back
      setActiveCart(activeCart)
      setCarts(prev => prev.map(c => c.id === activeCart.id ? activeCart : c))
      console.error('[rename]', error)
    }
  }

  // ── Join cart ───────────────────────────────────────────────────────────────
  async function joinCart() {
    setJoinErr('')
    if (!joinCode.trim()) return

    const { data: cart } = await supabase
      .from('shopping_carts')
      .select('*')
      .eq('share_code', joinCode.trim().toLowerCase())
      .maybeSingle()

    if (!cart) { setJoinErr('// invalid code'); return }
    if (cart.creator_id === userId) { setJoinErr('// this is your own list'); return }
    if (carts.find(c => c.id === cart.id)) { setJoinErr('// already joined'); return }

    await supabase.from('cart_members').upsert({ cart_id: cart.id, user_id: userId })
    setCarts(prev => [...prev, cart])
    setJoinCode('')
    openCart(cart)
  }

  async function copyShareCode() {
    if (!activeCart) return
    await navigator.clipboard.writeText(activeCart.share_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isOwner  = activeCart?.creator_id === userId
  const pending  = items.filter(i => !i.done)
  const done     = items.filter(i => i.done)

  // ── LIST VIEW ───────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0 16px', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.06em' }}>
            // {carts.length} list{carts.length !== 1 ? 's' : ''}
          </span>
          <button onClick={() => setView('join')} style={ghostBtn}>join list</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <input
            className="form-input"
            style={{ marginBottom: 0, flex: 1 }}
            placeholder="new list name..."
            value={cartName}
            onChange={e => setCartName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createCart()}
          />
          <button onClick={createCart} disabled={creating} style={primaryBtn}>
            {creating ? '...' : '+ create'}
          </button>
        </div>

        {loading ? (
          <div className="empty">loading...</div>
        ) : carts.length === 0 ? (
          <div className="empty">// no lists yet</div>
        ) : (
          carts.map(cart => (
            <div key={cart.id} className="task-row" style={{ cursor: 'pointer' }} onClick={() => openCart(cart)}>
              <div className="task-main">
                <div className="task-text">{cart.name}</div>
                <div className="task-meta">
                  <span className="meta-tag">code: {cart.share_code}</span>
                  {cart.creator_id !== userId && <span className="meta-tag">· shared with you</span>}
                </div>
              </div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--muted)' }}>›</span>
            </div>
          ))
        )}
      </div>
    )
  }

  // ── JOIN VIEW ───────────────────────────────────────────────────────────────
  if (view === 'join') {
    return (
      <div className="body">
        <div style={{ padding: '20px 0 8px' }}>
          <button onClick={() => setView('list')} style={ghostBtn}>← back</button>
        </div>
        <div className="section-label">join a shared list</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.7 }}>
          // ask the list owner for their 8-character share code
        </div>
        <input
          className="form-input"
          placeholder="enter share code..."
          value={joinCode}
          onChange={e => { setJoinCode(e.target.value); setJoinErr('') }}
          onKeyDown={e => e.key === 'Enter' && joinCart()}
          autoFocus
          style={{ letterSpacing: '0.2em', fontSize: 'max(13px, 16px)' }}
        />
        {joinErr && (
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#c0392b', marginTop: 8 }}>
            {joinErr}
          </div>
        )}
        <button onClick={joinCart} style={{ ...primaryBtn, marginTop: 16, width: '100%' }}>
          join list
        </button>
      </div>
    )
  }

  // ── CART VIEW ───────────────────────────────────────────────────────────────
  return (
    <div className="body">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0 12px', borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <button onClick={() => { setView('list'); setRenaming(false) }} style={ghostBtn}>←</button>

          {renaming ? (
            <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 0 }}>
              <input
                className="form-input"
                style={{ marginBottom: 0, flex: 1, fontSize: 13 }}
                value={renameVal}
                onChange={e => setRenameVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveRename()
                  if (e.key === 'Escape') setRenaming(false)
                }}
                autoFocus
              />
              <button onClick={saveRename} style={primaryBtn}>save</button>
              <button onClick={() => setRenaming(false)} style={ghostBtn}>cancel</button>
            </div>
          ) : (
            <span
              style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: isOwner ? 'pointer' : 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              onClick={() => {
                if (!isOwner) return
                setRenameVal(activeCart?.name ?? '')
                setRenaming(true)
              }}
              title={isOwner ? 'tap to rename' : undefined}
            >
              {activeCart?.name}
              {isOwner && <span style={{ color: 'var(--faint)', marginLeft: 6, fontSize: 10 }}>✎</span>}
            </span>
          )}
        </div>

        {!renaming && (
          <button onClick={copyShareCode} style={{ ...ghostBtn, flexShrink: 0, marginLeft: 8 }}>
            {copied ? 'copied ✓' : activeCart?.share_code}
          </button>
        )}
      </div>

      {/* Add item */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          className="form-input"
          style={{ marginBottom: 0, flex: 1 }}
          placeholder="add item..."
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); addItem() } }}
        />
        <input
          className="form-input"
          style={{ marginBottom: 0, width: 44, textAlign: 'center', padding: '6px 4px' }}
          placeholder="qty"
          value={newQty}
          onChange={e => setNewQty(e.target.value)}
        />
        <button onClick={addItem} style={primaryBtn}>add</button>
      </div>

      {/* Pending items */}
      {pending.length === 0 && done.length === 0 && (
        <div className="empty">// add your first item above</div>
      )}

      {pending.map(item => (
        <CartItemRow
          key={item.id}
          item={item}
          onToggle={() => toggleItem(item)}
          onDelete={() => deleteItem(item.id)}
        />
      ))}

      {/* Collected items */}
      {done.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 16 }}>
            in basket ({done.length})
          </div>
          {done.map(item => (
            <CartItemRow
              key={item.id}
              item={item}
              onToggle={() => toggleItem(item)}
              onDelete={() => deleteItem(item.id)}
            />
          ))}
          {isOwner && (
            <button
              onClick={async () => { for (const i of done) await deleteItem(i.id) }}
              style={{ ...ghostBtn, marginTop: 12, fontSize: 11, color: '#c0392b', borderColor: '#f0c0bc' }}
            >
              // clear {done.length} collected
            </button>
          )}
        </>
      )}
    </div>
  )
}

function CartItemRow({ item, onToggle, onDelete }: {
  item: CartItem
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 0', borderBottom: '1px solid var(--border)',
      opacity: item.done ? 0.4 : 1,
      animation: 'fadeUp 0.2s ease both',
    }}>
      <button
        onClick={onToggle}
        style={{
          width: 14, height: 14, minWidth: 14,
          border: `1px solid ${item.done ? 'var(--text)' : 'var(--faint)'}`,
          borderRadius: 2, background: item.done ? 'var(--text)' : 'transparent',
          cursor: 'pointer', flexShrink: 0, padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}
      >
        {item.done && (
          <div style={{ width: 6, height: 3, borderLeft: '1.5px solid var(--bg)', borderBottom: '1.5px solid var(--bg)', transform: 'translateY(-1px) rotate(-45deg)' }} />
        )}
        <span style={{ position: 'absolute', inset: -12 }} />
      </button>

      <span style={{
        fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)',
        flex: 1, textDecoration: item.done ? 'line-through' : 'none',
        wordBreak: 'break-word',
      }}>
        {item.title}
      </span>

      {item.quantity !== '1' && (
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>
          ×{item.quantity}
        </span>
      )}

      <button
        onClick={onDelete}
        style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', flexShrink: 0, lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  )
}