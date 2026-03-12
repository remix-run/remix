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
  src?: string
  target?: string
  history?: 'push' | 'replace'
}

export async function navigate(href: string, options?: NavigationOptions) {
  let state = { target: options?.target, src: options?.src ?? href, $rmx: true }
  let transition = window.navigation.navigate(href, { state, history: options?.history })
  await transition.finished
}

export function startNavigationListener(signal: AbortSignal) {
  let navigation = window.navigation

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
        scroll: 'after-transition',
        focusReset: 'after-transition',
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
  if (event.navigationType === 'traverse') {
    return getTraverseNavigationState(event)
  }

  let sourceState = getSourceElementNavigationState(event)
  if (sourceState) return sourceState

  let destinationState = event.destination.getState()
  if (isRuntimeNavigation(destinationState)) return destinationState
}

function getTraverseNavigationState(event: NavigateEvent): NavigationState | undefined {
  let destinationState = event.destination.getState()
  if (isRuntimeNavigation(destinationState)) {
    return destinationState
  }

  // Safari returns `null` for destination.getState(), even though its in the
  // navigation.entries(), so we do its job for it and look it up.
  let navigation = window.navigation
  let matchingEntry = navigation.entries().find((entry) => entry.key === event.destination.key)
  if (matchingEntry) {
    let state = matchingEntry.getState()
    if (isRuntimeNavigation(state)) {
      return state
    }
  }

  return undefined
}

function getSourceElementNavigationState(event: NavigateEvent): NavigationState | undefined {
  let sourceEvent = event as SourceElementNavigateEvent
  let sourceElement = sourceEvent.sourceElement
  if (!(sourceElement instanceof Element)) return
  if (!sourceElement.matches('a, area')) return
  if (sourceElement.hasAttribute('rmx-document')) return

  return {
    target: sourceElement.getAttribute('rmx-target') ?? undefined,
    src: sourceElement.getAttribute('rmx-src') ?? event.destination.url,
    $rmx: true,
  } satisfies NavigationState
}
