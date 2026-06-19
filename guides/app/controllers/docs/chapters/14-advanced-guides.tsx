import type { Handle } from 'remix/ui'

import { routes } from '../../../routes.ts'
import type { AppContext } from '../../../middleware/render.ts'
import type { DocsPageProps } from '../shared.tsx'
import { DocsChapter, DocsSection, docsResponseInit } from '../shared.tsx'

export async function advancedGuidesHandler({ render, request }: AppContext) {
  return render(<AdvancedGuidesPage requestUrl={request.url} />, docsResponseInit)
}

function AdvancedGuidesPage(handle: Handle<DocsPageProps>) {
  return () => (
    <DocsChapter
      requestUrl={handle.props.requestUrl}
      chapter="Chapter 14"
      title="Advanced Guides"
      description="Deeper patterns for extending Remix, integrating services, and building specialized systems."
      previous={{ href: routes.docs.production.href(), title: 'Production' }}
      next={{ href: routes.docs.exampleApps.href(), title: 'Example Apps' }}
    >
      <DocsSection id="building-custom-ui-primitives" title="Building custom UI primitives">
        <p>Placeholder for Building custom UI primitives.</p>
      </DocsSection>

      <DocsSection id="building-reusable-mixin-libraries" title="Building reusable mixin libraries">
        <p>Placeholder for Building reusable mixin libraries.</p>
      </DocsSection>

      <DocsSection id="low-level-route-patterns" title="Low-level route patterns">
        <p>Placeholder for Low-level route patterns.</p>
      </DocsSection>

      <DocsSection id="fetch-proxying" title="Fetch proxying">
        <p>Placeholder for Fetch proxying.</p>
      </DocsSection>

      <DocsSection id="server-sent-events" title="Server-sent events">
        <p>Placeholder for Server-sent events.</p>
      </DocsSection>

      <DocsSection
        id="tar-parsing-and-package-browser-style-apps"
        title="Tar parsing and package-browser style apps"
      >
        <p>Placeholder for Tar parsing and package-browser style apps.</p>
      </DocsSection>

      <DocsSection id="building-clis-with-remix-packages" title="Building CLIs with Remix packages">
        <p>Placeholder for Building CLIs with Remix packages.</p>
      </DocsSection>

      <DocsSection id="integrating-external-services" title="Integrating external services">
        <p>Placeholder for Integrating external services.</p>
      </DocsSection>
    </DocsChapter>
  )
}
