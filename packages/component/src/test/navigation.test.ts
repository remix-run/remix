import { afterEach, describe, expect, it, vi } from 'vitest'

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
})
