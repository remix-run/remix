import * as fs from 'node:fs'

/**
 * Whether Pagefind UI assets should be linked into the document.
 *
 * Outside development, always load so prerendered HTML includes search even
 * before the index exists on disk. In development, only load when the
 * generated module is present (typically after a prerender).
 */
export function shouldLoadPagefind(
  modulePath: string,
  nodeEnv = process.env.NODE_ENV,
): boolean {
  return nodeEnv !== 'development' || fs.existsSync(modulePath)
}
