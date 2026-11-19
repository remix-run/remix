import * as form from '@remix-run/ui/form'
import type { FormSubmission } from 'remix/data-schema/experimental/form'
import type { FrameReloadStartEvent, Handle, RemixNode } from 'remix/component'
import { css, clientEntry, on, ref } from 'remix/component'

import { routes } from '../../../../routes.ts'
import { PendingButton } from '../../../../ui/public/pending-button.tsx'
import { RestfulForm } from '../../../../ui/restful-form.tsx'
import { CartItemRemoveForm } from './schema.ts'

const undoTimeout = 2000

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
  | { bookId: number; type: 'restore'; quantity: number }
  | { bookId: number; type: 'remove' }

type RemovedItem = {
  item: CartItem
  phase: 'undo' | 'exiting' | 'restoring' | 'restore-failed'
  confirmed: boolean
  hovered: boolean
  focused: boolean
  timer?: ReturnType<typeof setTimeout>
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

    let removedItems = new Map<number, RemovedItem>()
    let order = handle.props.items.map((item) => item.bookId)
    let rows = new Map<number, Element>()
    let mutation: Promise<void> | undefined
    let generation = 0

    handle.signal.addEventListener(
      'abort',
      () => {
        for (let removed of removedItems.values()) clearTimeout(removed.timer)
        removedItems.clear()
        rows.clear()
      },
      { once: true },
    )

    async function finishExit(removed: RemovedItem) {
      if (removed.phase !== 'exiting') return
      await handle.update()
      if (handle.signal.aborted || removed.phase !== 'exiting') return
      let row = rows.get(removed.item.bookId)
      // Keep the row mounted until its cells have actually finished collapsing.
      row?.getBoundingClientRect()
      await Promise.all(
        (row?.getAnimations({ subtree: true }) ?? []).map((animation) =>
          animation.finished.catch(() => {}),
        ),
      )
      if (
        handle.signal.aborted ||
        removedItems.get(removed.item.bookId) !== removed ||
        removed.phase !== 'exiting' ||
        !removed.confirmed
      )
        return
      removedItems.delete(removed.item.bookId)
      handle.update()
    }

    function startUndoCountdown(removed: RemovedItem) {
      clearTimeout(removed.timer)
      removed.timer = setTimeout(() => {
        if (
          handle.signal.aborted ||
          removedItems.get(removed.item.bookId) !== removed ||
          removed.phase !== 'undo' ||
          removed.hovered ||
          removed.focused
        )
          return
        removed.timer = undefined
        removed.phase = 'exiting'
        let row = rows.get(removed.item.bookId)
        if (row?.contains(document.activeElement)) {
          row.closest<HTMLElement>('[role="region"]')?.focus({ preventScroll: true })
        }
        void finishExit(removed)
      }, undoTimeout)
    }

    function pauseUndoCountdown(
      removed: RemovedItem,
      source: 'hovered' | 'focused',
      paused: boolean,
    ) {
      if (removed.phase !== 'undo' || removed[source] === paused) return
      removed[source] = paused
      clearTimeout(removed.timer)
      removed.timer = undefined
      if (!removed.hovered && !removed.focused) {
        startUndoCountdown(removed)
      }
      handle.update()
    }

    function mutate(body: FormData): Promise<void> {
      let previous = mutation
      let startedIn = generation
      let next = (async () => {
        if (previous) await previous
        if (handle.signal.aborted || generation !== startedIn) return
        // reloadStart owns pending state and reports failures.
        try {
          await handle.frame.reload({ method: 'post', body })
        } catch {}
      })()
      mutation = next
      void next.then(() => {
        if (mutation === next) mutation = undefined
      })
      return next
    }

    async function undo(removed: RemovedItem) {
      if (removed.phase !== 'undo' && removed.phase !== 'restore-failed') return
      let row = rows.get(removed.item.bookId)
      let hadFocus = row?.contains(document.activeElement)
      clearTimeout(removed.timer)
      removed.phase = 'restoring'
      handle.update()
      let body = new FormData()
      body.set('bookId', String(removed.item.bookId))
      body.set('quantity', String(removed.item.quantity))
      // Restoring waits for any active mutation, including an unfinished removal.
      await mutate(body)
      if (handle.signal.aborted) return
      await handle.update()
      if (hadFocus && document.activeElement === document.body) {
        row
          ?.querySelector<HTMLElement>('form:has(input[value="DELETE"]) button')
          ?.focus({ preventScroll: true })
      }
    }

    handle.frame.addEventListener(
      'reloadStart',
      async (event) => {
        let formData = event.formData
        let method = formData?.get('_method') ?? event.method.toUpperCase()
        let action: CartAction | undefined = formData?.has('bookId')
          ? method === 'DELETE'
            ? { bookId: Number(formData.get('bookId')), type: 'remove' }
            : {
                bookId: Number(formData.get('bookId')),
                type: method === 'PATCH' ? 'update' : 'restore',
                quantity: Number(formData.get('quantity')),
              }
          : undefined
        if (!action) {
          generation++
          for (let removed of removedItems.values()) clearTimeout(removed.timer)
          removedItems.clear()
        } else if (action.type === 'remove') {
          let item = handle.props.items.find((item) => item.bookId === action.bookId)
          if (item) {
            let removed: RemovedItem = {
              item: { ...item },
              phase: 'undo',
              confirmed: false,
              hovered: false,
              focused: false,
            }
            removedItems.set(item.bookId, removed)
            startUndoCountdown(removed)
          }
        }
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
        let removed = action && removedItems.get(action.bookId)
        if (removed && action?.type === 'remove') {
          if (state.status === 'failed') {
            clearTimeout(removed.timer)
            if (removed.phase !== 'restoring') removedItems.delete(action.bookId)
          } else {
            removed.confirmed = true
            void finishExit(removed)
          }
        } else if (removed && action?.type === 'restore') {
          if (state.status === 'failed') {
            removed.phase = 'restore-failed'
          } else {
            removedItems.delete(action.bookId)
          }
        }
        handle.update()
      },
      { signal: handle.signal },
    )

    return () => {
      let { items, canCheckout, error, showErrorMessage, errorBookId, submission, total } =
        handle.props
      let displayedItems = new Map(items.map((item) => [item.bookId, item]))
      for (let [bookId, removed] of removedItems) displayedItems.set(bookId, removed.item)
      for (let bookId of displayedItems.keys()) {
        if (!order.includes(bookId)) order.push(bookId)
      }
      let visibleItems = order.flatMap((bookId) => {
        let item = displayedItems.get(bookId)
        return item ? [item] : []
      })
      let isPending =
        state.status === 'pending' ||
        [...removedItems.values()].some((removed) => removed.phase === 'restoring')
      let pendingAction = state.status === 'pending' ? state.action : undefined
      let failedAction = state.status === 'failed' ? state.action : undefined
      let requestFailed = state.status === 'failed' && state.source === 'request'
      let hasQuantityError =
        submission?.errors.fields.quantity &&
        items.some((item) => item.bookId === Number(submission.values.bookId))
      let failedBookId = errorBookId ?? Number(submission?.values.bookId)
      let cartError =
        !isPending && !requestFailed && showErrorMessage && !hasQuantityError ? error : undefined

      if (visibleItems.length === 0) {
        return (
          <div mix={css({ marginTop: '2rem' })}>
            {cartError ? (
              <p
                role="alert"
                mix={css({ color: '#dc2626', textAlign: 'center', paddingBottom: '1.5rem' })}
              >
                {cartError}
              </p>
            ) : null}
            <p>Your cart is empty.</p>
            <p mix={css({ marginTop: '1rem' })}>
              <a data-rmx-prefetch="intent" href={routes.books.index.href()} class="btn">
                Browse Books
              </a>
            </p>
          </div>
        )
      }

      return (
        <div
          mix={on('submit', async (event) => {
            if (event.defaultPrevented) return
            let form = event.target
            if (!(form instanceof HTMLFormElement)) return
            event.preventDefault()
            if (mutation) return
            let body = new FormData(form, event.submitter)
            let cartRegion =
              body.get('_method') === 'DELETE' && form.contains(document.activeElement)
                ? form.closest<HTMLElement>('[role="region"]')
                : null
            let request = mutate(body)
            if (cartRegion) {
              await handle.update()
              rows
                .get(Number(body.get('bookId')))
                ?.querySelector<HTMLElement>('button[type="button"]')
                ?.focus({ preventScroll: true })
            }
            await request
            if (!cartRegion || handle.signal.aborted) return
            await handle.update()
            if (!cartRegion.isConnected || handle.signal.aborted) return
            if (document.activeElement === cartRegion || document.activeElement === document.body) {
              let row = rows.get(Number(body.get('bookId')))
              let button = row?.querySelector<HTMLElement>(
                'button[type="button"], form:has(input[value="DELETE"]) button',
              )
              if (button && !row?.hasAttribute('inert')) button.focus({ preventScroll: true })
              else cartRegion.focus({ preventScroll: true })
            }
          })}
        >
          <div mix={css({ overflowX: 'auto' })}>
            <table mix={css({ tableLayout: 'fixed', minWidth: '44rem' })}>
              <thead>
                <tr>
                  <th>Book</th>
                  <th mix={css({ width: '6rem' })}>Price</th>
                  <th mix={css({ width: '9.5rem' })}>Quantity</th>
                  <th mix={css({ width: '7rem' })}>Subtotal</th>
                  <th mix={css({ width: '8.5rem' })}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => {
                  let removed = removedItems.get(item.bookId)
                  let isCompact = removed?.phase === 'undo' || removed?.phase === 'restore-failed'
                  let isExiting = removed?.phase === 'exiting'
                  let showRemoved = isCompact || isExiting
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
                  let actionButtonStyle = css({
                    height: 'var(--cart-control-height)',
                    verticalAlign: 'top',
                    fontSize: '0.875rem',
                    padding: '0.25rem 0.5rem',
                    minWidth: '7rem',
                    textAlign: 'center',
                  })

                  return (
                    <tr
                      key={item.bookId}
                      inert={isExiting}
                      mix={[
                        ref((row, signal) => {
                          rows.set(item.bookId, row)
                          signal.addEventListener('abort', () => rows.delete(item.bookId), {
                            once: true,
                          })
                        }),
                        css({
                          '--cart-control-height': '1.9rem',
                          position: 'relative',
                          opacity: isExiting ? 0 : 1,
                          transition: 'opacity 200ms ease',
                          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                        }),
                      ]}
                    >
                      <CartItemCell collapsed={isExiting} compact={isCompact}>
                        <div
                          mix={css({
                            display: 'inline-flex',
                            maxWidth: '100%',
                            alignItems: 'center',
                            gap: '0.75rem',
                          })}
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
                          <span
                            mix={css({
                              color: showRemoved ? '#6b7280' : undefined,
                              minWidth: 0,
                              overflowWrap: 'anywhere',
                            })}
                          >
                            <a
                              data-rmx-prefetch="intent"
                              href={routes.books.show.href({ slug: item.slug })}
                              mix={css({ color: showRemoved ? 'inherit' : undefined })}
                            >
                              {item.title}
                            </a>
                            {showRemoved ? <span> removed</span> : null}
                          </span>
                        </div>
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
                      </CartItemCell>

                      <CartItemCell collapsed={isExiting || isCompact} compact={isCompact}>
                        ${item.price.toFixed(2)}
                      </CartItemCell>

                      <CartItemCell collapsed={isExiting || isCompact} compact={isCompact}>
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
                      </CartItemCell>

                      <CartItemCell collapsed={isExiting || isCompact} compact={isCompact}>
                        <PendingPrice amount={item.price * item.quantity} pending={isUpdating} />
                      </CartItemCell>

                      <CartItemCell collapsed={isExiting} compact={isCompact}>
                        {removed ? (
                          <PendingButton
                            type="button"
                            pending={removed.phase === 'restoring'}
                            pendingLabel="Restoring..."
                            failed={removed.phase === 'restore-failed'}
                            aria-disabled={removed.phase === 'restoring' || undefined}
                            class="btn btn-secondary"
                            mix={[
                              on('click', () => undo(removed)),
                              on('pointerenter', (event) => {
                                if (event.pointerType !== 'touch')
                                  pauseUndoCountdown(removed, 'hovered', true)
                              }),
                              on('pointerleave', (event) => {
                                if (event.pointerType !== 'touch')
                                  pauseUndoCountdown(removed, 'hovered', false)
                              }),
                              on('focus', (event) => {
                                // Remove also moves pointer users' focus here; only keyboard focus pauses.
                                pauseUndoCountdown(
                                  removed,
                                  'focused',
                                  event.target instanceof Element &&
                                    event.target.matches(':focus-visible'),
                                )
                              }),
                              on('blur', () => pauseUndoCountdown(removed, 'focused', false)),
                              actionButtonStyle,
                              css({
                                position: 'relative',
                                overflow: 'hidden',
                                isolation: 'isolate',
                                backgroundColor: removed.phase === 'undo' ? '#6b7280' : undefined,
                              }),
                            ]}
                          >
                            {removed.phase === 'undo' ? (
                              <span
                                aria-hidden="true"
                                mix={css({
                                  position: 'absolute',
                                  inset: 0,
                                  pointerEvents: 'none',
                                  background: '#374151',
                                  transformOrigin: 'left',
                                  transform:
                                    removed.hovered || removed.focused ? 'scaleX(1)' : 'scaleX(0)',
                                  transition:
                                    removed.hovered || removed.focused
                                      ? 'transform 200ms ease-out'
                                      : `transform ${undoTimeout}ms linear`,
                                  '@starting-style': { transform: 'scaleX(1)' },
                                  '@media (prefers-reduced-motion: reduce)': {
                                    transform: 'scaleX(1)',
                                    transition: 'none',
                                  },
                                })}
                              />
                            ) : null}
                            <span mix={css({ position: 'relative' })}>Undo</span>
                          </PendingButton>
                        ) : (
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
                                  mix={actionButtonStyle}
                                >
                                  Remove
                                </PendingButton>
                              </RestfulForm>
                            )}
                          </form.Context>
                        )}
                      </CartItemCell>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

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

function CartItemCell(
  handle: Handle<{ collapsed: boolean; compact?: boolean; children: RemixNode }>,
) {
  return () => {
    let { collapsed, compact, children } = handle.props
    return (
      <td
        mix={css({
          verticalAlign: 'top',
          paddingTop: 0,
          paddingBottom: compact ? '0.5rem' : collapsed ? 0 : '3rem',
          borderBottomWidth: collapsed && !compact ? 0 : '1px',
          transition: 'padding-bottom 200ms ease, border-bottom-width 200ms ease',
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        })}
      >
        <div
          mix={css({
            display: 'grid',
            gridTemplateRows: collapsed && !compact ? '0fr' : '1fr',
            transition: 'grid-template-rows 200ms ease',
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          })}
        >
          <div
            inert={collapsed}
            aria-hidden={collapsed || undefined}
            mix={css({
              minHeight: 0,
              overflow: 'hidden',
              opacity: collapsed ? 0 : 1,
              transition: 'opacity 200ms ease',
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            })}
          >
            <div
              mix={css({
                display: 'flex',
                alignItems: 'center',
                // Keep content anchored to the thumbnail while space below it collapses.
                minHeight: 'calc(64px + 0.75rem)',
                paddingTop: '0.75rem',
              })}
            >
              {children}
            </div>
          </div>
        </div>
      </td>
    )
  }
}

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
