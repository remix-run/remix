import { type Handle, clientEntry, css, on } from 'remix/component'

import { routes } from '../../../routes.ts'
import {
  type CartBook,
  followCartChanges,
  getCartChange,
  getShownQuantity,
  retryCartChange,
  setCartQuantity,
} from './cart-changes.ts'

export const CartButton = clientEntry(
  import.meta.url,
  function CartButton(handle: Handle<{ book: CartBook; quantity: number }>) {
    let applyChanges = followCartChanges(handle, (bookId) => bookId === handle.props.book.bookId)

    return () => {
      let { book, quantity: serverQuantity } = handle.props
      let change = applyChanges() ? getCartChange(book.bookId) : undefined
      let quantity = applyChanges() ? getShownQuantity(book.bookId, serverQuantity) : serverQuantity
      let inCart = quantity > 0

      return (
        <div mix={css({ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' })}>
          {/* A plain form, so the button works before the page's JavaScript loads. */}
          <form
            method="POST"
            action={routes.cart.api.update.href()}
            mix={on('submit', (event) => {
              event.preventDefault()
              setCartQuantity(book, inCart ? 0 : 1)
            })}
          >
            <input type="hidden" name="_method" value="PUT" />
            <input type="hidden" name="bookId" value={book.bookId} />
            <input type="hidden" name="quantity" value={inCart ? 0 : 1} />
            <button type="submit" class="btn">
              {inCart ? 'Remove from Cart' : 'Add to Cart'}
            </button>
          </form>

          {/* Announced without moving focus, and apart from the button so its name stays put. */}
          <span role="status" mix={css({ fontSize: '0.875rem', color: '#666' })}>
            {change?.status === 'retrying' ? 'Retrying…' : null}
            {change?.status === 'failed' ? (
              <>
                {change.quantity > 0
                  ? `Couldn’t add ${book.title} to your cart.`
                  : `Couldn’t remove ${book.title} from your cart.`}{' '}
                <button
                  type="button"
                  class="btn btn-secondary"
                  mix={[
                    css({ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }),
                    on('click', () => retryCartChange(book.bookId)),
                  ]}
                >
                  Try again
                </button>
              </>
            ) : null}
          </span>
        </div>
      )
    }
  },
)
