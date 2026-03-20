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
import { normalizeFilePath } from './routes.ts'
import type { CompiledRoutes } from './routes.ts'

let lexerReady = lexerInit
let preloadTraversalConcurrency = getPreloadTraversalConcurrency()

export type ModuleCompileResult = {
  compiledCode: string
  compiledHash: string
  fingerprint: string
  sourcemap: string | null
  sourcemapHash: string | null
}

type AnalyzedModule = {
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

type PendingAnalyzedModule = {
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

type ServedModule = {
  compiledCode: string
  compiledHash: string
  directImportHash: string
  sourceStamp: string
  sourcemap: string | null
  sourcemapHash: string | null
}

type CachedAnalyzedModule = {
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
  let analyzedModules = new Map<string, AnalyzedModule>()
  let analyzedModulesInFlight = new Map<string, Promise<AnalyzedModule>>()
  let servedModules = new Map<string, ServedModule>()
  let compileInFlight = new Map<string, Promise<ModuleCompileResult>>()
  let resolvedPathsByIdentity = new Map<string, string>()
  let cacheNamespace = options.buildId === undefined ? 'live' : encodeURIComponent(options.buildId)
  let fileStorage = options.fileStorage ?? createMemoryFileStorage()
  let buildIsImmutable = options.buildId !== undefined
  let getTsconfigTransformOptions = createTsconfigTransformOptionsResolver()

  return {
    async compileModule(absolutePath) {
      let resolved = resolveModulePath(absolutePath)
      if (!resolved) {
        throw Object.assign(new Error(`Module not found: ${absolutePath}`), { code: 'ENOENT' })
      }

      if (!options.isAllowed(resolved.identityPath)) {
        throw Object.assign(new Error(`Module is not allowed: ${resolved.identityPath}`), {
          code: 'ENOENT',
        })
      }

      let existing = compileInFlight.get(resolved.identityPath)
      if (existing) return existing

      let promise = compileModuleResolved(resolved)
      compileInFlight.set(resolved.identityPath, promise)

      try {
        return await promise
      } finally {
        compileInFlight.delete(resolved.identityPath)
      }
    },
    async getPreloadUrls(moduleUrl) {
      let resolved = resolveEntryFromUrl(moduleUrl)
      if (!resolved) {
        throw new Error(`Module "${moduleUrl}" is outside all configured routes.`)
      }

      let visited = new Set([resolved.identityPath])
      let queue = [resolved.identityPath]
      let urls: string[] = []

      while (queue.length > 0) {
        let frontier = queue
        queue = []
        let preparedRecords = await mapWithConcurrency(
          frontier,
          preloadTraversalConcurrency,
          (identityPath) => prepareAnalyzedModule(identityPath),
        )
        let records = await finalizePreparedAnalyzedModules(preparedRecords)

        for (let analyzedModule of records) {
          urls.push(getServedUrlFromAnalyzedModule(analyzedModule))

          for (let dep of analyzedModule.deps) {
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

  async function compileModuleResolved(
    resolved: ResolveModuleResult,
  ): Promise<ModuleCompileResult> {
    let analyzedModule = await getAnalyzedModuleByIdentity(
      resolved.identityPath,
      resolved.resolvedPath,
    )
    let cacheKey = await getServedModuleKey(analyzedModule.identityPath)
    let existing = servedModules.get(analyzedModule.identityPath)
    if (buildIsImmutable) {
      if (existing) {
        return toModuleCompileResult(analyzedModule, existing)
      }

      let stored = await readServedModule(cacheKey)
      if (stored) {
        return toModuleCompileResult(
          analyzedModule,
          cacheServedModule(analyzedModule.identityPath, stored),
        )
      }
    }

    let directImportUrls = await Promise.all(
      analyzedModule.deps.map((depPath) => getServedUrl(depPath)),
    )
    let directImportHash = await hashContent(JSON.stringify(directImportUrls))
    if (existing && canReuseServedModule(existing, analyzedModule, directImportHash)) {
      return toModuleCompileResult(analyzedModule, existing)
    }

    let stored = await readServedModule(cacheKey)
    if (stored && canReuseServedModule(stored, analyzedModule, directImportHash)) {
      return toModuleCompileResult(
        analyzedModule,
        cacheServedModule(analyzedModule.identityPath, stored),
      )
    }

    let rewriteResult = await rewriteImports(analyzedModule)
    let finalCode = rewriteResult.code
    if (rewriteResult.sourcemap) {
      if (options.sourceMaps === 'inline') {
        let encoded = Buffer.from(rewriteResult.sourcemap).toString('base64')
        finalCode += `\n//# sourceMappingURL=data:application/json;base64,${encoded}`
      } else if (options.sourceMaps === 'external') {
        let mapPath = options.isEntryPoint(analyzedModule.identityPath)
          ? `${analyzedModule.stableUrlPathname}.map`
          : options.fingerprintInternalModules
            ? `${analyzedModule.stableUrlPathname}.@${analyzedModule.fingerprint}.map`
            : `${analyzedModule.stableUrlPathname}.map`
        finalCode += `\n//# sourceMappingURL=${mapPath}`
      }
    }

    let servedModule: ServedModule = {
      compiledCode: finalCode,
      compiledHash: await hashContent(finalCode),
      directImportHash,
      sourceStamp: analyzedModule.sourceStamp,
      sourcemap: rewriteResult.sourcemap,
      sourcemapHash: rewriteResult.sourcemap ? await hashContent(rewriteResult.sourcemap) : null,
    }

    cacheServedModule(analyzedModule.identityPath, servedModule)
    await writeServedModule(cacheKey, servedModule)
    return toModuleCompileResult(analyzedModule, servedModule)
  }

  async function rewriteImports(
    analyzedModule: AnalyzedModule,
  ): Promise<{ code: string; sourcemap: string | null }> {
    let output = new MagicString(analyzedModule.rawCode)

    for (let imported of analyzedModule.imports) {
      let url = await getServedUrl(imported.depPath)
      output.overwrite(
        imported.start,
        imported.end,
        imported.quote ? `${imported.quote}${url}${imported.quote}` : url,
      )
    }

    let code = output.toString()
    let sourcemap =
      analyzedModule.sourcemap && analyzedModule.imports.length > 0
        ? composeSourceMaps(
            output.generateMap({ hires: true }).toString(),
            analyzedModule.sourcemap,
          )
        : analyzedModule.sourcemap

    return { code, sourcemap }
  }

  async function getServedUrl(identityPath: string): Promise<string> {
    let analyzedModule = await getAnalyzedModuleByIdentity(identityPath)
    return getServedUrlFromAnalyzedModule(analyzedModule)
  }

  function getServedUrlFromAnalyzedModule(analyzedModule: AnalyzedModule): string {
    if (options.isEntryPoint(analyzedModule.identityPath) || !options.fingerprintInternalModules) {
      return analyzedModule.stableUrlPathname
    }
    return `${analyzedModule.stableUrlPathname}.@${analyzedModule.fingerprint}`
  }

  async function getAnalyzedModuleFromPath(absolutePath: string): Promise<AnalyzedModule> {
    let resolved = resolveModulePath(absolutePath)
    if (!resolved) {
      throw Object.assign(new Error(`Module not found: ${absolutePath}`), { code: 'ENOENT' })
    }
    return getAnalyzedModuleByIdentity(resolved.identityPath, resolved.resolvedPath)
  }

  async function getAnalyzedModuleByIdentity(
    identityPath: string,
    resolvedPath?: string,
  ): Promise<AnalyzedModule> {
    let existing = analyzedModulesInFlight.get(identityPath)
    if (existing) return existing

    let promise = loadAnalyzedModule(identityPath, resolvedPath)
    analyzedModulesInFlight.set(identityPath, promise)

    try {
      return await promise
    } finally {
      analyzedModulesInFlight.delete(identityPath)
    }
  }

  async function loadAnalyzedModule(
    identityPath: string,
    resolvedPath?: string,
  ): Promise<AnalyzedModule> {
    let prepared = await prepareAnalyzedModule(identityPath, resolvedPath)
    return finalizePreparedAnalyzedModule(prepared)
  }

  async function prepareAnalyzedModule(
    identityPath: string,
    resolvedPath?: string,
  ): Promise<AnalyzedModule | PendingAnalyzedModule> {
    let cached = analyzedModules.get(identityPath)
    let cacheKey = await getAnalyzedModuleKey(identityPath)
    if (buildIsImmutable) {
      if (cached) {
        return cached
      }

      let stored = await readAnalyzedModule(cacheKey)
      if (stored) {
        return cacheAnalyzedModule(toAnalyzedModule(identityPath, stored))
      }
    }

    let nextResolvedPath =
      resolvedPath ?? resolvedPathsByIdentity.get(identityPath) ?? resolveActualPath(identityPath)
    if (!nextResolvedPath) {
      throw Object.assign(new Error(`Module not found: ${identityPath}`), { code: 'ENOENT' })
    }

    let sourceStamp = sourceStampFromStat(await fsp.stat(nextResolvedPath))
    if (cached && canReuseAnalyzedModule(cached, sourceStamp, nextResolvedPath)) {
      return cached
    }

    let stored = await readAnalyzedModule(cacheKey)
    if (stored) {
      let analyzedModule = toAnalyzedModule(identityPath, stored)
      if (canReuseAnalyzedModule(analyzedModule, sourceStamp, nextResolvedPath)) {
        return cacheAnalyzedModule(analyzedModule)
      }
    }

    let transformOptions = getTsconfigTransformOptions(nextResolvedPath)
    let sourceText = await fsp.readFile(nextResolvedPath, 'utf-8')
    let mayContainCommonJS = mayContainCommonJSModuleGlobals(sourceText)
    let analysis = await analyzeModuleSource(sourceText, nextResolvedPath, transformOptions, {
      minify: options.minify,
      sourceMaps: options.sourceMaps,
    })
    analysis.unresolvedImports = analysis.unresolvedImports.filter(
      (unresolved) => !options.external.includes(unresolved.specifier),
    )

    if (mayContainCommonJS && isCommonJS(analysis.rawCode)) {
      throw new Error(
        `CommonJS module detected: ${nextResolvedPath}\n\n` +
          `This module uses CommonJS (require/module.exports) which is not supported.\n` +
          `Please use an ESM-compatible module.`,
      )
    }

    let stableUrlPathname = options.routes.toUrlPathname(identityPath)
    if (!stableUrlPathname) {
      throw new Error(`Module ${identityPath} is outside all configured routes.`)
    }
    let sourcemap = analysis.sourcemap
      ? rewriteSourceMap(analysis.sourcemap, nextResolvedPath, stableUrlPathname)
      : null

    return {
      fingerprint: await hashContent(sourceText + '\0' + (options.buildId ?? '')),
      identityPath,
      importerDir: path.dirname(nextResolvedPath),
      rawCode: analysis.rawCode,
      resolvedPath: nextResolvedPath,
      sourceStamp,
      sourcemap,
      stableUrlPathname,
      unresolvedImports: analysis.unresolvedImports,
    }
  }

  async function finalizePreparedAnalyzedModule(
    prepared: AnalyzedModule | PendingAnalyzedModule,
  ): Promise<AnalyzedModule> {
    if (isAnalyzedModule(prepared)) return prepared

    let resolvedImports =
      prepared.unresolvedImports.length > 0
        ? await batchResolveSpecifiers(
            getUniqueSpecifiers(prepared.unresolvedImports),
            prepared.importerDir,
          )
        : new Map<string, string>()
    return finalizeAnalyzedModule(prepared, resolvedImports)
  }

  async function finalizePreparedAnalyzedModules(
    preparedAnalyses: Array<AnalyzedModule | PendingAnalyzedModule>,
  ): Promise<AnalyzedModule[]> {
    let groupedSpecifiers = new Map<string, Set<string>>()

    for (let prepared of preparedAnalyses) {
      if (isAnalyzedModule(prepared) || prepared.unresolvedImports.length === 0) continue

      let existing = groupedSpecifiers.get(prepared.importerDir) ?? new Set<string>()
      for (let specifier of getUniqueSpecifiers(prepared.unresolvedImports)) {
        existing.add(specifier)
      }
      groupedSpecifiers.set(prepared.importerDir, existing)
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
      preparedAnalyses.map((prepared) => {
        if (isAnalyzedModule(prepared)) return prepared
        return finalizeAnalyzedModule(
          prepared,
          resolvedByDirectory.get(prepared.importerDir) ?? new Map<string, string>(),
        )
      }),
    )
  }

  async function finalizeAnalyzedModule(
    prepared: PendingAnalyzedModule,
    resolvedImports: Map<string, string>,
  ): Promise<AnalyzedModule> {
    let importsWithPaths: ResolvedImport[] = []
    let deps = new Set<string>()

    for (let unresolved of prepared.unresolvedImports) {
      let resolvedImportPath = resolvedImports.get(unresolved.specifier)
      if (!resolvedImportPath) {
        throw new Error(
          `Failed to resolve import "${unresolved.specifier}" in ${prepared.resolvedPath}.\n\n` +
            `Ensure it resolves to a file within the configured script-server routes, or mark it as external.`,
        )
      }

      let resolvedImport = resolveModulePath(resolvedImportPath)
      if (!resolvedImport) {
        throw new Error(
          `Resolved import "${unresolved.specifier}" in ${prepared.resolvedPath} is not a supported script module.\n\n` +
            `Supported extensions are .js, .jsx, .mjs, .mts, .ts, and .tsx.`,
        )
      }
      if (!options.isAllowed(resolvedImport.identityPath)) {
        throw new Error(
          `Resolved import "${unresolved.specifier}" in ${prepared.resolvedPath} points outside the script-server routing/allow configuration.\n\n` +
            `Add a matching route and allow rule, or mark this import as external.`,
        )
      }

      let stableUrlPathname = options.routes.toUrlPathname(resolvedImport.identityPath)
      if (!stableUrlPathname) {
        throw new Error(
          `Resolved import "${unresolved.specifier}" in ${prepared.resolvedPath} points outside the script-server routing/allow configuration.\n\n` +
            `Add a matching route and allow rule, or mark this import as external.`,
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

    let analyzedModule: AnalyzedModule = {
      deps: [...deps],
      fingerprint: prepared.fingerprint,
      identityPath: prepared.identityPath,
      imports: importsWithPaths,
      rawCode: prepared.rawCode,
      resolvedPath: prepared.resolvedPath,
      sourceStamp: prepared.sourceStamp,
      sourcemap: prepared.sourcemap,
      stableUrlPathname: prepared.stableUrlPathname,
    }

    cacheAnalyzedModule(analyzedModule)
    await writeAnalyzedModule(analyzedModule)
    return analyzedModule
  }

  function canReuseServedModule(
    servedModule: ServedModule,
    analyzedModule: AnalyzedModule,
    directImportHash: string,
  ): boolean {
    return (
      servedModule.sourceStamp === analyzedModule.sourceStamp &&
      servedModule.directImportHash === directImportHash
    )
  }

  function cacheServedModule(identityPath: string, servedModule: ServedModule): ServedModule {
    servedModules.set(identityPath, servedModule)
    return servedModule
  }

  function toAnalyzedModule(identityPath: string, stored: CachedAnalyzedModule): AnalyzedModule {
    return {
      deps: stored.deps,
      fingerprint: stored.fingerprint,
      identityPath,
      imports: stored.imports,
      rawCode: stored.rawCode,
      resolvedPath: stored.resolvedPath,
      sourceStamp: stored.sourceStamp,
      sourcemap: stored.sourcemap,
      stableUrlPathname: stored.stableUrlPathname,
    }
  }

  function cacheAnalyzedModule(analyzedModule: AnalyzedModule): AnalyzedModule {
    resolvedPathsByIdentity.set(analyzedModule.identityPath, analyzedModule.resolvedPath)
    analyzedModules.set(analyzedModule.identityPath, analyzedModule)
    return analyzedModule
  }

  function canReuseAnalyzedModule(
    analyzedModule: AnalyzedModule,
    sourceStamp: string,
    resolvedPath: string,
  ): boolean {
    return (
      analyzedModule.sourceStamp === sourceStamp && analyzedModule.resolvedPath === resolvedPath
    )
  }

  function isAnalyzedModule(
    value: AnalyzedModule | PendingAnalyzedModule,
  ): value is AnalyzedModule {
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
        ? stripWindowsDriveSlash(resolvedPath)
        : stableUrlPathname,
    ]
    return JSON.stringify(json)
  }

  async function getServedModuleKey(identityPath: string): Promise<string> {
    return `served-modules/${cacheNamespace}/${await hashContent(identityPath)}.json`
  }

  async function getAnalyzedModuleKey(identityPath: string): Promise<string> {
    return `analyzed-modules/${cacheNamespace}/${await hashContent(identityPath)}.json`
  }

  async function readServedModule(key: string): Promise<ServedModule | null> {
    let file = await fileStorage.get(key)
    if (!file) return null
    return JSON.parse(await file.text()) as ServedModule
  }

  async function readAnalyzedModule(key: string): Promise<CachedAnalyzedModule | null> {
    let file = await fileStorage.get(key)
    if (!file) return null
    return JSON.parse(await file.text()) as CachedAnalyzedModule
  }

  async function writeServedModule(key: string, servedModule: ServedModule): Promise<void> {
    await fileStorage.set(
      key,
      new File([JSON.stringify(servedModule)], 'compiled-asset.json', {
        type: 'application/json',
      }),
    )
  }

  async function writeAnalyzedModule(analyzedModule: AnalyzedModule): Promise<void> {
    let key = await getAnalyzedModuleKey(analyzedModule.identityPath)
    let cachedRecord: CachedAnalyzedModule = {
      deps: analyzedModule.deps,
      fingerprint: analyzedModule.fingerprint,
      imports: analyzedModule.imports,
      rawCode: analyzedModule.rawCode,
      resolvedPath: analyzedModule.resolvedPath,
      sourceStamp: analyzedModule.sourceStamp,
      sourcemap: analyzedModule.sourcemap,
      stableUrlPathname: analyzedModule.stableUrlPathname,
    }

    await fileStorage.set(
      key,
      new File([JSON.stringify(cachedRecord)], 'dependency-record.json', {
        type: 'application/json',
      }),
    )
  }

  function toModuleCompileResult(
    analyzedModule: AnalyzedModule,
    servedModule: ServedModule,
  ): ModuleCompileResult {
    return {
      compiledCode: servedModule.compiledCode,
      compiledHash: servedModule.compiledHash,
      fingerprint: analyzedModule.fingerprint,
      sourcemap: servedModule.sourcemap,
      sourcemapHash: servedModule.sourcemapHash,
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
    resolvedPath = fs.realpathSync(resolveFileSystemPath(absolutePath))
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
  let actualPath = resolveFileSystemPath(identityPath)
  try {
    return fs.realpathSync(actualPath)
  } catch (error) {
    if (isNoEntityError(error)) return null
    throw error
  }
}

function isSupportedScriptPath(filePath: string): boolean {
  switch (path.extname(filePath).toLowerCase()) {
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.mts':
    case '.ts':
    case '.tsx':
      return true
    default:
      return false
  }
}

function stripWindowsDriveSlash(filePath: string): string {
  return /^\/[A-Za-z]:\//.test(filePath) ? filePath.slice(1) : filePath
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

function resolveFileSystemPath(filePath: string): string {
  let normalizedInput = stripWindowsDriveSlash(filePath).replace(/\\/g, '/')
  if (/^[A-Za-z]:\//.test(normalizedInput)) {
    return normalizedInput
  }
  return path.resolve(normalizedInput)
}

function sourceStampFromStat(stat: { mtimeMs: number; size: number }): string {
  return `${stat.size}:${stat.mtimeMs}`
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
      let result = {}
      transformOptionsByDirectory.set(directory, result)
      return result
    }

    let result: TsconfigTransformOptions = {
      tsconfigRaw: tsconfig.config,
    }

    transformOptionsByDirectory.set(directory, result)
    return result
  }
}

async function analyzeModuleSource(
  sourceText: string,
  resolvedPath: string,
  transformOptions: TsconfigTransformOptions,
  options: { minify: boolean; sourceMaps?: 'external' | 'inline' },
): Promise<ModuleAnalysisResult> {
  let transformResult = await esbuild.transform(sourceText, {
    format: 'esm',
    loader: getTransformLoader(resolvedPath),
    logLevel: 'silent',
    minify: options.minify,
    sourcefile: resolvedPath,
    sourcemap: options.sourceMaps ? 'external' : false,
    tsconfigRaw: transformOptions.tsconfigRaw,
  })

  let rawCode = transformResult.code.replace(/^\/\/# sourceMappingURL=.+$/m, '').trimEnd()
  let sourcemap = transformResult.map ?? null
  await lexerReady
  let unresolvedImports = getUnresolvedImportsFromCode(rawCode, resolvedPath)

  return {
    rawCode,
    sourcemap,
    unresolvedImports,
  }
}

function getTransformLoader(resolvedPath: string): esbuild.Loader {
  switch (path.extname(resolvedPath).toLowerCase()) {
    case '.jsx':
      return 'jsx'
    case '.mjs':
      return 'js'
    case '.mts':
      return 'ts'
    case '.tsx':
      return 'tsx'
    case '.ts':
      return 'ts'
    default:
      return 'js'
  }
}

async function batchResolveSpecifiers(
  specifiers: string[],
  importerDir: string,
): Promise<Map<string, string>> {
  let results = new Map<string, string>()
  if (specifiers.length === 0) return results

  let resolved = await resolveWithEsbuild(specifiers, importerDir)
  for (let match of resolved) {
    if (match.absolutePath) {
      results.set(match.specifier, normalizeFilePath(match.absolutePath))
    }
  }

  return results
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

function getUnresolvedImportsFromCode(rawCode: string, resolvedPath: string): UnresolvedImport[] {
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
  let resolved: ResolvedSpec[] = []

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
            let results = await Promise.all(
              specifiers.map((specifier) =>
                build.resolve(specifier, {
                  kind: 'import-statement',
                  resolveDir: importerDir,
                }),
              ),
            )

            for (let index = 0; index < specifiers.length; index++) {
              let result = results[index]
              if (result?.errors.length) {
                throw new Error(
                  `Failed to resolve import "${specifiers[index]}" in ${importerDir}.\n\n` +
                    `Ensure it resolves to a file within the configured script-server routes, or mark it as external.`,
                )
              }

              let absolutePath =
                result && !result.external && result.path && path.isAbsolute(result.path)
                  ? result.path
                  : null

              resolved.push({ absolutePath, specifier: specifiers[index] })
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

  return resolved
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
