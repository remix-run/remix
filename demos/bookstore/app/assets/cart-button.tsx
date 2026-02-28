import { type Handle, clientEntry, on } from 'remix/component'

import { routes } from '../routes.ts'

let moduleUrl = routes.assets.href({ path: 'cart-button.js#CartButton' })

export const CartButton = clientEntry(moduleUrl, (handle: Handle) => {
  let pending = false

  return ({ inCart, id, slug }: { inCart: boolean; id: string | number; slug: string }) => (
    <button
      type="button"
      mix={[
        on('click', async (_event, signal) => {
          pending = true
          handle.update()

          let formData = new FormData()
          formData.set('bookId', String(id))
          formData.set('slug', slug)

          await fetch(routes.api.cartToggle.href(), {
            method: 'POST',
            body: formData,
            signal,
          })

          await handle.frame.reload()
          await new Promise((resolve) => setTimeout(resolve, 500))
          if (signal.aborted) return
          pending = false
          handle.update()
        }),
      ]}
      class="btn"
    >
      {pending ? 'Saving...' : inCart ? 'Remove from Cart' : 'Add to Cart'}
    </button>
  )
})
