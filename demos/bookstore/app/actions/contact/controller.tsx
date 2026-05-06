import type { AppController } from '../../router.ts'

import type { routes } from '../../routes.ts'
import { render } from '../render.tsx'
import { ContactPage, ContactSuccessPage } from './page.tsx'

export default {
  actions: {
    index() {
      return render(<ContactPage />)
    },

    async action() {
      return render(<ContactSuccessPage />)
    },
  },
} satisfies AppController<typeof routes.contact>
