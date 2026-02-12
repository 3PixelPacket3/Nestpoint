import React from 'react'

export default function Account({ me }) {
  const authed = !!me.data?.isAuthenticated

  if (me.status !== 'ready') {
    return <div className="card"><h2>Account</h2><p className="muted">Loading…</p></div>
  }

  if (!authed) {
    return (
      <div className="card">
        <h2>Account</h2>
        <p className="muted">Sign in to manage your account settings.</p>
        <a className="btn" href="/.auth/login/aad">Sign in with Microsoft</a>
      </div>
    )
  }

  const d = me.data

  return (
    <div className="stack">
      <div className="card">
        <h2 style={{marginBottom:6}}>Account</h2>
        <p className="muted">This uses Azure Static Web Apps auth. Phase 2 adds profile editing stored in Table Storage.</p>

        <div className="form" style={{marginTop:12}}>
          <label>
            Display name
            <input value={d.userDetails || ''} disabled />
          </label>
          <label>
            Provider
            <input value={d.provider || 'aad'} disabled />
          </label>
          <label>
            User ID
            <input value={d.userId || ''} disabled />
          </label>
          <label>
            Active space
            <input value={d.activeSpaceName || d.activeSpaceId || ''} disabled />
          </label>
          <label>
            Role
            <input value={d.activeRole || ''} disabled />
          </label>
          <div className="row" style={{gap:10,flexWrap:'wrap'}}>
            <a className="btn ghost" href="/.auth/logout">Sign out</a>
            <a className="btn" href="/welcome">Switch space</a>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Account Settings Roadmap</h2>
        <div className="muted" style={{lineHeight:1.7}}>
          <ul>
            <li>Avatar + preferred name</li>
            <li>Notification prefs (email/push)</li>
            <li>Theme toggle (dark/light)</li>
            <li>Security: provider connections, session view</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
