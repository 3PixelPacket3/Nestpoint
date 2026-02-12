import { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, SASProtocol, StorageSharedKeyCredential } from '@azure/storage-blob'

export function getBlobServiceClient() {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (!conn) throw new Error('Missing AZURE_STORAGE_CONNECTION_STRING')
  return BlobServiceClient.fromConnectionString(conn)
}

export function getContainerName() {
  return process.env.MEDIA_CONTAINER || 'media'
}

function parseConnString(conn) {
  // Very small parser to extract account name + key from a connection string
  const parts = Object.fromEntries(conn.split(';').map(p => p.split('=')))
  return {
    accountName: parts.AccountName,
    accountKey: parts.AccountKey
  }
}

export function buildSasUrls({ blobName, contentType }) {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (!conn) throw new Error('Missing AZURE_STORAGE_CONNECTION_STRING')
  const { accountName, accountKey } = parseConnString(conn)
  if (!accountName || !accountKey) throw new Error('Connection string must include AccountName and AccountKey')

  const containerName = getContainerName()
  const credential = new StorageSharedKeyCredential(accountName, accountKey)

  const expiresOn = new Date(Date.now() + 15 * 60 * 1000)
  const permissions = BlobSASPermissions.parse('cw') // create + write

  const sas = generateBlobSASQueryParameters({
    containerName,
    blobName,
    permissions,
    expiresOn,
    protocol: SASProtocol.Https
  }, credential).toString()

  const base = `https://${accountName}.blob.core.windows.net/${containerName}/${encodeURIComponent(blobName)}`
  const uploadUrl = `${base}?${sas}`

  // Read URL: we can either return a public URL (if container is private it won't work) or create a short read SAS.
  // We'll provide a short read SAS as well.
  const readSas = generateBlobSASQueryParameters({
    containerName,
    blobName,
    permissions: BlobSASPermissions.parse('r'),
    expiresOn,
    protocol: SASProtocol.Https,
    contentType
  }, credential).toString()
  const readUrl = `${base}?${readSas}`

  return { uploadUrl, readUrl, expiresOn }
}
