import { getTopFrame, getNamedFrame } from './run.ts'
import { reloadFrameForNavigation } from './frame.ts'
import { createNavigationSourceResolver, type FormSubmission } from './form-navigation.ts'

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
  resetScroll: boolean
}

const formSubmissionNavigationInfoType = 'frame-form-submission'
const frameRedirectNavigationInfoType = 'frame-redirect'

function resyncWebKitScrollAfterNavigation(
  event: NavigateEvent,
  resetScroll: boolean,
  transition: NavigationTransition,
): void {
  let userAgent = navigator.userAgent
  if (!userAgent.includes('AppleWebKit') || isChromiumUserAgent(userAgent)) return
  if (!resetScroll || (event.navigationType !== 'push' && event.navigationType !== 'replace'))
    return
  if (new URL(event.destination.url).hash) return

  void transition.finished.then(
    () => {
      // WebKit can reset its internal scroll position without synchronizing the visual viewport.
      // https://bugs.webkit.org/show_bug.cgi?id=309542
      if (event.signal.aborted || window.scrollX !== 0 || window.scrollY !== 0) return
      window.scrollTo({ behavior: 'instant', left: 0, top: 1 })
      requestAnimationFrame(() => {
        if (event.signal.aborted || window.scrollX !== 0 || window.scrollY !== 1) return
        window.scrollTo({ behavior: 'instant', left: 0, top: 0 })
      })
    },
    () => {},
  )
}

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
  let resolveNavigationSource = createNavigationSourceResolver(signal)

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
        interceptNavigation(navigation, event, event.info.resetScroll, {
          async handler() {},
          scroll: 'manual',
        })
        return
      }

      let replayedSubmission = isFormSubmissionNavigationInfo(event.info) ? event.info : undefined
      let runtimeNavigation = replayedSubmission
        ? {
            state: replayedSubmission.state,
            getSubmission: replayedSubmission.getSubmission,
          }
        : getRuntimeNavigation(navigation, event, resolveNavigationSource)
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
        if (event.signal.aborted || reload.signal.aborted) return
        if (state.resetScroll) event.scroll()

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

      let interceptOptions = {
        handler,
        scroll: state.resetScroll === false ? 'manual' : undefined,
      } satisfies NavigationInterceptOptions

      if (runtimeNavigation.getSubmission) {
        // <form method="post"> navigations
        if (runtimeNavigation.replaceHistory && replayedSubmission == null) {
          let supportsPrecommit =
            typeof Reflect.get(window, 'NavigationPrecommitController') === 'function'

          // Modern browsers allow you to update the in-flight navigation entry before it's committed
          if (supportsPrecommit) {
            interceptNavigation(navigation, event, state.resetScroll, {
              ...interceptOptions,
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

        interceptNavigation(navigation, event, state.resetScroll, interceptOptions)
      } else {
        // <a>/<form method="get"> navigations
        if (runtimeNavigation.replaceHistory && event.cancelable) {
          event.preventDefault()
          navigation.navigate(event.destination.url, { history: 'replace', state })
        } else {
          interceptNavigation(navigation, event, state.resetScroll, interceptOptions)
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

function interceptNavigation(
  navigation: Navigation,
  event: NavigateEvent,
  resetScroll: boolean,
  options: NavigationInterceptOptions,
): void {
  let scrollStyleWorkarounds = installNavigationScrollStyleWorkarounds(event, resetScroll)

  let transitionBound = false
  function bindTransition() {
    if (transitionBound) return
    if (event.signal.aborted) return scrollStyleWorkarounds?.remove()

    // The Navigation API creates the transition before running interception handlers.
    let transition = navigation.transition
    if (!transition) return scrollStyleWorkarounds?.remove()
    transitionBound = true

    resyncWebKitScrollAfterNavigation(event, resetScroll, transition)
    if (scrollStyleWorkarounds) {
      scheduleNavigationScrollCleanup(
        transition,
        scrollStyleWorkarounds.remove,
        scrollStyleWorkarounds.cleanup,
      )
    }
  }

  let interceptOptions: NavigationInterceptOptions = {
    ...options,
    handler() {
      bindTransition()
      return options.handler?.()
    },
  }
  let precommitHandler = options.precommitHandler
  if (precommitHandler) {
    interceptOptions.precommitHandler = function precommit(controller) {
      bindTransition()
      return precommitHandler(controller)
    }
  }

  try {
    event.intercept(interceptOptions)
  } catch (error) {
    scrollStyleWorkarounds?.remove()
    throw error
  }
}

type NavigationScrollStyles = {
  cssText: string
  cleanup: 'finished' | 'after-paint'
}

function getNavigationScrollStyles(
  event: NavigateEvent,
  resetScroll: boolean,
): NavigationScrollStyles | undefined {
  if (!resetScroll) return

  if (event.navigationType === 'traverse') {
    // Full-document reconciliation can temporarily shrink the page or trigger scroll anchoring
    // before the Navigation API performs its deferred restoration. Preserve the starting scroll
    // range and position until the navigation finishes so native restoration remains authoritative.
    // Root scroll height includes page-level effects such as body padding.

    // We think this is a bug in Chromium where they are incorrectly classifying a
    // DOM-modification-driven scroll change as a user scroll action, causing it to skip restoration
    // after the transition. The intended user-scroll behavior is tested here:
    // https://github.com/web-platform-tests/wpt/blob/master/navigation-api/scroll-behavior/after-transition-skips-restore-when-scrolled.html
    let { scrollHeight, clientHeight } = document.documentElement
    return {
      cssText: `
        html {
          min-height: ${scrollHeight + clientHeight}px !important;
          overflow-anchor: none !important;
        }

        body {
          overflow-anchor: none !important;
        }
      `,
      cleanup: 'finished',
    }
  }

  if (event.navigationType !== 'push' && event.navigationType !== 'replace') return
  if (new URL(event.destination.url).hash) return
  if (!isChromiumUserAgent(navigator.userAgent)) return

  // Chromium can treat reconciliation-driven scroll anchoring as user scrolling and preserve an
  // offset after NavigateEvent.scroll() resets the destination. Suppress anchoring before
  // interception and keep it disabled through the first post-navigation paint.
  return {
    cssText: `
      html,
      body {
        overflow-anchor: none !important;
      }
    `,
    cleanup: 'after-paint',
  }
}

function isChromiumUserAgent(userAgent: string): boolean {
  return userAgent.includes('Chrome') || userAgent.includes('Chromium')
}

type NavigationScrollStylesheet = {
  remove(): void
  cleanup: NavigationScrollStyles['cleanup']
}

function installNavigationScrollStyleWorkarounds(
  event: NavigateEvent,
  resetScroll: boolean,
): NavigationScrollStylesheet | undefined {
  let scrollStyles = getNavigationScrollStyles(event, resetScroll)
  if (!scrollStyles) return

  let stylesheet = new CSSStyleSheet()
  stylesheet.replaceSync(scrollStyles.cssText)
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet]

  let removed = false
  function remove() {
    event.signal.removeEventListener('abort', remove)
    if (removed) return
    removed = true
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (current) => current !== stylesheet,
    )
  }

  if (event.signal.aborted) remove()
  else event.signal.addEventListener('abort', remove, { once: true })
  return { remove, cleanup: scrollStyles.cleanup }
}

function scheduleNavigationScrollCleanup(
  transition: NavigationTransition,
  removeScrollStyles: () => void,
  cleanup: NavigationScrollStylesheet['cleanup'],
): void {
  function removeAfterSuccess() {
    if (cleanup === 'finished') return removeScrollStyles()
    // The first callback runs before the first post-navigation paint. The second removes the
    // stylesheet before the following frame.
    requestAnimationFrame(() => requestAnimationFrame(removeScrollStyles))
  }

  void transition.finished.then(removeAfterSuccess, removeScrollStyles)
}

function getRuntimeNavigation(
  navigation: Navigation,
  event: NavigateEvent,
  resolveNavigationSource: ReturnType<typeof createNavigationSourceResolver>,
): RuntimeNavigation | undefined {
  if (event.navigationType === 'traverse') {
    let state = getTraverseNavigationState(navigation, event)
    return state ? { state } : undefined
  }

  let destinationState = event.destination.getState()
  if (isRuntimeNavigation(destinationState)) return { state: destinationState }

  return getSourceElementNavigation(navigation, event, resolveNavigationSource)
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
  resolveNavigationSource: ReturnType<typeof createNavigationSourceResolver>,
): RuntimeNavigation | undefined {
  let { sourceElement, formNavigation } = resolveNavigationSource(event)

  let linkElement = sourceElement?.closest('a, area')
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
