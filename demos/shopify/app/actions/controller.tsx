import { createController } from 'remix/router'

import { routes } from '../routes.ts'
import { AgenticPage } from './agentic-page.tsx'
import { HomePage } from './home-page.tsx'
import { PricingPage } from './pricing-page.tsx'
import { SitemapPage } from './sitemap-page.tsx'

export default createController(routes, {
  actions: {
    home({ render }) {
      return render(<HomePage />)
    },
    agenticStorefronts({ render }) {
      return render(<AgenticPage />)
    },
    pricing({ render }) {
      return render(<PricingPage />)
    },
    sitemap({ render }) {
      return render(<SitemapPage />)
    },
  },
})
