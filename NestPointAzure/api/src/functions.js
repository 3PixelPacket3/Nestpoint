import { app } from '@azure/functions'
import { ensureTables, getTableClient } from './lib/tables.js'
import { requireAuth } from './lib/auth.js'
import { badRequest, forbidden, json, notFound, unauthorized } from './lib/respond.js'
import { createSpace, getMembership, getSpace, getUserPrefs, listMembers, listSpacesForUser, regenerateInvite, redeemInvite, setUserActiveSpace } from './lib/domain.js'
import { buildSasUrls, getBlobServiceClient, getContainerName } from './lib/blob.js'
import { v4 as uuidv4 } from 'uuid'

let tablesEnsured = false
async function ensureOnce() {
  if (!tablesEnsured) {
    await ensureTables()
    tablesEnsured = true
  }
}

async function requireSpace(req, principal) {
  await ensureOnce()
  const prefs = await getUserPrefs(principal.userId)
  const activeSpaceId = prefs?.activeSpaceId || null
  if (!activeSpaceId) return { ok: false, response: badRequest('No active space selected') }
  const membership = await getMembership(principal.userId, activeSpaceId)
  if (!membership) return { ok: false, response: forbidden('You are not a member of this space') }
  return { ok: true, spaceId: activeSpaceId, membership }
}

function isAdmin(role) {
  return role === 'Owner' || role === 'Admin'
}

function safeString(v, max = 4000) {
  const s = String(v ?? '').trim()
  return s.length > max ? s.slice(0, max) : s
}

// -------------------- /api/me --------------------
app.http('me', {
  methods: ['GET'],
  route: 'me',
  authLevel: 'anonymous',
  handler: async (req) => {
    await ensureOnce()
    const principal = requireAuth(req)
    if (!principal.ok) return principal.response
    const p = principal.principal

    const prefs = await getUserPrefs(p.userId)
    const activeSpaceId = prefs?.activeSpaceId || null
    let activeSpaceName = null
    let activeRole = null

    if (activeSpaceId) {
      try {
        const sp = await getSpace(activeSpaceId)
        activeSpaceName = sp?.name || null
      } catch {}
      const mem = await getMembership(p.userId, activeSpaceId)
      activeRole = mem?.role || null
    }

    return json(200, {
      isAuthenticated: true,
      provider: p.provider,
      userId: p.userId,
      userDetails: p.userDetails,
      activeSpaceId,
      activeSpaceName,
      activeRole
    })
  }
})

// -------------------- /api/spaces --------------------
app.http('spaces', {
  methods: ['GET', 'POST'],
  route: 'spaces',
  authLevel: 'anonymous',
  handler: async (req) => {
    await ensureOnce()
    const auth = requireAuth(req)
    if (!auth.ok) return auth.response
    const principal = auth.principal

    if (req.method === 'GET') {
      const spaces = await listSpacesForUser(principal.userId)
      // fill names from space entity if missing
      for (const s of spaces) {
        if (!s.name) {
          try { s.name = (await getSpace(s.spaceId)).name } catch {}
        }
      }
      return json(200, { spaces })
    }

    // POST create space
    const body = await req.json().catch(() => null)
    const name = safeString(body?.name, 120)
    const adminCode = safeString(body?.adminCode, 80)
    if (!name || name.length < 2) return badRequest('Space name is required')

    const required = process.env.ADMIN_BOOTSTRAP_CODE || 'Admin'
    if (adminCode !== required) {
      return forbidden('Invalid admin code')
    }

    const space = await createSpace({ name, owner: principal })
    await setUserActiveSpace(principal.userId, space.spaceId)
    return json(200, { space })
  }
})

app.http('spacesSelect', {
  methods: ['POST'],
  route: 'spaces/select',
  authLevel: 'anonymous',
  handler: async (req) => {
    await ensureOnce()
    const auth = requireAuth(req)
    if (!auth.ok) return auth.response
    const principal = auth.principal

    const body = await req.json().catch(() => null)
    const spaceId = safeString(body?.spaceId, 80)
    if (!spaceId) return badRequest('spaceId required')

    const mem = await getMembership(principal.userId, spaceId)
    if (!mem) return forbidden('You are not a member of that space')

    await setUserActiveSpace(principal.userId, spaceId)
    return json(200, { ok: true })
  }
})

app.http('spacesMembers', {
  methods: ['GET'],
  route: 'spaces/members',
  authLevel: 'anonymous',
  handler: async (req) => {
    const auth = requireAuth(req)
    if (!auth.ok) return auth.response
    const principal = auth.principal

    const s = await requireSpace(req, principal)
    if (!s.ok) return s.response

    const members = await listMembers(s.spaceId)
    // current invite (stored on space)
    const space = await getSpace(s.spaceId)
    const invite = space?.inviteCode ? { code: space.inviteCode, createdAt: space.inviteCreatedAt } : null

    return json(200, { members, invite })
  }
})

app.http('spacesInvite', {
  methods: ['POST'],
  route: 'spaces/invite',
  authLevel: 'anonymous',
  handler: async (req) => {
    const auth = requireAuth(req)
    if (!auth.ok) return auth.response
    const principal = auth.principal

    const s = await requireSpace(req, principal)
    if (!s.ok) return s.response
    if (!isAdmin(s.membership.role)) return forbidden('Admin only')

    const invite = await regenerateInvite(s.spaceId, principal)
    return json(200, { invite })
  }
})

app.http('spacesRedeem', {
  methods: ['POST'],
  route: 'spaces/redeem',
  authLevel: 'anonymous',
  handler: async (req) => {
    await ensureOnce()
    const auth = requireAuth(req)
    if (!auth.ok) return auth.response
    const principal = auth.principal

    const body = await req.json().catch(() => null)
    const spaceId = safeString(body?.spaceId, 80)
    const code = safeString(body?.code, 20).toUpperCase()
    if (!spaceId || !code) return badRequest('spaceId and code are required')

    const r = await redeemInvite({ spaceId, code, user: principal })
    if (!r.ok) return forbidden(r.error)

    await setUserActiveSpace(principal.userId, spaceId)
    return json(200, { ok: true })
  }
})

// -------------------- /api/summary --------------------
app.http('summary', {
  methods: ['GET'],
  route: 'summary',
  authLevel: 'anonymous',
  handler: async (req) => {
    const auth = requireAuth(req)
    if (!auth.ok) return auth.response
    const principal = auth.principal
    const s = await requireSpace(req, principal)
    if (!s.ok) return s.response

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const in7 = new Date(today.getTime() + 7*24*60*60*1000)

    const cal = getTableClient('CalendarEvents')
    const work = getTableClient('WorkOrders')
    const groc = getTableClient('GroceryItems')
    const posts = getTableClient('Posts')

    // simple counts via scans (fine for family-scale)
    let calendarToday = 0
    let calendarWeek = 0
    let workOpen = 0
    let workDueSoon = 0
    let groceryOpen = 0
    let postsMonth = 0

    const calFilter = `PartitionKey eq '${s.spaceId}'`
    for await (const e of cal.listEntities({ queryOptions: { filter: calFilter } })) {
      const dt = new Date(e.date)
      if (dt >= today && dt < new Date(today.getTime()+24*60*60*1000)) calendarToday++
      if (dt >= today && dt < in7) calendarWeek++
    }

    const workFilter = `PartitionKey eq '${s.spaceId}'`
    for await (const e of work.listEntities({ queryOptions: { filter: workFilter } })) {
      if (e.status !== 'Done') workOpen++
      if (e.status !== 'Done' && e.dueDate) {
        const dd = new Date(e.dueDate)
        if (dd >= today && dd < in7) workDueSoon++
      }
    }

    const grocFilter = `PartitionKey eq '${s.spaceId}'`
    for await (const e of groc.listEntities({ queryOptions: { filter: grocFilter } })) {
      if (!e.purchased) groceryOpen++
    }

    const monthAgo = new Date(now.getTime() - 30*24*60*60*1000)
    const postFilter = `PartitionKey eq '${s.spaceId}'`
    for await (const e of posts.listEntities({ queryOptions: { filter: postFilter } })) {
      const cd = new Date(e.createdAt)
      if (cd >= monthAgo) postsMonth++
    }

    const members = (await listMembers(s.spaceId)).length

    return json(200, {
      calendarToday,
      calendarWeek,
      workOpen,
      workDueSoon,
      remindersOverdue: 0,
      remindersWeek: 0,
      groceryOpen,
      groceryLists: 1,
      postsMonth,
      mediaCount: null,
      members
    })
  }
})

// -------------------- /api/calendar --------------------
app.http('calendar', {
  methods: ['GET','POST'],
  route: 'calendar',
  authLevel: 'anonymous',
  handler: async (req) => {
    const auth = requireAuth(req)
    if (!auth.ok) return auth.response
    const principal = auth.principal
    const s = await requireSpace(req, principal)
    if (!s.ok) return s.response

    const table = getTableClient('CalendarEvents')

    if (req.method === 'GET') {
      const u = new URL(req.url)
      const start = u.searchParams.get('start')
      const days = Math.min(60, Math.max(1, Number(u.searchParams.get('days') || 14)))
      const startDate = start ? new Date(start) : new Date()
      const endDate = new Date(startDate.getTime() + days*24*60*60*1000)

      const items = []
      const filter = `PartitionKey eq '${s.spaceId}'`
      for await (const e of table.listEntities({ queryOptions: { filter } })) {
        const dt = new Date(e.date)
        if (dt >= startDate && dt < endDate) {
          items.push({ id: e.rowKey, title: e.title, date: e.date, category: e.category, notes: e.notes })
        }
      }
      items.sort((a,b)=> String(a.date).localeCompare(String(b.date)))
      return json(200, { items })
    }

    const body = await req.json().catch(() => null)
    const title = safeString(body?.title, 140)
    const date = safeString(body?.date, 40)
    const category = safeString(body?.category, 60) || 'Household'
    const notes = safeString(body?.notes, 4000)
    if (!title || title.length < 2) return badRequest('title required')
    if (!date) return badRequest('date required')

    const id = uuidv4()
    await table.createEntity({
      partitionKey: s.spaceId,
      rowKey: id,
      title,
      date: new Date(date).toISOString(),
      category,
      notes,
      createdAt: new Date().toISOString(),
      createdBy: principal.userId
    })

    return json(200, { ok: true, id })
  }
})

app.http('calendarItem', {
  methods: ['DELETE'],
  route: 'calendar/{id}',
  authLevel: 'anonymous',
  handler: async (req, ctx) => {
    const auth = requireAuth(req)
    if (!auth.ok) return auth.response
    const principal = auth.principal
    const s = await requireSpace(req, principal)
    if (!s.ok) return s.response

    const id = ctx.bindingData.id
    const table = getTableClient('CalendarEvents')
    try {
      await table.deleteEntity(s.spaceId, id)
      return json(200, { ok: true })
    } catch {
      return notFound('Event not found')
    }
  }
})

// -------------------- /api/workorders --------------------
app.http('workorders', {
  methods: ['GET','POST'],
  route: 'workorders',
  authLevel: 'anonymous',
  handler: async (req) => {
    const auth = requireAuth(req)
    if (!auth.ok) return auth.response
    const principal = auth.principal
    const s = await requireSpace(req, principal)
    if (!s.ok) return s.response

    const table = getTableClient('WorkOrders')

    if (req.method === 'GET') {
      const u = new URL(req.url)
      const status = u.searchParams.get('status') || null
      const items = []
      const filter = `PartitionKey eq '${s.spaceId}'`
      for await (const e of table.listEntities({ queryOptions: { filter } })) {
        if (!status || e.status === status) {
          items.push({
            id: e.rowKey,
            title: e.title,
            description: e.description,
            status: e.status,
            priority: e.priority,
            dueDate: e.dueDate || null,
            createdAt: e.createdAt
          })
        }
      }
      items.sort((a,b)=> String(b.createdAt||'').localeCompare(String(a.createdAt||'')))
      return json(200, { items })
    }

    const body = await req.json().catch(()=>null)
    const title = safeString(body?.title, 140)
    const description = safeString(body?.description, 6000)
    const priority = safeString(body?.priority, 20) || 'Medium'
    const dueDateRaw = body?.dueDate ? safeString(body.dueDate, 40) : null

    if (!title || title.length < 2) return badRequest('title required')

    const id = uuidv4()
    await table.createEntity({
      partitionKey: s.spaceId,
      rowKey: id,
      title,
      description,
      status: 'Open',
      priority,
      dueDate: dueDateRaw ? new Date(dueDateRaw).toISOString() : null,
      createdAt: new Date().toISOString(),
      createdBy: principal.userId
    })

    return json(200, { ok: true, id })
  }
})

app.http('workordersItem', {
  methods: ['PATCH','DELETE'],
  route: 'workorders/{id}',
  authLevel: 'anonymous',
  handler: async (req, ctx) => {
    const auth = requireAuth(req)
    if (!auth.ok) return auth.response
    const principal = auth.principal
    const s = await requireSpace(req, principal)
    if (!s.ok) return s.response

    const id = ctx.bindingData.id
    const table = getTableClient('WorkOrders')

    if (req.method === 'DELETE') {
      try {
        await table.deleteEntity(s.spaceId, id)
        return json(200, { ok: true })
      } catch {
        return notFound('Work order not found')
      }
    }

    const body = await req.json().catch(()=>null)
    const status = safeString(body?.status, 40)
    if (!status) return badRequest('status required')

    try {
      const existing = await table.getEntity(s.spaceId, id)
      existing.status = status
      existing.updatedAt = new Date().toISOString()
      await table.upsertEntity(existing, 'Replace')
      return json(200, { ok: true })
    } catch {
      return notFound('Work order not found')
    }
  }
})

// -------------------- /api/grocery --------------------
app.http('grocery', {
  methods: ['GET','POST'],
  route: 'grocery',
  authLevel: 'anonymous',
  handler: async (req) => {
    const auth = requireAuth(req)
    if (!auth.ok) return auth.response
    const principal = auth.principal
    const s = await requireSpace(req, principal)
    if (!s.ok) return s.response

    const table = getTableClient('GroceryItems')

    if (req.method === 'GET') {
      const u = new URL(req.url)
      const showDone = u.searchParams.get('showDone') === '1'
      const items = []
      const filter = `PartitionKey eq '${s.spaceId}'`
      for await (const e of table.listEntities({ queryOptions: { filter } })) {
        if (showDone || !e.purchased) {
          items.push({ id: e.rowKey, text: e.text, category: e.category || 'Other', purchased: !!e.purchased, createdAt: e.createdAt })
        }
      }
      items.sort((a,b)=> (a.purchased===b.purchased? String(b.createdAt).localeCompare(String(a.createdAt)) : (a.purchased?1:-1)))
      return json(200, { items })
    }

    const body = await req.json().catch(()=>null)
    const text = safeString(body?.text, 200)
    const category = safeString(body?.category, 30) || 'Other'
    if (!text) return badRequest('text required')

    const id = uuidv4()
    await table.createEntity({
      partitionKey: s.spaceId,
      rowKey: id,
      text,
      category,
      purchased: false,
      createdAt: new Date().toISOString(),
      createdBy: principal.userId
    })

    return json(200, { ok: true, id })
  }
})

app.http('groceryItem', {
  methods: ['PATCH','DELETE'],
  route: 'grocery/{id}',
  authLevel: 'anonymous',
  handler: async (req, ctx) => {
    const auth = requireAuth(req)
    if (!auth.ok) return auth.response
    const principal = auth.principal
    const s = await requireSpace(req, principal)
    if (!s.ok) return s.response

    const id = ctx.bindingData.id
    const table = getTableClient('GroceryItems')

    if (req.method === 'DELETE') {
      try {
        await table.deleteEntity(s.spaceId, id)
        return json(200, { ok: true })
      } catch {
        return notFound('Item not found')
      }
    }

    const body = await req.json().catch(()=>null)
    const purchased = !!body?.purchased
    try {
      const existing = await table.getEntity(s.spaceId, id)
      existing.purchased = purchased
      existing.updatedAt = new Date().toISOString()
      await table.upsertEntity(existing, 'Replace')
      return json(200, { ok: true })
    } catch {
      return notFound('Item not found')
    }
  }
})

// -------------------- /api/feed --------------------
app.http('feed', {
  methods: ['GET','POST'],
  route: 'feed',
  authLevel: 'anonymous',
  handler: async (req) => {
    const auth = requireAuth(req)
    if (!auth.ok) return auth.response
    const principal = auth.principal
    const s = await requireSpace(req, principal)
    if (!s.ok) return s.response

    const table = getTableClient('Posts')

    if (req.method === 'GET') {
      const items = []
      const filter = `PartitionKey eq '${s.spaceId}'`
      for await (const e of table.listEntities({ queryOptions: { filter } })) {
        items.push({
          id: e.rowKey,
          text: e.text,
          media: e.mediaJson ? JSON.parse(e.mediaJson) : null,
          createdAt: e.createdAt,
          authorId: e.createdBy,
          authorName: e.authorName
        })
      }
      items.sort((a,b)=> String(b.createdAt).localeCompare(String(a.createdAt)))
      return json(200, { items })
    }

    const body = await req.json().catch(()=>null)
    const text = safeString(body?.text, 6000)
    const media = body?.media || null
    if (!text && !media) return badRequest('Post must include text or media')

    const id = uuidv4()
    await table.createEntity({
      partitionKey: s.spaceId,
      rowKey: id,
      text,
      mediaJson: media ? JSON.stringify(media) : null,
      createdAt: new Date().toISOString(),
      createdBy: principal.userId,
      authorName: principal.userDetails
    })

    return json(200, { ok: true, id })
  }
})

app.http('feedItem', {
  methods: ['DELETE'],
  route: 'feed/{id}',
  authLevel: 'anonymous',
  handler: async (req, ctx) => {
    const auth = requireAuth(req)
    if (!auth.ok) return auth.response
    const principal = auth.principal
    const s = await requireSpace(req, principal)
    if (!s.ok) return s.response

    const id = ctx.bindingData.id
    const table = getTableClient('Posts')
    try {
      await table.deleteEntity(s.spaceId, id)
      return json(200, { ok: true })
    } catch {
      return notFound('Post not found')
    }
  }
})

// -------------------- /api/uploads/sas --------------------
app.http('uploadsSas', {
  methods: ['POST'],
  route: 'uploads/sas',
  authLevel: 'anonymous',
  handler: async (req) => {
    const auth = requireAuth(req)
    if (!auth.ok) return auth.response
    const principal = auth.principal
    const s = await requireSpace(req, principal)
    if (!s.ok) return s.response

    const body = await req.json().catch(()=>null)
    const fileName = safeString(body?.fileName, 200)
    const contentType = safeString(body?.contentType, 120)
    if (!fileName) return badRequest('fileName required')

    // Ensure container exists
    const svc = getBlobServiceClient()
    const container = svc.getContainerClient(getContainerName())
    await container.createIfNotExists()

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const blobName = `${s.spaceId}/${Date.now()}_${uuidv4()}_${safeName}`

    const { uploadUrl, readUrl, expiresOn } = buildSasUrls({ blobName, contentType })
    return json(200, { uploadUrl, readUrl, expiresOn, blobName })
  }
})
