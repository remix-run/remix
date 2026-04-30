import type { BuildAction } from 'remix/fetch-router'

import type { routes } from '../routes.ts'
import { HomePage } from '../ui/scaffold-home-page.tsx'
import { render } from '../utils/render.tsx'

export const home: BuildAction<'GET', typeof routes.home> = {
  handler({ request }) {
    return render(<HomePage />, request)
  },
}
