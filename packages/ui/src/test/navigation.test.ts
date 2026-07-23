import { expect } from '@remix-run/assert'
import { afterEach, describe, it, mock, type TestContext } from '@remix-run/test'
import {
  navigate,
  startNavigationListener,
  startNavigationListenerImpl,
} from '../runtime/navigation.ts'
import type { FrameHandle, FrameReloadOptions } from '../runtime/component.ts'

// Stand-in frame the navigation handler can call without dragging in the
// full app runtime from ./run.ts. Only `src` and `reload` are touched on
// the path under test.
const stubFrame = {
  src: '',
  reload: async () => {},
} as unknown as FrameHandle

const stubFrames = {
  getTopFrame: () => stubFrame,
  getNamedFrame: () => stubFrame,
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
})

describe('form navigation', () => {
  afterEach(() => {
    document.body.textContent = ''
  })

  it('replaces same-location POST submission history before commit when supported', async () => {
    expect(typeof Reflect.get(window, 'NavigationPrecommitController')).toBe('function')

    let reload = mock.fn(async (_options?: FrameReloadOptions) => new AbortController().signal)
    let topFrame = { src: '', reload } as unknown as FrameHandle
    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, {
      getTopFrame: () => topFrame,
      getNamedFrame: () => topFrame,
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

    let reload = mock.fn(async (_options?: FrameReloadOptions) => new AbortController().signal)
    let topFrame = { src: '', reload } as unknown as FrameHandle
    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, {
      getTopFrame: () => topFrame,
      getNamedFrame: () => topFrame,
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

  it('pushes POST submission history for a different location', async () => {
    let reload = mock.fn(async (_options?: FrameReloadOptions) => new AbortController().signal)
    let topFrame = { src: '', reload } as unknown as FrameHandle
    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, {
      getTopFrame: () => topFrame,
      getNamedFrame: () => topFrame,
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
    let topReload = mock.fn(async () => new AbortController().signal)
    let namedReload = mock.fn(async (_options?: FrameReloadOptions) => new AbortController().signal)
    let topFrame = { src: '', reload: topReload } as unknown as FrameHandle
    let namedFrame = { src: '', reload: namedReload } as unknown as FrameHandle
    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, {
      getTopFrame: () => topFrame,
      getNamedFrame(name) {
        expect(name).toBe('account')
        return namedFrame
      },
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
    button.setAttribute('rmx-target', 'account')
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

  it('pushes GET values in the URL without duplicating the formdata event', async () => {
    let reload = mock.fn(async (_options?: FrameReloadOptions) => new AbortController().signal)
    let topFrame = { src: '', reload } as unknown as FrameHandle
    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, {
      getTopFrame: () => topFrame,
      getNamedFrame: () => topFrame,
    })

    let formDataEventCount = 0
    let form = document.createElement('form')
    form.action = window.location.href
    form.method = 'get'
    form.addEventListener('formdata', () => {
      formDataEventCount++
    })
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
      expect(options?.method).toBe('get')
      expect(options?.encType).toBe('application/x-www-form-urlencoded')
      expect(options?.formData?.get('query')).toBe('frames')
      expect(formDataEventCount).toBe(1)
    } finally {
      if (didNavigate) await window.navigation.back().finished
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
    form.setAttribute('rmx-document', '')
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

  it('does not intercept forms when the runtime has no frame resolver', (t) => {
    let navigateListener: EventListener | undefined
    let stubNavigation = {
      updateCurrentEntry: mock.fn(),
      addEventListener(type: string, listener: EventListener) {
        if (type === 'navigate') navigateListener = listener
      },
    }
    stubGlobalField(t, 'navigation', stubNavigation)

    let controller = new AbortController()
    startNavigationListener(controller.signal, false)
    let form = document.createElement('form')
    let intercept = mock.fn()

    navigateListener?.(
      createFormNavigateEvent(form, {
        intercept,
        destinationUrl: new URL('/login', window.location.origin).href,
      }),
    )

    expect(intercept).not.toHaveBeenCalled()
    expect(stubNavigation.updateCurrentEntry).not.toHaveBeenCalled()
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
