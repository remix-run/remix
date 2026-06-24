import { createController } from 'remix/router'

import { routes } from '../routes.ts'
import { getGuestbookEntries } from '../models/guestbook.ts'
import { AboutPage } from '../views/marketing/about.tsx'
import { HomePage } from '../views/marketing/home.tsx'

export default createController(routes.marketing, {
  actions: {
    about({ render }) {
      return render(<AboutPage />)
    },
    async home({ render }) {
      let guestbook = await getGuestbookEntries({ limit: 10 })

      return render(<HomePage guestbook={guestbook} />)
    },
  },
})
