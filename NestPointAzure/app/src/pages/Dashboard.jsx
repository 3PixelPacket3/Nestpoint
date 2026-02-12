import React, { useEffect, useState } from 'react'
import { apiGet } from '../lib/api.js'

export default function Dashboard({ me, onToast }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const authed = !!me.data?.isAuthenticated
  const spaceId = me.data?.activeSpaceId

  useEffect(() => {
    if (!authed || !spaceId) return
    setLoading(true)
    apiGet(`/api/summary`)
      .then((d) => setStats(d))
      .catch((e) => onToast?.(e.message))
      .finally(() => setLoading(false))
  }, [authed, spaceId])

  if (me.status !== 'ready') {
    return <div className="card"><h2>Loading…</h2><p className="muted">Preparing dashboard.</p></div>
  }

  if (!authed) {
    return (
      <div className="hero">
        <h1>NestPoint</h1>
        <p>Your private family website — calendar, home work orders, duties, groceries, and memories — all on Azure.</p>
        <div style={{marginTop:16}}>
          <a className="btn" href="/.auth/login/aad">Sign in with Microsoft</a>
        </div>
      </div>
    )
  }

  if (!spaceId) {
    return (
      <div className="card">
        <h2>Choose a Space</h2>
        <p className="muted">You’re signed in, but no family space is selected.</p>
        <a className="btn" href="/welcome">Go to Welcome</a>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="hero">
        <h1>Family Command Center</h1>
        <p>One dashboard to keep the household running: schedules, maintenance, errands, and a private timeline.</p>
      </div>

      <div className="grid">
        <div className="tile">
          <div className="tile-top">
            <div className="tile-title">Calendar</div>
            <div className="pill">Today</div>
          </div>
          <div className="muted">Events today: <b>{stats?.calendarToday ?? (loading ? '…' : 0)}</b></div>
          <div className="muted">Upcoming 7 days: <b>{stats?.calendarWeek ?? (loading ? '…' : 0)}</b></div>
        </div>

        <div className="tile">
          <div className="tile-top">
            <div className="tile-title">Work Orders</div>
            <div className="pill">Home Ops</div>
          </div>
          <div className="muted">Open: <b>{stats?.workOpen ?? (loading ? '…' : 0)}</b></div>
          <div className="muted">Due soon: <b>{stats?.workDueSoon ?? (loading ? '…' : 0)}</b></div>
        </div>

        <div className="tile">
          <div className="tile-top">
            <div className="tile-title">Duties & Reminders</div>
            <div className="pill">Seasonal</div>
          </div>
          <div className="muted">Overdue: <b>{stats?.remindersOverdue ?? (loading ? '…' : 0)}</b></div>
          <div className="muted">Due this week: <b>{stats?.remindersWeek ?? (loading ? '…' : 0)}</b></div>
        </div>

        <div className="tile">
          <div className="tile-top">
            <div className="tile-title">Grocery</div>
            <div className="pill">Shared</div>
          </div>
          <div className="muted">Unpurchased items: <b>{stats?.groceryOpen ?? (loading ? '…' : 0)}</b></div>
          <div className="muted">Lists: <b>{stats?.groceryLists ?? (loading ? '…' : 1)}</b></div>
        </div>

        <div className="tile">
          <div className="tile-top">
            <div className="tile-title">Family Feed</div>
            <div className="pill">Private</div>
          </div>
          <div className="muted">Posts (30 days): <b>{stats?.postsMonth ?? (loading ? '…' : 0)}</b></div>
          <div className="muted">Media stored: <b>{stats?.mediaCount ?? (loading ? '…' : 0)}</b></div>
        </div>

        <div className="tile">
          <div className="tile-top">
            <div className="tile-title">Space</div>
            <div className="pill">Access</div>
          </div>
          <div className="muted">Role: <b>{me.data?.activeRole || 'Member'}</b></div>
          <div className="muted">Members: <b>{stats?.members ?? (loading ? '…' : 1)}</b></div>
        </div>
      </div>
    </div>
  )
}
