export function json(status, body, headers = {}) {
  return {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers
    },
    body: JSON.stringify(body ?? null)
  }
}

export function badRequest(message, extra = {}) {
  return json(400, { error: message, ...extra })
}

export function unauthorized(message = 'Unauthorized') {
  return json(401, { error: message })
}

export function forbidden(message = 'Forbidden') {
  return json(403, { error: message })
}

export function notFound(message = 'Not found') {
  return json(404, { error: message })
}
