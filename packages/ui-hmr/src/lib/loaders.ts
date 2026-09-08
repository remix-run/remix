import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { transformComponentsForBrowser, transformComponentsForServer } from './transform.ts'
import type { UiHmrImportSource } from './transform.ts'

interface ServerModuleHooks {
  load: ServerModuleLoadHook
}

type ServerModuleLoadHook = (
  url: string,
  context: ModuleLoadContext,
  nextLoad: NextServerModuleLoader,
) => ModuleLoadResult

type NextServerModuleLoader = (
  url: string,
  context?: Partial<ModuleLoadContext>,
) => ModuleLoadNextResult

type BrowserModuleLoader = (
  url: string,
  context: ModuleLoadContext,
  nextLoad: NextBrowserModuleLoader,
) => ModuleLoadResult

type NextBrowserModuleLoader = (
  url: string,
  context?: Partial<ModuleLoadContext>,
) => ModuleLoadNextResult

interface ModuleLoadContext {
  conditions: string[]
  format: string | null | undefined
  importAttributes: Record<string, string | undefined>
  moduleUrl?: string
}

type ModuleFloat16Array = typeof globalThis extends {
  Float16Array: { prototype: infer array }
}
  ? array
  : never

type ModuleTypedArray =
  | Uint8Array
  | Uint8ClampedArray
  | Uint16Array
  | Uint32Array
  | Int8Array
  | Int16Array
  | Int32Array
  | BigUint64Array
  | BigInt64Array
  | ModuleFloat16Array
  | Float32Array
  | Float64Array

type ModuleLoadSource = string | ArrayBuffer | ModuleTypedArray

interface ModuleLoadResult {
  format: string | null | undefined
  shortCircuit?: boolean
  source?: ModuleLoadSource
}

interface ModuleLoadNextResult {
  format: string | null | undefined
  shortCircuit?: boolean
  source?: ModuleLoadSource
}

type Runtime = 'browser' | 'server'

const importPresets = [
  {
    browserRuntimeSpecifier: 'remix/ui-hmr/runtime/browser',
    importSource: 'remix',
    refreshSpecifier: 'remix/ui/dev/refresh',
    serverRuntimeSpecifier: 'remix/ui-hmr/runtime/server',
  },
  {
    browserRuntimeSpecifier: '@remix-run/ui-hmr/runtime/browser',
    importSource: '@remix-run',
    refreshSpecifier: '@remix-run/ui/dev/refresh',
    serverRuntimeSpecifier: '@remix-run/ui-hmr/runtime/server',
  },
] as const satisfies ReadonlyArray<{
  browserRuntimeSpecifier: string
  importSource: UiHmrImportSource
  refreshSpecifier: string
  serverRuntimeSpecifier: string
}>

export function createAssetsUiHmrLoader(): BrowserModuleLoader {
  return (url, context, nextLoad) => {
    let result = nextLoad(url, context)
    return transformLoadResult(url, context, result, 'browser')
  }
}

export function createServerUiHmrModuleHooks(): ServerModuleHooks {
  return {
    load(url, context, nextLoad) {
      let result = nextLoad(url, context)
      return transformLoadResult(url, context, result, 'server')
    },
  }
}

function transformLoadResult(
  url: string,
  context: ModuleLoadContext,
  result: ModuleLoadNextResult,
  runtime: Runtime,
): ModuleLoadResult {
  if (!shouldTransformModule(url, result)) return result

  let source = stripInlineSourceMap(moduleLoadSourceToString(result.source))
  let importSource = detectImportSource(url, runtime)
  if (importSource === null) return result

  let transformResult =
    runtime === 'browser'
      ? transformComponentsForBrowser(source, {
          importSource,
          moduleUrl: context.moduleUrl ?? url,
          sourceMap: true,
        })
      : transformComponentsForServer(source, {
          importSource,
          moduleUrl: getCanonicalUrl(url),
          sourceMap: true,
        })

  return transformResult.transformed
    ? {
        ...result,
        format: result.format ?? context.format ?? 'module',
        source: appendInlineSourceMap(transformResult.code, transformResult.map),
      }
    : result
}

function shouldTransformModule(
  url: string,
  result: ModuleLoadNextResult,
): result is ModuleLoadNextResult & { source: ModuleLoadSource } {
  if (!url.startsWith('file:')) return false
  if (url.includes('/node_modules/')) return false
  if (result.format !== undefined && result.format !== null && result.format !== 'module') {
    return false
  }
  return result.source !== undefined && result.source !== null
}

function moduleLoadSourceToString(source: ModuleLoadSource): string {
  if (typeof source === 'string') return source
  return new TextDecoder().decode(source)
}

function stripInlineSourceMap(source: string): string {
  return source.replace(
    /(?:\/\/# sourceMappingURL=data:application\/json;base64,[A-Za-z0-9+/=]+|\/\*# sourceMappingURL=data:application\/json;base64,[A-Za-z0-9+/=]+ \*\/)\s*$/g,
    '',
  )
}

function appendInlineSourceMap(source: string, sourceMap: string | null): string {
  if (sourceMap === null) return source
  let encoded = Buffer.from(sourceMap).toString('base64')
  return `${source}\n//# sourceMappingURL=data:application/json;base64,${encoded}`
}

function getCanonicalUrl(url: string): string {
  let canonicalUrl = new URL(url)
  canonicalUrl.search = ''
  canonicalUrl.hash = ''
  return canonicalUrl.href
}

function detectImportSource(url: string, runtime: Runtime): UiHmrImportSource | null {
  let filePath: string
  try {
    filePath = fileURLToPath(url)
  } catch {
    return null
  }

  let require = createRequire(filePath)
  let paths = [dirname(filePath)]

  for (let preset of importPresets) {
    if (canResolvePreset(preset, runtime, require, paths)) return preset.importSource
  }

  return null
}

function canResolvePreset(
  preset: (typeof importPresets)[number],
  runtime: Runtime,
  require: NodeJS.Require,
  paths: string[],
): boolean {
  let specifiers =
    runtime === 'browser'
      ? [preset.browserRuntimeSpecifier, preset.refreshSpecifier]
      : [preset.serverRuntimeSpecifier]

  for (let specifier of specifiers) {
    try {
      require.resolve(specifier, { paths })
    } catch {
      return false
    }
  }

  return true
}
