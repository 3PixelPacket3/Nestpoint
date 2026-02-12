import { unauthorized } from './respond.js'

export function getClientPrincipal(req) {
  const hdr = req.headers.get('x-ms-client-principal')
  if (!hdr) return null
  try {
    const decoded = Buffer.from(hdr, 'base64').toString('utf8')
    const principal = JSON.parse(decoded)
    const userId = principal.userId
    const userDetails = principal.userDetails
    const identityProvider = principal.identityProvider
    return {
      userId,
      userDetails,
      provider: identityProvider,
      claims: principal.userClaims || []
    }
  } catch {
    return null
  }
}

export function requireAuth(req) {
  const principal = getClientPrincipal(req)
  if (!principal || !principal.userId) {
    return { ok: false, response: unauthorized() }
  }
  return { ok: true, principal }
}
