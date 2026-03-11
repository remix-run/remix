import { getTopFrame, getNamedFrame } from './run.ts'

type NavigationState = {
  target: string | undefined
  src: string
  $rmx: true
}

type SourceElementNavigateEvent = NavigateEvent & {
  sourceElement?: Element | null
}

type NavigationOptions = {
  src?: string | null
  target?: string | null
  history?: 'push' | 'replace'
}

export async function navigate(href: string, options?: NavigationOptions) {
  let navigation = getNavigation()
  let state = {
    target: options?.target ?? undefined,
    src: options?.src ?? href,
    $rmx: true,
  } satisfies NavigationState
  let transition = navigation.navigate(href, {
    state,
    history: options?.history,
  })
  await transition.finished
}

export function startNavigationListener(signal: AbortSignal) {
  let navigation = getNavigation()

  navigation.updateCurrentEntry({
    state: { target: undefined, src: window.location.href, $rmx: true },
  })

  navigation.addEventListener(
    'navigate',
    (event) => {
      if (!event.canIntercept) return

      let state = getRuntimeNavigationState(event)
      if (!state) return

      let topFrame = getTopFrame()
      let namedFrame = state.target ? getNamedFrame(state.target) : undefined
      let frame = namedFrame ?? topFrame

      event.intercept({
        async handler() {
          if (event.navigationType !== 'traverse') {
            navigation.updateCurrentEntry({ state })
          }

          frame.src = frame === topFrame ? event.destination.url : state.src
          await frame.reload()
        },
      })
    },
    { signal },
  )
}

function isRuntimeNavigation(info: unknown): info is NavigationState {
  return typeof info === 'object' && info != null && '$rmx' in info
}

function getRuntimeNavigationState(event: NavigateEvent): NavigationState | undefined {
  let state = event.destination.getState()
  if (isRuntimeNavigation(state)) return state

  let sourceEvent = event as SourceElementNavigateEvent
  let sourceElement = sourceEvent.sourceElement
  if (!(sourceElement instanceof Element)) return
  if (!sourceElement.matches('a, area')) return
  if (sourceElement.hasAttribute('rmx-document')) return

  return {
    target: sourceElement.getAttribute('rmx-target') ?? undefined,
    src: sourceElement.getAttribute('rmx-src') ?? event.destination.url,
    $rmx: true,
  }
}

function getNavigation(): Navigation {
  let navigation = window.navigation
  if (!navigation) {
    throw new Error('Navigation API is not available')
  }
  return navigation
}
