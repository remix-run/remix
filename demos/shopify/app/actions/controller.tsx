import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { pagePaths, pages } from '../data/pages.ts'
import type { MarketingPage } from '../data/pages.ts'
import { routes } from '../routes.ts'
import { AgenticPage } from './agentic-page.tsx'
import { HomePage } from './home-page.tsx'
import { ProductPage } from './marketing-page.tsx'
import { notFound } from './not-found.tsx'
import { PricingPage } from './pricing-page.tsx'
import { SitemapPage } from './sitemap-page.tsx'

const marketingPages = new Map<string, MarketingPage>(
  Object.values(pages).map((page) => [page.path, page]),
)

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
    marketing(context) {
      let { url, render } = context

      let canonicalPath = url.pathname.replace(/\/+$/, '')
      if (canonicalPath !== url.pathname && pagePaths.includes(canonicalPath)) {
        return redirect(`${canonicalPath}${url.search}`, 308)
      }

      let page = marketingPages.get(url.pathname)
      return page ? render(<ProductPage page={page} />) : notFound(context)
    },
  },
})
