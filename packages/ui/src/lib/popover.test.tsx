// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRoot, type RemixNode } from '@remix-run/component'

import { popover } from './popover.tsx'

function ensureAdoptedStyleSheets() {
  if (document.adoptedStyleSheets) {
    return
  }

  Object.defineProperty(document, 'adoptedStyleSheets', {
    configurable: true,
    value: [],
    writable: true,
  })
}

class MockCSSStyleSheet {
  cssRules: Array<{ cssText: string }> = []

  insertRule(rule: string) {
    this.cssRules.push({ cssText: rule })
    return this.cssRules.length - 1
  }

  deleteRule(index: number) {
    this.cssRules.splice(index, 1)
  }
}

function ensureConstructableStylesheets() {
  globalThis.CSSStyleSheet = MockCSSStyleSheet as unknown as typeof CSSStyleSheet
}

function ensurePopoverMethods() {
  if (typeof HTMLElement.prototype.showPopover !== 'function') {
    HTMLElement.prototype.showPopover = function () {
      let beforetoggle = new Event('beforetoggle')
      Object.assign(beforetoggle, { newState: 'open', oldState: 'closed' })
      this.dispatchEvent(beforetoggle)
      this.dataset.popoverOpen = 'true'
      let toggle = new Event('toggle')
      Object.assign(toggle, { newState: 'open', oldState: 'closed' })
      this.dispatchEvent(toggle)
    }
  }

  if (typeof HTMLElement.prototype.hidePopover !== 'function') {
    HTMLElement.prototype.hidePopover = function () {
      let beforetoggle = new Event('beforetoggle')
      Object.assign(beforetoggle, { newState: 'closed', oldState: 'open' })
      this.dispatchEvent(beforetoggle)
      delete this.dataset.popoverOpen
      let toggle = new Event('toggle')
      Object.assign(toggle, { newState: 'closed', oldState: 'open' })
      this.dispatchEvent(toggle)
    }
  }
}

function renderApp(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  return { container, root }
}

async function flush() {
  await Promise.resolve()
}

function mockLayout(element: HTMLElement, rect: { top: number; left: number; width: number; height: number }) {
  Object.defineProperty(element, 'offsetWidth', {
    configurable: true,
    get: () => rect.width,
  })

  Object.defineProperty(element, 'offsetHeight', {
    configurable: true,
    get: () => rect.height,
  })

  element.getBoundingClientRect = () => new DOMRect(rect.left, rect.top, rect.width, rect.height)
}

ensureAdoptedStyleSheets()
ensureConstructableStylesheets()
ensurePopoverMethods()

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('popover', () => {
  it('defaults to manual and stays closed on insert', async () => {
    let showPopover = vi.spyOn(HTMLElement.prototype, 'showPopover')
    let { container, root } = renderApp(
      <div>
        <button popovertarget="menu" type="button">
          Owner
        </button>
        <div id="menu" mix={popover()}>
          Menu
        </div>
      </div>,
    )
    root.flush()
    await flush()

    let popup = container.querySelector('#menu') as HTMLDivElement

    expect(popup.id).toBeTruthy()
    expect(popup.getAttribute('popover')).toBe('manual')
    expect(showPopover).not.toHaveBeenCalled()
    expect(popup.dataset.popoverOpen).toBeUndefined()
  })

  it('anchors to a trigger that controls its id', async () => {
    let { container, root } = renderApp(
      <div>
        <button id="owner" popovertarget="menu" type="button">
          Owner
        </button>
        <div id="menu" mix={popover()}>
          Menu
        </div>
      </div>,
    )
    root.flush()
    await flush()

    let owner = container.querySelector('#owner') as HTMLButtonElement
    let popup = container.querySelector('#menu') as HTMLDivElement

    mockLayout(owner, { top: 40, left: 200, width: 80, height: 28 })
    mockLayout(popup, { top: 0, left: 0, width: 160, height: 96 })
    window.dispatchEvent(new Event('resize'))

    expect(popup.style.position).toBe('absolute')
    expect(popup.style.top).toBe('68px')
    expect(popup.style.left).toBe('160px')
  })

  it('respects anchor options', async () => {
    let { container, root } = renderApp(
      <div>
        <button id="owner" popovertarget="menu" type="button">
          Owner
        </button>
        <div id="menu" mix={popover({ offset: 8, placement: 'bottom-end' })}>
          Menu
        </div>
      </div>,
    )
    root.flush()
    await flush()

    let owner = container.querySelector('#owner') as HTMLButtonElement
    let popup = container.querySelector('#menu') as HTMLDivElement

    mockLayout(owner, { top: 40, left: 200, width: 80, height: 28 })
    mockLayout(popup, { top: 0, left: 0, width: 160, height: 96 })
    window.dispatchEvent(new Event('resize'))

    expect(popup.style.top).toBe('76px')
    expect(popup.style.left).toBe('120px')
  })

  it('warns when it cannot find an owner', async () => {
    let warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let { container, root } = renderApp(
      <div id="menu" mix={popover()}>
        Menu
      </div>,
    )
    root.flush()
    await flush()

    let popup = container.querySelector('#menu') as HTMLDivElement

    expect(warn).toHaveBeenCalledWith('No popover owner found for #menu')
    expect(popup.getAttribute('popover')).toBe('manual')
  })

})
