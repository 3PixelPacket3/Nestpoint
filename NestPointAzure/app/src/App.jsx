import React, { useEffect, useMemo, useState } from 'react'
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { apiGet } from './lib/api.js'
import Dashboard from './pages/Dashboard.jsx'
import Calendar from './pages/Calendar.jsx'
import WorkOrders from './pages/WorkOrders.jsx'
import Grocery from './pages/Grocery.jsx'
import Feed from './pages/Feed.jsx'
import SpaceSettings from './pages/SpaceSettings.jsx'
import Account from './pages/Account.jsx'
import Welcome from './pages/Welcome.jsx'
import { Toast } from './components/Toast.jsx'

function useAuthMe() {
  const [me, setMe] = useState({ status: 'loading', data: null, error: null })
  useEffect(() => {
    let cancelled = false
    apiGet('/api/me')
      .then((data) => !cancelled && setMe({ status: 'ready', data, error: null }))
      .catch((err) => !cancelled && setMe({ status: 'error', data: null, error: err }))
    return () => { cancelled = true }
  }, [])
  return me
}

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const me = useAuthMe()
  const [toast, setToast] = useState(null)

  const isAuthed = !!me.data?.isAuthenticated
  const activeSpaceId = me.data?.activeSpaceId || null

  useEffect(() => {
    // gentle redirect to welcome flow if authed but no space selected
    if (me.status === 'ready' && isAuthed && !activeSpaceId && location.pathname !== '/welcome') {
      navigate('/welcome', { replace: true })
    }
  }, [me.status, isAuthed, activeSpaceId, location.pathname, navigate])

  const navItems = useMemo(() => ([
    { to: '/', label: 'Dashboard', icon: '⌂' },
    { to: '/calendar', label: 'Calendar', icon: '🗓️' },
    { to: '/work', label: 'Work Orders', icon: '🧰' },
    { to: '/grocery', label: 'Grocery', icon: '🛒' },
    { to: '/feed', label: 'Family Feed', icon: '📷' }
  ]), [])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            <span className="dot" />
            <span className="dot2" />
          </div>
          <div>
            <div className="brand-name">NestPoint</div>
            <div className="brand-sub">Family Command Center</div>
          </div>
        </div>

        <div className="top-actions">
          {!isAuthed ? (
            <a className="btn" href="/.auth/login/aad">Sign in</a>
          ) : (
            <>
              <button className="btn ghost" onClick={() => setToast('Tip: open Settings to switch family spaces')}>Quick Tip</button>
              <NavLink className="btn" to="/account">Account</NavLink>
              <a className="btn ghost" href="/.auth/logout">Sign out</a>
            </>
          )}
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <nav className="nav">
            {navItems.map((n) => (
              <NavLink key={n.to} to={n.to} className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
                <span className="nav-icon" aria-hidden>{n.icon}</span>
                <span>{n.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="sidecard">
            <div className="sidecard-title">Active Space</div>
            <div className="sidecard-main">
              {activeSpaceId ? (
                <>
                  <div className="pill">{me.data?.activeSpaceName || activeSpaceId}</div>
                  <NavLink className="link" to="/settings/space">Space settings →</NavLink>
                </>
              ) : (
                <div className="muted">None selected</div>
              )}
            </div>
          </div>

          <div className="sidecard">
            <div className="sidecard-title">Admin bootstrap</div>
            <div className="muted" style={{lineHeight:1.5}}>
              First-time setup supports an admin code. Default: <b>Admin</b>.
              For security, set <code>ADMIN_BOOTSTRAP_CODE</code> in Azure App Settings.
            </div>
          </div>
        </aside>

        <main className="main">
          <Routes>
            <Route path="/" element={<Dashboard me={me} onToast={setToast} />} />
            <Route path="/welcome" element={<Welcome me={me} onToast={setToast} />} />
            <Route path="/calendar" element={<Calendar me={me} onToast={setToast} />} />
            <Route path="/work" element={<WorkOrders me={me} onToast={setToast} />} />
            <Route path="/grocery" element={<Grocery me={me} onToast={setToast} />} />
            <Route path="/feed" element={<Feed me={me} onToast={setToast} />} />
            <Route path="/settings/space" element={<SpaceSettings me={me} onToast={setToast} />} />
            <Route path="/account" element={<Account me={me} onToast={setToast} />} />
            <Route path="*" element={<div className="card"><h2>Not Found</h2><p className="muted">That page doesn’t exist.</p></div>} />
          </Routes>
        </main>
      </div>

      <footer className="footer">
        <div className="muted">NestPoint (Azure-first) • Static Web Apps + Functions + Table Storage + Blob</div>
      </footer>

      {!!toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
