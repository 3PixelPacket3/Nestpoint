import React, { useEffect, useMemo, useState } from 'react'
import { apiGet, apiJson } from '../lib/api.js'

const STATUSES = ['Open','In Progress','On Hold','Done']
const PRIORITIES = ['Low','Medium','High','Urgent']

export default function WorkOrders({ me, onToast }) {
  const authed = !!me.data?.isAuthenticated
  const spaceId = me.data?.activeSpaceId

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('Open')

  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [dueDate, setDueDate] = useState('')

  const canCreate = useMemo(() => title.trim().length >= 2, [title])

  async function refresh() {
    if (!authed || !spaceId) return
    setLoading(true)
    try {
      const d = await apiGet(`/api/workorders?status=${encodeURIComponent(filter)}`)
      setItems(d.items || [])
    } catch (e) {
      onToast?.(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [authed, spaceId, filter])

  async function createWO() {
    try {
      await apiJson('POST', '/api/workorders', {
        title: title.trim(),
        description: desc,
        priority,
        dueDate: dueDate || null
      })
      setTitle('')
      setDesc('')
      setPriority('Medium')
      setDueDate('')
      onToast?.('Work order created ✅')
      refresh()
    } catch (e) {
      onToast?.(e.message)
    }
  }

  async function setStatus(id, status) {
    try {
      await apiJson('PATCH', `/api/workorders/${encodeURIComponent(id)}`, { status })
      refresh()
    } catch (e) {
      onToast?.(e.message)
    }
  }

  async function remove(id) {
    try {
      await apiJson('DELETE', `/api/workorders/${encodeURIComponent(id)}`)
      onToast?.('Deleted')
      refresh()
    } catch (e) {
      onToast?.(e.message)
    }
  }

  if (!authed) {
    return <div className="card"><h2>Work Orders</h2><p className="muted">Sign in to manage household work.</p><a className="btn" href="/.auth/login/aad">Sign in</a></div>
  }
  if (!spaceId) {
    return <div className="card"><h2>Work Orders</h2><p className="muted">Select a space first.</p><a className="btn" href="/welcome">Select Space</a></div>
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="row" style={{justifyContent:'space-between',alignItems:'flex-end',gap:12,flexWrap:'wrap'}}>
          <div>
            <h2 style={{marginBottom:6}}>Work Orders</h2>
            <p className="muted">Create, track, and close household tasks. Phase 2 adds comments, photos, and assignments.</p>
          </div>
          <div className="row" style={{gap:10,flexWrap:'wrap'}}>
            <label className="inline">
              Status
              <select value={filter} onChange={(e)=>setFilter(e.target.value)}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
            <button className="btn ghost" onClick={refresh}>Refresh</button>
          </div>
        </div>

        <div className="list" style={{marginTop:14}}>
          {loading ? (
            <div className="muted">Loading…</div>
          ) : items.length === 0 ? (
            <div className="muted">No items in this status.</div>
          ) : (
            items.map((it) => (
              <div key={it.id} className="list-item">
                <div className="list-main">
                  <div className="list-title">{it.title}</div>
                  <div className="muted">Priority: <b>{it.priority}</b> • Status: <b>{it.status}</b>{it.dueDate ? ` • Due: ${new Date(it.dueDate).toLocaleDateString()}` : ''}</div>
                  {it.description ? <div className="muted" style={{marginTop:6,whiteSpace:'pre-wrap'}}>{it.description}</div> : null}
                  <div className="row" style={{gap:8,marginTop:10,flexWrap:'wrap'}}>
                    {STATUSES.filter(s => s !== it.status).map(s => (
                      <button key={s} className="btn ghost" onClick={() => setStatus(it.id, s)}>{s}</button>
                    ))}
                  </div>
                </div>
                <button className="btn danger" onClick={() => remove(it.id)}>Delete</button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card">
        <h2>Create Work Order</h2>
        <div className="form">
          <label>
            Title
            <input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Fix loose cabinet hinge" />
          </label>
          <label>
            Description
            <textarea value={desc} onChange={(e)=>setDesc(e.target.value)} placeholder="Details, parts needed, links, etc." />
          </label>
          <div className="row" style={{gap:12,flexWrap:'wrap'}}>
            <label className="inline">
              Priority
              <select value={priority} onChange={(e)=>setPriority(e.target.value)}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </label>
            <label className="inline">
              Due date
              <input value={dueDate} onChange={(e)=>setDueDate(e.target.value)} type="date" />
            </label>
          </div>
          <button className="btn" disabled={!canCreate} onClick={createWO}>Create</button>
        </div>
      </div>
    </div>
  )
}
