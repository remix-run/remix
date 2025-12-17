import { type Remix, hydrated } from '@remix-run/dom'
import { dom } from '@remix-run/events'

import { routes } from '../routes.ts'

export const CartButton = hydrated(
  routes.assets.href({ path: 'cart-button.js#CartButton' }),
  function (this: Remix.Handle) {
    let updating = false

    return ({ inCart, id, slug }: { inCart: boolean; id: string; slug: string }) => {
      let route = inCart ? routes.cart.api.remove : routes.cart.api.add
      let method = route.method
      let action = route.href()

      return (
        <form
          method={method}
          action={action}
          on={dom.submit(async (event, signal) => {
            event.preventDefault()

            updating = true
            this.update()

            await fetch(action, {
              method,
              body: new FormData(event.currentTarget),
              signal,
            })
            if (signal.aborted) return

            await this.frame.reload()
            if (signal.aborted) return

            updating = false
            this.update()
          })}
        >
          <input type="hidden" name="bookId" value={id} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="redirect" value="none" />
          <button type="submit" class="btn" style={{ opacity: updating ? 0.5 : 1 }}>
            {inCart ? 'Remove from Cart' : 'Add to Cart'}
          </button>
        </form>
      )
    }
  },
)
