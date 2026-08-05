import { expect } from '@remix-run/assert'
import { afterEach, describe, it, mock, type TestContext } from '@remix-run/test'
import { navigate, startNavigationListenerImpl } from '../runtime/navigation.ts'
import type { FrameHandle } from '../runtime/component.ts'

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
    anchor.setAttribute('rmx-document', '')
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
