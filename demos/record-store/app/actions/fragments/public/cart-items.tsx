import type { Handle } from 'remix/ui'
import { css, clientEntry, on } from 'remix/ui'

import { routes } from '../../../routes.ts'

type CartItem = {
  albumId: number
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

type PendingAction = {
  type: 'update' | 'remove'
  albumId: number
} | null

export const CartItems = clientEntry(
  import.meta.url,
  function CartItems(handle: Handle<CartItemsProps>) {
    let pendingAction: PendingAction = null

    let submit = async (form: HTMLFormElement, signal: AbortSignal, nextAction: PendingAction) => {
      if (pendingAction) return

      pendingAction = nextAction
      handle.update()

      try {
        let formData = new FormData(form)
        formData.set('redirect', 'none')

        await fetch(form.action, {
          method: 'POST',
          body: formData,
          signal,
        })

        if (signal.aborted) return

        await handle.frame.reload()
      } finally {
        pendingAction = null
        handle.update()
      }
    }

    return () => {
      let { items, total, canCheckout } = handle.props
      let isPending = pendingAction !== null
      let totalLabel = isPending ? '---' : `$${total.toFixed(2)}`

      return (
        <>
          {isPending ? (
            <p mix={css({ marginBottom: '1rem', fontSize: '0.9rem', color: '#666' })}>
              Updating your cart...
            </p>
          ) : null}

          <table>
            <thead>
              <tr>
                <th>Album</th>
                <th>Price</th>
                <th>Quantity</th>
                <th>Subtotal</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                let isUpdating =
                  pendingAction?.type === 'update' && pendingAction.albumId === item.albumId
                let isRemoving =
                  pendingAction?.type === 'remove' && pendingAction.albumId === item.albumId

                return (
                  <tr key={item.albumId}>
                    <td>
                      <a href={routes.albums.show.href({ slug: item.slug })}>{item.title}</a>
                    </td>

                    <td>${item.price.toFixed(2)}</td>

                    <td>
                      <form
                        method="POST"
                        action={routes.cart.api.update.href()}
                        mix={[
                          on('submit', async (event, signal) => {
                            event.preventDefault()
                            await submit(event.currentTarget, signal, {
                              type: 'update',
                              albumId: item.albumId,
                            })
                          }),
                          css({ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }),
                        ]}
                      >
                        <input type="hidden" name="_method" value="PUT" />
                        <input type="hidden" name="albumId" value={item.albumId} />

                        <input
                          type="number"
                          name="quantity"
                          defaultValue={item.quantity}
                          min="1"
                          disabled={isPending}
                          mix={css({ width: '70px' })}
                        />

                        <button
                          type="submit"
                          disabled={isPending}
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
                        mix={[
                          on('submit', async (event, signal) => {
                            event.preventDefault()
                            await submit(event.currentTarget, signal, {
                              type: 'remove',
                              albumId: item.albumId,
                            })
                          }),
                          css({ display: 'inline' }),
                        ]}
                      >
                        <input type="hidden" name="_method" value="DELETE" />
                        <input type="hidden" name="albumId" value={item.albumId} />

                        <button
                          type="submit"
                          disabled={isPending}
                          class="btn btn-danger"
                          mix={css({
                            fontSize: '0.875rem',
                            padding: '0.25rem 0.5rem',
                            minWidth: '7rem',
                            textAlign: 'center',
                          })}
                        >
                          {isRemoving ? 'Removing...' : 'Remove'}
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
              Total: {totalLabel}
            </p>

            <a href={routes.albums.index.href()} class="btn btn-secondary">
              Continue Shopping
            </a>

            {canCheckout ? (
              <a href={routes.checkout.index.href()} class="btn">
                Proceed to Checkout
              </a>
            ) : (
              <a href={routes.auth.login.index.href()} class="btn">
                Login to Checkout
              </a>
            )}
          </div>
        </>
      )
    }
  },
)
