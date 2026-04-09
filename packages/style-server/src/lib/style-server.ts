import * as fs from 'node:fs'
import * as path from 'node:path'
import resolveBrowserslist from 'browserslist'
import { browserslistToTargets } from 'lightningcss'
import type { Targets } from 'lightningcss'

import { createAccessPolicy } from './access.ts'
import { createResponseForStyle, createStyleCompiler } from './compiler.ts'
import { isStyleServerCompilationError } from './compilation-error.ts'
import { normalizeFilePath } from './paths.ts'
import { compileRoutes, type CompiledRoutes, type StyleRouteDefinition } from './routes.ts'
import { createStyleServerWatcher } from './watch.ts'
import type { StyleServerWatcher } from './watch.ts'

interface StyleServerWatchOptions {
  ignore?: readonly string[]
  poll?: boolean
  pollInterval?: number
}

interface StyleServerFingerprintOptions {
  buildId: string
}

export interface StyleServerOptions {
  routes: ReadonlyArray<StyleRouteDefinition>
  root?: string
  allow?: readonly string[]
  deny?: readonly string[]
  browserslist?: string
  sourceMaps?: 'inline' | 'external'
  fingerprint?: StyleServerFingerprintOptions
  minify?: boolean
  watch?: boolean | StyleServerWatchOptions
  onError?: (error: unknown) => void | Response | Promise<void | Response>
}

export interface StyleServer {
  fetch(request: Request): Promise<Response | null>
  getHref(filePath: string): Promise<string>
  getPreloads(filePath: string | readonly string[]): Promise<string[]>
  close(): Promise<void>
}

type StyleServerInternals = {
  watcher: StyleServerWatcher | null
}

const internalStateByStyleServer = new WeakMap<StyleServer, StyleServerInternals>()
const defaultAllow = ['**/*.css'] as const

type ResolvedStyleServerOptions = {
  allow: readonly string[]
  buildId?: string
  browserslistTargets?: Targets
  deny?: readonly string[]
  fingerprintFiles: boolean
  minify: boolean
  onError: NonNullable<StyleServerOptions['onError']>
  root: string
  routeDefinitions: readonly StyleRouteDefinition[]
  routes: CompiledRoutes
  sourceMaps?: 'inline' | 'external'
  watchOptions: StyleServerWatchOptions | null
}

// Internal-only test hook. This is intentionally not re-exported from the package entrypoint.
export function getInternalStyleServerWatchedDirectories(styleServer: StyleServer): string[] {
  return internalStateByStyleServer.get(styleServer)?.watcher?.getWatchedDirectories() ?? []
}

// Internal-only test hook. This is intentionally not re-exported from the package entrypoint.
export function waitForInternalStyleServerWatcher(styleServer: StyleServer): Promise<void> {
  return internalStateByStyleServer.get(styleServer)?.watcher?.whenReady() ?? Promise.resolve()
}

export function createStyleServer(options: StyleServerOptions): StyleServer {
  let resolvedOptions = resolveStyleServerOptions(options)
  let accessPolicy = createAccessPolicy({
    allow: resolvedOptions.allow,
    deny: resolvedOptions.deny,
    root: resolvedOptions.root,
  })
  let compiler = createStyleCompiler({
    buildId: resolvedOptions.buildId,
    browserslistTargets: resolvedOptions.browserslistTargets,
    fingerprintFiles: resolvedOptions.fingerprintFiles,
    isAllowed: accessPolicy.isAllowed,
    minify: resolvedOptions.minify,
    root: resolvedOptions.root,
    routes: resolvedOptions.routes,
    sourceMaps: resolvedOptions.sourceMaps,
  })
  let watcher = resolvedOptions.watchOptions
    ? createStyleServerWatcher({
        ...resolvedOptions.watchOptions,
        onFileEvent: handleWatchEvent,
        root: resolvedOptions.root,
        routes: resolvedOptions.routeDefinitions,
      })
    : null

  async function responseForError(error: unknown): Promise<Response> {
    try {
      return (await resolvedOptions.onError(error)) ?? internalServerError()
    } catch (error) {
      console.error(`There was an error in the style server error handler: ${error}`)
      return internalServerError()
    }
  }

  async function handleWatchEvent(filePath: string, event: 'add' | 'change' | 'unlink') {
    try {
      await compiler.handleFileEvent(filePath, event)
    } catch (error) {
      console.error(`There was an error invalidating the style server cache: ${error}`)
    }
  }

  let styleServer: StyleServer = {
    async fetch(request) {
      if (request.method !== 'GET' && request.method !== 'HEAD') return null

      let parsedRequestPathname = compiler.parseRequestPathname(new URL(request.url).pathname)
      if (!parsedRequestPathname) return null

      try {
        if (compiler.isStyleFile(parsedRequestPathname.filePath)) {
          let compiledStyle = await compiler.compileStyle(parsedRequestPathname.filePath)

          if (parsedRequestPathname.requestedFingerprint !== null) {
            if (compiledStyle.fingerprint !== parsedRequestPathname.requestedFingerprint) {
              return null
            }
          }

          return createResponseForStyle(compiledStyle, {
            cacheControl: parsedRequestPathname.cacheControl,
            ifNoneMatch: request.headers.get('If-None-Match'),
            isSourceMapRequest: parsedRequestPathname.isSourceMapRequest,
            method: request.method,
          })
        }

        if (parsedRequestPathname.isSourceMapRequest) {
          return null
        }
        return null
      } catch (error) {
        if (
          isStyleServerCompilationError(error) &&
          (error.code === 'FILE_NOT_FOUND' || error.code === 'FILE_NOT_ALLOWED')
        ) {
          return null
        }

        return responseForError(error)
      }
    },

    async getHref(filePath) {
      return compiler.getHref(filePath)
    },

    async getPreloads(filePath) {
      return compiler.getPreloadUrls(filePath)
    },

    async close() {
      await watcher?.close()
    },
  }

  internalStateByStyleServer.set(styleServer, {
    watcher,
  })

  return styleServer
}

function internalServerError(): Response {
  return new Response('Internal Server Error', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    status: 500,
  })
}

function defaultErrorHandler(error: unknown): void {
  console.error(error)
}

function resolveStyleServerOptions(options: StyleServerOptions): ResolvedStyleServerOptions {
  let root = normalizeFilePath(fs.realpathSync(path.resolve(options.root ?? process.cwd())))
  let fingerprintOptions = normalizeFingerprintOptions({
    fingerprint: options.fingerprint,
    watch: options.watch,
  })

  return {
    allow: options.allow ?? defaultAllow,
    buildId: fingerprintOptions.buildId,
    browserslistTargets: normalizeBrowserslistTargets(options.browserslist),
    deny: options.deny,
    fingerprintFiles: fingerprintOptions.enabled,
    minify: options.minify ?? false,
    onError: options.onError ?? defaultErrorHandler,
    root,
    routeDefinitions: options.routes,
    routes: compileRoutes({
      root,
      routes: options.routes,
    }),
    sourceMaps: options.sourceMaps,
    watchOptions: normalizeWatchOptions(options.watch),
  }
}

function normalizeFingerprintOptions(options: {
  fingerprint: StyleServerOptions['fingerprint']
  watch: StyleServerOptions['watch']
}):
  | {
      buildId?: string
      enabled: false
    }
  | {
      buildId: string
      enabled: true
    } {
  if (!options.fingerprint) {
    return {
      enabled: false,
    }
  }

  if (typeof options.fingerprint.buildId !== 'string') {
    throw new TypeError('fingerprint.buildId must be a string')
  }

  if (options.fingerprint.buildId.length === 0) {
    throw new TypeError('fingerprint.buildId must be a non-empty string')
  }

  if (options.watch) {
    throw new TypeError('fingerprint cannot be used with watch mode')
  }

  return {
    buildId: options.fingerprint.buildId,
    enabled: true,
  }
}

function normalizeWatchOptions(
  options: StyleServerOptions['watch'],
): StyleServerWatchOptions | null {
  if (!options) return null
  return options === true ? {} : options
}

function normalizeBrowserslistTargets(
  query: StyleServerOptions['browserslist'],
): Targets | undefined {
  if (query == null) return undefined

  if (typeof query !== 'string') {
    throw new TypeError('browserslist must be a string')
  }

  if (query.trim().length === 0) {
    throw new TypeError('browserslist must be a non-empty string')
  }

  return browserslistToTargets(resolveBrowserslist(query))
}
