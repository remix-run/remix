import type { Controller } from 'remix/fetch-router'

import type { routes } from '../routes.ts'
import { HomePage } from '../ui/scaffold-home-page.tsx'
import { render } from '../utils/render.tsx'

export const home = {
  actions: {
    index({ request }) {
      return render(<HomePage />, request)
    },
  },
} satisfies Controller<typeof routes.home>
