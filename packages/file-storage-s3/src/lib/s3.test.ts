import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createS3FileStorage } from './s3.ts'

const BUCKET = 'test-bucket'
const ENDPOINT = 'https://s3.us-east-1.amazonaws.com'

type StoredObject = {
  body: ArrayBuffer
  contentType: string
  metadata: Record<string, string>
  updatedAt: number
}

describe('s3 file storage', () => {
  it('stores and retrieves files', async () => {
    let storage = createS3FileStorage({
      accessKeyId: 'test',
      secretAccessKey: 'test',
      bucket: BUCKET,
      endpoint: ENDPOINT,
      region: 'us-east-1',
      fetch: createMockS3Fetch(),
    })
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
  })

  it('lists files with pagination', async () => {
    let storage = createS3FileStorage({
      accessKeyId: 'test',
      secretAccessKey: 'test',
      bucket: BUCKET,
      endpoint: ENDPOINT,
      region: 'us-east-1',
      fetch: createMockS3Fetch(),
    })
    let allKeys = ['a', 'b', 'c', 'd', 'e']

    await Promise.all(
      allKeys.map((key) =>
        storage.set(key, new File([`Hello ${key}!`], `${key}.txt`, { type: 'text/plain' })),
      ),
    )

    let { cursor, files } = await storage.list()
    assert.equal(cursor, undefined)
    assert.equal(files.length, 5)
    assert.deepEqual(
      files.map((file) => file.key),
      allKeys,
    )

    let { cursor: cursor1, files: files1 } = await storage.list({ limit: 0 })
    assert.equal(cursor1, undefined)
    assert.equal(files1.length, 0)

    let { cursor: cursor2, files: files2 } = await storage.list({ limit: 2 })
    assert.notEqual(cursor2, undefined)
    assert.equal(files2.length, 2)

    let { cursor: cursor3, files: files3 } = await storage.list({ cursor: cursor2 })
    assert.equal(cursor3, undefined)
    assert.equal(files3.length, 3)
    assert.deepEqual(
      [...files2, ...files3].map((file) => file.key),
      allKeys,
    )
  })

  it('lists files by key prefix', async () => {
    let storage = createS3FileStorage({
      accessKeyId: 'test',
      secretAccessKey: 'test',
      bucket: BUCKET,
      endpoint: ENDPOINT,
      region: 'us-east-1',
      fetch: createMockS3Fetch(),
    })
    let allKeys = ['a', 'b', 'b/c', 'c', 'd']

    await Promise.all(
      allKeys.map((key) =>
        storage.set(key, new File([`Hello ${key}!`], `${key}.txt`, { type: 'text/plain' })),
      ),
    )

    let { cursor, files } = await storage.list({ prefix: 'b' })
    assert.equal(cursor, undefined)
    assert.equal(files.length, 2)
    assert.deepEqual(
      files.map((file) => file.key),
      ['b', 'b/c'],
    )
  })

  it('lists files with metadata', async () => {
    let storage = createS3FileStorage({
      accessKeyId: 'test',
      secretAccessKey: 'test',
      bucket: BUCKET,
      endpoint: ENDPOINT,
      region: 'us-east-1',
      fetch: createMockS3Fetch(),
    })
    let lastModified = Date.now()
    let file = new File(['Hello, world!'], 'hello.txt', {
      type: 'text/plain',
      lastModified,
    })

    await storage.set('hello', file)

    let { cursor, files } = await storage.list({ includeMetadata: true })

    assert.equal(cursor, undefined)
    assert.equal(files.length, 1)
    assert.equal(files[0].key, 'hello')
    assert.equal(files[0].name, 'hello.txt')
    assert.equal(files[0].type, 'text/plain')
    assert.equal(files[0].lastModified, lastModified)
    assert.equal(files[0].size, 13)
  })

  it('supports virtual-host style URLs', async () => {
    let storage = createS3FileStorage({
      accessKeyId: 'test',
      secretAccessKey: 'test',
      bucket: BUCKET,
      endpoint: ENDPOINT,
      region: 'us-east-1',
      forcePathStyle: false,
      fetch: createMockS3Fetch(),
    })

    await storage.set(
      'dir/hello.txt',
      new File(['Hello, world!'], 'hello.txt', { type: 'text/plain' }),
    )

    assert.ok(await storage.has('dir/hello.txt'))
    let retrieved = await storage.get('dir/hello.txt')
    assert.ok(retrieved)
    assert.equal(await retrieved.text(), 'Hello, world!')
  })
})

function createMockS3Fetch(): typeof globalThis.fetch {
  let buckets = new Set([BUCKET])
  let objects = new Map<string, StoredObject>()

  return async function fetch(input, init) {
    let request = new Request(input, init)
    let url = new URL(request.url)
    let method = request.method.toUpperCase()
    let { bucket, key } = parseBucketAndKey(url)

    if (bucket == null) {
      return createErrorResponse(400, 'InvalidBucketName', 'Could not determine bucket')
    }

    if (method === 'PUT' && key === '') {
      buckets.add(bucket)
      return new Response(null, { status: 200 })
    }

    if (!buckets.has(bucket)) {
      return createErrorResponse(404, 'NoSuchBucket', 'The specified bucket does not exist')
    }

    if (method === 'GET' && key === '' && url.searchParams.get('list-type') === '2') {
      return listObjects(url, bucket, objects)
    }

    if (key === '') {
      return createErrorResponse(405, 'MethodNotAllowed', 'Method not allowed for bucket')
    }

    let objectKey = `${bucket}:${key}`

    if (method === 'PUT') {
      let body = await request.arrayBuffer()
      let metadata: Record<string, string> = {}

      request.headers.forEach((value, header) => {
        if (header.startsWith('x-amz-meta-')) {
          metadata[header] = value
        }
      })

      objects.set(objectKey, {
        body,
        metadata,
        contentType: request.headers.get('content-type') ?? '',
        updatedAt: Date.now(),
      })

      return new Response(null, { status: 200 })
    }

    let object = objects.get(objectKey)

    if (object == null) {
      return createErrorResponse(404, 'NoSuchKey', 'The specified key does not exist')
    }

    if (method === 'GET') {
      return createObjectResponse(object, false)
    }

    if (method === 'HEAD') {
      return createObjectResponse(object, true)
    }

    if (method === 'DELETE') {
      objects.delete(objectKey)
      return new Response(null, { status: 204 })
    }

    return createErrorResponse(405, 'MethodNotAllowed', 'Unsupported method')
  }
}

function listObjects(url: URL, bucket: string, objects: Map<string, StoredObject>): Response {
  let prefix = url.searchParams.get('prefix') ?? ''
  let continuationToken = url.searchParams.get('continuation-token')
  let maxKeys = Number(url.searchParams.get('max-keys') ?? '1000')
  let safeMaxKeys = Number.isFinite(maxKeys) ? Math.max(0, maxKeys) : 1000
  let useUrlEncoding = url.searchParams.get('encoding-type') === 'url'

  let keys = Array.from(objects.keys())
    .filter((key) => key.startsWith(`${bucket}:`))
    .map((key) => key.slice(bucket.length + 1))
    .filter((key) => key.startsWith(prefix))
    .sort()

  let startIndex =
    continuationToken == null ? 0 : keys.findIndex((key) => key === continuationToken) + 1
  if (startIndex < 0) {
    startIndex = 0
  }

  let page = keys.slice(startIndex, startIndex + safeMaxKeys)
  let isTruncated = startIndex + safeMaxKeys < keys.length
  let nextContinuationToken = isTruncated ? page[page.length - 1] : undefined

  let contents = page
    .map((key) => {
      let object = objects.get(`${bucket}:${key}`)

      if (object == null) {
        return ''
      }

      let outputKey = useUrlEncoding ? encodeURIComponent(key) : key

      return [
        '<Contents>',
        `<Key>${escapeXml(outputKey)}</Key>`,
        `<LastModified>${new Date(object.updatedAt).toISOString()}</LastModified>`,
        `<Size>${object.body.byteLength}</Size>`,
        '</Contents>',
      ].join('')
    })
    .join('')

  let xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<ListBucketResult>',
    `<IsTruncated>${String(isTruncated)}</IsTruncated>`,
    nextContinuationToken == null
      ? ''
      : `<NextContinuationToken>${escapeXml(nextContinuationToken)}</NextContinuationToken>`,
    contents,
    '</ListBucketResult>',
  ].join('')

  return new Response(xml, {
    status: 200,
    headers: {
      'content-type': 'application/xml',
    },
  })
}

function createObjectResponse(object: StoredObject, headOnly: boolean): Response {
  let headers = new Headers({
    'content-type': object.contentType,
    'content-length': String(object.body.byteLength),
    'last-modified': new Date(object.updatedAt).toUTCString(),
  })

  for (let [header, value] of Object.entries(object.metadata)) {
    headers.set(header, value)
  }

  let body = headOnly ? null : object.body

  return new Response(body, {
    status: 200,
    headers,
  })
}

function parseBucketAndKey(url: URL): { bucket: string | undefined; key: string } {
  let hostStyleBucket = url.hostname.startsWith(`${BUCKET}.`) ? BUCKET : undefined
  let pathSegments = url.pathname
    .replace(/^\/+/, '')
    .split('/')
    .filter((segment) => segment !== '')

  if (hostStyleBucket != null) {
    return {
      bucket: hostStyleBucket,
      key: decodePathKey(pathSegments.join('/')),
    }
  }

  let bucket = pathSegments[0] != null ? decodeURIComponent(pathSegments[0]) : undefined
  let key = decodePathKey(pathSegments.slice(1).join('/'))

  return { bucket, key }
}

function decodePathKey(path: string): string {
  if (path === '') {
    return ''
  }

  return path
    .split('/')
    .map((segment) => decodeURIComponent(segment))
    .join('/')
}

function createErrorResponse(status: number, code: string, message: string): Response {
  let xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Error>',
    `<Code>${escapeXml(code)}</Code>`,
    `<Message>${escapeXml(message)}</Message>`,
    '</Error>',
  ].join('')

  return new Response(xml, {
    status,
    headers: {
      'content-type': 'application/xml',
    },
  })
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
