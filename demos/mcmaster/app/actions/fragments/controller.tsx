import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { getCartItems, getCartSubtotal, loadCartLines } from '../cart-items.ts'
import { CartSummary } from './cart-summary.tsx'

export default createController(routes.fragments, {
  actions: {
    // The only personalized part of the shell lives in its own frame, so the catalog content around
    // it can stay shareable and cacheable.
    async cartSummary({ db, render, session }) {
      let lines = await loadCartLines(db, getCartItems(session))
      let itemCount = lines.reduce((count, line) => count + line.quantity, 0)

      return render(<CartSummary itemCount={itemCount} subtotal={getCartSubtotal(lines)} />, {
        headers: { 'Cache-Control': 'private, no-store' },
      })
    },
  },
})
