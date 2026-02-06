import * as path from 'node:path'
import type * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as esbuild from 'esbuild'
import type { ModuleGraph } from './module-graph.ts'
import { createModuleGraph, ensureModuleNode, getModuleByUrl } from './module-graph.ts'
import { isCommonJS } from './import-rewriter.ts'
import { fixSourceMapPaths } from './source-map.ts'
import { hashCode, generateETag, matchesETag } from './etag.ts'
import type { CreateDevAssetsHandlerOptions, DevAssetsEsbuildConfig } from './options.ts'
import { SUPPORTED_ESBUILD_OPTIONS } from './options.ts'
import { toPosixPath, isPathAllowed, createDevPathResolver } from './path-resolver.ts'
import type { ResolveContext } from './resolve.ts'
import { rewriteImports } from './rewrite.ts'

let DEBUG = process.env.DEBUG?.includes('assets')

interface Caches {
  resolution: Map<string, string>
  moduleGraph: ModuleGraph
}

/**
 * Creates a stateful dev handler that serves and transforms source files.
 * Owns the module graph and caches. Expose a simple integration surface:
 * serve(pathname, headers) → Promise<Response | null>. Returns null when the
 * request is not for this handler (e.g. path not allowed, or not GET/HEAD).
 *
 * When HMR is re-added, file watching and HMR (SSE, invalidation) will live
 * in this API too—not in the middleware.
 *
 * @param options Handler options (root, allow, deny, workspace, esbuildConfig).
 * @returns Object with serve(pathname, headers) for request handling.
 */
export function createDevAssetsHandler(options: CreateDevAssetsHandlerOptions): {
  serve(pathname: string, headers: Headers): Promise<Response | null>
} {
  let root = path.resolve(options.root ?? process.cwd())
  let appAllow = options.allow ?? []
  let appDeny = options.deny ?? []
  let workspaceRoot = options.workspace?.root ? path.resolve(options.workspace.root) : null
  let workspaceAllow = options.workspace?.allow ?? []
  let workspaceDeny = [...appDeny, ...(options.workspace?.deny ?? [])]
  let esbuildConfig = options.esbuildConfig
  let externalRaw = esbuildConfig?.external
  let externalSpecifiers: string[] = Array.isArray(externalRaw)
    ? externalRaw
    : externalRaw
      ? [externalRaw]
      : []

  let resolveContext: ResolveContext = {
    root,
    workspaceRoot,
    allowPatterns: appAllow,
    denyPatterns: appDeny,
    workspaceAllowPatterns: workspaceAllow,
    workspaceDenyPatterns: workspaceDeny,
  }

  let caches: Caches = {
    resolution: new Map(),
    moduleGraph: createModuleGraph(),
  }

  let pathResolver = createDevPathResolver(options)

  async function transformSource(
    source: string,
    filePath: string,
    sourceUrl: string,
    allowPatterns: string[],
    denyPatterns: string[],
    fileMtime?: number,
  ): Promise<string> {
    let moduleNode = ensureModuleNode(caches.moduleGraph, sourceUrl, filePath)

    if (
      moduleNode.transformResult &&
      moduleNode.lastModified !== undefined &&
      fileMtime !== undefined &&
      moduleNode.lastModified === fileMtime
    ) {
      if (DEBUG) {
        console.log(`[assets] cache hit ${path.basename(filePath)}`)
      }
      return moduleNode.transformResult.code
    }

    // Use true (separate map) so we get outputFiles[1]; we append it inline ourselves and fix paths
    let sourcemap: boolean = esbuildConfig?.sourcemap !== false
    let userConfig: Partial<esbuild.BuildOptions> = {}
    if (esbuildConfig) {
      for (let key of SUPPORTED_ESBUILD_OPTIONS) {
        if (key === 'entryPoints' || key === 'external') continue
        let value = esbuildConfig[key]
        if (value !== undefined) {
          ;(userConfig as Record<string, unknown>)[key] = value
        }
      }
    }

    let result = await esbuild.build({
      ...userConfig,
      entryPoints: [filePath],
      bundle: true,
      external: ['*'],
      write: false,
      format: 'esm',
      sourcemap,
    })

    let output = result.outputFiles?.[0]
    if (!output) throw new Error('esbuild did not produce output')

    let code = output.text
    let map = result.outputFiles?.[1]?.text ?? null

    let ctx: ResolveContext = {
      root,
      workspaceRoot,
      allowPatterns,
      denyPatterns,
      workspaceAllowPatterns: workspaceAllow,
      workspaceDenyPatterns: workspaceDeny,
    }
    let rewritten = await rewriteImports(
      code,
      map ?? '{}',
      sourceUrl,
      filePath,
      caches.resolution,
      ctx,
      externalSpecifiers,
    )

    let mapJson = rewritten.map && rewritten.map !== '{}' ? rewritten.map : null
    if (mapJson && sourcemap !== false) {
      let base64Map = Buffer.from(mapJson).toString('base64')
      rewritten.code += `\n//# sourceMappingURL=data:application/json;base64,${base64Map}`
    }
    if (sourcemap !== false) {
      rewritten.code = fixSourceMapPaths(rewritten.code, sourceUrl)
    }
    let hash = await hashCode(rewritten.code)

    moduleNode.transformResult = {
      code: rewritten.code,
      map: rewritten.map,
      hash,
    }
    if (fileMtime !== undefined) {
      moduleNode.lastModified = fileMtime
    }

    return rewritten.code
  }

  async function handleWorkspaceRequest(
    pathname: string,
    ifNoneMatch: string | null,
  ): Promise<Response> {
    if (!workspaceRoot) {
      return new Response('Workspace access not configured', {
        status: 403,
        headers: { 'Content-Type': 'text/plain' },
      })
    }
    let posixPath = pathname.slice('/__@workspace/'.length)
    if (!isPathAllowed(posixPath, workspaceAllow, workspaceDeny)) {
      if (DEBUG) {
        console.warn(`[assets] Blocked: ${pathname}`)
      }
      return new Response(`Forbidden: ${posixPath}`, {
        status: 403,
        headers: { 'Content-Type': 'text/plain' },
      })
    }
    let filePath = path.join(workspaceRoot, ...posixPath.split('/'))

    try {
      let stat = await fsp.stat(filePath)
      let source = await fsp.readFile(filePath, 'utf-8')

      if (isCommonJS(source)) {
        return new Response(
          `CommonJS module detected: ${posixPath}\n\n` +
            `This package uses CommonJS (require/module.exports) which is not supported.\n` +
            `Please use an ESM-compatible package.`,
          { status: 500, headers: { 'Content-Type': 'text/plain' } },
        )
      }

      let transformed = await transformSource(
        source,
        filePath,
        pathname,
        workspaceAllow,
        workspaceDeny,
        stat.mtimeMs,
      )

      let moduleNode = getModuleByUrl(caches.moduleGraph, pathname)
      let hash = moduleNode?.transformResult?.hash ?? ''
      let etag = generateETag(hash)
      if (matchesETag(ifNoneMatch, etag)) {
        return new Response(null, { status: 304, headers: { ETag: etag } })
      }

      return new Response(transformed, {
        headers: {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-cache',
          ETag: etag,
        },
      })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return new Response(`Not Found: ${posixPath}`, { status: 404 })
      }
      let message = error instanceof Error ? error.message : String(error)
      return new Response(`Error serving ${posixPath}: ${message}`, {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      })
    }
  }

  return {
    async serve(pathname: string, headers: Headers): Promise<Response | null> {
      let ifNoneMatch = headers.get('If-None-Match')

      if (pathname.startsWith('/__@workspace/')) {
        return handleWorkspaceRequest(pathname, ifNoneMatch)
      }

      let resolution = pathResolver(pathname)
      if (!resolution) return null

      let filePath = resolution.filePath
      let stat: fs.Stats
      try {
        stat = await fsp.stat(filePath)
        if (stat.isDirectory()) return null
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
        throw error
      }

      let relativePath = pathname.replace(/^\/+/, '')
      let posixPath = toPosixPath(relativePath)
      if (!isPathAllowed(posixPath, appAllow, appDeny)) {
        if (DEBUG) {
          console.warn(`[assets] Blocked: ${pathname}`)
        }
        return new Response('Forbidden', {
          status: 403,
          headers: { 'Content-Type': 'text/plain' },
        })
      }

      try {
        let source = await fsp.readFile(filePath, 'utf-8')
        let transformed = await transformSource(
          source,
          filePath,
          pathname,
          appAllow,
          appDeny,
          stat.mtimeMs,
        )

        let moduleNode = getModuleByUrl(caches.moduleGraph, pathname)
        let hash = moduleNode?.transformResult?.hash ?? ''
        let etag = generateETag(hash)
        if (matchesETag(ifNoneMatch, etag)) {
          return new Response(null, { status: 304, headers: { ETag: etag } })
        }

        return new Response(transformed, {
          headers: {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'no-cache',
            ETag: etag,
          },
        })
      } catch (error) {
        let message = error instanceof Error ? error.message : String(error)
        return new Response(`Transform error: ${message}`, {
          status: 500,
          headers: { 'Content-Type': 'text/plain' },
        })
      }
    },
  }
}
