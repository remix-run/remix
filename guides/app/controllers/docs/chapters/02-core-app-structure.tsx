import type { Handle } from 'remix/ui'

import { routes } from '../../../routes.ts'
import type { AppContext } from '../../../middleware/render.ts'
import type { DocsPageProps } from '../shared.tsx'
import { DocsChapter, DocsSection, docsResponseInit } from '../shared.tsx'

export async function coreAppStructureHandler({ render, request }: AppContext) {
  return render(<CoreAppStructurePage requestUrl={request.url} />, docsResponseInit)
}

function CoreAppStructurePage(handle: Handle<DocsPageProps>) {
  return () => (
    <DocsChapter
      requestUrl={handle.props.requestUrl}
      chapter="Chapter 2"
      title="Core App Structure"
      description="The files, ownership boundaries, and route conventions that shape a Remix app."
      previous={{ href: routes.docs.startHere.href(), title: 'Start Here' }}
      next={{ href: routes.docs.serverRuntime.href(), title: 'Server Runtime' }}
    >
      <DocsSection id="routes-as-the-url-contract" title="Routes as the URL contract">
        <p>Placeholder for Routes as the URL contract.</p>
      </DocsSection>

      <DocsSection
        id="route-builders-route-get-post-put-del-form-resources"
        title="Route builders: route, get, post, put, del, form, resources"
      >
        <p>Placeholder for Route builders: route, get, post, put, del, form, resources.</p>
      </DocsSection>

      <DocsSection id="controllers-and-actions" title="Controllers and actions">
        <p>Placeholder for Controllers and actions.</p>
      </DocsSection>

      <DocsSection id="nested-route-maps-and-ownership" title="Nested route maps and ownership">
        <p>Placeholder for Nested route maps and ownership.</p>
      </DocsSection>

      <DocsSection
        id="responses-redirects-headers-and-errors"
        title="Responses, redirects, headers, and errors"
      >
        <p>Placeholder for Responses, redirects, headers, and errors.</p>
      </DocsSection>

      <DocsSection id="app-organization-patterns" title="App organization patterns">
        <p>Placeholder for App organization patterns.</p>
      </DocsSection>
    </DocsChapter>
  )
}
