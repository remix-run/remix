import { expect } from '@remix-run/assert'
import 'axe-core'
import type { createRoot } from '@remix-run/component'
import type { AxeResults } from 'axe-core'

export type Overlay = {
  root: ReturnType<typeof createRoot>
  /** Element that receives focus again when the overlay closes. */
  trigger: HTMLElement
  /** Element that carries `data-open` and `data-state`. */
  surface: HTMLElement
  /** Focusable content that is not part of the overlay. */
  outside: HTMLElement
  /** Opens the overlay the way a user would and waits for it to settle. */
  open(): Promise<void>
}

export type OverlayOptions = {
  /** The overlay keeps focus on its trigger (for example, a combobox input). */
  focusStaysOnTrigger?: boolean
}

export async function settle(root: ReturnType<typeof createRoot>) {
  root.flush()
  for (let round = 0; round < 2; round++) {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
    await Promise.resolve()
    root.flush()
  }
}

export function isOpen(surface: HTMLElement) {
  return surface.hasAttribute('data-open')
}

export function pressEscape() {
  let target = document.activeElement ?? document.body
  target.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' }),
  )
}

export function pressOutside(target: HTMLElement) {
  for (let type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    let Event = type.startsWith('pointer') ? PointerEvent : MouseEvent
    target.dispatchEvent(new Event(type, { bubbles: true, cancelable: true, button: 0 }))
  }
}

export async function expectAccessible(overlay: Overlay) {
  await overlay.open()
  let axe = (
    globalThis as unknown as { axe: { run(context: Node, options: object): Promise<AxeResults> } }
  ).axe
  // Fixtures are unstyled fragments, so contrast and document-level rules cannot be judged.
  let results = await axe.run(document, {
    rules: {
      'color-contrast': { enabled: false },
      'html-has-lang': { enabled: false },
      'landmark-one-main': { enabled: false },
      'page-has-heading-one': { enabled: false },
      region: { enabled: false },
    },
  })
  expect(
    results.violations.map((violation) => ({
      id: violation.id,
      targets: violation.nodes.map((node) => node.target.join(' ')),
    })),
  ).toEqual([])
}

export async function expectFocusMovesInAndReturns(overlay: Overlay, options: OverlayOptions = {}) {
  overlay.trigger.focus()
  await overlay.open()
  if (options.focusStaysOnTrigger) {
    expect(document.activeElement).toBe(overlay.trigger)
  } else {
    expect(overlay.surface.contains(document.activeElement)).toBe(true)
  }
  pressEscape()
  await settle(overlay.root)
  expect(isOpen(overlay.surface)).toBe(false)
  expect(document.activeElement).toBe(overlay.trigger)
}

export async function expectEscapeClosesTopmostOnly(parent: Overlay, child: Overlay) {
  await parent.open()
  await child.open()
  pressEscape()
  await settle(parent.root)
  expect(isOpen(child.surface)).toBe(false)
  expect(isOpen(parent.surface)).toBe(true)
  pressEscape()
  await settle(parent.root)
  expect(isOpen(parent.surface)).toBe(false)
}

export async function expectOutsidePressDismisses(overlay: Overlay) {
  await overlay.open()
  pressOutside(overlay.outside)
  await settle(overlay.root)
  expect(isOpen(overlay.surface)).toBe(false)
}

export async function expectOutsideShielded(overlay: Overlay) {
  function shielded() {
    return {
      inert: overlay.outside.closest('[inert]') !== null,
      ariaHidden: overlay.outside.closest('[aria-hidden="true"]') !== null,
    }
  }
  expect(shielded()).toEqual({ inert: false, ariaHidden: false })
  await overlay.open()
  expect(shielded()).toEqual({ inert: true, ariaHidden: true })
  expect(overlay.surface.closest('[inert], [aria-hidden="true"]')).toBe(null)
  pressEscape()
  await settle(overlay.root)
  expect(shielded()).toEqual({ inert: false, ariaHidden: false })
}

export async function expectScrollLockAppliedAndRestored(overlay: Overlay) {
  // Computed style, because the lock may come from a stylesheet rather than an inline style.
  let overflow = getComputedStyle(document.documentElement).overflow
  await overlay.open()
  expect(getComputedStyle(document.documentElement).overflow).toBe('hidden')
  pressEscape()
  await settle(overlay.root)
  expect(getComputedStyle(document.documentElement).overflow).toBe(overflow)
}

export async function expectExitRetainsLayer(overlay: Overlay) {
  await overlay.open()
  expect(overlay.surface.getAttribute('data-state')).toBe('open')
  let animation = overlay.surface.animate({ opacity: [1, 0] }, { duration: 10000 })
  animation.pause()
  pressEscape()
  await settle(overlay.root)
  expect(isOpen(overlay.surface)).toBe(true)
  expect(overlay.surface.getAttribute('data-state')).toBe('closed')
  animation.finish()
  await settle(overlay.root)
  expect(isOpen(overlay.surface)).toBe(false)
}
