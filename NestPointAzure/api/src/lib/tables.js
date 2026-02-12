import { TableClient } from '@azure/data-tables'

const TABLES = {
  Spaces: 'Spaces',
  Memberships: 'Memberships',
  UserPrefs: 'UserPrefs',
  CalendarEvents: 'CalendarEvents',
  WorkOrders: 'WorkOrders',
  GroceryItems: 'GroceryItems',
  Posts: 'Posts',
  Invites: 'Invites'
}

export function tableName(key) {
  return TABLES[key] || key
}

export function getTableClient(tableKey) {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (!conn) throw new Error('Missing AZURE_STORAGE_CONNECTION_STRING')
  const name = tableName(tableKey)
  return TableClient.fromConnectionString(conn, name)
}

export async function ensureTables() {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (!conn) throw new Error('Missing AZURE_STORAGE_CONNECTION_STRING')
  const names = Object.values(TABLES)
  for (const t of names) {
    const client = TableClient.fromConnectionString(conn, t)
    try {
      await client.createTable()
    } catch (e) {
      // ignore conflicts (already exists)
    }
  }
}
