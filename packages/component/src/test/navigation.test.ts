import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/run.ts', () => ({
  getTopFrame() {
    return {
      src: '',
      reload: async () => {},
    }
  },
  getNamedFrame() {
    return {
      src: '',
      reload: async () => {},
    }
  },
}))

import { navigate, startNavigationListener } from '../lib/navigation.ts'

describe('navigate', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('passes runtime state via navigate history state', async () => {
    let navigateMock = vi.fn(() => ({ finished: Promise.resolve() }))
    vi.stubGlobal('navigation', { navigate: navigateMock })

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

  it('passes resetScroll=false when requested', async () => {
    let navigateMock = vi.fn(() => ({ finished: Promise.resolve() }))
    vi.stubGlobal('navigation', { navigate: navigateMock })

    await navigate('/login', {
      resetScroll: false,
    })

    expect(navigateMock).toHaveBeenCalledWith('/login', {
      state: { target: undefined, src: '/login', resetScroll: false, $rmx: true },
      history: undefined,
    })
  })

  it('does not intercept anchors marked for document navigation', () => {
    let navigation = Object.assign(new EventTarget(), {
      navigate: vi.fn(() => ({ finished: Promise.resolve() })),
      updateCurrentEntry: vi.fn(),
    })
    vi.stubGlobal('navigation', navigation)

    let controller = new AbortController()
    startNavigationListener(controller.signal)

    let anchor = document.createElement('a')
    anchor.href = '/login'
    anchor.setAttribute('rmx-document', '')
    document.body.append(anchor)
    anchor.addEventListener('click', (event) => event.preventDefault())

    let clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true })
    anchor.dispatchEvent(clickEvent)

    expect(navigation.navigate).not.toHaveBeenCalled()
    expect(clickEvent.defaultPrevented).toBe(true)

    anchor.remove()
    controller.abort()
  })

  it('does not intercept anchors marked for download', () => {
    let navigation = Object.assign(new EventTarget(), {
      navigate: vi.fn(() => ({ finished: Promise.resolve() })),
      updateCurrentEntry: vi.fn(),
    })
    vi.stubGlobal('navigation', navigation)

    let controller = new AbortController()
    startNavigationListener(controller.signal)

    let anchor = document.createElement('a')
    anchor.href = '/report.csv'
    anchor.setAttribute('download', '')
    document.body.append(anchor)
    anchor.addEventListener('click', (event) => event.preventDefault())

    let clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true })
    anchor.dispatchEvent(clickEvent)

    expect(navigation.navigate).not.toHaveBeenCalled()
    expect(clickEvent.defaultPrevented).toBe(true)

    anchor.remove()
    controller.abort()
  })

  it('intercepts anchors when sourceElement is a nested svg node', () => {
    let navigateListener: EventListener | undefined
    let navigation = {
      navigate: vi.fn(() => ({ finished: Promise.resolve() })),
      updateCurrentEntry: vi.fn(),
      addEventListener(type: string, listener: EventListener) {
        if (type === 'navigate') {
          navigateListener = listener
        }
      },
    }
    vi.stubGlobal('navigation', navigation)

    let controller = new AbortController()
    startNavigationListener(controller.signal)

    let anchor = document.createElement('a')
    anchor.href = '/logo'
    let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    let path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    svg.append(path)
    anchor.append(svg)

    let intercept = vi.fn()
    let event = Object.assign(new Event('navigate'), {
      canIntercept: true,
      navigationType: 'push',
      sourceElement: path,
      destination: {
        url: 'https://example.com/logo',
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
