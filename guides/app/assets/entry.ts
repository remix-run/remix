import type { FrameContent } from 'remix/ui'
import { run } from 'remix/ui'

startHashNavigationGuard()

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

    let response = await fetch(new URL(src, window.location.href), { headers, signal })

    if (!response.ok) {
      return `<pre>Navigation error: ${response.status} ${response.statusText}</pre>`
    }

    return response.body ?? response.text()
  },
})

app.ready().catch((error: unknown) => {
  console.error('Remix UI failed to start:', error)
})

// TODO: get rid of this, it's a hack because I'm running into a bug and I'm tired boss
function startHashNavigationGuard() {
  let navigation = (window as Window & { navigation?: EventTarget }).navigation

  navigation?.addEventListener(
    'navigate',
    (event) => {
      let destinationUrl = (event as Event & { destination?: { url?: string } }).destination?.url
      if (destinationUrl && isSameDocumentUrl(destinationUrl)) {
        event.stopImmediatePropagation()
      }
    },
    { capture: true },
  )
}

function isSameDocumentUrl(href: string) {
  let current = new URL(window.location.href)
  let destination = new URL(href)

  current.hash = ''
  destination.hash = ''

  return current.href === destination.href
}
