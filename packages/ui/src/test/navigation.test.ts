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
  reloadFrame: async (frame: FrameHandle) => ({ signal: await frame.reload() }),
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

function startStubNavigationListener(t: TestContext): (event: Event) => void {
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
  t.after(() => controller.abort())

  return (event) => {
    if (!navigateListener) throw new Error('Expected a navigate listener')
    navigateListener(event)
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

  it('leaves default scrolling to the browser', async (t) => {
    let dispatchNavigation = startStubNavigationListener(t)
    let scrollTo = t.mock.method(window, 'scrollTo', () => {})
    let anchor = document.createElement('a')
    anchor.href = '/login'
    let intercept = mock.fn()

    dispatchNavigation(
      createAnchorNavigateEvent(anchor, {
        intercept,
        destinationUrl: new URL('/login', window.location.origin).href,
      }),
    )

    let interceptOptions = intercept.mock.calls[0]?.arguments[0]
    expect(interceptOptions?.scroll).toBe(undefined)
    await interceptOptions?.handler?.()
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
    let navigationEvents = new EventTarget()
    let stubNavigation = {
      updateCurrentEntry() {},
      addEventListener(
        type: string,
        listener: EventListener,
        options?: AddEventListenerOptions | boolean,
      ) {
        if (type === 'navigate') {
          navigateListener = listener
        } else {
          navigationEvents.addEventListener(type, listener, options)
        }
      },
      removeEventListener(
        type: string,
        listener: EventListener,
        options?: EventListenerOptions | boolean,
      ) {
        navigationEvents.removeEventListener(type, listener, options)
      },
    }
    stubGlobalField(t, 'navigation', stubNavigation)

    let [reloadPromise, resolveReload] = withResolvers<{ signal: AbortSignal }>()
    let topFrame = { src: '' } as FrameHandle
    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, {
      getTopFrame: () => topFrame,
      getNamedFrame: () => topFrame,
      reloadFrame(_frame, options) {
        let onAfterCommit = Reflect.get(options ?? {}, 'onAfterCommit')
        if (typeof onAfterCommit === 'function') onAfterCommit()
        return reloadPromise
      },
    })

    let scroll = mock.fn()
    let intercept = mock.fn()
    let event = Object.assign(new Event('navigate'), {
      canIntercept: true,
      navigationType: 'traverse',
      signal: new AbortController().signal,
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

    try {
      navigateListener?.(event)
      let interceptOptions = intercept.mock.calls[0]?.arguments[0]
      if (!interceptOptions?.handler) throw new Error('Expected navigation interception handler')
      let handlerSettled = false
      let adoptedStyleSheetCount = document.adoptedStyleSheets.length
      let startingDocumentHeight = document.documentElement.scrollHeight
      let handler = interceptOptions.handler().then(() => {
        handlerSettled = true
      })
      await Promise.resolve()

      expect(interceptOptions.scroll).toBe(undefined)
      expect(handlerSettled).toBe(false)
      expect(scroll).not.toHaveBeenCalled()
      expect(document.adoptedStyleSheets).toHaveLength(adoptedStyleSheetCount + 1)
      let stylesheet = document.adoptedStyleSheets[adoptedStyleSheetCount]
      let rule = stylesheet?.cssRules[0]
      if (!(rule instanceof CSSStyleRule)) throw new Error('Expected document height CSS rule')
      expect(rule.selectorText).toBe('html')
      expect(rule.style.minHeight).toBe(`${startingDocumentHeight}px`)
      expect(rule.style.getPropertyPriority('min-height')).toBe('important')

      resolveReload({ signal: event.signal })
      await handler

      expect(scroll).not.toHaveBeenCalled()
      expect(document.adoptedStyleSheets).toHaveLength(adoptedStyleSheetCount + 1)
      navigationEvents.dispatchEvent(new Event('navigatesuccess'))
      expect(document.adoptedStyleSheets).toHaveLength(adoptedStyleSheetCount)
    } finally {
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
      reloadFrame: async (_frame, options) => ({ signal: await reload(options) }),
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
    let reloadFrame = mock.fn(async () => {
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
    let reloadFrame = mock.fn(async (frame: FrameHandle) => ({
      signal: new AbortController().signal,
      redirectedTo: frame === childFrame ? redirectedFrameUrl.href : undefined,
    }))
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
      reloadFrame: (_frame, options) => reload(options),
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
      reloadFrame: (_frame, options) => reload(options),
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
      reloadFrame: async (_frame, options) => ({ signal: await reload(options) }),
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
      reloadFrame: (_frame, options) => reload(options),
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
      reloadFrame: (frame, options) => (frame === namedFrame ? namedReload(options) : topReload()),
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
      reloadFrame: (_frame, options) => reload(options),
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
      reloadFrame: (_frame, options) => reload(options),
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
  },
): Event {
  return Object.assign(new Event('navigate'), {
    canIntercept: true,
    navigationType: 'push',
    sourceElement: anchor,
    signal: new AbortController().signal,
    destination: {
      url: options.destinationUrl,
      key: 'next',
      getState: () => undefined,
    },
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
