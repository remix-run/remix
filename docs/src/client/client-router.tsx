import { type Handle, clientEntry } from 'remix/component'
import { routes } from '../server/routes'

declare global {
  const navigation: Navigation

  interface Navigation {
    __eventMap?: NavigationEventMap
  }

  interface NavigationInterceptOptions {
    precommitHandler?: () => Promise<void>
  }

  interface NavigateEvent {
    readonly cancelable: boolean
  }
}

const $ = (s: string) => document.querySelector(s)
const $$ = (s: string) => Array.from(document.querySelectorAll(s))

export const ClientRouter = clientEntry(
  `${routes.assets.href({ asset: 'client-router.js' })}#ClientRouter`,
  (handle: Handle) => {
    handle.queueTask(() => {
      handle.on(window.navigation, {
        navigate(event, signal) {
          let shouldNotIntercept =
            !event.canIntercept ||
            // If this is just a hashChange,
            // just let the browser handle scrolling to the content.
            event.hashChange ||
            // If this is a download,
            // let the browser perform the download.
            event.downloadRequest ||
            // If this is a form submission,
            // let that go to the server.
            event.formData

          if (shouldNotIntercept) {
            return
          }

          // Only intercept navigations to docs page - navigations back to the home
          // page should restart and collapse the sidebar
          let nextMatch = routes.docs.match(event.destination.url)
          if (!nextMatch) {
            return
          }

          // Don't intercept navigations across versions, since each version is built
          // with a different set of assets
          let currentMatch = routes.docs.match(window.location.href)
          if (currentMatch?.params.version !== nextMatch.params.version) {
            return
          }

          event.intercept({
            focusReset: 'manual',
            async handler() {
              if (signal.aborted) return
              handle.frame.src = routes.fragment.href(nextMatch.params)
              await handle.frame.reload()

              // Update active sidebar link
              $$('nav a.active').forEach((e) => e.classList.remove('active'))
              $(`nav a[href="${routes.docs.href(nextMatch.params)}"]`)?.classList.add('active')

              // Close mobile nav
              let toggle = $('#nav-toggle') as HTMLInputElement | null
              if (toggle) {
                toggle.checked = false
              }
            },
          })
        },
      })
    })

    // Return an empty fragment here, returning `null` was causing frame reload
    // issues in conjunction with <ClientRouter> being rendered _after_ the markdown
    // content - and then only for some URLs such as api/remix/data-schema/type/Schema
    return () => <></>
  },
)
