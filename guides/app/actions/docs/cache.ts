import { createHash } from 'node:crypto'

import { IfNoneMatch } from 'remix/headers/if-none-match'

const docsCacheControl = 'public, max-age=300, stale-while-revalidate=86400'

export function docsResponseInit(etag: string): ResponseInit {
  return {
    headers: {
      'Cache-Control': docsCacheControl,
      ETag: etag,
    },
  }
}

export function notModifiedDocsResponse(request: Request, etag: string): Response | undefined {
  if (IfNoneMatch.from(request.headers.get('If-None-Match')).matches(etag)) {
    return new Response(null, {
      status: 304,
      headers: { 'Cache-Control': docsCacheControl, ETag: etag },
    })
  }

  return undefined
}

// `GITHUB_SHA` guarantees deploy invalidation. Hashing keeps arbitrary cache
// inputs out of the header and avoids commas, which separate `If-None-Match` tags.
export function docsEtag(label: string, inputs: Iterable<string | number | undefined>): string {
  let hash = createHash('sha256')

  for (let input of inputs) {
    if (input === undefined) continue
    let value = String(input)
    hash.update(`${typeof input}:${value.length}:`)
    hash.update(value)
  }

  let deploy = process.env.GITHUB_SHA ?? ''
  return `W/"${deploy}:${label}:${hash.digest('base64url')}"`
}
