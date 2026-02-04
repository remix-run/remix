import { type Handle, hydrationRoot } from 'remix/component'

import { routes } from '../routes.ts'

export const CartButton = hydrationRoot(
  routes.assets.href({ path: 'cart-button.js#CartButton' }),
  function CartButton(handle: Handle) {
    let pending = false

    return ({ inCart, id, slug }: { inCart: boolean; id: string; slug: string }) => {
      console.log('CartButton', inCart, id, slug)
      return (
        <button
          type="button"
          on={{
            async click(_event, signal) {
              if (pending) return
              pending = true
              handle.update()

              try {
                let formData = new FormData()
                formData.set('bookId', id)
                formData.set('slug', slug)

                let response = await fetch(routes.api.cartToggle.href(), {
                  method: 'POST',
                  body: formData,
                  signal,
                })

                if (!response.ok) {
                  console.error(
                    '[CartButton] API request failed:',
                    response.status,
                    response.statusText,
                  )
                  return
                }

                await handle.frame.reload()
              } finally {
                pending = false
                handle.update()
              }
            },
          }}
          class="btn"
        >
          {pending ? 'Saving...' : inCart ? 'Remove from Cart' : 'Add to Cart'}
        </button>
      )
    }
  },
)
