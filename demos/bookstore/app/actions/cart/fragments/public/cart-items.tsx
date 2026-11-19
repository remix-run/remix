import * as form from '@remix-run/ui/form'
import type { FormSubmission } from 'remix/data-schema/experimental/form'
import type { FrameReloadStartEvent, Handle } from 'remix/component'
import { css, clientEntry, on } from 'remix/component'

import { routes } from '../../../../routes.ts'
import { PendingButton } from '../../../../ui/public/pending-button.tsx'
import { RestfulForm } from '../../../../ui/restful-form.tsx'
import { CartItemRemoveForm } from './schema.ts'

type CartItem = {
  bookId: number
  slug: string
  title: string
  price: number
  quantity: number
  thumbnailUrl?: string
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

type CartAction =
  | { bookId: number; type: 'update'; quantity: number }
  | { bookId: number; type: 'remove' }

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
          ? removing
            ? { bookId: Number(formData.get('bookId')), type: 'remove' }
            : {
                bookId: Number(formData.get('bookId')),
                type: 'update',
                quantity: Number(formData.get('quantity')),
              }
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
            } catch {}
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
                let quantity =
                  pendingAction?.type === 'update' &&
                  pendingAction.bookId === item.bookId &&
                  Number.isSafeInteger(pendingAction.quantity) &&
                  pendingAction.quantity >= 1
                    ? pendingAction.quantity
                    : item.quantity
                let quantityError = isPending
                  ? undefined
                  : (!requestFailed
                      ? itemSubmission?.errors.fields.quantity?.join(' ')
                      : undefined) ||
                    (failedAction?.type === 'update' && failedAction.bookId === item.bookId
                      ? requestFailed
                        ? 'Couldn’t update quantity. Try again.'
                        : (error ?? 'Couldn’t update quantity. Try again.')
                      : undefined)
                let quantityErrorId = `${handle.id}-quantity-error-${item.bookId}`

                return (
                  <tr
                    key={item.bookId}
                    mix={css({
                      '--cart-control-height': '1.9rem',
                      position: 'relative',
                      opacity: isRemoving ? 0.6 : 1,
                      transition: 'opacity 150ms',
                      '& td': { verticalAlign: 'middle', paddingBottom: '3rem' },
                    })}
                  >
                    <td>
                      <a
                        data-rmx-prefetch="intent"
                        href={routes.books.show.href({ slug: item.slug })}
                        mix={css({ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' })}
                      >
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt=""
                            width="48"
                            height="64"
                            loading="lazy"
                            mix={css({
                              width: '48px',
                              height: '64px',
                              objectFit: 'cover',
                              borderRadius: '4px',
                              flexShrink: 0,
                            })}
                          />
                        ) : null}
                        <span>{item.title}</span>
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
                      <RestfulForm
                        method="PATCH"
                        action={routes.cart.fragments.itemsUpdate.href()}
                        aria-label={`Update quantity of ${item.title}`}
                        mix={css({
                          display: 'inline-grid',
                          height: 'var(--cart-control-height)',
                          verticalAlign: 'top',
                          gridTemplateColumns: '2.5rem minmax(2.5rem, auto) 2.5rem',
                          alignItems: 'center',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          '& button': {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '2.5rem',
                            height: '100%',
                            background: '#f8fafc',
                            '&:first-of-type': { borderRadius: '5px 0 0 5px' },
                            '&:last-of-type': { borderRadius: '0 5px 5px 0' },
                            '&:hover:not(:disabled):not([aria-disabled="true"])': {
                              background: '#e2e8f0',
                            },
                            '&:disabled, &[aria-disabled="true"]': {
                              color: '#94a3b8',
                              cursor: 'default',
                            },
                            '&:focus-visible': {
                              outline: '2px solid #3498db',
                              outlineOffset: '2px',
                            },
                          },
                        })}
                      >
                        <input type="hidden" name="bookId" value={item.bookId} />
                        <button
                          type="submit"
                          name="quantity"
                          value={item.quantity - 1}
                          aria-label={`Decrease quantity of ${item.title}`}
                          disabled={item.quantity <= 1}
                          aria-disabled={isPending || undefined}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            aria-hidden="true"
                            focusable="false"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          >
                            <path d="M3 8h10" />
                          </svg>
                        </button>
                        <output
                          aria-label={`Quantity of ${item.title}`}
                          aria-live="polite"
                          aria-describedby={quantityError ? quantityErrorId : undefined}
                          mix={css({
                            padding: '0 0.5rem',
                            textAlign: 'center',
                            fontVariantNumeric: 'tabular-nums',
                          })}
                        >
                          {quantity}
                        </output>
                        <button
                          type="submit"
                          name="quantity"
                          value={item.quantity + 1}
                          aria-label={`Increase quantity of ${item.title}`}
                          disabled={item.quantity >= Number.MAX_SAFE_INTEGER}
                          aria-disabled={isPending || undefined}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            aria-hidden="true"
                            focusable="false"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          >
                            <path d="M3 8h10M8 3v10" />
                          </svg>
                        </button>
                        {quantityError ? (
                          <p
                            id={quantityErrorId}
                            role="alert"
                            mix={css({
                              position: 'absolute',
                              bottom: '0.5rem',
                              left: '0.75rem',
                              right: '0.75rem',
                              color: '#dc2626',
                              margin: 0,
                              fontSize: '0.875rem',
                            })}
                          >
                            {quantityError}
                          </p>
                        ) : null}
                      </RestfulForm>
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
                                height: 'var(--cart-control-height)',
                                verticalAlign: 'top',
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
