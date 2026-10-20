import { getTopFrame, getNamedFrame } from './run.ts'
import { reloadFrameForNavigation } from './frame.ts'
import { createFormNavigationResolver, type FormSubmission } from './form-navigation.ts'
import { isDocumentReload, reloadCurrentDocument } from './document-reload.ts'
import type { FrameHandle } from './component.ts'
import { TypedEventTarget } from './typed-event-target.ts'

type NavigationEntryState = {
  target: string | undefined
  src: string
  resetScroll?: NavigationOptions['resetScroll']
  resetFocus?: NavigationOptions['resetFocus']
  $rmx: true
}

type SourceElementNavigateEvent = NavigateEvent & {
  sourceElement?: Element | null
}

type RuntimeNavigation = {
  state: NavigationEntryState
  getSubmission?: () => Promise<FormSubmission>
  submission?: FormSubmission
  replaceHistory?: boolean
}

interface FormSubmissionNavigationInfo {
  type: typeof formSubmissionNavigationInfoType
  state: NavigationEntryState
  frame: FrameHandle
  getSubmission(): Promise<FormSubmission>
  submission: FormSubmission | undefined
}

// Carries a GET form's submission to the replace navigation Remix starts in its place.
interface ReplacedFormNavigationInfo {
  type: typeof replacedFormNavigationInfoType
  submission: FormSubmission
}

interface FrameRedirectNavigationInfo {
  type: typeof frameRedirectNavigationInfoType
  resetScroll: NonNullable<NavigationInterceptOptions['scroll']>
  resetFocus: NonNullable<NavigationInterceptOptions['focusReset']>
}

const formSubmissionNavigationInfoType = Symbol('frame-form-submission')
const replacedFormNavigationInfoType = Symbol('replaced-form-navigation')
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
  /**
   * Whether to reload frame content. Set to `false` to update the browser URL and history without
   * fetching or rendering anything, leaving scroll position and focus untouched. `src`, `target`,
   * `resetScroll`, and `resetFocus` are ignored. Back and forward traversal to the new entry
   * reloads the top frame like any other entry. Without frame navigation, `history: 'replace'`
   * replaces the URL in place, and other updates fall back to document navigation like other
   * `navigate()` calls. If a frame navigation is still loading,
   * the top frame reloads instead, so await `navigation.settled()` first. (default: `true`)
   */
  reload?: boolean
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
  } satisfies NavigationEntryState
  let navigation = getInterceptableNavigation()
  if (!navigation) {
    // Remix keeps no state on history entries here, and replacing adds no entry to go back to, so
    // only the URL needs to change. A pushed entry would change the URL on back without rendering.
    if (options?.reload === false && options.history === 'replace' && isSameOriginUrl(href)) {
      window.history.replaceState(window.history.state, '', href)
    } else if (options?.history === 'replace') {
      window.location.replace(href)
    } else {
      window.location.assign(href)
    }
    return
  }

  if (options?.reload === false) {
    let transition = navigation.navigate(href, {
      state: { ...state, target: undefined, src: href },
      history: options.history,
      info: {
        type: frameRedirectNavigationInfoType,
        resetScroll: 'manual',
        resetFocus: 'manual',
      } satisfies FrameRedirectNavigationInfo,
    })
    await transition.finished
    return
  }

  let transition = navigation.navigate(href, { state, history: options?.history })
  await transition.finished
}

/**
 * The form submission that started a navigation.
 */
export interface NavigationSubmission {
  /** Upper-case form method, including submitter overrides, such as `"POST"`. */
  readonly method: string
  /** Form encoding type, including submitter overrides. */
  readonly encType: string
  /** Submitted entries for non-GET submissions. GET submissions encode their values in the URL. */
  readonly formData: FormData | undefined
}

/**
 * A frame navigation the Remix runtime is handling.
 */
export interface PendingNavigation {
  /** Destination URL. Changes to the final URL when the top frame follows a redirect. */
  readonly url: string
  /** How the navigation changes history. A redirect doesn't change it. */
  readonly type: 'push' | 'replace' | 'reload' | 'traverse'
  /** Named frame the navigation loads, or `undefined` for the top frame. */
  readonly target: string | undefined
  /** Form submission that started the navigation, or `undefined` for links and `navigate()`. */
  readonly submission: NavigationSubmission | undefined
  /** Aborted when another navigation replaces this one, or when it fails. */
  readonly signal: AbortSignal
}

/**
 * Events dispatched by {@link navigation}.
 */
export type NavigationEventMap = {
  /** `navigation.current` started, changed, or ended. */
  change: Event
}

/**
 * Client-side frame navigation state for the Remix runtime.
 */
export interface NavigationState extends TypedEventTarget<NavigationEventMap> {
  /**
   * Whether the Remix runtime handles links, forms, and `navigate()` as frame navigations in this
   * browser. Without the Navigation API and `NavigateEvent.sourceElement`, they load documents
   * instead. Always `false` on the server.
   */
  readonly supported: boolean
  /**
   * The frame navigation Remix is handling, or `null`. It's set as soon as Remix intercepts a
   * navigation, so later `navigate` listeners see it, and stays the same object through frame
   * redirects. URL updates with `reload: false`, frame reloads, and document navigations aren't
   * frame navigations, so they don't appear here.
   */
  readonly current: PendingNavigation | null
  /**
   * Waits until no navigation is in progress. By then, Remix has rendered the destination,
   * followed any frame redirect, and reset or restored scroll and focus. If another navigation
   * starts while waiting, this waits for that one too. It also waits for navigations other code
   * intercepts, since changing the URL would interrupt those as well.
   *
   * Components rendered by a navigation can run their queued tasks before the navigation
   * finishes. Changing the URL from one of those tasks interrupts the navigation before it resets
   * scroll and focus, so wait for this first.
   *
   * @returns A promise that resolves once no navigation is in progress. It resolves right away when
   * nothing is navigating, frame navigation is unsupported, or on the server, and it never rejects.
   */
  settled(): Promise<void>
}

type ActiveNavigation = {
  pending: PendingNavigation
  url: string
  controller: AbortController
  // The event, transition, or redirect navigation whose outcome ends this navigation.
  following: object
}

let activeNavigation: ActiveNavigation | undefined

class FrameNavigationState extends TypedEventTarget<NavigationEventMap> implements NavigationState {
  get supported() {
    return typeof window !== 'undefined' && getInterceptableNavigation() !== undefined
  }

  get current() {
    return activeNavigation?.pending ?? null
  }

  async settled() {
    let browserNavigation = typeof window === 'undefined' ? undefined : getInterceptableNavigation()
    if (!browserNavigation) return

    // A navigation can start another before it finishes, as frame redirects and POST replays do,
    // so keep waiting until none is in progress.
    while (true) {
      if (activeNavigation) {
        await new Promise((resolve) =>
          navigation.addEventListener('change', resolve, { once: true }),
        )
        continue
      }
      let transition = browserNavigation.transition
      if (!transition) return
      await transition.finished.catch(() => {})
      if (!activeNavigation && browserNavigation.transition === transition) return
    }
  }
}

/**
 * Client-side frame navigation state for the Remix runtime: whether frame navigation is supported,
 * the navigation in progress, and a way to wait for it to finish.
 */
export const navigation: NavigationState = new FrameNavigationState()

function startActiveNavigation(
  event: NavigateEvent,
  type: PendingNavigation['type'],
  target: string | undefined,
  submission: FormSubmission | undefined,
): ActiveNavigation {
  let controller = new AbortController()
  let active: ActiveNavigation = {
    url: event.destination.url,
    controller,
    following: event,
    pending: {
      get url() {
        return active.url
      },
      type,
      target,
      submission,
      signal: controller.signal,
    },
  }
  let previous = activeNavigation
  activeNavigation = active
  previous?.controller.abort()
  followActiveNavigation(
    active,
    event,
    new Promise((_, reject) => event.signal.addEventListener('abort', reject, { once: true })),
  )
  dispatchNavigationChange()
  return active
}

function followActiveNavigation(active: ActiveNavigation, token: object, done: Promise<unknown>) {
  active.following = token
  done.then(
    () => endActiveNavigation(active, token, true),
    () => endActiveNavigation(active, token, false),
  )
}

function endActiveNavigation(active: ActiveNavigation, token: object, completed: boolean) {
  if (activeNavigation !== active || active.following !== token) return
  activeNavigation = undefined
  if (!completed) active.controller.abort()
  dispatchNavigationChange()
}

function dispatchNavigationChange() {
  navigation.dispatchEvent(new Event('change'))
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

  signal.addEventListener(
    'abort',
    () => {
      if (activeNavigation) endActiveNavigation(activeNavigation, activeNavigation.following, false)
    },
    { once: true },
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

      // Like hash changes, a URL-only navigate() that interrupts frame work falls through to a
      // top-frame reload so the page content still matches the URL.
      if (isFrameRedirectNavigationInfo(event.info) && !needsFrameReload) {
        interceptNavigation(navigation, event, event.info.resetScroll !== 'manual', {
          async handler() {},
          scroll: 'manual',
          focusReset: event.info.resetFocus,
        })
        return
      }

      let replayedSubmission = isFormSubmissionNavigationInfo(event.info) ? event.info : undefined
      let runtimeNavigation: RuntimeNavigation | undefined = replayedSubmission
        ? {
            state: replayedSubmission.state,
            getSubmission: replayedSubmission.getSubmission,
            submission: replayedSubmission.submission,
          }
        : getRuntimeNavigation(navigation, event, resolveFormNavigation)
      if (!runtimeNavigation) return
      let { state } = runtimeNavigation
      let submission =
        runtimeNavigation.submission ??
        (isReplacedFormNavigationInfo(event.info) ? event.info.submission : undefined)
      let isTraverse = event.navigationType === 'traverse'
      let scroll = isTraverse ? 'after-transition' : normalizeResetBehavior(state.resetScroll)
      let focusReset = isTraverse ? 'after-transition' : normalizeResetBehavior(state.resetFocus)
      if (!isSameOriginUrl(state.src)) {
        fallbackToDocumentNavigation(navigation, event)
        return
      }

      let topFrame = options.getTopFrame()
      let frame = replayedSubmission?.frame
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

      needsFrameReload = true
      let active: ActiveNavigation | undefined
      let interceptFrameNavigation = (
        interceptOptions: NavigationInterceptOptions,
        type: PendingNavigation['type'] = event.navigationType,
      ) => {
        interceptNavigation(
          navigation,
          event,
          scroll !== 'manual',
          interceptOptions,
          (transition) => {
            if (active) followActiveNavigation(active, transition, transition.finished)
          },
        )
        let target = frame === topFrame ? undefined : state.target
        active = startActiveNavigation(event, type, target, submission)
      }

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
        if (scroll !== 'manual') {
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
          let redirect = navigation.navigate(redirectedTo, {
            history: 'replace',
            state: { ...state, src: redirectedTo },
            info: {
              type: frameRedirectNavigationInfoType,
              resetScroll: scroll,
              resetFocus: focusReset,
            } satisfies FrameRedirectNavigationInfo,
          })
          // The redirect aborts this navigation's transition, but the navigation carries on as the
          // redirect until it finishes.
          if (active) {
            followActiveNavigation(active, redirect, redirect.finished ?? Promise.resolve())
            active.url = redirectedTo
            dispatchNavigationChange()
          }
        }
      }

      let interceptOptions = {
        handler,
        scroll,
        focusReset,
      } satisfies NavigationInterceptOptions

      if (runtimeNavigation.getSubmission) {
        // <form method="post"> navigations
        if (runtimeNavigation.replaceHistory && replayedSubmission == null) {
          let supportsPrecommit =
            typeof Reflect.get(window, 'NavigationPrecommitController') === 'function'

          // Modern browsers allow you to update the in-flight navigation entry before it's committed
          if (supportsPrecommit) {
            interceptFrameNavigation(
              {
                ...interceptOptions,
                precommitHandler(controller) {
                  controller.redirect(event.destination.url, { history: 'replace' })
                },
              },
              'replace',
            )
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
                getSubmission: runtimeNavigation.getSubmission,
                submission,
              } satisfies FormSubmissionNavigationInfo,
            })
            return
          }
        }

        interceptFrameNavigation(interceptOptions)
      } else {
        // <a>/<form method="get"> navigations
        if (runtimeNavigation.replaceHistory && event.cancelable) {
          event.preventDefault()
          navigation.navigate(event.destination.url, {
            history: 'replace',
            state,
            info: submission
              ? ({
                  type: replacedFormNavigationInfoType,
                  submission,
                } satisfies ReplacedFormNavigationInfo)
              : undefined,
          })
        } else {
          interceptFrameNavigation(interceptOptions)
        }
      }
    },
    { signal },
  )
}

function getInterceptableNavigation(): Navigation | undefined {
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

function isRuntimeNavigation(info: unknown): info is NavigationEntryState {
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
    'frame' in value &&
    'getSubmission' in value &&
    typeof value.getSubmission === 'function'
  )
}

function isReplacedFormNavigationInfo(value: unknown): value is ReplacedFormNavigationInfo {
  return (
    typeof value === 'object' &&
    value != null &&
    'type' in value &&
    value.type === replacedFormNavigationInfoType &&
    'submission' in value
  )
}

function isFrameRedirectNavigationInfo(value: unknown): value is FrameRedirectNavigationInfo {
  return (
    typeof value === 'object' &&
    value != null &&
    'type' in value &&
    value.type === frameRedirectNavigationInfoType &&
    'resetScroll' in value &&
    (value.resetScroll === 'after-transition' || value.resetScroll === 'manual') &&
    'resetFocus' in value &&
    (value.resetFocus === 'after-transition' || value.resetFocus === 'manual')
  )
}

function isSameOriginUrl(src: string): boolean {
  try {
    return new URL(src, document.baseURI).origin === window.location.origin
  } catch {
    return false
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
  onTransition?: (transition: NavigationTransition) => void,
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
    onTransition?.(transition)

    resyncWebKitScrollAfterNavigation(navigation, event, resetScroll, transition)
    if (scrollStyleWorkarounds) scheduleNavigationScrollCleanup(transition, scrollStyleWorkarounds)
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

const disableScrollAnchoringCssText = `
  html,
  body {
    overflow-anchor: none !important;
  }
`

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
    return `
      html {
        min-height: ${scrollHeight + clientHeight}px !important;
        overflow-anchor: none !important;
      }

      body {
        overflow-anchor: none !important;
      }
    `
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
): NavigationEntryState | undefined {
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
        resetScroll: normalizeResetBehavior(linkElement.getAttribute('data-rmx-reset-scroll')),
        resetFocus: normalizeResetBehavior(linkElement.getAttribute('data-rmx-reset-focus')),
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
      resetScroll: normalizeResetBehavior(formNavigation.getAttribute('data-rmx-reset-scroll')),
      resetFocus: normalizeResetBehavior(formNavigation.getAttribute('data-rmx-reset-focus')),
      $rmx: true,
    },
    replaceHistory: getReplaceHistory(
      formNavigation.getAttribute('data-rmx-history'),
      replaceHistoryByDefault,
    ),
    getSubmission: formNavigation.getSubmission,
    submission: formNavigation.submission,
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
