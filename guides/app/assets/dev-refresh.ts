import * as s from 'remix/data-schema'

const refreshHref = '/__dev/refresh'
const refreshIntervalMs = 500

const refreshSchema = s.object({
  version: s.string(),
})

let refreshInterval: number | undefined

// Temporary guides-only refresh hook. Delete this when first-class HMR lands.
export function startDevRefresh() {
  if (refreshInterval !== undefined) return

  let currentVersion: string | undefined
  let missedServer = false

  async function checkForRefresh() {
    try {
      let response = await fetch(refreshHref, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) return

      let result = s.parseSafe(refreshSchema, await response.json())
      if (!result.success) return

      let nextVersion = result.value.version

      if (currentVersion === undefined) {
        if (missedServer) {
          window.location.reload()
          return
        }

        currentVersion = nextVersion
        return
      }

      if (nextVersion !== currentVersion) {
        window.location.reload()
      }
    } catch {
      missedServer = true
    }
  }

  refreshInterval = window.setInterval(() => {
    void checkForRefresh()
  }, refreshIntervalMs)

  void checkForRefresh()
}
