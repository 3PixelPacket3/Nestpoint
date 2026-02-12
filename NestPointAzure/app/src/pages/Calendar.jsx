import React, { useEffect, useMemo, useState } from 'react'
import { apiGet, apiJson } from '../lib/api.js'

function fmtDateInput(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function Calendar({ me, onToast }) {
  const authed = !!me.data?.isAuthenticated
  const spaceId = me.data?.activeSpaceId

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [rangeStart, setRangeStart] = useState(fmtDateInput(new Date()))
  const [rangeDays, setRangeDays] = useState(14)

  const [title, setTitle] = useState('')
  const [date, setDate] = useState(fmtDateInput(new Date()))
  const [category, setCategory] = useState('Household')
  const [notes, setNotes] = useState('')

  const canCreate = useMemo(() => title.trim().length >= 2, [title])

  async function refresh() {
    if (!authed || !spaceId) return
    setLoading(true)
    try {
      const d = await apiGet(`/api/calendar?start=${encodeURIComponent(rangeStart)}&days=${encodeURIComponent(rangeDays)}`)
      setItems(d.items || [])
    } catch (e) {
      onToast?.(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [authed, spaceId, rangeStart, rangeDays])

  async function createEvent() {
    try {
      await apiJson('POST', '/api/calendar', {
        title: title.trim(),
        date,
        category,
        notes
      })
      setTitle('')
      setNotes('')
      onToast?.('Event added ✅')
      refresh()
    } catch (e) {
      onToast?.(e.message)
    }
  }

  async function remove(id) {
    try {
      await apiJson('DELETE', `/api/calendar/${encodeURIComponent(id)}`)
      onToast?.('Event deleted')
      refresh()
    } catch (e) {
      onToast?.(e.message)
    }
  }

  if (!authed) {
    return <div className="card"><h2>Calendar</h2><p className="muted">Sign in to view your family calendar.</p><a className="btn" href="/.auth/login/aad">Sign in</a></div>
  }
  if (!spaceId) {
    return <div className="card"><h2>Calendar</h2><p className="muted">Select a space first.</p><a className="btn" href="/welcome">Select Space</a></div>
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="row" style={{justifyContent:'space-between',alignItems:'flex-end',gap:12,flexWrap:'wrap'}}>
          <div>
            <h2 style={{marginBottom:6}}>Calendar</h2>
            <p className="muted">Lightweight MVP calendar (list view). Next upgrade: month/week views + recurrence rules.</p>
          </div>
          <div className="row" style={{gap:10,flexWrap:'wrap'}}>
            <label className="inline">
              Start
              <input value={rangeStart} onChange={(e)=>setRangeStart(e.target.value)} type="date" />
            </label>
            <label className="inline">
              Days
              <input value={rangeDays} onChange={(e)=>setRangeDays(Number(e.target.value||14))} type="number" min="1" max="60" />
            </label>
            <button className="btn ghost" onClick={refresh}>Refresh</button>
          </div>
        </div>

        <div className="list" style={{marginTop:14}}>
          {loading ? (
            <div className="muted">Loading…</div>
          ) : items.length === 0 ? (
            <div className="muted">No events in this range.</div>
          ) : (
            items.map((it) => (
              <div key={it.id} className="list-item">
                <div className="list-main">
                  <div className="list-title">{it.title}</div>
                  <div className="muted">{new Date(it.date).toLocaleDateString()} • {it.category}</div>
                  {it.notes ? <div className="muted" style={{marginTop:6,whiteSpace:'pre-wrap'}}>{it.notes}</div> : null}
                </div>
                <button className="btn danger" onClick={() => remove(it.id)}>Delete</button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card">
        <h2>Add Event</h2>
        <div className="form">
          <label>
            Title
            <input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Doctor appointment" />
          </label>
          <div className="row" style={{gap:12,flexWrap:'wrap'}}>
            <label className="inline">
              Date
              <input value={date} onChange={(e)=>setDate(e.target.value)} type="date" />
            </label>
            <label className="inline">
              Category
              <select value={category} onChange={(e)=>setCategory(e.target.value)}>
                <option>Household</option>
                <option>Kids</option>
                <option>Bills</option>
                <option>Travel</option>
                <option>Health</option>
                <option>Social</option>
              </select>
            </label>
          </div>
          <label>
            Notes
            <textarea value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Optional details" />
          </label>
          <button className="btn" disabled={!canCreate} onClick={createEvent}>Add Event</button>
        </div>
      </div>
    </div>
  )
}
