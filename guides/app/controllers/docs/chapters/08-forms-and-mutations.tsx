import type { Handle } from 'remix/ui'

import { routes } from '../../../routes.ts'
import type { AppContext } from '../../../middleware/render.ts'
import type { DocsPageProps } from '../shared.tsx'
import { DocsChapter, DocsSection, docsResponseInit } from '../shared.tsx'

export async function formsAndMutationsHandler({ render, request }: AppContext) {
  return render(<FormsAndMutationsPage requestUrl={request.url} />, docsResponseInit)
}

function FormsAndMutationsPage(handle: Handle<DocsPageProps>) {
  return () => (
    <DocsChapter
      requestUrl={handle.props.requestUrl}
      chapter="Chapter 8"
      title="Forms and Mutations"
      description="How forms, actions, redirects, validation errors, and resource endpoints fit together."
      previous={{
        href: routes.docs.dataAndValidation.href(),
        title: 'Data and Validation',
      }}
      next={{
        href: routes.docs.authSessionsSecurity.href(),
        title: 'Auth, Sessions, and Security',
      }}
    >
      <DocsSection id="html-first-form-workflows" title="HTML-first form workflows">
        <p>Placeholder for HTML-first form workflows.</p>
      </DocsSection>

      <DocsSection id="form-routes" title="Form routes">
        <p>Placeholder for Form routes.</p>
      </DocsSection>

      <DocsSection id="post-redirect-get" title="POST-redirect-GET">
        <p>Placeholder for POST-redirect-GET.</p>
      </DocsSection>

      <DocsSection id="validation-failures" title="Validation failures">
        <p>Placeholder for Validation failures.</p>
      </DocsSection>

      <DocsSection id="optimistic-ui" title="Optimistic UI">
        <p>Placeholder for Optimistic UI.</p>
      </DocsSection>

      <DocsSection
        id="resource-routes-and-json-endpoints"
        title="Resource routes and JSON endpoints"
      >
        <p>Placeholder for Resource routes and JSON endpoints.</p>
      </DocsSection>

      <DocsSection
        id="method-override-for-put-patch-and-delete"
        title="Method override for PUT, PATCH, and DELETE"
      >
        <p>Placeholder for Method override for PUT, PATCH, and DELETE.</p>
      </DocsSection>
    </DocsChapter>
  )
}
