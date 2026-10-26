import * as assert from '@remix-run/assert'
import type { RemixNode } from '@remix-run/component'
import { render } from '@remix-run/component/test'
import type { TestContext } from '@remix-run/test'

export async function mount(t: TestContext, node: RemixNode): Promise<ReturnType<typeof render>> {
  let result = render(node)
  t.after(result.cleanup)
  await frame()
  await frame()
  return result
}

export function element(container: ParentNode, selector: string): HTMLElement {
  let match = container.querySelector(selector)
  assert.ok(match instanceof HTMLElement, `Missing element matching ${selector}`)
  return match
}

export function button(container: ParentNode, text: string): HTMLButtonElement {
  let match = [...container.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === text || button.getAttribute('aria-label') === text,
  )
  assert.ok(match, `Missing button ${text}`)
  return match
}

export function frame(): Promise<void> {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

export async function waitFor(check: () => void): Promise<void> {
  let deadline = performance.now() + 3000
  while (true) {
    try {
      check()
      return
    } catch (error) {
      if (performance.now() >= deadline) throw error
    }
    await frame()
  }
}

// Synthetic pointers cannot acquire native capture. Real capture is covered by the docs e2e tests.
export function pointer(target: HTMLElement, type: string, x: number, y: number): void {
  if (type === 'pointerdown') {
    Object.defineProperty(target, 'setPointerCapture', { configurable: true, value() {} })
  }
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX: x,
      clientY: y,
    }),
  )
}

export function position(target: HTMLElement): { x: number; y: number } {
  let [x, y] = getComputedStyle(target).translate.split(' ')
  return { x: Number.parseFloat(x) || 0, y: Number.parseFloat(y) || 0 }
}
