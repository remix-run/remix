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

// `GITHUB_SHA` guarantees deploy invalidation; commas are avoided because
// `If-None-Match` uses them to separate multiple tags.
export function docsEtag(label: string, mtimes: Iterable<number | undefined>): string {
  let deploy = process.env.GITHUB_SHA ?? ''
  return `W/"${deploy}:${label}:${Array.from(mtimes)
    .filter((mtime) => mtime !== undefined)
    .join('-')}"`
}
