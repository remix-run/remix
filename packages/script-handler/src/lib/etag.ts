import { IfNoneMatch } from '@remix-run/headers'

export function generateETag(hash: string): string {
  return `W/"${hash}"`
}

export function matchesETag(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false
  let header = IfNoneMatch.from(ifNoneMatch)
  if (header.matches(etag)) return true
  let weakEtag = etag.startsWith('W/') ? etag : `W/${etag}`
  let strongEtag = etag.replace(/^W\//, '')
  return header.matches(weakEtag) || header.matches(strongEtag)
}
