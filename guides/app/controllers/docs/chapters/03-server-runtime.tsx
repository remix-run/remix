import type { Handle } from 'remix/ui'

import { routes } from '../../../routes.ts'
import type { AppContext } from '../../../middleware/render.ts'
import type { DocsPageProps } from '../shared.tsx'
import { DocsChapter, DocsSection, docsResponseInit } from '../shared.tsx'

export async function serverRuntimeHandler({ render, request }: AppContext) {
  return render(<ServerRuntimePage requestUrl={request.url} />, docsResponseInit)
}

function ServerRuntimePage(handle: Handle<DocsPageProps>) {
  return () => (
    <DocsChapter
      requestUrl={handle.props.requestUrl}
      chapter="Chapter 3"
      title="Server Runtime"
      description="How Remix bridges Web API request handling into a Node server and middleware stack."
      previous={{
        href: routes.docs.coreAppStructure.href(),
        title: 'Core App Structure',
      }}
      next={{ href: routes.docs.renderingUi.href(), title: 'Rendering UI' }}
    >
      <DocsSection id="the-node-server-entry" title="The Node server entry">
        <p>Placeholder for The Node server entry.</p>
      </DocsSection>

      <DocsSection id="createrequestlistener" title="createRequestListener">
        <p>Placeholder for createRequestListener.</p>
      </DocsSection>

      <DocsSection id="middleware-ordering" title="Middleware ordering">
        <p>Placeholder for Middleware ordering.</p>
      </DocsSection>

      <DocsSection id="typed-request-context" title="Typed request context">
        <p>Placeholder for Typed request context.</p>
      </DocsSection>

      <DocsSection id="static-files" title="Static files">
        <p>Placeholder for Static files.</p>
      </DocsSection>

      <DocsSection
        id="compression-logging-method-override"
        title="Compression, logging, method override"
      >
        <p>Placeholder for Compression, logging, method override.</p>
      </DocsSection>

      <DocsSection id="cors-cop-and-csrf" title="CORS, COP, and CSRF">
        <p>Placeholder for CORS, COP, and CSRF.</p>
      </DocsSection>

      <DocsSection id="custom-middleware" title="Custom middleware">
        <p>Placeholder for Custom middleware.</p>
      </DocsSection>
    </DocsChapter>
  )
}
