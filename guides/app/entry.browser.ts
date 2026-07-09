import type { FrameContent } from 'remix/ui'
import { run } from 'remix/ui'

startNavigationGuard()

const app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl)
    return mod[exportName]
  },
  async resolveFrame(src, signal, target): Promise<FrameContent> {
    let headers = new Headers({
      Accept: 'text/html',
      'X-Remix-Frame': 'true',
    })

    if (target) {
      headers.set('X-Remix-Target', target)
    }

    let response = await fetch(new URL(src, window.location.href), {
      headers,
      signal,
    })

    if (!response.ok) {
      return `<pre>Navigation error: ${response.status} ${response.statusText}</pre>`
    }

    return response.body ?? response.text()
  },
})

app.ready().catch((error: unknown) => {
  console.error('Remix UI failed to start:', error)
})

// HACK: `remix/ui` currently intercepts reloads and same-document hash
// navigations because the current Navigation API entry has Remix runtime state.
// That prevents dev refresh from reloading the document and breaks native hash
// scrolling/history. Stop these navigations before the Remix listener sees them
// so the browser keeps owning their behavior. Remove this once `remix/ui` ignores
// reloads and same-document hash navigations itself.
function startNavigationGuard() {
  let navigation = (window as Window & { navigation?: EventTarget }).navigation
  if (!navigation) return

  navigation.addEventListener(
    'navigate',
    (event) => {
      let navigateEvent = event as Event & {
        destination?: { url?: string }
        navigationType?: string
      }
      if (navigateEvent.navigationType === 'reload') {
        event.stopImmediatePropagation()
        return
      }

      let href = navigateEvent.destination?.url
      if (href && isSameDocumentHashUrl(href)) {
        event.stopImmediatePropagation()
      }
    },
    { capture: true },
  )
}

function isSameDocumentHashUrl(href: string) {
  let current = new URL(window.location.href)
  let destination = new URL(href, current)

  if (current.origin !== destination.origin) return false
  if (current.pathname !== destination.pathname) return false
  if (current.search !== destination.search) return false

  return current.hash !== '' || destination.hash !== ''
}
