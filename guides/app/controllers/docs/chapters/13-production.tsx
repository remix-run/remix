import type { Handle } from 'remix/ui'

import { routes } from '../../../routes.ts'
import type { AppContext } from '../../../middleware/render.ts'
import type { DocsPageProps } from '../shared.tsx'
import { DocsChapter, DocsSection, docsResponseInit } from '../shared.tsx'

export async function productionHandler({ render, request }: AppContext) {
  return render(<ProductionPage requestUrl={request.url} />, docsResponseInit)
}

function ProductionPage(handle: Handle<DocsPageProps>) {
  return () => (
    <DocsChapter
      requestUrl={handle.props.requestUrl}
      chapter="Chapter 13"
      title="Production"
      description="Operational concerns for running Remix applications outside the development loop."
      previous={{
        href: routes.docs.cliAndTooling.href(),
        title: 'CLI and Tooling',
      }}
      next={{
        href: routes.docs.advancedGuides.href(),
        title: 'Advanced Guides',
      }}
    >
      <DocsSection id="environment-variables-and-secrets" title="Environment variables and secrets">
        <p>Placeholder for Environment variables and secrets.</p>
      </DocsSection>

      <DocsSection id="startup-and-shutdown" title="Startup and shutdown">
        <p>Placeholder for Startup and shutdown.</p>
      </DocsSection>

      <DocsSection id="caching" title="Caching">
        <p>Placeholder for Caching.</p>
      </DocsSection>

      <DocsSection id="streaming-and-aborts" title="Streaming and aborts">
        <p>Placeholder for Streaming and aborts.</p>
      </DocsSection>

      <DocsSection id="error-handling" title="Error handling">
        <p>Placeholder for Error handling.</p>
      </DocsSection>

      <DocsSection id="deployment-checklist" title="Deployment checklist">
        <p>Placeholder for Deployment checklist.</p>
      </DocsSection>

      <DocsSection id="observability-hooks" title="Observability hooks">
        <p>Placeholder for Observability hooks.</p>
      </DocsSection>
    </DocsChapter>
  )
}
