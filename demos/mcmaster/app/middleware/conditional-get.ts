import { CacheControl, IfNoneMatch } from 'remix/headers'
import type { Middleware } from 'remix/router'

import { speedSettingsContext } from './speed-settings.ts'

// Every page is a function of the catalog, the deployed code, the URL, the requested frame, and the
// visitor's cookies (cart and speed settings). The catalog and code only change when the server
// restarts, so one ID per process stands in for a catalog version or deploy SHA.
const deploymentId = crypto.randomUUID()

/**
 * Answers repeat requests for unchanged HTML with an empty `304 Not Modified` before any data is
 * loaded or rendered.
 *
 * The ETag identifies a page's inputs rather than hashing its body. Rendered HTML contains
 * per-render hydration IDs, so identical pages never hash the same, and computing an ETag up
 * front means a match skips the work entirely and successful responses still stream.
 */
export function conditionalGet(): Middleware {
  return async (context, next) => {
    let { headers, request } = context

    if (!context.get(speedSettingsContext)?.techniques) return next()
    if (request.method !== 'GET' && request.method !== 'HEAD') return next()
    if (!headers.get('Accept')?.includes('text/html')) return next()

    let etag = await createEtag([
      deploymentId,
      request.url,
      headers.get('X-Remix-Target') ?? '',
      headers.get('Cookie') ?? '',
    ])

    if (IfNoneMatch.from(headers.get('If-None-Match')).matches(etag)) {
      return new Response(null, { status: 304, headers: { ETag: etag } })
    }

    let response = await next()
    if (!isRevalidatableHtml(response)) return response

    let responseHeaders = new Headers(response.headers)
    responseHeaders.set('ETag', etag)

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  }
}

function isRevalidatableHtml(response: Response): boolean {
  if (response.status !== 200 || response.headers.has('ETag')) return false
  if (!response.headers.get('Content-Type')?.startsWith('text/html')) return false

  return !CacheControl.from(response.headers.get('Cache-Control')).noStore
}

async function createEtag(parts: string[]): Promise<string> {
  let data = new TextEncoder().encode(parts.join('\n'))
  let digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data))
  let hash = Array.from(digest.subarray(0, 12), (byte) => byte.toString(16).padStart(2, '0'))
  return `W/"${hash.join('')}"`
}
