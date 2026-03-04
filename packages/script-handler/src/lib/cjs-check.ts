// Detects CommonJS modules that cannot be served as ES modules.
export function isCommonJS(source: string): boolean {
  if (/\bmodule\.exports\b/.test(source)) return true
  if (/\bexports\.[a-zA-Z_$]/.test(source)) return true
  let hasESMSyntax = /\b(import|export)\s/.test(source)
  if (!hasESMSyntax && /\brequire\s*\(/.test(source)) return true
  return false
}
