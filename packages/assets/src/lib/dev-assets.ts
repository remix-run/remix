import * as path from 'node:path'
import * as fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  compileFileRules,
  findFileRule,
  normalizeSourcePath,
  selectVariant,
  type AssetEntry,
  type AssetResolver,
  type FilesConfig,
} from './files.ts'

export interface CreateDevAssetResolverOptions<files extends FilesConfig = FilesConfig> {
  root: string
  scripts?: string[]
  files?: files
}

/**
 * Creates an asset resolver for dev mode with 1:1 source-to-URL mapping.
 *
 * In dev mode:
 * - `href` returns the source path as a URL (e.g., '/app/entry.tsx')
 * - Script entries return `preloads: [href]` since there's no code splitting in dev
 * - File entries return `preloads: []` because file assets have no module graph
 * - Entry paths are always treated as relative to root (leading slashes stripped, .. collapsed)
 * - When `scripts` is provided, only those paths return a result; others return null
 *
 * @param options The root/scripts/files options
 * @returns An assets object for resolving entry paths to URLs
 */
export function createDevAssetResolver<files extends FilesConfig = FilesConfig>(
  options: CreateDevAssetResolverOptions<files>,
): AssetResolver<files> {
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
  if (allowedSet && compiledFileRules.length > 0) {
    let overlaps = [...allowedSet].filter((sourcePath) =>
      Boolean(findFileRule(sourcePath, undefined, compiledFileRules)),
    )
    if (overlaps.length > 0) {
      console.warn(
        `[assets] ${overlaps.length} source path(s) are configured as both file and script entries. ` +
          `File entries take precedence: ${overlaps.slice(0, 5).join(', ')}`,
      )
    }
  }

  return (entryPath: string, variant?: string): AssetEntry | null => {
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
        return { href, preloads: [] }
      }
      if (variant) return null
      let href = createDevFileHref(normalizedPath, undefined)
      return { href, preloads: [] }
    }

    if (variant) return null
    if (allowedSet && !allowedSet.has(normalizedPath)) return null
    let href = '/' + normalizedPath
    return { href, preloads: [href] }
  }
}
