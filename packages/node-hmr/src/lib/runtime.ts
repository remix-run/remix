import { fileURLToPath } from 'node:url'

import { sendHmrEventPayload, type BrowserEventChannel } from './browser-events.ts'
import { emitServerHmrEvent } from './events.ts'
import { hasNodeHmrParentProcess } from './process-state.ts'

export interface ImportMetaHot {
  readonly data: Record<string, unknown>
  accept(callback?: (module: HotModule) => HotCallbackResult): void
  accept(dep: string, callback?: (module: HotModule) => HotCallbackResult): void
  accept(
    deps: readonly string[],
    callback?: (modules: Array<HotModule | undefined>) => HotCallbackResult,
  ): void
  dispose(callback: (data: Record<string, unknown>) => HotCallbackResult): void
  invalidate(message?: string): void
  on(event: string, callback: (data: unknown) => void | Promise<void>): void
}

type HotModule = Readonly<Record<string, unknown>> & {
  readonly [Symbol.toStringTag]: 'Module'
}

export interface RemixNodeHmrRuntime {
  readonly browserEventChannel: BrowserEventChannel | undefined
  createHotContext(url: string, resolveDependency?: (specifier: string) => string): ImportMetaHot
  disposeAll(): Promise<void>
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

class NodeHotContext implements ImportMetaHot {
  readonly data: Record<string, unknown>
  readonly url: string

  #acceptCallbacks: Array<HotCallback> = []
  #acceptDependencyCallbacks: Array<HotDependencyCallback> = []
  #disposeCallbacks: Array<DisposeCallback> = []
  #resolveDependency: (specifier: string) => string

  constructor(
    url: string,
    data: Record<string, unknown>,
    resolveDependency: (specifier: string) => string,
  ) {
    this.data = data
    this.url = url
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

  async update(timestamp: number, acceptedUrl: string) {
    if (acceptedUrl !== this.url) {
      await this.updateDependency(timestamp, acceptedUrl)
      return
    }

    if (this.#acceptCallbacks.length === 0) {
      requestRestart(`No HMR accept handler found for ${this.url}`)
      return
    }

    await this.disposeAll()

    let updatedModule = await import(`${this.url}?t=${timestamp}`)
    for (let callback of this.#acceptCallbacks) {
      await callback(updatedModule)
    }
  }

  async updateDependency(timestamp: number, acceptedUrl: string) {
    let callbacks = this.#acceptDependencyCallbacks.filter((callback) =>
      callback.deps.includes(acceptedUrl),
    )
    if (callbacks.length === 0) {
      requestRestart(`No HMR accept handler found for ${acceptedUrl} via ${this.url}`)
      return
    }

    let updatedModule = await import(`${acceptedUrl}?t=${timestamp}`)
    for (let { callback } of callbacks) {
      await callback(updatedModule, acceptedUrl)
    }
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

export function installNodeHmrRuntime(
  options: {
    browserEventUrl?: string
  } = {},
): RemixNodeHmrRuntime {
  let runtimeGlobal = globalThis as RuntimeGlobal
  if (runtimeGlobal.__remixNodeHmr) return runtimeGlobal.__remixNodeHmr

  let dataByUrl = new Map<string, Record<string, unknown>>()
  let contextsByUrl = new Map<string, NodeHotContext>()

  let runtime: RemixNodeHmrRuntime = {
    browserEventChannel:
      options.browserEventUrl === undefined
        ? undefined
        : {
            send: sendHmrEventPayload,
            url: options.browserEventUrl,
          },

    createHotContext(url, resolveDependency = (specifier) => new URL(specifier, url).href) {
      let data = dataByUrl.get(url)
      if (data === undefined) {
        data = {}
        dataByUrl.set(url, data)
      }

      let context = new NodeHotContext(url, data, resolveDependency)
      contextsByUrl.set(url, context)
      return context
    },

    reportAcceptedDependencies(url, acceptedDeps) {
      if (!hasNodeHmrParentProcess()) return

      process.send?.({
        type: 'module-accepted-deps-resolved',
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
        await context.update(timestamp, acceptedUrl)
        emitServerHmrEvent({
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
      type: 'hmr:restart',
      message,
    })
    return
  }

  process.kill(process.pid, 'SIGTERM')
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
