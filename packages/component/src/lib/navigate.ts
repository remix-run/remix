import { getTopFrame, getNamedFrame } from './run.ts'

type NavigationState = {
  target: string | undefined
  src: string
  $rmx: true
}

function isRuntimeNavigation(info: unknown): info is NavigationState {
  return typeof info === 'object' && info != null && '$rmx' in info
}

export async function navigate(href: string, src?: string | null, target?: string | null) {
  let navigation = window.navigation.navigate(href, {
    state: { target, src, $rmx: true },
  })
  await navigation.finished
}

declare global {
  interface NavigateEvent {
    sourceElement: HTMLAnchorElement | HTMLFormElement | null
  }
}

export function startNavigationListener(signal: AbortSignal) {
  window.navigation.updateCurrentEntry({
    state: { target: undefined, src: window.location.href, $rmx: true },
  })

  document.addEventListener(
    'click',
    (event) => {
      if (!(event.target instanceof HTMLElement)) return

      let anchor = event.target.closest('a')
      if (!anchor) return

      let href = anchor.href
      if (!href) return

      let target = anchor.getAttribute('rmx-target')
      let src = anchor.getAttribute('rmx-src')

      event.preventDefault()
      navigate(anchor.href, src, target)
    },
    { signal: signal },
  )

  window.navigation.addEventListener(
    'navigate',
    (event) => {
      if (!event.canIntercept) return

      let info = event.destination.getState()
      if (!isRuntimeNavigation(info)) return

      let topFrame = getTopFrame()
      let namedFrame = info.target ? getNamedFrame(info.target) : undefined
      let frame = namedFrame ?? topFrame
      frame.src = frame === topFrame ? event.destination.url : info.src

      event.intercept({
        async handler() {
          await frame.reload()
        },
      })
    },
    { signal },
  )
}
