import type { FrameReloadStartEvent, Handle } from 'remix/component'
import { clientEntry, css, on } from 'remix/component'

import { routes } from '../../../../routes.ts'

export const CartButton = clientEntry(
  import.meta.url,
  function CartButton(handle: Handle<{ inCart: boolean; id: string | number; error?: string }>) {
    let activeReload: FrameReloadStartEvent | undefined
    let failed = false

    handle.frame.addEventListener(
      'reloadStart',
      async (event) => {
        activeReload = event
        failed = false
        handle.update()
        try {
          await event.finished
        } catch {
          if (activeReload === event) failed = true
        }
        if (handle.signal.aborted || activeReload !== event) return
        activeReload = undefined
        handle.update()
      },
      { signal: handle.signal },
    )

    return () => {
      let { inCart, id, error } = handle.props
      let pending = activeReload !== undefined

      return (
        <form
          method="POST"
          action={routes.cart.fragments.cartButtonToggle.href({ bookId: id })}
          mix={on('submit', (event) => {
            if (event.defaultPrevented) return
            event.preventDefault()
            if (activeReload) return
            let body = new FormData(event.currentTarget, event.submitter)
            // reloadStart owns pending state and reports failures.
            void handle.frame.reload({ method: 'post', body }).catch(() => {})
          })}
        >
          <button
            type="submit"
            name="intent"
            value={inCart ? 'remove' : 'add'}
            aria-disabled={pending ? 'true' : undefined}
            class="btn"
          >
            {pending ? 'Saving...' : inCart ? 'Remove from Cart' : 'Add to Cart'}
          </button>
          {!pending && (failed || error) ? (
            <p role="alert" mix={css({ color: '#dc2626' })}>
              {failed ? 'Couldn’t update your cart. Try again.' : error}
            </p>
          ) : null}
        </form>
      )
    }
  },
)
