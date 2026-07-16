const eventsHref = '/__dev/events'
const storageKey = 'remix-guides:dev-refresh-version'

let currentVersion = readStoredVersion()
let reloading = false

if ('EventSource' in window) {
  let events = new EventSource(eventsHref)

  events.addEventListener('version', handleVersionEvent)
  events.addEventListener('change', handleVersionEvent)

  window.addEventListener(
    'beforeunload',
    () => {
      events.close()
    },
    { once: true },
  )
} else {
  console.warn('[dev-refresh] EventSource is not available; automatic refresh is disabled.')
}

function handleVersionEvent(event: Event): void {
  if (!isMessageEvent(event) || typeof event.data !== 'string') return

  let nextVersion = readVersion(event.data)
  if (!nextVersion) return

  if (currentVersion === undefined) {
    currentVersion = nextVersion
    storeVersion(nextVersion)
    return
  }

  if (nextVersion !== currentVersion) {
    currentVersion = nextVersion
    storeVersion(nextVersion)
    reloadPage()
  }
}

function readVersion(data: string): string | undefined {
  try {
    let value: unknown = JSON.parse(data)
    if (!value || typeof value !== 'object') return undefined
    if (!hasVersion(value)) return undefined

    return typeof value.version === 'string' && value.version !== '' ? value.version : undefined
  } catch {
    return undefined
  }
}

function readStoredVersion(): string | undefined {
  try {
    return window.sessionStorage.getItem(storageKey) ?? undefined
  } catch {
    return undefined
  }
}

function storeVersion(version: string): void {
  try {
    window.sessionStorage.setItem(storageKey, version)
  } catch {
    // Ignore private browsing/storage policy failures. The in-memory version still works.
  }
}

function reloadPage(): void {
  if (reloading) return

  reloading = true
  window.location.reload()
}

function isMessageEvent(event: Event): event is MessageEvent<unknown> {
  return 'data' in event
}

function hasVersion(value: object): value is { version: unknown } {
  return Object.hasOwn(value, 'version')
}

export {}
