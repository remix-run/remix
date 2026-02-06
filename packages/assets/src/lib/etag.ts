export async function hashCode(code: string): Promise<string> {
  let encoder = new TextEncoder()
  let data = encoder.encode(code)
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

  // Handle multiple ETags in If-None-Match (comma-separated)
  let tags = ifNoneMatch.split(',').map((t) => t.trim())

  // Check for wildcard
  if (tags.includes('*')) return true

  // Check for exact match (with or without weak prefix)
  for (let tag of tags) {
    // Normalize: remove W/ prefix for comparison
    let normalizedTag = tag.replace(/^W\//, '')
    let normalizedETag = etag.replace(/^W\//, '')
    if (normalizedTag === normalizedETag) return true
  }

  return false
}
