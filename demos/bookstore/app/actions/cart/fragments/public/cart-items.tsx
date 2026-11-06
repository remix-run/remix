import * as form from '@remix-run/ui/form'
import type { FormSubmission } from 'remix/data-schema/experimental/form'
import type { FrameReloadStartEvent, Handle } from 'remix/component'
import { css, clientEntry, on } from 'remix/component'

import { routes } from '../../../../routes.ts'
import { RestfulForm } from '../../../../ui/restful-form.tsx'
import { CartItemRemoveForm, CartItemUpdateForm } from './schema.ts'

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
  error?: string
  submission?: FormSubmission
}

type PendingAction = {
  bookId: number
  type: 'update' | 'remove'
}

export const CartItems = clientEntry(
  import.meta.url,
  function CartItems(handle: Handle<CartItemsProps>) {
    let pendingAction: PendingAction | undefined
    let activeReload: FrameReloadStartEvent | undefined
    let failed = false

    handle.frame.addEventListener(
      'reloadStart',
      async (event) => {
        activeReload = event
        let formData = event.formData
        let removing = formData?.get('_method') === 'DELETE'
        pendingAction = formData?.has('bookId')
          ? { bookId: Number(formData.get('bookId')), type: removing ? 'remove' : 'update' }
          : undefined
        failed = false
        handle.update()
        try {
          await event.finished
        } catch {
          if (activeReload === event) failed = true
        }
        if (handle.signal.aborted || activeReload !== event) return
        activeReload = undefined
        pendingAction = undefined
        handle.update()
      },
      { signal: handle.signal },
    )

    return () => {
      let { items, canCheckout, error, submission, total } = handle.props
      let isPending = activeReload !== undefined
      let totalLabel = isPending ? '---' : `$${total.toFixed(2)}`
      let hasQuantityError =
        submission?.errors.fields.quantity &&
        items.some((item) => item.bookId === Number(submission.values.bookId))

      return (
        <div
          mix={on('submit', async (event) => {
            if (event.defaultPrevented) return
            let form = event.target
            if (!(form instanceof HTMLFormElement)) return
            event.preventDefault()
            if (activeReload) return
            let body = new FormData(form, event.submitter)
            let cartRegion =
              body.get('_method') === 'DELETE' && form.contains(document.activeElement)
                ? form.closest<HTMLElement>('[role="region"]')
                : null
            // reloadStart owns pending state and reports failures.
            try {
              let signal = await handle.frame.reload({ method: 'post', body })
              if (
                !signal.aborted &&
                cartRegion?.isConnected &&
                !form.isConnected &&
                document.activeElement === document.body
              ) {
                cartRegion.focus()
              }
            } catch {
              if (handle.signal.aborted) return
              // Restore the committed defaults before resetting the edited controls.
              await handle.update()
              form.reset()
            }
          })}
        >
          {failed ? (
            <p
              role="alert"
              mix={css({ color: '#dc2626', textAlign: 'center', paddingBottom: '1.5rem' })}
            >
              Couldn’t update your cart. Try again, or{' '}
              <button
                type="button"
                mix={on('click', (event) => {
                  event.currentTarget.closest<HTMLElement>('[role="region"]')?.focus()
                  void handle.frame.reload().catch(() => {})
                })}
              >
                reload cart
              </button>{' '}
              to see what’s saved.
            </p>
          ) : !isPending && error && !hasQuantityError ? (
            <p
              role="alert"
              mix={css({ color: '#dc2626', textAlign: 'center', paddingBottom: '1.5rem' })}
            >
              {error}
            </p>
          ) : null}

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
                let isUpdating =
                  pendingAction?.type === 'update' && pendingAction.bookId === item.bookId
                let isRemoving =
                  pendingAction?.type === 'remove' && pendingAction.bookId === item.bookId
                let itemSubmission =
                  Number(submission?.values.bookId) === item.bookId ? submission : undefined
                let submittedQuantity = itemSubmission?.values.quantity

                return (
                  <tr key={item.bookId} mix={css({ '& td': { verticalAlign: 'top' } })}>
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
                      <form.Context
                        id={`${handle.id}-update-${item.bookId}`}
                        schema={CartItemUpdateForm}
                        submission={itemSubmission}
                      >
                        {({ fields }) => (
                          <form
                            method="POST"
                            action={routes.cart.fragments.itemsUpdate.href()}
                            mix={[
                              form.root(),
                              css({
                                display: 'inline-grid',
                                gridTemplateColumns: '70px 6.25rem',
                                gap: '0.5rem',
                                alignItems: 'center',
                              }),
                            ]}
                          >
                            <input
                              type="hidden"
                              value={item.bookId}
                              mix={form.control(fields.bookId)}
                            />

                            <input
                              aria-label={`Quantity of ${item.title}`}
                              defaultValue={
                                !failed && typeof submittedQuantity === 'string'
                                  ? submittedQuantity
                                  : item.quantity
                              }
                              step="1"
                              readOnly={isPending}
                              mix={[
                                form.control(fields.quantity),
                                css({
                                  width: '70px',
                                  '&[aria-invalid="true"]': {
                                    borderColor: '#dc2626',
                                    borderStyle: 'solid',
                                  },
                                }),
                              ]}
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
                                opacity: isUpdating ? 0.6 : 1,
                                transition: 'opacity 150ms',
                              })}
                            >
                              {isUpdating ? 'Saving...' : 'Update'}
                            </button>

                            {fields.quantity.errors.length > 0 ? (
                              <p
                                role="alert"
                                mix={[
                                  form.error(fields.quantity),
                                  css({
                                    gridColumn: '1 / -1',
                                    color: '#dc2626',
                                    margin: 0,
                                    fontSize: '0.875rem',
                                  }),
                                ]}
                              >
                                {fields.quantity.errors.join(' ')}
                              </p>
                            ) : null}
                          </form>
                        )}
                      </form.Context>
                    </td>

                    <td>{isUpdating ? '---' : `$${(item.price * item.quantity).toFixed(2)}`}</td>

                    <td>
                      <form.Context
                        id={`${handle.id}-remove-${item.bookId}`}
                        schema={CartItemRemoveForm}
                        submission={itemSubmission}
                      >
                        {({ fields }) => (
                          <RestfulForm
                            method="DELETE"
                            action={routes.cart.fragments.itemsRemove.href()}
                            mix={[form.root(), css({ display: 'inline' })]}
                          >
                            <input
                              type="hidden"
                              value={item.bookId}
                              mix={form.control(fields.bookId)}
                            />

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
                              {isRemoving ? 'Removing...' : 'Remove'}
                            </button>
                          </RestfulForm>
                        )}
                      </form.Context>
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
