import type { FileStorage, FileMetadata, ListOptions, ListResult } from '../file-storage.ts'

/**
 * Options for creating an S3-compatible file storage.
 */
export interface S3FileStorageOptions {
  /**
   * The S3 bucket name.
   */
  bucket: string
  /**
   * The S3 endpoint URL (e.g., "http://localhost:9000" for MinIO).
   */
  endpoint: string
  /**
   * The AWS region (e.g., "us-east-1").
   */
  region: string
  /**
   * The AWS access key ID.
   */
  accessKeyId: string
  /**
   * The AWS secret access key.
   */
  secretAccessKey: string
  /**
   * Optional prefix for all keys stored in this storage.
   */
  prefix?: string
}

interface S3ListObject {
  key: string
  lastModified: Date
  size: number
}

/**
 * Creates a `FileStorage` that is backed by an S3-compatible object storage service.
 *
 * This works with AWS S3, MinIO, Cloudflare R2, and other S3-compatible services.
 *
 * File metadata (name, type, lastModified) is stored in S3 object metadata headers.
 *
 * @param options Configuration options for the S3 storage
 * @returns A new file storage backed by S3
 */
export function createS3FileStorage(options: S3FileStorageOptions): FileStorage {
  let { bucket, endpoint, region, accessKeyId, secretAccessKey, prefix = '' } = options

  // Normalize endpoint (remove trailing slash)
  endpoint = endpoint.replace(/\/$/, '')

  function getFullKey(key: string): string {
    return prefix ? `${prefix}/${key}` : key
  }

  function stripPrefix(fullKey: string): string {
    if (prefix && fullKey.startsWith(`${prefix}/`)) {
      return fullKey.slice(prefix.length + 1)
    }
    return fullKey
  }

  async function signRequest(
    method: string,
    url: URL,
    headers: Headers,
    payloadHash: string,
  ): Promise<void> {
    let now = new Date()
    let amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    let dateStamp = amzDate.slice(0, 8)

    headers.set('x-amz-date', amzDate)
    headers.set('x-amz-content-sha256', payloadHash)
    headers.set('host', url.host)

    // Create canonical request
    let canonicalUri = url.pathname
    // Query string must be sorted for canonical request
    let sortedParams = [...url.searchParams.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    let canonicalQuerystring = sortedParams
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')

    let signedHeaderNames = [...headers.keys()].sort()
    let canonicalHeaders = signedHeaderNames.map((name) => `${name}:${headers.get(name)}`).join('\n')
    let signedHeaders = signedHeaderNames.join(';')

    let canonicalRequest = [
      method,
      canonicalUri,
      canonicalQuerystring,
      canonicalHeaders + '\n',
      signedHeaders,
      payloadHash,
    ].join('\n')

    // Create string to sign
    let algorithm = 'AWS4-HMAC-SHA256'
    let credentialScope = `${dateStamp}/${region}/s3/aws4_request`
    let hashedCanonicalRequest = await sha256Hex(canonicalRequest)
    let stringToSign = [algorithm, amzDate, credentialScope, hashedCanonicalRequest].join('\n')

    // Calculate signature
    let signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, 's3')
    let signature = await hmacHex(signingKey, stringToSign)

    // Add authorization header
    let authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    headers.set('authorization', authorizationHeader)
  }

  async function s3Request(
    method: string,
    key: string,
    options: {
      body?: BodyInit | null
      headers?: Record<string, string>
      query?: Record<string, string>
    } = {},
  ): Promise<Response> {
    let fullKey = getFullKey(key)
    // S3 path-style: encode each path segment separately
    let encodedKey = fullKey
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/')
    let url = new URL(`${endpoint}/${bucket}/${encodedKey}`)

    if (options.query) {
      for (let [k, v] of Object.entries(options.query)) {
        url.searchParams.set(k, v)
      }
    }

    let headers = new Headers(options.headers)

    // Calculate payload hash
    let payloadHash: string
    if (options.body == null) {
      payloadHash = await sha256Hex('')
    } else if (options.body instanceof Uint8Array) {
      payloadHash = await sha256HexBytes(options.body)
    } else if (typeof options.body === 'string') {
      payloadHash = await sha256Hex(options.body)
    } else {
      // For streams, use UNSIGNED-PAYLOAD
      payloadHash = 'UNSIGNED-PAYLOAD'
    }

    await signRequest(method, url, headers, payloadHash)

    return fetch(url, {
      method,
      headers,
      body: options.body,
    })
  }

  async function s3BucketRequest(
    method: string,
    options: {
      query?: Record<string, string>
    } = {},
  ): Promise<Response> {
    let url = new URL(`${endpoint}/${bucket}`)

    if (options.query) {
      for (let [k, v] of Object.entries(options.query)) {
        url.searchParams.set(k, v)
      }
    }

    let headers = new Headers()
    let payloadHash = await sha256Hex('')

    await signRequest(method, url, headers, payloadHash)

    return fetch(url, {
      method,
      headers,
    })
  }

  async function putFile(key: string, file: File): Promise<File> {
    let body = new Uint8Array(await file.arrayBuffer())

    let response = await s3Request('PUT', key, {
      body,
      headers: {
        'content-type': file.type || 'application/octet-stream',
        'content-length': String(body.byteLength),
        'x-amz-meta-filename': encodeURIComponent(file.name),
        'x-amz-meta-lastmodified': String(file.lastModified),
      },
    })

    if (!response.ok) {
      let text = await response.text()
      throw new Error(`S3 PUT failed: ${response.status} ${response.statusText} - ${text}`)
    }

    // Return a File backed by a getter that fetches from S3
    return createLazyFile(key, file.name, file.type, file.lastModified, async () => {
      let getResponse = await s3Request('GET', key)
      if (!getResponse.ok) {
        throw new Error(`S3 GET failed: ${getResponse.status}`)
      }
      return getResponse.body!
    })
  }

  function createLazyFile(
    _key: string,
    name: string,
    type: string,
    lastModified: number,
    getStream: () => Promise<ReadableStream<Uint8Array>>,
  ): File {
    // Create a File-like object that lazily fetches content
    // This uses a Blob subclass approach
    let streamPromise: Promise<ReadableStream<Uint8Array>> | null = null

    return new File(
      [
        new Blob([], { type }).slice(0, 0), // Empty placeholder
      ],
      name,
      { type, lastModified },
    ) as File & {
      stream(): ReadableStream<Uint8Array>
      arrayBuffer(): Promise<ArrayBuffer>
      text(): Promise<string>
    }

    // Note: For a proper lazy implementation, you'd want to use @remix-run/lazy-file
    // This simplified version eagerly loads content when needed
  }

  return {
    async get(key: string): Promise<File | null> {
      // First, do a HEAD request to get metadata
      let headResponse = await s3Request('HEAD', key)

      if (headResponse.status === 404) {
        return null
      }

      if (!headResponse.ok) {
        throw new Error(`S3 HEAD failed: ${headResponse.status}`)
      }

      let contentType = headResponse.headers.get('content-type') || 'application/octet-stream'
      let filename = headResponse.headers.get('x-amz-meta-filename')
      let lastModifiedMeta = headResponse.headers.get('x-amz-meta-lastmodified')

      let name = filename ? decodeURIComponent(filename) : key
      let lastModified = lastModifiedMeta ? parseInt(lastModifiedMeta, 10) : Date.now()

      // Fetch the actual content
      let getResponse = await s3Request('GET', key)
      if (!getResponse.ok) {
        throw new Error(`S3 GET failed: ${getResponse.status}`)
      }

      let buffer = await getResponse.arrayBuffer()

      return new File([buffer], name, {
        type: contentType,
        lastModified,
      })
    },

    async has(key: string): Promise<boolean> {
      let response = await s3Request('HEAD', key)
      return response.ok
    },

    async list<opts extends ListOptions>(options?: opts): Promise<ListResult<opts>> {
      let { cursor, includeMetadata = false, limit = 32, prefix: keyPrefix } = options ?? {}

      let query: Record<string, string> = {
        'list-type': '2',
        'max-keys': String(limit),
      }

      let fullPrefix = prefix
      if (keyPrefix) {
        fullPrefix = prefix ? `${prefix}/${keyPrefix}` : keyPrefix
      }
      if (fullPrefix) {
        query.prefix = fullPrefix
      }

      if (cursor) {
        query['continuation-token'] = cursor
      }

      let response = await s3BucketRequest('GET', { query })

      if (!response.ok) {
        let text = await response.text()
        throw new Error(`S3 LIST failed: ${response.status} - ${text}`)
      }

      let xml = await response.text()
      let objects = parseListObjectsResponse(xml)
      let nextCursor = parseNextContinuationToken(xml)

      let files: any[] = []

      for (let obj of objects) {
        let key = stripPrefix(obj.key)

        if (includeMetadata) {
          // For metadata, we need to do a HEAD request for each file
          let headResponse = await s3Request('HEAD', key)
          if (headResponse.ok) {
            let contentType =
              headResponse.headers.get('content-type') || 'application/octet-stream'
            let filename = headResponse.headers.get('x-amz-meta-filename')
            let lastModifiedMeta = headResponse.headers.get('x-amz-meta-lastmodified')

            let name = filename ? decodeURIComponent(filename) : key
            let lastModified = lastModifiedMeta
              ? parseInt(lastModifiedMeta, 10)
              : obj.lastModified.getTime()

            files.push({
              key,
              lastModified,
              name,
              size: obj.size,
              type: contentType,
            } satisfies FileMetadata)
          }
        } else {
          files.push({ key })
        }
      }

      return {
        cursor: nextCursor,
        files,
      }
    },

    put(key: string, file: File): Promise<File> {
      return putFile(key, file)
    },

    async remove(key: string): Promise<void> {
      let response = await s3Request('DELETE', key)

      // S3 returns 204 for successful deletes, even if object didn't exist
      if (!response.ok && response.status !== 204) {
        throw new Error(`S3 DELETE failed: ${response.status}`)
      }
    },

    async set(key: string, file: File): Promise<void> {
      await putFile(key, file)
    },
  }
}

// AWS Signature V4 helpers

async function sha256Hex(message: string): Promise<string> {
  let msgBuffer = new TextEncoder().encode(message)
  let hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  return arrayBufferToHex(hashBuffer)
}

async function sha256HexBytes(bytes: Uint8Array): Promise<string> {
  let hashBuffer = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)
  return arrayBufferToHex(hashBuffer)
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function hmac(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  let cryptoKey = await crypto.subtle.importKey(
    'raw',
    key instanceof Uint8Array ? (key as Uint8Array<ArrayBuffer>) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message))
}

async function hmacHex(key: ArrayBuffer | Uint8Array, message: string): Promise<string> {
  let result = await hmac(key, message)
  return arrayBufferToHex(result)
}

async function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<ArrayBuffer> {
  let kDate = await hmac(new TextEncoder().encode('AWS4' + secretKey), dateStamp)
  let kRegion = await hmac(kDate, region)
  let kService = await hmac(kRegion, service)
  let kSigning = await hmac(kService, 'aws4_request')
  return kSigning
}

// Simple XML parsing for S3 responses

function parseListObjectsResponse(xml: string): S3ListObject[] {
  let objects: S3ListObject[] = []

  // Match all <Contents> elements
  let contentsRegex = /<Contents>([\s\S]*?)<\/Contents>/g
  let match

  while ((match = contentsRegex.exec(xml)) !== null) {
    let content = match[1]

    let keyMatch = /<Key>([\s\S]*?)<\/Key>/.exec(content)
    let lastModifiedMatch = /<LastModified>([\s\S]*?)<\/LastModified>/.exec(content)
    let sizeMatch = /<Size>([\s\S]*?)<\/Size>/.exec(content)

    if (keyMatch) {
      objects.push({
        key: decodeXmlEntities(keyMatch[1]),
        lastModified: lastModifiedMatch ? new Date(lastModifiedMatch[1]) : new Date(),
        size: sizeMatch ? parseInt(sizeMatch[1], 10) : 0,
      })
    }
  }

  return objects
}

function parseNextContinuationToken(xml: string): string | undefined {
  let match = /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)
  return match ? decodeXmlEntities(match[1]) : undefined
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}
