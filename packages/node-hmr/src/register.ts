import { registerHooks } from 'node:module'
import { createRequire } from 'node:module'
import { Server } from 'node:net'
import { dirname, isAbsolute, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { transformComponentHmr } from '@remix-run/ui-hmr/transform'

import {
  analyzeNodeHmrSource,
  type NodeHmrAnalysis,
  type ResolvedNodeHmrAnalysis,
} from './lib/hmr-analysis.ts'
import { installNodeHmrRuntime } from './lib/runtime.ts'

const runtime = installNodeHmrRuntime({ browserEventUrl: getBrowserEventUrl() })
const rootPath = process.env.REMIX_NODE_HMR_ROOT
let invalidatedUrlTimestamps = new Map<string, number>()
const componentHmrRuntimeUrl = import.meta.resolve('@remix-run/ui-hmr/runtime')

const componentHmrRefreshSpecifiers = ['remix/ui/dev/refresh', '@remix-run/ui/dev/refresh'] as const

patchServerListen()

registerHooks({
  resolve(specifier, context, nextResolve) {
    let result = nextResolve(specifier, context)
    reportModuleImport(context.parentURL, result.url)
    return result
  },

  load(url, context, nextLoad) {
    let result = nextLoad(url, context)
    let source = result.source

    if (!shouldTransformModule(url, result.format, source)) return result

    let canonicalUrl = getCanonicalUrl(url)
    let transformedSource = transformSource(canonicalUrl, source)
    transformedSource = rewriteInvalidatedImports(canonicalUrl, transformedSource)
    let hmrAnalysis = analyzeNodeHmrSource(canonicalUrl, transformedSource)

    if (!hmrAnalysis.usesImportMetaHot) {
      reportModuleUpdate(canonicalUrl, {
        acceptedDeps: [],
        selfAccepting: false,
        usesImportMetaHot: false,
      })

      return {
        ...result,
        source: transformedSource,
      }
    }

    reportModuleUpdate(canonicalUrl, {
      acceptedDeps: [],
      selfAccepting: hmrAnalysis.selfAccepting,
      usesImportMetaHot: true,
    })

    return {
      ...result,
      source: injectHotContext(canonicalUrl, transformedSource, hmrAnalysis),
    }
  },
})

function getBrowserEventUrl(): string | undefined {
  let eventUrl = new URL(import.meta.url).searchParams.get('browserEventUrl')
  if (eventUrl === null) return undefined
  return isHttpUrl(eventUrl) ? eventUrl : undefined
}

function isHttpUrl(value: string): boolean {
  try {
    let url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

process.on('message', (message: unknown) => {
  if (!isHmrUpdateMessage(message)) return

  invalidatedUrlTimestamps = new Map(Object.entries(message.invalidatedUrls ?? {}))
  runtime.update(message.url, message.timestamp, message.acceptedUrl).catch((error: unknown) => {
    process.send?.({
      type: 'hmr:restart',
      message: error instanceof Error ? error.message : String(error),
    })
  })
})

process.once('SIGINT', () => disposeOnSignal('SIGINT'))
process.once('SIGTERM', () => disposeOnSignal('SIGTERM'))

function shouldTransformModule(
  url: string,
  format: string | null | undefined,
  source: unknown,
): source is string {
  if (!url.startsWith('file:')) return false
  if (format !== 'module') return false
  if (typeof source !== 'string') return false

  return true
}

function injectHotContext(url: string, source: string, hmr: NodeHmrAnalysis): string {
  let resolveDependencyExpression = `(specifier) => { let url = new URL(import.meta.resolve(specifier)); url.search = ''; url.hash = ''; return url.href }`

  return [
    `const __remixNodeHmrResolveDependency = ${resolveDependencyExpression};`,
    `globalThis.__remixNodeHmr.reportAcceptedDependencies(${JSON.stringify(url)}, ${getAcceptedDependencyExpression(hmr)});`,
    `import.meta.hot = globalThis.__remixNodeHmr.createHotContext(${JSON.stringify(url)}, __remixNodeHmrResolveDependency);`,
    source,
  ].join('\n')
}

function getAcceptedDependencyExpression(hmr: NodeHmrAnalysis): string {
  return `[${hmr.acceptedDeps
    .map(
      (acceptedDep) => `__remixNodeHmrResolveDependency(${JSON.stringify(acceptedDep.specifier)})`,
    )
    .join(', ')}]`
}

function transformSource(url: string, source: string): string {
  let filePath = fileURLToPath(url)
  if (
    url.includes('/node_modules/') ||
    (rootPath !== undefined && !isInsideRoot(filePath, rootPath))
  ) {
    return source
  }

  let componentHmrRefreshSpecifier = resolveComponentHmrRefreshSpecifier(url)
  if (componentHmrRefreshSpecifier === null) return source

  let result = transformComponentHmr(source, {
    moduleUrl: url,
    refreshSpecifier: componentHmrRefreshSpecifier,
    runtimeSpecifier: componentHmrRuntimeUrl,
  })

  return result.code
}

function resolveComponentHmrRefreshSpecifier(url: string): string | null {
  let filePath = fileURLToPath(url)
  let require = createRequire(url)
  let paths = [dirname(filePath)]

  for (let refreshSpecifier of componentHmrRefreshSpecifiers) {
    try {
      require.resolve(refreshSpecifier, { paths })
      return refreshSpecifier
    } catch {}
  }

  return null
}

function rewriteInvalidatedImports(url: string, source: string): string {
  if (invalidatedUrlTimestamps.size === 0) return source

  let replacements: Array<{ end: number; specifier: string; start: number }> = []
  let staticSpecifierPattern =
    /\b(?:import\s+(?:[^'"()]*?\s+from\s*)?|export\s+[^'"()]*?\s+from\s*)(["'])([^"']+)\1/g

  for (let match of source.matchAll(staticSpecifierPattern)) {
    let quote = match[1]
    let specifier = match[2]
    if (quote === undefined || specifier === undefined || match.index === undefined) continue

    let resolvedUrl = new URL(specifier, url).href
    let timestamp = invalidatedUrlTimestamps.get(getCanonicalUrl(resolvedUrl))
    if (timestamp === undefined) continue

    let specifierStart = match.index + match[0].length - specifier.length - quote.length
    replacements.push({
      end: specifierStart + specifier.length,
      specifier: addTimestampQuery(specifier, timestamp),
      start: specifierStart,
    })
  }

  if (replacements.length === 0) return source

  let rewrittenSource = ''
  let position = 0
  for (let replacement of replacements) {
    rewrittenSource += source.slice(position, replacement.start)
    rewrittenSource += replacement.specifier
    position = replacement.end
  }
  rewrittenSource += source.slice(position)
  return rewrittenSource
}

function reportModuleUpdate(url: string, hmr: ResolvedNodeHmrAnalysis): void {
  process.send?.({
    type: 'module-update',
    url,
    filePath: fileURLToPath(url),
    hmr,
  })
}

function reportModuleImport(parentUrl: string | undefined, url: string): void {
  if (parentUrl === undefined) return

  let canonicalParentUrl = getCanonicalUrl(parentUrl)
  let canonicalUrl = getCanonicalUrl(url)
  if (!canonicalParentUrl.startsWith('file:') || !canonicalUrl.startsWith('file:')) return

  process.send?.({
    type: 'module-import',
    importerFilePath: fileURLToPath(canonicalParentUrl),
    importerUrl: canonicalParentUrl,
    depFilePath: fileURLToPath(canonicalUrl),
    depUrl: canonicalUrl,
  })
}

function getCanonicalUrl(url: string): string {
  let parsedUrl = new URL(url)
  parsedUrl.search = ''
  parsedUrl.hash = ''
  return parsedUrl.href
}

function addTimestampQuery(specifier: string, timestamp: number): string {
  return `${specifier}${specifier.includes('?') ? '&' : '?'}t=${timestamp}`
}

function isInsideRoot(filePath: string, root: string): boolean {
  let relativePath = relative(root, filePath)
  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath))
}

function isHmrUpdateMessage(message: unknown): message is {
  acceptedUrl?: string
  invalidatedUrls?: Record<string, number>
  timestamp: number
  type: 'hmr:update'
  url: string
} {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'hmr:update' &&
    'url' in message &&
    typeof message.url === 'string' &&
    'timestamp' in message &&
    typeof message.timestamp === 'number' &&
    (!('acceptedUrl' in message) || typeof message.acceptedUrl === 'string') &&
    (!('invalidatedUrls' in message) || isInvalidatedUrls(message.invalidatedUrls))
  )
}

function isInvalidatedUrls(value: unknown): value is Record<string, number> {
  if (typeof value !== 'object' || value === null) return false

  for (let timestamp of Object.values(value)) {
    if (typeof timestamp !== 'number') return false
  }

  return true
}

function disposeOnSignal(signal: NodeJS.Signals) {
  runtime.disposeAll()

  if (process.listenerCount(signal) === 0) {
    process.exit(signal === 'SIGINT' ? 130 : 143)
  }
}

function patchServerListen(): void {
  let originalListen = Server.prototype.listen

  function listen(this: Server): Server {
    let server = this
    server.once('listening', () => {
      process.send?.({
        type: 'server-ready',
      })
    })

    return Reflect.apply(originalListen, server, Array.from(arguments)) as Server
  }

  Server.prototype.listen = listen as typeof Server.prototype.listen
}
