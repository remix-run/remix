import { createController } from 'remix/router'
import { SuperHeaders } from 'remix/headers'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../routes.ts'
import { CartPage } from './page.tsx'

export default createController(routes.cart, {
  actions: {
    index({ render, request }) {
      // A link that reloads the cart in place asks for its frame's items instead of the page.
      if (request.headers.get('X-Remix-Target') === 'cart') {
        return redirect(routes.fragments.cartItems.href())
      }
      return render(<CartPage />, {
        headers: new SuperHeaders({ cacheControl: { noStore: true } }),
      })
    },
  },
})
