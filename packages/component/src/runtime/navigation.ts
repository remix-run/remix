import {
  createFormNavigationResolver,
  getFrameCommitNavigation,
  isDocumentReload,
  reloadCurrentDocument,
  reloadFrameForNavigation,
  setFrameCommitNavigation,
  type FormSubmission,
  type FrameCommitNavigation,
} from './frame.ts'
import type { FrameHandle, Handle } from './component.ts'

/**
 * Noncancelable event dispatched when Remix accepts a frame navigation, before `reloadStart`.
 * It bubbles from the initiating link, submitter, or form, and crosses shadow roots. Navigations
 * without a connected source notify `window` directly. Notifications for one operation share
 * `finished`, including external submitter and form copies. Redirects do not dispatch another event.
 */
export interface NavigationEvent extends Event {
  /** Source passed to `resolveFrame` for the initiating load, unchanged through redirects. */
  readonly frameSrc: string
  /** Effective HTTP method in lowercase. */
  readonly method: string
  /** Initiating link or owning form, or null for programmatic navigation and history traversal. */
  readonly element: HTMLAnchorElement | HTMLAreaElement | SVGAElement | HTMLFormElement | null
  /** Actual submit button, when the form has a submitter. */
  readonly submitter?: HTMLElement
  /** Effective form encoding, only present for POST submissions. */
  readonly encType?: string
  /** Submitted entries, only present for POST submissions. Shared with the request. */
  readonly formData?: FormData
  /**
   * Resolves after rendering, redirects, scroll, and focus handling, or with an aborted signal
   * on cancellation or replacement. Rejects on failure.
   */
  readonly finished: Promise<AbortSignal>
  /** Initial browser destination, unchanged through redirects. */
  readonly to: string
  /** Effective history behavior of the original navigation, preserved through redirects. */
  readonly navigationType: NavigationType
  /** Original history entry being left, preserved through redirects. */
  readonly from: NavigationHistoryEntry
  /** Named destination frame, or undefined for the top frame. */
  readonly frameTarget: string | undefined
}

type NavigationEventInit = Omit<NavigationEvent, keyof Event>

type NavigationState = {
  target: string | undefined
  src: string
  resetScroll?: NavigationOptions['resetScroll']
  resetFocus?: NavigationOptions['resetFocus']
  $rmx: true
}

type SourceElementNavigateEvent = NavigateEvent & {
  sourceElement?: Element | null
}

// The element whose navigation this is, and the owning form for a submission.
type NavigationSource = {
  element: HTMLAnchorElement | HTMLAreaElement | SVGAElement | HTMLFormElement
  form?: HTMLFormElement
  submitter?: HTMLElement | null
  submission?: FormSubmission
}

type RuntimeNavigation = {
  state: NavigationState
  source?: NavigationSource
  getSubmission?: () => Promise<FormSubmission>
  replaceHistory?: boolean
}

// Replacement navigations have no source element. Carry the original source and POST body
// through the Navigation API's in-memory info value.
class HistoryReplacement {
  source?: NavigationSource
  submission?: {
    state: NavigationState
    frame: FrameHandle
    getSubmission(): Promise<FormSubmission>
  }
}

interface FrameRedirectNavigationInfo {
  type: typeof frameRedirectNavigationInfoType
  resetScroll: NonNullable<NavigationInterceptOptions['scroll']>
  resetFocus: NonNullable<NavigationInterceptOptions['focusReset']>
}

interface FrameCommitNavigationState extends FrameCommitNavigation {
  controller: AbortController
  redirecting: boolean
  navigation: NavigationEventInit
}

const frameRedirectNavigationInfoType = 'frame-redirect'
const frameRedirectCommitNavigations = new WeakMap<
  FrameRedirectNavigationInfo,
  FrameCommitNavigationState
>()

// Lets the navigation handler tell the WebKit workaround once it has reset scroll.
const webKitScrollResets = new WeakMap<NavigateEvent, () => void>()

const webKitScrollResetDuration = 500

// iOS Safari can restore the previous position, or the new page's bottom, for several frames after
// a navigation resets scroll. Undo those restorations until shortly after the navigation finishes,
// the user interacts with the page, or another navigation starts. App code that scrolls to one of
// those positions in that time is undone too.
function resyncWebKitScrollAfterNavigation(
  navigation: Navigation,
  event: NavigateEvent,
  resetScroll: boolean,
  transition: NavigationTransition,
): void {
  if (!isWebKitUserAgent(navigator.userAgent)) return
  if (!resetScroll || !resetsScrollToTop(event)) return

  let startY = window.scrollY
  let controller = new AbortController()
  let { signal } = controller
  let stop = () => controller.abort()
  for (let type of ['pointerdown', 'wheel', 'keydown']) {
    window.addEventListener(type, stop, { capture: true, passive: true, signal })
  }
  navigation.addEventListener('navigate', stop, { signal })

  // Safari clamps the previous position to the page's height when it restores it, and the page can
  // grow before the scroll event runs, so remember every bottom the new page has had.
  let restoredPositions = new Set([startY])
  function rememberBottom() {
    let maxY = document.documentElement.scrollHeight - window.innerHeight
    if (startY > maxY) restoredPositions.add(maxY)
  }
  function scrollTo(top: number) {
    window.scrollTo({ behavior: 'instant', left: 0, top })
  }
  function undoRestoration() {
    rememberBottom()
    let y = window.scrollY
    if (y === 0) return
    for (let position of restoredPositions) {
      if (Math.abs(y - position) < 1) {
        return scrollTo(0)
      }
    }
  }

  let resetApplied = false
  webKitScrollResets.set(event, () => {
    resetApplied = true
    rememberBottom()
  })
  // Scroll events run before the frame paints, so an undone restoration may never be drawn.
  window.addEventListener('scroll', () => resetApplied && undoRestoration(), {
    passive: true,
    signal,
  })

  void transition.finished.then(() => {
    if (!signal.aborted) {
      undoRestoration()
      setTimeout(stop, webKitScrollResetDuration)
    }

    // WebKit can reset its internal scroll position without synchronizing the visual viewport.
    // https://bugs.webkit.org/show_bug.cgi?id=309542
    function resyncScroll() {
      if (event.signal.aborted || window.scrollX !== 0 || window.scrollY !== 0) return
      scrollTo(1)
      requestAnimationFrame(() => {
        if (event.signal.aborted || window.scrollX !== 0 || window.scrollY !== 1) return
        scrollTo(0)
      })
    }

    // A commit hook may pause animation frames for a view-transition snapshot. Wait for frames
    // to resume before nudging, while keeping the repair for hooks that don't animate.
    if (getFrameCommitNavigation(event.signal)?.pendingCommits) {
      requestAnimationFrame(resyncScroll)
    } else {
      resyncScroll()
    }
  }, stop)
}

/**
 * Options for client-side frame-aware navigation.
 */
export type NavigationOptions = {
  /**
   * Same-origin source override for a mounted named frame, resolved against the document base URL.
   * Invalid or cross-origin values fall back to document navigation. Top-frame navigations use
   * `href` to keep the frame source in sync with the browser URL.
   */
  src?: string
  /**
   * Mounted named frame to reload. When omitted, the top frame reloads. An unmatched name falls
   * back to document navigation.
   */
  target?: string
  /** How the destination updates browser history. */
  history?: 'push' | 'replace'
  /**
   * Scroll behavior. `true` aliases `"after-transition"` and `false` aliases `"manual"`.
   * (default: `"after-transition"`)
   */
  resetScroll?: NavigationInterceptOptions['scroll'] | boolean
  /**
   * Focus reset behavior. `true` aliases `"after-transition"` and `false` aliases `"manual"`.
   * (default: `"after-transition"`)
   */
  resetFocus?: NavigationInterceptOptions['focusReset'] | boolean
}

/**
 * Performs a Navigation API transition understood by Remix frame runtime state.
 * Invalid or cross-origin sources fall back to document navigation.
 *
 * @param href Destination URL.
 * @param options Navigation options.
 * @returns A promise that settles when the Navigation API transition finishes.
 */
export async function navigate(href: string, options?: NavigationOptions) {
  let state = {
    target: options?.target,
    src: options?.src ?? href,
    resetScroll: normalizeResetBehavior(options?.resetScroll),
    resetFocus: normalizeResetBehavior(options?.resetFocus),
    $rmx: true,
  } satisfies NavigationState
  let navigation = getInterceptableNavigation()
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

function dispatchNavigationEvent(init: NavigationEventInit, signal: AbortSignal): void {
  function dispatch(target: EventTarget, bubbles = true) {
    EventTarget.prototype.dispatchEvent.call(
      target,
      Object.assign(new Event('rmx:navigation', { bubbles, composed: true }), init),
    )
  }

  let element = init.element
  let target = element ? (init.submitter ?? element) : null
  if (!target || Node.prototype.getRootNode.call(target, { composed: true }) !== document) {
    dispatch(window)
  }
  if (!element || !target || signal.aborted) return

  // Form controls can shadow methods on their owning form.
  let bubbles = Node.prototype.contains.call(element, target)
  dispatch(target, bubbles)
  // External or detached submitters have no event path through their owning form.
  if (!bubbles && !signal.aborted) dispatch(element)
}

/**
 * Starts listening for Navigation API transitions and routes them through frame reloads.
 *
 * @param signal Abort signal used to remove the listener.
 * @param options Frames of the running app, and an optional reload override for tests.
 * @returns void
 */
export function startNavigationListener(
  signal: AbortSignal,
  options: Handle['frames'] & { reloadFrame?: typeof reloadFrameForNavigation },
) {
  let reloadFrame = options.reloadFrame ?? reloadFrameForNavigation
  let navigation = getInterceptableNavigation()
  if (!navigation) return
  let resolveFormNavigation = createFormNavigationResolver(signal)
  let releaseCurrent: (() => void) | undefined
  let needsFrameReload = false
  // A push can commit before its handler runs. Keep its entry marked until its frame renders.
  let pushingFrom: string | undefined
  let unrenderedEntry: string | undefined
  let currentCommitNavigation: FrameCommitNavigationState | undefined
  let userAgent = navigator.userAgent
  let scrollPositions =
    isWebKitUserAgent(userAgent) || isFirefoxUserAgent(userAgent)
      ? new Map<string, { left: number; top: number }>()
      : undefined
  let settledEntryKey = scrollPositions ? navigation.currentEntry?.key : undefined
  // Input can be delivered after the navigation it preceded. Compare timestamps, not delivery order.
  let lastInputTime = 0
  if (scrollPositions) {
    for (let type of ['pointerdown', 'wheel', 'keydown', 'touchmove']) {
      window.addEventListener(
        type,
        (event) => {
          lastInputTime = Math.max(lastInputTime, event.timeStamp)
        },
        { capture: true, passive: true, signal },
      )
    }

    navigation.addEventListener(
      'currententrychange',
      (event) => {
        // Hash changes and URL-only updates keep the displayed content in the new entry.
        if (settledEntryKey !== undefined && settledEntryKey === event.from.key) {
          settledEntryKey = navigation.currentEntry?.key
        }
      },
      { signal },
    )
  }

  navigation.updateCurrentEntry({
    state: {
      target: undefined,
      src: window.location.href,
      resetScroll: 'after-transition',
      resetFocus: 'after-transition',
      $rmx: true,
    },
  })

  navigation.addEventListener(
    'navigate',
    (event) => {
      let from = navigation.currentEntry
      let currentKey = from?.key
      if (pushingFrom !== undefined) {
        if (currentKey !== pushingFrom) unrenderedEntry = currentKey
        pushingFrom = undefined
      }
      if (scrollPositions) {
        if (currentKey !== undefined && currentKey === settledEntryKey) {
          scrollPositions.set(currentKey, { left: window.scrollX, top: window.scrollY })
          let keys = new Set(navigation.entries().map((entry) => entry.key))
          for (let key of scrollPositions.keys()) {
            if (!keys.has(key)) scrollPositions.delete(key)
          }
        } else if (currentKey !== undefined) {
          // A failed, interrupted, or superseded load cannot refresh this entry's snapshot. Forget
          // the old one so the next visit uses native restoration rather than stale coordinates.
          scrollPositions.delete(currentKey)
        }
      }

      let redirect = isFrameRedirectNavigationInfo(event.info) ? event.info : undefined
      let redirectCommit = redirect && frameRedirectCommitNavigations.get(redirect)
      if (redirectCommit !== currentCommitNavigation) redirectCommit = undefined
      if (currentCommitNavigation && currentCommitNavigation !== redirectCommit) {
        currentCommitNavigation.controller.abort(
          new DOMException('Frame navigation was superseded', 'AbortError'),
        )
      }
      if (
        isDocumentReload(event.info) ||
        (event.hashChange && !needsFrameReload) ||
        event.downloadRequest != null ||
        !event.canIntercept ||
        !from ||
        // Safari seems to incorrectly set canIntercept to true for sub-domain navigations, so
        // we do an origin check ourselves. The spec is clear that a different host should prevent
        // interception so this is likely a bug in Safari:
        // https://html.spec.whatwg.org/multipage/nav-history-apis.html#can-have-its-url-rewritten
        !isSameOriginUrl(event.destination.url)
      ) {
        return
      }

      if (redirect) {
        if (redirectCommit) setFrameCommitNavigation(event.signal, redirectCommit)
        interceptNavigation(navigation, event, redirect.resetScroll !== 'manual', {
          async handler() {},
          scroll: 'manual',
          focusReset: redirect.resetFocus,
        })
        return
      }

      let replacement = event.info instanceof HistoryReplacement ? event.info : undefined
      let replayedSubmission = replacement?.submission
      let runtimeNavigation: RuntimeNavigation | undefined =
        replayedSubmission ?? getRuntimeNavigation(navigation, event, resolveFormNavigation)
      if (!runtimeNavigation) return
      let { state } = runtimeNavigation
      let replaceHistory =
        runtimeNavigation.replaceHistory ||
        (event.navigationType === 'push' &&
          unrenderedEntry !== undefined &&
          navigation.currentEntry?.key === unrenderedEntry)
      let isTraverse = event.navigationType === 'traverse'
      let scroll = isTraverse ? 'after-transition' : normalizeResetBehavior(state.resetScroll)
      let focusReset = isTraverse ? 'after-transition' : normalizeResetBehavior(state.resetFocus)
      if (!isSameOriginUrl(state.src)) {
        fallbackToDocumentNavigation(navigation, event)
        return
      }

      let topFrame = options.top
      let frame = replayedSubmission?.frame ?? (state.target ? options.get(state.target) : topFrame)
      if (!frame) {
        fallbackToDocumentNavigation(navigation, event)
        return
      }
      let source = replacement?.source ?? runtimeNavigation.source

      if (event.signal.aborted) return
      releaseCurrent?.()
      let reloadSignal: AbortSignal | undefined
      let started = false
      let pushesEntry = event.navigationType === 'push' && !replaceHistory
      if (pushesEntry) pushingFrom = navigation.currentEntry?.key
      needsFrameReload = true
      releaseCurrent = release
      event.signal.addEventListener('abort', release, { once: true })

      function isCurrent(): boolean {
        return releaseCurrent === release && !event.signal.aborted && !reloadSignal?.aborted
      }
      function release(): void {
        if (releaseCurrent !== release) return
        releaseCurrent = undefined
        event.signal.removeEventListener('abort', release)
      }

      // The URL advances before the content. An interrupted or failed load must not save the
      // outgoing viewport as the pending destination's position.
      if (scrollPositions) settledEntryKey = undefined
      let savedPosition = isTraverse ? scrollPositions?.get(event.destination.key) : undefined

      // WebKit runs a traversal's handlers before moving its history to the destination entry, which
      // it does later in the task that fires `navigate`. Scrolling before then restores the position
      // of the entry being left.
      let traversalApplied = isTraverse ? afterCurrentTask() : undefined
      let commitNavigation: FrameCommitNavigationState | undefined
      let completion = Promise.withResolvers<void>()

      let handler = async () => {
        try {
          if (started || !isCurrent()) return
          started = true
          if (pushesEntry) {
            unrenderedEntry = navigation.currentEntry?.key
            pushingFrom = undefined
          }
          if (!commitNavigation || commitNavigation.signal.aborted) return
          let operation = commitNavigation
          let transition = navigation.transition
          if (transition) {
            void transition.finished.then(
              () => {
                if (!operation.redirecting) completion.resolve()
              },
              (error) => {
                if (!operation.redirecting) completion.reject(error)
              },
            )
          }

          let submission = await runtimeNavigation.getSubmission?.()
          if (operation.signal.aborted || !isCurrent()) return

          if (event.navigationType !== 'traverse') {
            // Updating state dispatches currententrychange, whose listeners can navigate again.
            navigation.updateCurrentEntry({ state })
            if (!isCurrent()) return
          }

          topFrame.src = event.destination.url
          if (!isCurrent()) return
          if (frame !== topFrame) {
            frame.src = state.src
            if (!isCurrent()) return
          }
          let reload = reloadFrame(frame, {
            ...submission,
            element: source?.element,
            submitter: source?.submitter,
            form: source?.form,
            signal: event.signal,
            navigationType: operation.navigation.navigationType,
            from: operation.navigation.from,
          })
          let cancelReload = () => operation.controller.abort(reload.signal.reason)
          if (reload.signal.aborted) cancelReload()
          else reload.signal.addEventListener('abort', cancelReload, { once: true })
          let disconnectReload = () => reload.signal.removeEventListener('abort', cancelReload)
          void reload.finished.then(disconnectReload, disconnectReload)
          reloadSignal = reload.signal
          await reload.committed
          if (!isCurrent()) return
          if (navigation.currentEntry?.key === unrenderedEntry) unrenderedEntry = undefined
          if (scroll !== 'manual') {
            await traversalApplied
            if (!isCurrent()) return
            // WebKit restores a traversal's position against the layout from before the commit, so
            // it clamps the position to the old page's height. Reading the height lays out the new
            // content first.
            document.documentElement.scrollHeight
            if (!isCurrent()) return
            event.scroll()
            if (!isCurrent()) return
            // WebKit can overwrite the destination's native position during a slow traversal.
            // Its source documents a scroll-save timer racing with loading and clobbering history:
            // https://github.com/WebKit/WebKit/blob/aa9b09cf670187495dc2426b0c06e5f3c86e52d7/Source/WebKit/WebProcess/WebPage/WebPage.cpp#L8883-L8884
            // Firefox can clamp it to the outgoing document's height before this commit.
            if (
              savedPosition &&
              lastInputTime < event.timeStamp &&
              window.history.scrollRestoration === 'auto'
            ) {
              window.scrollTo({ ...savedPosition, behavior: 'instant' })
              if (!isCurrent()) return
            }
            webKitScrollResets.get(event)?.()
          }

          let { redirectedTo } = await reload.finished
          if (!isCurrent()) return
          needsFrameReload = false
          // Do not adopt independent retries or takeovers, or content whose stream is unfinished.
          // Completing a later navigation makes this entry eligible for snapshots again.
          if (scrollPositions) settledEntryKey = navigation.currentEntry?.key

          if (redirectedTo && frame === topFrame) {
            frame.src = redirectedTo
            if (!isCurrent()) return
            commitNavigation.redirecting = true
            let info: FrameRedirectNavigationInfo = {
              type: frameRedirectNavigationInfoType,
              resetScroll: scroll,
              resetFocus: focusReset,
            }
            frameRedirectCommitNavigations.set(info, commitNavigation)
            // Start the successor navigation without awaiting it: this handler must settle before
            // the replacement navigation can finish.
            let redirected = navigation.navigate(redirectedTo, {
              history: 'replace',
              state: { ...state, src: redirectedTo },
              info,
            })
            if (redirected?.finished) {
              void redirected.finished.then(() => completion.resolve(), completion.reject)
            } else {
              completion.resolve()
            }
          } else if (!transition) {
            completion.resolve()
          }
        } catch (error) {
          if (commitNavigation) completion.reject(error)
          throw error
        } finally {
          release()
        }
      }

      let interceptOptions: NavigationInterceptOptions = { handler, scroll, focusReset }

      if (replaceHistory && !replayedSubmission) {
        // Modern browsers can replace the in-flight entry before committing it.
        if (typeof Reflect.get(window, 'NavigationPrecommitController') === 'function') {
          interceptOptions.precommitHandler = (controller) => {
            controller.redirect(event.destination.url, { history: 'replace' })
          }
        } else if (event.cancelable) {
          // Earlier engines replay the navigation with the original form or link information.
          event.preventDefault()
          let info = new HistoryReplacement()
          info.source = source
          if (runtimeNavigation.getSubmission) {
            info.submission = { state, frame, getSubmission: runtimeNavigation.getSubmission }
          }
          navigation.navigate(event.destination.url, { history: 'replace', state, info })
          return
        }
      }
      interceptNavigation(navigation, event, scroll !== 'manual', interceptOptions)
      if (event.signal.aborted || signal.aborted) return
      let controller = new AbortController()
      // A completed navigation stays successful when another navigation later aborts its controller.
      let cancel = () => completion.resolve()
      controller.signal.addEventListener('abort', cancel, { once: true })
      let finished = completion.promise.then(() =>
        controller.signal.aborted ? controller.signal : new AbortController().signal,
      )
      void finished.then(disconnect, disconnect)
      function disconnect() {
        controller.signal.removeEventListener('abort', cancel)
      }
      let submission = source?.submission
      let method = submission?.method.toLowerCase() ?? 'get'
      let operation: FrameCommitNavigationState = {
        controller,
        signal: controller.signal,
        finished: completion.promise,
        redirecting: false,
        pendingCommits: 0,
        navigation: {
          frameSrc: frame === topFrame ? event.destination.url : state.src,
          to: event.destination.url,
          navigationType: replaceHistory ? 'replace' : event.navigationType,
          from,
          frameTarget: frame === topFrame ? undefined : state.target,
          element: source?.element ?? null,
          method,
          ...(source?.submitter ? { submitter: source.submitter } : {}),
          ...(submission && method === 'post'
            ? { encType: submission.encType, formData: submission.formData }
            : {}),
          finished,
        },
      }
      commitNavigation = operation
      currentCommitNavigation = operation
      setFrameCommitNavigation(event.signal, operation)
      signal.addEventListener('abort', () => controller.abort(signal.reason), {
        once: true,
        signal: controller.signal,
      })
      event.signal.addEventListener(
        'abort',
        () => {
          if (!operation.redirecting) controller.abort(event.signal.reason)
        },
        { once: true, signal: controller.signal },
      )
      dispatchNavigationEvent(operation.navigation, operation.signal)
    },
    { signal },
  )
}

export function getInterceptableNavigation(): Navigation | undefined {
  let navigation = window.navigation
  if (
    !navigation ||
    typeof NavigateEvent === 'undefined' ||
    !('sourceElement' in NavigateEvent.prototype)
  ) {
    return
  }
  return navigation
}

function afterCurrentTask(): Promise<void> {
  let { port1, port2 } = new MessageChannel()
  return new Promise((resolve) => {
    port1.onmessage = () => {
      port1.close()
      resolve()
    }
    port2.postMessage(null)
  })
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null
}

export function isRuntimeNavigation(info: unknown): info is NavigationState {
  return isObject(info) && '$rmx' in info
}

function isFrameRedirectNavigationInfo(value: unknown): value is FrameRedirectNavigationInfo {
  return (
    isObject(value) &&
    value.type === frameRedirectNavigationInfoType &&
    isResetBehavior(value.resetScroll) &&
    isResetBehavior(value.resetFocus)
  )
}

function isResetBehavior(value: unknown): boolean {
  return value === 'after-transition' || value === 'manual'
}

function isSameOriginUrl(src: string): boolean {
  return getSameOriginUrl(src) != null
}

export function getSameOriginUrl(src: string, baseURL = document.baseURI): URL | undefined {
  try {
    let url = new URL(src, baseURL)
    if (url.origin === window.location.origin) return url
  } catch {
    // Invalid URLs can't be same-origin.
  }
}

function fallbackToDocumentNavigation(navigation: Navigation, event: NavigateEvent): void {
  if (event.navigationType !== 'traverse') return

  interceptNavigation(navigation, event, false, {
    scroll: 'manual',
    handler() {
      if (!event.signal.aborted) reloadCurrentDocument(document)
    },
  })
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

    resyncWebKitScrollAfterNavigation(navigation, event, resetScroll, transition)
    if (scrollStyleWorkarounds) scheduleNavigationScrollCleanup(transition, scrollStyleWorkarounds)
  }

  let interceptOptions: NavigationInterceptOptions = {
    ...options,
    async handler() {
      bindTransition()
      try {
        await options.handler?.()
      } catch (error) {
        if (options.focusReset !== 'manual') keepFocusAfterFailure(navigation, event)
        throw error
      }
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

// The Navigation API resets focus once a navigation settles, even when its handler fails and the
// page stays as it was, which would take the visitor away from a form whose save failed. The reset
// runs before the signal aborts. Restore focus then, before `navigateerror` listeners run, unless
// an earlier abort listener has already moved focus or started another navigation. A navigation
// that was already replaced leaves focus to its successor.
function keepFocusAfterFailure(navigation: Navigation, event: NavigateEvent): void {
  let focused = document.activeElement
  if (event.signal.aborted || focused === document.body) return
  if (!(focused instanceof HTMLElement || focused instanceof SVGElement)) return

  let controller = new AbortController()
  let { signal } = controller
  function stop() {
    controller.abort()
  }
  function onFocusChange() {
    // The browser's reset happens before abort; focus changes during abort belong to app code.
    if (event.signal.aborted) stop()
  }
  document.addEventListener('focus', onFocusChange, { capture: true, signal })
  document.addEventListener('blur', onFocusChange, { capture: true, signal })
  navigation.addEventListener('navigate', stop, { signal })
  event.signal.addEventListener(
    'abort',
    () => {
      stop()
      if (focused.isConnected && document.activeElement !== focused) {
        focused.focus({ preventScroll: true })
      }
    },
    { once: true, signal },
  )
}

const disableScrollAnchoringCssText = 'html, body { overflow-anchor: none !important; }'

function getNavigationScrollStyles(event: NavigateEvent, resetScroll: boolean): string | undefined {
  if (!resetScroll) return

  if (event.navigationType === 'traverse') {
    // Full-document reconciliation can temporarily shrink the page or trigger scroll anchoring
    // before the Navigation API performs its deferred restoration. Preserve the starting scroll
    // range and position until the navigation finishes so native restoration remains authoritative.
    // Root scroll height includes page-level effects such as body padding.
    //
    // Re-enabling scroll anchoring while the page shrinks back to its own height lets Chromium
    // move the restored scroll position, so anchoring stays disabled until after the next paint.

    // We think this is a bug in Chromium where they are incorrectly classifying a
    // DOM-modification-driven scroll change as a user scroll action, causing it to skip restoration
    // after the transition. The intended user-scroll behavior is tested here:
    // https://github.com/web-platform-tests/wpt/blob/master/navigation-api/scroll-behavior/after-transition-skips-restore-when-scrolled.html
    let { scrollHeight, clientHeight } = document.documentElement
    return (
      `html { min-height: ${scrollHeight + clientHeight}px !important; overflow-anchor: none !important; }` +
      'body { overflow-anchor: none !important; }'
    )
  }

  if (!resetsScrollToTop(event) || !isChromiumUserAgent(navigator.userAgent)) return

  // Chromium can treat reconciliation-driven scroll anchoring as user scrolling and preserve an
  // offset after NavigateEvent.scroll() resets the destination. Suppress anchoring before
  // interception and keep it disabled through the first post-navigation paint.
  return disableScrollAnchoringCssText
}

function resetsScrollToTop(event: NavigateEvent): boolean {
  return (
    (event.navigationType === 'push' || event.navigationType === 'replace') &&
    !new URL(event.destination.url).hash
  )
}

function isChromiumUserAgent(userAgent: string): boolean {
  return userAgent.includes('Chrome') || userAgent.includes('Chromium')
}

function isWebKitUserAgent(userAgent: string): boolean {
  return userAgent.includes('AppleWebKit') && !isChromiumUserAgent(userAgent)
}

function isFirefoxUserAgent(userAgent: string): boolean {
  return userAgent.includes('Firefox')
}

type NavigationScrollStylesheet = {
  remove(): void
  settle(): void
}

function installNavigationScrollStyleWorkarounds(
  event: NavigateEvent,
  resetScroll: boolean,
): NavigationScrollStylesheet | undefined {
  let cssText = getNavigationScrollStyles(event, resetScroll)
  if (!cssText) return

  let stylesheet = new CSSStyleSheet()
  stylesheet.replaceSync(cssText)
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

  // Drop everything but the scroll anchoring suppression once the navigation has finished.
  function settle() {
    if (!removed && cssText !== disableScrollAnchoringCssText) {
      stylesheet.replaceSync(disableScrollAnchoringCssText)
    }
  }

  if (event.signal.aborted) remove()
  else event.signal.addEventListener('abort', remove, { once: true })
  return { remove, settle }
}

function scheduleNavigationScrollCleanup(
  transition: NavigationTransition,
  scrollStyles: NavigationScrollStylesheet,
): void {
  function settleAfterSuccess() {
    scrollStyles.settle()
    // The first callback runs before the first post-navigation paint. The second removes the
    // stylesheet before the following frame.
    requestAnimationFrame(() => requestAnimationFrame(scrollStyles.remove))
  }

  void transition.finished.then(settleAfterSuccess, scrollStyles.remove)
}

function getRuntimeNavigation(
  navigation: Navigation,
  event: NavigateEvent,
  resolveFormNavigation: ReturnType<typeof createFormNavigationResolver>,
): RuntimeNavigation | undefined {
  let traverse = event.navigationType === 'traverse'
  if (!traverse) {
    let source = getSourceElementNavigation(navigation, event, resolveFormNavigation)
    if (source) return source
  }
  let state = event.destination.getState()
  if (traverse && !isRuntimeNavigation(state)) {
    // Safari sometimes exposes traversal state only on the matching history entry.
    state = navigation
      .entries()
      .find((entry) => entry.key === event.destination.key)
      ?.getState()
  }
  if (isRuntimeNavigation(state)) return { state }
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
    if (
      linkElement.matches('[data-rmx-document],[download],[referrerpolicy]') ||
      hasNoReferrer(linkElement)
    )
      return

    return {
      ...getElementNavigation(linkElement, event, false),
      source:
        linkElement instanceof HTMLAnchorElement ||
        linkElement instanceof HTMLAreaElement ||
        linkElement instanceof SVGAElement
          ? { element: linkElement }
          : undefined,
    }
  }

  let formNavigation = resolveFormNavigation(event)
  if (
    !formNavigation ||
    formNavigation.hasAttribute('data-rmx-document') ||
    hasNoReferrer(formNavigation.form)
  )
    return

  let replaceHistoryByDefault =
    formNavigation.getSubmission !== undefined &&
    event.destination.url === navigation.currentEntry?.url

  return {
    ...getElementNavigation(formNavigation, event, replaceHistoryByDefault),
    source: {
      element: formNavigation.form,
      form: formNavigation.form,
      submitter: formNavigation.submitter,
      submission: formNavigation.submission,
    },
    getSubmission: formNavigation.getSubmission,
  }
}

export function hasNoReferrer(element: Element): boolean {
  // A form control named getAttribute can shadow the method on its form.
  let rel = Element.prototype.getAttribute.call(element, 'rel')
  return (
    rel !== null &&
    rel
      .toLowerCase()
      .split(/[\t\n\f\r ]+/)
      .includes('noreferrer')
  )
}

function getElementNavigation(
  element: { getAttribute(name: string): string | null },
  event: NavigateEvent,
  replaceHistoryByDefault: boolean,
): RuntimeNavigation {
  return {
    state: {
      target: element.getAttribute('data-rmx-target') ?? undefined,
      src: element.getAttribute('data-rmx-src') ?? event.destination.url,
      resetScroll: normalizeResetBehavior(element.getAttribute('data-rmx-reset-scroll')),
      resetFocus: normalizeResetBehavior(element.getAttribute('data-rmx-reset-focus')),
      $rmx: true,
    },
    replaceHistory: getReplaceHistory(
      element.getAttribute('data-rmx-history'),
      replaceHistoryByDefault,
    ),
  }
}

function normalizeResetBehavior(
  value: string | boolean | null | undefined,
): 'after-transition' | 'manual' {
  return value === false || value === 'false' || value === 'manual' ? 'manual' : 'after-transition'
}

function getReplaceHistory(value: string | null, defaultValue: boolean): boolean {
  if (value === 'replace') return true
  if (value === 'push') return false
  return defaultValue
}

declare global {
  interface GlobalEventHandlersEventMap {
    'rmx:navigation': NavigationEvent
  }
}
