import { expect } from '@remix-run/assert'
import { afterEach, describe, it, type TestContext } from '@remix-run/test'

import { createRoot } from '../vdom.ts'
import { invariant } from '../invariant.ts'
import type { RemixNode } from '../jsx.ts'
import { link } from './link-mixin.ts'

function render(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  root.flush()
  return { container, root }
}

function stubGlobal(t: TestContext, api: string, method: string, impl: any) {
  return t.mock.method((globalThis as any)[api], method, impl)
}

describe('link mixin', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('adds href and runtime attributes to anchors', () => {
    let { container } = render(
      <a mix={link('/login', { src: '/partials/login', target: 'auth', resetScroll: false })}>
        Login
      </a>,
    )

    let anchor = container.querySelector('a')
    invariant(anchor)
    expect(anchor.getAttribute('href')).toBe('/login')
    expect(anchor.getAttribute('rmx-target')).toBe('auth')
    expect(anchor.getAttribute('rmx-src')).toBe('/partials/login')
    expect(anchor.getAttribute('rmx-reset-scroll')).toBe('false')
    expect(anchor.getAttribute('role')).toBeNull()
  })

  it('adds link semantics to buttons', () => {
    let { container } = render(<button mix={link('/login')}>Login</button>)

    let button = container.querySelector('button')
    invariant(button)
    expect(button.getAttribute('role')).toBe('link')
    expect(button.getAttribute('type')).toBe('button')
    expect(button.getAttribute('tabindex')).toBeNull()
  })

  it('adds link semantics and tabIndex to generic elements', () => {
    let { container } = render(<li mix={link('/login')}>Login</li>)

    let item = container.querySelector('li')
    invariant(item)
    expect(item.getAttribute('role')).toBe('link')
    expect(item.getAttribute('tabindex')).toBe('0')
  })

  it('omits runtime attributes on anchors when options are not provided', () => {
    let { container } = render(<a mix={link('/docs')}>Docs</a>)

    let anchor = container.querySelector('a')
    invariant(anchor)
    expect(anchor.getAttribute('href')).toBe('/docs')
    expect(anchor.getAttribute('rmx-target')).toBeNull()
    expect(anchor.getAttribute('rmx-src')).toBeNull()
  })

  it('navigates on plain click for non-anchor hosts', (t) => {
    let navigateMock = stubGlobal(t, 'navigation', 'navigate', () => ({
      finished: Promise.resolve(),
    }))

    let { container } = render(<button mix={link('/login', { target: 'auth' })}>Login</button>)

    let button = container.querySelector('button')
    invariant(button)
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(navigateMock).toHaveBeenCalledWith('/login', {
      state: { target: 'auth', src: '/login', resetScroll: true, $rmx: true },
      history: undefined,
    })
  })

  it('passes history options through for non-anchor navigation', (t) => {
    let navigateMock = stubGlobal(t, 'navigation', 'navigate', () => ({
      finished: Promise.resolve(),
    }))

    let { container } = render(<button mix={link('/login', { history: 'replace' })}>Login</button>)

    let button = container.querySelector('button')
    invariant(button)
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(navigateMock).toHaveBeenCalledWith('/login', {
      state: { target: undefined, src: '/login', resetScroll: true, $rmx: true },
      history: 'replace',
    })
  })

  it('passes resetScroll=false through for non-anchor navigation', (t) => {
    let navigateMock = stubGlobal(t, 'navigation', 'navigate', () => ({
      finished: Promise.resolve(),
    }))

    let { container } = render(<button mix={link('/login', { resetScroll: false })}>Login</button>)

    let button = container.querySelector('button')
    invariant(button)
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(navigateMock).toHaveBeenCalledWith('/login', {
      state: { target: undefined, src: '/login', resetScroll: false, $rmx: true },
      history: undefined,
    })
  })

  it('activates link buttons on Enter and suppresses keyboard clicks from Enter and Space', (t) => {
    let navigateMock = stubGlobal(t, 'navigation', 'navigate', () => ({
      finished: Promise.resolve(),
    }))

    let { container } = render(<button mix={link('/login')}>Login</button>)

    let button = container.querySelector('button')
    invariant(button)

    button.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    )
    expect(navigateMock).toHaveBeenCalledTimes(1)

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }))
    expect(navigateMock).toHaveBeenCalledTimes(1)

    button.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }),
    )
    button.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }))
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }))
    expect(navigateMock).toHaveBeenCalledTimes(1)
  })

  it('activates generic link elements on Enter', (t) => {
    let navigateMock = stubGlobal(t, 'navigation', 'navigate', () => ({
      finished: Promise.resolve(),
    }))

    let { container } = render(<li mix={link('/login')}>Login</li>)

    let item = container.querySelector('li')
    invariant(item)
    item.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    )

    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/login', {
      state: { target: undefined, src: '/login', resetScroll: true, $rmx: true },
      history: undefined,
    })
  })

  it('opens a new tab for meta-click, ctrl-click, and middle-click on non-anchor hosts', (t) => {
    let navigateMock = stubGlobal(t, 'navigation', 'navigate', () => ({
      finished: Promise.resolve(),
    }))
    let openMock = stubGlobal(t, 'globalThis', 'open', () => null)

    let { container } = render(<button mix={link('/login')}>Login</button>)

    let button = container.querySelector('button')
    invariant(button)
    button.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }),
    )
    button.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }),
    )
    button.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }))

    expect(openMock).toHaveBeenCalledTimes(3)
    expect(openMock).toHaveBeenNthCalledWith(1, '/login', '_blank')
    expect(openMock).toHaveBeenNthCalledWith(2, '/login', '_blank')
    expect(openMock).toHaveBeenNthCalledWith(3, '/login', '_blank')
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('does not navigate disabled or aria-disabled link hosts', (t) => {
    let navigateMock = stubGlobal(t, 'navigation', 'navigate', () => ({
      finished: Promise.resolve(),
    }))

    let { container } = render(
      <div>
        <button disabled={true} mix={link('/login')}>
          Login
        </button>
        <li aria-disabled="true" mix={link('/help')}>
          Help
        </li>
      </div>,
    )

    let button = container.querySelector('button')
    let item = container.querySelector('li')
    invariant(button)
    invariant(item)

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    item.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    item.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    )

    expect(item.getAttribute('aria-disabled')).toBe('true')
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
