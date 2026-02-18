import { type Handle, clientEntry } from 'remix/component'
import { routes } from '../server/routes'

export const ClientRouter = clientEntry(
  `${routes.assets.href({ asset: 'client-router.js' })}#ClientRouter`,
  (handle: Handle) => {
    if (typeof window !== 'undefined') {
      window.navigation.addEventListener('navigate', (event) => {
        let currentMatch = routes.docs.match(window.location.href)
        let nextMatch = routes.docs.match(event.destination.url)
        // Only enhance navigations within a given version in case we've updated
        // deps or other aspects of the docs site in the interim
        if (nextMatch && currentMatch?.params.version === nextMatch.params.version) {
          event.intercept({
            async handler() {
              handle.frame.src = routes.fragment.href(nextMatch.params)
              handle.frame.reload()
            },
          })
        }
      })
    }
    return () => null
  },
)
