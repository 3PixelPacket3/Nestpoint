import React, { useEffect, useMemo, useRef, useState } from 'react'
import { apiGet, apiJson } from '../lib/api.js'

async function uploadWithSas(sasUrl, file) {
  const res = await fetch(sasUrl, {
    method: 'PUT',
    headers: {
      'x-ms-blob-type': 'BlockBlob',
      'Content-Type': file.type || 'application/octet-stream'
    },
    body: file
  })
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${res.statusText}`)
}

export default function Feed({ me, onToast }) {
  const authed = !!me.data?.isAuthenticated
  const spaceId = me.data?.activeSpaceId

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const fileRef = useRef(null)

  const canPost = useMemo(() => text.trim().length > 0 || !!file, [text, file])

  async function refresh() {
    if (!authed || !spaceId) return
    setLoading(true)
    try {
      const d = await apiGet('/api/feed')
      setItems(d.items || [])
    } catch (e) {
      onToast?.(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [authed, spaceId])

  async function createPost() {
    try {
      let media = null
      if (file) {
        const sas = await apiJson('POST', '/api/uploads/sas', {
          fileName: file.name,
          contentType: file.type || 'application/octet-stream'
        })
        await uploadWithSas(sas.uploadUrl, file)
        media = {
          url: sas.readUrl,
          contentType: file.type || 'application/octet-stream',
          name: file.name,
          size: file.size
        }
      }

      await apiJson('POST', '/api/feed', {
        text: text.trim(),
        media
      })

      setText('')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      onToast?.('Posted ✅')
      refresh()
    } catch (e) {
      onToast?.(e.message)
    }
  }

  async function remove(id) {
    try {
      await apiJson('DELETE', `/api/feed/${encodeURIComponent(id)}`)
      refresh()
    } catch (e) {
      onToast?.(e.message)
    }
  }

  if (!authed) {
    return <div className="card"><h2>Family Feed</h2><p className="muted">Sign in to view your private family timeline.</p><a className="btn" href="/.auth/login/aad">Sign in</a></div>
  }
  if (!spaceId) {
    return <div className="card"><h2>Family Feed</h2><p className="muted">Select a space first.</p><a className="btn" href="/welcome">Select Space</a></div>
  }

  return (
    <div className="stack">
      <div className="card">
        <h2 style={{marginBottom:6}}>Family Feed</h2>
        <p className="muted">Private social feed for posts, photos, and videos. MVP supports single-media upload via Azure Blob SAS.</p>

        <div className="form" style={{marginTop:12}}>
          <label>
            Post
            <textarea value={text} onChange={(e)=>setText(e.target.value)} placeholder="Share an update, photo, or memory…" />
          </label>
          <label>
            Media (optional)
            <input ref={fileRef} type="file" accept="image/*,video/*" onChange={(e)=>setFile(e.target.files?.[0] || null)} />
          </label>
          <button className="btn" disabled={!canPost} onClick={createPost}>Post</button>
          <div className="muted" style={{lineHeight:1.6}}>
            Cost-control tip: keep videos short, and consider adding a file-size limit client-side.
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Recent</h2>
        <div className="list" style={{marginTop:14}}>
          {loading ? (
            <div className="muted">Loading…</div>
          ) : items.length === 0 ? (
            <div className="muted">No posts yet.</div>
          ) : (
            items.map((p) => (
              <div key={p.id} className="list-item" style={{alignItems:'flex-start'}}>
                <div className="list-main">
                  <div className="row" style={{justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                    <div className="list-title">{p.authorName || 'Family member'}</div>
                    <div className="muted">{new Date(p.createdAt).toLocaleString()}</div>
                  </div>
                  {p.text ? <div style={{marginTop:8,whiteSpace:'pre-wrap'}}>{p.text}</div> : null}
                  {p.media?.url ? (
                    <div style={{marginTop:12}}>
                      {String(p.media.contentType||'').startsWith('video') ? (
                        <video controls style={{width:'100%',maxWidth:720,borderRadius:14,border:'1px solid var(--line)'}} src={p.media.url} />
                      ) : (
                        <img alt={p.media.name||'media'} style={{width:'100%',maxWidth:720,borderRadius:14,border:'1px solid var(--line)'}} src={p.media.url} />
                      )}
                    </div>
                  ) : null}
                </div>
                <button className="btn danger" onClick={() => remove(p.id)}>Delete</button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
