import { spawn, type ChildProcess } from 'node:child_process'
import { createServer, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, relative, resolve } from 'node:path'

import { createStyles } from '@remix-run/terminal'
import { watch } from 'chokidar'

import { defaultBrowserEventChannelPathname, type HmrEventPayload } from './lib/browser-events.ts'
import { shouldIgnoreWatchPath } from './lib/cli-args.ts'
import type { ServerHmrEvent } from './lib/events.ts'

export interface RunOptions {
  browserEventChannel?: boolean | BrowserEventChannelOptions
  cwd?: string
  entryArgs?: readonly string[]
  env?: NodeJS.ProcessEnv
  nodeArgs?: readonly string[]
}

export interface BrowserEventChannelOptions {
  host?: string
  port?: number
  pathname?: string
}

export interface NodeHmrRunner {
  close(): Promise<void>
}

interface NodeHmrModuleInfo {
  filePath: string
  hmr: {
    acceptedDeps: string[]
    selfAccepting: boolean
    usesImportMetaHot: boolean
  }
  url: string
}

interface NodeHmrUpdate {
  acceptedUrl: string
  filePath: string
  invalidatedUrls: Record<string, number>
  url: string
}

type ChildMessage =
  | {
      payload: HmrEventPayload
      type: 'hmr-event:send'
    }
  | {
      type: 'hmr:restart'
      message?: string
    }
  | {
      type: 'module-import'
      depFilePath: string
      depUrl: string
      importerFilePath: string
      importerUrl: string
    }
  | {
      type: 'module-accepted-deps-resolved'
      acceptedDeps: string[]
      url: string
    }
  | {
      type: 'module-update'
      filePath: string
      hmr: NodeHmrModuleInfo['hmr']
      url: string
    }
  | {
      event: ServerHmrEvent
      type: 'server-hmr:event'
    }
  | {
      type: 'server-ready'
    }

const restartDelayMs = 50
const shutdownTimeoutMs = 5_000
const styles = createStyles()

function resolveRegisterPath(): string {
  let extension = import.meta.url.endsWith('.ts') ? 'ts' : 'js'

  return fileURLToPath(new URL(`./register.${extension}`, import.meta.url))
}

export function run(entry: string, options: RunOptions = {}): NodeHmrRunner {
  let controller = createWatchedProcessController({
    browserEventChannel: normalizeBrowserEventChannelOptions(options.browserEventChannel),
    cwd: options.cwd ?? process.cwd(),
    entry,
    entryArgs: [...(options.entryArgs ?? [])],
    env: options.env ?? process.env,
    nodeArgs: [...(options.nodeArgs ?? [])],
    registerPath: resolveRegisterPath(),
  })

  let closed = controller.start()
  closed.catch((error: unknown) => {
    console.error(error)
  })

  return {
    close() {
      return controller.stop()
    },
  }
}

function normalizeBrowserEventChannelOptions(
  options: RunOptions['browserEventChannel'],
): BrowserEventChannelOptions | null {
  if (!options) return null
  if (options === true) return {}

  if (options.port !== undefined) {
    assertValidPort(options.port)
  }

  return options
}

function createWatchedProcessController(options: {
  browserEventChannel: BrowserEventChannelOptions | null
  cwd: string
  entry: string
  entryArgs: string[]
  env: NodeJS.ProcessEnv
  nodeArgs: string[]
  registerPath: string
}): {
  start(): Promise<void>
  stop(signal?: NodeJS.Signals): Promise<void>
} {
  let browserEventChannel: BrowserEventChannel | null = null
  let child: ChildProcess | undefined
  let restartTimer: NodeJS.Timeout | undefined
  let resolveRun: (() => void) | undefined
  let moduleInfoByFilePath = new Map<string, NodeHmrModuleInfo[]>()
  let moduleInfoByUrl = new Map<string, NodeHmrModuleInfo>()
  let moduleDepsByUrl = new Map<string, Set<string>>()
  let watchedFilePaths = new Set<string>()
  let watchedDirectoryRefCounts = new Map<string, number>()
  let pendingChangedPaths = new Set<string>()
  let pendingRestartPaths = new Set<string>()
  let restarting = false
  let stopping = false
  let waitingForFileChangeAfterExit = false
  let pendingServerUpdateEvent = false

  function getEntryPath(): string {
    return resolve(options.cwd, options.entry)
  }

  function start() {
    moduleInfoByFilePath = new Map()
    moduleInfoByUrl = new Map()
    moduleDepsByUrl = new Map()
    unwatchKnownModuleFiles()
    watchKnownModuleFile(getEntryPath())
    waitingForFileChangeAfterExit = false

    let entry = getEntryPath()
    let nextChild = spawn(
      process.execPath,
      buildNodeArgs({
        entry,
        browserEventUrl: browserEventChannel?.url,
        entryArgs: options.entryArgs,
        nodeArgs: options.nodeArgs,
        registerPath: options.registerPath,
      }),
      {
        cwd: options.cwd,
        env: {
          ...options.env,
          REMIX_NODE_HMR: '1',
          REMIX_NODE_HMR_ROOT: options.cwd,
        },
        stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
      },
    )

    child = nextChild

    nextChild.on('message', (message: unknown) => {
      if (child !== nextChild) return
      handleChildMessage(message)
    })

    nextChild.once('exit', (code, signal) => {
      if (stopping || restarting || child !== nextChild) return
      waitingForFileChangeAfterExit = true
      pendingServerUpdateEvent = true
      child = undefined
      console.log(`Failed running ${options.entry}. Waiting for file changes before restarting...`)
    })
  }

  async function restart() {
    if (stopping) return
    restarting = true
    await stopChild(child)
    restarting = false
    start()
  }

  function handleChildMessage(message: unknown) {
    if (!isChildMessage(message)) return

    if (message.type === 'hmr-event:send') {
      browserEventChannel?.send(message.payload)
      return
    }

    if (message.type === 'server-hmr:event') {
      browserEventChannel?.send(toServerUpdatePayload(message.event))
      return
    }

    if (message.type === 'server-ready') {
      flushPendingServerUpdateEvent()
      return
    }

    if (message.type === 'hmr:restart') {
      if (message.message !== undefined) {
        console.warn(message.message)
      }

      pendingServerUpdateEvent = true
      logRestart(message.message ?? 'import.meta.hot.invalidate()')
      restart().catch((error: unknown) => {
        console.error(error)
      })
      return
    }

    if (message.type === 'module-import') {
      let deps = moduleDepsByUrl.get(message.importerUrl)
      if (!deps) {
        deps = new Set()
        moduleDepsByUrl.set(message.importerUrl, deps)
      }
      deps.add(message.depUrl)
      return
    }

    if (message.type === 'module-accepted-deps-resolved') {
      let moduleInfo = moduleInfoByUrl.get(message.url)
      if (moduleInfo !== undefined) {
        moduleInfo.hmr.acceptedDeps = message.acceptedDeps
      }
      return
    }

    let existingModules = moduleInfoByFilePath.get(message.filePath) ?? []
    let nextInfo: NodeHmrModuleInfo = {
      filePath: message.filePath,
      hmr: message.hmr,
      url: message.url,
    }
    let moduleIndex = existingModules.findIndex((info) => info.url === message.url)
    moduleDepsByUrl.set(message.url, new Set())

    if (moduleIndex === -1) {
      moduleInfoByFilePath.set(message.filePath, [...existingModules, nextInfo])
    } else {
      existingModules[moduleIndex] = nextInfo
      moduleInfoByFilePath.set(message.filePath, existingModules)
    }
    moduleInfoByUrl.set(message.url, nextInfo)
    syncWatchedModuleFiles()
  }

  function watchKnownModuleFile(filePath: string): void {
    syncWatchedModuleFiles(new Set([resolve(filePath)]))
  }

  function syncWatchedModuleFiles(requiredFilePaths: Set<string> = new Set()): void {
    let nextWatchedFilePaths = new Set(requiredFilePaths)

    for (let url of getReachableModuleUrls()) {
      let moduleInfo = moduleInfoByUrl.get(url)
      if (moduleInfo !== undefined) {
        nextWatchedFilePaths.add(moduleInfo.filePath)
      }
    }

    let nextWatchedDirectoryRefCounts = new Map<string, number>()
    for (let filePath of nextWatchedFilePaths) {
      let directory = dirname(filePath)
      nextWatchedDirectoryRefCounts.set(
        directory,
        (nextWatchedDirectoryRefCounts.get(directory) ?? 0) + 1,
      )
    }

    let directoriesToAdd = [...nextWatchedDirectoryRefCounts.keys()].filter(
      (directory) => !watchedDirectoryRefCounts.has(directory),
    )
    let directoriesToRemove = [...watchedDirectoryRefCounts.keys()].filter(
      (directory) => !nextWatchedDirectoryRefCounts.has(directory),
    )

    if (directoriesToRemove.length > 0) {
      watcher.unwatch(directoriesToRemove)
    }
    if (directoriesToAdd.length > 0) {
      watcher.add(directoriesToAdd)
    }

    watchedFilePaths = nextWatchedFilePaths
    watchedDirectoryRefCounts = nextWatchedDirectoryRefCounts
  }

  function getReachableModuleUrls(): Set<string> {
    let entryUrl = pathToFileURL(getEntryPath()).href
    let reachable = new Set<string>()
    visit(entryUrl)
    return reachable

    function visit(url: string): void {
      if (reachable.has(url)) return
      if (!moduleInfoByUrl.has(url)) return

      reachable.add(url)
      for (let depUrl of moduleDepsByUrl.get(url) ?? []) {
        visit(depUrl)
      }
    }
  }

  function unwatchKnownModuleFiles(): void {
    let directories = [...watchedDirectoryRefCounts.keys()]
    watchedFilePaths = new Set()
    watchedDirectoryRefCounts = new Map()

    if (directories.length > 0) {
      watcher.unwatch(directories)
    }
  }

  function handleWatchEvent(event: string, changedPath: string) {
    if (restartTimer !== undefined) {
      clearTimeout(restartTimer)
    }

    if (event === 'change') {
      pendingChangedPaths.add(resolve(options.cwd, changedPath))
    } else {
      pendingRestartPaths.add(resolve(options.cwd, changedPath))
    }

    restartTimer = setTimeout(() => {
      flushPendingWatchEvents().catch((error: unknown) => {
        console.error(error)
      })
    }, restartDelayMs)
  }

  async function flushPendingWatchEvents() {
    let changedPaths = [...pendingChangedPaths]
    pendingChangedPaths = new Set()

    let restartPaths = [...pendingRestartPaths]
    pendingRestartPaths = new Set()
    restartTimer = undefined

    if (waitingForFileChangeAfterExit) {
      logRestart(formatChangedPaths([...restartPaths, ...changedPaths], options.cwd))
      pendingServerUpdateEvent = true
      start()
      return
    }

    restartPaths = restartPaths.filter((changedPath) => watchedFilePaths.has(changedPath))

    if (restartPaths.length > 0) {
      logRestart(formatChangedPaths(restartPaths, options.cwd))
      pendingServerUpdateEvent = true
      await restart()
      return
    }

    let hotUpdates: NodeHmrUpdate[] = []
    for (let changedPath of changedPaths) {
      if (!watchedFilePaths.has(changedPath)) continue

      let modules = moduleInfoByFilePath.get(changedPath)
      if (modules === undefined || modules.length === 0) {
        logRestart(formatChangedPath(changedPath, options.cwd))
        pendingServerUpdateEvent = true
        await restart()
        return
      }

      for (let moduleInfo of modules) {
        if (moduleInfo.hmr.selfAccepting) {
          hotUpdates.push({
            acceptedUrl: moduleInfo.url,
            filePath: moduleInfo.filePath,
            invalidatedUrls: getInvalidatedUrls([moduleInfo.url], Date.now()),
            url: moduleInfo.url,
          })
          continue
        }

        let propagation = findHmrPropagation(moduleInfo.url, Date.now())
        if (!propagation) {
          logRestart(formatChangedPath(changedPath, options.cwd))
          pendingServerUpdateEvent = true
          await restart()
          return
        }

        hotUpdates.push(
          ...propagation.map((update) => ({ ...update, filePath: moduleInfo.filePath })),
        )
      }
    }

    for (let moduleInfo of hotUpdates) {
      if (!sendHotUpdate(moduleInfo)) {
        logRestart(formatChangedPath(moduleInfo.filePath, options.cwd))
        pendingServerUpdateEvent = true
        await restart()
        return
      }
    }

    if (hotUpdates.length > 0) {
      logHotUpdate(
        formatChangedPaths(
          hotUpdates.map((moduleInfo) => moduleInfo.filePath),
          options.cwd,
        ),
      )
    }
  }

  function flushPendingServerUpdateEvent(): void {
    if (!pendingServerUpdateEvent) return

    browserEventChannel?.send({
      type: 'server:update',
    })
    pendingServerUpdateEvent = false
  }

  function findHmrPropagation(
    url: string,
    timestamp: number,
    traversed: Set<string> = new Set(),
    invalidatedUrls: string[] = [url],
  ): Array<Omit<NodeHmrUpdate, 'filePath'>> | null {
    if (traversed.has(url)) return []
    traversed.add(url)

    let moduleInfo = moduleInfoByUrl.get(url)
    if (moduleInfo === undefined) return null

    if (moduleInfo.hmr.selfAccepting) {
      return [
        {
          acceptedUrl: url,
          invalidatedUrls: getInvalidatedUrls(invalidatedUrls, timestamp),
          url,
        },
      ]
    }

    let importers = [...moduleInfoByUrl.values()].filter(
      (moduleInfo) => moduleDepsByUrl.get(moduleInfo.url)?.has(url) === true,
    )
    if (importers.length === 0) return null

    let updates: Array<Omit<NodeHmrUpdate, 'filePath'>> = []
    for (let moduleInfo of importers) {
      if (moduleInfo.hmr.acceptedDeps.includes(url)) {
        updates.push({
          acceptedUrl: url,
          invalidatedUrls: getInvalidatedUrls(invalidatedUrls, timestamp),
          url: moduleInfo.url,
        })
        continue
      }

      let importerUpdates = findHmrPropagation(moduleInfo.url, timestamp, traversed, [
        ...invalidatedUrls,
        moduleInfo.url,
      ])
      if (!importerUpdates) return null
      updates.push(...importerUpdates)
    }

    return dedupeNodeHmrUpdates(updates)
  }

  function getInvalidatedUrls(urls: readonly string[], timestamp: number): Record<string, number> {
    let invalidatedUrls: Record<string, number> = {}
    for (let url of urls) {
      invalidatedUrls[url] = timestamp
    }
    return invalidatedUrls
  }

  function sendHotUpdate(moduleInfo: NodeHmrUpdate): boolean {
    if (child === undefined || child.send === undefined || !child.connected) return false

    return child.send({
      acceptedUrl: moduleInfo.acceptedUrl,
      invalidatedUrls: moduleInfo.invalidatedUrls,
      type: 'hmr:update',
      url: moduleInfo.url,
      timestamp: Date.now(),
    })
  }

  let watcher = watch([], {
    cwd: options.cwd,
    ignoreInitial: true,
    ignored: (path) => shouldIgnoreWatchPath(path),
  })

  watcher.on('all', handleWatchEvent)

  let stopPromise: Promise<void> | undefined

  async function stop(signal: NodeJS.Signals = 'SIGTERM'): Promise<void> {
    stopping = true
    if (restartTimer !== undefined) {
      clearTimeout(restartTimer)
    }

    stopPromise ??= Promise.resolve()
      .then(() => watcher.close())
      .then(() => stopChild(child, signal))
      .then(() => browserEventChannel?.close())
      .then(() => {
        resolveRun?.()
      })

    await stopPromise
  }

  return {
    async start() {
      try {
        browserEventChannel =
          options.browserEventChannel === null
            ? null
            : await createBrowserEventChannel(options.browserEventChannel)
      } catch (error) {
        await watcher.close()
        throw error
      }

      return await new Promise<void>((resolvePromise) => {
        resolveRun = resolvePromise
        start()

        process.once('SIGINT', () => {
          stop('SIGINT').catch((error: unknown) => {
            console.error(error)
          })
        })
        process.once('SIGTERM', () => {
          stop('SIGTERM').catch((error: unknown) => {
            console.error(error)
          })
        })
      })
    },

    stop,
  }
}

interface BrowserEventChannel {
  close(): Promise<void>
  send(payload: HmrEventPayload): void
  url: string
}

interface HmrEventClient {
  close(): void
  send(payload: HmrEventPayload): void
}

async function createBrowserEventChannel(
  options: BrowserEventChannelOptions,
): Promise<BrowserEventChannel> {
  let host = options.host ?? '127.0.0.1'
  let pathname = options.pathname ?? defaultBrowserEventChannelPathname
  let port = options.port ?? 0
  let clients = new Set<HmrEventClient>()
  let server: Server

  server = createServer((request, response) => {
    if (request.url === undefined) {
      response.writeHead(404).end()
      return
    }

    let requestUrl = new URL(request.url, `http://${host}`)

    if (request.method === 'OPTIONS' && requestUrl.pathname === pathname) {
      writeCorsHeaders(response, 204)
      response.end()
      return
    }

    if (request.method !== 'GET' || requestUrl.pathname !== pathname) {
      response.writeHead(404).end()
      return
    }

    response.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream; charset=utf-8',
      'X-Accel-Buffering': 'no',
    })
    response.flushHeaders()

    let client: HmrEventClient = {
      close() {
        response.end()
        clients.delete(client)
      },
      send(payload) {
        response.write(formatServerSentEvent(payload))
      },
    }

    clients.add(client)
    response.once('close', () => {
      clients.delete(client)
    })
    response.write(': connected\n\n')
  })

  let url = await new Promise<string>((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      server.off('error', reject)
      let address = server.address()
      if (!isAddressInfo(address)) {
        reject(new Error('Failed to start node HMR browser event channel.'))
        return
      }

      resolvePromise(`http://${host}:${address.port}${pathname}`)
    })
  })

  return {
    async close() {
      for (let client of clients) {
        client.close()
      }
      clients.clear()

      await new Promise<void>((resolvePromise, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }
          resolvePromise()
        })
      })
    },

    send(payload) {
      for (let client of clients) {
        client.send(payload)
      }
    },

    url,
  }
}

function writeCorsHeaders(response: ServerResponse, status: number): void {
  response.writeHead(status, {
    'Access-Control-Allow-Headers': 'Cache-Control',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  })
}

function toServerUpdatePayload(event: ServerHmrEvent): HmrEventPayload {
  void event

  return {
    type: 'server:update',
  }
}

function formatServerSentEvent(payload: HmrEventPayload): string {
  return `data: ${JSON.stringify(payload)}\n\n`
}

export function buildNodeArgs(options: {
  browserEventUrl?: string
  entry: string
  entryArgs: Array<string>
  nodeArgs: Array<string>
  registerPath: string
}): Array<string> {
  let registerUrl = pathToFileURL(options.registerPath)
  if (options.browserEventUrl !== undefined) {
    registerUrl.searchParams.set('browserEventUrl', options.browserEventUrl)
  }

  return [...options.nodeArgs, '--import', registerUrl.href, options.entry, ...options.entryArgs]
}

function assertValidPort(port: number): void {
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new TypeError(`Invalid browser event channel port: ${port}`)
  }
}

function isAddressInfo(value: string | AddressInfo | null): value is AddressInfo {
  return typeof value === 'object' && value !== null && typeof value.port === 'number'
}

function logHotUpdate(reason: string): void {
  console.log(`${styles.green('hmr update')} ${reason}`)
}

function logRestart(reason: string): void {
  console.log(`${styles.yellow('restart')} ${reason}`)
}

function formatChangedPaths(paths: string[], cwd: string): string {
  return [...new Set(paths.map((path) => formatChangedPath(path, cwd)))].join(', ')
}

function formatChangedPath(path: string, cwd: string): string {
  return (relative(cwd, path) || path).replace(/\\/g, '/')
}

function dedupeNodeHmrUpdates(
  updates: Array<Omit<NodeHmrUpdate, 'filePath'>>,
): Array<Omit<NodeHmrUpdate, 'filePath'>> {
  let seen = new Set<string>()
  let result: Array<Omit<NodeHmrUpdate, 'filePath'>> = []

  for (let update of updates) {
    let key = `${update.url}\0${update.acceptedUrl}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(update)
  }

  return result
}

async function stopChild(child: ChildProcess | undefined, signal: NodeJS.Signals = 'SIGTERM') {
  if (child === undefined) return
  if (child.exitCode !== null || child.signalCode !== null) return

  await new Promise<void>((resolvePromise) => {
    let timeout = setTimeout(() => {
      child.kill('SIGKILL')
      resolvePromise()
    }, shutdownTimeoutMs)

    child.once('exit', () => {
      clearTimeout(timeout)
      resolvePromise()
    })

    child.kill(signal)
  })
}

function isChildMessage(message: unknown): message is ChildMessage {
  if (typeof message !== 'object' || message === null || !('type' in message)) return false

  if (message.type === 'hmr-event:send') {
    return 'payload' in message && isHmrEventPayload(message.payload)
  }

  if (message.type === 'server-hmr:event') {
    return 'event' in message && isServerHmrEvent(message.event)
  }

  if (message.type === 'server-ready') return true

  if (message.type === 'hmr:restart') {
    return !('message' in message) || typeof message.message === 'string'
  }

  if (message.type === 'module-import') {
    return (
      'depFilePath' in message &&
      typeof message.depFilePath === 'string' &&
      'depUrl' in message &&
      typeof message.depUrl === 'string' &&
      'importerFilePath' in message &&
      typeof message.importerFilePath === 'string' &&
      'importerUrl' in message &&
      typeof message.importerUrl === 'string'
    )
  }

  if (message.type === 'module-accepted-deps-resolved') {
    return (
      'url' in message &&
      typeof message.url === 'string' &&
      'acceptedDeps' in message &&
      Array.isArray(message.acceptedDeps) &&
      message.acceptedDeps.every((dep) => typeof dep === 'string')
    )
  }

  if (message.type !== 'module-update') return false

  return (
    'filePath' in message &&
    typeof message.filePath === 'string' &&
    'url' in message &&
    typeof message.url === 'string' &&
    'hmr' in message &&
    isHmrInfo(message.hmr)
  )
}

function isHmrInfo(value: unknown): value is NodeHmrModuleInfo['hmr'] {
  return (
    typeof value === 'object' &&
    value !== null &&
    'acceptedDeps' in value &&
    Array.isArray(value.acceptedDeps) &&
    value.acceptedDeps.every((dep) => typeof dep === 'string') &&
    'selfAccepting' in value &&
    typeof value.selfAccepting === 'boolean' &&
    'usesImportMetaHot' in value &&
    typeof value.usesImportMetaHot === 'boolean'
  )
}

function isServerHmrEvent(value: unknown): value is ServerHmrEvent {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false

  if (value.type === 'restart') {
    return (
      'timestamp' in value &&
      typeof value.timestamp === 'number' &&
      (!('filePath' in value) || typeof value.filePath === 'string') &&
      (!('reason' in value) || typeof value.reason === 'string') &&
      (!('url' in value) || typeof value.url === 'string')
    )
  }

  return (
    value.type === 'update' &&
    'filePath' in value &&
    typeof value.filePath === 'string' &&
    'timestamp' in value &&
    typeof value.timestamp === 'number' &&
    'url' in value &&
    typeof value.url === 'string' &&
    (!('acceptedUrl' in value) || typeof value.acceptedUrl === 'string')
  )
}

function isHmrEventPayload(value: unknown): value is HmrEventPayload {
  return (
    typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string'
  )
}
