import { type Handle, clientEntry, on } from 'remix/component'

import { routes } from '../../../routes.ts'

/** Names the frame that holds a book's cart button, which the button's form loads into. */
export function cartButtonFrameName(bookId: string | number): string {
  return `cart-button-${bookId}`
}

export const CartButton = clientEntry(
  import.meta.url,
  function CartButton(handle: Handle<{ inCart: boolean; id: string | number }>) {
    let pending = false

    return () => {
      let { inCart, id } = handle.props

      return (
        <form
          method="POST"
          action={routes.api.cartToggle.href()}
          data-rmx-target={cartButtonFrameName(id)}
          data-rmx-history="none"
          mix={on('rmx:form-submit-start', async (event, signal) => {
            pending = true
            handle.update()
            // The frame's new button shows whether the book is in the cart, or the old one if the
            // save failed.
            await event.finished.catch(() => {})
            // The form's next submission owns the label from here.
            if (signal.aborted) return
            pending = false
            handle.update()
          })}
        >
          <input type="hidden" name="bookId" value={id} />
          <button type="submit" class="btn">
            {pending ? 'Saving...' : inCart ? 'Remove from Cart' : 'Add to Cart'}
          </button>
        </form>
      )
    }
  },
)
