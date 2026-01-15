import { defineInteraction, type Interaction } from '../interaction.ts'

/**
 * Binds the escape key to an element and prevents the default browser behavior. Useful for adding keyboard navigation
 * to a component, particularly for WAI ARIA practices to close a modal or menu.
 */
export let escape = defineInteraction('keydown:Escape', makeKeyInteraction('Escape'))

/**
 * Binds the enter key to an element and prevents the default browser behavior. Useful for adding keyboard navigation
 * to a component, particularly for WAI ARIA practices to select an item in a
 * list, submit a form or generally trigger an action.
 */
export let enter = defineInteraction('keydown:Enter', makeKeyInteraction('Enter'))

/**
 * Binds the space key to an element and prevents the default browser behavior. Useful for adding keyboard navigation
 * to a component, particularly for WAI ARIA practices to select an item in a
 * list, submit a form or generally trigger an action.
 */
export let space = defineInteraction('keydown: ', makeKeyInteraction(' '))

/**
 * Binds the backspace key to an element and prevents the default browser behavior.
 */
export let backspace = defineInteraction('keydown:Backspace', makeKeyInteraction('Backspace'))

/**
 * Binds the delete key to an element and prevents the default browser behavior. Useful for adding keyboard navigation
 * to a component, particularly for WAI ARIA practices.
 */
export let del = defineInteraction('keydown:Delete', makeKeyInteraction('Delete'))

/**
 * Binds the arrow left key to an element and prevents the default browser behavior. Useful for adding keyboard navigation
 * to a component, particularly for WAI ARIA practices.
 */
export let arrowLeft = defineInteraction('keydown:ArrowLeft', makeKeyInteraction('ArrowLeft'))

/**
 * Binds the arrow right key to an element and prevents the default browser behavior. Useful for adding keyboard navigation
 * to a component, particularly for WAI ARIA practices.
 */
export let arrowRight = defineInteraction('keydown:ArrowRight', makeKeyInteraction('ArrowRight'))

/**
 * Binds the arrow up key to an element and prevents the default browser behavior. Useful for adding keyboard navigation
 * to a component, particularly for WAI ARIA practices.
 */
export let arrowUp = defineInteraction('keydown:ArrowUp', makeKeyInteraction('ArrowUp'))

/**
 * Binds the arrow down key to an element and prevents the default browser behavior. Useful for adding keyboard navigation
 * to a component, particularly for WAI ARIA practices.
 */
export let arrowDown = defineInteraction('keydown:ArrowDown', makeKeyInteraction('ArrowDown'))

/**
 * Binds the home key to an element and prevents the default browser behavior. Useful for adding keyboard navigation
 * to a component, particularly for WAI ARIA practices to move to the first
 * item in a list.
 */
export let home = defineInteraction('keydown:Home', makeKeyInteraction('Home'))

/**
 * Binds the end key to an element and prevents the default browser behavior. Useful for adding keyboard navigation
 * to a component, particularly for WAI ARIA practices to move to the last
 * item in a list.
 */
export let end = defineInteraction('keydown:End', makeKeyInteraction('End'))

/**
 * Binds the page up key to an element and prevents the default browser behavior. Useful for adding keyboard navigation
 * to a component, particularly for WAI ARIA practices to move to the previous
 * page in a list.
 */
export let pageUp = defineInteraction('keydown:PageUp', makeKeyInteraction('PageUp'))

/**
 * Binds the page down key to an element and prevents the default browser behavior. Useful for adding keyboard navigation
 * to a component, particularly for WAI ARIA practices to move to the next
 * page in a list.
 */
export let pageDown = defineInteraction('keydown:PageDown', makeKeyInteraction('PageDown'))

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
  }

  interface WindowEventMap {
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
  }

  interface DocumentEventMap {
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
  }
}

function makeKeyInteraction(key: string) {
  return function (handle: Interaction) {
    if (
      !(
        handle.target instanceof HTMLElement ||
        handle.target instanceof Document ||
        handle.target instanceof Window
      )
    )
      return

    handle.on(handle.target, {
      keydown: (event) => {
        if (event.key === key) {
          event.preventDefault()
          handle.target.dispatchEvent(
            new KeyboardEvent(`keydown:${event.key}`, {
              key: event.key,
            }),
          )
        }
      },
    })
  }
}
