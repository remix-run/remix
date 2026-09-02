import { expect } from '@remix-run/assert'
import { afterEach, describe, it, mock, type TestContext } from '@remix-run/test'
import {
  navigate,
  startNavigationListener,
  startNavigationListenerImpl,
} from '../runtime/navigation.ts'
import type { FrameHandle } from '../runtime/component.ts'
import type { ResolveFrameOptions } from '../runtime/frame.ts'
import { withResolvers } from './utils.ts'

type StubFrameReloadResult = { signal: AbortSignal; redirectedTo?: string }

function createReloadTransition(result: StubFrameReloadResult | Promise<StubFrameReloadResult>) {
  let finished = Promise.resolve(result)
  return { committed: finished.then(() => {}), finished }
}

// Stand-in frame the navigation handler can call without dragging in the
// full app runtime from ./run.ts. Only `src` and `reload` are touched on
// the path under test.
const stubFrame = {
  src: '',
  reload: async () => new AbortController().signal,
} as unknown as FrameHandle

const stubFrames = {
  getTopFrame: () => stubFrame,
  getNamedFrame: () => stubFrame,
  reloadFrame: (frame: FrameHandle) =>
    createReloadTransition(frame.reload().then((signal) => ({ signal }))),
}

function stubGlobalMethod(t: TestContext, api: string, method: string, impl: any) {
  return t.mock.method((globalThis as any)[api], method, impl)
}

// Replaces a property on `globalThis` and returns a function that restores the
// previous value. Used for tests that swap `navigation` for a fake instance.
function stubGlobalField(t: TestContext, name: string, value: unknown): void {
  let key = name as keyof typeof globalThis
  let hadOwn = Object.prototype.hasOwnProperty.call(globalThis, name)
  let previous = (globalThis as any)[key]
  ;(globalThis as any)[key] = value
  t.after(() => {
    if (hadOwn) (globalThis as any)[key] = previous
    else delete (globalThis as any)[key]
  })
}

function stubNavigatorUserAgent(t: TestContext, userAgent: string): void {
  let descriptor = Object.getOwnPropertyDescriptor(navigator, 'userAgent')
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: userAgent })
  t.after(() => {
    if (descriptor) Object.defineProperty(navigator, 'userAgent', descriptor)
    else Reflect.deleteProperty(navigator, 'userAgent')
  })
}

function stubWindowScrollPosition(t: TestContext) {
  let x = 0
  let y = 0
  let scrollXDescriptor = Object.getOwnPropertyDescriptor(window, 'scrollX')
  let scrollYDescriptor = Object.getOwnPropertyDescriptor(window, 'scrollY')
  Object.defineProperties(window, {
    scrollX: { configurable: true, get: () => x },
    scrollY: { configurable: true, get: () => y },
  })
  t.after(() => {
    if (scrollXDescriptor) Object.defineProperty(window, 'scrollX', scrollXDescriptor)
    else Reflect.deleteProperty(window, 'scrollX')
    if (scrollYDescriptor) Object.defineProperty(window, 'scrollY', scrollYDescriptor)
    else Reflect.deleteProperty(window, 'scrollY')
  })

  return (xPosition: number, yPosition: number) => {
    x = xPosition
    y = yPosition
  }
}

function stubDocumentReadyState(t: TestContext, readyState: DocumentReadyState): void {
  let descriptor = Object.getOwnPropertyDescriptor(document, 'readyState')
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => readyState })
  t.after(() => {
    if (descriptor) Object.defineProperty(document, 'readyState', descriptor)
    else Reflect.deleteProperty(document, 'readyState')
  })
}

// Restores `history.scrollRestoration` after tests that let the runtime toggle it.
function trackScrollRestoration(t: TestContext): void {
  let initial = history.scrollRestoration
  t.after(() => {
    history.scrollRestoration = initial
  })
}

function stubAnimationFrames(t: TestContext): () => void {
  let callbacks: FrameRequestCallback[] = []
  t.mock.method(window, 'requestAnimationFrame', (callback: FrameRequestCallback) => {
    callbacks.push(callback)
    return callbacks.length
  })
  return () => {
    let pending = callbacks.splice(0)
    for (let callback of pending) callback(performance.now())
  }
}

type StubNavigationTransition = {
  runHandler(): Promise<void>
  succeed(): Promise<void>
  fail(error?: Error): Promise<void>
}

// Dispatches a navigate event through the runtime listener and returns a handle for the
// interception it produces. `navigation.transition` is set while the event is intercepted, the
// way the browser does before it runs interception handlers.
function startStubNavigationListener(
  t: TestContext,
  frames: Parameters<typeof startNavigationListenerImpl>[1] = stubFrames,
  controller = new AbortController(),
): (event: Event) => StubNavigationTransition {
  let stubNavigation = Object.assign(new EventTarget(), {
    updateCurrentEntry: mock.fn(),
    transition: null as NavigationTransition | null,
  })
  stubGlobalField(t, 'navigation', stubNavigation)

  startNavigationListenerImpl(controller.signal, frames)
  t.after(() => controller.abort())

  return (event) => {
    let intercept = Reflect.get(event, 'intercept')
    if (typeof intercept !== 'function') throw new Error('Expected an intercept method')

    let [finished, resolveFinished, rejectFinished] = withResolvers<void>()
    let transition = { finished } as NavigationTransition
    let interceptOptions: NavigationInterceptOptions | undefined
    Reflect.set(event, 'intercept', (options?: NavigationInterceptOptions) => {
      stubNavigation.transition = transition
      interceptOptions = options
      intercept.call(event, options)
    })
    stubNavigation.dispatchEvent(event)

    let clearTransition = () => {
      if (stubNavigation.transition === transition) stubNavigation.transition = null
    }

    return {
      async runHandler() {
        await interceptOptions?.handler?.()
      },
      async succeed() {
        resolveFinished()
        await finished
        clearTransition()
      },
      async fail(error = new Error('Navigation failed')) {
        rejectFinished(error)
        await finished.catch(() => {})
        clearTransition()
      },
    }
  }
}

describe('navigate', () => {
  afterEach(() => {
    document.body.textContent = ''
  })

  it('passes runtime state via navigate history state', async (t) => {
    let navigateMock = stubGlobalMethod(t, 'navigation', 'navigate', () => ({
      finished: Promise.resolve(),
    }))

    await navigate('/login', {
      src: '/partials/login',
      target: 'auth',
      history: 'replace',
    })

    expect(navigateMock).toHaveBeenCalledWith('/login', {
      state: { target: 'auth', src: '/partials/login', resetScroll: true, $rmx: true },
      history: 'replace',
    })
  })

  it('passes resetScroll=false when requested', async (t) => {
    let navigateMock = stubGlobalMethod(t, 'navigation', 'navigate', () => ({
      finished: Promise.resolve(),
    }))

    await navigate('/login', {
      resetScroll: false,
    })

    expect(navigateMock).toHaveBeenCalledWith('/login', {
      state: { target: undefined, src: '/login', resetScroll: false, $rmx: true },
      history: undefined,
    })
  })

  it('falls back to document navigation when the Navigation API is unavailable', async (t) => {
    let originalUrl = window.location.href
    let destination = new URL(originalUrl)
    destination.hash = 'document-navigation-fallback'
    let originalHistoryLength = window.history.length
    stubGlobalField(t, 'navigation', undefined)

    try {
      await navigate(destination.href)
      expect(window.location.href).toBe(destination.href)
      expect(window.history.length).toBe(originalHistoryLength + 1)
    } finally {
      let wentBack = new Promise<void>((resolve) => {
        window.addEventListener('popstate', () => resolve(), { once: true })
      })
      window.history.back()
      await wentBack

      let wentForward = new Promise<void>((resolve) => {
        window.addEventListener('popstate', () => resolve(), { once: true })
      })
      window.history.forward()
      await wentForward
      window.history.replaceState(window.history.state, '', originalUrl)
    }
  })

  it('replaces document history when the Navigation API is unavailable', async (t) => {
    let originalUrl = window.location.href
    let destination = new URL(originalUrl)
    destination.hash = 'replace-document-navigation-fallback'
    let originalHistoryLength = window.history.length
    stubGlobalField(t, 'navigation', undefined)

    try {
      await navigate(destination.href, { history: 'replace' })
      expect(window.location.href).toBe(destination.href)
      expect(window.history.length).toBe(originalHistoryLength)
    } finally {
      window.history.replaceState(window.history.state, '', originalUrl)
    }
  })

  it('skips navigation listeners when the Navigation API is unavailable', (t) => {
    stubGlobalField(t, 'navigation', undefined)
    let addDocumentListener = t.mock.method(document, 'addEventListener')
    let controller = new AbortController()

    startNavigationListener(controller.signal)

    expect(addDocumentListener).not.toHaveBeenCalled()
    controller.abort()
  })

  it('uses browser scrolling after the frame content commits', async (t) => {
    let dispatchNavigation = startStubNavigationListener(t)
    let scrollTo = t.mock.method(window, 'scrollTo', () => {})
    let setScrollPosition = stubWindowScrollPosition(t)
    setScrollPosition(0, 200)
    let anchor = document.createElement('a')
    anchor.href = '/login'
    let scroll = mock.fn(() => setScrollPosition(0, 0))
    let intercept = mock.fn()

    let transition = dispatchNavigation(
      createAnchorNavigateEvent(anchor, {
        intercept,
        destinationUrl: new URL('/login', window.location.origin).href,
        scroll,
      }),
    )

    expect(intercept.mock.calls[0]?.arguments[0]?.scroll).toBe(undefined)
    await transition.runHandler()
    expect(scroll).toHaveBeenCalledTimes(1)
    await transition.succeed()
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('scrolls to the top when the browser skips the navigation scroll reset', async (t) => {
    let dispatchNavigation = startStubNavigationListener(t)
    let scrollTo = t.mock.method(window, 'scrollTo', () => {})
    let setScrollPosition = stubWindowScrollPosition(t)
    setScrollPosition(0, 200)
    let anchor = document.createElement('a')
    anchor.href = '/login'
    let scroll = mock.fn()

    let transition = dispatchNavigation(
      createAnchorNavigateEvent(anchor, {
        intercept: mock.fn(),
        destinationUrl: new URL('/login', window.location.origin).href,
        scroll,
      }),
    )

    await transition.runHandler()
    expect(scroll).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
    await transition.succeed()
  })

  it('leaves fragment destination scrolling to the browser', async (t) => {
    let dispatchNavigation = startStubNavigationListener(t)
    let scrollTo = t.mock.method(window, 'scrollTo', () => {})
    let setScrollPosition = stubWindowScrollPosition(t)
    setScrollPosition(0, 200)
    let anchor = document.createElement('a')
    anchor.href = '/login#details'
    let scroll = mock.fn()

    let transition = dispatchNavigation(
      createAnchorNavigateEvent(anchor, {
        intercept: mock.fn(),
        destinationUrl: new URL('/login#details', window.location.origin).href,
        scroll,
      }),
    )

    await transition.runHandler()
    expect(scroll).toHaveBeenCalledTimes(1)
    expect(scrollTo).not.toHaveBeenCalled()
    await transition.succeed()
  })

  it('holds scroll restoration until the starting document finishes loading', async (t) => {
    let dispatchNavigation = startStubNavigationListener(t)
    stubDocumentReadyState(t, 'interactive')
    trackScrollRestoration(t)
    let runAnimationFrames = stubAnimationFrames(t)
    let anchor = document.createElement('a')
    anchor.href = '/login'

    let transition = dispatchNavigation(
      createAnchorNavigateEvent(anchor, {
        intercept: mock.fn(),
        destinationUrl: new URL('/login', window.location.origin).href,
      }),
    )
    expect(history.scrollRestoration).toBe('auto')

    await transition.runHandler()
    expect(history.scrollRestoration).toBe('manual')
    await transition.succeed()

    // Chromium runs its final restoration retry right after the load event, so the entry stays
    // opted out until the next frame.
    window.dispatchEvent(new Event('load'))
    expect(history.scrollRestoration).toBe('manual')
    runAnimationFrames()
    expect(history.scrollRestoration).toBe('auto')
  })

  it('leaves scroll restoration alone once the document has loaded', async (t) => {
    let dispatchNavigation = startStubNavigationListener(t)
    trackScrollRestoration(t)
    let anchor = document.createElement('a')
    anchor.href = '/login'

    expect(document.readyState).toBe('complete')
    let transition = dispatchNavigation(
      createAnchorNavigateEvent(anchor, {
        intercept: mock.fn(),
        destinationUrl: new URL('/login', window.location.origin).href,
      }),
    )
    await transition.runHandler()
    await transition.succeed()

    expect(history.scrollRestoration).toBe('auto')
  })

  it('does not override manual scroll restoration chosen by the app', async (t) => {
    let dispatchNavigation = startStubNavigationListener(t)
    stubDocumentReadyState(t, 'interactive')
    trackScrollRestoration(t)
    let runAnimationFrames = stubAnimationFrames(t)
    history.scrollRestoration = 'manual'
    let anchor = document.createElement('a')
    anchor.href = '/login'

    let transition = dispatchNavigation(
      createAnchorNavigateEvent(anchor, {
        intercept: mock.fn(),
        destinationUrl: new URL('/login', window.location.origin).href,
      }),
    )
    await transition.runHandler()
    await transition.succeed()
    window.dispatchEvent(new Event('load'))
    runAnimationFrames()

    expect(history.scrollRestoration).toBe('manual')
  })

  it('hands scroll restoration back to an entry before navigating away from it', async (t) => {
    let dispatchNavigation = startStubNavigationListener(t)
    stubDocumentReadyState(t, 'interactive')
    trackScrollRestoration(t)
    let runAnimationFrames = stubAnimationFrames(t)
    let anchor = document.createElement('a')
    anchor.href = '/login'
    let secondIntercept = mock.fn(
      (_options?: NavigationInterceptOptions) => history.scrollRestoration,
    )

    let firstTransition = dispatchNavigation(
      createAnchorNavigateEvent(anchor, {
        intercept: mock.fn(),
        destinationUrl: new URL('/login', window.location.origin).href,
      }),
    )
    await firstTransition.runHandler()
    expect(history.scrollRestoration).toBe('manual')

    let secondTransition = dispatchNavigation(
      createAnchorNavigateEvent(anchor, {
        intercept: secondIntercept,
        destinationUrl: new URL('/login', window.location.origin).href,
      }),
    )
    // The entry being left is `auto` again by the time the next navigation intercepts.
    expect(secondIntercept.mock.calls[0]?.result).toBe('auto')
    await firstTransition.fail()

    await secondTransition.runHandler()
    expect(history.scrollRestoration).toBe('manual')
    await secondTransition.succeed()

    window.dispatchEvent(new Event('load'))
    runAnimationFrames()
    expect(history.scrollRestoration).toBe('auto')
  })

  it('releases scroll restoration before a non-interceptable navigation', async (t) => {
    let dispatchNavigation = startStubNavigationListener(t)
    stubDocumentReadyState(t, 'interactive')
    trackScrollRestoration(t)
    let anchor = document.createElement('a')
    anchor.href = '/login'

    let transition = dispatchNavigation(
      createAnchorNavigateEvent(anchor, {
        intercept: mock.fn(),
        destinationUrl: new URL('/login', window.location.origin).href,
      }),
    )
    await transition.runHandler()
    expect(history.scrollRestoration).toBe('manual')

    dispatchNavigation(
      Object.assign(new Event('navigate'), {
        canIntercept: false,
        intercept: mock.fn(),
      }),
    )
    expect(history.scrollRestoration).toBe('auto')
    await transition.fail()
  })

  it('releases scroll restoration when the listener stops', async (t) => {
    let controller = new AbortController()
    let dispatchNavigation = startStubNavigationListener(t, stubFrames, controller)
    stubDocumentReadyState(t, 'interactive')
    trackScrollRestoration(t)
    let anchor = document.createElement('a')
    anchor.href = '/login'

    let transition = dispatchNavigation(
      createAnchorNavigateEvent(anchor, {
        intercept: mock.fn(),
        destinationUrl: new URL('/login', window.location.origin).href,
      }),
    )
    await transition.runHandler()
    expect(history.scrollRestoration).toBe('manual')

    controller.abort()
    expect(history.scrollRestoration).toBe('auto')
    await transition.fail()
  })

  it('does not hold scroll restoration for traversals', async (t) => {
    let dispatchNavigation = startStubNavigationListener(t)
    stubDocumentReadyState(t, 'interactive')
    trackScrollRestoration(t)

    let transition = dispatchNavigation(
      createTraverseNavigateEvent({
        intercept: mock.fn(),
        destinationUrl: new URL('/previous', window.location.origin).href,
        resetScroll: true,
      }),
    )
    await transition.runHandler()
    await transition.succeed()

    expect(history.scrollRestoration).toBe('auto')
  })

  it('resynchronizes WebKit scroll state after a navigation scroll reset', async (t) => {
    stubNavigatorUserAgent(
      t,
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.6 Safari/605.1.15',
    )
    let dispatchNavigation = startStubNavigationListener(t)
    let setScrollPosition = stubWindowScrollPosition(t)
    let scrollTo = t.mock.method(window, 'scrollTo', () => {})
    let animationFrameCallbacks: FrameRequestCallback[] = []
    t.mock.method(window, 'requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrameCallbacks.push(callback)
      return 1
    })
    let anchor = document.createElement('a')
    anchor.href = '/login'

    let transition = dispatchNavigation(
      createAnchorNavigateEvent(anchor, {
        intercept: mock.fn(),
        destinationUrl: new URL('/login', window.location.origin).href,
      }),
    )
    await transition.runHandler()
    expect(scrollTo).not.toHaveBeenCalled()

    await transition.succeed()
    expect(scrollTo).toHaveBeenNthCalledWith(1, {
      behavior: 'instant',
      left: 0,
      top: 1,
    })
    setScrollPosition(0, 1)

    let animationFrameCallback = animationFrameCallbacks[0]
    if (!animationFrameCallback) throw new Error('Expected an animation frame callback')
    animationFrameCallback(0)
    expect(scrollTo).toHaveBeenNthCalledWith(2, {
      behavior: 'instant',
      left: 0,
      top: 0,
    })
  })

  it('preserves scrolling that occurs after WebKit scroll resynchronization', async (t) => {
    stubNavigatorUserAgent(
      t,
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.6 Safari/605.1.15',
    )
    let dispatchNavigation = startStubNavigationListener(t)
    let setScrollPosition = stubWindowScrollPosition(t)
    let scrollTo = t.mock.method(window, 'scrollTo', () => {})
    let animationFrameCallbacks: FrameRequestCallback[] = []
    t.mock.method(window, 'requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrameCallbacks.push(callback)
      return 1
    })
    let anchor = document.createElement('a')
    anchor.href = '/login'

    let transition = dispatchNavigation(
      createAnchorNavigateEvent(anchor, {
        intercept: mock.fn(),
        destinationUrl: new URL('/login', window.location.origin).href,
      }),
    )
    await transition.runHandler()
    await transition.succeed()
    setScrollPosition(0, 200)

    let animationFrameCallback = animationFrameCallbacks[0]
    if (!animationFrameCallback) throw new Error('Expected an animation frame callback')
    animationFrameCallback(0)

    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('does not resynchronize WebKit scroll state for fragment navigations', async (t) => {
    stubNavigatorUserAgent(
      t,
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.6 Safari/605.1.15',
    )
    let dispatchNavigation = startStubNavigationListener(t)
    let scrollTo = t.mock.method(window, 'scrollTo', () => {})
    let anchor = document.createElement('a')
    anchor.href = '/login#details'

    let transition = dispatchNavigation(
      createAnchorNavigateEvent(anchor, {
        intercept: mock.fn(),
        destinationUrl: new URL('/login#details', window.location.origin).href,
      }),
    )
    await transition.runHandler()
    await transition.succeed()

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('does not resynchronize WebKit scroll state when the navigation fails', async (t) => {
    stubNavigatorUserAgent(
      t,
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.6 Safari/605.1.15',
    )
    let dispatchNavigation = startStubNavigationListener(t)
    let scrollTo = t.mock.method(window, 'scrollTo', () => {})
    let anchor = document.createElement('a')
    anchor.href = '/login'

    let transition = dispatchNavigation(
      createAnchorNavigateEvent(anchor, {
        intercept: mock.fn(),
        destinationUrl: new URL('/login', window.location.origin).href,
      }),
    )
    await transition.runHandler()
    await transition.fail()

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('opts out of browser scrolling when data-rmx-reset-scroll is false', (t) => {
    let dispatchNavigation = startStubNavigationListener(t)
    let anchor = document.createElement('a')
    anchor.href = '/login'
    anchor.setAttribute('data-rmx-reset-scroll', 'false')
    let intercept = mock.fn()

    dispatchNavigation(
      createAnchorNavigateEvent(anchor, {
        intercept,
        destinationUrl: new URL('/login', window.location.origin).href,
      }),
    )

    expect(intercept.mock.calls[0]?.arguments[0]?.scroll).toBe('manual')
  })

  it('opts out of browser scroll restoration on traverse navigations', async (t) => {
    let dispatchNavigation = startStubNavigationListener(t)
    let scroll = mock.fn()
    let intercept = mock.fn()
    let adoptedStyleSheetCount = document.adoptedStyleSheets.length

    let transition = dispatchNavigation(
      createTraverseNavigateEvent({
        intercept,
        destinationUrl: new URL('/previous', window.location.origin).href,
        resetScroll: false,
        scroll,
      }),
    )

    expect(intercept.mock.calls[0]?.arguments[0]?.scroll).toBe('manual')
    await transition.runHandler()
    expect(scroll).not.toHaveBeenCalled()
    expect(document.adoptedStyleSheets).toHaveLength(adoptedStyleSheetCount)
    await transition.succeed()
  })

  it('preserves manual scrolling across frame redirects', async (t) => {
    let dispatchNavigation = startStubNavigationListener(t)
    let scrollTo = t.mock.method(window, 'scrollTo', () => {})
    let scroll = mock.fn()
    let intercept = mock.fn()

    let transition = dispatchNavigation(
      createFrameRedirectNavigateEvent({
        intercept,
        destinationUrl: new URL('/redirected', window.location.origin).href,
        resetScroll: false,
        scroll,
      }),
    )

    expect(intercept.mock.calls[0]?.arguments[0]?.scroll).toBe('manual')
    await transition.runHandler()
    expect(scroll).not.toHaveBeenCalled()
    expect(scrollTo).not.toHaveBeenCalled()
    await transition.succeed()
  })

  it('resets scroll after a frame redirect', async (t) => {
    let dispatchNavigation = startStubNavigationListener(t)
    let scrollTo = t.mock.method(window, 'scrollTo', () => {})
    let setScrollPosition = stubWindowScrollPosition(t)
    setScrollPosition(0, 200)
    let scroll = mock.fn()
    let intercept = mock.fn()

    let transition = dispatchNavigation(
      createFrameRedirectNavigateEvent({
        intercept,
        destinationUrl: new URL('/redirected', window.location.origin).href,
        resetScroll: true,
        scroll,
      }),
    )

    expect(intercept.mock.calls[0]?.arguments[0]?.scroll).toBe(undefined)
    await transition.runHandler()
    expect(scroll).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
    await transition.succeed()
  })

  it('leaves traversal restoration to the browser after frame reconciliation', async (t) => {
    let [committed, resolveCommitted] = withResolvers<void>()
    let [finished, resolveFinished] = withResolvers<{ signal: AbortSignal }>()
    let topFrame = { src: '' } as FrameHandle
    let dispatchNavigation = startStubNavigationListener(t, {
      getTopFrame: () => topFrame,
      getNamedFrame: () => topFrame,
      reloadFrame() {
        return { committed, finished }
      },
    })
    let scrollTo = t.mock.method(window, 'scrollTo', () => {})
    let setScrollPosition = stubWindowScrollPosition(t)
    setScrollPosition(0, 200)
    let scroll = mock.fn()
    let intercept = mock.fn()
    let adoptedStyleSheetCount = document.adoptedStyleSheets.length
    let startingDocumentHeight = document.documentElement.scrollHeight
    let startingViewportHeight = document.documentElement.clientHeight

    let transition = dispatchNavigation(
      createTraverseNavigateEvent({
        intercept,
        destinationUrl: new URL('/collection', window.location.origin).href,
        resetScroll: true,
        scroll,
      }),
    )
    expect(intercept.mock.calls[0]?.arguments[0]?.scroll).toBe(undefined)

    let handlerSettled = false
    let handler = transition.runHandler().then(() => {
      handlerSettled = true
    })
    await Promise.resolve()

    expect(handlerSettled).toBe(false)
    expect(scroll).not.toHaveBeenCalled()
    expect(document.adoptedStyleSheets).toHaveLength(adoptedStyleSheetCount + 1)
    let stylesheet = document.adoptedStyleSheets[adoptedStyleSheetCount]
    let htmlRule = stylesheet?.cssRules[0]
    if (!(htmlRule instanceof CSSStyleRule)) throw new Error('Expected html scroll state rule')
    expect(htmlRule.selectorText).toBe('html')
    expect(htmlRule.style.minHeight).toBe(`${startingDocumentHeight + startingViewportHeight}px`)
    expect(htmlRule.style.getPropertyPriority('min-height')).toBe('important')
    expect(htmlRule.style.overflowAnchor).toBe('none')
    expect(htmlRule.style.getPropertyPriority('overflow-anchor')).toBe('important')
    let bodyRule = stylesheet?.cssRules[1]
    if (!(bodyRule instanceof CSSStyleRule)) throw new Error('Expected body scroll state rule')
    expect(bodyRule.selectorText).toBe('body')
    expect(bodyRule.style.overflowAnchor).toBe('none')
    expect(bodyRule.style.getPropertyPriority('overflow-anchor')).toBe('important')

    resolveCommitted()
    await Promise.resolve()

    // Restoration belongs to the browser; the scroll-to-top fallback never applies to traversals.
    expect(handlerSettled).toBe(false)
    expect(scroll).toHaveBeenCalledTimes(1)
    expect(scrollTo).not.toHaveBeenCalled()

    resolveFinished({ signal: new AbortController().signal })
    await handler

    expect(scroll).toHaveBeenCalledTimes(1)
    expect(document.adoptedStyleSheets).toHaveLength(adoptedStyleSheetCount + 1)
    await transition.succeed()
    expect(document.adoptedStyleSheets).toHaveLength(adoptedStyleSheetCount)
  })

  it('removes traversal scroll styles when the navigation fails', async (t) => {
    let dispatchNavigation = startStubNavigationListener(t)
    let adoptedStyleSheetCount = document.adoptedStyleSheets.length

    let transition = dispatchNavigation(
      createTraverseNavigateEvent({
        intercept: mock.fn(),
        destinationUrl: new URL('/previous', window.location.origin).href,
        resetScroll: true,
      }),
    )

    await transition.runHandler()
    expect(document.adoptedStyleSheets).toHaveLength(adoptedStyleSheetCount + 1)

    await transition.fail()
    expect(document.adoptedStyleSheets).toHaveLength(adoptedStyleSheetCount)
  })

  it('scopes traversal scroll styles to their own transition', async (t) => {
    let dispatchNavigation = startStubNavigationListener(t)
    let adoptedStyleSheetCount = document.adoptedStyleSheets.length

    let firstTransition = dispatchNavigation(
      createTraverseNavigateEvent({
        intercept: mock.fn(),
        destinationUrl: new URL('/first', window.location.origin).href,
        resetScroll: true,
      }),
    )
    await firstTransition.runHandler()

    let secondTransition = dispatchNavigation(
      createTraverseNavigateEvent({
        intercept: mock.fn(),
        destinationUrl: new URL('/second', window.location.origin).href,
        resetScroll: true,
      }),
    )
    await secondTransition.runHandler()
    expect(document.adoptedStyleSheets).toHaveLength(adoptedStyleSheetCount + 2)

    // The browser aborts the first transition when the second one starts.
    await firstTransition.fail()
    expect(document.adoptedStyleSheets).toHaveLength(adoptedStyleSheetCount + 1)

    await secondTransition.succeed()
    expect(document.adoptedStyleSheets).toHaveLength(adoptedStyleSheetCount)
  })

  it('does not intercept anchors marked for document navigation', (t) => {
    let navigateMethodMock = mock.fn(() => ({ finished: Promise.resolve() }))
    let updateCurrentEntryMock = mock.fn()
    let stubNavigation = Object.assign(new EventTarget(), {
      navigate: navigateMethodMock,
      updateCurrentEntry: updateCurrentEntryMock,
    })
    stubGlobalField(t, 'navigation', stubNavigation)

    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, stubFrames)

    let anchor = document.createElement('a')
    anchor.href = '/login'
    anchor.setAttribute('data-rmx-document', '')
    document.body.append(anchor)
    anchor.addEventListener('click', (event) => event.preventDefault())

    let clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true })
    anchor.dispatchEvent(clickEvent)

    expect(navigateMethodMock).not.toHaveBeenCalled()
    expect(clickEvent.defaultPrevented).toBe(true)

    anchor.remove()
    controller.abort()
  })

  it('does not intercept navigations to a cross-origin destination', (t) => {
    let navigateListener: EventListener | undefined
    let navigateMethodMock = mock.fn(() => ({ finished: Promise.resolve() }))
    let updateCurrentEntryMock = mock.fn()
    let stubNavigation = {
      navigate: navigateMethodMock,
      updateCurrentEntry: updateCurrentEntryMock,
      addEventListener(type: string, listener: EventListener) {
        if (type === 'navigate') {
          navigateListener = listener
        }
      },
    }
    stubGlobalField(t, 'navigation', stubNavigation)

    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, stubFrames)

    let anchor = document.createElement('a')
    anchor.href = 'https://example.com/login'
    document.body.append(anchor)

    let intercept = mock.fn()
    let event = Object.assign(new Event('navigate'), {
      canIntercept: true,
      navigationType: 'push',
      sourceElement: anchor,
      destination: {
        url: 'https://example.com/login',
        key: 'next',
        getState: () => undefined,
      },
      intercept,
    })

    navigateListener?.(event)

    expect(intercept).not.toHaveBeenCalled()

    anchor.remove()
    controller.abort()
  })

  it('does not intercept anchors marked for download', (t) => {
    let navigateMethodMock = mock.fn(() => ({ finished: Promise.resolve() }))
    let updateCurrentEntryMock = mock.fn()
    let stubNavigation = Object.assign(new EventTarget(), {
      navigate: navigateMethodMock,
      updateCurrentEntry: updateCurrentEntryMock,
    })
    stubGlobalField(t, 'navigation', stubNavigation)

    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, stubFrames)

    let anchor = document.createElement('a')
    anchor.href = '/report.csv'
    anchor.setAttribute('download', '')
    document.body.append(anchor)
    anchor.addEventListener('click', (event) => event.preventDefault())

    let clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true })
    anchor.dispatchEvent(clickEvent)

    expect(navigateMethodMock).not.toHaveBeenCalled()
    expect(clickEvent.defaultPrevented).toBe(true)

    anchor.remove()
    controller.abort()
  })

  it('intercepts anchors when sourceElement is a nested svg node', (t) => {
    let navigateListener: EventListener | undefined
    let navigateMethodMock = mock.fn(() => ({ finished: Promise.resolve() }))
    let updateCurrentEntryMock = mock.fn()
    let stubNavigation = {
      navigate: navigateMethodMock,
      updateCurrentEntry: updateCurrentEntryMock,
      addEventListener(type: string, listener: EventListener) {
        if (type === 'navigate') {
          navigateListener = listener
        }
      },
    }
    stubGlobalField(t, 'navigation', stubNavigation)

    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, stubFrames)

    let anchor = document.createElement('a')
    anchor.href = '/logo'
    let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    let path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    svg.append(path)
    anchor.append(svg)

    let intercept = mock.fn()
    let event = Object.assign(new Event('navigate'), {
      canIntercept: true,
      navigationType: 'push',
      sourceElement: path,
      destination: {
        url: new URL('/logo', window.location.origin).href,
        key: 'next',
        getState: () => undefined,
      },
      intercept,
    })

    navigateListener?.(event)

    expect(intercept).toHaveBeenCalledTimes(1)

    controller.abort()
  })

  it('replaces marked anchor history without precommit support', async (t) => {
    stubGlobalField(t, 'NavigationPrecommitController', undefined)

    let originalUrl = window.location.href
    let destination = new URL(originalUrl)
    destination.searchParams.set('frame-navigation', 'replace-link')
    let reload = mock.fn(async (_options?: ResolveFrameOptions) => new AbortController().signal)
    let topFrame = { src: '' } as FrameHandle
    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, {
      getTopFrame: () => topFrame,
      getNamedFrame: () => topFrame,
      reloadFrame: (_frame, options) =>
        createReloadTransition(reload(options).then((signal) => ({ signal }))),
    })

    let anchor = document.createElement('a')
    anchor.href = destination.href
    anchor.setAttribute('data-rmx-history', 'replace')
    document.body.append(anchor)

    let entryCountBeforeNavigation = window.navigation.entries().length
    let didNavigate = false
    try {
      let navigationSucceeded = waitForNavigationSuccess()
      anchor.click()
      await navigationSucceeded
      didNavigate = true

      let entryAfterNavigation = getCurrentNavigationEntry()
      expect(window.navigation.entries()).toHaveLength(entryCountBeforeNavigation)
      expect(entryAfterNavigation.url).toBe(destination.href)
      expect(topFrame.src).toBe(destination.href)
      expect(reload).toHaveBeenCalledTimes(1)
    } finally {
      if (didNavigate) await navigate(originalUrl, { history: 'replace' })
      controller.abort()
    }
  })

  it('replaces the navigation URL when the top frame reload follows a redirect', async () => {
    let originalUrl = window.location.href
    let requestedUrl = new URL(originalUrl)
    requestedUrl.searchParams.set('frame-navigation', 'requested')
    let redirectedUrl = new URL(originalUrl)
    redirectedUrl.searchParams.set('frame-navigation', 'redirected')
    let topFrame = { src: '' } as FrameHandle
    let shouldRedirect = true
    let reloadFrame = mock.fn(() => {
      if (shouldRedirect) {
        shouldRedirect = false
        return createReloadTransition({
          signal: new AbortController().signal,
          redirectedTo: redirectedUrl.href,
        })
      }
      return createReloadTransition({ signal: new AbortController().signal })
    })
    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, {
      getTopFrame: () => topFrame,
      getNamedFrame: () => topFrame,
      reloadFrame,
    })

    let entryCountBeforeNavigation = window.navigation.entries().length
    try {
      let redirected = waitForNavigationUrl(redirectedUrl.href)
      void navigate(requestedUrl.href).catch(() => {})
      await redirected

      expect(reloadFrame).toHaveBeenCalledTimes(1)
      expect(topFrame.src).toBe(redirectedUrl.href)
      expect(window.navigation.entries()).toHaveLength(entryCountBeforeNavigation + 1)
      expect(window.navigation.currentEntry?.url).toBe(redirectedUrl.href)
      expect(window.navigation.currentEntry?.getState()).toEqual({
        target: undefined,
        src: redirectedUrl.href,
        resetScroll: true,
        $rmx: true,
      })

      await window.navigation.back().finished
      expect(topFrame.src).toBe(originalUrl)

      await window.navigation.forward().finished
      expect(window.navigation.currentEntry?.url).toBe(redirectedUrl.href)
      expect(topFrame.src).toBe(redirectedUrl.href)
      expect(reloadFrame).toHaveBeenCalledTimes(3)
    } finally {
      if (window.location.href !== originalUrl) {
        await navigate(originalUrl, { history: 'replace' })
      }
      controller.abort()
    }
  })

  it('does not replace the navigation URL when a non-top frame reload follows a redirect', async () => {
    let originalUrl = window.location.href
    let navigationUrl = new URL(originalUrl)
    navigationUrl.searchParams.set('frame-navigation', 'named')
    let requestedFrameUrl = new URL('/requested-frame', originalUrl)
    let redirectedFrameUrl = new URL('/redirected-frame', originalUrl)
    let topFrame = { src: originalUrl } as FrameHandle
    let childFrame = { src: '' } as FrameHandle
    let reloadFrame = mock.fn((frame: FrameHandle) =>
      createReloadTransition({
        signal: new AbortController().signal,
        redirectedTo: frame === childFrame ? redirectedFrameUrl.href : undefined,
      }),
    )
    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, {
      getTopFrame: () => topFrame,
      getNamedFrame: () => childFrame,
      reloadFrame,
    })

    let entryCountBeforeNavigation = window.navigation.entries().length
    try {
      let navigated = waitForNextNavigation()
      void navigate(navigationUrl.href, {
        src: requestedFrameUrl.href,
        target: 'details',
      }).catch(() => {})
      await navigated

      expect(reloadFrame).toHaveBeenCalledTimes(1)
      expect(childFrame.src).toBe(requestedFrameUrl.href)
      expect(window.navigation.entries()).toHaveLength(entryCountBeforeNavigation + 1)
      expect(window.navigation.currentEntry?.url).toBe(navigationUrl.href)
      expect(window.navigation.currentEntry?.getState()).toEqual({
        target: 'details',
        src: requestedFrameUrl.href,
        resetScroll: true,
        $rmx: true,
      })
    } finally {
      if (window.location.href !== originalUrl) {
        await navigate(originalUrl, { history: 'replace' })
      }
      controller.abort()
    }
  })
})

describe('form navigation', () => {
  afterEach(() => {
    document.body.textContent = ''
  })

  it('replaces same-location POST submission history before commit when supported', async () => {
    expect(typeof Reflect.get(window, 'NavigationPrecommitController')).toBe('function')

    let reload = mock.fn(async (_options?: ResolveFrameOptions) => ({
      signal: new AbortController().signal,
    }))
    let topFrame = { src: '' } as FrameHandle
    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, {
      getTopFrame: () => topFrame,
      getNamedFrame: () => topFrame,
      reloadFrame: (_frame, options) => createReloadTransition(reload(options)),
    })

    let form = document.createElement('form')
    form.action = window.location.href
    form.method = 'post'
    let input = document.createElement('input')
    input.name = 'displayName'
    input.value = 'Ada'
    form.append(input)
    document.body.append(form)

    let entryBeforeSubmission = getCurrentNavigationEntry()
    let entryCountBeforeSubmission = window.navigation.entries().length
    let navigationSucceeded = waitForNavigationSuccess()
    form.requestSubmit()
    await navigationSucceeded

    let entryAfterSubmission = getCurrentNavigationEntry()
    expect(window.navigation.entries()).toHaveLength(entryCountBeforeSubmission)
    expect(entryAfterSubmission.url).toBe(entryBeforeSubmission.url)
    expect(reload.mock.calls[0]?.arguments[0]?.method).toBe('post')
    expect(reload.mock.calls[0]?.arguments[0]?.formData?.get('displayName')).toBe('Ada')

    controller.abort()
  })

  it('replays same-location POST submissions as replace navigations without precommit support', async (t) => {
    stubGlobalField(t, 'NavigationPrecommitController', undefined)

    let reload = mock.fn(async (_options?: ResolveFrameOptions) => ({
      signal: new AbortController().signal,
    }))
    let topFrame = { src: '' } as FrameHandle
    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, {
      getTopFrame: () => topFrame,
      getNamedFrame: () => topFrame,
      reloadFrame: (_frame, options) => createReloadTransition(reload(options)),
    })

    let form = document.createElement('form')
    form.action = window.location.href
    form.method = 'post'
    let input = document.createElement('input')
    input.name = 'displayName'
    input.value = 'Ada'
    form.append(input)
    document.body.append(form)

    let entryBeforeSubmission = getCurrentNavigationEntry()
    let entryCountBeforeSubmission = window.navigation.entries().length
    let navigationSucceeded = waitForNavigationSuccess()
    form.requestSubmit()
    await navigationSucceeded

    let entryAfterSubmission = getCurrentNavigationEntry()
    expect(window.navigation.entries()).toHaveLength(entryCountBeforeSubmission)
    expect(entryAfterSubmission.url).toBe(entryBeforeSubmission.url)
    expect(reload.mock.calls[0]?.arguments[0]?.method).toBe('post')
    expect(reload.mock.calls[0]?.arguments[0]?.formData?.get('displayName')).toBe('Ada')

    controller.abort()
  })

  it('pushes same-location POST history when data-rmx-history is push', async () => {
    let reload = mock.fn(async (_options?: ResolveFrameOptions) => new AbortController().signal)
    let topFrame = { src: '' } as FrameHandle
    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, {
      getTopFrame: () => topFrame,
      getNamedFrame: () => topFrame,
      reloadFrame: (_frame, options) =>
        createReloadTransition(reload(options).then((signal) => ({ signal }))),
    })

    let form = document.createElement('form')
    form.action = window.location.href
    form.method = 'post'
    form.setAttribute('data-rmx-history', 'push')
    document.body.append(form)

    let entryBeforeSubmission = getCurrentNavigationEntry()
    let didNavigate = false
    try {
      let navigationSucceeded = waitForNavigationSuccess()
      form.requestSubmit()
      await navigationSucceeded
      didNavigate = true

      let entryAfterSubmission = getCurrentNavigationEntry()
      expect(entryAfterSubmission.index).toBe(entryBeforeSubmission.index + 1)
      expect(entryAfterSubmission.url).toBe(entryBeforeSubmission.url)
      expect(reload.mock.calls[0]?.arguments[0]?.method).toBe('post')
    } finally {
      if (didNavigate) await window.navigation.back().finished
      controller.abort()
    }
  })

  it('pushes POST submission history for a different location', async () => {
    let reload = mock.fn(async (_options?: ResolveFrameOptions) => ({
      signal: new AbortController().signal,
    }))
    let topFrame = { src: '' } as FrameHandle
    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, {
      getTopFrame: () => topFrame,
      getNamedFrame: () => topFrame,
      reloadFrame: (_frame, options) => createReloadTransition(reload(options)),
    })

    let destination = new URL(window.location.href)
    destination.searchParams.set('form-navigation', 'post')
    let form = document.createElement('form')
    form.action = destination.href
    form.method = 'post'
    document.body.append(form)

    let entryBeforeSubmission = getCurrentNavigationEntry()
    let didNavigate = false
    try {
      let navigationSucceeded = waitForNavigationSuccess()
      form.requestSubmit()
      await navigationSucceeded
      didNavigate = true

      let entryAfterSubmission = getCurrentNavigationEntry()
      expect(entryAfterSubmission.index).toBe(entryBeforeSubmission.index + 1)
      expect(entryAfterSubmission.url).toBe(destination.href)
      expect(reload.mock.calls[0]?.arguments[0]?.method).toBe('post')
    } finally {
      if (didNavigate) await window.navigation.back().finished
      controller.abort()
    }
  })

  it('reloads a targeted frame with submitter-overridden submission metadata', async () => {
    let topReload = mock.fn(async () => ({ signal: new AbortController().signal }))
    let namedReload = mock.fn(async (_options?: ResolveFrameOptions) => ({
      signal: new AbortController().signal,
    }))
    let topFrame = { src: '' } as FrameHandle
    let namedFrame = { src: '' } as FrameHandle
    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, {
      getTopFrame: () => topFrame,
      getNamedFrame(name) {
        expect(name).toBe('account')
        return namedFrame
      },
      reloadFrame: (frame, options) =>
        createReloadTransition(frame === namedFrame ? namedReload(options) : topReload()),
    })

    let destinationUrl = window.location.href
    let form = document.createElement('form')
    form.action = destinationUrl
    form.method = 'get'
    form.enctype = 'application/x-www-form-urlencoded'
    let input = document.createElement('input')
    input.name = 'displayName'
    input.value = 'Ada'
    let button = document.createElement('button')
    button.name = 'intent'
    button.value = 'save'
    button.setAttribute('formmethod', 'post')
    button.setAttribute('formenctype', 'multipart/form-data')
    button.setAttribute('data-rmx-target', 'account')
    form.append(input, button)
    document.body.append(form)

    let navigationSucceeded = waitForNavigationSuccess()
    form.requestSubmit(button)
    await navigationSucceeded

    expect(topReload).not.toHaveBeenCalled()
    expect(namedFrame.src).toBe(destinationUrl)
    expect(namedReload).toHaveBeenCalledTimes(1)
    let options = namedReload.mock.calls[0]?.arguments[0]
    expect(options?.formData?.get('displayName')).toBe('Ada')
    expect(options?.formData?.get('intent')).toBe('save')
    expect(options?.method).toBe('post')
    expect(options?.encType).toBe('multipart/form-data')
    expect(options?.signal).toBeInstanceOf(AbortSignal)
    expect(window.navigation.currentEntry?.getState()).toEqual({
      target: 'account',
      src: destinationUrl,
      resetScroll: true,
      $rmx: true,
    })

    controller.abort()
  })

  it('reloads GET form navigations like link navigations', async () => {
    let reload = mock.fn(async (_options?: ResolveFrameOptions) => ({
      signal: new AbortController().signal,
    }))
    let topFrame = { src: '' } as FrameHandle
    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, {
      getTopFrame: () => topFrame,
      getNamedFrame: () => topFrame,
      reloadFrame: (_frame, options) => createReloadTransition(reload(options)),
    })

    let form = document.createElement('form')
    form.action = window.location.href
    form.method = 'get'
    let input = document.createElement('input')
    input.name = 'query'
    input.value = 'frames'
    form.append(input)
    document.body.append(form)

    let entryBeforeSubmission = getCurrentNavigationEntry()
    let didNavigate = false
    try {
      let navigationSucceeded = waitForNavigationSuccess()
      form.requestSubmit()
      await navigationSucceeded
      didNavigate = true

      let entryAfterSubmission = getCurrentNavigationEntry()
      expect(entryAfterSubmission.index).toBe(entryBeforeSubmission.index + 1)
      expect(new URL(entryAfterSubmission.url ?? '').searchParams.get('query')).toBe('frames')
      expect(topFrame.src).toBe(entryAfterSubmission.url)
      expect(reload).toHaveBeenCalledTimes(1)
      let options = reload.mock.calls[0]?.arguments[0]
      expect(options && Reflect.has(options, 'method')).toBe(false)
      expect(options && Reflect.has(options, 'encType')).toBe(false)
      expect(options && Reflect.has(options, 'formData')).toBe(false)
    } finally {
      if (didNavigate) await window.navigation.back().finished
      controller.abort()
    }
  })

  it('replaces marked GET form history across frame redirects without submission metadata', async () => {
    expect(typeof Reflect.get(window, 'NavigationPrecommitController')).toBe('function')

    let originalUrl = window.location.href
    let redirectedUrl = new URL(originalUrl)
    redirectedUrl.searchParams.set('query', 'redirected-frames')
    let topFrame = { src: '' } as FrameHandle
    let shouldRedirect = true
    let reload = mock.fn(async (_options?: ResolveFrameOptions) => {
      if (shouldRedirect) {
        shouldRedirect = false
        return {
          signal: new AbortController().signal,
          redirectedTo: redirectedUrl.href,
        }
      }
      return { signal: new AbortController().signal }
    })
    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, {
      getTopFrame: () => topFrame,
      getNamedFrame: () => topFrame,
      reloadFrame: (_frame, options) => createReloadTransition(reload(options)),
    })

    let form = document.createElement('form')
    form.action = originalUrl
    form.method = 'get'
    form.setAttribute('data-rmx-history', 'replace')
    let input = document.createElement('input')
    input.name = 'query'
    input.value = 'replace-frames'
    form.append(input)
    document.body.append(form)

    let entryCountBeforeSubmission = window.navigation.entries().length
    let didNavigate = false
    try {
      let redirected = waitForNavigationUrl(redirectedUrl.href)
      form.requestSubmit()
      await redirected
      didNavigate = true

      let entryAfterSubmission = getCurrentNavigationEntry()
      expect(window.navigation.entries()).toHaveLength(entryCountBeforeSubmission)
      expect(entryAfterSubmission.url).toBe(redirectedUrl.href)
      expect(reload).toHaveBeenCalledTimes(1)
      let options = reload.mock.calls[0]?.arguments[0]
      expect(options && Reflect.has(options, 'method')).toBe(false)
      expect(options && Reflect.has(options, 'encType')).toBe(false)
      expect(options && Reflect.has(options, 'formData')).toBe(false)
    } finally {
      if (didNavigate) await navigate(originalUrl, { history: 'replace' })
      controller.abort()
    }
  })

  it('leaves invalid forms to native constraint validation', (t) => {
    let submit = mock.fn()
    let form = document.createElement('form')
    form.addEventListener('submit', submit)
    let input = document.createElement('input')
    input.required = true
    form.append(input)
    document.body.append(form)

    form.requestSubmit()

    expect(submit).not.toHaveBeenCalled()
    expect(input.matches(':invalid')).toBe(true)
  })

  it('does not intercept forms that opt into document navigation', (t) => {
    let navigateListener: EventListener | undefined
    let stubNavigation = {
      updateCurrentEntry: mock.fn(),
      addEventListener(type: string, listener: EventListener) {
        if (type === 'navigate') navigateListener = listener
      },
    }
    stubGlobalField(t, 'navigation', stubNavigation)

    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, stubFrames)
    let form = document.createElement('form')
    form.setAttribute('data-rmx-document', '')
    let intercept = mock.fn()

    navigateListener?.(
      createFormNavigateEvent(form, {
        intercept,
        destinationUrl: new URL('/login', window.location.origin).href,
      }),
    )

    expect(intercept).not.toHaveBeenCalled()
    controller.abort()
  })

  it('does not intercept dialog forms or forms submitted to a new browsing context', (t) => {
    let navigateListener: EventListener | undefined
    let stubNavigation = {
      updateCurrentEntry: mock.fn(),
      addEventListener(type: string, listener: EventListener) {
        if (type === 'navigate') navigateListener = listener
      },
    }
    stubGlobalField(t, 'navigation', stubNavigation)

    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, stubFrames)
    let form = document.createElement('form')
    form.method = 'dialog'
    let intercept = mock.fn()

    navigateListener?.(
      createFormNavigateEvent(form, {
        intercept,
        destinationUrl: new URL('/dialog', window.location.origin).href,
      }),
    )

    form.method = 'post'
    form.target = '_blank'
    navigateListener?.(
      createFormNavigateEvent(form, {
        intercept,
        destinationUrl: new URL('/report', window.location.origin).href,
      }),
    )

    expect(intercept).not.toHaveBeenCalled()
    controller.abort()
  })
})

function getCurrentNavigationEntry(): NavigationHistoryEntry {
  let entry = window.navigation.currentEntry
  if (!entry) throw new Error('Expected a current navigation entry')
  return entry
}

function waitForNavigationSuccess(): Promise<void> {
  return new Promise((resolve) => {
    window.navigation.addEventListener('navigatesuccess', () => resolve(), { once: true })
  })
}

function createFormNavigateEvent(
  form: HTMLFormElement,
  options: {
    intercept: (options?: NavigationInterceptOptions) => void
    destinationUrl: string
    cancelable?: boolean
  },
): Event {
  return Object.assign(new Event('navigate', { cancelable: options.cancelable }), {
    canIntercept: true,
    navigationType: 'push',
    sourceElement: form,
    formData: new FormData(form),
    signal: new AbortController().signal,
    destination: {
      url: options.destinationUrl,
      key: 'next',
      getState: () => undefined,
    },
    intercept: options.intercept,
  })
}

function createAnchorNavigateEvent(
  anchor: HTMLAnchorElement,
  options: {
    intercept: (options?: NavigationInterceptOptions) => void
    destinationUrl: string
    info?: unknown
    scroll?: () => void
  },
): Event {
  return Object.assign(new Event('navigate'), {
    canIntercept: true,
    navigationType: 'push',
    info: options.info,
    sourceElement: anchor,
    signal: new AbortController().signal,
    destination: {
      url: options.destinationUrl,
      key: 'next',
      getState: () => undefined,
    },
    scroll: options.scroll ?? (() => {}),
    intercept: options.intercept,
  })
}

function createFrameRedirectNavigateEvent(options: {
  intercept: (options?: NavigationInterceptOptions) => void
  destinationUrl: string
  resetScroll: boolean
  scroll?: () => void
}): Event {
  return Object.assign(new Event('navigate'), {
    canIntercept: true,
    navigationType: 'replace',
    info: { type: 'frame-redirect', resetScroll: options.resetScroll },
    signal: new AbortController().signal,
    destination: { url: options.destinationUrl },
    scroll: options.scroll ?? (() => {}),
    intercept: options.intercept,
  })
}

function createTraverseNavigateEvent(options: {
  intercept: (options?: NavigationInterceptOptions) => void
  destinationUrl: string
  resetScroll: boolean
  scroll?: () => void
}): Event {
  return Object.assign(new Event('navigate'), {
    canIntercept: true,
    navigationType: 'traverse',
    signal: new AbortController().signal,
    destination: {
      url: options.destinationUrl,
      key: 'previous',
      getState: () => ({
        target: undefined,
        src: options.destinationUrl,
        resetScroll: options.resetScroll,
        $rmx: true,
      }),
    },
    scroll: options.scroll ?? (() => {}),
    intercept: options.intercept,
  })
}

function waitForNavigationUrl(url: string): Promise<void> {
  return new Promise((resolve) => {
    let onNavigateSuccess = () => {
      if (window.navigation.currentEntry?.url !== url) return
      window.navigation.removeEventListener('navigatesuccess', onNavigateSuccess)
      resolve()
    }
    window.navigation.addEventListener('navigatesuccess', onNavigateSuccess)
  })
}

function waitForNextNavigation(): Promise<void> {
  return new Promise((resolve) => {
    window.navigation.addEventListener('navigatesuccess', () => resolve(), { once: true })
  })
}
