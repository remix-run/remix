import { spawn, type ChildProcess } from 'node:child_process'
import { createServer, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { dirname, relative, resolve } from 'node:path'

import { createStyles } from '@remix-run/terminal'
import { watch } from 'chokidar'

import {
  type BrowserHmrFileEvent,
  defaultBrowserEventControllerPathname,
  type HmrBrowserIntent,
  type HmrEventPayload,
} from './browser-events.ts'

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
      type: 'node-hmr:child:browser-event-emitted'
    }
  | {
      delta: { add: string[]; remove: string[] }
      id: number
      type: 'node-hmr:child:browser-hmr-watch-directories-changed'
    }
  | {
      error?: string
      intents: HmrBrowserIntent[]
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
      hmr: NodeHmrModuleInfo['hmr']
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
      timestamp: number
      type: 'node-hmr:child:hot-module-invalidated'
      url: string
    }
  | {
      type: 'node-hmr:child:server-ready'
    }

const restartDelayMs = 50
const browserIntentFlushDelayMs = 75
const browserHmrRequestTimeoutMs = 1_000
const shutdownTimeoutMs = 5_000
const styles = createStyles()

interface BrowserEventControllerOptions {
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

export function createWatchedProcessController(options: {
  browserEventController: BrowserEventControllerOptions | null
  cwd: string
  entry: string
  entryArgs: string[]
  env: NodeJS.ProcessEnv
  nodeArgs: string[]
  registerPath: string
  watch?: NodeHmrWatchOptions
}): {
  start(): Promise<void>
  stop(signal?: NodeJS.Signals): Promise<void>
} {
  let browserEventController: BrowserEventChannel | null = null
  let child: ChildProcess | undefined
  let restartTimer: NodeJS.Timeout | undefined
  let resolveRun: (() => void) | undefined
  let moduleInfoByFilePath = new Map<string, NodeHmrModuleInfo[]>()
  let moduleInfoByUrl = new Map<string, NodeHmrModuleInfo>()
  let moduleDepsByUrl = new Map<string, Set<string>>()
  let watchedFilePaths = new Set<string>()
  let watchedDirectoryRefCounts = new Map<string, number>()
  let browserWatchedDirectoryRefCountsByRuntime = new Map<number, Map<string, number>>()
  let activeWatchedDirectories = new Set<string>()
  let pendingChangedPaths = new Set<string>()
  let pendingRestartPathEvents = new Map<string, 'add' | 'unlink'>()
  let pendingHotUpdateCount = 0
  let acceptedHotUpdateCount = 0
  let pendingBrowserIntents: HmrBrowserIntent[] = []
  let pendingBrowserIntentServerPaths = new Set<string>()
  let browserIntentFlushTimer: NodeJS.Timeout | undefined
  let browserHmrRequestId = 0
  let pendingBrowserHmrRequests = new Map<
    number,
    {
      resolve(intents: HmrBrowserIntent[]): void
      timer: NodeJS.Timeout
    }
  >()
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
    browserWatchedDirectoryRefCountsByRuntime = new Map()
    unwatchKnownModuleFiles()
    watchKnownModuleFile(getEntryPath())
    waitingForFileChangeAfterExit = false

    let entry = getEntryPath()
    let nextChild = spawn(
      process.execPath,
      buildChildProcessArgs({
        entry,
        browserEventUrl: browserEventController?.url,
        entryArgs: options.entryArgs,
        nodeArgs: options.nodeArgs,
        registerPath: options.registerPath,
        rootPath: options.cwd,
      }),
      {
        cwd: options.cwd,
        env: options.env,
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
      resolvePendingBrowserHmrRequests([])
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

    if (message.type === 'node-hmr:child:browser-event-emitted') {
      browserEventController?.send(message.payload)
      return
    }

    if (message.type === 'node-hmr:child:browser-hmr-watch-directories-changed') {
      updateBrowserWatchedDirectories(message.id, message.delta)
      return
    }

    if (message.type === 'node-hmr:child:browser-hmr-file-events-handled') {
      let request = pendingBrowserHmrRequests.get(message.requestId)
      if (request !== undefined) {
        clearTimeout(request.timer)
        pendingBrowserHmrRequests.delete(message.requestId)
        request.resolve(message.intents)
      }
      if (message.error !== undefined) {
        console.warn(`Browser HMR runtime failed: ${message.error}`)
      }
      return
    }

    if (message.type === 'node-hmr:child:hot-module-updated') {
      acceptedHotUpdateCount += 1
      flushAcceptedHotUpdateBrowserEvent()
      return
    }

    if (message.type === 'node-hmr:child:hot-module-invalidated') {
      propagateInvalidatedHotUpdate(message.url, message.timestamp).catch((error: unknown) => {
        console.error(error)
      })
      return
    }

    if (message.type === 'node-hmr:child:server-ready') {
      flushPendingServerUpdateEvent()
      return
    }

    if (message.type === 'node-hmr:child:restart-requested') {
      if (message.message !== undefined) {
        console.warn(message.message)
      }

      pendingServerUpdateEvent = true
      clearPendingHotUpdates()
      logRestart(message.message ?? 'import.meta.hot.invalidate()')
      restart().catch((error: unknown) => {
        console.error(error)
      })
      return
    }

    if (message.type === 'node-hmr:child:module-imported') {
      let deps = moduleDepsByUrl.get(message.importerUrl)
      if (!deps) {
        deps = new Set()
        moduleDepsByUrl.set(message.importerUrl, deps)
      }
      deps.add(message.depUrl)
      return
    }

    if (message.type === 'node-hmr:child:accepted-deps-resolved') {
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

    watchedFilePaths = nextWatchedFilePaths
    watchedDirectoryRefCounts = nextWatchedDirectoryRefCounts
    syncWatchedDirectories()
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
    watchedFilePaths = new Set()
    watchedDirectoryRefCounts = new Map()
    syncWatchedDirectories()
  }

  function updateBrowserWatchedDirectories(
    runtimeId: number,
    delta: { add: readonly string[]; remove: readonly string[] },
  ): void {
    let refCounts = browserWatchedDirectoryRefCountsByRuntime.get(runtimeId)
    if (refCounts === undefined) {
      refCounts = new Map()
      browserWatchedDirectoryRefCountsByRuntime.set(runtimeId, refCounts)
    }

    for (let directory of delta.add) {
      refCounts.set(directory, (refCounts.get(directory) ?? 0) + 1)
    }
    for (let directory of delta.remove) {
      let count = refCounts.get(directory)
      if (count === undefined) continue
      if (count <= 1) {
        refCounts.delete(directory)
      } else {
        refCounts.set(directory, count - 1)
      }
    }

    if (refCounts.size === 0) {
      browserWatchedDirectoryRefCountsByRuntime.delete(runtimeId)
    }

    syncWatchedDirectories()
  }

  function syncWatchedDirectories(): void {
    let nextWatchedDirectories = new Set(watchedDirectoryRefCounts.keys())
    for (let refCounts of browserWatchedDirectoryRefCountsByRuntime.values()) {
      for (let directory of refCounts.keys()) {
        nextWatchedDirectories.add(directory)
      }
    }

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
  }

  function handleWatchEvent(event: string, changedPath: string) {
    if (restartTimer !== undefined) {
      clearTimeout(restartTimer)
    }

    if (event === 'change') {
      pendingChangedPaths.add(resolve(options.cwd, changedPath))
    } else {
      pendingRestartPathEvents.set(
        resolve(options.cwd, changedPath),
        event === 'add' ? 'add' : 'unlink',
      )
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

    let restartPathEvents = new Map(pendingRestartPathEvents)
    let restartPaths = [...restartPathEvents.keys()]
    pendingRestartPathEvents = new Map()
    restartTimer = undefined

    let browserFileEvents = getBrowserHmrFileEvents(changedPaths, restartPathEvents)
    let browserIntents = await requestBrowserHmrIntents(browserFileEvents)
    for (let intent of browserIntents) {
      queueBrowserIntent(intent, { schedule: false })
    }

    if (waitingForFileChangeAfterExit) {
      logRestart(formatChangedPaths([...restartPaths, ...changedPaths], options.cwd))
      pendingServerUpdateEvent = true
      start()
      return
    }

    restartPaths = restartPaths.filter((changedPath) => watchedFilePaths.has(changedPath))

    if (restartPaths.length > 0) {
      markBrowserIntentServerPathsChecked(restartPaths)
      forceBrowserFullReloadIfBrowserWorkPending()
      logRestart(formatChangedPaths(restartPaths, options.cwd))
      pendingServerUpdateEvent = true
      await restart()
      return
    }

    let hotUpdates: NodeHmrUpdate[] = []
    let checkedChangedPaths: string[] = []
    for (let changedPath of changedPaths) {
      if (!watchedFilePaths.has(changedPath)) continue
      checkedChangedPaths.push(changedPath)

      let modules = moduleInfoByFilePath.get(changedPath)
      if (modules === undefined || modules.length === 0) {
        markBrowserIntentServerPathsChecked(checkedChangedPaths)
        forceBrowserFullReloadIfBrowserWorkPending()
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
          markBrowserIntentServerPathsChecked(checkedChangedPaths)
          forceBrowserFullReloadIfBrowserWorkPending()
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

    markBrowserIntentServerPathsChecked(checkedChangedPaths)

    pendingHotUpdateCount += hotUpdates.length
    if (hotUpdates.length === 0) {
      flushBrowserIntents({ serverReady: !pendingServerUpdateEvent })
      return
    }

    for (let moduleInfo of hotUpdates) {
      if (!sendHotUpdate(moduleInfo)) {
        clearPendingHotUpdates()
        forceBrowserFullReloadIfBrowserWorkPending()
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

    clearPendingHotUpdates()
    forceBrowserFullReloadIfBrowserWorkPending()
    if (flushBrowserIntents({ serverReady: true }) === 'reload') {
      pendingServerUpdateEvent = false
      return
    }

    browserEventController?.send({
      type: 'server:update',
    })
    pendingServerUpdateEvent = false
  }

  function flushAcceptedHotUpdateBrowserEvent(): void {
    if (pendingServerUpdateEvent) return
    if (pendingHotUpdateCount === 0 || acceptedHotUpdateCount < pendingHotUpdateCount) return

    clearPendingHotUpdates()
    if (flushBrowserIntents({ serverReady: true }) === 'reload') {
      return
    }

    browserEventController?.send({
      type: 'server:update',
    })
  }

  async function propagateInvalidatedHotUpdate(url: string, timestamp: number): Promise<void> {
    let moduleInfo = moduleInfoByUrl.get(url)
    let propagation = findHmrPropagationFromImporters(url, timestamp)
    if (!propagation || propagation.length === 0) {
      clearPendingHotUpdates()
      forceBrowserFullReloadIfBrowserWorkPending()
      logRestart(moduleInfo ? formatChangedPath(moduleInfo.filePath, options.cwd) : url)
      pendingServerUpdateEvent = true
      await restart()
      return
    }

    pendingHotUpdateCount = Math.max(0, pendingHotUpdateCount - 1) + propagation.length

    for (let update of propagation) {
      let filePath = moduleInfo?.filePath ?? update.acceptedUrl
      if (!sendHotUpdate({ ...update, filePath })) {
        clearPendingHotUpdates()
        forceBrowserFullReloadIfBrowserWorkPending()
        logRestart(moduleInfo ? formatChangedPath(moduleInfo.filePath, options.cwd) : url)
        pendingServerUpdateEvent = true
        await restart()
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

  function resolvePendingBrowserHmrRequests(intents: HmrBrowserIntent[]): void {
    for (let [requestId, request] of pendingBrowserHmrRequests) {
      clearTimeout(request.timer)
      request.resolve(intents)
      pendingBrowserHmrRequests.delete(requestId)
    }
  }

  function queueBrowserIntent(
    intent: HmrBrowserIntent,
    queueOptions: { schedule: boolean } = { schedule: true },
  ): void {
    pendingBrowserIntents.push(intent)
    for (let file of intent.files ?? []) {
      let filePath = resolve(options.cwd, file)
      if (watchedFilePaths.has(filePath)) {
        pendingBrowserIntentServerPaths.add(filePath)
      }
    }
    if (queueOptions.schedule) scheduleBrowserIntentFlush()
  }

  function scheduleBrowserIntentFlush(): void {
    if (browserIntentFlushTimer !== undefined) return

    browserIntentFlushTimer = setTimeout(() => {
      browserIntentFlushTimer = undefined
      flushBrowserIntents({
        serverReady:
          !pendingServerUpdateEvent &&
          pendingBrowserIntentServerPaths.size === 0 &&
          (pendingHotUpdateCount === 0 || acceptedHotUpdateCount >= pendingHotUpdateCount),
      })
    }, browserIntentFlushDelayMs)
  }

  function forceBrowserFullReloadIfBrowserWorkPending(): void {
    if (pendingBrowserIntents.length === 0) return

    let reloadIntent = pendingBrowserIntents.find((intent) => intent.type === 'reload')
    pendingBrowserIntents = [
      reloadIntent ?? {
        reason: 'server restart with browser updates',
        type: 'reload',
      },
    ]
    pendingBrowserIntentServerPaths.clear()
  }

  function getBrowserHmrFileEvents(
    changedPaths: readonly string[],
    restartPathEvents: ReadonlyMap<string, 'add' | 'unlink'>,
  ): BrowserHmrFileEvent[] {
    return [
      ...changedPaths.map((filePath) => ({ event: 'change' as const, filePath })),
      ...[...restartPathEvents].map(([filePath, event]) => ({ event, filePath })),
    ]
  }

  async function requestBrowserHmrIntents(
    events: readonly BrowserHmrFileEvent[],
  ): Promise<HmrBrowserIntent[]> {
    if (events.length === 0) return []
    if (child === undefined || child.send === undefined || !child.connected) return []

    let requestId = browserHmrRequestId++
    let intents = await new Promise<HmrBrowserIntent[]>((resolvePromise) => {
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

    return intents
  }

  function flushBrowserIntents(options: { serverReady: boolean }): 'events' | 'reload' | 'none' {
    if (pendingBrowserIntents.length === 0) return 'none'
    if (!options.serverReady) return 'none'
    if (pendingBrowserIntentServerPaths.size > 0) return 'none'

    if (browserIntentFlushTimer !== undefined) {
      clearTimeout(browserIntentFlushTimer)
      browserIntentFlushTimer = undefined
    }

    let reloadIntent = pendingBrowserIntents.find((intent) => intent.type === 'reload')
    if (reloadIntent) {
      pendingBrowserIntents = []
      browserEventController?.send({
        type: 'browser:reload',
      })
      return 'reload'
    }

    let intents = pendingBrowserIntents
    pendingBrowserIntents = []
    for (let intent of intents) {
      if (intent.type === 'update') {
        browserEventController?.send({
          timestamp: intent.timestamp,
          type: 'browser:update',
          updates: intent.updates,
        })
      }
    }
    return 'events'
  }

  function markBrowserIntentServerPathsChecked(filePaths: readonly string[]): void {
    for (let filePath of filePaths) {
      pendingBrowserIntentServerPaths.delete(filePath)
    }
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

  function findHmrPropagationFromImporters(
    url: string,
    timestamp: number,
    traversed: Set<string> = new Set([url]),
    invalidatedUrls: string[] = [url],
  ): Array<Omit<NodeHmrUpdate, 'filePath'>> | null {
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
      type: 'node-hmr:parent:hot-module-changed',
      url: moduleInfo.url,
      timestamp: Date.now(),
    })
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
    if (browserIntentFlushTimer !== undefined) {
      clearTimeout(browserIntentFlushTimer)
    }
    clearPendingHotUpdates()
    resolvePendingBrowserHmrRequests([])

    stopPromise ??= Promise.resolve()
      .then(() => watcher.close())
      .then(() => stopChild(child, signal))
      .then(() => browserEventController?.close())
      .then(() => {
        resolveRun?.()
      })

    await stopPromise
  }

  return {
    async start() {
      try {
        browserEventController =
          options.browserEventController === null
            ? null
            : await createBrowserEventChannel(options.browserEventController)
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
  options: BrowserEventControllerOptions,
): Promise<BrowserEventChannel> {
  let host = options.host ?? '127.0.0.1'
  let pathname = options.pathname ?? defaultBrowserEventControllerPathname
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
        reject(new Error('Failed to start node HMR browser event controller.'))
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

  return [...options.nodeArgs, '--import', registerUrl.href, options.entry, ...options.entryArgs]
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

  if (message.type === 'node-hmr:child:browser-event-emitted') {
    return 'payload' in message && isHmrEventPayload(message.payload)
  }

  if (message.type === 'node-hmr:child:browser-hmr-watch-directories-changed') {
    return (
      'id' in message &&
      typeof message.id === 'number' &&
      'delta' in message &&
      isWatchDirectoryDelta(message.delta)
    )
  }

  if (message.type === 'node-hmr:child:browser-hmr-file-events-handled') {
    return (
      'requestId' in message &&
      typeof message.requestId === 'number' &&
      'intents' in message &&
      Array.isArray(message.intents) &&
      message.intents.every(isHmrBrowserIntent) &&
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

function isHmrBrowserIntent(intent: unknown): intent is HmrBrowserIntent {
  if (typeof intent !== 'object' || intent === null || !('type' in intent)) return false

  if (intent.type === 'update') {
    return (
      isOptionalStringArrayProperty(intent, 'files') &&
      'timestamp' in intent &&
      typeof intent.timestamp === 'number' &&
      'updates' in intent &&
      Array.isArray(intent.updates) &&
      intent.updates.every(isHmrBrowserUpdate)
    )
  }

  if (intent.type === 'reload') {
    return (
      isOptionalStringArrayProperty(intent, 'files') &&
      (!('reason' in intent) || typeof intent.reason === 'string')
    )
  }

  return false
}

function isHmrBrowserUpdate(update: unknown): boolean {
  if (typeof update !== 'object' || update === null || !('type' in update)) return false

  if (update.type === 'js') {
    return (
      'path' in update &&
      typeof update.path === 'string' &&
      (!('acceptedPath' in update) || typeof update.acceptedPath === 'string')
    )
  }

  if (update.type === 'css') {
    return 'path' in update && typeof update.path === 'string'
  }

  return false
}

function isOptionalStringArrayProperty(value: object, property: string): boolean {
  if (!(property in value)) return true

  let candidate = (value as Record<string, unknown>)[property]
  return Array.isArray(candidate) && candidate.every((item) => typeof item === 'string')
}

function isWatchDirectoryDelta(value: unknown): value is { add: string[]; remove: string[] } {
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

function isHmrEventPayload(value: unknown): value is HmrEventPayload {
  return (
    typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string'
  )
}
