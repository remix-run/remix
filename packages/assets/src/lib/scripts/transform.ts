import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { getTsconfig } from 'get-tsconfig'
import MagicString from 'magic-string'
import { minify } from 'oxc-minify'
import { parseSync, visitorKeys } from 'oxc-parser'
import { transform as oxcTransform } from 'oxc-transform'
import { init as esModuleLexerInit, parse as esModuleLexer } from 'es-module-lexer'
import type { Cache, TsConfigJsonResolved } from 'get-tsconfig'
import type { Node, Program } from 'oxc-parser'
import type { TransformOptions as OxcTransformOptions } from 'oxc-transform'

import { isCommonJS, mayContainCommonJSModuleGlobals } from './cjs-check.ts'
import {
  createAssetServerCompilationError,
  isAssetServerCompilationError,
} from '../compilation-error.ts'
import type { AssetServerCompilationError } from '../compilation-error.ts'
import { generateFingerprint } from '../fingerprint.ts'
import {
  maskAuthoredInjectedPackageSpecifier,
  mayContainInjectedPackageSpecifier,
  restoreAuthoredInjectedPackageSpecifier,
} from '../injected-packages.ts'
import type { ModuleRecord, ModuleTracking } from '../module-store.ts'
import { normalizeFilePath } from '../paths.ts'
import type { CompiledRoutes } from '../routes.ts'
import { composeSourceMaps, rewriteSourceMapSources, stringifySourceMap } from '../source-maps.ts'
import type { EmittedModule } from './emit.ts'
import type { ResolvedScriptTarget } from '../target.ts'
import type { ResolvedModule } from './resolve.ts'

type ScriptRecord = ModuleRecord<TransformedModule, ResolvedModule, EmittedModule>

type SourceLanguage = 'js' | 'jsx' | 'ts' | 'tsx'

const scriptModuleTypes = [
  { extension: '.js', lang: 'js' },
  { extension: '.jsx', lang: 'jsx' },
  { extension: '.mjs', lang: 'js' },
  { extension: '.mts', lang: 'ts' },
  { extension: '.ts', lang: 'ts' },
  { extension: '.tsx', lang: 'tsx' },
] as const satisfies ReadonlyArray<{ extension: string; lang: SourceLanguage }>

const sourceLanguageByExtension = new Map<string, SourceLanguage>(
  scriptModuleTypes.map(({ extension, lang }) => [extension, lang] as const),
)

const importNarrowingConfigs = [
  createImportNarrowingConfig('remix/ui', {
    clientEntry: 'remix/ui/client-entry',
    css: 'remix/ui/css',
    on: 'remix/ui/on',
    run: 'remix/ui/run',
  }),
] as const

const supportedTsconfigTransformCompilerOptions = {
  allowNamespaces: 'allowNamespaces',
  emitDecoratorMetadata: 'emitDecoratorMetadata',
  experimentalDecorators: 'experimentalDecorators',
  jsx: 'jsx',
  jsxFactory: 'jsxFactory',
  jsxFragmentFactory: 'jsxFragmentFactory',
  jsxImportSource: 'jsxImportSource',
  useDefineForClassFields: 'useDefineForClassFields',
} as const

export type ResolveModuleResult = {
  identityPath: string
  resolvedPath: string
}

type UnresolvedImport = {
  end: number
  quote?: '"' | "'" | '`'
  specifier: string
  start: number
}

export type TransformedModule = {
  fingerprint: string | null
  identityPath: string
  importerDir: string
  packageSpecifiers: string[]
  rawCode: string
  resolvedPath: string
  sourceMap: string | null
  stableUrlPathname: string
  trackedFiles: string[]
  unresolvedImports: UnresolvedImport[]
}

type TransformResult = {
  tracking: ModuleTracking
} & (
  | {
      ok: true
      value: TransformedModule
    }
  | {
      ok: false
      error: AssetServerCompilationError
    }
)

interface ImportNarrowingExport {
  name: string
  specifier: string
}

interface ImportNarrowingConfig {
  exportByName: ReadonlyMap<string, ImportNarrowingExport>
  specifier: string
}

type TsconfigTransformOptions = {
  trackedFiles: string[]
  tsconfigRaw?: TsConfigJsonResolved
}

type TsconfigTransformOptionsResolver = ReturnType<typeof createTsconfigTransformOptionsResolver>

export type TransformArgs = {
  buildId: string | null
  define: Record<string, string> | null
  externalSet: ReadonlySet<string>
  isWatchIgnored(filePath: string): boolean
  minify: boolean
  resolveActualPath(identityPath: string): string | null
  routes: CompiledRoutes
  sourceMapSourcePaths: 'absolute' | 'url'
  sourceMaps: 'external' | 'inline' | null
  target: ResolvedScriptTarget | null
  tsconfigTransformOptionsResolver: TsconfigTransformOptionsResolver
}

export function createTsconfigTransformOptionsResolver() {
  let fileSystemCache: Cache = new Map()
  let transformOptionsByDirectory = new Map<string, TsconfigTransformOptions>()

  return {
    clear() {
      fileSystemCache = new Map()
      transformOptionsByDirectory.clear()
    },
    getTransformOptions(
      filePath: string,
      isWatchIgnored: (filePath: string) => boolean,
    ): TsconfigTransformOptions {
      let directory = path.dirname(filePath)
      let cached = transformOptionsByDirectory.get(directory)
      if (cached) return cached

      let tsconfig = getTsconfig(directory, 'tsconfig.json', fileSystemCache)
      if (!tsconfig) {
        let transformOptions = { trackedFiles: [] }
        transformOptionsByDirectory.set(directory, transformOptions)
        return transformOptions
      }

      let tsconfigPath = findNearestTsconfigPath(directory)
      let transformOptions: TsconfigTransformOptions = {
        trackedFiles: tsconfigPath && !isWatchIgnored(tsconfigPath) ? [tsconfigPath] : [],
        tsconfigRaw: tsconfig.config,
      }

      transformOptionsByDirectory.set(directory, transformOptions)
      return transformOptions
    },
  }
}

export async function transformModule(
  record: ScriptRecord,
  args: TransformArgs,
): Promise<TransformResult> {
  let resolvedPath = args.resolveActualPath(record.identityPath)
  if (!resolvedPath) {
    return {
      ok: false,
      error: createAssetServerCompilationError(`File not found: ${record.identityPath}`, {
        code: 'FILE_NOT_FOUND',
      }),
      tracking: {
        trackedFiles: args.isWatchIgnored(record.identityPath) ? [] : [record.identityPath],
      },
    }
  }

  let transformOptions = args.tsconfigTransformOptionsResolver.getTransformOptions(
    resolvedPath,
    args.isWatchIgnored,
  )
  let trackedFiles = [
    ...(args.isWatchIgnored(resolvedPath) ? [] : [resolvedPath]),
    ...transformOptions.trackedFiles,
  ]
  let sourceText: string
  try {
    sourceText = await fsp.readFile(resolvedPath, 'utf-8')
  } catch (error) {
    if (isNoEntityError(error)) {
      return {
        ok: false,
        error: createAssetServerCompilationError(`File not found: ${resolvedPath}`, {
          cause: error,
          code: 'FILE_NOT_FOUND',
        }),
        tracking: {
          trackedFiles,
        },
      }
    }
    return {
      ok: false,
      error: toTransformFailedError(error, resolvedPath),
      tracking: {
        trackedFiles,
      },
    }
  }

  try {
    let analysis = await analyzeModuleSource(sourceText, resolvedPath, transformOptions, {
      define: args.define ?? undefined,
      externalSet: args.externalSet,
      minify: args.minify,
      sourceMaps: args.sourceMaps ?? undefined,
      target: args.target ?? undefined,
    })

    analysis.unresolvedImports = analysis.unresolvedImports.filter(
      (unresolved) => !args.externalSet.has(getDisplayImportSpecifier(unresolved.specifier)),
    )

    if (mayContainCommonJSModuleGlobals(sourceText) && isCommonJS(analysis.rawCode)) {
      throw createAssetServerCompilationError(
        `CommonJS module detected: ${resolvedPath}. ` +
          `This module uses CommonJS (require/module.exports) which is not supported. ` +
          `Please use an ESM-compatible module.`,
        {
          code: 'COMMONJS_NOT_SUPPORTED',
        },
      )
    }

    let stableUrlPathname = args.routes.toUrlPathname(record.identityPath)
    if (!stableUrlPathname) {
      throw createAssetServerCompilationError(
        `File ${record.identityPath} is outside all configured fileMap entries.`,
        {
          code: 'FILE_OUTSIDE_FILE_MAP',
        },
      )
    }

    let sourceMap = analysis.sourceMap
      ? rewriteSourceMapSources(
          analysis.sourceMap,
          resolvedPath,
          stableUrlPathname,
          args.sourceMapSourcePaths,
          sourceText,
        )
      : null

    return {
      ok: true,
      tracking: {
        trackedFiles,
      },
      value: {
        fingerprint:
          args.buildId === null
            ? null
            : await generateFingerprint({
                buildId: args.buildId,
                content: sourceText,
              }),
        identityPath: record.identityPath,
        importerDir: path.dirname(resolvedPath),
        packageSpecifiers: analysis.unresolvedImports
          .filter((unresolved) => isBareImportSpecifier(unresolved.specifier))
          .map((unresolved) => unresolved.specifier),
        rawCode: analysis.rawCode,
        resolvedPath,
        sourceMap,
        stableUrlPathname,
        trackedFiles,
        unresolvedImports: analysis.unresolvedImports,
      },
    }
  } catch (error) {
    return {
      ok: false,
      error: toTransformFailedError(error, resolvedPath),
      tracking: {
        trackedFiles,
      },
    }
  }
}

function findNearestTsconfigPath(directory: string): string | null {
  let currentDirectory = directory

  while (true) {
    let tsconfigPath = path.join(currentDirectory, 'tsconfig.json')
    if (fs.existsSync(tsconfigPath)) {
      return normalizeFilePath(tsconfigPath)
    }

    let parentDirectory = path.dirname(currentDirectory)
    if (parentDirectory === currentDirectory) return null
    currentDirectory = parentDirectory
  }
}

function isBareImportSpecifier(specifier: string): boolean {
  return (
    !specifier.startsWith('./') &&
    !specifier.startsWith('../') &&
    !specifier.startsWith('/') &&
    !specifier.startsWith('file:') &&
    !specifier.startsWith('data:') &&
    !specifier.startsWith('http://') &&
    !specifier.startsWith('https://')
  )
}

async function analyzeModuleSource(
  sourceText: string,
  resolvedPath: string,
  transformOptions: TsconfigTransformOptions,
  options: {
    define?: Record<string, string>
    externalSet: ReadonlySet<string>
    minify: boolean
    sourceMaps?: 'external' | 'inline'
    target?: ResolvedScriptTarget
  },
) {
  let maskedSourceText = maskAuthoredInjectedPackageImports(sourceText, resolvedPath)
  let transformResult: { code: string; errors?: Array<{ message?: string }>; map?: unknown }
  try {
    transformResult = await oxcTransform(
      resolvedPath,
      maskedSourceText,
      getTransformOptions(resolvedPath, transformOptions, options),
    )
    assertNoCompilerErrors(transformResult.errors, resolvedPath, 'transform')
  } catch (error) {
    if (isAssetServerCompilationError(error)) throw error
    throw createAssetServerCompilationError(
      `Failed to transform script ${resolvedPath}. ${formatUnknownError(error)}`,
      {
        cause: error,
        code: 'TRANSFORM_FAILED',
      },
    )
  }

  let rawCode = transformResult.code.trimEnd()
  let sourceMap = stringifySourceMap(transformResult.map)
  let narrowingResult = narrowPackageImports(rawCode, resolvedPath, options.externalSet)
  rawCode = narrowingResult.code

  if (sourceMap && narrowingResult.sourceMap) {
    sourceMap = composeSourceMaps(narrowingResult.sourceMap, sourceMap)
  }

  if (options.minify) {
    let minifyResult = await minifyModule(rawCode, resolvedPath, options.target, options.sourceMaps)
    rawCode = minifyResult.code.trimEnd()
    let minifyMap = stringifySourceMap(minifyResult.map)
    sourceMap =
      minifyMap == null
        ? sourceMap
        : sourceMap == null
          ? minifyMap
          : composeSourceMaps(minifyMap, sourceMap)
  }

  return {
    rawCode,
    sourceMap,
    unresolvedImports: await getUnresolvedImportsFromLexer(rawCode),
  }
}

async function minifyModule(
  rawCode: string,
  resolvedPath: string,
  target: ResolvedScriptTarget | undefined,
  sourceMaps?: 'external' | 'inline',
) {
  try {
    let result = await minify(resolvedPath, rawCode, {
      compress: target ? { target } : true,
      mangle: true,
      module: true,
      sourcemap: sourceMaps != null,
    })
    assertNoCompilerErrors(result.errors, resolvedPath, 'minify')
    return result
  } catch (error) {
    if (isAssetServerCompilationError(error)) throw error
    throw createAssetServerCompilationError(
      `Failed to minify script ${resolvedPath}. ${formatUnknownError(error)}`,
      {
        cause: error,
        code: 'TRANSFORM_FAILED',
      },
    )
  }
}

function getTransformOptions(
  resolvedPath: string,
  transformOptions: TsconfigTransformOptions,
  options: {
    define?: Record<string, string>
    sourceMaps?: 'external' | 'inline'
    target?: ResolvedScriptTarget
  },
): OxcTransformOptions {
  let compilerOptions = transformOptions.tsconfigRaw?.compilerOptions as
    | Record<string, unknown>
    | undefined
  let useDefineForClassFields = getBooleanOption(
    compilerOptions,
    supportedTsconfigTransformCompilerOptions.useDefineForClassFields,
  )
  let jsxFactory = getStringOption(
    compilerOptions,
    supportedTsconfigTransformCompilerOptions.jsxFactory,
  )
  let jsxFragmentFactory = getStringOption(
    compilerOptions,
    supportedTsconfigTransformCompilerOptions.jsxFragmentFactory,
  )

  return {
    assumptions:
      useDefineForClassFields === false
        ? {
            setPublicClassFields: true,
          }
        : undefined,
    decorator: getDecoratorOptions(compilerOptions),
    define: options.define,
    jsx: getJsxOptions(resolvedPath, compilerOptions),
    lang: getSourceLanguageForPath(resolvedPath),
    sourceType: 'module' as const,
    sourcemap: options.sourceMaps != null,
    target: options.target,
    typescript: {
      allowNamespaces: getBooleanOption(
        compilerOptions,
        supportedTsconfigTransformCompilerOptions.allowNamespaces,
      ),
      jsxPragma: jsxFactory,
      jsxPragmaFrag: jsxFragmentFactory,
      removeClassFieldsWithoutInitializer: useDefineForClassFields === false ? true : undefined,
    },
  }
}

function getJsxOptions(
  resolvedPath: string,
  compilerOptions?: Record<string, unknown>,
): OxcTransformOptions['jsx'] | undefined {
  let language = getSourceLanguageForPath(resolvedPath)
  if (language !== 'jsx' && language !== 'tsx') return undefined

  let jsx = getStringOption(compilerOptions, supportedTsconfigTransformCompilerOptions.jsx)
  let importSource = getStringOption(
    compilerOptions,
    supportedTsconfigTransformCompilerOptions.jsxImportSource,
  )
  let pragma = getStringOption(
    compilerOptions,
    supportedTsconfigTransformCompilerOptions.jsxFactory,
  )
  let pragmaFrag = getStringOption(
    compilerOptions,
    supportedTsconfigTransformCompilerOptions.jsxFragmentFactory,
  )

  if (jsx === 'preserve' || jsx === 'react-native') {
    throw createAssetServerCompilationError(
      `Unsupported tsconfig compilerOptions.jsx = "${jsx}" for ${resolvedPath}. ` +
        `Asset server must compile JSX to browser-runnable JavaScript.`,
      {
        code: 'TRANSFORM_FAILED',
      },
    )
  }

  if (jsx === 'react-jsx' || jsx === 'react-jsxdev') {
    return {
      development: jsx === 'react-jsxdev',
      importSource,
      runtime: 'automatic',
    }
  }

  return {
    pragma,
    pragmaFrag,
    runtime: 'classic',
  }
}

function getDecoratorOptions(
  compilerOptions?: Record<string, unknown>,
): OxcTransformOptions['decorator'] | undefined {
  let legacy = getBooleanOption(
    compilerOptions,
    supportedTsconfigTransformCompilerOptions.experimentalDecorators,
  )
  let emitDecoratorMetadata = getBooleanOption(
    compilerOptions,
    supportedTsconfigTransformCompilerOptions.emitDecoratorMetadata,
  )

  if (legacy !== true && emitDecoratorMetadata !== true) return undefined

  return {
    emitDecoratorMetadata,
    legacy,
  }
}

function createImportNarrowingConfig(
  specifier: string,
  exportSpecifiers: Record<string, string>,
): ImportNarrowingConfig {
  let exportByName = new Map(
    Object.entries(exportSpecifiers).map(([name, narrowedSpecifier]) => [
      name,
      {
        name,
        specifier: narrowedSpecifier,
      },
    ]),
  )
  return {
    exportByName,
    specifier,
  }
}

function narrowPackageImports(
  rawCode: string,
  resolvedPath: string,
  externalSet: ReadonlySet<string>,
): {
  code: string
  sourceMap: string | null
} {
  if (!mayContainNarrowableSpecifier(rawCode)) {
    return {
      code: rawCode,
      sourceMap: null,
    }
  }

  let parseResult = parseSync(resolvedPath, rawCode, {
    lang: getSourceLanguageForPath(resolvedPath),
    sourceType: 'module',
  })

  assertNoCompilerErrors(parseResult.errors, resolvedPath, 'transform')

  let replacements: Array<{ end: number; source: string; start: number }> = []

  for (let node of parseResult.program.body) {
    if (node.type !== 'ImportDeclaration') continue

    let source = node.source
    if (!isStringLiteralNode(source)) continue

    let config = importNarrowingConfigs.find((nextConfig) => nextConfig.specifier === source.value)
    if (!config || node.specifiers.length === 0) continue
    if (externalSet.has(config.specifier)) continue
    if (node.specifiers.some((specifier) => specifier.type !== 'ImportSpecifier')) continue

    let narrowedSpecifiers = new Map<string, string[]>()
    let remainingSpecifiers: string[] = []
    let changed = false

    for (let specifier of node.specifiers) {
      if (specifier.type !== 'ImportSpecifier') continue

      let imported = getImportSpecifierName(specifier.imported)
      let narrowedExport = imported ? config.exportByName.get(imported) : undefined

      if (!narrowedExport) {
        remainingSpecifiers.push(rawCode.slice(specifier.start, specifier.end))
        continue
      }

      let imports = narrowedSpecifiers.get(narrowedExport.specifier)
      if (!imports) {
        imports = []
        narrowedSpecifiers.set(narrowedExport.specifier, imports)
      }
      imports.push(formatNarrowedImport(narrowedExport.name, specifier.local.name))
      changed = true
    }

    if (!changed) continue

    let statements: string[] = []

    if (remainingSpecifiers.length > 0) {
      statements.push(`import ${formatImportSpecifiers(remainingSpecifiers)} from ${source.raw}`)
    }

    for (let [specifier, imports] of narrowedSpecifiers) {
      statements.push(`import ${formatImportSpecifiers(imports)} from ${JSON.stringify(specifier)}`)
    }

    replacements.push({
      start: node.start,
      end: node.end,
      source: statements.join('\n'),
    })
  }

  if (replacements.length === 0) {
    return {
      code: rawCode,
      sourceMap: null,
    }
  }

  let rewrittenSource = new MagicString(rawCode)
  for (let replacement of replacements) {
    rewrittenSource.overwrite(replacement.start, replacement.end, replacement.source)
  }

  return {
    code: rewrittenSource.toString().trimEnd(),
    sourceMap: rewrittenSource.generateMap({ hires: true }).toString(),
  }
}

function mayContainNarrowableSpecifier(rawCode: string): boolean {
  return importNarrowingConfigs.some((config) => rawCode.includes(config.specifier))
}

function getImportSpecifierName(node: Node): string | undefined {
  if (node.type === 'Identifier') {
    return node.name
  }

  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value
  }

  return undefined
}

function formatNarrowedImport(imported: string, local: string): string {
  return imported === local ? imported : `${imported} as ${local}`
}

function formatImportSpecifiers(specifiers: readonly string[]): string {
  return specifiers.length === 1 ? `{ ${specifiers[0]} }` : `{\n${specifiers.join(',\n')}\n}`
}

function getBooleanOption(
  compilerOptions: Record<string, unknown> | undefined,
  key: string,
): boolean | undefined {
  let value = compilerOptions?.[key]
  return typeof value === 'boolean' ? value : undefined
}

function getStringOption(
  compilerOptions: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  let value = compilerOptions?.[key]
  return typeof value === 'string' ? value : undefined
}

function assertNoCompilerErrors(
  errors: Array<{ message?: string }> | undefined,
  resolvedPath: string,
  operation: 'transform' | 'minify',
) {
  if (!errors || errors.length === 0) return

  throw createAssetServerCompilationError(
    `Failed to ${operation} script ${resolvedPath}. ${errors[0].message ?? 'Unknown error'}`,
    {
      code: 'TRANSFORM_FAILED',
    },
  )
}

async function getUnresolvedImportsFromLexer(rawCode: string): Promise<UnresolvedImport[]> {
  await esModuleLexerInit
  let [imports] = esModuleLexer(rawCode)
  let unresolvedImports: UnresolvedImport[] = []

  for (let imported of imports) {
    let specifier = getStaticImportSpecifier(rawCode, imported)
    if (specifier == null || shouldSkipImportSpecifier(specifier)) continue
    unresolvedImports.push({
      specifier,
      start: imported.s,
      end: imported.e,
      quote: getImportQuote(rawCode, imported.s),
    })
  }

  return unresolvedImports
}

function getDisplayImportSpecifier(specifier: string): string {
  return restoreAuthoredInjectedPackageSpecifier(specifier) ?? specifier
}

function maskAuthoredInjectedPackageImports(sourceText: string, resolvedPath: string): string {
  if (!mayContainInjectedPackageSpecifier(sourceText)) {
    return sourceText
  }

  let parseResult = parseSync(resolvedPath, sourceText, {
    lang: getSourceLanguageForPath(resolvedPath),
    sourceType: 'module',
  })
  if (parseResult.errors.length > 0) {
    return sourceText
  }

  let replacements: Array<{ end: number; specifier: string; start: number }> = []

  walkAst(parseResult.program, (node) => {
    if (
      node.type !== 'ImportDeclaration' &&
      node.type !== 'ExportAllDeclaration' &&
      node.type !== 'ExportNamedDeclaration' &&
      node.type !== 'ImportExpression'
    ) {
      return
    }

    let source = 'source' in node ? node.source : null
    if (!isStringLiteralNode(source)) return

    let maskedSpecifier = maskAuthoredInjectedPackageSpecifier(source.value)
    if (maskedSpecifier == null) return

    replacements.push({
      end: source.end - 1,
      specifier: maskedSpecifier,
      start: source.start + 1,
    })
  })

  if (replacements.length === 0) return sourceText

  let rewrittenSource = new MagicString(sourceText)
  for (let replacement of replacements) {
    rewrittenSource.overwrite(replacement.start, replacement.end, replacement.specifier)
  }

  return rewrittenSource.toString()
}

function walkAst(node: Program | Node, visit: (node: Program | Node) => void): void {
  visit(node)

  let keys = visitorKeys[node.type]
  if (!keys) return

  let walkableNode = node as unknown as Record<string, unknown>
  for (let key of keys) {
    let value = walkableNode[key]
    if (Array.isArray(value)) {
      for (let child of value) {
        if (isAstNode(child)) {
          walkAst(child, visit)
        }
      }
      continue
    }

    if (isAstNode(value)) {
      walkAst(value, visit)
    }
  }
}

function isAstNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && 'type' in value
}

function isStringLiteralNode(node: Node | null | undefined): node is Node & {
  end: number
  start: number
  value: string
} {
  return (
    node?.type === 'Literal' &&
    typeof node.start === 'number' &&
    typeof node.end === 'number' &&
    typeof node.value === 'string'
  )
}

function getStaticImportSpecifier(
  source: string,
  imported: ReturnType<typeof esModuleLexer>[0][number],
): string | null {
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

function shouldSkipImportSpecifier(specifier: string): boolean {
  return (
    specifier.startsWith('data:') ||
    specifier.startsWith('http://') ||
    specifier.startsWith('https://')
  )
}

function getImportQuote(source: string, start: number): '"' | "'" | '`' | undefined {
  let firstCharacter = source[start]
  if (firstCharacter === '"' || firstCharacter === "'" || firstCharacter === '`') {
    return firstCharacter
  }
  return undefined
}

function getSourceLanguageForPath(resolvedPath: string): SourceLanguage {
  let extension = path.extname(resolvedPath).toLowerCase()
  return sourceLanguageByExtension.get(extension) ?? 'js'
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function toTransformFailedError(error: unknown, resolvedPath: string): AssetServerCompilationError {
  if (isAssetServerCompilationError(error)) return error

  return createAssetServerCompilationError(
    `Failed to transform script ${resolvedPath}. ${formatUnknownError(error)}`,
    {
      cause: error,
      code: 'TRANSFORM_FAILED',
    },
  )
}

function isNoEntityError(error: unknown): error is NodeJS.ErrnoException & { code: 'ENOENT' } {
  return (
    error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
  )
}
