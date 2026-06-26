import { fileURLToPath } from 'node:url'

import {
  type BrowserHmrChannel,
  type BrowserHmrEvent,
  type BrowserHmrFileEvent,
  type BrowserHmrFileEventHandler,
  type BrowserHmrWatchedFileDelta,
  sendHmrEventPayload,
} from './browser-events.ts'
import { emitServerHmrEvent, emitServerHmrUpdate } from './events.ts'
import { hasNodeHmrParentProcess } from './process-state.ts'

/**
 * Hot module context available at `import.meta.hot`.
 */
export interface ImportMetaHot {
  /** State object preserved across accepted updates for this module. */
  readonly data: Record<string, unknown>
  /** Accepts updates to the current module. */
  accept(callback?: (module: HotModule) => HotCallbackResult): void
  /** Accepts updates from a dependency module. */
  accept(dep: string, callback?: (module: HotModule) => HotCallbackResult): void
  /** Accepts updates from one or more dependency modules. */
  accept(
    deps: readonly string[],
    callback?: (modules: Array<HotModule | undefined>) => HotCallbackResult,
  ): void
  /** Registers cleanup to run before this module is replaced or disposed. */
  dispose(callback: (data: Record<string, unknown>) => HotCallbackResult): void
  /** Invalidates this update and asks the runner to restart the process. */
  invalidate(message?: string): void
  /** Listens for custom HMR events. */
  on(event: string, callback: (data: unknown) => void | Promise<void>): void
}

type HotModule = Readonly<Record<string, unknown>> & {
  readonly [Symbol.toStringTag]: 'Module'
}

export interface RemixNodeHmrRuntime {
  createBrowserHmrChannel(): Promise<BrowserHmrChannel>
  createHotContext(url: string, resolveDependency?: (specifier: string) => string): ImportMetaHot
  disposeAll(): Promise<void>
  emitServerReady(): void
  handleBrowserHmrFileEvents(requestId: number, events: readonly BrowserHmrFileEvent[]): void
  reportAcceptedDependencies(url: string, acceptedDeps: string[]): void
  update(url: string, timestamp: number, acceptedUrl?: string): Promise<void>
}

type RuntimeGlobal = typeof globalThis & {
  __remixNodeHmr?: RemixNodeHmrRuntime
}

type HotCallbackResult = void | Promise<void>
type HotCallback = (module: HotModule) => HotCallbackResult
type HotDependencyCallbackFunction = (module: HotModule) => HotCallbackResult
type HotDependencyArrayUpdateCallbackFunction = (
  modules: Array<HotModule | undefined>,
) => HotCallbackResult
type HotDependencyUpdateCallback = (module: HotModule, acceptedUrl: string) => HotCallbackResult
type HotDependencyCallback = {
  callback: HotDependencyUpdateCallback
  deps: string[]
}
type DisposeCallback = (data: Record<string, unknown>) => HotCallbackResult
type HotUpdateResult = 'accepted' | 'invalidated' | 'restart-requested'
const browserHmrChannelRequestTimeoutMs = 5_000

class NodeHotContext implements ImportMetaHot {
  readonly data: Record<string, unknown>
  readonly url: string

  #acceptCallbacks: Array<HotCallback> = []
  #acceptDependencyCallbacks: Array<HotDependencyCallback> = []
  #disposeCallbacks: Array<DisposeCallback> = []
  #invalidated = false
  #invalidationMessage: string | undefined
  #isUpdating = false
  #disposeDependency: (url: string) => Promise<void>
  #resolveDependency: (specifier: string) => string

  constructor(
    url: string,
    data: Record<string, unknown>,
    disposeDependency: (url: string) => Promise<void>,
    resolveDependency: (specifier: string) => string,
  ) {
    this.data = data
    this.url = url
    this.#disposeDependency = disposeDependency
    this.#resolveDependency = resolveDependency
  }

  accept(callback?: (module: HotModule) => HotCallbackResult): void
  accept(dep: string, callback?: (module: HotModule) => HotCallbackResult): void
  accept(
    deps: readonly string[],
    callback?: (modules: Array<HotModule | undefined>) => HotCallbackResult,
  ): void
  accept(
    deps?: string | readonly string[] | HotCallback,
    callback: HotDependencyCallbackFunction | HotDependencyArrayUpdateCallbackFunction = () => {},
  ) {
    if (typeof deps === 'string') {
      let normalizedDeps = [this.#normalizeAcceptedDependency(deps)]
      let dependencyCallback = callback as HotDependencyCallbackFunction
      this.#acceptDependencyCallbacks.push({
        callback(module) {
          return dependencyCallback(module)
        },
        deps: normalizedDeps,
      })
      return
    }

    if (isDependencyArray(deps)) {
      let normalizedDeps = deps.map((dep) => this.#normalizeAcceptedDependency(dep))
      let dependencyCallback = callback as HotDependencyArrayUpdateCallbackFunction
      this.#acceptDependencyCallbacks.push({
        callback(module, acceptedUrl) {
          return dependencyCallback(
            normalizedDeps.map((dep) => (dep === acceptedUrl ? module : undefined)),
          )
        },
        deps: normalizedDeps,
      })
      return
    }

    this.#acceptCallbacks.push(deps ?? (() => {}))
  }

  dispose(callback: DisposeCallback) {
    this.#disposeCallbacks.push(callback)
  }

  invalidate(message?: string) {
    this.#invalidated = true
    this.#invalidationMessage = message
    if (this.#isUpdating) {
      if (message !== undefined) console.warn(message)
      return
    }
    requestRestart(message)
  }

  on(_event: string, _callback: (data: unknown) => void | Promise<void>) {
    void _event
    void _callback
  }

  async disposeAll() {
    for (let callback of this.#disposeCallbacks) {
      await callback(this.data)
    }
  }

  async update(timestamp: number, acceptedUrl: string): Promise<HotUpdateResult> {
    this.#invalidated = false
    this.#invalidationMessage = undefined

    if (acceptedUrl !== this.url) {
      return await this.updateDependency(timestamp, acceptedUrl)
    }

    if (this.#acceptCallbacks.length === 0) {
      requestRestart(`No HMR accept handler found for ${this.url}`)
      return 'restart-requested'
    }

    await this.disposeAll()

    this.#isUpdating = true
    try {
      let updatedModule = await import(`${this.url}?t=${timestamp}`)
      for (let callback of this.#acceptCallbacks) {
        await callback(updatedModule)
      }
    } finally {
      this.#isUpdating = false
    }

    return this.#invalidated ? 'invalidated' : 'accepted'
  }

  get invalidationMessage(): string | undefined {
    return this.#invalidationMessage
  }

  async updateDependency(timestamp: number, acceptedUrl: string): Promise<HotUpdateResult> {
    let callbacks = this.#acceptDependencyCallbacks.filter((callback) =>
      callback.deps.includes(acceptedUrl),
    )
    if (callbacks.length === 0) {
      requestRestart(`No HMR accept handler found for ${acceptedUrl} via ${this.url}`)
      return 'restart-requested'
    }

    this.#isUpdating = true
    try {
      await this.#disposeDependency(acceptedUrl)
      let updatedModule = await import(`${acceptedUrl}?t=${timestamp}`)
      for (let { callback } of callbacks) {
        await callback(updatedModule, acceptedUrl)
      }
    } finally {
      this.#isUpdating = false
    }

    return this.#invalidated ? 'invalidated' : 'accepted'
  }

  #normalizeAcceptedDependency(dep: string): string {
    let resolved = this.#resolveDependency(dep)
    let url = new URL(resolved)
    url.search = ''
    url.hash = ''
    return url.href
  }
}

function isDependencyArray(
  deps: string | readonly string[] | HotCallback | undefined,
): deps is readonly string[] {
  return Array.isArray(deps)
}

export function getNodeHmrRuntime(): RemixNodeHmrRuntime | undefined {
  let runtimeGlobal = globalThis as RuntimeGlobal
  return runtimeGlobal.__remixNodeHmr
}

/**
 * Notifies the parent process that the child server is ready.
 */
export function emitServerReady(): void {
  getNodeHmrRuntime()?.emitServerReady()
}

export function installNodeHmrRuntime(
  options: {
    browserEventUrl?: string
  } = {},
): RemixNodeHmrRuntime {
  let runtimeGlobal = globalThis as RuntimeGlobal
  if (runtimeGlobal.__remixNodeHmr) return runtimeGlobal.__remixNodeHmr

  let dataByUrl = new Map<string, Record<string, unknown>>()
  let contextsByUrl = new Map<string, NodeHotContext>()
  let browserEventUrl = options.browserEventUrl
  let browserHmrChannelId = 0
  let browserHmrChannelRequestId = 0
  let pendingBrowserHmrChannelRequests = new Map<
    number,
    {
      resolve(url: string | undefined): void
      timer: ReturnType<typeof setTimeout>
    }
  >()
  let browserHmrChannels = new Map<
    number,
    {
      handleFileEvents(events: readonly BrowserHmrFileEvent[]): Promise<readonly BrowserHmrEvent[]>
    }
  >()

  process.on('message', (message: unknown) => {
    if (!isBrowserHmrChannelMessage(message)) return

    let request = pendingBrowserHmrChannelRequests.get(message.requestId)
    if (request === undefined) return

    clearTimeout(request.timer)
    pendingBrowserHmrChannelRequests.delete(message.requestId)
    request.resolve(message.url)
  })

  let runtime: RemixNodeHmrRuntime = {
    async createBrowserHmrChannel() {
      browserEventUrl ??= await requestBrowserHmrChannelUrl()
      if (browserEventUrl === undefined) {
        throw new Error('Browser HMR is disabled for this node-hmr runtime')
      }

      let id = browserHmrChannelId++
      let watchedFiles = new Set<string>()
      let handlers = new Set<BrowserHmrFileEventHandler>()
      let closed = false
      browserHmrChannels.set(id, {
        async handleFileEvents(events) {
          let eventGroups = await Promise.all([...handlers].map((handler) => handler(events)))
          return eventGroups.flat()
        },
      })

      function updateWatchedFiles(delta: BrowserHmrWatchedFileDelta): void {
        if (closed) return

        for (let file of delta.add) {
          watchedFiles.add(file)
        }
        for (let file of delta.remove) {
          watchedFiles.delete(file)
        }
        process.send?.({
          id,
          delta,
          type: 'node-hmr:child:browser-hmr-watch-files-changed',
        })
      }

      return {
        close() {
          if (closed) return
          closed = true

          browserHmrChannels.delete(id)
          handlers.clear()
          let remove = [...watchedFiles]
          watchedFiles.clear()
          process.send?.({
            id,
            delta: { add: [], remove },
            type: 'node-hmr:child:browser-hmr-watch-files-changed',
          })
        },

        onFileEvents(handler) {
          if (closed) return () => {}

          handlers.add(handler)
          return () => {
            handlers.delete(handler)
          }
        },

        updateWatchedFiles,

        url: browserEventUrl,
      }
    },

    createHotContext(url, resolveDependency = (specifier) => new URL(specifier, url).href) {
      let data = dataByUrl.get(url)
      if (data === undefined) {
        data = {}
        dataByUrl.set(url, data)
      }

      let context = new NodeHotContext(
        url,
        data,
        async (dependencyUrl) => {
          await contextsByUrl.get(dependencyUrl)?.disposeAll()
        },
        resolveDependency,
      )
      contextsByUrl.set(url, context)
      return context
    },

    emitServerReady() {
      if (!hasNodeHmrParentProcess()) return

      process.send?.({
        type: 'node-hmr:child:server-ready',
      })
    },

    handleBrowserHmrFileEvents(requestId, events) {
      if (!hasNodeHmrParentProcess()) return

      Promise.all(
        [...browserHmrChannels.values()].map((browserHmrChannel) =>
          browserHmrChannel.handleFileEvents(events),
        ),
      )
        .then((eventGroups) => {
          process.send?.({
            events: eventGroups.flat(),
            requestId,
            type: 'node-hmr:child:browser-hmr-file-events-handled',
          })
        })
        .catch((error: unknown) => {
          process.send?.({
            error: formatUnknownError(error),
            events: [],
            requestId,
            type: 'node-hmr:child:browser-hmr-file-events-handled',
          })
        })
    },

    reportAcceptedDependencies(url, acceptedDeps) {
      if (!hasNodeHmrParentProcess()) return

      process.send?.({
        type: 'node-hmr:child:accepted-deps-resolved',
        url,
        acceptedDeps,
      })
    },

    async disposeAll() {
      for (let context of contextsByUrl.values()) {
        await context.disposeAll()
      }

      contextsByUrl.clear()
    },

    async update(url, timestamp, acceptedUrl = url) {
      let context = contextsByUrl.get(url)
      if (context === undefined) {
        requestRestart(`No HMR context found for ${url}`)
        return
      }

      try {
        let updateResult = await context.update(timestamp, acceptedUrl)
        if (updateResult === 'invalidated') {
          process.send?.({
            acceptedUrl,
            message: context.invalidationMessage,
            timestamp,
            type: 'node-hmr:child:hot-module-invalidated',
            url,
          })
          return
        }
        if (updateResult === 'restart-requested') return

        emitServerHmrUpdate({
          ...(acceptedUrl === url ? {} : { acceptedUrl }),
          filePath: acceptedUrl.startsWith('file:') ? fileURLToPath(acceptedUrl) : acceptedUrl,
          timestamp,
          type: 'update',
          url,
        })
      } catch (error) {
        requestRestart(`Failed to hot update ${url}: ${formatUnknownError(error)}`)
      }
    },
  }

  runtimeGlobal.__remixNodeHmr = runtime
  return runtime

  function requestBrowserHmrChannelUrl(): Promise<string | undefined> {
    if (!hasNodeHmrParentProcess()) return Promise.resolve(undefined)

    let requestId = browserHmrChannelRequestId++
    return new Promise((resolvePromise) => {
      let timer = setTimeout(() => {
        pendingBrowserHmrChannelRequests.delete(requestId)
        resolvePromise(undefined)
      }, browserHmrChannelRequestTimeoutMs)

      pendingBrowserHmrChannelRequests.set(requestId, {
        resolve: resolvePromise,
        timer,
      })

      if (
        !process.send?.({
          requestId,
          type: 'node-hmr:child:browser-hmr-channel-requested',
        })
      ) {
        clearTimeout(timer)
        pendingBrowserHmrChannelRequests.delete(requestId)
        resolvePromise(undefined)
      }
    })
  }
}

function isBrowserHmrChannelMessage(message: unknown): message is {
  requestId: number
  type: 'node-hmr:parent:browser-hmr-channel'
  url?: string
} {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'node-hmr:parent:browser-hmr-channel' &&
    'requestId' in message &&
    typeof message.requestId === 'number' &&
    (!('url' in message) || typeof message.url === 'string')
  )
}

function requestRestart(message?: string): void {
  if (message !== undefined) {
    console.warn(message)
  }

  emitServerHmrEvent({
    reason: message,
    timestamp: Date.now(),
    type: 'restart',
  })

  if (process.send) {
    process.send({
      type: 'node-hmr:child:restart-requested',
      message,
    })
    return
  }

  process.kill(process.pid, 'SIGTERM')
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
