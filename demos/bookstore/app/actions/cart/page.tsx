import { Frame } from 'remix/component'

import { routes } from '../../routes.ts'
import { Layout } from '../../ui/layout.tsx'

export function CartPage() {
  return () => (
    <Layout>
      <h1>Shopping Cart</h1>
      <div class="card" role="region" aria-label="Shopping cart" tabIndex={-1}>
        <Frame name="cart" src={routes.cart.fragments.items.href()} />
      </div>
    </Layout>
  )
}
