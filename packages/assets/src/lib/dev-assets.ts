import * as path from 'node:path'
import * as fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  compileFileRules,
  findFileRule,
  normalizeSourcePath,
  selectVariant,
  type AssetEntry,
  type AssetsApi,
  type FilesConfig,
} from './files.ts'

export interface CreateDevAssetsOptions<files extends FilesConfig = FilesConfig> {
  root: string
  scripts?: string[]
  files?: files
}

/**
 * Creates an assets API for dev mode with 1:1 source-to-URL mapping.
 *
 * In dev mode:
 * - `href` returns the source path as a URL (e.g., '/app/entry.tsx')
 * - `chunks` returns `[href]` since there's no code splitting in dev
 * - Entry paths are always treated as relative to root (leading slashes stripped, .. collapsed)
 * - When `scripts` is provided, only those paths return a result; others return null
 *
 * @param options The root/scripts/files options
 * @returns An assets object for resolving entry paths to URLs
 */
export function createDevAssets<files extends FilesConfig = FilesConfig>(
  options: CreateDevAssetsOptions<files>,
): AssetsApi<files> {
  let scripts = options.scripts
  let absoluteRoot = path.resolve(options.root)
  let compiledFileRules = compileFileRules(options.files)

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
    return normalizeSourcePath(p)
  }

  function createDevFileHref(sourcePath: string, variant: string | undefined): string {
    let encodedPath = sourcePath.split('/').map(encodeURIComponent).join('/')
    let query = variant ? `@${encodeURIComponent(variant)}` : ''
    return query ? `/__@files/${encodedPath}?${query}` : `/__@files/${encodedPath}`
  }

  let allowedSet: Set<string> | null = null
  if (scripts && scripts.length > 0) {
    allowedSet = new Set(scripts.map((entryPoint) => normalizeEntryPath(entryPoint)))
  }

  return {
    get(entryPath: string, variant?: string): AssetEntry | null {
      let normalizedPath = normalizeEntryPath(entryPath)
      let filePath = path.join(absoluteRoot, ...normalizedPath.split('/'))
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        return null
      }

      let matchingRule = findFileRule(normalizedPath, undefined, compiledFileRules)
      if (matchingRule) {
        if (matchingRule.variants) {
          let selectedVariant = selectVariant(matchingRule, variant)
          if (!selectedVariant) return null
          let href = createDevFileHref(normalizedPath, selectedVariant)
          return { href, chunks: [href] }
        }
        if (variant) return null
        let href = createDevFileHref(normalizedPath, undefined)
        return { href, chunks: [href] }
      }

      if (variant) return null
      if (allowedSet && !allowedSet.has(normalizedPath)) return null
      let href = '/' + normalizedPath
      return { href, chunks: [href] }
    },
  }
}
