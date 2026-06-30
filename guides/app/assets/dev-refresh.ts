import * as s from 'remix/data-schema'
import { clientEntry } from 'remix/ui'
import type { Handle } from 'remix/ui'

const refreshHref = '/__dev/refresh'
const refreshIntervalMs = 500

const refreshSchema = s.object({
  version: s.string(),
})

// Temporary guides-only refresh hook. Delete this when first-class HMR lands.
export const DevRefresh = clientEntry(import.meta.url, function DevRefresh(handle: Handle) {
  let currentVersion: string | undefined
  let missedServer = false
  let checking = false
  let reloading = false

  if (typeof window !== 'undefined') {
    let interval = window.setInterval(() => {
      void checkForRefresh()
    }, refreshIntervalMs)

    handle.signal.addEventListener('abort', () => window.clearInterval(interval))
    void checkForRefresh()
  }

  async function checkForRefresh() {
    if (checking || reloading || handle.signal.aborted) return

    checking = true

    try {
      let response = await fetch(refreshHref, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: handle.signal,
      })
      if (!response.ok) return

      let result = s.parseSafe(refreshSchema, await response.json())
      if (!result.success) return

      let nextVersion = result.value.version

      if (currentVersion === undefined) {
        if (missedServer && !(await reloadTopFrame())) return

        currentVersion = nextVersion
        return
      }

      if (nextVersion !== currentVersion && (await reloadTopFrame())) {
        currentVersion = nextVersion
      }
    } catch {
      if (!handle.signal.aborted) {
        missedServer = true
      }
    } finally {
      checking = false
    }
  }

  async function reloadTopFrame() {
    if (reloading || handle.signal.aborted) return false

    reloading = true

    try {
      await handle.frames.top.reload()
      missedServer = false
      return true
    } finally {
      reloading = false
    }
  }

  return () => null
})
