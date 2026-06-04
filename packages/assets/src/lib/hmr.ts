export interface RemixHotContext {
  readonly data: Record<string, unknown>
  accept(callback?: (module: unknown) => void): void
  accept(dep: string, callback?: (module: unknown) => void): void
  accept(deps: string[], callback?: (modules: unknown[]) => void): void
  dispose(callback: (data: Record<string, unknown>) => void): void
  invalidate(message?: string): void
  on(event: string, callback: (data: unknown) => void | Promise<void>): void
}

export type HmrPayload =
  | {
      type: 'connected'
    }
  | {
      data?: unknown
      event: string
      type: 'custom'
    }
  | {
      acceptedPath?: string
      path: string
      timestamp: number
      type: 'css-update' | 'full-reload' | 'js-update'
    }

type HmrClient = {
  close(): void
  send(payload: HmrPayload): void
}

export type HmrBroadcaster = {
  close(): void
  connect(): Response
  send(payload: HmrPayload): void
}

export function createHmrBroadcaster(): HmrBroadcaster {
  let clients = new Set<HmrClient>()

  return {
    close() {
      for (let client of clients) {
        client.close()
      }
      clients.clear()
    },

    connect() {
      let encoder = new TextEncoder()
      let client: HmrClient

      let stream = new ReadableStream<Uint8Array>({
        start(controller) {
          client = {
            close() {
              controller.close()
              clients.delete(client)
            },
            send(payload) {
              controller.enqueue(encoder.encode(formatServerSentEvent(payload)))
            },
          }

          clients.add(client)
          client.send({ type: 'connected' })
        },
        cancel() {
          clients.delete(client)
        },
      })

      return new Response(stream, {
        headers: {
          'Cache-Control': 'no-cache',
          'Content-Type': 'text/event-stream; charset=utf-8',
        },
      })
    },

    send(payload) {
      for (let client of clients) {
        client.send(payload)
      }
    },
  }
}

export function createHmrClientSource(options: { eventPathname: string }): string {
  return `
const contexts = new Map()
const dataByPath = new Map()

class RemixHmrContext {
  constructor(path) {
    this.path = path
    this.data = dataByPath.get(path) ?? {}
    this.acceptCallbacks = []
    this.acceptDependencyCallbacks = []
    this.disposeCallbacks = []
    this.customEventCallbacks = new Map()
    dataByPath.set(path, this.data)
  }

  accept(deps, callback) {
    if (typeof deps === 'string') {
      this.acceptDependencyCallbacks.push({
        deps: [normalizeAcceptedDependency(this.path, deps)],
        callback: callback ?? (() => {}),
      })
      return
    }

    if (Array.isArray(deps)) {
      this.acceptDependencyCallbacks.push({
        deps: deps.map((dep) => normalizeAcceptedDependency(this.path, dep)),
        callback: callback ?? (() => {}),
      })
      return
    }

    this.acceptCallbacks.push(deps ?? (() => {}))
  }

  dispose(callback) {
    this.disposeCallbacks.push(callback)
  }

  invalidate(message) {
    if (message) console.warn(message)
    reloadPage()
  }

  on(event, callback) {
    let callbacks = this.customEventCallbacks.get(event)
    if (!callbacks) {
      callbacks = []
      this.customEventCallbacks.set(event, callbacks)
    }
    callbacks.push(callback)
  }
}

export function createHotContext(path) {
  let context = new RemixHmrContext(path)
  contexts.set(path, context)
  return context
}

let connected = false
let reconnectPending = false
let pageReloadTimer

let events = new EventSource(${JSON.stringify(options.eventPathname)})

events.onerror = () => {
  if (connected) reconnectPending = true
  console.warn('[remix] HMR connection lost, retrying...')
}

events.onmessage = (event) => {
  handlePayload(JSON.parse(event.data)).catch((error) => {
    console.error('[remix] HMR update failed', error)
    reloadPage()
  })
}

async function handlePayload(payload) {
  if (payload.type === 'connected') {
    console.info('[remix] HMR connected')
    if (reconnectPending) {
      reconnectPending = false
      await dispatchCustomEvent('remix:server-update', {
        reason: 'reconnect',
        timestamp: Date.now(),
      })
    }
    connected = true
    return
  }

  console.info('[remix] HMR payload', payload)

  if (payload.type === 'full-reload') {
    console.info('[remix] HMR reloading page', payload.path)
    reloadPage()
    return
  }

  if (payload.type === 'custom') {
    console.info('[remix] HMR custom event', payload.event)
    await dispatchCustomEvent(payload.event, payload.data)
    return
  }

  if (payload.type === 'css-update') {
    console.info('[remix] HMR updating stylesheet', payload.path)
    reloadStylesheet(payload.path, payload.timestamp)
    return
  }

  if (payload.type === 'js-update') {
    await updateJavaScriptModule(payload.path, payload.acceptedPath ?? payload.path, payload.timestamp)
    console.info('[remix] HMR accepted update', payload.path)
  }
}

async function updateJavaScriptModule(path, acceptedPath, timestamp) {
  let previousContext = contexts.get(path)
  let isSelfUpdate = path === acceptedPath
  let dependencyCallbacks = previousContext
    ? getAcceptDependencyCallbacks(previousContext, acceptedPath)
    : []

  if (
    !previousContext ||
    (isSelfUpdate
      ? previousContext.acceptCallbacks.length === 0
      : dependencyCallbacks.length === 0)
  ) {
    console.info('[remix] HMR no accept handler, reloading page', path)
    reloadPage()
    return
  }

  if (isSelfUpdate) {
    for (let callback of previousContext.disposeCallbacks) {
      callback(previousContext.data)
    }

    let updatedModule = await import(withTimestamp(path, timestamp))
    let nextContext = contexts.get(path) ?? previousContext
    let callbacks =
      nextContext.acceptCallbacks.length > 0
        ? nextContext.acceptCallbacks
        : previousContext.acceptCallbacks

    for (let callback of callbacks) {
      callback(updatedModule)
    }
    return
  }

  let acceptedContext = contexts.get(acceptedPath)
  if (acceptedContext) {
    for (let callback of acceptedContext.disposeCallbacks) {
      callback(acceptedContext.data)
    }
  }

  let updatedModule = await import(withTimestamp(acceptedPath, timestamp))
  for (let { deps, callback } of dependencyCallbacks) {
    if (deps.length === 1) {
      callback(updatedModule)
    } else {
      callback(deps.map((dep) => (dep === acceptedPath ? updatedModule : undefined)))
    }
  }
}

function getAcceptDependencyCallbacks(context, acceptedPath) {
  return context.acceptDependencyCallbacks.filter(({ deps }) => deps.includes(acceptedPath))
}

function normalizeAcceptedDependency(importerPath, dep) {
  if (dep.startsWith('/')) return dep
  return new URL(dep, new URL(importerPath, window.location.href)).pathname
}

async function dispatchCustomEvent(event, data) {
  for (let context of contexts.values()) {
    let callbacks = context.customEventCallbacks.get(event) ?? []
    for (let callback of callbacks) {
      await callback(data)
    }
  }
}

function reloadStylesheet(path, timestamp) {
  let links = document.querySelectorAll('link[rel="stylesheet"]')
  for (let link of links) {
    let url = new URL(link.href)
    if (url.pathname !== path) continue

    let next = link.cloneNode()
    next.href = withTimestamp(path, timestamp)
    next.onload = () => link.remove()
    link.after(next)
  }
}

function withTimestamp(path, timestamp) {
  let url = new URL(path, location.href)
  url.searchParams.set('t', String(timestamp))
  return url.pathname + url.search
}

function reloadPage() {
  if (pageReloadTimer) clearTimeout(pageReloadTimer)
  pageReloadTimer = setTimeout(() => {
    location.reload()
  }, 20)
}
`.trimStart()
}

export function formatServerSentEvent(payload: HmrPayload): string {
  return `data: ${JSON.stringify(payload)}\n\n`
}
