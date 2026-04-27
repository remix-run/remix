import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createRoot, type Handle } from '@remix-run/component'

import { lockScroll, lockScrollOnToggle } from './scroll-lock.ts'

let roots: ReturnType<typeof createRoot>[] = []
let currentScrollX = 24
let currentScrollY = 120

function dispatchBeforeToggle(target: HTMLElement, newState: 'closed' | 'open') {
  let event = new Event('beforetoggle', { bubbles: true }) as Event & {
    newState: 'closed' | 'open'
  }
  Object.defineProperty(event, 'newState', {
    configurable: true,
    value: newState,
  })
  target.dispatchEvent(event)
}

function ScrollLockSurface(handle: Handle<{ mounted?: boolean }>) {
  return () => (handle.props.mounted ?? true ? <div id="surface" mix={lockScrollOnToggle()} /> : null)
}

function renderSurface(props: { mounted?: boolean } = {}) {
  let container = document.createElement('div')
  document.body.append(container)

  let root = createRoot(container)
  root.render(<ScrollLockSurface {...props} />)
  root.flush()

  roots.push(root)

  return { container, root }
}

beforeEach(() => {
  currentScrollX = 24
  currentScrollY = 120
  document.body.removeAttribute('style')
  document.documentElement.removeAttribute('style')

  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 1000,
    writable: true,
  })

  Object.defineProperty(window, 'scrollX', {
    configurable: true,
    get: () => currentScrollX,
  })

  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    get: () => currentScrollY,
  })

  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value: 980,
  })

  vi.spyOn(window, 'scrollTo').mockImplementation(
    (xOrOptions?: number | ScrollToOptions, y?: number) => {
      if (xOrOptions && typeof xOrOptions === 'object') {
        currentScrollX = xOrOptions.left ?? currentScrollX
        currentScrollY = xOrOptions.top ?? currentScrollY
        return
      }

      currentScrollX = xOrOptions ?? currentScrollX
      currentScrollY = y ?? currentScrollY
    },
  )
})

afterEach(() => {
  for (let root of roots) {
    root.render(null)
    root.flush()
  }

  roots = []
  document.body.innerHTML = ''
  document.body.removeAttribute('style')
  document.documentElement.removeAttribute('style')
  vi.restoreAllMocks()
})

describe('lockScroll', () => {
  it('locks document scrolling and restores inline styles on unlock', () => {
    document.documentElement.style.overflow = 'auto'
    document.documentElement.style.scrollbarGutter = 'stable both-edges'
    document.body.style.overflow = 'clip'
    document.body.style.position = 'relative'
    document.body.style.top = '1px'
    document.body.style.left = '2px'
    document.body.style.right = '3px'
    document.body.style.width = '80%'
    document.body.style.paddingRight = '4px'

    let unlock = lockScroll()

    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.documentElement.style.scrollbarGutter).toBe('stable both-edges')
    expect(document.body.style.overflow).toBe('clip')
    expect(document.body.style.position).toBe('relative')
    expect(document.body.style.top).toBe('1px')
    expect(document.body.style.left).toBe('2px')
    expect(document.body.style.right).toBe('3px')
    expect(document.body.style.width).toBe('80%')
    expect(document.body.style.paddingRight).toBe('4px')

    unlock()

    expect(document.documentElement.style.overflow).toBe('auto')
    expect(document.documentElement.style.scrollbarGutter).toBe('stable both-edges')
    expect(document.body.style.overflow).toBe('clip')
    expect(document.body.style.position).toBe('relative')
    expect(document.body.style.top).toBe('1px')
    expect(document.body.style.left).toBe('2px')
    expect(document.body.style.right).toBe('3px')
    expect(document.body.style.width).toBe('80%')
    expect(document.body.style.paddingRight).toBe('4px')
    expect(window.scrollTo).toHaveBeenCalledWith(24, 120)
  })

  it('reserves the scrollbar gutter while locked', () => {
    let unlock = lockScroll()

    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.documentElement.style.scrollbarGutter).toBe('stable')

    unlock()

    expect(document.documentElement.style.overflow).toBe('')
    expect(document.documentElement.style.scrollbarGutter).toBe('')
  })

  it('keeps the document locked until the last unlock runs', () => {
    let unlockFirst = lockScroll()
    let unlockSecond = lockScroll()

    unlockFirst()

    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(window.scrollTo).not.toHaveBeenCalled()

    unlockSecond()
    unlockSecond()

    expect(document.documentElement.style.overflow).toBe('')
    expect(window.scrollTo).toHaveBeenCalledOnce()
  })
})

describe('lockScrollOnToggle', () => {
  it('locks on open beforetoggle and unlocks on close beforetoggle', () => {
    let { container } = renderSurface()
    let surface = container.querySelector('#surface') as HTMLDivElement

    dispatchBeforeToggle(surface, 'open')

    expect(document.documentElement.style.overflow).toBe('hidden')

    dispatchBeforeToggle(surface, 'closed')

    expect(document.documentElement.style.overflow).toBe('')
    expect(window.scrollTo).toHaveBeenCalledWith(24, 120)
  })

  it('releases the lock when the host unmounts while open', () => {
    let { container, root } = renderSurface()
    let surface = container.querySelector('#surface') as HTMLDivElement

    dispatchBeforeToggle(surface, 'open')

    expect(document.documentElement.style.overflow).toBe('hidden')

    root.render(<ScrollLockSurface mounted={false} />)
    root.flush()

    expect(document.documentElement.style.overflow).toBe('')
    expect(window.scrollTo).toHaveBeenCalledWith(24, 120)
  })
})
