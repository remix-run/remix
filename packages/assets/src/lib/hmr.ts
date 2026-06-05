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
let failedJavaScriptUpdates = new Map()
let stylesheetUpdatePromise = Promise.resolve()

let events = new EventSource(${JSON.stringify(options.eventPathname)})

events.onerror = () => {
  if (connected) reconnectPending = true
  console.warn('[remix] HMR connection lost, retrying...')
}

events.onmessage = (event) => {
  let payload = JSON.parse(event.data)
  handlePayload(payload).catch((error) => {
    console.error('[remix] HMR update failed', error)
    if (payload.type !== 'js-update') {
      reloadPage()
    }
  })
}

async function handlePayload(payload) {
  if (payload.type === 'connected') {
    console.info('[remix] HMR connected')
    if (reconnectPending) {
      reconnectPending = false
      let data = {
        reason: 'reconnect',
        timestamp: Date.now(),
      }
      await reloadCurrentStylesheets(data)
      await retryFailedJavaScriptUpdates(data)
      await dispatchCustomEvent('remix:server-update', data)
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
    if (payload.event === 'remix:server-update') {
      await retryFailedJavaScriptUpdates(payload.data)
    }
    await dispatchCustomEvent(payload.event, payload.data)
    return
  }

  if (payload.type === 'css-update') {
    console.info('[remix] HMR updating stylesheet', payload.path)
    await queueStylesheetUpdate(payload.path, payload.timestamp)
    return
  }

  if (payload.type === 'js-update') {
    try {
      await updateJavaScriptModule(payload.path, payload.acceptedPath ?? payload.path, payload.timestamp)
      failedJavaScriptUpdates.delete(payload.path)
    } catch (error) {
      failedJavaScriptUpdates.set(payload.path, payload.acceptedPath ?? payload.path)
      throw error
    }
    console.info('[remix] HMR accepted update', payload.path)
  }
}

async function retryFailedJavaScriptUpdates(data) {
  if (failedJavaScriptUpdates.size === 0) return

  let timestamp = getTimestamp(data)
  for (let [path, acceptedPath] of Array.from(failedJavaScriptUpdates)) {
    try {
      await updateJavaScriptModule(path, acceptedPath, timestamp)
      failedJavaScriptUpdates.delete(path)
      console.info('[remix] HMR recovered update', path)
    } catch (error) {
      console.error('[remix] HMR recovery update failed', error)
    }
  }
}

async function reloadCurrentStylesheets(data) {
  let timestamp = getTimestamp(data)
  let paths = new Set()
  for (let link of document.querySelectorAll('link[rel="stylesheet"]')) {
    if (link.dataset.remixHmrStylesheet === 'true') continue
    let url = new URL(link.href)
    if (url.origin !== location.origin) continue
    paths.add(url.pathname)
  }

  for (let path of paths) {
    await queueStylesheetUpdate(path, timestamp)
  }
}

function getTimestamp(data) {
  if (data && typeof data === 'object' && typeof data.timestamp === 'number') {
    return data.timestamp
  }

  return Date.now()
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

async function reloadStylesheet(path, timestamp) {
  let links = document.querySelectorAll('link[rel="stylesheet"]')
  let updates = []
  for (let link of links) {
    let url = new URL(link.href)
    if (url.pathname !== path) continue
    if (link.dataset.remixHmrStylesheet === 'true') continue

    updates.push(loadStylesheet(link, path, timestamp))
  }

  if (updates.length === 0) return true
  return (await Promise.all(updates)).some(Boolean)
}

async function queueStylesheetUpdate(path, timestamp) {
  let update = stylesheetUpdatePromise.then(() => reloadStylesheet(path, timestamp))
  stylesheetUpdatePromise = update.catch(() => {})
  return update
}

function loadStylesheet(link, path, timestamp) {
  return new Promise((resolve) => {
    let next = link.cloneNode()
    next.dataset.remixHmrStylesheet = 'true'
    next.href = withTimestamp(path, timestamp)
    next.onload = () => {
      delete next.dataset.remixHmrStylesheet
      link.remove()
      resolve(true)
    }
    next.onerror = () => {
      next.remove()
      resolve(false)
    }
    link.after(next)
  })
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
