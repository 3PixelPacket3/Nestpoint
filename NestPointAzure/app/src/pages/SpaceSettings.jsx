import React, { useEffect, useState } from 'react'
import { apiGet, apiJson } from '../lib/api.js'

export default function SpaceSettings({ me, onToast }) {
  const authed = !!me.data?.isAuthenticated
  const spaceId = me.data?.activeSpaceId

  const [members, setMembers] = useState([])
  const [invite, setInvite] = useState(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    if (!authed || !spaceId) return
    setLoading(true)
    try {
      const d = await apiGet('/api/spaces/members')
      setMembers(d.members || [])
      setInvite(d.invite || null)
    } catch (e) {
      onToast?.(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [authed, spaceId])

  async function regenInvite() {
    try {
      const d = await apiJson('POST', '/api/spaces/invite', {})
      setInvite(d.invite)
      onToast?.('Invite refreshed ✅')
    } catch (e) {
      onToast?.(e.message)
    }
  }

  if (!authed) {
    return <div className="card"><h2>Space Settings</h2><p className="muted">Sign in first.</p><a className="btn" href="/.auth/login/aad">Sign in</a></div>
  }
  if (!spaceId) {
    return <div className="card"><h2>Space Settings</h2><p className="muted">Select a space first.</p><a className="btn" href="/welcome">Select Space</a></div>
  }

  const canAdmin = ['Owner','Admin'].includes(me.data?.activeRole || '')

  return (
    <div className="stack">
      <div className="card">
        <h2 style={{marginBottom:6}}>Space Settings</h2>
        <p className="muted">Manage your household space. Phase 2 adds role changes, approvals, and audit logs.</p>
        <div className="row" style={{gap:12,flexWrap:'wrap',marginTop:12}}>
          <div className="pill">Space: {me.data?.activeSpaceName || spaceId}</div>
          <div className="pill">Your role: {me.data?.activeRole || 'Member'}</div>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <div>
            <h2 style={{marginBottom:6}}>Invite</h2>
            <p className="muted">Share this code with family to join the space (they sign in, then redeem code).</p>
          </div>
          <button className="btn" disabled={!canAdmin} onClick={regenInvite}>Regenerate</button>
        </div>

        {loading ? <div className="muted">Loading…</div> : (
          <div className="row" style={{gap:12,flexWrap:'wrap',marginTop:12}}>
            <div className="pill">Invite code: <b>{invite?.code || '—'}</b></div>
            <div className="muted">Created: {invite?.createdAt ? new Date(invite.createdAt).toLocaleString() : '—'}</div>
          </div>
        )}

        {!canAdmin && (
          <p className="muted" style={{marginTop:10}}>Only Owners/Admins can regenerate invite codes.</p>
        )}
      </div>

      <div className="card">
        <h2>Members</h2>
        <div className="list" style={{marginTop:14}}>
          {loading ? (
            <div className="muted">Loading…</div>
          ) : members.length === 0 ? (
            <div className="muted">No members?</div>
          ) : (
            members.map((m) => (
              <div key={m.userId} className="list-item">
                <div className="list-main">
                  <div className="list-title">{m.name || m.userId}</div>
                  <div className="muted">Role: <b>{m.role}</b> • Joined: {new Date(m.createdAt).toLocaleString()}</div>
                </div>
                <div className="pill">{m.provider || 'aad'}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
