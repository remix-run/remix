import { defineInteraction, type Interaction } from '../interaction.ts'

/**
 * ### Description
 *
 * Dispatches on the owner of a popover when the popover toggles.
 *
 * ### Example
 *
 * ```html
 * <button popovertarget="my-popover">
 *   Toggle Popover
 * </button>
 * <div id="my-popover" popover>
 *   <p>Hello, world!</p>
 * </div>
 * ```
 *
 * ```ts
 * import { popoverToggle } from 'remix/interaction/popover'
 * on(button, {
 *   [popoverToggle](event) {
 *     console.log('I am not the popover but the owner')
 *     console.log(event.newState) // 'open' or 'closed'
 *     console.log(event.oldState) // 'open' or 'closed'
 *   },
 * })
 * ```
 */
export let popoverToggle = defineInteraction('rmx:popover-toggle', Popover)

/**
 * ### Description
 *
 * Dispatches on the owner of a popover before the popover toggles.
 *
 * ### Example
 *
 * ```html
 * <button popovertarget="my-popover">
 *   Toggle Popover
 * </button>
 * <div id="my-popover" popover>
 *   <p>Hello, world!</p>
 * </div>
 * ```
 * ```ts
 * import { popoverToggle } from 'remix/interaction/popover'
 * on(button, {
 *   [beforePopoverToggle](event) {
 *     console.log('I am not the popover but the owner')
 *     console.log(event.newState) // 'open' or 'closed'
 *     console.log(event.oldState) // 'open' or 'closed'
 *   },
 * })
 * ```
 */
export let beforePopoverToggle = defineInteraction('rmx:before-popover-toggle', Popover)

declare global {
  interface HTMLElementEventMap {
    [popoverToggle]: ToggleEvent
    [beforePopoverToggle]: ToggleEvent
  }
}

function Popover(handle: Interaction) {
  if (!(handle.target instanceof HTMLElement)) return

  let target = handle.target
  let popoverId = target.getAttribute('popovertarget')
  if (!popoverId) return

  let popover = target.ownerDocument.getElementById(popoverId)
  if (!(popover instanceof HTMLElement)) return

  handle.on(popover, {
    toggle(event) {
      target.dispatchEvent(
        new ToggleEvent(popoverToggle, {
          bubbles: event.bubbles,
          cancelable: event.cancelable,
          composed: event.composed,
          newState: event.newState,
          oldState: event.oldState,
        }),
      )
    },
    beforetoggle(event) {
      target.dispatchEvent(
        new ToggleEvent(beforePopoverToggle, {
          bubbles: event.bubbles,
          cancelable: event.cancelable,
          composed: event.composed,
          newState: event.newState,
          oldState: event.oldState,
        }),
      )
    },
  })
}
