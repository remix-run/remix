import { getTopFrame, getNamedFrame } from './run.ts'
import { reloadFrameForNavigation } from './frame.ts'
import { createFormNavigationResolver, type FormSubmission } from './form-navigation.ts'
import {
  getLinkNavigationElement,
  getReplaceHistory,
  interceptNavigation,
  type NavigationReplacement,
} from './navigation-event.ts'

type NavigationState = {
  target: string | undefined
  src: string
  resetScroll: boolean
  $rmx: true
}

type RuntimeNavigation = {
  state: NavigationState
  getSubmission?: () => Promise<FormSubmission>
  replaceHistory?: boolean
}

interface FormSubmissionNavigationInfo {
  type: typeof formSubmissionNavigationInfoType
  state: NavigationState
  getSubmission(): Promise<FormSubmission>
}

interface FrameRedirectNavigationInfo {
  type: typeof frameRedirectNavigationInfoType
}

const formSubmissionNavigationInfoType = 'frame-form-submission'
const frameRedirectNavigationInfoType = 'frame-redirect'

/**
 * Options for client-side frame-aware navigation.
 */
export type NavigationOptions = {
  src?: string
  target?: string
  history?: 'push' | 'replace'
  resetScroll?: boolean
}

/**
 * Performs a Navigation API transition understood by Remix frame runtime state.
 *
 * @param href Destination URL.
 * @param options Navigation options.
 */
export async function navigate(href: string, options?: NavigationOptions) {
  let state = {
    target: options?.target,
    src: options?.src ?? href,
    resetScroll: options?.resetScroll !== false,
    $rmx: true,
  } satisfies NavigationState
  let transition = window.navigation.navigate(href, { state, history: options?.history })
  await transition.finished
}

/**
 * Starts listening for Navigation API transitions and routes them through frame reloads.
 *
 * @param signal Abort signal used to remove the listener.
 * @param canResolveFrames Whether the runtime has a resolver that can handle intercepted navigations.
 * @returns void
 */
export function startNavigationListener(signal: AbortSignal, canResolveFrames = true) {
  if (!canResolveFrames) return
  return startNavigationListenerImpl(signal, {
    getTopFrame,
    getNamedFrame,
    reloadFrame: reloadFrameForNavigation,
  })
}

// Internal version used by unit tests so we can inject stub frames
export function startNavigationListenerImpl(
  signal: AbortSignal,
  options: {
    getTopFrame: typeof getTopFrame
    getNamedFrame: typeof getNamedFrame
    reloadFrame: typeof reloadFrameForNavigation
  },
) {
  let navigation = window.navigation
  let resolveFormNavigation = createFormNavigationResolver(signal)

  navigation.updateCurrentEntry({
    state: { target: undefined, src: window.location.href, resetScroll: true, $rmx: true },
  })

  navigation.addEventListener(
    'navigate',
    (event) => {
      // Safari seems to incorrectly set canIntercept to true for sub-domain navigations, so
      // we do a host check ourselves/. The spec is clear that a different host should prevent
      // interception so this is likely a bug in Safari:
      // https://html.spec.whatwg.org/multipage/nav-history-apis.html#can-have-its-url-rewritten
      if (!event.canIntercept || isCrossOriginDestination(event)) return

      if (isFrameRedirectNavigationInfo(event.info)) {
        event.intercept({ async handler() {} })
        return
      }

      let replayedSubmission = isFormSubmissionNavigationInfo(event.info) ? event.info : undefined
      let runtimeNavigation = replayedSubmission
        ? {
            state: replayedSubmission.state,
            getSubmission: replayedSubmission.getSubmission,
          }
        : getRuntimeNavigation(event, resolveFormNavigation)
      if (!runtimeNavigation) return
      let { state } = runtimeNavigation

      let topFrame = options.getTopFrame()
      let namedFrame = state.target ? options.getNamedFrame(state.target) : undefined
      let frame = namedFrame ?? topFrame

      let handler = async () => {
        let submission = await runtimeNavigation.getSubmission?.()
        if (event.signal.aborted) return

        if (event.navigationType !== 'traverse') {
          navigation.updateCurrentEntry({ state })
        }

        topFrame.src = event.destination.url
        if (frame !== topFrame) frame.src = state.src
        let { redirectedTo } = await options.reloadFrame(frame, {
          ...submission,
          signal: event.signal,
        })

        if (redirectedTo && frame === topFrame) {
          frame.src = redirectedTo
          // Start the successor navigation without awaiting it: this handler must settle before
          // the replacement navigation can finish.
          navigation.navigate(redirectedTo, {
            history: 'replace',
            state: { ...state, src: redirectedTo },
            info: {
              type: frameRedirectNavigationInfoType,
            } satisfies FrameRedirectNavigationInfo,
          })
        }

        let isNewEntry = event.navigationType === 'push' || event.navigationType === 'replace'
        if (state.resetScroll && isNewEntry) {
          window.scrollTo(0, 0)
        }
      }

      let replacement: NavigationReplacement | undefined
      if (runtimeNavigation.replaceHistory && replayedSubmission == null) {
        replacement = runtimeNavigation.getSubmission
          ? {
              type: 'form-submission',
              state,
              info: {
                type: formSubmissionNavigationInfoType,
                state,
                getSubmission: runtimeNavigation.getSubmission,
              } satisfies FormSubmissionNavigationInfo,
            }
          : { type: 'navigation', state }
      }

      interceptNavigation(event, { handler, replacement })
    },
    { signal },
  )
}

function isRuntimeNavigation(info: unknown): info is NavigationState {
  return typeof info === 'object' && info != null && '$rmx' in info
}

function isFormSubmissionNavigationInfo(value: unknown): value is FormSubmissionNavigationInfo {
  return (
    typeof value === 'object' &&
    value != null &&
    'type' in value &&
    value.type === formSubmissionNavigationInfoType &&
    'state' in value &&
    isRuntimeNavigation(value.state) &&
    'getSubmission' in value &&
    typeof value.getSubmission === 'function'
  )
}

function isFrameRedirectNavigationInfo(value: unknown): value is FrameRedirectNavigationInfo {
  return (
    typeof value === 'object' &&
    value != null &&
    'type' in value &&
    value.type === frameRedirectNavigationInfoType
  )
}

function isCrossOriginDestination(event: NavigateEvent): boolean {
  let destination = new URL(event.destination.url)
  return destination.origin !== window.location.origin
}

function getRuntimeNavigation(
  event: NavigateEvent,
  resolveFormNavigation: ReturnType<typeof createFormNavigationResolver>,
): RuntimeNavigation | undefined {
  if (event.navigationType === 'traverse') {
    let state = getTraverseNavigationState(event)
    return state ? { state } : undefined
  }

  let sourceNavigation = getSourceElementNavigation(event, resolveFormNavigation)
  if (sourceNavigation) return sourceNavigation

  let destinationState = event.destination.getState()
  if (isRuntimeNavigation(destinationState)) return { state: destinationState }
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

function getSourceElementNavigation(
  event: NavigateEvent,
  resolveFormNavigation: ReturnType<typeof createFormNavigationResolver>,
): RuntimeNavigation | undefined {
  let linkElement = getLinkNavigationElement(event)
  if (linkElement) {
    if (linkElement.hasAttribute('rmx-document')) return
    if (linkElement.hasAttribute('download')) return

    return {
      state: {
        target: linkElement.getAttribute('rmx-target') ?? undefined,
        src: linkElement.getAttribute('rmx-src') ?? event.destination.url,
        resetScroll: linkElement.getAttribute('rmx-reset-scroll') !== 'false',
        $rmx: true,
      },
      replaceHistory: getReplaceHistory(linkElement.getAttribute('rmx-history'), false),
    }
  }

  let formNavigation = resolveFormNavigation(event)
  if (!formNavigation || formNavigation.hasAttribute('rmx-document')) return

  let replaceHistoryByDefault =
    formNavigation.getSubmission !== undefined &&
    event.destination.url === window.navigation.currentEntry?.url

  return {
    state: {
      target: formNavigation.getAttribute('rmx-target') ?? undefined,
      src: formNavigation.getAttribute('rmx-src') ?? event.destination.url,
      resetScroll: formNavigation.getAttribute('rmx-reset-scroll') !== 'false',
      $rmx: true,
    },
    replaceHistory: getReplaceHistory(
      formNavigation.getAttribute('rmx-history'),
      replaceHistoryByDefault,
    ),
    getSubmission: formNavigation.getSubmission,
  }
}
