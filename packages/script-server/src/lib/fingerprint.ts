const fingerprintSuffixRE = /\.@([A-Za-z0-9_-]+)$/

export async function hashContent(content: string): Promise<string> {
  let encoder = new TextEncoder()
  let data = encoder.encode(content)
  let hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Buffer.from(hashBuffer).toString('base64url').slice(0, 6)
}

export async function generateFingerprint(options: {
  buildId: string
  content: string
}): Promise<string> {
  return hashContent(JSON.stringify([options.content, options.buildId]))
}

export function parseFingerprintSuffix(pathname: string): {
  pathname: string
  requestedFingerprint: string | null
} {
  let fingerprintMatch = pathname.match(fingerprintSuffixRE)
  let requestedFingerprint = fingerprintMatch ? fingerprintMatch[1] : null

  return {
    pathname: fingerprintMatch ? pathname.slice(0, -fingerprintMatch[0].length) : pathname,
    requestedFingerprint,
  }
}

export function formatFingerprintedPathname(pathname: string, fingerprint: string | null): string {
  return fingerprint ? `${pathname}.@${fingerprint}` : pathname
}

export function getFingerprintRequestCacheControl(requestedFingerprint: string | null): string {
  return requestedFingerprint === null ? 'no-cache' : 'public, max-age=31536000, immutable'
}
