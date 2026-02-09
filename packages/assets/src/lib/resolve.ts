import * as path from 'node:path'
import * as fs from 'node:fs'
import * as esbuild from 'esbuild'
import { toPosixPath, isPathAllowed } from './path-resolver.ts'

export interface ResolveContext {
  root: string
  workspaceRoot: string | null
  /** Allow/deny for app root; enforced by the handler, not used in resolvedPathToUrl. */
  allowPatterns: string[]
  denyPatterns: string[]
  /** Used for paths under workspace root when emitting /__@workspace/ URLs. */
  workspaceAllowPatterns: string[]
  workspaceDenyPatterns: string[]
}

/**
 * Convert a resolved absolute path to a browser-compatible URL.
 *
 * @param absolutePath Resolved absolute file path.
 * @param ctx Resolve context (root, workspaceRoot, allow/deny patterns).
 * @returns URL path (e.g. /path or /__@workspace/path).
 */
export function resolvedPathToUrl(absolutePath: string, ctx: ResolveContext): string {
  let realPath: string
  let realRoot: string
  let realWorkspaceRoot: string | null
  try {
    realPath = fs.realpathSync(absolutePath)
    realRoot = fs.realpathSync(ctx.root)
    realWorkspaceRoot = ctx.workspaceRoot ? fs.realpathSync(ctx.workspaceRoot) : null
  } catch {
    realPath = path.normalize(absolutePath)
    realRoot = path.normalize(ctx.root)
    realWorkspaceRoot = ctx.workspaceRoot ? path.normalize(ctx.workspaceRoot) : null
  }

  if (realPath.startsWith(realRoot + path.sep)) {
    let relativePath = path.relative(realRoot, realPath)
    return '/' + toPosixPath(relativePath)
  }

  if (realWorkspaceRoot && realPath.startsWith(realWorkspaceRoot + path.sep)) {
    let relativePath = path.relative(realWorkspaceRoot, realPath)
    let posixPath = toPosixPath(relativePath)
    if (!isPathAllowed(posixPath, ctx.workspaceAllowPatterns, ctx.workspaceDenyPatterns)) {
      return absolutePath
    }
    return '/__@workspace/' + posixPath
  }

  return absolutePath
}

/**
 * Batch resolve specifiers via esbuild and fill the resolution cache with resulting URLs.
 *
 * @param specifiers Import specifiers to resolve.
 * @param importerDir Directory of the importing file.
 * @param ctx Resolve context.
 * @param resolutionCache Map to fill with specifier → resolved URL.
 * @param externalSpecifiers Specifier strings to skip (not resolved).
 * @param isExternal Function to check if a specifier is external.
 */
export async function resolveSpecifiers(
  specifiers: string[],
  importerDir: string,
  ctx: ResolveContext,
  resolutionCache: Map<string, string>,
  externalSpecifiers: string[],
  isExternal: (specifier: string) => boolean,
): Promise<void> {
  let toResolve = specifiers.filter((s) => !isExternal(s))
  if (toResolve.length === 0) return

  try {
    let stdinContents = toResolve
      .map((s, i) => `export * as _${i} from ${JSON.stringify(s)}`)
      .join('\n')

    let result = await esbuild.build({
      stdin: {
        contents: stdinContents,
        resolveDir: importerDir,
        loader: 'js',
      },
      write: false,
      bundle: true,
      metafile: true,
      platform: 'browser',
      format: 'esm',
      logLevel: 'silent',
      plugins: [
        {
          name: 'empty-loader',
          setup(build) {
            build.onLoad({ filter: /.*/ }, () => ({ contents: '', loader: 'js' }))
          },
        },
      ],
    })

    let inputs = result.metafile?.inputs ?? {}
    let stdinInputs = inputs['<stdin>']
    if (!stdinInputs?.imports) return

    for (let i = 0; i < stdinInputs.imports.length; i++) {
      let imp = stdinInputs.imports[i]
      let specifier = toResolve[i]
      if (!specifier || !imp.path) continue

      let absolutePath = path.resolve(imp.path)
      let cacheKey = `${specifier}\0${importerDir}`
      let resolvedUrl = resolvedPathToUrl(absolutePath, ctx)
      resolutionCache.set(cacheKey, resolvedUrl)
    }
  } catch {
    for (let specifier of toResolve) {
      let cacheKey = `${specifier}\0${importerDir}`
      resolutionCache.set(cacheKey, specifier)
    }
  }
}

export interface ResolvedImport {
  url: string
  absolutePath: string
}

/**
 * Resolve specifiers and return URL + absolute path for each (for graph discovery).
 * Also fills the resolution cache for use by rewriteImports.
 *
 * @param specifiers Import specifiers to resolve
 * @param importerDir Directory of the importing file
 * @param ctx Resolve context
 * @param resolutionCache Map to fill with specifier -> URL
 * @param externalSpecifiers Specifiers to skip
 * @param isExternal Function to check if a specifier is external
 * @returns Array of { url, absolutePath } for each resolved import
 */
export async function resolveSpecifiersToPaths(
  specifiers: string[],
  importerDir: string,
  ctx: ResolveContext,
  resolutionCache: Map<string, string>,
  externalSpecifiers: string[],
  isExternal: (specifier: string) => boolean,
): Promise<ResolvedImport[]> {
  let toResolve = specifiers.filter((s) => !isExternal(s))
  if (toResolve.length === 0) return []

  let results: ResolvedImport[] = []

  try {
    let stdinContents = toResolve
      .map((s, i) => `export * as _${i} from ${JSON.stringify(s)}`)
      .join('\n')

    let result = await esbuild.build({
      stdin: {
        contents: stdinContents,
        resolveDir: importerDir,
        loader: 'js',
      },
      write: false,
      bundle: true,
      metafile: true,
      platform: 'browser',
      format: 'esm',
      logLevel: 'silent',
      plugins: [
        {
          name: 'empty-loader',
          setup(build) {
            build.onLoad({ filter: /.*/ }, () => ({ contents: '', loader: 'js' }))
          },
        },
      ],
    })

    let inputs = result.metafile?.inputs ?? {}
    let stdinInputs = inputs['<stdin>']
    if (!stdinInputs?.imports) return []

    for (let i = 0; i < stdinInputs.imports.length; i++) {
      let imp = stdinInputs.imports[i]
      let specifier = toResolve[i]
      if (!specifier || !imp.path) continue

      let absolutePath = path.resolve(imp.path)
      let resolvedUrl = resolvedPathToUrl(absolutePath, ctx)
      let cacheKey = `${specifier}\0${importerDir}`
      resolutionCache.set(cacheKey, resolvedUrl)
      results.push({ url: resolvedUrl, absolutePath })
    }
  } catch {
    for (let specifier of toResolve) {
      let cacheKey = `${specifier}\0${importerDir}`
      resolutionCache.set(cacheKey, specifier)
    }
  }

  return results
}
