import type { Handle } from 'remix/component'
import { css, clientEntry, on } from 'remix/component'

import { routes } from '../../../routes.ts'
import {
  type CartBook,
  type CartChange,
  followCartChanges,
  getCartChanges,
  retryCartChange,
  setCartQuantity,
} from './cart-changes.ts'

type CartItem = CartBook & { quantity: number }

type CartItemsProps = {
  items: CartItem[]
  canCheckout: boolean
}

const compactButton = css({
  fontSize: '0.875rem',
  padding: '0.25rem 0.5rem',
  textAlign: 'center',
})

export const CartItems = clientEntry(
  import.meta.url,
  function CartItems(handle: Handle<CartItemsProps>) {
    // The cart shows every book, including ones added on other pages that the server's answer
    // doesn't have yet.
    let applyChanges = followCartChanges(handle, () => true)
    // What the visitor has typed in a quantity field but not submitted, by book, so a field shows
    // the cart's quantity again once a change it sent is reverted.
    let drafts = new Map<number, string>()

    return () => {
      let { items: serverItems, canCheckout } = handle.props
      let changes = applyChanges() ? getCartChanges() : []
      let items = applyCartChanges(serverItems, changes)
      let total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
      let notices = changes.filter(
        (change) => change.status === 'retrying' || change.status === 'failed',
      )

      return (
        <>
          {/* Announced without moving focus. */}
          <div role="status" mix={css({ fontSize: '0.9rem', color: '#666' })}>
            {notices.map((change) => (
              <p key={change.bookId} mix={css({ marginBottom: '1rem' })}>
                {change.status === 'retrying' ? (
                  `Saving ${change.title} is taking longer than usual. Retrying…`
                ) : (
                  <>
                    {change.quantity > 0
                      ? `Couldn’t update ${change.title} in your cart.`
                      : `Couldn’t remove ${change.title} from your cart.`}{' '}
                    <button
                      type="button"
                      class="btn btn-secondary"
                      mix={[compactButton, on('click', () => retryCartChange(change.bookId))]}
                    >
                      Try again
                    </button>
                  </>
                )}
              </p>
            ))}
          </div>

          {items.length === 0 ? (
            <div mix={css({ marginTop: '2rem' })}>
              <p>Your cart is empty.</p>
              <p mix={css({ marginTop: '1rem' })}>
                <a data-rmx-prefetch="intent" href={routes.books.index.href()} class="btn">
                  Browse Books
                </a>
              </p>
            </div>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Price</th>
                    <th>Quantity</th>
                    <th>Subtotal</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.bookId}>
                      <td>
                        <a
                          data-rmx-prefetch="intent"
                          href={routes.books.show.href({ slug: item.slug })}
                        >
                          {item.title}
                        </a>
                      </td>

                      <td>${item.price.toFixed(2)}</td>

                      <td>
                        {/* Plain forms, so the cart works before the page's JavaScript loads. */}
                        <form
                          method="POST"
                          action={routes.cart.api.update.href()}
                          mix={[
                            on('submit', (event) => {
                              event.preventDefault()
                              let quantity = new FormData(event.currentTarget).get('quantity')
                              drafts.delete(item.bookId)
                              setCartQuantity(item, Number(quantity))
                            }),
                            css({ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }),
                          ]}
                        >
                          <input type="hidden" name="_method" value="PUT" />
                          <input type="hidden" name="bookId" value={item.bookId} />

                          <input
                            type="number"
                            name="quantity"
                            aria-label={`Quantity of ${item.title}`}
                            value={drafts.get(item.bookId) ?? String(item.quantity)}
                            min="1"
                            step="1"
                            required
                            mix={[
                              css({ width: '70px' }),
                              on('input', (event) => {
                                drafts.set(item.bookId, event.currentTarget.value)
                                handle.update()
                              }),
                            ]}
                          />

                          <button type="submit" class="btn btn-secondary" mix={compactButton}>
                            Update
                          </button>
                        </form>
                      </td>

                      <td>${(item.price * item.quantity).toFixed(2)}</td>

                      <td>
                        <form
                          method="POST"
                          action={routes.cart.api.remove.href()}
                          mix={[
                            on('submit', (event) => {
                              event.preventDefault()
                              setCartQuantity(item, 0)
                            }),
                            css({ display: 'inline' }),
                          ]}
                        >
                          <input type="hidden" name="_method" value="DELETE" />
                          <input type="hidden" name="bookId" value={item.bookId} />

                          <button type="submit" class="btn btn-danger" mix={compactButton}>
                            Remove
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div
                mix={css({ marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' })}
              >
                <p
                  mix={css({
                    margin: 0,
                    fontSize: '1.25rem',
                    fontWeight: 'bold',
                    marginRight: 'auto',
                  })}
                >
                  Total: ${total.toFixed(2)}
                </p>

                <a
                  data-rmx-prefetch="intent"
                  href={routes.books.index.href()}
                  class="btn btn-secondary"
                >
                  Continue Shopping
                </a>

                {canCheckout ? (
                  <a data-rmx-prefetch="intent" href={routes.checkout.index.href()} class="btn">
                    Proceed to Checkout
                  </a>
                ) : (
                  <a href={routes.auth.login.index.href()} class="btn">
                    Login to Checkout
                  </a>
                )}
              </div>
            </>
          )}
        </>
      )
    }
  },
)

// The server's items with the visitor's choices on top. Books added elsewhere come last.
function applyCartChanges(serverItems: CartItem[], changes: CartChange[]): CartItem[] {
  let shown = new Map(serverItems.map((item) => [item.bookId, item]))
  for (let change of changes) {
    if (change.status === 'failed') continue
    let { bookId, slug, title, price } = shown.get(change.bookId) ?? change
    shown.set(bookId, { bookId, slug, title, price, quantity: change.quantity })
  }
  return [...shown.values()].filter((item) => item.quantity > 0)
}
