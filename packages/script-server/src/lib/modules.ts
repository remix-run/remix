import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as esbuild from 'esbuild'
import { createMemoryFileStorage } from '@remix-run/file-storage/memory'
import { init as lexerInit, parse as parseImports } from 'es-module-lexer'
import type { FileStorage } from '@remix-run/file-storage'
import MagicString from 'magic-string'

import { isCommonJS, mayContainCommonJSModuleGlobals } from './cjs-check.ts'
import { generateETag, matchesETag } from './etag.ts'
import { hashContent } from './hash.ts'
import type { CompiledRoutes } from './routes.ts'
import { getTsconfigTransformOptions, typescriptVersion } from './tsconfig.ts'

let lexerReady = lexerInit
let preloadTraversalConcurrency = getPreloadTraversalConcurrency()

export interface ModuleCompileResult {
  compiledCode: string
  compiledHash: string
  deps: string[]
  fingerprint: string
  sourcemap: string | null
  sourcemapHash: string | null
  stableUrlPathname: string
}

interface DependencyRecord {
  deps: string[]
  fingerprint: string
  identityPath: string
  imports: ResolvedImport[]
  rawCode: string
  resolvedPath: string
  sourceMapHash: string
  sourceStamp: string
  sourcemap: string | null
  stableUrlPathname: string
  transformConfigHash: string
}

interface PendingDependencyRecord {
  fingerprint: string
  identityPath: string
  importerDir: string
  rawCode: string
  resolvedPath: string
  sourceMapHash: string
  sourceStamp: string
  sourcemap: string | null
  stableUrlPathname: string
  transformConfigHash: string
  unresolvedImports: UnresolvedImport[]
}

interface CachedAssetRecord {
  compiledCode: string
  compiledHash: string
  directImportHash: string
  sourceStamp: string
  sourcemap: string | null
  sourcemapHash: string | null
}

interface CachedDependencyRecord {
  deps: string[]
  fingerprint: string
  imports: ResolvedImport[]
  rawCode: string
  resolvedPath: string
  sourceMapHash: string
  sourceStamp: string
  sourcemap: string | null
  stableUrlPathname: string
  transformConfigHash: string
}

interface ModuleCompilerOptions {
  configFingerprint: string
  external: string[]
  fileStorage?: FileStorage
  fingerprintInternalModules: boolean
  isAllowed(absolutePath: string): boolean
  isEntryPoint(absolutePath: string): boolean
  minify: boolean
  routes: CompiledRoutes
  sourceMapSourcePaths: 'absolute' | 'virtual'
  sourceMaps?: 'external' | 'inline'
  version: string
}

interface ResolveModuleResult {
  identityPath: string
  resolvedPath: string
}

interface ResolvedImport {
  depPath: string
  end: number
  start: number
}

interface UnresolvedImport {
  end: number
  specifier: string
  start: number
}

export interface ModuleCompiler {
  compileModule(absolutePath: string): Promise<ModuleCompileResult>
  getPreloadUrls(entryUrl: string): Promise<string[]>
  resolveRequestPath(absolutePath: string): ResolveModuleResult | null
}

export function createModuleCompiler(options: ModuleCompilerOptions): ModuleCompiler {
  let dependencyRecords = new Map<string, DependencyRecord>()
  let dependencyInFlight = new Map<string, Promise<DependencyRecord>>()
  let compiledAssets = new Map<string, CachedAssetRecord>()
  let compileInFlight = new Map<string, Promise<ModuleCompileResult>>()
  let resolvedPathsByIdentity = new Map<string, string>()
  let fileStorage = options.fileStorage ?? createMemoryFileStorage()

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
    async getPreloadUrls(entryUrl) {
      let resolved = resolveEntryFromUrl(entryUrl)
      if (!resolved) {
        throw new Error(`Entry point "${entryUrl}" is outside all configured routes.`)
      }

      if (!options.isEntryPoint(resolved.identityPath)) {
        throw new Error(`Entry point "${entryUrl}" does not match any configured entry points.`)
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
          (identityPath) => prepareDependencyRecord(identityPath),
        )
        let records = await finalizePreparedDependencyRecords(preparedRecords)

        for (let record of records) {
          urls.push(getServedUrlFromRecord(record))

          for (let dep of record.deps) {
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
    let record = await getDependencyRecordByIdentity(resolved.identityPath, resolved.resolvedPath)
    let directImportUrls = await Promise.all(record.deps.map((depPath) => getServedUrl(depPath)))
    let directImportHash = await hashContent(JSON.stringify(directImportUrls))
    let cacheKey = await getCompiledAssetKey(record.identityPath)

    let existing = compiledAssets.get(record.identityPath)
    if (
      existing &&
      existing.sourceStamp === record.sourceStamp &&
      existing.directImportHash === directImportHash
    ) {
      return toModuleCompileResult(record, existing)
    }

    let stored = await readCompiledAsset(cacheKey)
    if (
      stored &&
      stored.sourceStamp === record.sourceStamp &&
      stored.directImportHash === directImportHash
    ) {
      compiledAssets.set(record.identityPath, stored)
      return toModuleCompileResult(record, stored)
    }

    let compiledCode = await rewriteImports(record)
    let finalCode = compiledCode
    if (record.sourcemap) {
      if (options.sourceMaps === 'inline') {
        let encoded = Buffer.from(record.sourcemap).toString('base64')
        finalCode += `\n//# sourceMappingURL=data:application/json;base64,${encoded}`
      } else if (options.sourceMaps === 'external') {
        let mapPath = options.isEntryPoint(record.identityPath)
          ? `${record.stableUrlPathname}.map`
          : options.fingerprintInternalModules
            ? `${record.stableUrlPathname}.@${record.fingerprint}.map`
            : `${record.stableUrlPathname}.map`
        finalCode += `\n//# sourceMappingURL=${mapPath}`
      }
    }

    let compiledHash = await hashContent(finalCode)
    let sourcemapHash = record.sourcemap ? await hashContent(record.sourcemap) : null

    let asset: CachedAssetRecord = {
      compiledCode: finalCode,
      compiledHash,
      directImportHash,
      sourceStamp: record.sourceStamp,
      sourcemap: record.sourcemap,
      sourcemapHash,
    }

    compiledAssets.set(record.identityPath, asset)
    await writeCompiledAsset(cacheKey, asset)

    return toModuleCompileResult(record, asset)
  }

  async function rewriteImports(record: DependencyRecord): Promise<string> {
    let output = new MagicString(record.rawCode)

    for (let imported of record.imports) {
      let url = await getServedUrl(imported.depPath)
      output.overwrite(imported.start, imported.end, url)
    }

    return output.toString()
  }

  async function getServedUrl(identityPath: string): Promise<string> {
    let record = await getDependencyRecordByIdentity(identityPath)
    return getServedUrlFromRecord(record)
  }

  function getServedUrlFromRecord(record: DependencyRecord): string {
    if (options.isEntryPoint(record.identityPath) || !options.fingerprintInternalModules) {
      return record.stableUrlPathname
    }
    return `${record.stableUrlPathname}.@${record.fingerprint}`
  }

  async function getDependencyRecordFromPath(absolutePath: string): Promise<DependencyRecord> {
    let resolved = resolveModulePath(absolutePath)
    if (!resolved) {
      throw Object.assign(new Error(`Module not found: ${absolutePath}`), { code: 'ENOENT' })
    }
    return getDependencyRecordByIdentity(resolved.identityPath, resolved.resolvedPath)
  }

  async function getDependencyRecordByIdentity(
    identityPath: string,
    resolvedPath?: string,
  ): Promise<DependencyRecord> {
    let existing = dependencyInFlight.get(identityPath)
    if (existing) return existing

    let promise = loadDependencyRecord(identityPath, resolvedPath)
    dependencyInFlight.set(identityPath, promise)

    try {
      return await promise
    } finally {
      dependencyInFlight.delete(identityPath)
    }
  }

  async function loadDependencyRecord(
    identityPath: string,
    resolvedPath?: string,
  ): Promise<DependencyRecord> {
    let prepared = await prepareDependencyRecord(identityPath, resolvedPath)
    return finalizePreparedDependencyRecord(prepared)
  }

  async function prepareDependencyRecord(
    identityPath: string,
    resolvedPath?: string,
  ): Promise<DependencyRecord | PendingDependencyRecord> {
    let cached = dependencyRecords.get(identityPath)
    let nextResolvedPath =
      resolvedPath ?? resolvedPathsByIdentity.get(identityPath) ?? resolveActualPath(identityPath)
    if (!nextResolvedPath) {
      throw Object.assign(new Error(`Module not found: ${identityPath}`), { code: 'ENOENT' })
    }

    let stat = await fsp.stat(nextResolvedPath)
    let sourceStamp = sourceStampFromStat(stat)
    let transformOptions = getTsconfigTransformOptions(nextResolvedPath)
    let transformConfigHash = await hashContent(transformOptions.cacheKey)

    if (
      cached &&
      cached.sourceStamp === sourceStamp &&
      cached.resolvedPath === nextResolvedPath &&
      cached.transformConfigHash === transformConfigHash
    ) {
      return cached
    }

    let cacheKey = await getDependencyRecordKey(identityPath)
    let stored = await readDependencyRecord(cacheKey)
    if (
      stored &&
      stored.sourceStamp === sourceStamp &&
      stored.resolvedPath === nextResolvedPath &&
      stored.transformConfigHash === transformConfigHash
    ) {
      let record: DependencyRecord = {
        deps: stored.deps,
        fingerprint: stored.fingerprint,
        identityPath,
        imports: stored.imports,
        rawCode: stored.rawCode,
        resolvedPath: stored.resolvedPath,
        sourceMapHash: stored.sourceMapHash,
        sourceStamp: stored.sourceStamp,
        sourcemap: stored.sourcemap,
        stableUrlPathname: stored.stableUrlPathname,
        transformConfigHash: stored.transformConfigHash,
      }
      resolvedPathsByIdentity.set(identityPath, nextResolvedPath)
      dependencyRecords.set(identityPath, record)
      return record
    }

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
      throw new Error(getCommonJsModuleErrorMessage(nextResolvedPath))
    }

    let stableUrlPathname = options.routes.toUrlPathname(identityPath)
    if (!stableUrlPathname) {
      throw new Error(`Module ${identityPath} is outside all configured routes.`)
    }
    let sourcemap = analysis.sourcemap
      ? rewriteSourceMap(analysis.sourcemap, nextResolvedPath, stableUrlPathname)
      : null
    let fingerprint = await hashContent(sourceText + '\0' + options.version)

    return {
      fingerprint,
      identityPath,
      importerDir: path.dirname(nextResolvedPath),
      rawCode: analysis.rawCode,
      resolvedPath: nextResolvedPath,
      sourceMapHash: sourcemap ? await hashContent(sourcemap) : analysis.sourceMapHash,
      sourceStamp,
      sourcemap,
      stableUrlPathname,
      transformConfigHash,
      unresolvedImports: analysis.unresolvedImports,
    }
  }

  async function finalizePreparedDependencyRecord(
    prepared: DependencyRecord | PendingDependencyRecord,
  ): Promise<DependencyRecord> {
    if (isDependencyRecord(prepared)) return prepared

    let resolvedImports =
      prepared.unresolvedImports.length > 0
        ? await batchResolveSpecifiers(
            getUniqueSpecifiers(prepared.unresolvedImports),
            prepared.importerDir,
          )
        : new Map<string, string>()
    return finalizeDependencyRecord(prepared, resolvedImports)
  }

  async function finalizePreparedDependencyRecords(
    preparedRecords: Array<DependencyRecord | PendingDependencyRecord>,
  ): Promise<DependencyRecord[]> {
    let groupedSpecifiers = new Map<string, Set<string>>()

    for (let prepared of preparedRecords) {
      if (isDependencyRecord(prepared) || prepared.unresolvedImports.length === 0) continue

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
      preparedRecords.map((prepared) => {
        if (isDependencyRecord(prepared)) return prepared
        return finalizeDependencyRecord(
          prepared,
          resolvedByDirectory.get(prepared.importerDir) ?? new Map<string, string>(),
        )
      }),
    )
  }

  async function finalizeDependencyRecord(
    prepared: PendingDependencyRecord,
    resolvedImports: Map<string, string>,
  ): Promise<DependencyRecord> {
    let importsWithPaths: ResolvedImport[] = []
    let deps = new Set<string>()

    for (let unresolved of prepared.unresolvedImports) {
      let resolvedImportPath = resolvedImports.get(unresolved.specifier)
      if (!resolvedImportPath) {
        throw new Error(
          getUnresolvedImportErrorMessage(prepared.resolvedPath, unresolved.specifier),
        )
      }

      let resolvedImport = resolveModulePath(resolvedImportPath)
      if (!resolvedImport) {
        throw new Error(
          getUnsupportedImportErrorMessage(prepared.resolvedPath, unresolved.specifier),
        )
      }
      if (!options.isAllowed(resolvedImport.identityPath)) {
        throw new Error(
          getUnconfiguredImportErrorMessage(prepared.resolvedPath, unresolved.specifier),
        )
      }

      let stableUrlPathname = options.routes.toUrlPathname(resolvedImport.identityPath)
      if (!stableUrlPathname) {
        throw new Error(
          getUnconfiguredImportErrorMessage(prepared.resolvedPath, unresolved.specifier),
        )
      }

      deps.add(resolvedImport.identityPath)
      importsWithPaths.push({
        depPath: resolvedImport.identityPath,
        end: unresolved.end,
        start: unresolved.start,
      })
    }

    let record: DependencyRecord = {
      deps: [...deps],
      fingerprint: prepared.fingerprint,
      identityPath: prepared.identityPath,
      imports: importsWithPaths,
      rawCode: prepared.rawCode,
      resolvedPath: prepared.resolvedPath,
      sourceMapHash: prepared.sourceMapHash,
      sourceStamp: prepared.sourceStamp,
      sourcemap: prepared.sourcemap,
      stableUrlPathname: prepared.stableUrlPathname,
      transformConfigHash: prepared.transformConfigHash,
    }

    resolvedPathsByIdentity.set(prepared.identityPath, prepared.resolvedPath)
    dependencyRecords.set(prepared.identityPath, record)
    await writeDependencyRecordForRecord(record)
    return record
  }

  function isDependencyRecord(
    value: DependencyRecord | PendingDependencyRecord,
  ): value is DependencyRecord {
    return 'deps' in value
  }

  function rewriteSourceMap(
    sourcemap: string,
    resolvedPath: string,
    stableUrlPathname: string,
  ): string {
    try {
      let json = JSON.parse(sourcemap)
      json.sources = [
        options.sourceMapSourcePaths === 'absolute'
          ? stripWindowsDriveSlash(resolvedPath)
          : stableUrlPathname,
      ]
      return JSON.stringify(json)
    } catch {
      return sourcemap
    }
  }

  async function getCompiledAssetKey(identityPath: string): Promise<string> {
    return `compiled/${options.configFingerprint}/${await hashContent(identityPath)}.json`
  }

  async function getDependencyRecordKey(identityPath: string): Promise<string> {
    return `dependency-records/${options.configFingerprint}/${await hashContent(identityPath)}.json`
  }

  async function readCompiledAsset(key: string): Promise<CachedAssetRecord | null> {
    let file = await fileStorage.get(key)
    if (!file) return null
    return JSON.parse(await file.text()) as CachedAssetRecord
  }

  async function readDependencyRecord(key: string): Promise<CachedDependencyRecord | null> {
    let file = await fileStorage.get(key)
    if (!file) return null
    return JSON.parse(await file.text()) as CachedDependencyRecord
  }

  async function writeCompiledAsset(key: string, record: CachedAssetRecord): Promise<void> {
    await fileStorage.set(
      key,
      new File([JSON.stringify(record)], 'compiled-asset.json', {
        type: 'application/json',
      }),
    )
  }

  async function writeDependencyRecordForRecord(record: DependencyRecord): Promise<void> {
    let key = await getDependencyRecordKey(record.identityPath)
    let cachedRecord: CachedDependencyRecord = {
      deps: record.deps,
      fingerprint: record.fingerprint,
      imports: record.imports,
      rawCode: record.rawCode,
      resolvedPath: record.resolvedPath,
      sourceMapHash: record.sourceMapHash,
      sourceStamp: record.sourceStamp,
      sourcemap: record.sourcemap,
      stableUrlPathname: record.stableUrlPathname,
      transformConfigHash: record.transformConfigHash,
    }

    await fileStorage.set(
      key,
      new File([JSON.stringify(cachedRecord)], 'dependency-record.json', {
        type: 'application/json',
      }),
    )
  }

  function toModuleCompileResult(
    record: DependencyRecord,
    asset: CachedAssetRecord,
  ): ModuleCompileResult {
    return {
      compiledCode: asset.compiledCode,
      compiledHash: asset.compiledHash,
      deps: record.deps,
      fingerprint: record.fingerprint,
      sourcemap: asset.sourcemap,
      sourcemapHash: asset.sourcemapHash,
      stableUrlPathname: record.stableUrlPathname,
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

export function createConfigFingerprint(options: {
  external: string[]
  fingerprintInternalModules: boolean
  minify: boolean
  routes: readonly { filePattern: string; urlPattern: string }[]
  sourceMapSourcePaths: 'absolute' | 'virtual'
  sourceMaps?: 'external' | 'inline'
  version: string
}): Promise<string> {
  return hashContent(
    JSON.stringify({
      esbuildVersion: esbuild.version,
      external: options.external,
      fingerprintInternalModules: options.fingerprintInternalModules,
      minify: options.minify,
      routes: options.routes,
      sourceMapSourcePaths: options.sourceMapSourcePaths,
      sourceMaps: options.sourceMaps ?? null,
      typescriptVersion,
      version: options.version,
    }),
  )
}

export function resolveModulePath(absolutePath: string): ResolveModuleResult | null {
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
    identityPath: normalizeActualFilePath(resolvedPath),
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

function normalizeActualFilePath(filePath: string): string {
  let normalizedInput = filePath.replace(/\\/g, '/')
  if (/^\/[A-Za-z]:\//.test(normalizedInput)) {
    return normalizedInput
  }
  if (/^[A-Za-z]:\//.test(normalizedInput)) {
    return `/${normalizedInput}`
  }

  let normalized = path.resolve(filePath).replace(/\\/g, '/')
  if (/^[A-Za-z]:\//.test(normalized)) {
    return `/${normalized}`
  }
  return normalized
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

interface ModuleAnalysisResult {
  rawCode: string
  sourceMapHash: string
  sourcemap: string | null
  unresolvedImports: UnresolvedImport[]
}

async function analyzeModuleSource(
  sourceText: string,
  resolvedPath: string,
  transformOptions: ReturnType<typeof getTsconfigTransformOptions>,
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
  let unresolvedImports = getUnresolvedImportsFromCode(rawCode)

  return {
    rawCode,
    sourceMapHash: sourcemap ? await hashContent(sourcemap) : '',
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
      results.set(match.specifier, normalizeActualFilePath(match.absolutePath))
    }
  }

  return results
}

interface ResolvedSpec {
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

function getUnresolvedImportsFromCode(rawCode: string): UnresolvedImport[] {
  let [imports] = parseImports(rawCode)
  let unresolvedImports: UnresolvedImport[] = []

  for (let imported of imports) {
    if (imported.n == null) continue
    let specifier = imported.n
    if (
      specifier.startsWith('data:') ||
      specifier.startsWith('http://') ||
      specifier.startsWith('https://')
    ) {
      continue
    }
    unresolvedImports.push({ specifier, start: imported.s, end: imported.e })
  }

  return unresolvedImports
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
                throw new Error(getUnresolvedImportErrorMessage(importerDir, specifiers[index]))
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

function getCommonJsModuleErrorMessage(absolutePath: string): string {
  return (
    `CommonJS module detected: ${absolutePath}\n\n` +
    `This module uses CommonJS (require/module.exports) which is not supported.\n` +
    `Please use an ESM-compatible module.`
  )
}

function getUnconfiguredImportErrorMessage(importerPath: string, specifier: string): string {
  return (
    `Resolved import "${specifier}" in ${importerPath} points outside the script-server routing/allow configuration.\n\n` +
    `Add a matching route and allow rule, or mark this import as external.`
  )
}

function getUnresolvedImportErrorMessage(importerPath: string, specifier: string): string {
  return (
    `Failed to resolve import "${specifier}" in ${importerPath}.\n\n` +
    `Ensure it resolves to a file within the configured script-server routes, or mark it as external.`
  )
}

function getUnsupportedImportErrorMessage(importerPath: string, specifier: string): string {
  return (
    `Resolved import "${specifier}" in ${importerPath} is not a supported script module.\n\n` +
    `Supported extensions are .js, .jsx, .mjs, .mts, .ts, and .tsx.`
  )
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
    etag = generateETag(result.sourcemapHash ?? result.compiledHash)
    contentType = 'application/json; charset=utf-8'
  } else {
    body = options.method === 'HEAD' ? null : result.compiledCode
    etag = generateETag(result.compiledHash)
    contentType = 'application/javascript; charset=utf-8'
  }

  if (matchesETag(options.ifNoneMatch, etag)) {
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
