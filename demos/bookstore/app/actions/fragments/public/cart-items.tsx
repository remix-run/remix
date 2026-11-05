import type { FrameReloadStartEvent, Handle } from 'remix/component'
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
    let activeReload: FrameReloadStartEvent | undefined
    let reload: FrameReloadStartEvent | undefined
    let failed: 'change' | 'reload' | undefined

    // The stable cart component follows loads even when optimistic removal unmounts the form.
    handle.frame.addEventListener(
      'reloadStart',
      async (event) => {
        activeReload = event
        let formData = event.formData
        change = formData?.has('bookId')
          ? {
              bookId: Number(formData.get('bookId')),
              quantity: formData.has('quantity') ? Number(formData.get('quantity')) : 0,
            }
          : undefined
        reload =
          event.method === 'get' && event.src === routes.cart.index.href() ? event : undefined
        let kind: typeof failed = change ? 'change' : reload ? 'reload' : undefined
        if (!kind) {
          handle.update()
          return
        }
        failed = undefined
        handle.update()
        try {
          await event.finished
        } catch {
          if (activeReload === event) failed = kind
        }
        if (handle.signal.aborted || activeReload !== event) return
        activeReload = undefined
        change = undefined
        reload = undefined
        handle.update()
      },
      { signal: handle.signal },
    )

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
          mix={on('submit', (event) => {
            if (event.defaultPrevented) return
            let form = event.target
            if (!(form instanceof HTMLFormElement)) return
            event.preventDefault()
            // Keep pending controls focusable without allowing another session write.
            if (change) return
            // The reloadStart listener reports failures and clears the optimistic change.
            void handle.frame
              .reload({
                src: form.action,
                method: 'post',
                body: new FormData(form, event.submitter),
                adoptRedirectSrc: true,
              })
              .catch(() => {})
          })}
        >
          <div
            mix={css({
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.5rem 1rem',
              '&:has(> :not(:empty))': { marginBottom: '1rem' },
            })}
          >
            <p
              role="status"
              data-failed={failed ? '' : undefined}
              mix={css({
                margin: 0,
                fontSize: '0.9rem',
                '&:not([data-failed])': { color: '#666' },
                '&[data-failed]': { color: '#e74c3c' },
              })}
            >
              {isPending
                ? 'Updating your cart...'
                : reload
                  ? 'Reloading your cart...'
                  : failed === 'change'
                    ? 'Couldn’t update your cart. Try again, or reload it to see what’s saved.'
                    : failed === 'reload'
                      ? 'Couldn’t reload your cart. Try again.'
                      : ''}
            </p>

            {failed || reload ? (
              // The cart page answers a load for its frame with the frame's items.
              <a
                aria-disabled={reload ? true : undefined}
                href={routes.cart.index.href()}
                class="btn btn-secondary"
                mix={[
                  css({ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }),
                  on('click', async (event) => {
                    if (
                      event.defaultPrevented ||
                      event.button !== 0 ||
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    )
                      return
                    event.preventDefault()
                    if (reload) return
                    await handle.frame
                      .reload({ src: routes.cart.index.href(), adoptRedirectSrc: true })
                      .catch(() => {})
                  }),
                ]}
              >
                Reload cart
              </a>
            ) : null}
          </div>

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
                      {/* The action redirects to the cart's items, which load into its frame. */}
                      <form
                        method="POST"
                        action={routes.cart.api.update.href()}
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
