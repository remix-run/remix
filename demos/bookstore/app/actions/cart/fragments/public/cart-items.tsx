import * as form from '@remix-run/ui/form'
import type { FormSubmission } from 'remix/data-schema/experimental/form'
import type { FrameReloadStartEvent, Handle } from 'remix/component'
import { css, clientEntry, on } from 'remix/component'

import { routes } from '../../../../routes.ts'
import { PendingButton } from '../../../../ui/public/pending-button.tsx'
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
  showErrorMessage?: boolean
  errorBookId?: number
  submission?: FormSubmission
}

type CartAction = {
  bookId: number
  type: 'update' | 'remove'
}

export const CartItems = clientEntry(
  import.meta.url,
  function CartItems(handle: Handle<CartItemsProps>) {
    let state:
      | { status: 'idle' }
      | { status: 'pending'; reload: FrameReloadStartEvent; action: CartAction | undefined }
      | { status: 'failed'; action: CartAction | undefined; source: 'response' | 'request' } = {
      status: 'idle',
    }

    handle.frame.addEventListener(
      'reloadStart',
      async (event) => {
        let formData = event.formData
        let removing = formData?.get('_method') === 'DELETE'
        let action: CartAction | undefined = formData?.has('bookId')
          ? { bookId: Number(formData.get('bookId')), type: removing ? 'remove' : 'update' }
          : undefined
        state = { status: 'pending', reload: event, action }
        handle.update()
        try {
          let signal = await event.finished
          if (handle.signal.aborted || state.status !== 'pending' || state.reload !== event) return
          if (!signal.aborted && handle.props.error) {
            state = { status: 'failed', action, source: 'response' }
          } else {
            state = { status: 'idle' }
          }
        } catch {
          if (handle.signal.aborted || state.status !== 'pending' || state.reload !== event) return
          state = { status: 'failed', action, source: 'request' }
        }
        handle.update()
      },
      { signal: handle.signal },
    )

    return () => {
      let { items, canCheckout, error, showErrorMessage, errorBookId, submission, total } =
        handle.props
      let isPending = state.status === 'pending'
      let pendingAction = state.status === 'pending' ? state.action : undefined
      let failedAction = state.status === 'failed' ? state.action : undefined
      let requestFailed = state.status === 'failed' && state.source === 'request'
      let hasQuantityError =
        submission?.errors.fields.quantity &&
        items.some((item) => item.bookId === Number(submission.values.bookId))
      let failedBookId = errorBookId ?? Number(submission?.values.bookId)
      let cartError =
        !isPending && !requestFailed && showErrorMessage && !hasQuantityError ? error : undefined

      return (
        <div
          mix={on('submit', async (event) => {
            if (event.defaultPrevented) return
            let form = event.target
            if (!(form instanceof HTMLFormElement)) return
            event.preventDefault()
            if (state.status === 'pending') return
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
                  <tr
                    key={item.bookId}
                    mix={css({
                      position: 'relative',
                      opacity: isRemoving ? 0.6 : 1,
                      transition: 'opacity 150ms',
                      '& td': { verticalAlign: 'top', paddingBottom: '3rem' },
                    })}
                  >
                    <td>
                      <a
                        data-rmx-prefetch="intent"
                        href={routes.books.show.href({ slug: item.slug })}
                      >
                        {item.title}
                      </a>
                      {cartError && failedBookId === item.bookId ? (
                        <p
                          role="alert"
                          mix={css({
                            position: 'absolute',
                            bottom: '0.5rem',
                            left: '0.75rem',
                            right: '0.75rem',
                            margin: 0,
                            color: '#dc2626',
                            fontSize: '0.875rem',
                          })}
                        >
                          {cartError}
                        </p>
                      ) : null}
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
                                !requestFailed && typeof submittedQuantity === 'string'
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

                            <PendingButton
                              pending={isUpdating}
                              failed={
                                failedAction?.type === 'update' &&
                                failedAction.bookId === item.bookId
                              }
                              pendingLabel="Saving..."
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
                              Update
                            </PendingButton>

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

                    <td>
                      <PendingPrice amount={item.price * item.quantity} pending={isUpdating} />
                    </td>

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

                            <PendingButton
                              pending={isRemoving}
                              failed={
                                failedAction?.type === 'remove' &&
                                failedAction.bookId === item.bookId
                              }
                              pendingLabel="Removing..."
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
                            </PendingButton>
                          </RestfulForm>
                        )}
                      </form.Context>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {cartError && !items.some((item) => item.bookId === failedBookId) ? (
            <p role="alert" mix={css({ color: '#dc2626' })}>
              {cartError}
            </p>
          ) : null}

          <div mix={css({ marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' })}>
            <p
              mix={css({ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', marginRight: 'auto' })}
            >
              <PendingPrice label="Total: " amount={total} pending={isPending} />
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

function PendingPrice(handle: Handle<{ amount: number; pending: boolean; label?: string }>) {
  return () => {
    let { amount, pending, label } = handle.props
    return (
      <span
        aria-busy={pending || undefined}
        mix={css({ display: 'inline-flex', alignItems: 'center', gap: '0.35em' })}
      >
        <span mix={css({ opacity: pending ? 0.3 : 1, transition: 'opacity 150ms' })}>
          {label}${amount.toFixed(2)}
        </span>
        <span
          aria-hidden="true"
          mix={css({
            width: '0.65em',
            height: '0.65em',
            border: '1.5px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            visibility: pending ? 'visible' : 'hidden',
            animation: pending ? 'cart-price-spin 650ms linear infinite' : 'none',
            '@keyframes cart-price-spin': {
              to: { transform: 'rotate(360deg)' },
            },
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          })}
        />
      </span>
    )
  }
}
