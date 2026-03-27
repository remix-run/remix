const RESOURCE_HINT_RELS = new Set([
  'dns-prefetch',
  'modulepreload',
  'preconnect',
  'prefetch',
  'preload',
  'prerender',
])

export function getLinkRelTokens(rel: string): string[] {
  return rel
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
}

export function isResourceHintRel(rel: string): boolean {
  return getLinkRelTokens(rel).some((token) => RESOURCE_HINT_RELS.has(token))
}
