/**
 * Messages consumed by the browser HMR client.
 *
 * Server runtimes use `server:update` to request reconciliation with freshly rendered server
 * output. Asset tooling uses `browser:update` for updates accepted by JavaScript or CSS boundaries,
 * and falls back to `browser:reload` when the page must reload.
 */
export type HmrPayload =
  | {
      /** Indicates that server-rendered output may have changed. */
      type: 'server:update'
    }
  | {
      /** JavaScript and CSS modules that the browser should update. */
      updates: Array<
        | {
            /** Importing module whose dependency-accept handler accepts this update. */
            acceptedPath?: string
            /** Public URL of the changed JavaScript module. */
            path: string
            /** Identifies a JavaScript module update. */
            type: 'js'
          }
        | {
            /** Public URL of the changed stylesheet. */
            path: string
            /** Identifies a stylesheet update. */
            type: 'css'
          }
      >
      /** Update time used to bypass browser module and stylesheet caches. */
      timestamp: number
      /** Indicates that the listed browser modules should update in place. */
      type: 'browser:update'
    }
  | {
      /** Indicates that no HMR boundary accepted the change and the page must reload. */
      type: 'browser:reload'
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
    this.invalidated = false
    this.updating = false
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
    this.invalidated = true
    if (this.updating) {
      if (message) console.debug(message)
      return
    }
    if (message) console.debug(message)
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

events.onopen = () => {
  console.debug('[remix] HMR connected')
  if (reconnectPending) {
    reconnectPending = false
    console.log('[remix] HMR reconnected')
    handleReconnect().catch((error) => {
      console.error('[remix] HMR reconnect recovery failed', error)
      reloadPage()
    })
  }
  connected = true
}

events.onerror = () => {
  if (!connected) return
  connected = false
  reconnectPending = true
  console.log('[remix] HMR connection lost, retrying...')
}

events.onmessage = (event) => {
  let payload = JSON.parse(event.data)
  handlePayload(payload).catch((error) => {
    console.error('[remix] HMR update failed', error)
    if (payload.type !== 'browser:update' || payload.updates.some((update) => update.type !== 'js')) {
      reloadPage()
    }
  })
}

async function handlePayload(payload) {
  if (payload.type === 'browser:reload') {
    reloadPage()
    return
  }

  if (payload.type === 'server:update') {
    await retryFailedJavaScriptUpdates(payload)
    await dispatchCustomEvent(payload.type, payload)
    return
  }

  if (payload.type === 'browser:update') {
    for (let update of payload.updates) {
      if (update.type === 'css') {
        let updated = await queueStylesheetUpdate(update.path, payload.timestamp)
        if (updated) console.debug('[remix] HMR updated stylesheet', update.path)
        continue
      }

      try {
        let updated = await updateJavaScriptModule(
          update.path,
          update.acceptedPath ?? update.path,
          payload.timestamp,
        )
        failedJavaScriptUpdates.delete(update.path)
        if (updated) console.debug('[remix] HMR accepted update', update.path)
      } catch (error) {
        failedJavaScriptUpdates.set(update.path, update.acceptedPath ?? update.path)
        throw error
      }
    }
  }
}

async function handleReconnect() {
  let data = { timestamp: Date.now() }
  await reloadCurrentStylesheets(data)
  await retryFailedJavaScriptUpdates(data)
}

async function retryFailedJavaScriptUpdates(data) {
  if (failedJavaScriptUpdates.size === 0) return

  let timestamp = getTimestamp(data)
  for (let [path, acceptedPath] of Array.from(failedJavaScriptUpdates)) {
    try {
      let updated = await updateJavaScriptModule(path, acceptedPath, timestamp)
      failedJavaScriptUpdates.delete(path)
      if (updated) console.debug('[remix] HMR recovered update', path)
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
  if (!previousContext) return false

  let isSelfUpdate = path === acceptedPath
  let dependencyCallbacks = getAcceptDependencyCallbacks(previousContext, acceptedPath)

  if (
    isSelfUpdate ? previousContext.acceptCallbacks.length === 0 : dependencyCallbacks.length === 0
  ) {
    console.log('[remix] HMR no accept handler, reloading page', path)
    reloadPage()
    return false
  }

  if (isSelfUpdate) {
    for (let callback of previousContext.disposeCallbacks) {
      await callback(previousContext.data)
    }

    let updatedModule = await import(withTimestamp(path, timestamp))
    previousContext.invalidated = false
    previousContext.updating = true
    try {
      for (let callback of previousContext.acceptCallbacks) {
        await callback(updatedModule)
      }
    } finally {
      previousContext.updating = false
    }
    if (previousContext.invalidated) {
      await propagateInvalidatedJavaScriptModule(path, timestamp)
    }
    return true
  }

  let acceptedContext = contexts.get(acceptedPath)
  if (acceptedContext) {
    for (let callback of acceptedContext.disposeCallbacks) {
      await callback(acceptedContext.data)
    }
  }

  let updatedModule = await import(withTimestamp(acceptedPath, timestamp))
  previousContext.invalidated = false
  previousContext.updating = true
  try {
    for (let { deps, callback } of dependencyCallbacks) {
      if (deps.length === 1) {
        await callback(updatedModule)
      } else {
        await callback(deps.map((dep) => (dep === acceptedPath ? updatedModule : undefined)))
      }
    }
  } finally {
    previousContext.updating = false
  }
  if (previousContext.invalidated) {
    await propagateInvalidatedJavaScriptModule(path, timestamp)
  }
  return true
}

async function propagateInvalidatedJavaScriptModule(path, timestamp) {
  let updated = false
  for (let [importerPath, importerContext] of contexts) {
    if (importerPath === path) continue
    let callbacks = getAcceptDependencyCallbacks(importerContext, path)
    if (callbacks.length === 0) continue

    for (let callback of importerContext.disposeCallbacks) {
      await callback(importerContext.data)
    }

    let updatedModule = await import(withTimestamp(path, timestamp))
    importerContext.invalidated = false
    importerContext.updating = true
    try {
      for (let { deps, callback } of callbacks) {
        if (deps.length === 1) {
          await callback(updatedModule)
        } else {
          await callback(deps.map((dep) => (dep === path ? updatedModule : undefined)))
        }
      }
    } finally {
      importerContext.updating = false
    }
    updated = true

    if (importerContext.invalidated) {
      reloadPage()
      return
    }
  }

  if (!updated) reloadPage()
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

  if (updates.length === 0) return false
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
    console.debug('[remix] HMR reloading page')
    window.location.href = window.location.href
  }, 20)
}
`.trimStart()
}
