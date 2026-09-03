import { getTopFrame, getNamedFrame } from './run.ts'
import { reloadFrameForNavigation } from './frame.ts'
import { createFormNavigationResolver, type FormSubmission } from './form-navigation.ts'

type NavigationState = {
  target: string | undefined
  src: string
  resetScroll: boolean
  $rmx: true
}

type SourceElementNavigateEvent = NavigateEvent & {
  sourceElement?: Element | null
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
  resetScroll: boolean
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
  let navigation = window.navigation
  if (!navigation) {
    if (options?.history === 'replace') {
      window.location.replace(href)
    } else {
      window.location.assign(href)
    }
    return
  }

  let transition = navigation.navigate(href, { state, history: options?.history })
  await transition.finished
}

/**
 * Starts listening for Navigation API transitions and routes them through frame reloads.
 *
 * @param signal Abort signal used to remove the listener.
 * @returns void
 */
export function startNavigationListener(signal: AbortSignal) {
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
  if (!navigation) return
  let resolveFormNavigation = createFormNavigationResolver(signal)
  let releaseScrollRestoration: (() => void) | undefined
  let releasePendingScrollRestoration = () => {
    let release = releaseScrollRestoration
    releaseScrollRestoration = undefined
    release?.()
  }
  signal.addEventListener('abort', releasePendingScrollRestoration, { once: true })

  // Every interception uses the same scroll option and browser workarounds.
  function interceptNavigation(
    event: NavigateEvent,
    resetScroll: boolean,
    options: Pick<NavigationInterceptOptions, 'precommitHandler'> & {
      handler: NonNullable<NavigationInterceptOptions['handler']>
    },
  ): void {
    event.intercept({
      ...options,
      scroll: resetScroll ? undefined : 'manual',
      handler() {
        if (event.signal.aborted) return
        releaseScrollRestoration = holdScrollRestorationUntilLoaded(event)

        // The Navigation API assigns `navigation.transition` before it runs handlers.
        let transition = navigation.transition
        if (resetScroll && transition) {
          preserveTraversalScrollRange(event, transition)
          resyncWebKitScrollAfterNavigation(event, transition)
        }
        return options.handler()
      },
    })
  }

  navigation.updateCurrentEntry({
    state: { target: undefined, src: window.location.href, resetScroll: true, $rmx: true },
  })

  navigation.addEventListener(
    'navigate',
    (event) => {
      // Hand scroll restoration back to the entry we are leaving before the next one commits.
      releasePendingScrollRestoration()

      // Safari seems to incorrectly set canIntercept to true for sub-domain navigations, so
      // we do a host check ourselves. The spec is clear that a different host should prevent
      // interception so this is likely a bug in Safari:
      // https://html.spec.whatwg.org/multipage/nav-history-apis.html#can-have-its-url-rewritten
      if (!event.canIntercept || isCrossOriginDestination(event)) return

      if (isFrameRedirectNavigationInfo(event.info)) {
        let { resetScroll } = event.info
        interceptNavigation(event, resetScroll, {
          async handler() {
            if (resetScroll) scrollToDestination(event)
          },
        })
        return
      }

      let replayedSubmission = isFormSubmissionNavigationInfo(event.info) ? event.info : undefined
      let runtimeNavigation = replayedSubmission
        ? {
            state: replayedSubmission.state,
            getSubmission: replayedSubmission.getSubmission,
          }
        : getRuntimeNavigation(navigation, event, resolveFormNavigation)
      if (!runtimeNavigation) return
      let { state } = runtimeNavigation

      let topFrame = options.getTopFrame()
      let namedFrame = state.target ? options.getNamedFrame(state.target) : undefined
      let frame = namedFrame ?? topFrame

      let handler = async () => {
        if (event.signal.aborted) return

        let submission = await runtimeNavigation.getSubmission?.()
        if (event.signal.aborted) return

        if (event.navigationType !== 'traverse') {
          navigation.updateCurrentEntry({ state })
        }

        topFrame.src = event.destination.url
        if (frame !== topFrame) frame.src = state.src
        let reload = options.reloadFrame(frame, {
          ...submission,
          signal: event.signal,
        })
        await reload.committed
        if (event.signal.aborted) return
        if (state.resetScroll) scrollToDestination(event)

        let { redirectedTo } = await reload.finished

        if (redirectedTo && frame === topFrame) {
          frame.src = redirectedTo
          // Start the successor navigation without awaiting it: this handler must settle before
          // the replacement navigation can finish.
          navigation.navigate(redirectedTo, {
            history: 'replace',
            state: { ...state, src: redirectedTo },
            info: {
              type: frameRedirectNavigationInfoType,
              resetScroll: state.resetScroll,
            } satisfies FrameRedirectNavigationInfo,
          })
        }
      }

      if (runtimeNavigation.getSubmission) {
        // <form method="post"> navigations
        if (runtimeNavigation.replaceHistory && replayedSubmission == null) {
          let supportsPrecommit =
            typeof Reflect.get(window, 'NavigationPrecommitController') === 'function'

          // Modern browsers allow you to update the in-flight navigation entry before it's committed
          if (supportsPrecommit) {
            interceptNavigation(event, state.resetScroll, {
              handler,
              precommitHandler(controller) {
                controller.redirect(event.destination.url, { history: 'replace' })
              },
            })
            return
          }

          // Safari doesn't support precommit as of Aug 2026, so we do a full replacement navigation
          if (event.cancelable) {
            event.preventDefault()
            navigation.navigate(event.destination.url, {
              history: 'replace',
              state,
              info: {
                type: formSubmissionNavigationInfoType,
                state,
                getSubmission: runtimeNavigation.getSubmission,
              } satisfies FormSubmissionNavigationInfo,
            })
            return
          }
        }

        interceptNavigation(event, state.resetScroll, { handler })
      } else {
        // <a>/<form method="get"> navigations
        if (runtimeNavigation.replaceHistory && event.cancelable) {
          event.preventDefault()
          navigation.navigate(event.destination.url, { history: 'replace', state })
        } else {
          interceptNavigation(event, state.resetScroll, { handler })
        }
      }
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
    value.type === frameRedirectNavigationInfoType &&
    'resetScroll' in value &&
    typeof value.resetScroll === 'boolean'
  )
}

function isCrossOriginDestination(event: NavigateEvent): boolean {
  let destination = new URL(event.destination.url)
  return destination.origin !== window.location.origin
}

// Chromium keeps retrying scroll restoration for a reloaded or history-loaded document until it
// finishes loading, with a final retry right after the `load` event, and same-document navigations
// inherit that pending restoration. A push or replace that commits before `load` is therefore
// scrolled to the previous page's saved offset once loading completes. Opt the committed entry out
// of restoration until that final retry has run, then hand restoration back for later traversals.
// See `FrameLoader::DidFinishNavigation` and `DocumentLoader::SetHistoryItemStateForCommit`.
function holdScrollRestorationUntilLoaded(event: NavigateEvent): (() => void) | undefined {
  if (event.navigationType !== 'push' && event.navigationType !== 'replace') return
  if (document.readyState === 'complete' || history.scrollRestoration !== 'auto') return

  history.scrollRestoration = 'manual'
  let active = true
  function release() {
    if (!active) return
    active = false
    window.removeEventListener('load', onLoad)
    history.scrollRestoration = 'auto'
  }
  function onLoad() {
    requestAnimationFrame(release)
  }
  window.addEventListener('load', onLoad, { once: true })
  return release
}

// Scrolls to the destination the way the browser would after the transition, but as soon as the
// destination DOM is committed rather than after every client entry and frame has settled.
function scrollToDestination(event: NavigateEvent): void {
  event.scroll()

  // Chromium < 149 ignores the spec'd scroll-to-top for push and replace destinations without a
  // fragment, both here and in its after-transition default: https://crbug.com/479874917
  if (event.navigationType !== 'push' && event.navigationType !== 'replace') return
  if (new URL(event.destination.url).hash) return
  if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0)
}

function preserveTraversalScrollRange(
  event: NavigateEvent,
  transition: NavigationTransition,
): void {
  if (event.navigationType !== 'traverse') return

  // Full-document reconciliation can temporarily shrink the page or trigger scroll anchoring
  // before the Navigation API performs its deferred restoration. Preserve the starting scroll
  // range and position until the navigation finishes so native restoration remains authoritative.
  // Root scroll height includes page-level effects such as body padding.

  // We think this is a bug in Chromium where they are incorrectly classifying a
  // DOM-modification-driven scroll change as a user scroll action, causing it to skip restoration
  // after the transition. The intended user-scroll behavior is tested here:
  // https://github.com/web-platform-tests/wpt/blob/master/navigation-api/scroll-behavior/after-transition-skips-restore-when-scrolled.html

  let { scrollHeight } = document.documentElement
  let stylesheet = new CSSStyleSheet()
  stylesheet.replaceSync(`
    html {
      min-height: ${scrollHeight}px !important;
      overflow-anchor: none !important;
    }

    body {
      overflow-anchor: none !important;
    }
  `)
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet]

  // `finished` settles on success, error, and abort.
  let remove = () => {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (current) => current !== stylesheet,
    )
  }
  void transition.finished.then(remove, remove)
}

function resyncWebKitScrollAfterNavigation(
  event: NavigateEvent,
  transition: NavigationTransition,
): void {
  let userAgent = navigator.userAgent
  if (!userAgent.includes('AppleWebKit')) return
  if (userAgent.includes('Chrome') || userAgent.includes('Chromium')) return
  if (event.navigationType !== 'push' && event.navigationType !== 'replace') return
  if (new URL(event.destination.url).hash) return

  void transition.finished.then(
    () => {
      // WebKit can reset its internal scroll position without synchronizing the visual viewport.
      // https://bugs.webkit.org/show_bug.cgi?id=309542
      if (window.scrollX !== 0 || window.scrollY !== 0) return
      window.scrollTo({ behavior: 'instant', left: 0, top: 1 })
      requestAnimationFrame(() => {
        if (window.scrollX !== 0 || window.scrollY !== 1) return
        window.scrollTo({ behavior: 'instant', left: 0, top: 0 })
      })
    },
    () => {},
  )
}

function getRuntimeNavigation(
  navigation: Navigation,
  event: NavigateEvent,
  resolveFormNavigation: ReturnType<typeof createFormNavigationResolver>,
): RuntimeNavigation | undefined {
  if (event.navigationType === 'traverse') {
    let state = getTraverseNavigationState(navigation, event)
    return state ? { state } : undefined
  }

  let sourceNavigation = getSourceElementNavigation(navigation, event, resolveFormNavigation)
  if (sourceNavigation) return sourceNavigation

  let destinationState = event.destination.getState()
  if (isRuntimeNavigation(destinationState)) return { state: destinationState }
}

function getTraverseNavigationState(
  navigation: Navigation,
  event: NavigateEvent,
): NavigationState | undefined {
  let destinationState = event.destination.getState()
  if (isRuntimeNavigation(destinationState)) {
    return destinationState
  }

  // Safari returns `null` for destination.getState(), even though its in the
  // navigation.entries(), so we do its job for it and look it up.
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
  navigation: Navigation,
  event: NavigateEvent,
  resolveFormNavigation: ReturnType<typeof createFormNavigationResolver>,
): RuntimeNavigation | undefined {
  let sourceEvent = event as SourceElementNavigateEvent
  let sourceElement = sourceEvent.sourceElement
  if (!(sourceElement instanceof Element)) return

  let linkElement = sourceElement.closest('a, area')
  if (linkElement instanceof Element) {
    if (linkElement.hasAttribute('data-rmx-document')) return
    if (linkElement.hasAttribute('download')) return

    return {
      state: {
        target: linkElement.getAttribute('data-rmx-target') ?? undefined,
        src: linkElement.getAttribute('data-rmx-src') ?? event.destination.url,
        resetScroll: linkElement.getAttribute('data-rmx-reset-scroll') !== 'false',
        $rmx: true,
      },
      replaceHistory: getReplaceHistory(linkElement.getAttribute('data-rmx-history'), false),
    }
  }

  let formNavigation = resolveFormNavigation(event)
  if (!formNavigation || formNavigation.hasAttribute('data-rmx-document')) return

  let replaceHistoryByDefault =
    formNavigation.getSubmission !== undefined &&
    event.destination.url === navigation.currentEntry?.url

  return {
    state: {
      target: formNavigation.getAttribute('data-rmx-target') ?? undefined,
      src: formNavigation.getAttribute('data-rmx-src') ?? event.destination.url,
      resetScroll: formNavigation.getAttribute('data-rmx-reset-scroll') !== 'false',
      $rmx: true,
    },
    replaceHistory: getReplaceHistory(
      formNavigation.getAttribute('data-rmx-history'),
      replaceHistoryByDefault,
    ),
    getSubmission: formNavigation.getSubmission,
  }
}

function getReplaceHistory(value: string | null, defaultValue: boolean): boolean {
  if (value === 'replace') return true
  if (value === 'push') return false
  return defaultValue
}
