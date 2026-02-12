import React, { useEffect, useMemo, useState } from 'react'
import { apiGet, apiJson } from '../lib/api.js'

const CATS = ['Produce','Dairy','Meat','Pantry','Frozen','Household','Other']

export default function Grocery({ me, onToast }) {
  const authed = !!me.data?.isAuthenticated
  const spaceId = me.data?.activeSpaceId

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showDone, setShowDone] = useState(false)

  const [text, setText] = useState('')
  const [cat, setCat] = useState('Other')
  const canCreate = useMemo(() => text.trim().length >= 1, [text])

  async function refresh() {
    if (!authed || !spaceId) return
    setLoading(true)
    try {
      const d = await apiGet(`/api/grocery?showDone=${showDone ? '1' : '0'}`)
      setItems(d.items || [])
    } catch (e) {
      onToast?.(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [authed, spaceId, showDone])

  async function add() {
    try {
      await apiJson('POST', '/api/grocery', { text: text.trim(), category: cat })
      setText('')
      onToast?.('Added ✅')
      refresh()
    } catch (e) {
      onToast?.(e.message)
    }
  }

  async function toggle(id, purchased) {
    try {
      await apiJson('PATCH', `/api/grocery/${encodeURIComponent(id)}`, { purchased: !purchased })
      refresh()
    } catch (e) {
      onToast?.(e.message)
    }
  }

  async function remove(id) {
    try {
      await apiJson('DELETE', `/api/grocery/${encodeURIComponent(id)}`)
      refresh()
    } catch (e) {
      onToast?.(e.message)
    }
  }

  if (!authed) {
    return <div className="card"><h2>Grocery</h2><p className="muted">Sign in to manage shared lists.</p><a className="btn" href="/.auth/login/aad">Sign in</a></div>
  }
  if (!spaceId) {
    return <div className="card"><h2>Grocery</h2><p className="muted">Select a space first.</p><a className="btn" href="/welcome">Select Space</a></div>
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="row" style={{justifyContent:'space-between',alignItems:'flex-end',gap:12,flexWrap:'wrap'}}>
          <div>
            <h2 style={{marginBottom:6}}>Grocery List</h2>
            <p className="muted">Shared list for the household. Phase 2: multiple lists + favorites + pantry inventory.</p>
          </div>
          <label className="inline">
            <span style={{marginRight:8}}>Show purchased</span>
            <input type="checkbox" checked={showDone} onChange={(e)=>setShowDone(e.target.checked)} />
          </label>
        </div>

        <div className="row" style={{gap:10,marginTop:14,flexWrap:'wrap'}}>
          <input style={{flex:1,minWidth:220}} value={text} onChange={(e)=>setText(e.target.value)} placeholder="Milk, eggs, trash bags…" />
          <select value={cat} onChange={(e)=>setCat(e.target.value)}>
            {CATS.map(c => <option key={c}>{c}</option>)}
          </select>
          <button className="btn" disabled={!canCreate} onClick={add}>Add</button>
        </div>

        <div className="list" style={{marginTop:14}}>
          {loading ? (
            <div className="muted">Loading…</div>
          ) : items.length === 0 ? (
            <div className="muted">Nothing here yet.</div>
          ) : (
            items.map((it) => (
              <div key={it.id} className="list-item">
                <div className="list-main">
                  <div className="list-title" style={{textDecoration: it.purchased ? 'line-through' : 'none', opacity: it.purchased ? 0.7 : 1}}>
                    {it.text}
                  </div>
                  <div className="muted">{it.category} • Added {new Date(it.createdAt).toLocaleString()}</div>
                </div>
                <div className="row" style={{gap:8}}>
                  <button className="btn ghost" onClick={() => toggle(it.id, it.purchased)}>{it.purchased ? 'Unmark' : 'Purchased'}</button>
                  <button className="btn danger" onClick={() => remove(it.id)}>Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
