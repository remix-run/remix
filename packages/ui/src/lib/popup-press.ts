import { createMixin, on } from '@remix-run/component'
import { DISABLED, isPlainPress } from './press.ts'

// Travel (px) a held mouse must cover before releasing over an item commits it. A release with
// no travel ends the opening gesture, and the item that happened to land there was never chosen.
const DRAG_COMMIT_DISTANCE = 10

const ITEM = '[role="option"], [role^="menuitem"]'

const LIST = '[role="listbox"], [role="menu"]'

/**
 * Opens a popup on primary-button mouse `pointerdown`, the way native menus do, so that pressing,
 * dragging and releasing over an item commits it in one gesture. Releasing over an `option` or
 * `menuitem*` inside the element referenced by the host's `aria-controls` after moving at least
 * 10px clicks that item. A release over the host leaves the popup open.
 *
 * The popup opens directly, without a click, so no untrusted click is produced. The click that
 * trails the press is cancelled, so the host's `click` listener (which toggles the popup for touch,
 * pen, keyboard and assistive technology) never sees a second activation, and neither does a
 * `press()` composed on the same host. The press doesn't move focus, since the popup does.
 *
 * Pressing while the popup is open is left to the click.
 */
export const openOnPress = createMixin<HTMLElement, [options: { isOpen(): boolean; open(): void }]>(
  (handle) => {
    // `handle.signal` can only be read during setup, not in event handlers.
    let lifetime = handle.signal

    return (options) =>
      on('pointerdown', (event) => {
        let host = event.currentTarget
        if (
          event.pointerType !== 'mouse' ||
          !isPlainPress(event) ||
          host.matches(DISABLED) ||
          options.isOpen()
        ) {
          return
        }

        event.preventDefault()

        let doc = host.ownerDocument
        let blocked = new AbortController()
        let released = new AbortController()

        host.addEventListener(
          'click',
          (click) => {
            click.preventDefault()
            click.stopImmediatePropagation()
          },
          { capture: true, signal: AbortSignal.any([lifetime, blocked.signal]) },
        )

        function end(up: PointerEvent) {
          released.abort()
          // The click, when there is one, is dispatched in the same task as the pointerup.
          setTimeout(() => blocked.abort())

          let controls = host.getAttribute('aria-controls')
          let item =
            up.type === 'pointerup' && up.target instanceof Element ? up.target.closest(ITEM) : null
          if (
            item instanceof HTMLElement &&
            controls &&
            doc.getElementById(controls)?.contains(item) &&
            Math.hypot(up.clientX - event.clientX, up.clientY - event.clientY) >=
              DRAG_COMMIT_DISTANCE
          ) {
            item.click()
          }
        }

        let signal = AbortSignal.any([lifetime, released.signal])
        doc.addEventListener('pointerup', end, { capture: true, signal })
        doc.addEventListener('pointercancel', end, { capture: true, signal })

        options.open()
      })
  },
)

/**
 * Commits the item under the pointer when a primary-button mouse press that started on this item
 * is released over another item of the same list, which is how a press-and-drag selects. The
 * commit happens on release, never on press. A release over the pressed item is its own click,
 * and a release outside the list commits nothing.
 */
export const commitOnRelease = createMixin<HTMLElement, []>((handle) => {
  let lifetime = handle.signal

  return () =>
    on('pointerdown', (event) => {
      let pressed = event.currentTarget
      if (event.pointerType !== 'mouse' || !isPlainPress(event)) return

      let list = pressed.closest(LIST)
      let doc = pressed.ownerDocument
      let released = new AbortController()

      function end(up: PointerEvent) {
        released.abort()

        let item =
          up.type === 'pointerup' && up.target instanceof Element ? up.target.closest(ITEM) : null
        if (
          item instanceof HTMLElement &&
          item !== pressed &&
          list?.contains(item) &&
          item.getAttribute('aria-disabled') !== 'true'
        ) {
          item.click()
        }
      }

      let signal = AbortSignal.any([lifetime, released.signal])
      doc.addEventListener('pointerup', end, { capture: true, signal })
      doc.addEventListener('pointercancel', end, { capture: true, signal })
    })
})
