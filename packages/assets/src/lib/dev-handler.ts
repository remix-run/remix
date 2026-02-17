import * as path from 'node:path'
import type * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as esbuild from 'esbuild'
import type { ModuleGraph } from './module-graph.ts'
import { createModuleGraph, ensureModuleNode, getModuleByUrl } from './module-graph.ts'
import { isCommonJS } from './import-rewriter.ts'
import { fixSourceMapPaths } from './source-map.ts'
import { hashCode, generateETag, matchesETag } from './etag.ts'
import type { CreateDevAssetsHandlerOptions } from './options.ts'
import { toPosixPath, isPathAllowed, createDevPathResolver } from './path-resolver.ts'
import type { ResolveContext } from './resolve.ts'
import { rewriteImports } from './rewrite.ts'
import {
  compileFileRules,
  findFileRule,
  normalizeSourcePath,
  runFileRule,
  selectVariant,
} from './files.ts'

let DEBUG = process.env.DEBUG?.includes('assets')

interface Caches {
  resolution: Map<string, string>
  moduleGraph: ModuleGraph
}

interface FileAssetTransformState {
  sourceStamp: string
  etag: string
  cachedFilePath: string | null
  ext: string
}

/**
 * Creates a stateful dev handler that serves and transforms source files.
 * Owns the module graph and caches. Expose a simple integration surface:
 * serve(request) → Promise<Response | null>. Returns null when the request
 * is not for this handler (e.g. not GET/HEAD, path not allowed).
 *
 * When HMR is re-added, file watching and HMR (SSE, invalidation) will live
 * in this API too—not in the middleware.
 *
 * @param options Handler options (root, allow, deny, workspaceRoot, workspaceAllow, workspaceDeny, sourcemap, external).
 * @returns Object with serve(request) for request handling.
 */
export function createDevAssetsHandler(options: CreateDevAssetsHandlerOptions): {
  serve(request: Request): Promise<Response | null>
} {
  let root = path.resolve(process.cwd(), options.root ?? '.')
  let appAllow = options.allow ?? []
  let appDeny = options.deny ?? []
  let workspaceRoot = options.workspaceRoot ? path.resolve(options.workspaceRoot) : null
  let workspaceAllow = options.workspaceAllow ?? appAllow
  let workspaceDeny = options.workspaceDeny ?? appDeny
  let externalRaw = options.external
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
  let compiledFileRules = compileFileRules(options.files)
  let fileAssetTransforms = new Map<string, FileAssetTransformState>()
  let filesCacheLocation =
    options.filesCache === false
      ? null
      : path.resolve(root, options.filesCache ?? './.assets/files-cache')

  function getCachedFilePrefix(
    sourcePath: string,
    selectedVariant: string | undefined,
    cacheKey: string,
  ): { dirPath: string; filePrefix: string } {
    let parsedPath = path.posix.parse(sourcePath)
    let pathSegments = parsedPath.dir.split('/').filter(Boolean)
    let variantSegment = selectedVariant ? `-@${selectedVariant}` : ''
    let dirPath = path.join(filesCacheLocation!, ...pathSegments)
    let filePrefix = `${parsedPath.name}${variantSegment}-${cacheKey.slice(0, 8)}`
    return { dirPath, filePrefix }
  }

  function getCachedFilePath(
    sourcePath: string,
    selectedVariant: string | undefined,
    cacheKey: string,
    ext: string,
  ): string {
    let { dirPath, filePrefix } = getCachedFilePrefix(sourcePath, selectedVariant, cacheKey)
    let fileName = ext ? `${filePrefix}.${ext}` : filePrefix
    return path.join(dirPath, fileName)
  }

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

    // In dev only sourcemap on/off matters; we always inline and fix paths.
    let sourcemap: boolean = options.sourcemap !== false

    let result = await esbuild.build({
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

  function getContentTypeForExtension(ext: string): string {
    switch (ext.toLowerCase()) {
      case 'png':
        return 'image/png'
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg'
      case 'webp':
        return 'image/webp'
      case 'avif':
        return 'image/avif'
      case 'gif':
        return 'image/gif'
      case 'svg':
        return 'image/svg+xml'
      case 'woff':
        return 'font/woff'
      case 'woff2':
        return 'font/woff2'
      case 'ttf':
        return 'font/ttf'
      case 'otf':
        return 'font/otf'
      case 'css':
        return 'text/css; charset=utf-8'
      case 'txt':
        return 'text/plain; charset=utf-8'
      case 'json':
        return 'application/json; charset=utf-8'
      default:
        return 'application/octet-stream'
    }
  }

  async function handleFileAssetRequest(
    requestUrl: URL,
    ifNoneMatch: string | null,
  ): Promise<Response> {
    let tailPath = requestUrl.pathname.slice('/__@files/'.length)
    if (!tailPath) return new Response('Not Found', { status: 404 })

    let decodedTail = tailPath
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment))
      .join('/')
    let sourcePath = normalizeSourcePath(decodedTail)
    let variantFlag = Array.from(requestUrl.searchParams.keys()).find((key) => key.startsWith('@'))
    let requestedVariant = variantFlag ? variantFlag.slice(1) : undefined

    if (!isPathAllowed(sourcePath, appAllow, appDeny)) {
      return new Response('Forbidden', {
        status: 403,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    let rule = findFileRule(sourcePath, undefined, compiledFileRules)
    if (!rule) return new Response('Not Found', { status: 404 })

    let selectedVariant = rule.variants
      ? (selectVariant(rule, requestedVariant) ?? undefined)
      : undefined
    if (rule.variants && !selectedVariant) return new Response('Not Found', { status: 404 })
    if (!rule.variants && requestedVariant) return new Response('Not Found', { status: 404 })

    let absolutePath = path.join(root, ...sourcePath.split('/'))
    let stat: fs.Stats
    try {
      stat = await fsp.stat(absolutePath)
      if (!stat.isFile()) return new Response('Not Found', { status: 404 })
    } catch {
      return new Response('Not Found', { status: 404 })
    }

    let transformStateKey = `${sourcePath}\0${selectedVariant ?? 'base'}`
    let sourceStamp = `${stat.size}\0${Math.floor(stat.mtimeMs)}`
    let transformState = fileAssetTransforms.get(transformStateKey)
    if (transformState && transformState.sourceStamp === sourceStamp) {
      if (matchesETag(ifNoneMatch, transformState.etag)) {
        return new Response(null, { status: 304, headers: { ETag: transformState.etag } })
      }

      if (transformState.cachedFilePath) {
        try {
          let cachedData = await fsp.readFile(transformState.cachedFilePath)
          return new Response(new Uint8Array(cachedData), {
            headers: {
              'Content-Type': getContentTypeForExtension(transformState.ext),
              'Cache-Control': 'no-cache',
              ETag: transformState.etag,
            },
          })
        } catch {
          // Cache entry missing on disk, regenerate below.
        }
      }
    }

    let cachedFilePath: string | null = null
    let sourceData = await fsp.readFile(absolutePath)
    let transformed = await runFileRule(sourcePath, sourceData, rule, selectedVariant)
    let transformedHash = await hashCode(transformed.data.toString('base64'), transformStateKey)
    let etag = generateETag(transformedHash)

    if (filesCacheLocation) {
      cachedFilePath = getCachedFilePath(
        sourcePath,
        selectedVariant,
        transformedHash,
        transformed.ext,
      )
      await fsp.mkdir(path.dirname(cachedFilePath), { recursive: true })
      await fsp.writeFile(cachedFilePath, transformed.data, { flag: 'wx' }).catch(async (error) => {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') return
        throw error
      })
    }

    fileAssetTransforms.set(transformStateKey, {
      sourceStamp,
      etag,
      cachedFilePath,
      ext: transformed.ext,
    })

    if (matchesETag(ifNoneMatch, etag)) {
      return new Response(null, { status: 304, headers: { ETag: etag } })
    }

    return new Response(new Uint8Array(transformed.data), {
      headers: {
        'Content-Type': getContentTypeForExtension(transformed.ext),
        'Cache-Control': 'no-cache',
        ETag: etag,
      },
    })
  }

  return {
    async serve(request: Request): Promise<Response | null> {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return null
      }
      let requestUrl = new URL(request.url)
      let pathname = requestUrl.pathname
      let ifNoneMatch = request.headers.get('If-None-Match')

      if (pathname.startsWith('/__@files/')) {
        return handleFileAssetRequest(requestUrl, ifNoneMatch)
      }

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
