import type { Handle } from 'remix/component'
import { css, Frame } from 'remix/component'

import { routes } from '../../routes.ts'
import { Layout } from '../../ui/layout.tsx'

export function CartPage(handle: Handle<{ error?: string }>) {
  return () => (
    <Layout>
      <h1>Shopping Cart</h1>
      {handle.props.error ? (
        <p
          role="alert"
          mix={css({ color: '#dc2626', textAlign: 'center', paddingBottom: '1.5rem' })}
        >
          {handle.props.error}
        </p>
      ) : null}

      <div class="card" role="region" aria-label="Shopping cart" tabIndex={-1}>
        <Frame name="cart" src={routes.cart.fragments.items.href()} />
      </div>
    </Layout>
  )
}
