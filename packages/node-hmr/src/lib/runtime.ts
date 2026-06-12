import { fileURLToPath } from 'node:url'

import { sendHmrEventPayload, type HmrEventChannel } from './browser-events.ts'
import { emitServerHmrEvent } from './events.ts'

export interface RemixNodeHotContext {
  readonly data: Record<string, unknown>
  accept(callback?: (module: unknown) => void): void
  accept(dep: string, callback?: (module: unknown) => void): void
  accept(deps: string[], callback?: (modules: unknown[]) => void): void
  dispose(callback: (data: Record<string, unknown>) => void): void
  invalidate(message?: string): void
  on(event: string, callback: (data: unknown) => void | Promise<void>): void
}

export interface RemixNodeHmrRuntime {
  readonly eventChannel: HmrEventChannel | undefined
  createHotContext(url: string): RemixNodeHotContext
  disposeAll(): void
  update(url: string, timestamp: number, acceptedUrl?: string): Promise<void>
}

type RuntimeGlobal = typeof globalThis & {
  __remixNodeHmr?: RemixNodeHmrRuntime
}

type HotCallback = (module: unknown) => void
type HotDependencyCallbackFunction = (module: unknown) => void
type HotDependencyArrayCallbackFunction = (modules: unknown[]) => void
type HotDependencyCallback = {
  callback: HotDependencyCallbackFunction | HotDependencyArrayCallbackFunction
  deps: string[]
}
type DisposeCallback = (data: Record<string, unknown>) => void

class NodeHotContext implements RemixNodeHotContext {
  readonly data: Record<string, unknown>
  readonly url: string

  #acceptCallbacks: Array<HotCallback> = []
  #acceptDependencyCallbacks: Array<HotDependencyCallback> = []
  #disposeCallbacks: Array<DisposeCallback> = []

  constructor(url: string, data: Record<string, unknown>) {
    this.data = data
    this.url = url
  }

  accept(callback?: (module: unknown) => void): void
  accept(dep: string, callback?: (module: unknown) => void): void
  accept(deps: string[], callback?: (modules: unknown[]) => void): void
  accept(
    deps?: string | string[] | HotCallback,
    callback: HotDependencyCallbackFunction | HotDependencyArrayCallbackFunction = () => {},
  ) {
    if (typeof deps === 'string') {
      this.#acceptDependencyCallbacks.push({
        callback,
        deps: [normalizeAcceptedDependency(this.url, deps)],
      })
      return
    }

    if (Array.isArray(deps)) {
      this.#acceptDependencyCallbacks.push({
        callback,
        deps: deps.map((dep) => normalizeAcceptedDependency(this.url, dep)),
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

  disposeAll() {
    for (let callback of this.#disposeCallbacks) {
      callback(this.data)
    }
  }

  async update(timestamp: number, acceptedUrl: string) {
    if (acceptedUrl !== this.url) {
      await this.updateDependency(timestamp, acceptedUrl)
      return
    }

    this.disposeAll()

    let updatedModule = await import(`${this.url}?t=${timestamp}`)
    for (let callback of this.#acceptCallbacks) {
      callback(updatedModule)
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
    for (let { callback, deps } of callbacks) {
      if (deps.length === 1) {
        callback(updatedModule)
      } else {
        callback(deps.map((dep) => (dep === acceptedUrl ? updatedModule : undefined)))
      }
    }
  }
}

export function getNodeHmrRuntime(): RemixNodeHmrRuntime | undefined {
  let runtimeGlobal = globalThis as RuntimeGlobal
  return runtimeGlobal.__remixNodeHmr
}

export function installNodeHmrRuntime(options: {
  eventUrl?: string
} = {}): RemixNodeHmrRuntime {
  let runtimeGlobal = globalThis as RuntimeGlobal
  if (runtimeGlobal.__remixNodeHmr) return runtimeGlobal.__remixNodeHmr

  let dataByUrl = new Map<string, Record<string, unknown>>()
  let contextsByUrl = new Map<string, NodeHotContext>()

  let runtime: RemixNodeHmrRuntime = {
    eventChannel:
      options.eventUrl === undefined
        ? undefined
        : {
            send: sendHmrEventPayload,
            url: options.eventUrl,
          },

    createHotContext(url) {
      let data = dataByUrl.get(url)
      if (data === undefined) {
        data = {}
        dataByUrl.set(url, data)
      }

      let context = new NodeHotContext(url, data)
      contextsByUrl.set(url, context)
      return context
    },

    disposeAll() {
      for (let context of contextsByUrl.values()) {
        context.disposeAll()
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

function normalizeAcceptedDependency(importerUrl: string, dep: string): string {
  return new URL(dep, importerUrl).href
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
