import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { getTsconfig } from 'get-tsconfig'
import { minify } from 'oxc-minify'
import { transform as oxcTransform } from 'oxc-transform'
import { init as esModuleLexerInit, parse as esModuleLexer } from 'es-module-lexer'
import type { Cache, TsConfigJsonResolved } from 'get-tsconfig'

import { isCommonJS, mayContainCommonJSModuleGlobals } from './cjs-check.ts'
import {
  ScriptServerCompilationError,
  createScriptServerCompilationError,
  isScriptServerCompilationError,
} from './compilation-error.ts'
import { hashContent } from './fingerprint.ts'
import { normalizeFilePath } from './paths.ts'
import type { CompiledRoutes } from './routes.ts'
import type { ScriptServerTarget } from './script-server.ts'
import type { ModuleRecord } from './store.ts'
import { composeSourceMaps, rewriteSourceMapSources, stringifySourceMap } from './source-maps.ts'

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
  fingerprint: string
  identityPath: string
  importerDir: string
  packageSpecifiers: string[]
  rawCode: string
  resolvedPath: string
  sourcemap: string | null
  stableUrlPathname: string
  trackedFiles: string[]
  unresolvedImports: UnresolvedImport[]
}

export type TransformFailureState = {
  trackedFiles: readonly string[]
}

type TransformResult =
  | {
      ok: true
      value: TransformedModule
    }
  | ({
      ok: false
      error: ScriptServerCompilationError
    } & TransformFailureState)

type TsconfigTransformOptions = {
  trackedFiles: string[]
  tsconfigRaw?: TsConfigJsonResolved
}

type TsconfigTransformOptionsResolver = ReturnType<typeof createTsconfigTransformOptionsResolver>

export type TransformArgs = {
  buildId: string | null
  define: Record<string, string> | null
  externalSet: ReadonlySet<string>
  minify: boolean
  resolveActualPath(identityPath: string): string | null
  routes: CompiledRoutes
  sourceMapSourcePaths: 'absolute' | 'url'
  sourceMaps: 'external' | 'inline' | null
  target: ScriptServerTarget | null
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
    getTransformOptions(filePath: string): TsconfigTransformOptions {
      let directory = path.dirname(filePath)
      let cached = transformOptionsByDirectory.get(directory)
      if (cached) return cached

      let tsconfig = getTsconfig(directory, 'tsconfig.json', fileSystemCache)
      if (!tsconfig) {
        let transformOptions = { trackedFiles: [] }
        transformOptionsByDirectory.set(directory, transformOptions)
        return transformOptions
      }

      let transformOptions: TsconfigTransformOptions = {
        trackedFiles: (() => {
          let tsconfigPath = findNearestTsconfigPath(directory)
          return tsconfigPath ? [tsconfigPath] : []
        })(),
        tsconfigRaw: tsconfig.config,
      }

      transformOptionsByDirectory.set(directory, transformOptions)
      return transformOptions
    },
  }
}

export async function transformModule(
  record: ModuleRecord,
  args: TransformArgs,
): Promise<TransformResult> {
  let resolvedPath = args.resolveActualPath(record.identityPath)
  if (!resolvedPath) {
    return {
      ok: false,
      error: createScriptServerCompilationError(`Module not found: ${record.identityPath}`, {
        code: 'MODULE_NOT_FOUND',
      }),
      trackedFiles: [record.identityPath],
    }
  }

  let transformOptions = args.tsconfigTransformOptionsResolver.getTransformOptions(resolvedPath)
  let trackedFiles = [resolvedPath, ...transformOptions.trackedFiles]
  let sourceText: string
  try {
    sourceText = await fsp.readFile(resolvedPath, 'utf-8')
  } catch (error) {
    if (isNoEntityError(error)) {
      return {
        ok: false,
        error: createScriptServerCompilationError(`Module not found: ${resolvedPath}`, {
          cause: error,
          code: 'MODULE_NOT_FOUND',
        }),
        trackedFiles,
      }
    }
    return {
      ok: false,
      error: toTransformFailedError(error, resolvedPath),
      trackedFiles,
    }
  }

  try {
    let analysis = await analyzeModuleSource(sourceText, resolvedPath, transformOptions, {
      define: args.define ?? undefined,
      minify: args.minify,
      sourceMaps: args.sourceMaps ?? undefined,
      target: args.target ?? undefined,
    })

    analysis.unresolvedImports = analysis.unresolvedImports.filter(
      (unresolved) => !args.externalSet.has(unresolved.specifier),
    )

    if (mayContainCommonJSModuleGlobals(sourceText) && isCommonJS(analysis.rawCode)) {
      throw createScriptServerCompilationError(
        `CommonJS module detected: ${resolvedPath}\n\n` +
          `This module uses CommonJS (require/module.exports) which is not supported.\n` +
          `Please use an ESM-compatible module.`,
        {
          code: 'MODULE_COMMONJS_NOT_SUPPORTED',
        },
      )
    }

    let stableUrlPathname = args.routes.toUrlPathname(record.identityPath)
    if (!stableUrlPathname) {
      throw createScriptServerCompilationError(
        `Module ${record.identityPath} is outside all configured routes.`,
        {
          code: 'MODULE_OUTSIDE_ROUTES',
        },
      )
    }

    let sourcemap = analysis.sourcemap
      ? rewriteSourceMapSources(
          analysis.sourcemap,
          resolvedPath,
          stableUrlPathname,
          args.sourceMapSourcePaths,
        )
      : null

    return {
      ok: true,
      value: {
        fingerprint: await hashContent(sourceText + '\0' + (args.buildId ?? '')),
        identityPath: record.identityPath,
        importerDir: path.dirname(resolvedPath),
        packageSpecifiers: analysis.unresolvedImports
          .filter((unresolved) => isPackageImportSpecifier(unresolved.specifier))
          .map((unresolved) => unresolved.specifier),
        rawCode: analysis.rawCode,
        resolvedPath,
        sourcemap,
        stableUrlPathname,
        trackedFiles,
        unresolvedImports: analysis.unresolvedImports,
      },
    }
  } catch (error) {
    return {
      ok: false,
      error: toTransformFailedError(error, resolvedPath),
      trackedFiles,
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

function isPackageImportSpecifier(specifier: string): boolean {
  return !specifier.startsWith('./') && !specifier.startsWith('../') && !specifier.startsWith('/')
}

async function analyzeModuleSource(
  sourceText: string,
  resolvedPath: string,
  transformOptions: TsconfigTransformOptions,
  options: {
    define?: Record<string, string>
    minify: boolean
    sourceMaps?: 'external' | 'inline'
    target?: ScriptServerTarget
  },
) {
  let transformResult: { code: string; errors?: Array<{ message?: string }>; map?: unknown }
  try {
    transformResult = await oxcTransform(
      resolvedPath,
      sourceText,
      getTransformOptions(resolvedPath, transformOptions, options),
    )
    assertNoCompilerErrors(transformResult.errors, resolvedPath, 'transform')
  } catch (error) {
    if (isScriptServerCompilationError(error)) throw error
    throw createScriptServerCompilationError(
      `Failed to transform module ${resolvedPath}.\n\n${formatUnknownError(error)}`,
      {
        cause: error,
        code: 'MODULE_TRANSFORM_FAILED',
      },
    )
  }

  let rawCode = transformResult.code.trimEnd()
  let sourcemap = stringifySourceMap(transformResult.map)

  if (options.minify) {
    let minifyResult = await minifyModule(rawCode, resolvedPath, options.target, options.sourceMaps)
    rawCode = minifyResult.code.trimEnd()
    let minifyMap = stringifySourceMap(minifyResult.map)
    sourcemap =
      minifyMap == null
        ? sourcemap
        : sourcemap == null
          ? minifyMap
          : composeSourceMaps(minifyMap, sourcemap)
  }

  return {
    rawCode,
    sourcemap,
    unresolvedImports: await getUnresolvedImportsFromLexer(rawCode),
  }
}

async function minifyModule(
  rawCode: string,
  resolvedPath: string,
  target: string | undefined,
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
    if (isScriptServerCompilationError(error)) throw error
    throw createScriptServerCompilationError(
      `Failed to minify module ${resolvedPath}.\n\n${formatUnknownError(error)}`,
      {
        cause: error,
        code: 'MODULE_TRANSFORM_FAILED',
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
    target?: string
  },
) {
  let compilerOptions = transformOptions.tsconfigRaw?.compilerOptions as
    | Record<string, unknown>
    | undefined
  let useDefineForClassFields = getBooleanOption(compilerOptions, 'useDefineForClassFields')
  let jsxFactory = getStringOption(compilerOptions, 'jsxFactory')
  let jsxFragmentFactory = getStringOption(compilerOptions, 'jsxFragmentFactory')

  return {
    assumptions:
      useDefineForClassFields === false
        ? {
            setPublicClassFields: true,
          }
        : undefined,
    define: options.define,
    jsx: getJsxOptions(resolvedPath, compilerOptions),
    lang: getSourceLanguageForPath(resolvedPath),
    sourceType: 'module' as const,
    sourcemap: options.sourceMaps != null,
    target: options.target,
    typescript: {
      allowNamespaces: getBooleanOption(compilerOptions, 'allowNamespaces'),
      emitDecoratorMetadata: getBooleanOption(compilerOptions, 'emitDecoratorMetadata'),
      experimentalDecorators: getBooleanOption(compilerOptions, 'experimentalDecorators'),
      jsxPragma: jsxFactory,
      jsxPragmaFrag: jsxFragmentFactory,
      removeClassFieldsWithoutInitializer: useDefineForClassFields === false ? true : undefined,
    },
  }
}

function getJsxOptions(
  resolvedPath: string,
  compilerOptions?: Record<string, unknown>,
): 'preserve' | Record<string, unknown> | undefined {
  let language = getSourceLanguageForPath(resolvedPath)
  if (language !== 'jsx' && language !== 'tsx') return undefined

  let jsx = getStringOption(compilerOptions, 'jsx')
  let importSource = getStringOption(compilerOptions, 'jsxImportSource')
  let pragma = getStringOption(compilerOptions, 'jsxFactory')
  let pragmaFrag = getStringOption(compilerOptions, 'jsxFragmentFactory')

  if (jsx === 'preserve' || jsx === 'react-native') {
    return 'preserve'
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

  throw createScriptServerCompilationError(
    `Failed to ${operation} module ${resolvedPath}.\n\n${errors[0].message ?? 'Unknown error'}`,
    {
      code: 'MODULE_TRANSFORM_FAILED',
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

function toTransformFailedError(
  error: unknown,
  resolvedPath: string,
): ScriptServerCompilationError {
  if (isScriptServerCompilationError(error)) return error

  return createScriptServerCompilationError(
    `Failed to transform module ${resolvedPath}.\n\n${formatUnknownError(error)}`,
    {
      cause: error,
      code: 'MODULE_TRANSFORM_FAILED',
    },
  )
}

function isNoEntityError(error: unknown): error is NodeJS.ErrnoException & { code: 'ENOENT' } {
  return (
    error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
  )
}
