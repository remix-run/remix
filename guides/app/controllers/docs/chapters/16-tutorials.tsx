import type { Handle } from 'remix/ui'

import { routes } from '../../../routes.ts'
import type { AppContext } from '../../../middleware/render.ts'
import type { DocsPageProps } from '../shared.tsx'
import { DocsChapter, DocsSection, docsResponseInit } from '../shared.tsx'

export async function tutorialsHandler({ render, request }: AppContext) {
  return render(<TutorialsPage requestUrl={request.url} />, docsResponseInit)
}

function TutorialsPage(handle: Handle<DocsPageProps>) {
  return () => (
    <DocsChapter
      requestUrl={handle.props.requestUrl}
      chapter="Chapter 16"
      title="Tutorials"
      description="Complete walkthroughs that turn the guide chapters into working Remix applications."
      previous={{ href: routes.docs.exampleApps.href(), title: 'Example Apps' }}
    >
      <DocsSection id="build-your-first-remix-app" title="Build your first Remix app">
        <p>Placeholder for Build your first Remix app.</p>
      </DocsSection>

      <DocsSection id="build-a-contact-form" title="Build a contact form">
        <p>Placeholder for Build a contact form.</p>
      </DocsSection>

      <DocsSection id="build-a-crud-resource" title="Build a CRUD resource">
        <p>Placeholder for Build a CRUD resource.</p>
      </DocsSection>

      <DocsSection id="build-authenticated-routes" title="Build authenticated routes">
        <p>Placeholder for Build authenticated routes.</p>
      </DocsSection>

      <DocsSection id="build-a-file-upload-flow" title="Build a file upload flow">
        <p>Placeholder for Build a file upload flow.</p>
      </DocsSection>

      <DocsSection
        id="build-a-progressively-enhanced-cart"
        title="Build a progressively enhanced cart"
      >
        <p>Placeholder for Build a progressively enhanced cart.</p>
      </DocsSection>

      <DocsSection id="build-a-frame-powered-dashboard" title="Build a frame-powered dashboard">
        <p>Placeholder for Build a frame-powered dashboard.</p>
      </DocsSection>

      <DocsSection id="build-a-data-backed-admin-area" title="Build a data-backed admin area">
        <p>Placeholder for Build a data-backed admin area.</p>
      </DocsSection>

      <DocsSection
        id="build-and-test-a-production-feature"
        title="Build and test a production feature"
      >
        <p>Placeholder for Build and test a production feature.</p>
      </DocsSection>

      <DocsSection id="build-a-small-app-from-scratch" title="Build a small app from scratch">
        <p>Placeholder for Build a small app from scratch.</p>
      </DocsSection>
    </DocsChapter>
  )
}
