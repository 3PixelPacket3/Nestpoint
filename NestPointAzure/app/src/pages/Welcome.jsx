import React, { useEffect, useMemo, useState } from 'react'
import { apiGet, apiJson } from '../lib/api.js'

export default function Welcome({ me, onToast }) {
  const [spaces, setSpaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  const [newSpaceName, setNewSpaceName] = useState('')
  const [adminCode, setAdminCode] = useState('Admin')

  const [joinSpaceId, setJoinSpaceId] = useState('')
  const [joinCode, setJoinCode] = useState('')

  const authed = !!me.data?.isAuthenticated

  useEffect(() => {
    if (!authed) return
    setLoading(true)
    apiGet('/api/spaces')
      .then((d) => setSpaces(d.spaces || []))
      .catch(setErr)
      .finally(() => setLoading(false))
  }, [authed])

  const canCreate = useMemo(() => newSpaceName.trim().length >= 2, [newSpaceName])

  if (me.status !== 'ready') {
    return <div className="card"><h2>Loading…</h2><p className="muted">Fetching identity.</p></div>
  }

  if (!authed) {
    return (
      <div className="hero">
        <h1>Welcome to NestPoint</h1>
        <p>Your private family hub on Azure. Sign in to create or join your household space.</p>
        <div style={{marginTop:16}}>
          <a className="btn" href="/.auth/login/aad">Sign in with Microsoft</a>
        </div>
        <div className="muted" style={{marginTop:14,lineHeight:1.6}}>
          Tip: Add other providers later (Google/GitHub) in your Static Web App authentication settings.
        </div>
      </div>
    )
  }

  async function selectSpace(spaceId) {
    try {
      await apiJson('POST', '/api/spaces/select', { spaceId })
      onToast?.('Space selected ✅')
      window.location.href = '/' // refresh identity snapshot
    } catch (e) {
      onToast?.(e.message)
    }
  }

  async function createSpace() {
    try {
      const d = await apiJson('POST', '/api/spaces', { name: newSpaceName.trim(), adminCode })
      onToast?.('Space created ✅')
      await selectSpace(d.space.spaceId)
    } catch (e) {
      onToast?.(e.message)
    }
  }

  async function redeemInviteCode() {
    try {
      const spaceId = joinSpaceId.trim()
      const code = joinCode.trim().toUpperCase()
      if (!spaceId || !code) {
        onToast?.('Enter both Space ID and Invite Code')
        return
      }
      await apiJson('POST', '/api/spaces/redeem', { spaceId, code })
      onToast?.('Joined space ✅')
      window.location.href = '/' // refresh identity snapshot
    } catch (e) {
      onToast?.(e.message)
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <h2>Choose your Family Space</h2>
        <p className="muted">A space is your household. Everything (calendar, work orders, grocery, feed) is scoped to the space.</p>

        {loading ? (
          <p className="muted">Loading spaces…</p>
        ) : spaces.length === 0 ? (
          <p className="muted">No spaces yet. Create your first one below.</p>
        ) : (
          <div className="grid">
            {spaces.map((s) => (
              <div key={s.spaceId} className="tile">
                <div className="tile-top">
                  <div className="tile-title">{s.name}</div>
                  <div className="pill">{s.role}</div>
                </div>
                <div className="muted">Created: {new Date(s.createdAt).toLocaleString()}</div>
                <div style={{marginTop:12}}>
                  <button className="btn" onClick={() => selectSpace(s.spaceId)}>Use this space</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Create a Space</h2>
        <p className="muted">Bootstrap uses an admin code (default <b>Admin</b>). Change it in Azure via <code>ADMIN_BOOTSTRAP_CODE</code>.</p>
        <div className="form">
          <label>
            Space name
            <input value={newSpaceName} onChange={(e) => setNewSpaceName(e.target.value)} placeholder="Smolak Household" />
          </label>
          <label>
            Admin code
            <input value={adminCode} onChange={(e) => setAdminCode(e.target.value)} placeholder="Admin" />
          </label>
          <div className="row">
            <button className="btn" disabled={!canCreate} onClick={createSpace}>Create Space</button>
            <div className="muted">Signed in as: <b>{me.data?.userDetails || 'User'}</b></div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Join a Space</h2>
        <p className="muted">Have a family invite? Sign in, then enter the <b>Space ID</b> and <b>Invite code</b>.</p>
        <div className="form">
          <label>
            Space ID
            <input value={joinSpaceId} onChange={(e)=>setJoinSpaceId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
          </label>
          <label>
            Invite code
            <input value={joinCode} onChange={(e)=>setJoinCode(e.target.value)} placeholder="8 characters" />
          </label>
          <button className="btn" onClick={redeemInviteCode}>Join</button>
        </div>
      </div>

      {err && (
        <div className="card">
          <h3>Note</h3>
          <p className="muted">{String(err?.message || err)}</p>
        </div>
      )}
    </div>
  )
}
