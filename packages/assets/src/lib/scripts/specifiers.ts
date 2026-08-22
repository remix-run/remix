export function isBareImportSpecifier(specifier: string): boolean {
  return (
    !specifier.startsWith('./') &&
    !specifier.startsWith('../') &&
    !specifier.startsWith('/') &&
    !specifier.startsWith('file:') &&
    !specifier.startsWith('data:') &&
    !specifier.startsWith('http://') &&
    !specifier.startsWith('https://')
  )
}
