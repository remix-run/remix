import type { FormSubmitStartEvent, Handle } from 'remix/component'
import { css, clientEntry, on } from 'remix/component'

import { routes } from '../../../routes.ts'

type CartItem = {
  bookId: number
  slug: string
  title: string
  price: number
  quantity: number
}

type CartItemsProps = {
  items: CartItem[]
  total: number
  canCheckout: boolean
}

// A submitted change: the book and the quantity it leaves, 0 when it removes the book.
type CartChange = {
  bookId: number
  quantity: number
}

export const CartItems = clientEntry(
  import.meta.url,
  function CartItems(handle: Handle<CartItemsProps>) {
    let change: CartChange | undefined
    let failed = false

    // Shows a change as soon as its submission starts, until the cart it saved renders. The cart
    // listens around its rows, because removing a row removes its form, which would abort the
    // form's signal and leave the change pending.
    async function follow(event: FormSubmitStartEvent, signal: AbortSignal) {
      let { formData } = event
      if (!formData) return
      change = {
        bookId: Number(formData.get('bookId')),
        quantity: formData.has('quantity') ? Number(formData.get('quantity')) : 0,
      }
      failed = false
      handle.update()
      try {
        await event.finished
      } catch (error) {
        // An `AbortError` means a newer navigation replaced this one, which shows its own state.
        failed = !(error instanceof DOMException && error.name === 'AbortError')
      }
      if (signal.aborted) return
      change = undefined
      handle.update()
    }

    return () => {
      let { canCheckout } = handle.props
      let items = handle.props.items.flatMap((item) => {
        if (item.bookId !== change?.bookId) return [item]
        return change.quantity > 0 ? [{ ...item, quantity: change.quantity }] : []
      })
      let total = change
        ? items.reduce((sum, item) => sum + item.price * item.quantity, 0)
        : handle.props.total
      // Each change saves the same session, so the next one waits for it.
      let isPending = change !== undefined

      return (
        <div
          mix={[
            on('rmx:form-submit-start', (event, signal) => follow(event, signal)),
            on('submit', (event) => {
              // Keep pending controls focusable without allowing another session write.
              if (change) event.preventDefault()
            }),
          ]}
        >
          <p
            role="status"
            data-failed={failed ? '' : undefined}
            mix={css({
              fontSize: '0.9rem',
              '&:not(:empty)': { marginBottom: '1rem' },
              '&:not([data-failed])': { color: '#666' },
              '&[data-failed]': { color: '#e74c3c' },
            })}
          >
            {isPending
              ? 'Updating your cart...'
              : failed
                ? 'Couldn’t update your cart. Try again.'
                : ''}
          </p>

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
              {items.map((item) => {
                let isUpdating = change?.bookId === item.bookId

                return (
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
                      {/* The action redirects back to the cart, which then replaces this page in place. */}
                      <form
                        method="POST"
                        action={routes.cart.api.update.href()}
                        data-rmx-history="replace"
                        data-rmx-reset-scroll="manual"
                        data-rmx-reset-focus="manual"
                        mix={css({ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' })}
                      >
                        <input type="hidden" name="_method" value="PUT" />
                        <input type="hidden" name="bookId" value={item.bookId} />

                        <input
                          type="number"
                          name="quantity"
                          aria-label={`Quantity of ${item.title}`}
                          defaultValue={item.quantity}
                          min="1"
                          required
                          readOnly={isPending}
                          mix={css({ width: '70px' })}
                        />

                        <button
                          type="submit"
                          aria-disabled={isPending || undefined}
                          class="btn btn-secondary"
                          mix={css({
                            fontSize: '0.875rem',
                            padding: '0.25rem 0.5rem',
                            minWidth: '6.25rem',
                            textAlign: 'center',
                          })}
                        >
                          {isUpdating ? 'Saving...' : 'Update'}
                        </button>
                      </form>
                    </td>

                    <td>${(item.price * item.quantity).toFixed(2)}</td>

                    <td>
                      <form
                        method="POST"
                        action={routes.cart.api.remove.href()}
                        data-rmx-history="replace"
                        data-rmx-reset-scroll="manual"
                        data-rmx-reset-focus="manual"
                        mix={css({ display: 'inline' })}
                      >
                        <input type="hidden" name="_method" value="DELETE" />
                        <input type="hidden" name="bookId" value={item.bookId} />

                        <button
                          type="submit"
                          aria-disabled={isPending || undefined}
                          class="btn btn-danger"
                          mix={css({
                            fontSize: '0.875rem',
                            padding: '0.25rem 0.5rem',
                            minWidth: '7rem',
                            textAlign: 'center',
                          })}
                        >
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div mix={css({ marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' })}>
            <p
              mix={css({ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', marginRight: 'auto' })}
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
        </div>
      )
    }
  },
)
