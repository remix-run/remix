import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as esbuild from 'esbuild'
import { getTsconfig } from 'get-tsconfig'
import { createMemoryFileStorage } from '@remix-run/file-storage/memory'
import { IfNoneMatch } from '@remix-run/headers'
import { init as lexerInit, parse as parseImports } from 'es-module-lexer'
import type { FileStorage } from '@remix-run/file-storage'
import type { Cache, TsConfigJsonResolved } from 'get-tsconfig'
import MagicString from 'magic-string'
import { SourceMapConsumer, SourceMapGenerator } from 'source-map-js'

import { isCommonJS, mayContainCommonJSModuleGlobals } from './cjs-check.ts'
import {
  createScriptServerCompilationError,
  isScriptServerCompilationError,
} from './compilation-error.ts'
import { normalizeFilePath } from './paths.ts'
import type { CompiledRoutes } from './routes.ts'

let lexerReady = lexerInit
let preloadTraversalConcurrency = getPreloadTraversalConcurrency()
let scriptModuleTypes = [
  { extension: '.js', loader: 'js' },
  { extension: '.jsx', loader: 'jsx' },
  { extension: '.mjs', loader: 'js' },
  { extension: '.mts', loader: 'ts' },
  { extension: '.ts', loader: 'ts' },
  { extension: '.tsx', loader: 'tsx' },
] as const satisfies ReadonlyArray<{ extension: string; loader: esbuild.Loader }>
let supportedScriptExtensions = scriptModuleTypes.map(({ extension }) => extension)
let supportedScriptExtensionSet = new Set<string>(supportedScriptExtensions)
let transformLoaderByExtension = new Map<string, esbuild.Loader>(
  scriptModuleTypes.map(({ extension, loader }) => [extension, loader] as const),
)

export type ModuleCompileResult = {
  compiledCode: string
  compiledHash: string
  fingerprint: string
  sourcemap: string | null
  sourcemapHash: string | null
}

type TransformedModule = {
  fingerprint: string
  identityPath: string
  importerDir: string
  rawCode: string
  resolvedPath: string
  sourceStamp: string
  sourcemap: string | null
  stableUrlPathname: string
  unresolvedImports: UnresolvedImport[]
}

type ResolvedModule = {
  deps: string[]
  fingerprint: string
  identityPath: string
  imports: ResolvedImport[]
  rawCode: string
  resolvedPath: string
  sourceStamp: string
  sourcemap: string | null
  stableUrlPathname: string
}

type EmittedModule = {
  compiledCode: string
  compiledHash: string
  importUrls: string[]
  sourceStamp: string
  sourcemap: string | null
  sourcemapHash: string | null
}

type CachedResolvedModule = {
  deps: string[]
  fingerprint: string
  imports: ResolvedImport[]
  rawCode: string
  resolvedPath: string
  sourceStamp: string
  sourcemap: string | null
  stableUrlPathname: string
}

type ModuleCompilerOptions = {
  buildId?: string
  external: string[]
  fileStorage?: FileStorage
  fingerprintInternalModules: boolean
  isAllowed(absolutePath: string): boolean
  isEntryPoint(absolutePath: string): boolean
  minify: boolean
  routes: CompiledRoutes
  sourceMapSourcePaths: 'absolute' | 'url'
  sourceMaps?: 'external' | 'inline'
}

type ResolveModuleResult = {
  identityPath: string
  resolvedPath: string
}

type ResolvedImport = {
  depPath: string
  end: number
  quote?: '"' | "'" | '`'
  start: number
}

type UnresolvedImport = {
  end: number
  quote?: '"' | "'" | '`'
  specifier: string
  start: number
}

export type ModuleCompiler = {
  compileModule(absolutePath: string): Promise<ModuleCompileResult>
  getPreloadUrls(moduleUrl: string): Promise<string[]>
  resolveRequestPath(absolutePath: string): ResolveModuleResult | null
}

export function createModuleCompiler(options: ModuleCompilerOptions): ModuleCompiler {
  let resolvedModules = new Map<string, ResolvedModule>()
  let resolvedModulesInFlight = new Map<string, Promise<ResolvedModule>>()
  let transformedModules = new Map<string, TransformedModule>()
  let emittedModules = new Map<string, EmittedModule>()
  let compileInFlight = new Map<string, Promise<ModuleCompileResult>>()
  let resolvedPathsByIdentity = new Map<string, string>()
  let cacheNamespace = options.buildId === undefined ? 'live' : encodeURIComponent(options.buildId)
  let fileStorage = options.fileStorage ?? createMemoryFileStorage()
  let buildIsImmutable = options.buildId !== undefined
  let getTsconfigTransformOptions = createTsconfigTransformOptionsResolver()

  return {
    async compileModule(absolutePath) {
      let resolvedModule = resolveModulePath(absolutePath)
      if (!resolvedModule) {
        throw createScriptServerCompilationError(`Module not found: ${absolutePath}`, {
          code: 'MODULE_NOT_FOUND',
        })
      }

      if (!options.isAllowed(resolvedModule.identityPath)) {
        throw createScriptServerCompilationError(
          `Module is not allowed: ${resolvedModule.identityPath}`,
          {
            code: 'MODULE_NOT_ALLOWED',
          },
        )
      }

      let existing = compileInFlight.get(resolvedModule.identityPath)
      if (existing) return existing

      let compilePromise = compileResolvedModule(resolvedModule)
      compileInFlight.set(resolvedModule.identityPath, compilePromise)

      try {
        return await compilePromise
      } finally {
        compileInFlight.delete(resolvedModule.identityPath)
      }
    },
    async getPreloadUrls(moduleUrl) {
      let resolvedEntry = resolveEntryFromUrl(moduleUrl)
      if (!resolvedEntry) {
        throw createScriptServerCompilationError(
          `Module "${moduleUrl}" is outside all configured routes.`,
          {
            code: 'MODULE_OUTSIDE_ROUTES',
          },
        )
      }

      let visited = new Set([resolvedEntry.identityPath])
      let queue = [resolvedEntry.identityPath]
      let urls: string[] = []

      while (queue.length > 0) {
        let frontier = queue
        queue = []
        let transformedModules = await mapWithConcurrency(
          frontier,
          preloadTraversalConcurrency,
          (identityPath) => getTransformedModule(identityPath),
        )
        let resolvedModules = await resolveTransformedModules(transformedModules)

        for (let resolvedModule of resolvedModules) {
          urls.push(getServedUrlForResolvedModule(resolvedModule))

          for (let dep of resolvedModule.deps) {
            if (visited.has(dep)) continue
            visited.add(dep)
            queue.push(dep)
          }
        }
      }

      return urls
    },
    resolveRequestPath(absolutePath) {
      return resolveModulePath(absolutePath)
    },
  }

  async function compileResolvedModule(
    resolvedModule: ResolveModuleResult,
  ): Promise<ModuleCompileResult> {
    let resolvedSourceModule = await getResolvedModuleByIdentity(
      resolvedModule.identityPath,
      resolvedModule.resolvedPath,
    )
    let existing = emittedModules.get(resolvedSourceModule.identityPath)
    if (buildIsImmutable) {
      let cacheKey = await getEmittedModuleKey(resolvedSourceModule.identityPath)
      if (existing) {
        return toModuleCompileResult(resolvedSourceModule, existing)
      }

      let stored = await readEmittedModule(cacheKey)
      if (stored) {
        return toModuleCompileResult(
          resolvedSourceModule,
          cacheEmittedModule(resolvedSourceModule.identityPath, stored),
        )
      }
    }

    let importUrls = await Promise.all(
      resolvedSourceModule.deps.map((depPath) => getServedUrl(depPath)),
    )
    if (
      existing &&
      canReuseEmittedModule(existing, resolvedSourceModule.sourceStamp, importUrls)
    ) {
      return toModuleCompileResult(resolvedSourceModule, existing)
    }

    let rewriteResult = await rewriteImports(resolvedSourceModule)
    let finalCode = rewriteResult.code
    if (rewriteResult.sourcemap) {
      if (options.sourceMaps === 'inline') {
        let encoded = Buffer.from(rewriteResult.sourcemap).toString('base64')
        finalCode += `\n//# sourceMappingURL=data:application/json;base64,${encoded}`
      } else if (options.sourceMaps === 'external') {
        let mapPath = options.isEntryPoint(resolvedSourceModule.identityPath)
          ? `${resolvedSourceModule.stableUrlPathname}.map`
          : options.fingerprintInternalModules
            ? `${resolvedSourceModule.stableUrlPathname}.@${resolvedSourceModule.fingerprint}.map`
            : `${resolvedSourceModule.stableUrlPathname}.map`
        finalCode += `\n//# sourceMappingURL=${mapPath}`
      }
    }

    let emittedModule: EmittedModule = {
      compiledCode: finalCode,
      compiledHash: await hashContent(finalCode),
      importUrls,
      sourceStamp: resolvedSourceModule.sourceStamp,
      sourcemap: rewriteResult.sourcemap,
      sourcemapHash: rewriteResult.sourcemap ? await hashContent(rewriteResult.sourcemap) : null,
    }

    cacheEmittedModule(resolvedSourceModule.identityPath, emittedModule)
    if (buildIsImmutable) {
      await writeEmittedModule(
        await getEmittedModuleKey(resolvedSourceModule.identityPath),
        emittedModule,
      )
    }
    return toModuleCompileResult(resolvedSourceModule, emittedModule)
  }

  async function rewriteImports(
    resolvedModule: ResolvedModule,
  ): Promise<{ code: string; sourcemap: string | null }> {
    let rewrittenSource = new MagicString(resolvedModule.rawCode)

    for (let imported of resolvedModule.imports) {
      let url = await getServedUrl(imported.depPath)
      rewrittenSource.overwrite(
        imported.start,
        imported.end,
        imported.quote ? `${imported.quote}${url}${imported.quote}` : url,
      )
    }

    let code = rewrittenSource.toString()
    let sourcemap =
      resolvedModule.sourcemap && resolvedModule.imports.length > 0
        ? composeSourceMaps(
            rewrittenSource.generateMap({ hires: true }).toString(),
            resolvedModule.sourcemap,
          )
        : resolvedModule.sourcemap

    return { code, sourcemap }
  }

  async function getServedUrl(identityPath: string): Promise<string> {
    let resolvedModule = await getResolvedModuleByIdentity(identityPath)
    return getServedUrlForResolvedModule(resolvedModule)
  }

  function getServedUrlForResolvedModule(resolvedModule: ResolvedModule): string {
    if (options.isEntryPoint(resolvedModule.identityPath) || !options.fingerprintInternalModules) {
      return resolvedModule.stableUrlPathname
    }
    return `${resolvedModule.stableUrlPathname}.@${resolvedModule.fingerprint}`
  }

  async function getResolvedModuleByIdentity(
    identityPath: string,
    resolvedPath?: string,
  ): Promise<ResolvedModule> {
    let existing = resolvedModulesInFlight.get(identityPath)
    if (existing) return existing

    let promise = (async () => {
      let transformedModule = await getTransformedModule(identityPath, resolvedPath)
      return resolveTransformedModule(transformedModule)
    })()
    resolvedModulesInFlight.set(identityPath, promise)

    try {
      return await promise
    } finally {
      resolvedModulesInFlight.delete(identityPath)
    }
  }

  async function getTransformedModule(
    identityPath: string,
    resolvedPath?: string,
  ): Promise<ResolvedModule | TransformedModule> {
    let cachedModule = transformedModules.get(identityPath)
    if (buildIsImmutable) {
      let cached = resolvedModules.get(identityPath)
      if (cached) {
        return cached
      }

      let cacheKey = await getResolvedModuleKey(identityPath)
      let stored = await readResolvedModule(cacheKey)
      if (stored) {
        return cacheResolvedModule({
          deps: stored.deps,
          fingerprint: stored.fingerprint,
          identityPath,
          imports: stored.imports,
          rawCode: stored.rawCode,
          resolvedPath: stored.resolvedPath,
          sourceStamp: stored.sourceStamp,
          sourcemap: stored.sourcemap,
          stableUrlPathname: stored.stableUrlPathname,
        })
      }
    }

    let nextResolvedPath =
      resolvedPath ?? resolvedPathsByIdentity.get(identityPath) ?? resolveActualPath(identityPath)
    if (!nextResolvedPath) {
      throw createScriptServerCompilationError(`Module not found: ${identityPath}`, {
        code: 'MODULE_NOT_FOUND',
      })
    }

    let stat
    try {
      stat = await fsp.stat(nextResolvedPath)
    } catch (error) {
      if (isNoEntityError(error)) {
        throw createScriptServerCompilationError(`Module not found: ${nextResolvedPath}`, {
          cause: error,
          code: 'MODULE_NOT_FOUND',
        })
      }
      throw error
    }

    let sourceStamp = `${stat.size}:${stat.mtimeMs}`
    if (
      cachedModule &&
      cachedModule.sourceStamp === sourceStamp &&
      cachedModule.resolvedPath === nextResolvedPath
    ) {
      return cachedModule
    }

    let transformOptions = getTsconfigTransformOptions(nextResolvedPath)
    let sourceText: string
    try {
      sourceText = await fsp.readFile(nextResolvedPath, 'utf-8')
    } catch (error) {
      if (isNoEntityError(error)) {
        throw createScriptServerCompilationError(`Module not found: ${nextResolvedPath}`, {
          cause: error,
          code: 'MODULE_NOT_FOUND',
        })
      }
      throw error
    }

    let mayContainCommonJS = mayContainCommonJSModuleGlobals(sourceText)
    let analysis = await analyzeModuleSource(sourceText, nextResolvedPath, transformOptions, {
      minify: options.minify,
      sourceMaps: options.sourceMaps,
    })
    analysis.unresolvedImports = analysis.unresolvedImports.filter(
      (unresolved) => !options.external.includes(unresolved.specifier),
    )

    if (mayContainCommonJS && isCommonJS(analysis.rawCode)) {
      throw createScriptServerCompilationError(
        `CommonJS module detected: ${nextResolvedPath}\n\n` +
          `This module uses CommonJS (require/module.exports) which is not supported.\n` +
          `Please use an ESM-compatible module.`,
        {
          code: 'MODULE_COMMONJS_NOT_SUPPORTED',
        },
      )
    }

    let stableUrlPathname = options.routes.toUrlPathname(identityPath)
    if (!stableUrlPathname) {
      throw createScriptServerCompilationError(
        `Module ${identityPath} is outside all configured routes.`,
        {
          code: 'MODULE_OUTSIDE_ROUTES',
        },
      )
    }
    let sourcemap = analysis.sourcemap
      ? rewriteSourceMap(analysis.sourcemap, nextResolvedPath, stableUrlPathname)
      : null

    return cacheTransformedModule({
      fingerprint: await hashContent(sourceText + '\0' + (options.buildId ?? '')),
      identityPath,
      importerDir: path.dirname(nextResolvedPath),
      rawCode: analysis.rawCode,
      resolvedPath: nextResolvedPath,
      sourceStamp,
      sourcemap,
      stableUrlPathname,
      unresolvedImports: analysis.unresolvedImports,
    })
  }

  async function resolveTransformedModule(
    transformedModule: ResolvedModule | TransformedModule,
  ): Promise<ResolvedModule> {
    if (isResolvedModule(transformedModule)) return transformedModule

    let resolvedImports =
      transformedModule.unresolvedImports.length > 0
        ? await batchResolveSpecifiers(
            getUniqueSpecifiers(transformedModule.unresolvedImports),
            transformedModule.importerDir,
          )
        : new Map<string, string>()
    return buildResolvedModule(transformedModule, resolvedImports)
  }

  async function resolveTransformedModules(
    transformedModules: Array<ResolvedModule | TransformedModule>,
  ): Promise<ResolvedModule[]> {
    let groupedSpecifiers = new Map<string, Set<string>>()

    for (let transformedModule of transformedModules) {
      if (isResolvedModule(transformedModule) || transformedModule.unresolvedImports.length === 0) {
        continue
      }

      let existing = groupedSpecifiers.get(transformedModule.importerDir) ?? new Set<string>()
      for (let specifier of getUniqueSpecifiers(transformedModule.unresolvedImports)) {
        existing.add(specifier)
      }
      groupedSpecifiers.set(transformedModule.importerDir, existing)
    }

    let resolvedByDirectory = new Map<string, Map<string, string>>()
    await mapWithConcurrency(
      [...groupedSpecifiers.entries()],
      preloadTraversalConcurrency,
      async ([importerDir, specifiers]) => {
        resolvedByDirectory.set(
          importerDir,
          await batchResolveSpecifiers([...specifiers], importerDir),
        )
      },
    )

    return Promise.all(
      transformedModules.map((transformedModule) => {
        if (isResolvedModule(transformedModule)) return transformedModule
        return buildResolvedModule(
          transformedModule,
          resolvedByDirectory.get(transformedModule.importerDir) ?? new Map<string, string>(),
        )
      }),
    )
  }

  async function buildResolvedModule(
    transformedModule: TransformedModule,
    resolvedImports: Map<string, string>,
  ): Promise<ResolvedModule> {
    let importsWithPaths: ResolvedImport[] = []
    let deps = new Set<string>()

    for (let unresolved of transformedModule.unresolvedImports) {
      let resolvedImportPath = resolvedImports.get(unresolved.specifier)
      if (!resolvedImportPath) {
        throw createScriptServerCompilationError(
          `Failed to resolve import "${unresolved.specifier}" in ${transformedModule.resolvedPath}.\n\n` +
            `Ensure it resolves to a file within the configured script-server routes, or mark it as external.`,
          {
            code: 'IMPORT_RESOLUTION_FAILED',
          },
        )
      }

      let resolvedImport = resolveModulePath(resolvedImportPath)
      if (!resolvedImport) {
        throw createScriptServerCompilationError(
          `Resolved import "${unresolved.specifier}" in ${transformedModule.resolvedPath} is not a supported script module.\n\n` +
            `Supported extensions are ${supportedScriptExtensions.join(', ')}.`,
          {
            code: 'IMPORT_NOT_SUPPORTED',
          },
        )
      }
      if (!options.isAllowed(resolvedImport.identityPath)) {
        throw createScriptServerCompilationError(
          `Resolved import "${unresolved.specifier}" in ${transformedModule.resolvedPath} points outside the script-server routing/allow configuration.\n\n` +
            `Add a matching route and allow rule, or mark this import as external.`,
          {
            code: 'IMPORT_NOT_ALLOWED',
          },
        )
      }

      let stableUrlPathname = options.routes.toUrlPathname(resolvedImport.identityPath)
      if (!stableUrlPathname) {
        throw createScriptServerCompilationError(
          `Resolved import "${unresolved.specifier}" in ${transformedModule.resolvedPath} points outside the script-server routing/allow configuration.\n\n` +
            `Add a matching route and allow rule, or mark this import as external.`,
          {
            code: 'IMPORT_NOT_ALLOWED',
          },
        )
      }

      deps.add(resolvedImport.identityPath)
      importsWithPaths.push({
        depPath: resolvedImport.identityPath,
        end: unresolved.end,
        quote: unresolved.quote,
        start: unresolved.start,
      })
    }

    let resolvedModule: ResolvedModule = {
      deps: [...deps],
      fingerprint: transformedModule.fingerprint,
      identityPath: transformedModule.identityPath,
      imports: importsWithPaths,
      rawCode: transformedModule.rawCode,
      resolvedPath: transformedModule.resolvedPath,
      sourceStamp: transformedModule.sourceStamp,
      sourcemap: transformedModule.sourcemap,
      stableUrlPathname: transformedModule.stableUrlPathname,
    }

    if (buildIsImmutable) {
      cacheResolvedModule(resolvedModule)
      await writeResolvedModule(resolvedModule)
    }
    return resolvedModule
  }

  function cacheEmittedModule(identityPath: string, emittedModule: EmittedModule): EmittedModule {
    emittedModules.set(identityPath, emittedModule)
    return emittedModule
  }

  function canReuseEmittedModule(
    emittedModule: EmittedModule,
    sourceStamp: string,
    importUrls: string[],
  ): boolean {
    return (
      emittedModule.sourceStamp === sourceStamp &&
      arraysEqual(emittedModule.importUrls, importUrls)
    )
  }

  function cacheTransformedModule(transformedModule: TransformedModule): TransformedModule {
    resolvedPathsByIdentity.set(transformedModule.identityPath, transformedModule.resolvedPath)
    transformedModules.set(transformedModule.identityPath, transformedModule)
    return transformedModule
  }

  function cacheResolvedModule(resolvedModule: ResolvedModule): ResolvedModule {
    resolvedPathsByIdentity.set(resolvedModule.identityPath, resolvedModule.resolvedPath)
    resolvedModules.set(resolvedModule.identityPath, resolvedModule)
    return resolvedModule
  }

  function isResolvedModule(value: ResolvedModule | TransformedModule): value is ResolvedModule {
    return 'deps' in value
  }

  function rewriteSourceMap(
    sourcemap: string,
    resolvedPath: string,
    stableUrlPathname: string,
  ): string {
    let json = JSON.parse(sourcemap) as { sources?: string[] }
    json.sources = [
      options.sourceMapSourcePaths === 'absolute'
        ? normalizeFilePath(resolvedPath)
        : stableUrlPathname,
    ]
    return JSON.stringify(json)
  }

  async function getEmittedModuleKey(identityPath: string): Promise<string> {
    return `emitted-modules/${cacheNamespace}/${await hashContent(identityPath)}.json`
  }

  async function getResolvedModuleKey(identityPath: string): Promise<string> {
    return `resolved-modules/${cacheNamespace}/${await hashContent(identityPath)}.json`
  }

  async function readEmittedModule(key: string): Promise<EmittedModule | null> {
    let file = await fileStorage.get(key)
    if (!file) return null
    return JSON.parse(await file.text()) as EmittedModule
  }

  async function readResolvedModule(key: string): Promise<CachedResolvedModule | null> {
    let file = await fileStorage.get(key)
    if (!file) return null
    return JSON.parse(await file.text()) as CachedResolvedModule
  }

  async function writeEmittedModule(key: string, emittedModule: EmittedModule): Promise<void> {
    await fileStorage.set(
      key,
      new File([JSON.stringify(emittedModule)], 'served-module.json', {
        type: 'application/json',
      }),
    )
  }

  async function writeResolvedModule(resolvedModule: ResolvedModule): Promise<void> {
    let key = await getResolvedModuleKey(resolvedModule.identityPath)
    let cachedResolvedModule: CachedResolvedModule = {
      deps: resolvedModule.deps,
      fingerprint: resolvedModule.fingerprint,
      imports: resolvedModule.imports,
      rawCode: resolvedModule.rawCode,
      resolvedPath: resolvedModule.resolvedPath,
      sourceStamp: resolvedModule.sourceStamp,
      sourcemap: resolvedModule.sourcemap,
      stableUrlPathname: resolvedModule.stableUrlPathname,
    }

    await fileStorage.set(
      key,
      new File([JSON.stringify(cachedResolvedModule)], 'resolved-module.json', {
        type: 'application/json',
      }),
    )
  }

  function toModuleCompileResult(
    resolvedModule: ResolvedModule,
    emittedModule: EmittedModule,
  ): ModuleCompileResult {
    return {
      compiledCode: emittedModule.compiledCode,
      compiledHash: emittedModule.compiledHash,
      fingerprint: resolvedModule.fingerprint,
      sourcemap: emittedModule.sourcemap,
      sourcemapHash: emittedModule.sourcemapHash,
    }
  }

  function resolveEntryFromUrl(entryUrl: string): ResolveModuleResult | null {
    let pathname = entryUrl
    try {
      pathname = new URL(entryUrl).pathname
    } catch {
      pathname = entryUrl
    }

    let resolvedPath = options.routes.resolveUrlPathname(pathname)
    if (!resolvedPath) return null
    return resolveModulePath(resolvedPath)
  }
}

function resolveModulePath(absolutePath: string): ResolveModuleResult | null {
  let resolvedPath: string

  try {
    resolvedPath = fs.realpathSync(normalizeFilePath(absolutePath))
  } catch (error) {
    if (isNoEntityError(error)) return null
    throw error
  }

  if (!isSupportedScriptPath(resolvedPath)) {
    return null
  }

  return {
    identityPath: normalizeFilePath(resolvedPath),
    resolvedPath,
  }
}

function resolveActualPath(identityPath: string): string | null {
  try {
    return fs.realpathSync(identityPath)
  } catch (error) {
    if (isNoEntityError(error)) return null
    throw error
  }
}

function isSupportedScriptPath(filePath: string): boolean {
  return supportedScriptExtensionSet.has(path.extname(filePath).toLowerCase())
}

function composeSourceMaps(rewriteSourceMap: string, transformSourceMap: string): string {
  let rewriteConsumer = new SourceMapConsumer(JSON.parse(rewriteSourceMap))
  let transformConsumer = new SourceMapConsumer(JSON.parse(transformSourceMap))
  let generator = new SourceMapGenerator()

  rewriteConsumer.eachMapping((mapping) => {
    if (
      mapping.originalLine == null ||
      mapping.originalColumn == null ||
      mapping.generatedLine == null ||
      mapping.generatedColumn == null
    ) {
      return
    }

    let original = transformConsumer.originalPositionFor({
      line: mapping.originalLine,
      column: mapping.originalColumn,
    })
    if (original.line == null || original.column == null || original.source == null) return

    generator.addMapping({
      generated: {
        line: mapping.generatedLine,
        column: mapping.generatedColumn,
      },
      original: {
        line: original.line,
        column: original.column,
      },
      source: original.source,
      name: original.name ?? mapping.name ?? undefined,
    })
  })

  for (let source of transformConsumer.sources) {
    let sourceContent = transformConsumer.sourceContentFor(source, true)
    if (sourceContent !== null) {
      generator.setSourceContent(source, sourceContent)
    }
  }

  return JSON.stringify(generator.toJSON())
}

type ModuleAnalysisResult = {
  rawCode: string
  sourcemap: string | null
  unresolvedImports: UnresolvedImport[]
}

type TsconfigTransformOptions = {
  tsconfigRaw?: TsConfigJsonResolved
}

async function hashContent(content: string): Promise<string> {
  let encoder = new TextEncoder()
  let data = encoder.encode(content)
  let hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Buffer.from(hashBuffer).toString('base64url').slice(0, 6)
}

function createTsconfigTransformOptionsResolver() {
  let fileSystemCache: Cache = new Map()
  let transformOptionsByDirectory = new Map<string, TsconfigTransformOptions>()

  return function getTsconfigTransformOptions(filePath: string): TsconfigTransformOptions {
    let directory = path.dirname(filePath)
    let cached = transformOptionsByDirectory.get(directory)
    if (cached) return cached

    let tsconfig = getTsconfig(directory, 'tsconfig.json', fileSystemCache)
    if (!tsconfig) {
      let transformOptions = {}
      transformOptionsByDirectory.set(directory, transformOptions)
      return transformOptions
    }

    let transformOptions: TsconfigTransformOptions = {
      tsconfigRaw: tsconfig.config,
    }

    transformOptionsByDirectory.set(directory, transformOptions)
    return transformOptions
  }
}

function arraysEqual<item>(first: item[] | undefined, second: item[]): boolean {
  if (first === undefined || first.length !== second.length) return false

  for (let index = 0; index < first.length; ++index) {
    if (first[index] !== second[index]) return false
  }

  return true
}

async function analyzeModuleSource(
  sourceText: string,
  resolvedPath: string,
  transformOptions: TsconfigTransformOptions,
  options: { minify: boolean; sourceMaps?: 'external' | 'inline' },
): Promise<ModuleAnalysisResult> {
  let transformResult: esbuild.TransformResult
  try {
    transformResult = await esbuild.transform(sourceText, {
      format: 'esm',
      loader: transformLoaderByExtension.get(path.extname(resolvedPath).toLowerCase()) ?? 'js',
      logLevel: 'silent',
      minify: options.minify,
      sourcefile: resolvedPath,
      sourcemap: options.sourceMaps ? 'external' : false,
      tsconfigRaw: transformOptions.tsconfigRaw,
    })
  } catch (error) {
    throw createScriptServerCompilationError(
      `Failed to transform module ${resolvedPath}.\n\n${formatUnknownError(error)}`,
      {
        cause: error,
        code: 'MODULE_TRANSFORM_FAILED',
      },
    )
  }

  let rawCode = transformResult.code.replace(/^\/\/# sourceMappingURL=.+$/m, '').trimEnd()
  let sourcemap = transformResult.map ?? null
  await lexerReady
  let unresolvedImports = getUnresolvedImportsFromCode(rawCode)

  return {
    rawCode,
    sourcemap,
    unresolvedImports,
  }
}

async function batchResolveSpecifiers(
  specifiers: string[],
  importerDir: string,
): Promise<Map<string, string>> {
  let resolvedPathsBySpecifier = new Map<string, string>()
  if (specifiers.length === 0) return resolvedPathsBySpecifier

  let resolvedSpecs = await resolveWithEsbuild(specifiers, importerDir)
  for (let resolvedSpec of resolvedSpecs) {
    if (resolvedSpec.absolutePath) {
      resolvedPathsBySpecifier.set(
        resolvedSpec.specifier,
        normalizeFilePath(resolvedSpec.absolutePath),
      )
    }
  }

  return resolvedPathsBySpecifier
}

type ResolvedSpec = {
  absolutePath: string | null
  specifier: string
}

function getPreloadTraversalConcurrency(): number {
  let override = process.env.SCRIPT_SERVER_PRELOAD_CONCURRENCY
  if (override !== undefined) {
    let parsed = Number.parseInt(override, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return Math.max(1, Math.min(8, os.availableParallelism() - 1))
}

function getUniqueSpecifiers(unresolvedImports: UnresolvedImport[]): string[] {
  return [...new Set(unresolvedImports.map((unresolved) => unresolved.specifier))]
}

type ParsedImportRecord = ReturnType<typeof parseImports>[0][number]

function getUnresolvedImportsFromCode(rawCode: string): UnresolvedImport[] {
  let [imports] = parseImports(rawCode)
  let unresolvedImports: UnresolvedImport[] = []

  for (let imported of imports) {
    let specifier = getStaticImportSpecifier(rawCode, imported)
    if (specifier == null) continue
    if (
      specifier.startsWith('data:') ||
      specifier.startsWith('http://') ||
      specifier.startsWith('https://')
    ) {
      continue
    }
    unresolvedImports.push({
      specifier,
      start: imported.s,
      end: imported.e,
      quote: getImportQuote(rawCode, imported.s),
    })
  }

  return unresolvedImports
}

function getStaticImportSpecifier(source: string, imported: ParsedImportRecord): string | null {
  if (imported.n != null) {
    return imported.n
  }

  if (imported.d < 0) {
    return null
  }

  let rawSpecifier = source.slice(imported.s, imported.e)
  if (!isStaticTemplateLiteral(rawSpecifier)) {
    return null
  }

  return rawSpecifier.slice(1, -1)
}

function isStaticTemplateLiteral(specifier: string): boolean {
  return specifier.startsWith('`') && specifier.endsWith('`') && !specifier.includes('${')
}

function getImportQuote(source: string, start: number): '"' | "'" | '`' | undefined {
  let firstCharacter = source[start]
  if (firstCharacter === '"' || firstCharacter === "'" || firstCharacter === '`') {
    return firstCharacter
  }
  return undefined
}

async function mapWithConcurrency<item, result>(
  items: item[],
  concurrency: number,
  mapper: (item: item, index: number) => Promise<result>,
): Promise<result[]> {
  if (items.length === 0) return []

  let results = new Array<result>(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      let index = nextIndex++
      results[index] = await mapper(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return results
}

async function resolveWithEsbuild(
  specifiers: string[],
  importerDir: string,
): Promise<ResolvedSpec[]> {
  let resolvedSpecs: ResolvedSpec[] = []

  try {
    await esbuild.build({
      stdin: { contents: '', loader: 'js', resolveDir: importerDir },
      write: false,
      bundle: true,
      platform: 'browser',
      format: 'esm',
      logLevel: 'silent',
      plugins: [
        {
          name: 'batch-resolver',
          setup(build) {
            build.onStart(async () => {
              let resolutionResults = await Promise.all(
                specifiers.map((specifier) =>
                  build.resolve(specifier, {
                    kind: 'import-statement',
                    resolveDir: importerDir,
                  }),
                ),
              )

              for (let index = 0; index < specifiers.length; index++) {
                let resolutionResult = resolutionResults[index]
                if (resolutionResult?.errors.length) {
                  throw createScriptServerCompilationError(
                    `Failed to resolve import "${specifiers[index]}" in ${importerDir}.\n\n` +
                      `Ensure it resolves to a file within the configured script-server routes, or mark it as external.`,
                    {
                      code: 'IMPORT_RESOLUTION_FAILED',
                    },
                  )
                }

                let absolutePath =
                  resolutionResult &&
                  !resolutionResult.external &&
                  resolutionResult.path &&
                  path.isAbsolute(resolutionResult.path)
                    ? resolutionResult.path
                    : null

                resolvedSpecs.push({ absolutePath, specifier: specifiers[index] })
              }
            })

            build.onResolve({ filter: /.*/ }, (args) => {
              if (args.importer) return { external: true }
              return undefined
            })
          },
        },
      ],
    })
  } catch (error) {
    if (isScriptServerCompilationError(error) && error.code === 'IMPORT_RESOLUTION_FAILED') {
      throw error
    }

    throw createScriptServerCompilationError(
      `Failed to resolve imports in ${importerDir}.\n\n${formatUnknownError(error)}`,
      {
        cause: error,
        code: 'IMPORT_RESOLUTION_FAILED',
      },
    )
  }

  return resolvedSpecs
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isNoEntityError(error: unknown): error is NodeJS.ErrnoException & { code: 'ENOENT' } {
  return (
    error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
  )
}

export function createResponseForModule(
  result: ModuleCompileResult,
  options: {
    cacheControl: string
    ifNoneMatch: string | null
    isSourceMapRequest: boolean
    method: string
  },
): Response {
  let body: string | null
  let etag: string
  let contentType: string

  if (options.isSourceMapRequest) {
    if (!result.sourcemap) {
      return new Response('Not found', { status: 404 })
    }
    body = options.method === 'HEAD' ? null : result.sourcemap
    etag = `W/"${result.sourcemapHash ?? result.compiledHash}"`
    contentType = 'application/json; charset=utf-8'
  } else {
    body = options.method === 'HEAD' ? null : result.compiledCode
    etag = `W/"${result.compiledHash}"`
    contentType = 'application/javascript; charset=utf-8'
  }

  if (IfNoneMatch.from(options.ifNoneMatch).matches(etag)) {
    return new Response(null, { status: 304, headers: { ETag: etag } })
  }

  return new Response(body, {
    headers: {
      'Cache-Control': options.cacheControl,
      'Content-Type': contentType,
      ETag: etag,
    },
  })
}
