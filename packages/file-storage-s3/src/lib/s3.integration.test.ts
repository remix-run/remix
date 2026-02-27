import * as assert from 'node:assert/strict'
import { before, beforeEach, describe, it } from 'node:test'
import { AwsClient } from 'aws4fetch'

import { createS3FileStorage } from './s3.ts'

let integrationEnabled =
  process.env.FILE_STORAGE_S3_INTEGRATION === '1' &&
  typeof process.env.FILE_STORAGE_S3_ENDPOINT === 'string' &&
  typeof process.env.FILE_STORAGE_S3_BUCKET === 'string' &&
  typeof process.env.FILE_STORAGE_S3_REGION === 'string' &&
  typeof process.env.FILE_STORAGE_S3_ACCESS_KEY_ID === 'string' &&
  typeof process.env.FILE_STORAGE_S3_SECRET_ACCESS_KEY === 'string'

describe('s3 file storage integration', () => {
  let storage: ReturnType<typeof createS3FileStorage>
  let bucketUrl: URL
  let client: AwsClient

  before(async () => {
    if (!integrationEnabled) {
      return
    }

    let endpoint = process.env.FILE_STORAGE_S3_ENDPOINT!
    let bucket = process.env.FILE_STORAGE_S3_BUCKET!
    let forcePathStyle = process.env.FILE_STORAGE_S3_FORCE_PATH_STYLE === '1'

    storage = createS3FileStorage({
      accessKeyId: process.env.FILE_STORAGE_S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.FILE_STORAGE_S3_SECRET_ACCESS_KEY!,
      sessionToken: process.env.FILE_STORAGE_S3_SESSION_TOKEN,
      bucket,
      endpoint,
      region: process.env.FILE_STORAGE_S3_REGION!,
      forcePathStyle,
    })

    client = new AwsClient({
      accessKeyId: process.env.FILE_STORAGE_S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.FILE_STORAGE_S3_SECRET_ACCESS_KEY!,
      sessionToken: process.env.FILE_STORAGE_S3_SESSION_TOKEN,
      service: 's3',
      region: process.env.FILE_STORAGE_S3_REGION!,
    })

    bucketUrl = createBucketUrl(endpoint, bucket, forcePathStyle)

    await ensureBucketExists(client, bucketUrl)
  })

  beforeEach(async () => {
    if (!integrationEnabled) {
      return
    }

    await clearStorage(storage)
  })

  it(
    'stores and retrieves files',
    { skip: !integrationEnabled },
    async () => {
      let lastModified = Date.now()
      let file = new File(['Hello, world!'], 'hello.txt', {
        type: 'text/plain',
        lastModified,
      })

      await storage.set('hello', file)

      assert.ok(await storage.has('hello'))

      let retrieved = await storage.get('hello')

      assert.ok(retrieved)
      assert.equal(retrieved.name, 'hello.txt')
      assert.equal(retrieved.type, 'text/plain')
      assert.equal(retrieved.lastModified, lastModified)
      assert.equal(retrieved.size, 13)
      assert.equal(await retrieved.text(), 'Hello, world!')

      await storage.remove('hello')

      assert.ok(!(await storage.has('hello')))
      assert.equal(await storage.get('hello'), null)
    },
  )

  it(
    'lists files with pagination and prefix filtering',
    { skip: !integrationEnabled },
    async () => {
      let allKeys = ['a', 'b', 'b/c', 'c', 'd']

      await Promise.all(
        allKeys.map((key) =>
          storage.set(key, new File([`Hello ${key}!`], `${key}.txt`, { type: 'text/plain' })),
        ),
      )

      let { cursor, files } = await storage.list({ limit: 2 })
      assert.notEqual(cursor, undefined)
      assert.equal(files.length, 2)

      let { files: files2 } = await storage.list({ cursor })
      assert.equal(files2.length, 3)

      let { files: prefixedFiles } = await storage.list({ prefix: 'b' })
      assert.equal(prefixedFiles.length, 2)
      assert.deepEqual(
        prefixedFiles.map((file) => file.key),
        ['b', 'b/c'],
      )
    },
  )

  it(
    'lists files with metadata',
    { skip: !integrationEnabled },
    async () => {
      let lastModified = Date.now()
      let file = new File(['Hello, world!'], 'hello.txt', {
        type: 'text/plain',
        lastModified,
      })

      await storage.set('hello', file)

      let { files } = await storage.list({ includeMetadata: true })

      assert.equal(files.length, 1)
      assert.equal(files[0].key, 'hello')
      assert.equal(files[0].name, 'hello.txt')
      assert.equal(files[0].type, 'text/plain')
      assert.equal(files[0].lastModified, lastModified)
      assert.equal(files[0].size, 13)
    },
  )
})

async function ensureBucketExists(client: AwsClient, bucketUrl: URL): Promise<void> {
  let response = await client.fetch(bucketUrl, { method: 'PUT' })

  if (response.ok || response.status === 409) {
    return
  }

  throw new Error(`Unable to create integration bucket: ${response.status} ${response.statusText}`)
}

async function clearStorage(storage: ReturnType<typeof createS3FileStorage>): Promise<void> {
  let cursor: string | undefined

  do {
    let result = await storage.list({ cursor, limit: 100 })
    cursor = result.cursor

    await Promise.all(result.files.map((file) => storage.remove(file.key)))
  } while (cursor != null)
}

function createBucketUrl(endpoint: string, bucket: string, forcePathStyle: boolean): URL {
  let endpointUrl = new URL(endpoint)

  if (forcePathStyle) {
    endpointUrl.pathname = joinPath(endpointUrl.pathname, bucket)
  } else {
    endpointUrl.hostname = `${bucket}.${endpointUrl.hostname}`
    endpointUrl.pathname = joinPath(endpointUrl.pathname)
  }

  return endpointUrl
}

function joinPath(basePath: string, ...parts: (string | undefined)[]): string {
  let normalizedBasePath = basePath.replace(/\/+$/g, '')
  let normalizedParts = parts
    .filter((part): part is string => part != null && part !== '')
    .map((part) => part.replace(/^\/+|\/+$/g, ''))

  let joined = [normalizedBasePath, ...normalizedParts].filter((part) => part !== '').join('/')
  if (joined === '') {
    return '/'
  }

  return joined.startsWith('/') ? joined : `/${joined}`
}
