import { AwsClient } from 'aws4fetch'

import type {
  FileLike,
  FileMetadata,
  FileStorage,
  ListOptions,
  ListResult,
} from '@remix-run/file-storage'

const CONTENTS_PATTERN = /<Contents>([\s\S]*?)<\/Contents>/g

const minPartSize = 5 * 1024 * 1024
const defaultPartSize = 8 * 1024 * 1024

type ListedObject = {
  key: string
  lastModified: number
  size: number
}

/**
 * Configuration for an S3-backed `FileStorage` implementation.
 */
export interface S3FileStorageOptions {
  /**
   * AWS access key ID used to sign S3 requests.
   */
  accessKeyId: string
  /**
   * AWS secret access key used to sign S3 requests.
   */
  secretAccessKey: string
  /**
   * Bucket name used for all file storage operations.
   */
  bucket: string
  /**
   * AWS region for request signing.
   */
  region: string
  /**
   * Custom S3-compatible endpoint URL. Defaults to AWS S3 for the given region.
   */
  endpoint?: string
  /**
   * Whether to use path-style bucket URLs (`/bucket/key`). Defaults to `true` when `endpoint` is
   * provided and `false` otherwise.
   */
  forcePathStyle?: boolean
  /**
   * Optional session token for temporary credentials.
   */
  sessionToken?: string
  /**
   * Optional fetch implementation.
   */
  fetch?: typeof globalThis.fetch
  /**
   * Size in bytes of each part when a file is larger than one part and is sent with a multipart
   * upload. At most two parts are held in memory per upload. Must be at least 5 MiB, the S3
   * minimum. Defaults to 8 MiB.
   */
  partSize?: number
}

/**
 * Creates an S3-backed implementation of `FileStorage`.
 *
 * This works with AWS S3 and S3-compatible providers (for example MinIO or LocalStack) by
 * overriding the `endpoint` option.
 *
 * `set()` streams files to S3. Files larger than `partSize` are sent with a multipart upload, so
 * only about two parts are held in memory at a time. `put()` uses the same upload path but keeps the
 * whole file in memory, because it returns a `File` with the stored contents.
 *
 * @param options Configuration for the S3 backend
 * @returns A `FileStorage` implementation backed by S3
 */
export function createS3FileStorage(options: S3FileStorageOptions): FileStorage<File> {
  let endpoint = new URL(options.endpoint ?? `https://s3.${options.region}.amazonaws.com`)
  let forcePathStyle = options.forcePathStyle ?? options.endpoint != null
  let partSize = options.partSize ?? defaultPartSize
  if (!Number.isInteger(partSize) || partSize < minPartSize) {
    throw new RangeError(`partSize must be an integer of at least ${minPartSize} bytes`)
  }

  let aws = new AwsClient({
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
    sessionToken: options.sessionToken,
    service: 's3',
    region: options.region,
  })

  async function s3Fetch(url: URL, init?: RequestInit): Promise<Response> {
    let request = await aws.sign(url, init)

    if (options.fetch != null) {
      return options.fetch(request)
    }

    return fetch(request)
  }

  function getBucketUrl(): URL {
    return createBucketUrl(endpoint, options.bucket, forcePathStyle)
  }

  function getObjectUrl(key: string): URL {
    return createObjectUrl(endpoint, options.bucket, forcePathStyle, key)
  }

  // Streams the file to S3 and resolves with its parts when `keepChunks` is true. Files that fit in
  // one part are sent with a single `PUT`. Larger files use a multipart upload, which holds at most
  // two parts in memory.
  async function uploadFile(
    key: string,
    file: FileLike,
    keepChunks: boolean,
  ): Promise<Uint8Array<ArrayBuffer>[]> {
    let headers = new Headers()

    if (file.type !== '') {
      headers.set('Content-Type', file.type)
    }

    headers.set('X-Amz-Meta-File-Name', encodeMetadataValue(file.name))
    headers.set('X-Amz-Meta-File-Last-Modified', String(file.lastModified))

    let kept: Uint8Array<ArrayBuffer>[] = []
    // Streaming uploads, like `FileUpload` from `@remix-run/form-data-parser/future`, have the shape
    // of a `File` without being a `Blob`, so they can only be read with `stream()`.
    let source: Pick<File, 'stream'> = file
    let parts =
      file instanceof Blob ? sliceParts(file, partSize) : readParts(source.stream(), partSize)
    let first = await parts.next()
    let firstPart = first.done ? new Uint8Array(0) : first.value
    if (keepChunks) kept.push(firstPart)

    let second = first.done ? first : await parts.next()
    if (second.done) {
      let response = await s3Fetch(getObjectUrl(key), { method: 'PUT', headers, body: firstPart })
      await assertOk(response, `PUT "${key}"`)
      return kept
    }

    let uploadId: string
    try {
      uploadId = await createMultipartUpload(key, headers)
    } catch (error) {
      await parts.return()
      throw error
    }

    let etags: string[] = []
    let pending: Promise<string> | undefined

    try {
      let partNumber = 0
      let part = firstPart
      let lookahead: IteratorResult<Uint8Array<ArrayBuffer>, void> | undefined = second

      // Start uploading each part, wait for the previous part to finish, then read the next one, so
      // at most two parts are in memory at a time.
      while (true) {
        let upload = uploadPart(key, uploadId, ++partNumber, part)
        // Awaited later; this keeps a failure from being reported as unhandled in the meantime
        upload.catch(() => {})
        if (pending) etags.push(await pending)
        pending = upload

        let next = lookahead ?? (await parts.next())
        lookahead = undefined
        if (next.done) break

        part = next.value
        if (keepChunks) kept.push(part)
      }

      etags.push(await pending)
      pending = undefined

      await completeMultipartUpload(key, uploadId, etags)
    } catch (error) {
      await pending?.catch(() => {})
      await parts.return()
      await abortMultipartUpload(key, uploadId)
      throw error
    }

    return kept
  }

  async function createMultipartUpload(key: string, headers: Headers): Promise<string> {
    let url = getObjectUrl(key)
    url.searchParams.set('uploads', '')

    let response = await s3Fetch(url, { method: 'POST', headers })
    await assertOk(response, `CreateMultipartUpload "${key}"`)

    let uploadId = readXmlTag(await response.text(), 'UploadId')
    if (uploadId == null || uploadId === '') {
      throw new Error(`S3 request failed for CreateMultipartUpload "${key}": missing UploadId`)
    }

    return uploadId
  }

  async function uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: Uint8Array<ArrayBuffer>,
  ): Promise<string> {
    let url = getObjectUrl(key)
    url.searchParams.set('partNumber', String(partNumber))
    url.searchParams.set('uploadId', uploadId)

    let response = await s3Fetch(url, { method: 'PUT', body })
    await assertOk(response, `UploadPart ${partNumber} "${key}"`)

    let etag = response.headers.get('ETag')
    if (etag == null) {
      throw new Error(`S3 request failed for UploadPart ${partNumber} "${key}": missing ETag`)
    }

    return etag
  }

  async function completeMultipartUpload(
    key: string,
    uploadId: string,
    etags: string[],
  ): Promise<void> {
    let url = getObjectUrl(key)
    url.searchParams.set('uploadId', uploadId)

    let body = [
      '<CompleteMultipartUpload>',
      ...etags.map(
        (etag, index) =>
          `<Part><PartNumber>${index + 1}</PartNumber><ETag>${escapeXml(etag)}</ETag></Part>`,
      ),
      '</CompleteMultipartUpload>',
    ].join('')

    let response = await s3Fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body,
    })
    await assertOk(response, `CompleteMultipartUpload "${key}"`)

    // S3 can report a failed completion with a 200 response and an error document.
    let xml = await response.text()
    if (xml.includes('<Error>')) {
      let message = readXmlTag(xml, 'Message') ?? readXmlTag(xml, 'Code') ?? 'unknown error'
      throw new Error(`S3 request failed for CompleteMultipartUpload "${key}": ${message}`)
    }
  }

  async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    let url = getObjectUrl(key)
    url.searchParams.set('uploadId', uploadId)

    try {
      await s3Fetch(url, { method: 'DELETE' })
    } catch {
      // Keep the original error. Incomplete uploads can also be cleaned up by a bucket lifecycle rule.
    }
  }

  async function putFile(key: string, file: FileLike): Promise<File> {
    let chunks = await uploadFile(key, file, true)

    return new File(chunks, file.name, {
      lastModified: file.lastModified,
      type: file.type,
    })
  }

  async function getFileMetadata(object: ListedObject): Promise<FileMetadata> {
    let response = await s3Fetch(getObjectUrl(object.key), { method: 'HEAD' })

    if (response.status === 404) {
      return {
        key: object.key,
        lastModified: object.lastModified,
        name: getDefaultFileName(object.key),
        size: object.size,
        type: '',
      }
    }

    await assertOk(response, `HEAD "${object.key}"`)

    return {
      key: object.key,
      lastModified:
        parseEpochMillis(response.headers.get('X-Amz-Meta-File-Last-Modified')) ??
        object.lastModified,
      name:
        decodeMetadataValue(response.headers.get('X-Amz-Meta-File-Name')) ??
        getDefaultFileName(object.key),
      size: parseInteger(response.headers.get('Content-Length')) ?? object.size,
      type: response.headers.get('Content-Type') ?? '',
    }
  }

  return {
    async get(key: string): Promise<File | null> {
      let response = await s3Fetch(getObjectUrl(key), { method: 'GET' })

      if (response.status === 404) {
        return null
      }

      await assertOk(response, `GET "${key}"`)

      let body = await response.arrayBuffer()

      return new File(
        [body],
        decodeMetadataValue(response.headers.get('X-Amz-Meta-File-Name')) ??
          getDefaultFileName(key),
        {
          lastModified:
            parseEpochMillis(response.headers.get('X-Amz-Meta-File-Last-Modified')) ??
            parseHttpDate(response.headers.get('Last-Modified')) ??
            0,
          type: response.headers.get('Content-Type') ?? '',
        },
      )
    },
    async has(key: string): Promise<boolean> {
      let response = await s3Fetch(getObjectUrl(key), { method: 'HEAD' })

      if (response.status === 404) {
        return false
      }

      await assertOk(response, `HEAD "${key}"`)

      return true
    },
    async list<opts extends ListOptions>(options?: opts): Promise<ListResult<opts>> {
      let { cursor, includeMetadata = false, limit = 32, prefix } = options ?? {}

      if (limit <= 0) {
        return {
          files: [] as ListResult<opts>['files'],
        }
      }

      let url = getBucketUrl()
      url.searchParams.set('encoding-type', 'url')
      url.searchParams.set('list-type', '2')
      url.searchParams.set('max-keys', String(limit))

      if (cursor !== undefined) {
        url.searchParams.set('continuation-token', cursor)
      }
      if (prefix !== undefined) {
        url.searchParams.set('prefix', prefix)
      }

      let response = await s3Fetch(url, { method: 'GET' })
      await assertOk(response, 'LIST')

      let xml = await response.text()
      let objects = parseListedObjects(xml)
      let nextCursor = parseNextCursor(xml)

      if (!includeMetadata) {
        return {
          cursor: nextCursor,
          files: objects.map((object) => ({ key: object.key })) as ListResult<opts>['files'],
        }
      }

      let files = await Promise.all(objects.map((object) => getFileMetadata(object)))

      return {
        cursor: nextCursor,
        files: files as ListResult<opts>['files'],
      }
    },
    put(key: string, file: FileLike): Promise<File> {
      return putFile(key, file)
    },
    async remove(key: string): Promise<void> {
      let response = await s3Fetch(getObjectUrl(key), { method: 'DELETE' })

      if (response.status === 404) {
        return
      }

      await assertOk(response, `DELETE "${key}"`)
    },
    async set(key: string, file: FileLike): Promise<void> {
      await uploadFile(key, file, false)
    },
  }
}

// Reads a `Blob` in parts with `slice()`. Node.js before 24.20.0 and 26.6.0 keeps every chunk read
// through `Blob#stream()` in memory for the life of the process
// (https://github.com/nodejs/node/issues/63574), which would leak every file stored this way.
async function* sliceParts(
  blob: Blob,
  partSize: number,
): AsyncGenerator<Uint8Array<ArrayBuffer>, void, undefined> {
  for (let offset = 0; offset < blob.size; offset += partSize) {
    yield new Uint8Array(await blob.slice(offset, offset + partSize).arrayBuffer())
  }
}

// Splits a stream into parts of exactly `partSize` bytes, except the last one. Some S3-compatible
// providers, like Cloudflare R2, require every part but the last to be the same size.
async function* readParts(
  stream: ReadableStream<Uint8Array>,
  partSize: number,
): AsyncGenerator<Uint8Array<ArrayBuffer>, void, undefined> {
  let reader = stream.getReader()
  let part = new Uint8Array(partSize)
  let offset = 0
  let done = false

  try {
    while (true) {
      let result = await reader.read()
      if (result.done) {
        done = true
        break
      }

      let chunk = result.value
      while (chunk.length > 0) {
        let length = Math.min(chunk.length, partSize - offset)
        part.set(chunk.subarray(0, length), offset)
        offset += length
        chunk = chunk.subarray(length)

        if (offset === partSize) {
          yield part
          part = new Uint8Array(partSize)
          offset = 0
        }
      }
    }

    if (offset > 0) yield part.subarray(0, offset)
  } finally {
    // Cancel the source when the upload stops early, so it can discard the rest of its content
    if (!done) await reader.cancel().catch(() => {})
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function createBucketUrl(endpoint: URL, bucket: string, forcePathStyle: boolean): URL {
  let url = new URL(endpoint.toString())

  if (forcePathStyle) {
    url.pathname = joinPath(endpoint.pathname, encodeURIComponent(bucket))
  } else {
    url.hostname = `${bucket}.${endpoint.hostname}`
    url.pathname = joinPath(endpoint.pathname)
  }

  return url
}

function createObjectUrl(endpoint: URL, bucket: string, forcePathStyle: boolean, key: string): URL {
  let url = new URL(endpoint.toString())

  if (forcePathStyle) {
    url.pathname = joinPath(endpoint.pathname, encodeURIComponent(bucket), encodeS3Key(key))
  } else {
    url.hostname = `${bucket}.${endpoint.hostname}`
    url.pathname = joinPath(endpoint.pathname, encodeS3Key(key))
  }

  return url
}

function encodeS3Key(key: string): string {
  if (key === '') {
    throw new TypeError('Invalid S3 object key: keys must not be empty')
  }

  return key
    .split('/')
    .map((segment) => {
      if (segment === '.' || segment === '..') {
        throw new TypeError('Invalid S3 object key: period-only path segments are not supported')
      }

      return encodeURIComponent(segment)
    })
    .join('/')
}

function encodeMetadataValue(value: string): string {
  return encodeURIComponent(value)
}

function decodeMetadataValue(value: string | null): string | undefined {
  if (value == null || value === '') {
    return undefined
  }

  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function getDefaultFileName(key: string): string {
  let lastSlashIndex = key.lastIndexOf('/')
  let fileName = lastSlashIndex >= 0 ? key.slice(lastSlashIndex + 1) : key
  return fileName === '' ? key : fileName
}

function parseListedObjects(xml: string): ListedObject[] {
  CONTENTS_PATTERN.lastIndex = 0

  let objects: ListedObject[] = []

  for (let match of xml.matchAll(CONTENTS_PATTERN)) {
    let entry = match[1] ?? ''
    let encodedKey = readXmlTag(entry, 'Key')

    if (encodedKey == null) {
      continue
    }

    let key = decodeS3Key(encodedKey)
    let size = parseInteger(readXmlTag(entry, 'Size')) ?? 0
    let lastModified = parseHttpDate(readXmlTag(entry, 'LastModified')) ?? 0

    objects.push({
      key,
      lastModified,
      size,
    })
  }

  return objects
}

function parseNextCursor(xml: string): string | undefined {
  if (readXmlTag(xml, 'IsTruncated') !== 'true') {
    return undefined
  }

  return readXmlTag(xml, 'NextContinuationToken')
}

function decodeS3Key(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function readXmlTag(xml: string, tagName: string): string | undefined {
  let pattern = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`)
  let match = xml.match(pattern)

  if (match == null || match[1] == null) {
    return undefined
  }

  return decodeXmlEntities(match[1])
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
}

function parseInteger(value: string | null | undefined): number | undefined {
  if (value == null || value === '') {
    return undefined
  }

  let parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseEpochMillis(value: string | null): number | undefined {
  let parsed = parseInteger(value)
  return parsed != null ? parsed : undefined
}

function parseHttpDate(value: string | null | undefined): number | undefined {
  if (value == null || value === '') {
    return undefined
  }

  let parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : undefined
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

async function assertOk(response: Response, operation: string): Promise<void> {
  if (response.ok) {
    return
  }

  let message = `${response.status} ${response.statusText}`

  try {
    let body = await response.text()
    let s3Message = readXmlTag(body, 'Message')

    if (s3Message != null && s3Message !== '') {
      message = `${message} (${s3Message})`
    }
  } catch {
    // Ignore body parse errors and keep the status-only message.
  }

  throw new Error(`S3 request failed for ${operation}: ${message}`)
}
