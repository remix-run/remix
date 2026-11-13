import { type FrameReloadStartEvent, type Handle, clientEntry, css, on } from 'remix/component'

import { routes } from '../../../routes.ts'
import { PendingButton } from '../../../ui/public/pending-button.tsx'

export const CartButton = clientEntry(
  import.meta.url,
  function CartButton(
    handle: Handle<{ inCart: boolean; id: number; error?: string; showErrorMessage?: boolean }>,
  ) {
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
      let { inCart, id, error, showErrorMessage } = handle.props
      let pending = activeReload !== undefined
      let message = !pending && !failed && showErrorMessage ? error : undefined

      return (
        <form
          method="POST"
          action={routes.fragments.cartToggle.href({ bookId: id })}
          mix={[
            css({ display: 'contents' }),
            on('submit', (event) => {
              if (event.defaultPrevented) return
              event.preventDefault()
              if (activeReload) return
              let body = new FormData(event.currentTarget, event.submitter)
              // reloadStart owns pending state and reports failures.
              void handle.frame.reload({ method: 'post', body }).catch(() => {})
            }),
          ]}
        >
          <PendingButton
            pending={pending}
            failed={!pending && (failed || !!error)}
            pendingLabel="Saving..."
            aria-disabled={pending || undefined}
          >
            {inCart ? 'Remove from Cart' : 'Add to Cart'}
          </PendingButton>
          {message ? (
            <p
              role="alert"
              mix={css({
                gridColumn: '1 / -1',
                justifySelf: 'stretch',
                margin: 0,
                color: '#dc2626',
                fontSize: '0.875rem',
              })}
            >
              {message}
            </p>
          ) : null}
        </form>
      )
    }
  },
)
