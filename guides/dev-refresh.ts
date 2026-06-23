import { watch, type FSWatcher } from 'node:fs'
import type * as http from 'node:http'

const eventsPath = '/__dev/events'
const defaultDebounceMs = 75
const heartbeatIntervalMs = 15000

export type DevRefreshEvents = {
  handle(request: http.IncomingMessage, response: http.ServerResponse): boolean
  close(): void
}

type DevRefreshEventsOptions = {
  debounceMs?: number
  roots?: URL[]
}

// Temporary guides-only refresh hook. Delete this when first-class HMR lands.
export function createDevRefreshEvents(options: DevRefreshEventsOptions = {}): DevRefreshEvents {
  let roots = options.roots ?? [
    new URL('./app/', import.meta.url),
    new URL('./public/', import.meta.url),
  ]
  let debounceMs = options.debounceMs ?? defaultDebounceMs
  let version = createVersion()
  let clients = new Set<http.ServerResponse>()
  let heartbeats = new Map<http.ServerResponse, ReturnType<typeof setInterval>>()
  let watchers = roots.flatMap((root) => createWatcher(root, scheduleChange))
  let changeTimer: ReturnType<typeof setTimeout> | undefined

  function handle(request: http.IncomingMessage, response: http.ServerResponse): boolean {
    let url = getRequestUrl(request)
    if (url.pathname !== eventsPath) {
      return false
    }

    if (request.method !== 'GET') {
      response.writeHead(405, {
        Allow: 'GET',
        'Content-Type': 'text/plain; charset=utf-8',
      })
      response.end('Method Not Allowed')
      return true
    }

    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    response.flushHeaders()
    response.write('retry: 500\n\n')

    clients.add(response)
    writeEvent(response, 'version', { version })

    let heartbeat = setInterval(() => {
      if (!response.destroyed) {
        response.write(': heartbeat\n\n')
      }
    }, heartbeatIntervalMs)
    heartbeats.set(response, heartbeat)

    request.on('close', () => {
      clients.delete(response)
      let heartbeat = heartbeats.get(response)
      if (heartbeat) {
        clearInterval(heartbeat)
        heartbeats.delete(response)
      }
    })

    return true
  }

  function scheduleChange(): void {
    if (changeTimer) {
      clearTimeout(changeTimer)
    }

    changeTimer = setTimeout(() => {
      changeTimer = undefined
      version = createVersion()
      broadcast('change', { version })
    }, debounceMs)
  }

  function broadcast(event: string, data: unknown): void {
    for (let client of clients) {
      if (client.destroyed) {
        clients.delete(client)
        continue
      }

      writeEvent(client, event, data)
    }
  }

  function close(): void {
    if (changeTimer) {
      clearTimeout(changeTimer)
      changeTimer = undefined
    }

    for (let watcher of watchers) {
      watcher.close()
    }
    watchers = []

    for (let heartbeat of heartbeats.values()) {
      clearInterval(heartbeat)
    }
    heartbeats.clear()

    for (let client of clients) {
      client.end()
    }
    clients.clear()
  }

  return { handle, close }
}

function createWatcher(root: URL, onChange: () => void): FSWatcher[] {
  try {
    let watcher = watch(root, { recursive: true }, (_event, fileName) => {
      if (!shouldRefresh(fileName)) return
      onChange()
    })

    watcher.on('error', (error) => {
      console.error(`[dev-refresh] File watcher failed for ${root.href}:`, error)
    })

    return [watcher]
  } catch (error) {
    console.error(`[dev-refresh] Could not watch ${root.href}:`, error)
    return []
  }
}

function shouldRefresh(fileName: string | Buffer | null): boolean {
  if (!fileName) return true

  let normalized = fileName.toString().replace(/\\/g, '/')
  if (normalized.startsWith('.') || normalized.includes('/.')) return false
  if (normalized.endsWith('~')) return false
  if (normalized.endsWith('.tmp')) return false
  if (normalized.endsWith('.swp')) return false
  if (normalized.endsWith('.map')) return false

  return true
}

function getRequestUrl(request: http.IncomingMessage): URL {
  return new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
}

function writeEvent(response: http.ServerResponse, event: string, data: unknown): void {
  response.write(`event: ${event}\n`)
  response.write(`data: ${JSON.stringify(data)}\n\n`)
}

function createVersion(): string {
  return `${Date.now().toString(36)}:${process.hrtime.bigint().toString(36)}`
}
