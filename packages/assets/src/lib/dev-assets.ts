import * as path from 'node:path'
import * as fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Assets, AssetEntry } from '@remix-run/fetch-router'

/**
 * Creates an assets API for dev mode with 1:1 source-to-URL mapping.
 *
 * In dev mode:
 * - `href` returns the source path as a URL (e.g., '/app/entry.tsx')
 * - `chunks` returns `[href]` since there's no code splitting in dev
 * - Entry paths are always treated as relative to root (leading slashes stripped, .. collapsed)
 * - When `entryPoints` is provided, only those paths return a result; others return null
 *
 * @param root The root directory where source files are served from
 * @param entryPoints Optional list of entry paths to restrict get() to (e.g. from esbuildConfig.entryPoints)
 * @returns An assets object for resolving entry paths to URLs
 */
export function createDevAssets(root: string, entryPoints?: string[]): Assets {
  let absoluteRoot = path.resolve(root)

  function normalizeEntryPath(entryPath: string): string {
    let p: string
    if (entryPath.startsWith('file://')) {
      p = fileURLToPath(entryPath)
      if (path.isAbsolute(p)) {
        p = path.relative(absoluteRoot, p)
      }
    } else {
      p = entryPath.replace(/^\/+/, '')
      if (path.isAbsolute(p)) {
        p = path.relative(absoluteRoot, p)
      }
    }
    p = path.posix.normalize(p.replace(/\\/g, '/'))
    return p
  }

  let allowedSet: Set<string> | null = null
  if (entryPoints && entryPoints.length > 0) {
    allowedSet = new Set(entryPoints.map((ep) => normalizeEntryPath(ep)))
  }

  return {
    get(entryPath: string): AssetEntry | null {
      let normalizedPath = normalizeEntryPath(entryPath)
      if (allowedSet && !allowedSet.has(normalizedPath)) {
        return null
      }
      let filePath = path.join(absoluteRoot, ...normalizedPath.split('/'))
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        return null
      }
      let href = '/' + normalizedPath
      return { href, chunks: [href] }
    },
  }
}
