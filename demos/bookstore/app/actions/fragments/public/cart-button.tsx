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
          mix={on('submit', async (event) => {
            if (event.defaultPrevented) return
            let form = event.currentTarget
            event.preventDefault()
            if (pending) return
            let body = new FormData(form, event.submitter)
            pending = true
            handle.update()
            // A failed reload leaves the old button in place.
            await handle.frame
              .reload({
                src: routes.api.cartToggle.href(),
                method: 'post',
                body,
                adoptRedirectSrc: true,
              })
              .catch(() => {})
            if (handle.signal.aborted) return
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
