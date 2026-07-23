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

  it('replaces POST submission history before commit when supported', async (t) => {
    let navigateListener: EventListener | undefined
    let stubNavigation = {
      updateCurrentEntry: mock.fn(),
      addEventListener(type: string, listener: EventListener) {
        if (type === 'navigate') navigateListener = listener
      },
    }
    stubGlobalField(t, 'navigation', stubNavigation)
    stubGlobalField(t, 'NavigationPrecommitController', class {})

    let reload = mock.fn(async (_options?: FrameReloadOptions) => new AbortController().signal)
    let topFrame = { src: '', reload } as unknown as FrameHandle
    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, {
      getTopFrame: () => topFrame,
      getNamedFrame: () => topFrame,
    })

    let form = document.createElement('form')
    form.method = 'post'
    let input = document.createElement('input')
    input.name = 'displayName'
    input.value = 'Ada'
    form.append(input)

    let handler: (() => Promise<void>) | undefined
    let precommitHandler:
      | ((controller: { redirect(url: string, init: unknown): void }) => void)
      | undefined
    let intercept = mock.fn((options?: NavigationInterceptOptions) => {
      handler = options?.handler
      let candidate = options && Reflect.get(options, 'precommitHandler')
      if (typeof candidate === 'function') {
        precommitHandler = (controller) => candidate(controller)
      }
    })
    let destinationUrl = new URL('/account', window.location.origin).href
    let event = createFormNavigateEvent(form, { intercept, destinationUrl, cancelable: true })

    navigateListener?.(event)

    let redirect = mock.fn()
    precommitHandler?.({ redirect })
    expect(redirect).toHaveBeenCalledWith(destinationUrl, { history: 'replace' })

    await handler?.()
    expect(reload.mock.calls[0]?.arguments[0]?.method).toBe('post')
    expect(reload.mock.calls[0]?.arguments[0]?.formData?.get('displayName')).toBe('Ada')

    controller.abort()
  })

  it('replays POST submissions as replace navigations without precommit support', async (t) => {
    let navigateListener: EventListener | undefined
    let navigate = mock.fn((_url: string, _options?: NavigationNavigateOptions) => ({
      committed: Promise.resolve(undefined),
      finished: Promise.resolve(undefined),
    }))
    let stubNavigation = {
      navigate,
      updateCurrentEntry: mock.fn(),
      addEventListener(type: string, listener: EventListener) {
        if (type === 'navigate') navigateListener = listener
      },
    }
    stubGlobalField(t, 'navigation', stubNavigation)
    stubGlobalField(t, 'NavigationPrecommitController', undefined)

    let reload = mock.fn(async (_options?: FrameReloadOptions) => new AbortController().signal)
    let topFrame = { src: '', reload } as unknown as FrameHandle
    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, {
      getTopFrame: () => topFrame,
      getNamedFrame: () => topFrame,
    })

    let form = document.createElement('form')
    form.method = 'post'
    form.setAttribute('rmx-target', 'account')
    let input = document.createElement('input')
    input.name = 'displayName'
    input.value = 'Ada'
    form.append(input)

    let destinationUrl = new URL('/account', window.location.origin).href
    let initialIntercept = mock.fn()
    let initialEvent = createFormNavigateEvent(form, {
      intercept: initialIntercept,
      destinationUrl,
      cancelable: true,
    })

    navigateListener?.(initialEvent)

    expect(initialEvent.defaultPrevented).toBe(true)
    expect(initialIntercept).not.toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledTimes(1)
    let replayOptions = navigate.mock.calls[0]?.arguments[1]
    expect(replayOptions?.history).toBe('replace')
    expect(replayOptions?.state).toEqual({
      target: 'account',
      src: destinationUrl,
      resetScroll: true,
      $rmx: true,
    })

    let handler: (() => Promise<void>) | undefined
    navigateListener?.(
      Object.assign(new Event('navigate'), {
        canIntercept: true,
        navigationType: 'replace',
        info: replayOptions?.info,
        signal: new AbortController().signal,
        destination: {
          url: destinationUrl,
          key: 'replayed',
          getState: () => replayOptions?.state,
        },
        intercept(options?: NavigationInterceptOptions) {
          handler = options?.handler
        },
      }),
    )
    await handler?.()

    expect(reload).toHaveBeenCalledTimes(1)
    expect(reload.mock.calls[0]?.arguments[0]?.method).toBe('post')
    expect(reload.mock.calls[0]?.arguments[0]?.formData?.get('displayName')).toBe('Ada')

    controller.abort()
  })

  it('does not replace GET submission history', (t) => {
    let navigateListener: EventListener | undefined
    let stubNavigation = {
      updateCurrentEntry: mock.fn(),
      addEventListener(type: string, listener: EventListener) {
        if (type === 'navigate') navigateListener = listener
      },
    }
    stubGlobalField(t, 'navigation', stubNavigation)
    stubGlobalField(t, 'NavigationPrecommitController', class {})

    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, stubFrames)

    let form = document.createElement('form')
    form.method = 'get'
    let interceptOptions: NavigationInterceptOptions | undefined
    navigateListener?.(
      createFormNavigateEvent(form, {
        intercept(options) {
          interceptOptions = options
        },
        destinationUrl: new URL('/search?q=frames', window.location.origin).href,
        cancelable: true,
      }),
    )

    expect(interceptOptions).toBeDefined()
    expect(interceptOptions && Reflect.has(interceptOptions, 'precommitHandler')).toBe(false)

    controller.abort()
  })

  it('reloads a targeted frame with submitter-overridden submission metadata', async (t) => {
    let navigateListener: EventListener | undefined
    let updateCurrentEntry = mock.fn()
    let stubNavigation = {
      updateCurrentEntry,
      addEventListener(type: string, listener: EventListener) {
        if (type === 'navigate') navigateListener = listener
      },
    }
    stubGlobalField(t, 'navigation', stubNavigation)

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

    let form = document.createElement('form')
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

    form.dispatchEvent(
      new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: button }),
    )

    let formData = new FormData(form, button)
    let navigationController = new AbortController()
    let handler: (() => Promise<void>) | undefined
    let intercept = mock.fn((options?: NavigationInterceptOptions) => {
      handler = options?.handler
    })
    let destinationUrl = new URL('/account', window.location.origin).href
    let event = Object.assign(new Event('navigate'), {
      canIntercept: true,
      navigationType: 'push',
      sourceElement: form,
      formData,
      signal: navigationController.signal,
      destination: {
        url: destinationUrl,
        key: 'next',
        getState: () => undefined,
      },
      intercept,
    })

    navigateListener?.(event)
    expect(intercept).toHaveBeenCalledTimes(1)
    await handler?.()

    expect(topReload).not.toHaveBeenCalled()
    expect(namedFrame.src).toBe(destinationUrl)
    expect(namedReload).toHaveBeenCalledWith({
      formData,
      method: 'post',
      encType: 'multipart/form-data',
      signal: navigationController.signal,
    })
    expect(updateCurrentEntry.mock.calls.at(-1)?.arguments[0]).toEqual({
      state: {
        target: 'account',
        src: destinationUrl,
        resetScroll: true,
        $rmx: true,
      },
    })

    controller.abort()
  })

  it('passes GET submission metadata and reloads the top frame', async (t) => {
    let navigateListener: EventListener | undefined
    let stubNavigation = {
      updateCurrentEntry: mock.fn(),
      addEventListener(type: string, listener: EventListener) {
        if (type === 'navigate') navigateListener = listener
      },
    }
    stubGlobalField(t, 'navigation', stubNavigation)

    let reload = mock.fn(async (_options?: FrameReloadOptions) => new AbortController().signal)
    let topFrame = { src: '', reload } as unknown as FrameHandle
    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, {
      getTopFrame: () => topFrame,
      getNamedFrame: () => topFrame,
    })

    let form = document.createElement('form')
    form.method = 'get'
    let input = document.createElement('input')
    input.name = 'query'
    input.value = 'frames'
    form.append(input)
    document.body.append(form)

    let handler: (() => Promise<void>) | undefined
    let destinationUrl = new URL('/search?query=frames', window.location.origin).href
    navigateListener?.(
      Object.assign(new Event('navigate'), {
        canIntercept: true,
        navigationType: 'push',
        sourceElement: form,
        formData: null,
        signal: new AbortController().signal,
        destination: {
          url: destinationUrl,
          key: 'next',
          getState: () => undefined,
        },
        intercept(options?: NavigationInterceptOptions) {
          handler = options?.handler
        },
      }),
    )
    await handler?.()

    expect(topFrame.src).toBe(destinationUrl)
    expect(reload).toHaveBeenCalledTimes(1)
    let options = reload.mock.calls[0]?.arguments[0]
    expect(options?.method).toBe('get')
    expect(options?.encType).toBe('application/x-www-form-urlencoded')
    expect(options?.formData).toBe(undefined)

    controller.abort()
  })

  it('intercepts a real browser form submission after the submit event', async () => {
    let { promise, resolve } = Promise.withResolvers<FrameReloadOptions | undefined>()
    let topFrame = {
      src: '',
      async reload(options?: FrameReloadOptions) {
        resolve(options)
        return new AbortController().signal
      },
    } as unknown as FrameHandle
    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, {
      getTopFrame: () => topFrame,
      getNamedFrame: () => topFrame,
    })

    let form = document.createElement('form')
    form.action = window.location.href
    let input = document.createElement('input')
    input.name = 'email'
    input.value = 'ada@example.com'
    let button = document.createElement('button')
    button.name = 'intent'
    button.value = 'login'
    button.setAttribute('formmethod', 'post')
    button.setAttribute('formenctype', 'multipart/form-data')
    form.append(input, button)
    document.body.append(form)

    let entriesBeforeSubmission = window.navigation.entries().length
    let navigationSucceeded = new Promise<void>((resolve) => {
      window.navigation.addEventListener('navigatesuccess', () => resolve(), { once: true })
    })
    form.requestSubmit(button)
    let [options] = await Promise.all([promise, navigationSucceeded])

    expect(options?.method).toBe('post')
    expect(options?.encType).toBe('multipart/form-data')
    expect(options?.formData?.get('email')).toBe('ada@example.com')
    expect(options?.formData?.get('intent')).toBe('login')
    expect(options?.signal).toBeInstanceOf(AbortSignal)
    expect(window.navigation.entries().length).toBe(entriesBeforeSubmission)

    controller.abort()
  })

  it('leaves GET values in the URL without duplicating the formdata event', async () => {
    let { promise, resolve } = Promise.withResolvers<FrameReloadOptions | undefined>()
    let topFrame = {
      src: '',
      async reload(options?: FrameReloadOptions) {
        resolve(options)
        return new AbortController().signal
      },
    } as unknown as FrameHandle
    let controller = new AbortController()
    startNavigationListenerImpl(controller.signal, {
      getTopFrame: () => topFrame,
      getNamedFrame: () => topFrame,
    })

    let formDataEventCount = 0
    let form = document.createElement('form')
    form.action = window.location.href
    form.addEventListener('formdata', () => {
      formDataEventCount++
    })
    let input = document.createElement('input')
    input.name = 'query'
    input.value = 'frames'
    form.append(input)
    document.body.append(form)

    form.requestSubmit()
    let options = await promise

    expect(options?.method).toBe('get')
    expect(options?.formData?.get('query')).toBe('frames')
    expect(formDataEventCount).toBe(1)

    controller.abort()
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
