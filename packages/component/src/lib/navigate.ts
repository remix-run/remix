import { getTopFrame, getNamedFrame } from './run.ts'

type NavigationState = {
  target: string | undefined
  src: string
  $rmx: true
}

type NavigationLike = EventTarget & {
  navigate(
    href: string,
    options: { state: NavigationState },
  ): {
    finished: Promise<unknown>
  }
  updateCurrentEntry(options: { state: NavigationState }): void
  addEventListener(
    type: 'navigate',
    listener: (event: NavigateEventLike) => void,
    options?: AddEventListenerOptions,
  ): void
}

type NavigateEventLike = Event & {
  canIntercept: boolean
  destination: {
    url: string
    getState(): unknown
  }
  intercept(options: { handler(): Promise<void> | void }): void
  sourceElement: HTMLAnchorElement | HTMLFormElement | null
}

function isRuntimeNavigation(info: unknown): info is NavigationState {
  return typeof info === 'object' && info != null && '$rmx' in info
}

export async function navigate(href: string, src?: string | null, target?: string | null) {
  let navigation = getNavigation()
  if (!navigation) {
    window.location.assign(href)
    return
  }

  let transition = navigation.navigate(href, {
    state: { target: target ?? undefined, src: src ?? href, $rmx: true },
  })
  await transition.finished
}

export function startNavigationListener(signal: AbortSignal) {
  let navigation = getNavigation()
  if (!navigation) return

  navigation.updateCurrentEntry({
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

  navigation.addEventListener(
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

function getNavigation(): NavigationLike | undefined {
  return (window as Window & { navigation?: NavigationLike }).navigation
}
