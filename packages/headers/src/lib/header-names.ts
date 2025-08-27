const HeaderWordCasingExceptions: Record<string, string> = {
  ct: 'CT',
  etag: 'ETag',
  te: 'TE',
  www: 'WWW',
  x: 'X',
  xss: 'XSS',
}

export function canonicalHeaderName(name: string): string {
  return name
    .toLowerCase()
    .split('-')
    .map((word) => HeaderWordCasingExceptions[word] || word.charAt(0).toUpperCase() + word.slice(1))
    .join('-')
}
