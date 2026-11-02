import {
  getNamedFrame,
  getTopFrame,
  isDocumentReload,
  reloadCurrentDocument,
  reloadFrameForNavigation,
} from './frame.ts'
import { createFormNavigationResolver, getFormSubmit, type FormSubmission } from './form-navigation.ts'
import type { FrameNavigationOptions } from './frame-runtime.ts'
import type { FrameHandle } from './component.ts'

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
  element: Element
  form?: HTMLFormElement
}

type HistoryBehavior = NonNullable<NavigationOptions['history']>

type RuntimeNavigation = {
  state: NavigationState
  source?: NavigationSource
  getSubmission?: () => Promise<FormSubmission>
  history?: HistoryBehavior
}

interface FormSubmissionNavigationInfo {
  type: typeof formSubmissionNavigationInfoType
  state: NavigationState
  frame: FrameHandle
  // The replacement navigation has no source element of its own.
  source: NavigationSource | undefined
  getSubmission(): Promise<FormSubmission>
}

// A link or GET form navigation that started again to replace the current history entry.
interface HistoryReplacementNavigationInfo {
  type: typeof historyReplacementNavigationInfoType
  // The replacement navigation has no source element of its own.
  source: NavigationSource | undefined
}

interface FrameRedirectNavigationInfo {
  type: typeof frameRedirectNavigationInfoType
  resetScroll: NonNullable<NavigationInterceptOptions['scroll']>
  resetFocus: NonNullable<NavigationInterceptOptions['focusReset']>
}

const formSubmissionNavigationInfoType = Symbol('frame-form-submission')
const historyReplacementNavigationInfoType = Symbol('frame-history-replacement')
const frameRedirectNavigationInfoType = 'frame-redirect'

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
  let userAgent = navigator.userAgent
  if (!userAgent.includes('AppleWebKit') || isChromiumUserAgent(userAgent)) return
  if (!resetScroll || (event.navigationType !== 'push' && event.navigationType !== 'replace'))
    return
  if (new URL(event.destination.url).hash) return

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
  function undoRestoration() {
    rememberBottom()
    let y = window.scrollY
    if (y === 0) return
    for (let position of restoredPositions) {
      if (Math.abs(y - position) < 1) {
        return window.scrollTo({ behavior: 'instant', left: 0, top: 0 })
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
    if (event.signal.aborted || window.scrollX !== 0 || window.scrollY !== 0) return
    window.scrollTo({ behavior: 'instant', left: 0, top: 1 })
    requestAnimationFrame(() => {
      if (event.signal.aborted || window.scrollX !== 0 || window.scrollY !== 1) return
      window.scrollTo({ behavior: 'instant', left: 0, top: 0 })
    })
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
  /**
   * How the destination updates browser history. `none` loads the mounted named `target` in place,
   * without changing the URL or history, resetting scroll or focus, or reloading the top frame. The
   * frame's `src` follows a redirect. Navigations without a `target` ignore `none`, since the page
   * has to match its URL.
   */
  history?: 'push' | 'replace' | 'none'
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

  let history = options?.history
  if (history === 'none') {
    let frame = state.target === undefined ? undefined : getNamedFrame(state.target)
    if (frame && isSameOriginUrl(state.src)) {
      return loadFrameInPlace(frame, state.src, reloadFrameForNavigation)
    }
    // Without a mounted target, the navigation goes ahead as it would without `none`.
    history = undefined
  }

  let transition = navigation.navigate(href, { state, history })
  await transition.finished
}

// Loads a named frame outside the Navigation API, so the URL, history, scroll and focus stay as
// they are. The frame's next reload loads where this one ended, as an iframe's would.
async function loadFrameInPlace(
  frame: FrameHandle,
  src: string,
  reloadFrame: typeof reloadFrameForNavigation,
  reloadOptions?: FrameNavigationOptions,
): Promise<void> {
  frame.src = src
  let reload = reloadFrame(frame, reloadOptions)
  // A failure rejects both promises, and only `finished` is awaited here.
  void reload.committed.catch(() => {})
  let { redirectedTo } = await reload.finished
  if (redirectedTo && !reload.signal.aborted) frame.src = redirectedTo
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
  let navigation = getInterceptableNavigation()
  if (!navigation) return
  let resolveFormNavigation = createFormNavigationResolver(signal)
  // Hash changes abort the previous navigation before this listener runs. Keep unfinished frame
  // work pending across aborts so the next navigation can finish loading the destination.
  let needsFrameReload = false

  navigation.updateCurrentEntry({
    state: {
      target: undefined,
      src: window.location.href,
      resetScroll: 'after-transition',
      resetFocus: 'after-transition',
      $rmx: true,
    },
  })

  // A form that loads its frame in place never navigates, so it starts at `submit`, before the
  // browser plans a navigation. Cancelling that navigation's `navigate` event instead leaves
  // Chromium's planned form navigation for tools such as Playwright to wait on. Listening after the
  // app's own `submit` listeners leaves any submission they cancel alone.
  document.addEventListener(
    'submit',
    (event) => {
      if (event.defaultPrevented) return
      let submit = getFormSubmit(event)
      if (
        !submit ||
        submit.hasAttribute('data-rmx-document') ||
        submit.getAttribute('data-rmx-history') !== 'none'
      ) {
        return
      }
      let target = submit.getAttribute('data-rmx-target')
      let frame = target == null ? undefined : options.getNamedFrame(target)
      if (!frame) return

      // Reading the entries fires `formdata`, so only a submission that loads in place reads them.
      let { url, submission } = submit.read()
      let src = submit.getAttribute('data-rmx-src') ?? url
      // A submission elsewhere goes ahead, and its navigation falls back to a document load.
      if (!isSameOriginUrl(url) || !isSameOriginUrl(src)) return

      event.preventDefault()
      void loadFrameInPlace(frame, src, options.reloadFrame, {
        ...submission,
        sourceElement: submit.sourceElement,
        form: submit.form,
      }).catch(() => {})
    },
    { signal },
  )

  navigation.addEventListener(
    'navigate',
    (event) => {
      if (
        isDocumentReload(event.info) ||
        (event.hashChange && !needsFrameReload) ||
        event.downloadRequest != null ||
        !event.canIntercept ||
        // Safari seems to incorrectly set canIntercept to true for sub-domain navigations, so
        // we do an origin check ourselves. The spec is clear that a different host should prevent
        // interception so this is likely a bug in Safari:
        // https://html.spec.whatwg.org/multipage/nav-history-apis.html#can-have-its-url-rewritten
        !isSameOriginUrl(event.destination.url)
      ) {
        return
      }

      if (isFrameRedirectNavigationInfo(event.info)) {
        interceptNavigation(navigation, event, event.info.resetScroll !== 'manual', {
          async handler() {},
          scroll: 'manual',
          focusReset: event.info.resetFocus,
        })
        return
      }

      let replayedSubmission = isFormSubmissionNavigationInfo(event.info) ? event.info : undefined
      let historyReplacement = isHistoryReplacementNavigationInfo(event.info)
        ? event.info
        : undefined
      let runtimeNavigation = replayedSubmission
        ? {
            state: replayedSubmission.state,
            getSubmission: replayedSubmission.getSubmission,
          }
        : getRuntimeNavigation(navigation, event, resolveFormNavigation)
      if (!runtimeNavigation) return
      let { state } = runtimeNavigation
      let isTraverse = event.navigationType === 'traverse'
      let scroll = isTraverse ? 'after-transition' : normalizeResetBehavior(state.resetScroll)
      let focusReset = isTraverse ? 'after-transition' : normalizeResetBehavior(state.resetFocus)
      if (!isSameOriginUrl(state.src)) {
        fallbackToDocumentNavigation(navigation, event)
        return
      }

      let topFrame = options.getTopFrame()
      let frame = replayedSubmission?.frame
      let source = (replayedSubmission ?? historyReplacement)?.source ?? runtimeNavigation.source
      if (!frame) {
        if (state.target) {
          frame = options.getNamedFrame(state.target)
          if (!frame) {
            fallbackToDocumentNavigation(navigation, event)
            return
          }
        } else {
          frame = topFrame
        }
      }

      // Links, and forms submitted without a `submit` event, such as by `form.submit()`.
      if (runtimeNavigation.history === 'none' && event.cancelable) {
        event.preventDefault()
        // The frame reports a failure to the app's error listeners and to its reload's `finished`.
        void (async () => {
          let submission = await runtimeNavigation.getSubmission?.()
          await loadFrameInPlace(frame, state.src, options.reloadFrame, {
            ...submission,
            sourceElement: source?.element,
            form: source?.form,
          })
        })().catch(() => {})
        return
      }

      needsFrameReload = true
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
          sourceElement: source?.element,
          form: source?.form,
          signal: event.signal,
        })
        await reload.committed
        if (event.signal.aborted || reload.signal.aborted) return
        if (scroll !== 'manual') {
          // WebKit restores a traversal's position against the layout from before the commit, so
          // it clamps the position to the old page's height. Reading the height lays out the new
          // content first.
          document.documentElement.scrollHeight
          event.scroll()
          webKitScrollResets.get(event)?.()
        }

        let { redirectedTo } = await reload.finished
        if (event.signal.aborted || reload.signal.aborted) return
        needsFrameReload = false

        if (redirectedTo && frame === topFrame) {
          frame.src = redirectedTo
          // Start the successor navigation without awaiting it: this handler must settle before
          // the replacement navigation can finish.
          navigation.navigate(redirectedTo, {
            history: 'replace',
            state: { ...state, src: redirectedTo },
            info: {
              type: frameRedirectNavigationInfoType,
              resetScroll: scroll,
              resetFocus: focusReset,
            } satisfies FrameRedirectNavigationInfo,
          })
        }
      }

      let interceptOptions = {
        handler,
        scroll,
        focusReset,
      } satisfies NavigationInterceptOptions

      if (runtimeNavigation.getSubmission) {
        // <form method="post"> navigations
        if (runtimeNavigation.history === 'replace' && replayedSubmission == null) {
          let supportsPrecommit =
            typeof Reflect.get(window, 'NavigationPrecommitController') === 'function'

          // Modern browsers allow you to update the in-flight navigation entry before it's committed
          if (supportsPrecommit) {
            interceptNavigation(navigation, event, scroll !== 'manual', {
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
                frame,
                source,
                getSubmission: runtimeNavigation.getSubmission,
              } satisfies FormSubmissionNavigationInfo,
            })
            return
          }
        }

        interceptNavigation(navigation, event, scroll !== 'manual', interceptOptions)
      } else {
        // <a>/<form method="get"> navigations
        if (runtimeNavigation.history === 'replace' && event.cancelable) {
          event.preventDefault()
          navigation.navigate(event.destination.url, {
            history: 'replace',
            state,
            info: {
              type: historyReplacementNavigationInfoType,
              source,
            } satisfies HistoryReplacementNavigationInfo,
          })
        } else {
          interceptNavigation(navigation, event, scroll !== 'manual', interceptOptions)
        }
      }
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null
}

function isRuntimeNavigation(info: unknown): info is NavigationState {
  return isObject(info) && '$rmx' in info
}

function isFormSubmissionNavigationInfo(value: unknown): value is FormSubmissionNavigationInfo {
  return (
    isObject(value) &&
    value.type === formSubmissionNavigationInfoType &&
    isRuntimeNavigation(value.state) &&
    'frame' in value &&
    typeof value.getSubmission === 'function'
  )
}

function isHistoryReplacementNavigationInfo(
  value: unknown,
): value is HistoryReplacementNavigationInfo {
  return (
    typeof value === 'object' &&
    value != null &&
    'type' in value &&
    value.type === historyReplacementNavigationInfoType
  )
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

export function getSameOriginUrl(src: string): URL | undefined {
  try {
    let url = new URL(src, document.baseURI)
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
        keepFocusAfterFailure(navigation, event)
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
// runs before the transition's `finished` rejects, so focus goes back to where it was at the
// failure. When focus moved during the navigation, the browser skips the reset and this changes
// nothing. A navigation that a newer one replaced leaves focus to that one: moving focus during it
// would also cancel its own reset. The check comes first, since the browser aborts the signal of a
// failed navigation too.
function keepFocusAfterFailure(navigation: Navigation, event: NavigateEvent): void {
  let focused = document.activeElement
  if (event.signal.aborted || focused === document.body) return
  if (!(focused instanceof HTMLElement || focused instanceof SVGElement)) return
  navigation.transition?.finished.catch(() => {
    if (focused.isConnected && document.activeElement !== focused) {
      focused.focus({ preventScroll: true })
    }
  })
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

  if (event.navigationType !== 'push' && event.navigationType !== 'replace') return
  if (new URL(event.destination.url).hash) return
  if (!isChromiumUserAgent(navigator.userAgent)) return

  // Chromium can treat reconciliation-driven scroll anchoring as user scrolling and preserve an
  // offset after NavigateEvent.scroll() resets the destination. Suppress anchoring before
  // interception and keep it disabled through the first post-navigation paint.
  return disableScrollAnchoringCssText
}

function isChromiumUserAgent(userAgent: string): boolean {
  return userAgent.includes('Chrome') || userAgent.includes('Chromium')
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
      ...getElementNavigation(linkElement, event, false),
      source: { element: sourceElement },
    }
  }

  let formNavigation = resolveFormNavigation(event)
  if (!formNavigation || formNavigation.hasAttribute('data-rmx-document')) return

  let replaceHistoryByDefault =
    formNavigation.getSubmission !== undefined &&
    event.destination.url === navigation.currentEntry?.url

  return {
    ...getElementNavigation(formNavigation, event, replaceHistoryByDefault),
    source: { element: sourceElement, form: formNavigation.form },
    getSubmission: formNavigation.getSubmission,
  }
}

function getElementNavigation(
  element: { getAttribute(name: string): string | null; hasAttribute(name: string): boolean },
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
    history: getHistoryBehavior(
      element.getAttribute('data-rmx-history'),
      replaceHistoryByDefault ? 'replace' : 'push',
      element.hasAttribute('data-rmx-target'),
    ),
  }
}

function normalizeResetBehavior(
  value: string | boolean | null | undefined,
): 'after-transition' | 'manual' {
  return value === false || value === 'false' || value === 'manual' ? 'manual' : 'after-transition'
}

function getHistoryBehavior(
  value: string | null,
  defaultValue: HistoryBehavior,
  hasTarget: boolean,
): HistoryBehavior {
  if (value === 'push' || value === 'replace') return value
  // Without a frame to load, `none` can't apply, since the page has to match its URL.
  return value === 'none' && hasTarget ? value : defaultValue
}
