import { type Handle, hydrationRoot } from 'remix/component'

import { routes } from '../routes.ts'

export const CartButton = hydrationRoot(
  routes.assets.href({ path: 'cart-button.js#CartButton' }),
  function CartButton(handle: Handle) {
    let pending = false

    return ({ inCart, id, slug }: { inCart: boolean; id: string; slug: string }) => {
      let route = inCart ? routes.cart.api.remove : routes.cart.api.add
      let method = route.method.toUpperCase()

      return (
        <form
          method="POST"
          action={route.href()}
          on={{
            submit: () => {
              // Show pending state, let browser submit normally
              pending = true
              handle.update()
            },
          }}
        >
          {method !== 'POST' && <input type="hidden" name="_method" value={method} />}
          <input type="hidden" name="bookId" value={id} />
          <input type="hidden" name="slug" value={slug} />
          <button type="submit" class="btn" style={{ opacity: pending ? 0.5 : 1 }}>
            {inCart ? 'Remove from Cart' : 'Add to Cart'}
          </button>
        </form>
      )
    }
  },
)
