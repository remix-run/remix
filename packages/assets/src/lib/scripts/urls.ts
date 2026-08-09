export function isBrowserExternalModuleUrl(url: string): boolean {
  return url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')
}
