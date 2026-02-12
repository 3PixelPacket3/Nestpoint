export async function apiGet(path) {
  const res = await fetch(path, {
    headers: { 'Accept': 'application/json' },
    credentials: 'include'
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export async function apiJson(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }
  if (!res.ok) {
    const msg = data?.error || data?.message || `${res.status} ${res.statusText}`
    const err = new Error(msg)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}
