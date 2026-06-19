import type { Handle } from 'remix/ui'

import { routes } from '../../../routes.ts'
import type { AppContext } from '../../../middleware/render.ts'
import type { DocsPageProps } from '../shared.tsx'
import { DocsChapter, DocsSection, docsResponseInit } from '../shared.tsx'

export async function exampleAppsHandler({ render, request }: AppContext) {
  return render(<ExampleAppsPage requestUrl={request.url} />, docsResponseInit)
}

function ExampleAppsPage(handle: Handle<DocsPageProps>) {
  return () => (
    <DocsChapter
      requestUrl={handle.props.requestUrl}
      chapter="Chapter 15"
      title="Example Apps"
      description="Guided tours through complete Remix demos and the framework concepts each one demonstrates."
      previous={{
        href: routes.docs.advancedGuides.href(),
        title: 'Advanced Guides',
      }}
      next={{ href: routes.docs.tutorials.href(), title: 'Tutorials' }}
    >
      <DocsSection
        id="bookstore-full-stack-commerce-app"
        title="Bookstore: full-stack commerce app"
      >
        <p>Placeholder for Bookstore: full-stack commerce app.</p>
      </DocsSection>

      <DocsSection
        id="social-auth-credentials-plus-oauth-oidc"
        title="Social Auth: credentials plus OAuth/OIDC"
      >
        <p>Placeholder for Social Auth: credentials plus OAuth/OIDC.</p>
      </DocsSection>

      <DocsSection id="frames-partial-server-ui" title="Frames: partial server UI">
        <p>Placeholder for Frames: partial server UI.</p>
      </DocsSection>

      <DocsSection
        id="frame-navigation-app-shell-navigation"
        title="Frame Navigation: app-shell navigation"
      >
        <p>Placeholder for Frame Navigation: app-shell navigation.</p>
      </DocsSection>

      <DocsSection
        id="assets-source-served-browser-modules"
        title="Assets: source-served browser modules"
      >
        <p>Placeholder for Assets: source-served browser modules.</p>
      </DocsSection>

      <DocsSection
        id="timeboxer-auth-csrf-json-endpoints-calendar-export"
        title="Timeboxer: auth, CSRF, JSON endpoints, calendar export"
      >
        <p>Placeholder for Timeboxer: auth, CSRF, JSON endpoints, calendar export.</p>
      </DocsSection>

      <DocsSection
        id="unpkg-clone-tar-parsing-file-responses-package-browsing"
        title="UNPKG clone: tar parsing, file responses, package browsing"
      >
        <p>Placeholder for UNPKG clone: tar parsing, file responses, package browsing.</p>
      </DocsSection>

      <DocsSection id="sse-streaming-server-events" title="SSE: streaming server events">
        <p>Placeholder for SSE: streaming server events.</p>
      </DocsSection>
    </DocsChapter>
  )
}
