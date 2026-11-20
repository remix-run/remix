import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { routes } from '../routes.ts'
import { assets } from '../utils/assets.ts'
import { HomePage } from './home-page.tsx'

export const rootController = createController(routes, {
  actions: {
    async assets({ request }) {
      return (await assets.fetch(request)) ?? new Response('Not found', { status: 404 })
    },

    home({ auth, render }) {
      if (auth.ok) {
        return redirect(routes.account.index.href())
      }

      return render(<HomePage />)
    },
  },
})
