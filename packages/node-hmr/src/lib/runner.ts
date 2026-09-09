import { spawn, type ChildProcess } from 'node:child_process'
import type { Stats } from 'node:fs'
import { createServer, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { dirname, relative, resolve } from 'node:path'

import { createStyles } from '@remix-run/terminal'
import { watch } from 'chokidar'

import {
  type BrowserHmrFileEvent,
  defaultBrowserHmrPathname,
  type BrowserHmrEvent,
  type HmrEventPayload,
} from './browser-events.ts'
import { createModuleStore, type ModuleRecord } from './module-store.ts'

interface NodeHmrUpdate {
  acceptedUrl: string
  filePath: string
  invalidatedUrls: Record<string, number>
  url: string
}

type ChildMessage =
  | {
      requestId: number
      type: 'node-hmr:child:browser-hmr-channel-requested'
    }
  | {
      payload: HmrEventPayload
      type: 'node-hmr:child:browser-event-emitted'
    }
  | {
      delta: { add: string[]; remove: string[] }
      id: number
      type: 'node-hmr:child:browser-hmr-watch-files-changed'
    }
  | {
      error?: string
      events: BrowserHmrEvent[]
      requestId: number
      type: 'node-hmr:child:browser-hmr-file-events-handled'
    }
  | {
      type: 'node-hmr:child:restart-requested'
      message?: string
    }
  | {
      type: 'node-hmr:child:module-imported'
      depFilePath: string
      depUrl: string
      importerFilePath: string
      importerUrl: string
    }
  | {
      type: 'node-hmr:child:accepted-deps-resolved'
      acceptedDeps: string[]
      url: string
    }
  | {
      type: 'node-hmr:child:module-analyzed'
      filePath: string
      hmr: ModuleRecord['hmr']
      url: string
    }
  | {
      acceptedUrl?: string
      filePath: string
      timestamp: number
      type: 'node-hmr:child:hot-module-updated'
      url: string
    }
  | {
      acceptedUrl: string
      message?: string
      timestamp: number
      type: 'node-hmr:child:hot-module-invalidated'
      url: string
    }
  | {
      type: 'node-hmr:child:server-ready'
    }

const restartDelayMs = 50
const restartSettleDelayMs = 150
const browserHmrEventFlushDelayMs = 75
const browserHmrRequestTimeoutMs = 1_000
const shutdownTimeoutMs = 5_000
const nodeHmrCondition = 'node-hmr'
const nodeHmrEnvVar = 'REMIX_NODE_HMR'
const styles = createStyles()
const windowsDriveLetterRE = /^[A-Za-z]:\//

export function normalizeBrowserHmrFilePath(filePath: string): string {
  return filePath
    .replace(/\\/g, '/')
    .replace(windowsDriveLetterRE, (prefix) => `${prefix[0]!.toUpperCase()}${prefix.slice(1)}`)
}

export function getBrowserHmrFileEventsForWatchedFiles(options: {
  changedPaths: readonly string[]
  restartPathEvents: ReadonlyMap<string, 'add' | 'unlink'>
  watchedFiles: ReadonlySet<string>
}): BrowserHmrFileEvent[] {
  return [
    ...options.changedPaths
      .filter((filePath) => options.watchedFiles.has(normalizeBrowserHmrFilePath(filePath)))
      .map((filePath) => ({ event: 'change' as const, filePath })),
    ...[...options.restartPathEvents]
      .filter(([filePath]) => options.watchedFiles.has(normalizeBrowserHmrFilePath(filePath)))
      .map(([filePath, event]) => ({ event, filePath })),
  ]
}

export function getWatchedDirectoriesForFiles(filePaths: Iterable<string>): Set<string> {
  let watchedDirectories = new Set<string>()
  for (let filePath of filePaths) {
    watchedDirectories.add(dirname(filePath))
  }
  return watchedDirectories
}

type FileChangeStats = Pick<Stats, 'birthtimeMs' | 'ctimeMs' | 'ino' | 'mtimeMs' | 'size'>

export function createFileChangeEventDeduper(): (
  filePath: string,
  stats: FileChangeStats | undefined,
) => boolean {
  let previousStatsByFilePath = new Map<string, FileChangeStats>()

  return (filePath, stats) => {
    if (stats === undefined) return false

    let previousStats = previousStatsByFilePath.get(filePath)
    let currentStats: FileChangeStats = {
      birthtimeMs: stats.birthtimeMs,
      ctimeMs: stats.ctimeMs,
      ino: stats.ino,
      mtimeMs: stats.mtimeMs,
      size: stats.size,
    }
    previousStatsByFilePath.set(filePath, currentStats)

    return (
      previousStats !== undefined &&
      previousStats.birthtimeMs === currentStats.birthtimeMs &&
      previousStats.ctimeMs === currentStats.ctimeMs &&
      previousStats.ino === currentStats.ino &&
      previousStats.mtimeMs === currentStats.mtimeMs &&
      previousStats.size === currentStats.size
    )
  }
}

const chokidarWatcherBySupervisor = new WeakMap<object, ReturnType<typeof watch>>()

export function getSupervisorChokidarWatcher(
  supervisor: object,
): ReturnType<typeof watch> | undefined {
  return chokidarWatcherBySupervisor.get(supervisor)
}

interface BrowserHmrChannelOptions {
  host?: string
  port?: number
  pathname?: string
}

interface NodeHmrWatchOptions {
  ignore?: readonly string[]
  poll?: boolean
  pollInterval?: number
}

interface ResolvedChokidarWatchOptions {
  awaitWriteFinish: {
    pollInterval: number
    stabilityThreshold: number
  }
  depth: number
  ignorePermissionErrors: boolean
  ignored: string[]
  ignoreInitial: boolean
  interval: number
  usePolling: boolean
}

export function createHmrSupervisor(options: {
  browserHmrChannel: BrowserHmrChannelOptions | null
  cwd: string
  entry: string
  entryArgs: string[]
  env: NodeJS.ProcessEnv
  nodeArgs: string[]
  registerPath: string
  watch?: NodeHmrWatchOptions
}): {
  readonly generation: number
  ready(): Promise<void>
  start(): Promise<void>
  stop(signal?: NodeJS.Signals): Promise<void>
} {
  let browserHmrEventChannel: BrowserHmrEventChannel | null = null
  let browserHmrEventChannelPromise: Promise<BrowserHmrEventChannel | null> | undefined
  let child: ChildProcess | undefined
  let restartTimer: NodeJS.Timeout | undefined
  let resolveRun: (() => void) | undefined
  let moduleStore = createModuleStore()
  let watchedFilePaths = new Set<string>()
  let watchedDirectoryRefCounts = new Map<string, number>()
  let browserWatchedFileRefCountsByRuntime = new Map<number, Map<string, number>>()
  let browserWatchedFilePaths = new Set<string>()
  let activeWatchedDirectories = new Set<string>()
  let pendingChangedPaths = new Set<string>()
  let pendingRestartPathEvents = new Map<string, 'add' | 'unlink'>()
  let activeWatchEventFlushCount = 0
  let pendingHotUpdateCount = 0
  let acceptedHotUpdateCount = 0
  let pendingBrowserHmrEvents: BrowserHmrEvent[] = []
  let pendingBrowserHmrEventServerPaths = new Set<string>()
  let browserHmrEventFlushTimer: NodeJS.Timeout | undefined
  let restartSettleTimer: NodeJS.Timeout | undefined
  let serverGeneration = 0
  let restartGeneration = 0
  let pendingRestartGeneration = 0
  let readyGeneration = -1
  let serverReadyCount = 0
  let waitingForEntryServerReady = false
  let readyWaiters: Array<() => void> = []
  let browserHmrRequestId = 0
  let pendingBrowserHmrRequests = new Map<
    number,
    {
      resolve(events: BrowserHmrEvent[]): void
      timer: NodeJS.Timeout
    }
  >()
  let restarting = false
  let stopping = false
  let waitingForFileChangeAfterExit = false
  let pendingServerUpdateEvent = false
  let isDuplicateFileChangeEvent = createFileChangeEventDeduper()

  function setReadyGeneration(generation: number): void {
    readyGeneration = generation
  }

  function isReady(): boolean {
    return (
      readyGeneration === pendingRestartGeneration &&
      restartTimer === undefined &&
      activeWatchEventFlushCount === 0 &&
      !waitingForEntryServerReady &&
      pendingHotUpdateCount === acceptedHotUpdateCount
    )
  }

  function markRestartPending(): number {
    if (pendingRestartGeneration === restartGeneration) {
      pendingRestartGeneration += 1
      serverGeneration += 1
    }
    waitingForEntryServerReady = false
    setReadyGeneration(-1)
    return pendingRestartGeneration
  }

  function commitRestartGeneration(): number {
    restartGeneration = pendingRestartGeneration
    return restartGeneration
  }

  function getEntryPath(): string {
    return resolve(options.cwd, options.entry)
  }

  function start() {
    setReadyGeneration(-1)
    moduleStore.reset()
    browserWatchedFileRefCountsByRuntime = new Map()
    browserWatchedFilePaths = new Set()
    unwatchKnownModuleFiles()
    watchKnownModuleFile(getEntryPath())
    waitingForFileChangeAfterExit = false
    let childRestartGeneration = restartGeneration

    let entry = getEntryPath()
    let nextChild = spawn(
      process.execPath,
      buildChildProcessArgs({
        entry,
        browserEventUrl: browserHmrEventChannel?.url,
        entryArgs: options.entryArgs,
        nodeArgs: options.nodeArgs,
        registerPath: options.registerPath,
        rootPath: options.cwd,
      }),
      {
        cwd: options.cwd,
        env: buildChildProcessEnv(options.env),
        stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
      },
    )

    child = nextChild

    nextChild.on('message', (message: unknown) => {
      if (child !== nextChild) return
      handleChildMessage(message, childRestartGeneration)
    })

    nextChild.once('exit', (code, signal) => {
      if (stopping || restarting || child !== nextChild) return
      resolvePendingBrowserHmrRequests([])
      waitingForFileChangeAfterExit = true
      pendingServerUpdateEvent = true
      child = undefined
      console.log(`Failed running ${options.entry}. Waiting for file changes before restarting...`)
    })
  }

  async function restart() {
    if (stopping) return
    commitRestartGeneration()
    restarting = true
    await stopChild(child, { force: false, signal: 'SIGTERM' })
    restarting = false
    if (stopping) return
    start()
  }

  function scheduleRestart(): void {
    markRestartPending()

    if (restartSettleTimer !== undefined) {
      clearTimeout(restartSettleTimer)
    }

    restartSettleTimer = setTimeout(() => {
      restartSettleTimer = undefined
      restart().catch((error: unknown) => {
        console.error(error)
      })
    }, restartSettleDelayMs)
  }

  function handleChildMessage(message: unknown, childRestartGeneration: number) {
    if (!isChildMessage(message)) return

    if (message.type === 'node-hmr:child:browser-event-emitted') {
      browserHmrEventChannel?.send(message.payload)
      return
    }

    if (message.type === 'node-hmr:child:browser-hmr-channel-requested') {
      respondToBrowserHmrChannelRequest(message.requestId).catch((error: unknown) => {
        console.warn(`Failed to create browser HMR channel: ${formatUnknownError(error)}`)
        sendBrowserHmrChannelResponse(message.requestId, undefined)
      })
      return
    }

    if (message.type === 'node-hmr:child:browser-hmr-watch-files-changed') {
      updateBrowserWatchedFiles(message.id, message.delta)
      return
    }

    if (message.type === 'node-hmr:child:browser-hmr-file-events-handled') {
      let request = pendingBrowserHmrRequests.get(message.requestId)
      if (request !== undefined) {
        clearTimeout(request.timer)
        pendingBrowserHmrRequests.delete(message.requestId)
        request.resolve(message.events)
      }
      if (message.error !== undefined) {
        console.warn(`Browser HMR runtime failed: ${message.error}`)
      }
      return
    }

    if (message.type === 'node-hmr:child:hot-module-updated') {
      acceptedHotUpdateCount += 1
      serverGeneration += 1
      if (!waitingForEntryServerReady) {
        flushAcceptedHotUpdateBrowserEvent()
      }
      resolveReadyWaiters()
      return
    }

    if (message.type === 'node-hmr:child:hot-module-invalidated') {
      propagateInvalidatedHotUpdate(message.url, message.timestamp, message.message).catch(
        (error: unknown) => {
          console.error(error)
        },
      )
      return
    }

    if (message.type === 'node-hmr:child:server-ready') {
      if (childRestartGeneration !== pendingRestartGeneration) return
      serverReadyCount += 1
      waitingForEntryServerReady = false
      setReadyGeneration(childRestartGeneration)
      resolveReadyWaiters()
      flushPendingServerUpdateEvent()
      flushAcceptedHotUpdateBrowserEvent()
      return
    }

    if (message.type === 'node-hmr:child:restart-requested') {
      if (message.message !== undefined) {
        console.warn(message.message)
      }

      pendingServerUpdateEvent = true
      clearPendingHotUpdates()
      logRestart(message.message ?? 'import.meta.hot.invalidate()')
      scheduleRestart()
      return
    }

    if (message.type === 'node-hmr:child:module-imported') {
      moduleStore.addDependency(message.importerUrl, message.depUrl)
      return
    }

    if (message.type === 'node-hmr:child:accepted-deps-resolved') {
      moduleStore.setAcceptedDependencies(message.url, message.acceptedDeps)
      return
    }

    moduleStore.setModule({
      filePath: message.filePath,
      hmr: message.hmr,
      url: message.url,
    })
    syncWatchedModuleFiles()
  }

  function watchKnownModuleFile(filePath: string): void {
    syncWatchedModuleFiles(new Set([resolve(filePath)]))
  }

  function syncWatchedModuleFiles(requiredFilePaths: Set<string> = new Set()): void {
    let nextWatchedFilePaths = new Set(requiredFilePaths)

    let entryUrl = pathToFileURL(getEntryPath()).href
    for (let filePath of moduleStore.getReachableFilePaths(entryUrl)) {
      nextWatchedFilePaths.add(filePath)
    }

    let nextWatchedDirectoryRefCounts = new Map<string, number>()
    for (let filePath of nextWatchedFilePaths) {
      let directory = dirname(filePath)
      nextWatchedDirectoryRefCounts.set(
        directory,
        (nextWatchedDirectoryRefCounts.get(directory) ?? 0) + 1,
      )
    }

    watchedFilePaths = nextWatchedFilePaths
    watchedDirectoryRefCounts = nextWatchedDirectoryRefCounts
    syncWatchedDirectories()
  }

  function unwatchKnownModuleFiles(): void {
    watchedFilePaths = new Set()
    watchedDirectoryRefCounts = new Map()
    syncWatchedDirectories()
  }

  function updateBrowserWatchedFiles(
    runtimeId: number,
    delta: { add: readonly string[]; remove: readonly string[] },
  ): void {
    let refCounts = browserWatchedFileRefCountsByRuntime.get(runtimeId)
    if (refCounts === undefined) {
      refCounts = new Map()
      browserWatchedFileRefCountsByRuntime.set(runtimeId, refCounts)
    }

    for (let file of delta.add) {
      let filePath = normalizeBrowserHmrFilePath(resolve(options.cwd, file))
      refCounts.set(filePath, (refCounts.get(filePath) ?? 0) + 1)
    }
    for (let file of delta.remove) {
      let filePath = normalizeBrowserHmrFilePath(resolve(options.cwd, file))
      let count = refCounts.get(filePath)
      if (count === undefined) continue
      if (count <= 1) {
        refCounts.delete(filePath)
      } else {
        refCounts.set(filePath, count - 1)
      }
    }

    if (refCounts.size === 0) {
      browserWatchedFileRefCountsByRuntime.delete(runtimeId)
    }

    syncWatchedDirectories()
  }

  function syncWatchedDirectories(): void {
    let nextBrowserWatchedFilePaths = new Set<string>()
    for (let refCounts of browserWatchedFileRefCountsByRuntime.values()) {
      for (let file of refCounts.keys()) {
        nextBrowserWatchedFilePaths.add(file)
      }
    }
    let nextWatchedDirectories = new Set([
      ...watchedDirectoryRefCounts.keys(),
      ...getWatchedDirectoriesForFiles(nextBrowserWatchedFilePaths),
    ])

    let directoriesToAdd = [...nextWatchedDirectories].filter(
      (directory) => !activeWatchedDirectories.has(directory),
    )
    let directoriesToRemove = [...activeWatchedDirectories].filter(
      (directory) => !nextWatchedDirectories.has(directory),
    )

    if (directoriesToRemove.length > 0) {
      watcher.unwatch(directoriesToRemove)
    }
    if (directoriesToAdd.length > 0) {
      watcher.add(directoriesToAdd)
    }

    activeWatchedDirectories = nextWatchedDirectories
    browserWatchedFilePaths = nextBrowserWatchedFilePaths
  }

  function handleWatchEvent(event: string, changedPath: string, stats?: Stats) {
    let filePath = resolve(options.cwd, changedPath)

    if (event === 'change') {
      let normalizedFilePath = normalizeBrowserHmrFilePath(filePath)
      let isRelevantFile =
        waitingForFileChangeAfterExit ||
        watchedFilePaths.has(filePath) ||
        browserWatchedFilePaths.has(normalizedFilePath)
      if (!isRelevantFile || isDuplicateFileChangeEvent(normalizedFilePath, stats)) return
    }

    if (restartTimer !== undefined) {
      clearTimeout(restartTimer)
    }

    if (event === 'change') {
      pendingChangedPaths.add(filePath)
    } else {
      pendingRestartPathEvents.set(filePath, event === 'add' ? 'add' : 'unlink')
    }

    restartTimer = setTimeout(() => {
      flushPendingWatchEvents().catch((error: unknown) => {
        console.error(error)
      })
    }, restartDelayMs)
  }

  async function flushPendingWatchEvents() {
    activeWatchEventFlushCount += 1
    try {
      let changedPaths = [...pendingChangedPaths]
      pendingChangedPaths = new Set()

      let restartPathEvents = new Map(pendingRestartPathEvents)
      let restartPaths = [...restartPathEvents.keys()]
      pendingRestartPathEvents = new Map()
      restartTimer = undefined

      let browserFileEvents = getBrowserHmrFileEvents(changedPaths, restartPathEvents)
      let browserHmrEvents = await requestBrowserHmrEvents(browserFileEvents)
      for (let event of browserHmrEvents) {
        queueBrowserHmrEvent(event, { schedule: false })
      }

      if (waitingForFileChangeAfterExit) {
        logRestart(formatChangedPaths([...restartPaths, ...changedPaths], options.cwd))
        pendingServerUpdateEvent = true
        start()
        return
      }

      restartPaths = restartPaths.filter((changedPath) => watchedFilePaths.has(changedPath))

      if (restartPaths.length > 0) {
        markBrowserHmrEventServerPathsChecked(restartPaths)
        forceBrowserFullReloadIfBrowserWorkPending()
        logRestart(formatChangedPaths(restartPaths, options.cwd))
        pendingServerUpdateEvent = true
        scheduleRestart()
        return
      }

      let hotUpdates: NodeHmrUpdate[] = []
      let checkedChangedPaths: string[] = []
      for (let changedPath of changedPaths) {
        if (!watchedFilePaths.has(changedPath)) continue
        checkedChangedPaths.push(changedPath)

        let modules = moduleStore.getModulesForFile(changedPath)
        if (modules.length === 0) {
          markBrowserHmrEventServerPathsChecked(checkedChangedPaths)
          forceBrowserFullReloadIfBrowserWorkPending()
          logRestart(formatChangedPath(changedPath, options.cwd))
          pendingServerUpdateEvent = true
          scheduleRestart()
          return
        }

        for (let moduleInfo of modules) {
          let hotUpdateBoundaries = moduleStore.findHotUpdateBoundaries(moduleInfo.url, Date.now())
          if (!hotUpdateBoundaries) {
            markBrowserHmrEventServerPathsChecked(checkedChangedPaths)
            forceBrowserFullReloadIfBrowserWorkPending()
            logRestart(formatChangedPath(changedPath, options.cwd))
            pendingServerUpdateEvent = true
            scheduleRestart()
            return
          }

          hotUpdates.push(
            ...hotUpdateBoundaries.map((boundary) => ({
              acceptedUrl: boundary.acceptedDependencyUrl,
              filePath: moduleInfo.filePath,
              invalidatedUrls: boundary.invalidatedUrls,
              url: boundary.updateHandlerUrl,
            })),
          )
        }
      }

      markBrowserHmrEventServerPathsChecked(checkedChangedPaths)

      pendingHotUpdateCount += hotUpdates.length
      if (hotUpdates.length === 0) {
        flushBrowserHmrEvents({ serverReady: !pendingServerUpdateEvent })
        return
      }

      for (let moduleInfo of hotUpdates) {
        if (!sendHotUpdate(moduleInfo)) {
          clearPendingHotUpdates()
          forceBrowserFullReloadIfBrowserWorkPending()
          logRestart(formatChangedPath(moduleInfo.filePath, options.cwd))
          pendingServerUpdateEvent = true
          scheduleRestart()
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
    } finally {
      activeWatchEventFlushCount -= 1
      resolveReadyWaiters()
    }
  }

  function flushPendingServerUpdateEvent(): void {
    if (!pendingServerUpdateEvent) return

    clearPendingHotUpdates()
    forceBrowserFullReloadIfBrowserWorkPending()
    if (flushBrowserHmrEvents({ serverReady: true }) === 'reload') {
      pendingServerUpdateEvent = false
      return
    }

    browserHmrEventChannel?.send({
      type: 'server:update',
    })
    pendingServerUpdateEvent = false
  }

  function flushAcceptedHotUpdateBrowserEvent(): void {
    if (pendingServerUpdateEvent) return
    if (pendingHotUpdateCount === 0 || acceptedHotUpdateCount < pendingHotUpdateCount) return

    clearPendingHotUpdates()
    if (flushBrowserHmrEvents({ serverReady: true }) === 'reload') {
      return
    }

    browserHmrEventChannel?.send({
      type: 'server:update',
    })
  }

  async function propagateInvalidatedHotUpdate(
    url: string,
    timestamp: number,
    message: string | undefined,
  ): Promise<void> {
    let moduleInfo = moduleStore.getModule(url)
    let hotUpdateBoundaries = moduleStore.findHotUpdateBoundariesFromImporters(url, timestamp)
    if (!hotUpdateBoundaries || hotUpdateBoundaries.length === 0) {
      clearPendingHotUpdates()
      forceBrowserFullReloadIfBrowserWorkPending()
      logRestart(
        message ?? (moduleInfo ? formatChangedPath(moduleInfo.filePath, options.cwd) : url),
      )
      pendingServerUpdateEvent = true
      scheduleRestart()
      return
    }

    pendingHotUpdateCount = Math.max(0, pendingHotUpdateCount - 1) + hotUpdateBoundaries.length

    for (let boundary of hotUpdateBoundaries) {
      let filePath = moduleInfo?.filePath ?? boundary.acceptedDependencyUrl
      if (
        !sendHotUpdate({
          acceptedUrl: boundary.acceptedDependencyUrl,
          filePath,
          invalidatedUrls: boundary.invalidatedUrls,
          url: boundary.updateHandlerUrl,
        })
      ) {
        clearPendingHotUpdates()
        forceBrowserFullReloadIfBrowserWorkPending()
        logRestart(moduleInfo ? formatChangedPath(moduleInfo.filePath, options.cwd) : url)
        pendingServerUpdateEvent = true
        scheduleRestart()
        return
      }
    }

    if (moduleInfo) {
      logHotUpdate(formatChangedPath(moduleInfo.filePath, options.cwd))
    }
  }

  function clearPendingHotUpdates(): void {
    pendingHotUpdateCount = 0
    acceptedHotUpdateCount = 0
  }

  function resolvePendingBrowserHmrRequests(events: BrowserHmrEvent[]): void {
    for (let [requestId, request] of pendingBrowserHmrRequests) {
      clearTimeout(request.timer)
      request.resolve(events)
      pendingBrowserHmrRequests.delete(requestId)
    }
  }

  function queueBrowserHmrEvent(
    event: BrowserHmrEvent,
    queueOptions: { schedule: boolean } = { schedule: true },
  ): void {
    pendingBrowserHmrEvents.push(event)
    for (let file of event.files ?? []) {
      let filePath = resolve(options.cwd, file)
      if (watchedFilePaths.has(filePath)) {
        pendingBrowserHmrEventServerPaths.add(filePath)
      }
    }
    if (queueOptions.schedule) scheduleBrowserHmrEventFlush()
  }

  function scheduleBrowserHmrEventFlush(): void {
    if (browserHmrEventFlushTimer !== undefined) return

    browserHmrEventFlushTimer = setTimeout(() => {
      browserHmrEventFlushTimer = undefined
      flushBrowserHmrEvents({
        serverReady:
          !pendingServerUpdateEvent &&
          pendingBrowserHmrEventServerPaths.size === 0 &&
          (pendingHotUpdateCount === 0 || acceptedHotUpdateCount >= pendingHotUpdateCount),
      })
    }, browserHmrEventFlushDelayMs)
  }

  function forceBrowserFullReloadIfBrowserWorkPending(): void {
    if (pendingBrowserHmrEvents.length === 0) return

    let reloadEvent = pendingBrowserHmrEvents.find((event) => event.type === 'reload')
    pendingBrowserHmrEvents = [
      reloadEvent ?? {
        type: 'reload',
      },
    ]
    pendingBrowserHmrEventServerPaths.clear()
  }

  function getBrowserHmrFileEvents(
    changedPaths: readonly string[],
    restartPathEvents: ReadonlyMap<string, 'add' | 'unlink'>,
  ): BrowserHmrFileEvent[] {
    return getBrowserHmrFileEventsForWatchedFiles({
      changedPaths,
      restartPathEvents,
      watchedFiles: browserWatchedFilePaths,
    })
  }

  async function requestBrowserHmrEvents(
    events: readonly BrowserHmrFileEvent[],
  ): Promise<BrowserHmrEvent[]> {
    if (events.length === 0) return []
    if (child === undefined || child.send === undefined || !child.connected) return []

    let requestId = browserHmrRequestId++
    let browserHmrEvents = await new Promise<BrowserHmrEvent[]>((resolvePromise) => {
      let timer = setTimeout(() => {
        pendingBrowserHmrRequests.delete(requestId)
        resolvePromise([])
      }, browserHmrRequestTimeoutMs)

      pendingBrowserHmrRequests.set(requestId, {
        resolve: resolvePromise,
        timer,
      })

      if (
        !child?.send?.({
          events,
          requestId,
          type: 'node-hmr:parent:browser-hmr-file-events',
        })
      ) {
        clearTimeout(timer)
        pendingBrowserHmrRequests.delete(requestId)
        resolvePromise([])
      }
    })

    return browserHmrEvents
  }

  async function respondToBrowserHmrChannelRequest(requestId: number): Promise<void> {
    let channel = await getBrowserHmrEventChannel()
    sendBrowserHmrChannelResponse(requestId, channel?.url)
  }

  function sendBrowserHmrChannelResponse(requestId: number, url: string | undefined): void {
    if (child === undefined || child.send === undefined || !child.connected) return

    child.send({
      requestId,
      type: 'node-hmr:parent:browser-hmr-channel',
      url,
    })
  }

  async function getBrowserHmrEventChannel(): Promise<BrowserHmrEventChannel | null> {
    if (options.browserHmrChannel === null) return null
    if (browserHmrEventChannel) return browserHmrEventChannel

    browserHmrEventChannelPromise ??= createBrowserHmrEventChannel(options.browserHmrChannel).then(
      (channel) => {
        browserHmrEventChannel = channel
        return channel
      },
    )

    return browserHmrEventChannelPromise
  }

  function flushBrowserHmrEvents(options: { serverReady: boolean }): 'events' | 'reload' | 'none' {
    if (pendingBrowserHmrEvents.length === 0) return 'none'
    if (!options.serverReady) return 'none'
    if (pendingBrowserHmrEventServerPaths.size > 0) return 'none'

    if (browserHmrEventFlushTimer !== undefined) {
      clearTimeout(browserHmrEventFlushTimer)
      browserHmrEventFlushTimer = undefined
    }

    let reloadEvent = pendingBrowserHmrEvents.find((event) => event.type === 'reload')
    if (reloadEvent) {
      pendingBrowserHmrEvents = []
      browserHmrEventChannel?.send({
        type: 'browser:reload',
      })
      return 'reload'
    }

    let events = pendingBrowserHmrEvents
    pendingBrowserHmrEvents = []
    for (let event of events) {
      if (event.type === 'update') {
        browserHmrEventChannel?.send({
          data: event.data,
          type: 'browser:update',
        })
      }
    }
    return 'events'
  }

  function markBrowserHmrEventServerPathsChecked(filePaths: readonly string[]): void {
    for (let filePath of filePaths) {
      pendingBrowserHmrEventServerPaths.delete(filePath)
    }
  }

  function sendHotUpdate(moduleInfo: NodeHmrUpdate): boolean {
    if (child === undefined || child.send === undefined || !child.connected) return false

    let shouldWaitForEntryServerReady =
      serverReadyCount > 0 &&
      (moduleInfo.acceptedUrl ?? moduleInfo.url) === pathToFileURL(getEntryPath()).href
    if (shouldWaitForEntryServerReady) {
      waitingForEntryServerReady = true
    }

    return child.send({
      acceptedUrl: moduleInfo.acceptedUrl,
      invalidatedUrls: moduleInfo.invalidatedUrls,
      type: 'node-hmr:parent:hot-module-changed',
      url: moduleInfo.url,
      timestamp: Date.now(),
    })
  }

  function ready(): Promise<void> {
    if (isReady()) return Promise.resolve()

    return new Promise((resolvePromise) => {
      readyWaiters.push(resolvePromise)
    })
  }

  function resolveReadyWaiters(options: { force?: boolean } = {}): void {
    if (!options.force && !isReady()) return

    let waiters = readyWaiters
    readyWaiters = []
    for (let waiter of waiters) {
      waiter()
    }
  }

  let watcher = watch([], {
    cwd: options.cwd,
    ...resolveChokidarWatchOptions(options.watch),
  })

  watcher.on('all', handleWatchEvent)

  let stopPromise: Promise<void> | undefined

  async function stop(signal: NodeJS.Signals = 'SIGTERM'): Promise<void> {
    stopping = true
    if (restartTimer !== undefined) {
      clearTimeout(restartTimer)
    }
    if (restartSettleTimer !== undefined) {
      clearTimeout(restartSettleTimer)
    }
    if (browserHmrEventFlushTimer !== undefined) {
      clearTimeout(browserHmrEventFlushTimer)
    }
    clearPendingHotUpdates()
    resolveReadyWaiters({ force: true })
    resolvePendingBrowserHmrRequests([])

    stopPromise ??= Promise.resolve()
      .then(() => watcher.close())
      .then(() => stopChild(child, { force: true, signal }))
      .then(async () => {
        let channel = await browserHmrEventChannelPromise
        await channel?.close()
      })
      .then(() => {
        resolveRun?.()
      })

    await stopPromise
  }

  let supervisor = {
    get generation() {
      return serverGeneration
    },

    ready,

    async start() {
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
  chokidarWatcherBySupervisor.set(supervisor, watcher)
  return supervisor
}

interface BrowserHmrEventChannel {
  close(): Promise<void>
  send(payload: HmrEventPayload): void
  url: string
}

interface HmrEventClient {
  close(): void
  send(payload: HmrEventPayload): void
}

async function createBrowserHmrEventChannel(
  options: BrowserHmrChannelOptions,
): Promise<BrowserHmrEventChannel> {
  let host = options.host ?? '127.0.0.1'
  let pathname = options.pathname ?? defaultBrowserHmrPathname
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

  let url = await listen(server, {
    host,
    pathname,
    port,
    serverName: 'node HMR browser channel',
  })

  return {
    async close() {
      for (let client of clients) {
        client.close()
      }
      clients.clear()

      await closeServer(server)
    },

    send(payload) {
      for (let client of clients) {
        client.send(payload)
      }
    },

    url,
  }
}

async function listen(
  server: Server,
  options: {
    host: string
    pathname?: string
    port: number
    serverName: string
  },
): Promise<string> {
  return await new Promise<string>((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(options.port, options.host, () => {
      server.off('error', reject)
      let address = server.address()
      if (!isAddressInfo(address)) {
        reject(new Error(`Failed to start ${options.serverName}.`))
        return
      }

      resolvePromise(`http://${options.host}:${address.port}${options.pathname ?? ''}`)
    })
  })
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }
      resolvePromise()
    })
  })
}

function writeCorsHeaders(response: ServerResponse, status: number): void {
  response.writeHead(status, {
    'Access-Control-Allow-Headers': 'Cache-Control',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  })
}

function formatServerSentEvent(payload: HmrEventPayload): string {
  return `data: ${JSON.stringify(payload)}\n\n`
}

export function resolveChokidarWatchOptions(
  options: NodeHmrWatchOptions = {},
): ResolvedChokidarWatchOptions {
  return {
    awaitWriteFinish: {
      pollInterval: 10,
      stabilityThreshold: 10,
    },
    depth: 0,
    ignorePermissionErrors: true,
    ignored: ['**/.git/**', ...(options.ignore ?? [])],
    ignoreInitial: true,
    interval: options.pollInterval ?? 100,
    usePolling: options.poll ?? process.platform === 'win32',
  }
}

export function buildChildProcessArgs(options: {
  browserEventUrl?: string
  entry: string
  entryArgs: Array<string>
  nodeArgs: Array<string>
  registerPath: string
  rootPath?: string
}): Array<string> {
  let registerUrl = pathToFileURL(options.registerPath)
  if (options.browserEventUrl !== undefined) {
    registerUrl.searchParams.set('browserEventUrl', options.browserEventUrl)
  }
  if (options.rootPath !== undefined) {
    registerUrl.searchParams.set('rootPath', options.rootPath)
  }

  return [
    ...options.nodeArgs,
    `--conditions=${nodeHmrCondition}`,
    '--import',
    registerUrl.href,
    options.entry,
    ...options.entryArgs,
  ]
}

export function buildChildProcessEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...env,
    [nodeHmrEnvVar]: '1',
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

async function stopChild(
  child: ChildProcess | undefined,
  options: { force: boolean; signal: NodeJS.Signals },
) {
  if (child === undefined) return
  if (child.exitCode !== null || child.signalCode !== null) return

  await new Promise<void>((resolvePromise) => {
    let timeout = options.force
      ? setTimeout(() => child.kill('SIGKILL'), shutdownTimeoutMs)
      : undefined

    child.once('exit', () => {
      if (timeout !== undefined) clearTimeout(timeout)
      resolvePromise()
    })

    child.kill(options.signal)
  })
}

function isChildMessage(message: unknown): message is ChildMessage {
  if (typeof message !== 'object' || message === null || !('type' in message)) return false

  if (message.type === 'node-hmr:child:browser-event-emitted') {
    return 'payload' in message && isHmrEventPayload(message.payload)
  }

  if (message.type === 'node-hmr:child:browser-hmr-channel-requested') {
    return 'requestId' in message && typeof message.requestId === 'number'
  }

  if (message.type === 'node-hmr:child:browser-hmr-watch-files-changed') {
    return (
      'id' in message &&
      typeof message.id === 'number' &&
      'delta' in message &&
      isWatchFileDelta(message.delta)
    )
  }

  if (message.type === 'node-hmr:child:browser-hmr-file-events-handled') {
    return (
      'requestId' in message &&
      typeof message.requestId === 'number' &&
      'events' in message &&
      Array.isArray(message.events) &&
      message.events.every(isBrowserHmrEvent) &&
      (!('error' in message) || typeof message.error === 'string')
    )
  }

  if (message.type === 'node-hmr:child:hot-module-updated') {
    return (
      'filePath' in message &&
      typeof message.filePath === 'string' &&
      'timestamp' in message &&
      typeof message.timestamp === 'number' &&
      'url' in message &&
      typeof message.url === 'string' &&
      (!('acceptedUrl' in message) || typeof message.acceptedUrl === 'string')
    )
  }

  if (message.type === 'node-hmr:child:hot-module-invalidated') {
    return (
      'acceptedUrl' in message &&
      typeof message.acceptedUrl === 'string' &&
      (!('message' in message) || typeof message.message === 'string') &&
      'timestamp' in message &&
      typeof message.timestamp === 'number' &&
      'url' in message &&
      typeof message.url === 'string'
    )
  }

  if (message.type === 'node-hmr:child:server-ready') return true

  if (message.type === 'node-hmr:child:restart-requested') {
    return !('message' in message) || typeof message.message === 'string'
  }

  if (message.type === 'node-hmr:child:module-imported') {
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

  if (message.type === 'node-hmr:child:accepted-deps-resolved') {
    return (
      'url' in message &&
      typeof message.url === 'string' &&
      'acceptedDeps' in message &&
      Array.isArray(message.acceptedDeps) &&
      message.acceptedDeps.every((dep) => typeof dep === 'string')
    )
  }

  if (message.type !== 'node-hmr:child:module-analyzed') return false

  return (
    'filePath' in message &&
    typeof message.filePath === 'string' &&
    'url' in message &&
    typeof message.url === 'string' &&
    'hmr' in message &&
    isHmrInfo(message.hmr)
  )
}

function isBrowserHmrEvent(event: unknown): event is BrowserHmrEvent {
  if (typeof event !== 'object' || event === null || !('type' in event)) return false

  if (event.type === 'update') {
    return (
      'data' in event && isJsonObject(event.data) && isOptionalStringArrayProperty(event, 'files')
    )
  }

  if (event.type === 'reload') {
    return isOptionalStringArrayProperty(event, 'files')
  }

  return false
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return isJsonValue(value) && typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isJsonValue(value: unknown, ancestors = new Set<object>()): boolean {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return true
  }
  if (typeof value !== 'object') return false

  let prototype = Object.getPrototypeOf(value)
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false
  if (ancestors.has(value)) return false

  ancestors.add(value)
  let values = Array.isArray(value) ? value : Object.values(value)
  let valid = values.every((item) => isJsonValue(item, ancestors))
  ancestors.delete(value)
  return valid
}

function isOptionalStringArrayProperty(value: object, property: string): boolean {
  if (!(property in value)) return true

  let candidate = (value as Record<string, unknown>)[property]
  return Array.isArray(candidate) && candidate.every((item) => typeof item === 'string')
}

function isWatchFileDelta(value: unknown): value is { add: string[]; remove: string[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'add' in value &&
    Array.isArray(value.add) &&
    value.add.every((item) => typeof item === 'string') &&
    'remove' in value &&
    Array.isArray(value.remove) &&
    value.remove.every((item) => typeof item === 'string')
  )
}

function isHmrInfo(value: unknown): value is ModuleRecord['hmr'] {
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

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isHmrEventPayload(value: unknown): value is HmrEventPayload {
  return (
    typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string'
  )
}
