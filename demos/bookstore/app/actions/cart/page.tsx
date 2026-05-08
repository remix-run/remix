import { Frame } from 'remix/ui'

import { routes } from '../../routes.ts'
import { Layout } from '../../ui/layout.tsx'

export function CartPage() {
  return () => (
    <Layout>
      <h1>Shopping Cart</h1>

      <div class="card">
        <Frame name="cart" src={routes.fragments.cartItems.href()} />
      </div>
    </Layout>
  )
}
