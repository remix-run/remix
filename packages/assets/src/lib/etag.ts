import { IfNoneMatch } from '@remix-run/headers'

export async function hashCode(code: string, pathSalt?: string): Promise<string> {
  let input = pathSalt !== undefined ? pathSalt + '\0' + code : code
  let encoder = new TextEncoder()
  let data = encoder.encode(input)
  let hashBuffer = await crypto.subtle.digest('SHA-256', data)
  let hashArray = Array.from(new Uint8Array(hashBuffer))
  // Convert to base36 for shorter ETag
  return hashArray
    .map((b) => b.toString(36))
    .join('')
    .slice(0, 16) // Use first 16 chars for reasonable collision resistance
}

export function generateETag(hash: string): string {
  return `W/"${hash}"`
}

// Check if request's If-None-Match header matches ETag (exported for testing)
export function matchesETag(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false

  let ifNoneMatchHeader = IfNoneMatch.from(ifNoneMatch)
  if (ifNoneMatchHeader.matches(etag)) return true

  let weakEtag = etag.startsWith('W/') ? etag : `W/${etag}`
  let strongEtag = etag.replace(/^W\//, '')
  return ifNoneMatchHeader.matches(weakEtag) || ifNoneMatchHeader.matches(strongEtag)
}
