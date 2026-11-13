import { type Handle, clientEntry, on } from 'remix/component'

import { routes } from '../../../routes.ts'
import { PendingButton } from '../../../ui/public/pending-button.tsx'

export const CartButton = clientEntry(
  import.meta.url,
  function CartButton(handle: Handle<{ inCart: boolean; id: string | number; slug: string }>) {
    let pending = false
    let failed = false

    return () => {
      let { inCart, id, slug } = handle.props

      return (
        <PendingButton
          type="button"
          pending={pending}
          failed={failed}
          pendingLabel="Saving..."
          mix={on('click', async (_event, signal) => {
            pending = true
            failed = false
            handle.update()

            let formData = new FormData()
            formData.set('bookId', String(id))
            formData.set('slug', slug)

            try {
              let response = await fetch(routes.api.cartToggle.href(), {
                method: 'POST',
                body: formData,
                signal,
              })
              if (!response.ok) throw new Error('Couldn’t update your cart.')

              await handle.frame.reload()
              await new Promise((resolve) => setTimeout(resolve, 500))
            } catch {
              if (!signal.aborted) failed = true
            } finally {
              if (!signal.aborted) {
                pending = false
                handle.update()
              }
            }
          })}
        >
          {inCart ? 'Remove from Cart' : 'Add to Cart'}
        </PendingButton>
      )
    }
  },
)
