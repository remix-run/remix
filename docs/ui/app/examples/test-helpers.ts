import * as assert from 'remix/assert'
import type { RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import type { TestContext } from 'remix/test'

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

export function input(container: ParentNode, selector = 'input'): HTMLInputElement {
  let match = element(container, selector)
  assert.ok(match instanceof HTMLInputElement)
  return match
}

export function button(container: ParentNode, text: string): HTMLButtonElement {
  let match = [...container.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === text || button.getAttribute('aria-label') === text,
  )
  assert.ok(match, `Missing button ${text}`)
  return match
}

export function key(target: HTMLElement, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

export function enterText(target: HTMLInputElement, value: string): void {
  target.value = value
  target.dispatchEvent(
    new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }),
  )
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

export async function finishAnimations(target: Element): Promise<void> {
  await frame()
  await Promise.all(target.getAnimations({ subtree: true }).map((animation) => animation.finished))
  await frame()
}

export async function expectAnimation(target: Element, property = 'transform'): Promise<void> {
  let animations: Animation[] = []
  await waitFor(() => {
    animations = target.getAnimations().filter((animation) => {
      let effect = animation.effect
      if (!(effect instanceof KeyframeEffect) || effect.target !== target) return false
      let values = effect.getKeyframes().map((frame) => frame[property])
      return values.some((value) => value !== undefined) && new Set(values).size > 1
    })
    assert.ok(animations.length > 0, `${property} animates on the expected element`)
  })
  await Promise.all(animations.map((animation) => animation.finished))
  await frame()
}
