import { v4 as uuidv4 } from 'uuid'
import { getTableClient } from './tables.js'

export async function getUserPrefs(userId) {
  const prefs = getTableClient('UserPrefs')
  try {
    const ent = await prefs.getEntity(userId, 'prefs')
    return ent
  } catch {
    return null
  }
}

export async function setUserActiveSpace(userId, spaceId) {
  const prefs = getTableClient('UserPrefs')
  await prefs.upsertEntity({ partitionKey: userId, rowKey: 'prefs', activeSpaceId: spaceId, updatedAt: new Date().toISOString() })
}

export async function getSpace(spaceId) {
  const spaces = getTableClient('Spaces')
  const ent = await spaces.getEntity('space', spaceId)
  return ent
}

export async function listSpacesForUser(userId) {
  const memberships = getTableClient('Memberships')
  const out = []
  const filter = `PartitionKey eq '${userId.replace("'","''")}'`
  for await (const e of memberships.listEntities({ queryOptions: { filter } })) {
    out.push({ spaceId: e.rowKey, role: e.role, createdAt: e.createdAt, name: e.spaceName })
  }
  // sort newest first
  out.sort((a,b) => String(b.createdAt||'').localeCompare(String(a.createdAt||'')))
  return out
}

export async function getMembership(userId, spaceId) {
  const memberships = getTableClient('Memberships')
  try {
    return await memberships.getEntity(userId, spaceId)
  } catch {
    return null
  }
}

export async function listMembers(spaceId) {
  const members = []
  const memberships = getTableClient('Memberships')
  const filter = `RowKey eq '${spaceId.replace("'","''")}'`
  for await (const e of memberships.listEntities({ queryOptions: { filter } })) {
    members.push({ userId: e.partitionKey, role: e.role, name: e.userName, provider: e.provider, createdAt: e.createdAt })
  }
  members.sort((a,b)=> String(a.createdAt||'').localeCompare(String(b.createdAt||'')))
  return members
}

export async function createSpace({ name, owner }) {
  const spaces = getTableClient('Spaces')
  const memberships = getTableClient('Memberships')
  const invites = getTableClient('Invites')

  const spaceId = uuidv4()
  const createdAt = new Date().toISOString()
  const inviteCode = randomInviteCode()

  await spaces.createEntity({
    partitionKey: 'space',
    rowKey: spaceId,
    name,
    createdAt,
    inviteCode,
    inviteCreatedAt: createdAt
  })

  await memberships.upsertEntity({
    partitionKey: owner.userId,
    rowKey: spaceId,
    role: 'Owner',
    spaceName: name,
    userName: owner.userDetails,
    provider: owner.provider,
    createdAt
  })

  await invites.upsertEntity({
    partitionKey: spaceId,
    rowKey: inviteCode,
    code: inviteCode,
    createdAt,
    createdBy: owner.userId
  })

  return { spaceId, name, createdAt, inviteCode }
}

export async function regenerateInvite(spaceId, actor) {
  const spaces = getTableClient('Spaces')
  const invites = getTableClient('Invites')

  const code = randomInviteCode()
  const createdAt = new Date().toISOString()

  await spaces.updateEntity({ partitionKey: 'space', rowKey: spaceId, inviteCode: code, inviteCreatedAt: createdAt }, 'Merge')
  await invites.upsertEntity({ partitionKey: spaceId, rowKey: code, code, createdAt, createdBy: actor.userId })

  return { code, createdAt }
}

export async function redeemInvite({ spaceId, code, user }) {
  const spaces = getTableClient('Spaces')
  const invites = getTableClient('Invites')
  const memberships = getTableClient('Memberships')

  // verify invite exists
  await spaces.getEntity('space', spaceId)
  try {
    await invites.getEntity(spaceId, code)
  } catch {
    return { ok: false, error: 'Invalid invite code' }
  }

  // add membership if missing
  const existing = await getMembership(user.userId, spaceId)
  if (!existing) {
    await memberships.upsertEntity({
      partitionKey: user.userId,
      rowKey: spaceId,
      role: 'Member',
      spaceName: null,
      userName: user.userDetails,
      provider: user.provider,
      createdAt: new Date().toISOString()
    })
  }
  return { ok: true }
}

function randomInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i=0;i<8;i++) s += alphabet[Math.floor(Math.random()*alphabet.length)]
  return s
}
