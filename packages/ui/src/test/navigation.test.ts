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

type StubNavigationTransition = {
  runHandler(): Promise<void>
  succeed(): Promise<void>
  fail(error?: unknown): Promise<void>
}

function startStubNavigationListener(t: TestContext): (event: Event) => StubNavigationTransition {
  let stubNavigation = Object.assign(new EventTarget(), {
    updateCurrentEntry: mock.fn(),
    transition: null as NavigationTransition | null,
  })
  stubGlobalField(t, 'navigation', stubNavigation)

  let controller = new AbortController()
  startNavigationListenerImpl(controller.signal, stubFrames)
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

    function clearTransition() {
      if (stubNavigation.transition === transition) stubNavigation.transition = null
    }

    return {
      async runHandler() {
        await interceptOptions?.handler?.()
      },
      async succeed() {
        resolveFinished()
        await finished
        await Promise.resolve()
        clearTransition()
      },
      async fail(error = new Error('Navigation failed')) {
        rejectFinished(error)
        await finished.catch(() => {})
        await Promise.resolve()
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
    stubNavigatorUserAgent(t, 'Mozilla/5.0 Gecko/20100101 Firefox/142.0')
    let dispatchNavigation = startStubNavigationListener(t)
    let anchor = document.createElement('a')
    anchor.href = '/login'
    let scroll = mock.fn()
    let intercept = mock.fn()

    let transition = dispatchNavigation(
      createAnchorNavigateEvent(anchor, {
        intercept,
        destinationUrl: new URL('/login', window.location.origin).href,
        info: { resetScroll: true },
        scroll,
      }),
    )

    let interceptOptions = intercept.mock.calls[0]?.arguments[0]
    expect(interceptOptions?.scroll).toBe(undefined)
    await interceptOptions?.handler?.()
    expect(scroll).toHaveBeenCalledTimes(1)
    await transition.succeed()
  })

  it('suppresses Chromium scroll anchoring through the first navigation paint', async (t) => {
    let dispatchNavigation = startStubNavigationListener(t)
    let anchor = document.createElement('a')
    anchor.href = '/login'
    let adoptedStyleSheetCount = document.adoptedStyleSheets.length
    let animationFrameCallbacks: FrameRequestCallback[] = []
    t.mock.method(window, 'requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrameCallbacks.push(callback)
      return animationFrameCallbacks.length
    })

    let transition = dispatchNavigation(
      createAnchorNavigateEvent(anchor, {
        intercept: mock.fn(),
        destinationUrl: new URL('/login', window.location.origin).href,
      }),
    )

    expect(document.adoptedStyleSheets).toHaveLength(adoptedStyleSheetCount + 1)
    let stylesheet = document.adoptedStyleSheets[adoptedStyleSheetCount]
    let anchorRule = stylesheet?.cssRules[0]
    if (!(anchorRule instanceof CSSStyleRule)) throw new Error('Expected scroll anchoring rule')
    expect(anchorRule.selectorText).toBe('html, body')
    expect(anchorRule.style.overflowAnchor).toBe('none')
    expect(anchorRule.style.getPropertyPriority('overflow-anchor')).toBe('important')

    await transition.runHandler()
    await transition.succeed()
    expect(document.adoptedStyleSheets).toHaveLength(adoptedStyleSheetCount + 1)

    animationFrameCallbacks[0]?.(0)
    expect(document.adoptedStyleSheets).toHaveLength(adoptedStyleSheetCount + 1)

    animationFrameCallbacks[1]?.(0)
    expect(document.adoptedStyleSheets).toHaveLength(adoptedStyleSheetCount)
  })

  it('does not suppress Chromium scroll anchoring for fragment destinations', async (t) => {
    let dispatchNavigation = startStubNavigationListener(t)
    let anchor = document.createElement('a')
    anchor.href = '/login#details'
    let adoptedStyleSheetCount = document.adoptedStyleSheets.length

    let transition = dispatchNavigation(
      createAnchorNavigateEvent(anchor, {
        intercept: mock.fn(),
        destinationUrl: new URL('/login#details', window.location.origin).href,
      }),
    )

    expect(document.adoptedStyleSheets).toHaveLength(adoptedStyleSheetCount)
    await transition.runHandler()
    await transition.succeed()
  })

  it('scopes Chromium scroll anchoring styles to each navigation transition', async (t) => {
    let dispatchNavigation = startStubNavigationListener(t)
    let anchor = document.createElement('a')
    anchor.href = '/login'
    let adoptedStyleSheetCount = document.adoptedStyleSheets.length
    let animationFrameCallbacks: FrameRequestCallback[] = []
    t.mock.method(window, 'requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrameCallbacks.push(callback)
      return animationFrameCallbacks.length
    })

    let firstTransition = dispatchNavigation(
      createAnchorNavigateEvent(anchor, {
        intercept: mock.fn(),
        destinationUrl: new URL('/login', window.location.origin).href,
      }),
    )
    await firstTransition.runHandler()

    let secondTransition = dispatchNavigation(
      createFrameRedirectNavigateEvent({
        intercept: mock.fn(),
        destinationUrl: new URL('/redirected', window.location.origin).href,
        resetScroll: true,
      }),
    )
    await secondTransition.runHandler()
    expect(document.adoptedStyleSheets).toHaveLength(adoptedStyleSheetCount + 2)

    await firstTransition.fail()
    expect(document.adoptedStyleSheets).toHaveLength(adoptedStyleSheetCount + 1)

    await secondTransition.succeed()
    animationFrameCallbacks[0]?.(0)
    animationFrameCallbacks[1]?.(0)
    expect(document.adoptedStyleSheets).toHaveLength(adoptedStyleSheetCount)
  })

  it('removes Chromium scroll anchoring styles when navigation aborts', async (t) => {
    let dispatchNavigation = startStubNavigationListener(t)
    let anchor = document.createElement('a')
    anchor.href = '/login'
    let eventController = new AbortController()
    let adoptedStyleSheetCount = document.adoptedStyleSheets.length

    let transition = dispatchNavigation(
      createAnchorNavigateEvent(anchor, {
        intercept: mock.fn(),
        destinationUrl: new URL('/login', window.location.origin).href,
        signal: eventController.signal,
      }),
    )
    expect(document.adoptedStyleSheets).toHaveLength(adoptedStyleSheetCount + 1)

    eventController.abort()
    expect(document.adoptedStyleSheets).toHaveLength(adoptedStyleSheetCount)
    await transition.fail()
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
    expect(scrollTo).not.toHaveBeenCalled()

    await transition.runHandler()
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

  it('opts out of browser scrolling when data-rmx-reset-scroll is false', (t) => {
    let dispatchNavigation = startStubNavigationListener(t)
    let anchor = document.createElement('a')
    anchor.href = '/login'
    anchor.setAttribute('data-rmx-reset-scroll', 'false')
    let intercept = mock.fn()
    let adoptedStyleSheetCount = document.adoptedStyleSheets.length

    dispatchNavigation(
      createAnchorNavigateEvent(anchor, {
        intercept,
        destinationUrl: new URL('/login', window.location.origin).href,
      }),
    )

    expect(intercept.mock.calls[0]?.arguments[0]?.scroll).toBe('manual')
    expect(document.adoptedStyleSheets).toHaveLength(adoptedStyleSheetCount)
  })

  it('opts out of browser scroll restoration on traverse navigations', (t) => {
    let dispatchNavigation = startStubNavigationListener(t)
    let intercept = mock.fn()
    let event = Object.assign(new Event('navigate'), {
      canIntercept: true,
      navigationType: 'traverse',
      signal: new AbortController().signal,
      destination: {
        url: new URL('/previous', window.location.origin).href,
        getState: () => ({
          target: undefined,
          src: '/previous',
          resetScroll: false,
          $rmx: true,
        }),
      },
      intercept,
    })

    dispatchNavigation(event)

    expect(intercept.mock.calls[0]?.arguments[0]?.scroll).toBe('manual')
  })

  it('preserves manual scrolling across frame redirects', (t) => {
    let dispatchNavigation = startStubNavigationListener(t)
    let intercept = mock.fn()
    let event = Object.assign(new Event('navigate'), {
      canIntercept: true,
      destination: {
        url: new URL('/redirected', window.location.origin).href,
      },
      info: { type: 'frame-redirect', resetScroll: false },
      intercept,
    })

    dispatchNavigation(event)

    expect(intercept.mock.calls[0]?.arguments[0]?.scroll).toBe('manual')
  })

  it('leaves traversal restoration to the browser after frame reconciliation', async (t) => {
    let navigateListener: EventListener | undefined
    let [transitionFinished, resolveTransitionFinished] = withResolvers<void>()
    let stubNavigation = {
      transition: { finished: transitionFinished } as NavigationTransition,
      updateCurrentEntry() {},
      addEventListener(type: string, listener: EventListener) {
        if (type === 'navigate') navigateListener = listener
      },
    }
    stubGlobalField(t, 'navigation', stubNavigation)

    let [committed, resolveCommitted] = withResolvers<void>()
    let [finished, resolveFinished] = withResolvers<{ signal: AbortSignal }>()
    let topFrame = { src: '' } as FrameHandle
    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, {
      getTopFrame: () => topFrame,
      getNamedFrame: () => topFrame,
      reloadFrame() {
        return { committed, finished }
      },
    })

    let scroll = mock.fn()
    let intercept = mock.fn()
    let eventController = new AbortController()
    let event = Object.assign(new Event('navigate'), {
      canIntercept: true,
      navigationType: 'traverse',
      info: { resetScroll: true },
      signal: eventController.signal,
      destination: {
        url: new URL('/collection', window.location.origin).href,
        key: 'collection',
        getState: () => ({
          target: undefined,
          src: '/collection',
          resetScroll: true,
          $rmx: true,
        }),
      },
      scroll,
      intercept,
    })

    let adoptedStyleSheetCount = document.adoptedStyleSheets.length
    let startingDocumentHeight = document.documentElement.scrollHeight
    let startingViewportHeight = document.documentElement.clientHeight
    try {
      navigateListener?.(event)
      let interceptOptions = intercept.mock.calls[0]?.arguments[0]
      if (!interceptOptions?.handler) throw new Error('Expected navigation interception handler')
      let handlerSettled = false
      let handler = interceptOptions.handler().then(() => {
        handlerSettled = true
      })
      await Promise.resolve()

      expect(interceptOptions.scroll).toBe(undefined)
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

      expect(handlerSettled).toBe(false)
      expect(scroll).toHaveBeenCalledTimes(1)

      resolveFinished({ signal: event.signal })
      await handler

      expect(scroll).toHaveBeenCalledTimes(1)
      expect(document.adoptedStyleSheets).toHaveLength(adoptedStyleSheetCount + 1)
      resolveTransitionFinished()
      await transitionFinished
      await Promise.resolve()
      expect(document.adoptedStyleSheets).toHaveLength(adoptedStyleSheetCount)
    } finally {
      eventController.abort()
      controller.abort()
    }
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
        if (type === 'navigate') navigateListener = listener
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
    let eventController = new AbortController()
    let event = Object.assign(new Event('navigate'), {
      canIntercept: true,
      navigationType: 'push',
      signal: eventController.signal,
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
    eventController.abort()
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
    signal?: AbortSignal
  },
): Event {
  return Object.assign(new Event('navigate'), {
    canIntercept: true,
    navigationType: 'push',
    info: options.info,
    sourceElement: anchor,
    signal: options.signal ?? new AbortController().signal,
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
}): Event {
  return Object.assign(new Event('navigate'), {
    canIntercept: true,
    navigationType: 'replace',
    info: { type: 'frame-redirect', resetScroll: options.resetScroll },
    signal: new AbortController().signal,
    destination: { url: options.destinationUrl },
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
