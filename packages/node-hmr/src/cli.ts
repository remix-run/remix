import { spawn, type ChildProcess } from 'node:child_process'
import { createServer, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { relative, resolve } from 'node:path'

import { createStyles } from '@remix-run/terminal'
import { watch } from 'chokidar'

import {
  nodeHmrEventPathname,
  setNodeHmrEventUrlEnv,
  type NodeHmrBrowserPayload,
} from './lib/browser-events.ts'
import type { ServerHmrEvent } from './lib/events.ts'

export interface RunNodeHmrOptions {
  argv: Array<string>
  commandName?: string
  cwd: string
  env?: NodeJS.ProcessEnv
}

export interface NodeHmrCommand {
  entry: string
  entryArgs: Array<string>
  host: string
  nodeArgs: Array<string>
  port: number
}

export interface NodeHmrCommandResult {
  command?: NodeHmrCommand
  help: boolean
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
      payload: NodeHmrBrowserPayload
      type: 'browser-hmr:send'
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

export async function runNodeHmr(options: RunNodeHmrOptions): Promise<number> {
  let result = parseNodeHmrCommand(options.argv)
  let commandName = options.commandName ?? 'node-hmr'

  if (result.help) {
    console.log(getNodeHmrHelpText(commandName))
    return 0
  }

  if (result.command === undefined) {
    console.error(`Usage: ${commandName} [options] [node options] <entry> [...args]`)
    return 1
  }

  return await runWatchedProcess({
    command: result.command,
    cwd: options.cwd,
    env: options.env ?? process.env,
    registerPath: resolveRegisterPath(),
  })
}

export function parseNodeHmrCommand(argv: Array<string>): NodeHmrCommandResult {
  let host = '127.0.0.1'
  let nodeArgs: Array<string> = []
  let port = 0
  let entry: string | undefined
  let entryArgs: Array<string> = []

  for (let index = 0; index < argv.length; index++) {
    let arg = argv[index]
    if (arg === undefined) continue

    if (entry !== undefined) {
      entryArgs.push(arg)
      continue
    }

    if (arg === '--help' || arg === '-h') {
      return { help: true }
    }

    if (arg === '--') {
      entry = argv[index + 1]
      entryArgs = argv.slice(index + 2)
      break
    }

    if (arg === '--hmr-host') {
      let value = argv[index + 1]
      if (value !== undefined) {
        host = value
        index++
      }
      continue
    }

    if (arg.startsWith('--hmr-host=')) {
      host = arg.slice('--hmr-host='.length)
      continue
    }

    if (arg === '--hmr-port') {
      let value = argv[index + 1]
      if (value !== undefined) {
        port = parsePort(value)
        index++
      }
      continue
    }

    if (arg.startsWith('--hmr-port=')) {
      port = parsePort(arg.slice('--hmr-port='.length))
      continue
    }

    assertSupportedNodeArg(arg)
    if (arg.startsWith('-')) {
      nodeArgs.push(arg)
      if (nodeArgConsumesValue(arg)) {
        let value = argv[index + 1]
        if (value === undefined) {
          throw new TypeError(`Missing value for Node option: ${arg}`)
        }
        nodeArgs.push(value)
        index++
      }
      continue
    }

    entry = arg
  }

  if (entry === undefined) {
    return { help: false }
  }

  return {
    command: { entry, entryArgs, host, nodeArgs, port },
    help: false,
  }
}

export function buildNodeArgs(options: {
  entry: string
  entryArgs: Array<string>
  nodeArgs: Array<string>
  registerPath: string
}): Array<string> {
  return [
    ...options.nodeArgs,
    '--import',
    pathToFileURL(options.registerPath).href,
    options.entry,
    ...options.entryArgs,
  ]
}

export function shouldIgnoreWatchPath(path: string): boolean {
  let parts = path.split(/[\\/]/)

  return parts.some((part) =>
    ['.git', '.next', '.turbo', 'build', 'coverage', 'dist', 'node_modules'].includes(part),
  )
}

export function getNodeHmrHelpText(commandName = 'node-hmr'): string {
  return `Usage: ${commandName} [options] [node options] <entry> [...args]

Run a Node.js entry file with file watching, restart fallback, and an import.meta.hot runtime.

Options and Node options can be provided before the entry. Node options are forwarded to the child process. Node execution modes such as --watch and --test are not supported.

Options:
  --hmr-host <host>  Host used for the parent browser HMR endpoint. Defaults to 127.0.0.1.
  --hmr-port <port>  Port used for the parent browser HMR endpoint. Defaults to 0, which picks a free port.

Examples:
  ${commandName} --import remix/node-tsx server.ts`
}

function resolveRegisterPath(): string {
  let extension = import.meta.url.endsWith('.ts') ? 'ts' : 'js'

  return fileURLToPath(new URL(`./register.${extension}`, import.meta.url))
}

function parsePort(value: string): number {
  let port = Number(value)
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new TypeError(`Invalid HMR port: ${value}`)
  }
  return port
}

const nodeOptionsWithValues = new Set([
  '--conditions',
  '--cpu-prof-dir',
  '--cpu-prof-interval',
  '--cpu-prof-name',
  '--diagnostic-dir',
  '--disable-proto',
  '--dns-result-order',
  '--env-file',
  '--env-file-if-exists',
  '--experimental-config-file',
  '--experimental-loader',
  '--heap-prof-dir',
  '--heap-prof-interval',
  '--heap-prof-name',
  '--heapsnapshot-near-heap-limit',
  '--heapsnapshot-signal',
  '--icu-data-dir',
  '--import',
  '--loader',
  '--max-http-header-size',
  '--openssl-config',
  '--policy-integrity',
  '--redirect-warnings',
  '--require',
  '--secure-heap',
  '--secure-heap-min',
  '--security-revert',
  '--snapshot-blob',
  '--snapshot-config',
  '--title',
  '--tls-cipher-list',
  '--trace-event-categories',
  '--trace-event-file-pattern',
  '--unhandled-rejections',
  '-C',
  '-r',
])

function nodeArgConsumesValue(arg: string): boolean {
  if (arg.includes('=')) return false
  return nodeOptionsWithValues.has(arg)
}

function assertSupportedNodeArg(arg: string): void {
  let flag = arg.split('=', 1)[0]!

  if (
    flag === '--watch' ||
    flag.startsWith('--watch-') ||
    flag === '--test' ||
    flag.startsWith('--test-') ||
    flag.startsWith('--experimental-test-') ||
    flag === '--run' ||
    flag === '--check' ||
    flag === '--eval' ||
    flag === '--print' ||
    flag === '--interactive' ||
    flag === '-c' ||
    flag === '-i' ||
    isShortExecutionModeArg(arg, '-e') ||
    isShortExecutionModeArg(arg, '-p')
  ) {
    throw new TypeError(`Node option ${flag} is not supported by node-hmr`)
  }
}

function isShortExecutionModeArg(arg: string, flag: '-e' | '-p'): boolean {
  return arg === flag || (arg.startsWith(flag) && !arg.startsWith('--'))
}

async function runWatchedProcess(options: {
  command: NodeHmrCommand
  cwd: string
  env: NodeJS.ProcessEnv
  registerPath: string
}): Promise<number> {
  let browserHmrEndpoint = await createBrowserHmrEndpoint({
    host: options.command.host,
    port: options.command.port,
  })
  let child: ChildProcess | undefined
  let restartTimer: NodeJS.Timeout | undefined
  let resolveRun: ((code: number) => void) | undefined
  let moduleInfoByFilePath = new Map<string, NodeHmrModuleInfo[]>()
  let moduleInfoByUrl = new Map<string, NodeHmrModuleInfo>()
  let moduleDepsByUrl = new Map<string, Set<string>>()
  let pendingChangedPaths = new Set<string>()
  let pendingRestartPaths = new Set<string>()
  let restarting = false
  let stopping = false
  let waitingForFileChangeAfterExit = false
  let pendingBrowserServerUpdate: { message?: string; reason: 'restart' } | undefined

  function start() {
    moduleInfoByFilePath = new Map()
    moduleInfoByUrl = new Map()
    moduleDepsByUrl = new Map()
    waitingForFileChangeAfterExit = false

    let entry = resolve(options.cwd, options.command.entry)
    let nextChild = spawn(
      process.execPath,
      buildNodeArgs({
        entry,
        entryArgs: options.command.entryArgs,
        nodeArgs: options.command.nodeArgs,
        registerPath: options.registerPath,
      }),
      {
        cwd: options.cwd,
        env: {
          ...setNodeHmrEventUrlEnv(options.env, browserHmrEndpoint.url),
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
      pendingBrowserServerUpdate = { reason: 'restart' }
      child = undefined
      console.log(
        `Failed running ${options.command.entry}. Waiting for file changes before restarting...`,
      )
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

    if (message.type === 'browser-hmr:send') {
      browserHmrEndpoint.send(message.payload)
      return
    }

    if (message.type === 'server-hmr:event') {
      browserHmrEndpoint.send(toBrowserServerHmrPayload(message.event))
      return
    }

    if (message.type === 'server-ready') {
      flushPendingBrowserServerUpdate()
      return
    }

    if (message.type === 'hmr:restart') {
      if (message.message !== undefined) {
        console.warn(message.message)
      }

      pendingBrowserServerUpdate = { message: message.message, reason: 'restart' }
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
      pendingBrowserServerUpdate = { reason: 'restart' }
      start()
      return
    }

    if (restartPaths.length > 0) {
      logRestart(formatChangedPaths(restartPaths, options.cwd))
      pendingBrowserServerUpdate = {
        message: formatChangedPaths(restartPaths, options.cwd),
        reason: 'restart',
      }
      await restart()
      return
    }

    let hotUpdates: NodeHmrUpdate[] = []
    for (let changedPath of changedPaths) {
      let modules = moduleInfoByFilePath.get(changedPath)
      if (modules === undefined || modules.length === 0) {
        logRestart(formatChangedPath(changedPath, options.cwd))
        pendingBrowserServerUpdate = {
          message: formatChangedPath(changedPath, options.cwd),
          reason: 'restart',
        }
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
          pendingBrowserServerUpdate = {
            message: formatChangedPath(changedPath, options.cwd),
            reason: 'restart',
          }
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
        pendingBrowserServerUpdate = {
          message: formatChangedPath(moduleInfo.filePath, options.cwd),
          reason: 'restart',
        }
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

  function flushPendingBrowserServerUpdate(): void {
    if (pendingBrowserServerUpdate === undefined) return

    browserHmrEndpoint.send({
      data: {
        ...(pendingBrowserServerUpdate.message === undefined
          ? {}
          : { message: pendingBrowserServerUpdate.message }),
        reason: pendingBrowserServerUpdate.reason,
        timestamp: Date.now(),
      },
      event: 'remix:server-update',
      type: 'custom',
    })
    pendingBrowserServerUpdate = undefined
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

  let watcher = watch('.', {
    cwd: options.cwd,
    ignoreInitial: true,
    ignored: (path) => shouldIgnoreWatchPath(path),
  })

  watcher.on('all', handleWatchEvent)

  return await new Promise<number>((resolvePromise) => {
    resolveRun = resolvePromise
    start()

    function stop(signal: NodeJS.Signals) {
      stopping = true
      if (restartTimer !== undefined) {
        clearTimeout(restartTimer)
      }

      watcher.close().finally(() => {
        stopChild(child, signal).then(() => {
          browserHmrEndpoint.close().then(() => resolvePromise(0))
        })
      })
    }

    process.once('SIGINT', () => stop('SIGINT'))
    process.once('SIGTERM', () => stop('SIGTERM'))
  })
}

interface BrowserHmrEndpoint {
  close(): Promise<void>
  send(payload: NodeHmrBrowserPayload): void
  url: string
}

interface BrowserHmrClient {
  close(): void
  send(payload: NodeHmrBrowserPayload): void
}

async function createBrowserHmrEndpoint(options: {
  host: string
  port: number
}): Promise<BrowserHmrEndpoint> {
  let clients = new Set<BrowserHmrClient>()
  let server: Server

  server = createServer((request, response) => {
    if (request.url === undefined) {
      response.writeHead(404).end()
      return
    }

    let requestUrl = new URL(request.url, `http://${options.host}`)

    if (request.method === 'OPTIONS' && requestUrl.pathname === nodeHmrEventPathname) {
      writeCorsHeaders(response, 204)
      response.end()
      return
    }

    if (request.method !== 'GET' || requestUrl.pathname !== nodeHmrEventPathname) {
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

    let client: BrowserHmrClient = {
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
    client.send({ type: 'connected' })
  })

  let url = await new Promise<string>((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(options.port, options.host, () => {
      server.off('error', reject)
      let address = server.address()
      if (!isAddressInfo(address)) {
        reject(new Error('Failed to start node HMR event endpoint.'))
        return
      }

      resolvePromise(`http://${options.host}:${address.port}${nodeHmrEventPathname}`)
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

function toBrowserServerHmrPayload(event: ServerHmrEvent): NodeHmrBrowserPayload {
  if (event.type === 'restart') {
    return {
      data: {
        ...(event.reason === undefined ? {} : { message: event.reason }),
        ...(event.filePath === undefined ? {} : { path: event.filePath }),
        reason: 'restart',
        timestamp: event.timestamp,
      },
      event: 'remix:server-update',
      type: 'custom',
    }
  }

  return {
    data: {
      path: event.filePath,
      reason: 'change',
      timestamp: event.timestamp,
    },
    event: 'remix:server-update',
    type: 'custom',
  }
}

function formatServerSentEvent(payload: NodeHmrBrowserPayload): string {
  return `data: ${JSON.stringify(payload)}\n\n`
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
  return relative(cwd, path) || path
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

  if (message.type === 'browser-hmr:send') {
    return 'payload' in message && isNodeHmrBrowserPayload(message.payload)
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

function isNodeHmrBrowserPayload(value: unknown): value is NodeHmrBrowserPayload {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false

  if (value.type === 'connected') return true

  if (value.type === 'custom') {
    return 'event' in value && typeof value.event === 'string'
  }

  if (value.type === 'css-update' || value.type === 'full-reload' || value.type === 'js-update') {
    return (
      'path' in value &&
      typeof value.path === 'string' &&
      'timestamp' in value &&
      typeof value.timestamp === 'number' &&
      (!('acceptedPath' in value) || typeof value.acceptedPath === 'string')
    )
  }

  return false
}
