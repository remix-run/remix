import { defineInteraction, on } from '../events.ts'

/**
 * Binds the escape key to an element and automatically prevents the default
 * browser behavior. Useful for adding keyboard navigation to a component,
 * particularly for WAI ARIA practices to close a modal or menu.
 */
export let escape = defineInteraction('keydown:Escape', Keys)

/**
 * Binds the enter key to an element and automatically prevents the default
 * browser behavior. Useful for adding keyboard navigation to a component,
 * particularly for WAI ARIA practices to select an item in a list, submit a
 * form or generally trigger an action.
 */
export let enter = defineInteraction('keydown:Enter', Keys)

/**
 * Binds the space key to an element and automatically prevents the default
 * browser behavior. Useful for adding keyboard navigation to a component,
 * particularly for WAI ARIA practices to select an item in a list, submit a
 * form or generally trigger an action.
 */
export let space = defineInteraction('keydown: ', Keys)

/**
 * Binds the backspace key to an element and automatically prevents the default
 * browser behavior.
 */
export let backspace = defineInteraction('keydown:Backspace', Keys)

/**
 * Binds the delete key to an element and automatically prevents the default
 * browser behavior. Useful for adding keyboard navigation to a component,
 * particularly for WAI ARIA practices
 */
export let del = defineInteraction('keydown:Delete', Keys)

/**
 * Binds the arrow left key to an element and automatically prevents the default
 * browser behavior. Useful for adding keyboard navigation to a component,
 * particularly for WAI ARIA practices
 */
export let arrowLeft = defineInteraction('keydown:ArrowLeft', Keys)

/**
 * Binds the arrow right key to an element and automatically prevents the default
 * browser behavior. Useful for adding keyboard navigation to a component,
 * particularly for WAI ARIA practices
 */
export let arrowRight = defineInteraction('keydown:ArrowRight', Keys)

/**
 * Binds the arrow up key to an element and automatically prevents the default
 * browser behavior. Useful for adding keyboard navigation to a component,
 * particularly for WAI ARIA practices
 */
export let arrowUp = defineInteraction('keydown:ArrowUp', Keys)

/**
 * Binds the arrow down key to an element and automatically prevents the default
 * browser behavior. Useful for adding keyboard navigation to a component,
 * particularly for WAI ARIA practices
 */
export let arrowDown = defineInteraction('keydown:ArrowDown', Keys)

/**
 * Binds the home key to an element and automatically prevents the default
 * browser behavior. Useful for adding keyboard navigation to a component,
 * particularly for WAI ARIA practices to move to the first item in a list.
 */
export let home = defineInteraction('keydown:Home', Keys)

/**
 * Binds the end key to an element and automatically prevents the default
 * browser behavior. Useful for adding keyboard navigation to a component,
 * particularly for WAI ARIA practices to move to the last item in a list.
 */
export let end = defineInteraction('keydown:End', Keys)

/**
 * Binds the page up key to an element and automatically prevents the default
 * browser behavior. Useful for adding keyboard navigation to a component,
 * particularly for WAI ARIA practices to move to the previous page in a list.
 */
export let pageUp = defineInteraction('keydown:PageUp', Keys)

/**
 * Binds the page down key to an element and automatically prevents the default
 * browser behavior. Useful for adding keyboard navigation to a component,
 * particularly for WAI ARIA practices to move to the next page in a list.
 */
export let pageDown = defineInteraction('keydown:PageDown', Keys)

/**
 * Binds the tab key to an element and automatically prevents the default
 * browser behavior. Useful for adding keyboard navigation to a component,
 * particularly for WAI ARIA practices to move to the next item in a list.
 */
export let tab = defineInteraction('keydown:Tab', Keys)

declare global {
  interface HTMLElementEventMap {
    [escape]: KeyboardEvent
    [enter]: KeyboardEvent
    [space]: KeyboardEvent
    [backspace]: KeyboardEvent
    [del]: KeyboardEvent
    [arrowLeft]: KeyboardEvent
    [arrowRight]: KeyboardEvent
    [arrowUp]: KeyboardEvent
    [arrowDown]: KeyboardEvent
    [home]: KeyboardEvent
    [end]: KeyboardEvent
    [pageUp]: KeyboardEvent
    [pageDown]: KeyboardEvent
    [tab]: KeyboardEvent
  }
}

const keys = [
  'Escape',
  'Enter',
  ' ',
  'Backspace',
  'Delete',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Tab',
]

function Keys(target: EventTarget, signal: AbortSignal) {
  if (!(target instanceof HTMLElement)) return

  on(target, signal, {
    keydown(event) {
      if (!keys.includes(event.key)) return
      event.preventDefault()
      target.dispatchEvent(new KeyboardEvent(`keydown:${event.key}`, { key: event.key }))
    },
  })
}
