import { AwsClient } from 'aws4fetch'

import type { FileMetadata, FileStorage, ListOptions, ListResult } from '@remix-run/file-storage'

const CONTENTS_PATTERN = /<Contents>([\s\S]*?)<\/Contents>/g

type ListedObject = {
  key: string
  lastModified: number
  size: number
}

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
}

/**
 * Creates an S3-backed implementation of `FileStorage`.
 *
 * This works with AWS S3 and S3-compatible providers (for example MinIO or LocalStack) by
 * overriding the `endpoint` option.
 *
 * @param options Configuration for the S3 backend
 * @returns A `FileStorage` implementation backed by S3
 */
export function createS3FileStorage(options: S3FileStorageOptions): FileStorage {
  let endpoint = new URL(options.endpoint ?? `https://s3.${options.region}.amazonaws.com`)
  let forcePathStyle = options.forcePathStyle ?? options.endpoint != null

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

  async function putFile(key: string, file: File): Promise<File> {
    let body = await file.arrayBuffer()
    let headers = new Headers()

    if (file.type !== '') {
      headers.set('content-type', file.type)
    }

    headers.set('x-amz-meta-file-name', encodeMetadataValue(file.name))
    headers.set('x-amz-meta-file-last-modified', String(file.lastModified))

    let response = await s3Fetch(getObjectUrl(key), {
      method: 'PUT',
      headers,
      body,
    })
    await assertOk(response, `PUT "${key}"`)

    return new File([body], file.name, {
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
        parseEpochMillis(response.headers.get('x-amz-meta-file-last-modified')) ??
        object.lastModified,
      name:
        decodeMetadataValue(response.headers.get('x-amz-meta-file-name')) ??
        getDefaultFileName(object.key),
      size: parseInteger(response.headers.get('content-length')) ?? object.size,
      type: response.headers.get('content-type') ?? '',
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
        decodeMetadataValue(response.headers.get('x-amz-meta-file-name')) ?? getDefaultFileName(key),
        {
          lastModified:
            parseEpochMillis(response.headers.get('x-amz-meta-file-last-modified')) ??
            parseHttpDate(response.headers.get('last-modified')) ??
            0,
          type: response.headers.get('content-type') ?? '',
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
    put(key: string, file: File): Promise<File> {
      return putFile(key, file)
    },
    async remove(key: string): Promise<void> {
      let response = await s3Fetch(getObjectUrl(key), { method: 'DELETE' })

      if (response.status === 404) {
        return
      }

      await assertOk(response, `DELETE "${key}"`)
    },
    async set(key: string, file: File): Promise<void> {
      await putFile(key, file)
    },
  }
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
  return key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
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
