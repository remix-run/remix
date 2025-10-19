import { createInteraction } from '../lib/interactions.ts'
import { events } from '../lib/events.ts'
import { dom } from '../lib/proxies.ts'

export type KeyInteractionEvent = CustomEvent<{ originalEvent: KeyboardEvent }>

/**
 * Creates an interaction that dispatches a custom event when the given key is
 * pressed and automatically prevents the default browser behavior. Useful for
 * adding keyboard navigation to a component, particularly for WAI ARIA
 * practices
 */
export function createKeyInteraction(key: string) {
  return createInteraction<Element, { originalEvent: KeyboardEvent }>(
    key,
    ({ dispatch, target }) => {
      return events(target, [
        dom.keydown((event) => {
          if (event.key === key) {
            event.preventDefault()
            dispatch({ detail: { originalEvent: event } }, event)
          }
        }),
      ])
    },
  )
}

/**
 * Binds the escape key to an element and automatically prevents the default
 * browser behavior. Useful for adding keyboard navigation to a component,
 * particularly for WAI ARIA practices to close a modal or menu.
 */
export let escape = createKeyInteraction('Escape')

/**
 * Binds the enter key to an element and automatically prevents the default
 * browser behavior. Useful for adding keyboard navigation to a component,
 * particularly for WAI ARIA practices to select an item in a list, submit a
 * form or generally trigger an action.
 */
export let enter = createKeyInteraction('Enter')

/**
 * Binds the space key to an element and automatically prevents the default
 * browser behavior. Useful for adding keyboard navigation to a component,
 * particularly for WAI ARIA practices to select an item in a list, submit a
 * form or generally trigger an action.
 */
export let space = createKeyInteraction(' ')

/**
 * Binds the backspace key to an element and automatically prevents the default
 * browser behavior.
 */
export let backspace = createKeyInteraction('Backspace')

/**
 * Binds the delete key to an element and automatically prevents the default
 * browser behavior. Useful for adding keyboard navigation to a component,
 * particularly for WAI ARIA practices
 */
export let del = createKeyInteraction('Delete')

/**
 * Binds the arrow left key to an element and automatically prevents the default
 * browser behavior. Useful for adding keyboard navigation to a component,
 * particularly for WAI ARIA practices
 */
export let arrowLeft = createKeyInteraction('ArrowLeft')

/**
 * Binds the arrow right key to an element and automatically prevents the default
 * browser behavior. Useful for adding keyboard navigation to a component,
 * particularly for WAI ARIA practices
 */
export let arrowRight = createKeyInteraction('ArrowRight')

/**
 * Binds the arrow up key to an element and automatically prevents the default
 * browser behavior. Useful for adding keyboard navigation to a component,
 * particularly for WAI ARIA practices
 */
export let arrowUp = createKeyInteraction('ArrowUp')

/**
 * Binds the arrow down key to an element and automatically prevents the default
 * browser behavior. Useful for adding keyboard navigation to a component,
 * particularly for WAI ARIA practices
 */
export let arrowDown = createKeyInteraction('ArrowDown')

/**
 * Binds the home key to an element and automatically prevents the default
 * browser behavior. Useful for adding keyboard navigation to a component,
 * particularly for WAI ARIA practices to move to the first item in a list.
 */
export let home = createKeyInteraction('Home')

/**
 * Binds the end key to an element and automatically prevents the default
 * browser behavior. Useful for adding keyboard navigation to a component,
 * particularly for WAI ARIA practices to move to the last item in a list.
 */
export let end = createKeyInteraction('End')

/**
 * Binds the page up key to an element and automatically prevents the default
 * browser behavior. Useful for adding keyboard navigation to a component,
 * particularly for WAI ARIA practices to move to the previous page in a list.
 */
export let pageUp = createKeyInteraction('PageUp')

/**
 * Binds the page down key to an element and automatically prevents the default
 * browser behavior. Useful for adding keyboard navigation to a component,
 * particularly for WAI ARIA practices to move to the next page in a list.
 */
export let pageDown = createKeyInteraction('PageDown')

/**
 * Binds the tab key to an element and automatically prevents the default
 * browser behavior. Useful for adding keyboard navigation to a component,
 * particularly for WAI ARIA practices to move to the next item in a list.
 */
export let tab = createKeyInteraction('Tab')
