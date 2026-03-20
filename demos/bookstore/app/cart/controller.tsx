import type { Controller } from 'remix/fetch-router'
import { Frame } from 'remix/component'

import { routes } from '../routes.ts'
import { Layout } from '../layout.tsx'
import { render } from '../utils/render.ts'
import cartApiController from './api/controller.tsx'

export { toggleCart } from './api/controller.tsx'

export default {
  actions: {
    index() {
      return render(
        <Layout>
          <h1>Shopping Cart</h1>

          <div class="card">
            <Frame name="cart" src={routes.fragments.cartItems.href()} />
          </div>
        </Layout>,
      )
    },

    api: cartApiController,
  },
} satisfies Controller<typeof routes.cart>
