import { registerHooks } from 'node:module'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { transformComponentsForServer } from '@remix-run/ui-hmr'

import {
  analyzeNodeHmrSource,
  type NodeHmrAnalysis,
  type ResolvedNodeHmrAnalysis,
} from './lib/hmr-analysis.ts'
import { markNodeHmrParentProcess } from './lib/process-state.ts'
import { installNodeHmrRuntime } from './lib/runtime.ts'

markNodeHmrParentProcess()
const runtime = installNodeHmrRuntime({
  browserEventUrl: getBrowserEventUrl(),
})
const rootPath = getRegisterUrlParam('rootPath')
let invalidatedUrlTimestamps = new Map<string, number>()
let updateQueue = Promise.resolve()
const componentHmrRuntimeUrl = import.meta.resolve('@remix-run/ui-hmr/server-runtime')

const componentHmrRefreshSpecifiers = ['remix/ui/dev/refresh', '@remix-run/ui/dev/refresh'] as const

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

function getRegisterUrlParam(name: string): string | undefined {
  let value = new URL(import.meta.url).searchParams.get(name)
  return value ?? undefined
}

function getBrowserEventUrl(): string | undefined {
  let eventUrl = getRegisterUrlParam('browserEventUrl')
  if (eventUrl === undefined) return undefined
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
  if (isBrowserHmrFileEventsMessage(message)) {
    runtime.handleBrowserHmrFileEvents(message.requestId, message.events)
    return
  }

  if (!isHmrUpdateMessage(message)) return

  updateQueue = updateQueue.then(() => handleHotUpdateMessage(message))
  void updateQueue
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

  let result = transformComponentsForServer(source, {
    moduleUrl: url,
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
    type: 'node-hmr:child:module-analyzed',
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
    type: 'node-hmr:child:module-imported',
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

async function handleHotUpdateMessage(message: {
  acceptedUrl?: string
  invalidatedUrls?: Record<string, number>
  timestamp: number
  type: 'node-hmr:parent:hot-module-changed'
  url: string
}): Promise<void> {
  invalidatedUrlTimestamps = new Map(Object.entries(message.invalidatedUrls ?? {}))
  try {
    await runtime.update(message.url, message.timestamp, message.acceptedUrl)
  } catch (error: unknown) {
    process.send?.({
      type: 'node-hmr:child:restart-requested',
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

function isHmrUpdateMessage(message: unknown): message is {
  acceptedUrl?: string
  invalidatedUrls?: Record<string, number>
  timestamp: number
  type: 'node-hmr:parent:hot-module-changed'
  url: string
} {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'node-hmr:parent:hot-module-changed' &&
    'url' in message &&
    typeof message.url === 'string' &&
    'timestamp' in message &&
    typeof message.timestamp === 'number' &&
    (!('acceptedUrl' in message) || typeof message.acceptedUrl === 'string') &&
    (!('invalidatedUrls' in message) || isInvalidatedUrls(message.invalidatedUrls))
  )
}

function isBrowserHmrFileEventsMessage(message: unknown): message is {
  events: Array<{ event: 'add' | 'change' | 'unlink'; filePath: string }>
  requestId: number
  type: 'node-hmr:parent:browser-hmr-file-events'
} {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'node-hmr:parent:browser-hmr-file-events' &&
    'requestId' in message &&
    typeof message.requestId === 'number' &&
    'events' in message &&
    Array.isArray(message.events) &&
    message.events.every(
      (event) =>
        typeof event === 'object' &&
        event !== null &&
        'filePath' in event &&
        typeof event.filePath === 'string' &&
        'event' in event &&
        (event.event === 'add' || event.event === 'change' || event.event === 'unlink'),
    )
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
  runtime.disposeAll().finally(() => {
    if (process.listenerCount(signal) === 0) {
      process.exit(signal === 'SIGINT' ? 130 : 143)
    }
  })
}
