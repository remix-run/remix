import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createRoot } from '@remix-run/component'

import { lockScroll, lockScrollOnToggle } from './scroll-lock.ts'

let roots: ReturnType<typeof createRoot>[] = []
let currentScrollX = 24
let currentScrollY = 120

function dispatchBeforeToggle(target: HTMLElement, newState: 'closed' | 'open') {
  let event = new Event('beforetoggle', { bubbles: true }) as Event & { newState: 'closed' | 'open' }
  Object.defineProperty(event, 'newState', {
    configurable: true,
    value: newState,
  })
  target.dispatchEvent(event)
}

function ScrollLockSurface() {
  return ({ mounted = true }: { mounted?: boolean }) =>
    mounted ? <div id="surface" mix={lockScrollOnToggle()} /> : null
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

  vi.spyOn(window, 'scrollTo').mockImplementation((...args) => {
    let [xOrOptions, y] = args

    if (typeof xOrOptions === 'object') {
      currentScrollX = xOrOptions.left ?? currentScrollX
      currentScrollY = xOrOptions.top ?? currentScrollY
      return
    }

    currentScrollX = xOrOptions ?? currentScrollX
    currentScrollY = y ?? currentScrollY
  })
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
    document.body.style.overflow = 'clip'
    document.body.style.position = 'relative'
    document.body.style.top = '1px'
    document.body.style.left = '2px'
    document.body.style.right = '3px'
    document.body.style.width = '80%'
    document.body.style.paddingRight = '4px'

    let unlock = lockScroll()

    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body.style.position).toBe('fixed')
    expect(document.body.style.top).toBe('-120px')
    expect(document.body.style.left).toBe('-24px')
    expect(document.body.style.right).toBe('0px')
    expect(document.body.style.width).toBe('100%')
    expect(document.body.style.paddingRight).toBe('24px')

    unlock()

    expect(document.documentElement.style.overflow).toBe('auto')
    expect(document.body.style.overflow).toBe('clip')
    expect(document.body.style.position).toBe('relative')
    expect(document.body.style.top).toBe('1px')
    expect(document.body.style.left).toBe('2px')
    expect(document.body.style.right).toBe('3px')
    expect(document.body.style.width).toBe('80%')
    expect(document.body.style.paddingRight).toBe('4px')
    expect(window.scrollTo).toHaveBeenCalledWith(24, 120)
  })

  it('keeps the document locked until the last unlock runs', () => {
    let unlockFirst = lockScroll()
    let unlockSecond = lockScroll()

    unlockFirst()

    expect(document.body.style.position).toBe('fixed')
    expect(window.scrollTo).not.toHaveBeenCalled()

    unlockSecond()
    unlockSecond()

    expect(document.body.style.position).toBe('')
    expect(window.scrollTo).toHaveBeenCalledOnce()
  })
})

describe('lockScrollOnToggle', () => {
  it('locks on open beforetoggle and unlocks on close beforetoggle', () => {
    let { container } = renderSurface()
    let surface = container.querySelector('#surface') as HTMLDivElement

    dispatchBeforeToggle(surface, 'open')

    expect(document.body.style.position).toBe('fixed')

    dispatchBeforeToggle(surface, 'closed')

    expect(document.body.style.position).toBe('')
    expect(window.scrollTo).toHaveBeenCalledWith(24, 120)
  })

  it('releases the lock when the host unmounts while open', () => {
    let { container, root } = renderSurface()
    let surface = container.querySelector('#surface') as HTMLDivElement

    dispatchBeforeToggle(surface, 'open')

    expect(document.body.style.position).toBe('fixed')

    root.render(<ScrollLockSurface mounted={false} />)
    root.flush()

    expect(document.body.style.position).toBe('')
    expect(window.scrollTo).toHaveBeenCalledWith(24, 120)
  })
})
