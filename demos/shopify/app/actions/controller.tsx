import * as path from 'node:path'
import { openLazyFile } from 'remix/fs'
import { createFileResponse } from 'remix/response/file'
import { createController } from 'remix/router'

import { routes } from '../routes.ts'
import { agentGuideContentType, prefersMarkdown } from '../utils/agent-response.ts'
import { AgenticPage } from './agentic-page.tsx'
import { HomePage } from './home-page.tsx'
import { PricingPage } from './pricing-page.tsx'
import { SitemapPage } from './sitemap-page.tsx'

const agentGuidePath = path.resolve(import.meta.dirname, '../../public/agents.md')

export default createController(routes, {
  actions: {
    async home({ headers, render, request }) {
      if (prefersMarkdown(headers)) {
        let guide = openLazyFile(agentGuidePath, { type: agentGuideContentType })
        let response = await createFileResponse(guide, request)
        response.headers.set('Vary', 'Accept')
        return response
      }
      return render(<HomePage />, { headers: { Vary: 'Accept' } })
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
