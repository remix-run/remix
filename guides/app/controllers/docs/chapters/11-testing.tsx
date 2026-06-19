import type { Handle } from 'remix/ui'

import { routes } from '../../../routes.ts'
import type { AppContext } from '../../../middleware/render.ts'
import type { DocsPageProps } from '../shared.tsx'
import { DocsChapter, DocsSection, docsResponseInit } from '../shared.tsx'

export async function testingHandler({ render, request }: AppContext) {
  return render(<TestingPage requestUrl={request.url} />, docsResponseInit)
}

function TestingPage(handle: Handle<DocsPageProps>) {
  return () => (
    <DocsChapter
      requestUrl={handle.props.requestUrl}
      chapter="Chapter 11"
      title="Testing"
      description="How to test Remix apps at the router, component, browser, middleware, and CI layers."
      previous={{
        href: routes.docs.filesAndAssets.href(),
        title: 'Files and Assets',
      }}
      next={{
        href: routes.docs.cliAndTooling.href(),
        title: 'CLI and Tooling',
      }}
    >
      <DocsSection id="testing-philosophy" title="Testing philosophy">
        <p>Placeholder for Testing philosophy.</p>
      </DocsSection>

      <DocsSection id="router-tests-with-router-fetch" title="Router tests with router.fetch">
        <p>Placeholder for Router tests with router.fetch.</p>
      </DocsSection>

      <DocsSection
        id="component-tests-with-remix-ui-test"
        title="Component tests with remix/ui/test"
      >
        <p>Placeholder for Component tests with remix/ui/test.</p>
      </DocsSection>

      <DocsSection id="browser-and-e2e-tests" title="Browser and E2E tests">
        <p>Placeholder for Browser and E2E tests.</p>
      </DocsSection>

      <DocsSection
        id="session-and-database-test-isolation"
        title="Session and database test isolation"
      >
        <p>Placeholder for Session and database test isolation.</p>
      </DocsSection>

      <DocsSection id="testing-middleware" title="Testing middleware">
        <p>Placeholder for Testing middleware.</p>
      </DocsSection>

      <DocsSection id="testing-uploads" title="Testing uploads">
        <p>Placeholder for Testing uploads.</p>
      </DocsSection>

      <DocsSection id="coverage-and-ci-patterns" title="Coverage and CI patterns">
        <p>Placeholder for Coverage and CI patterns.</p>
      </DocsSection>
    </DocsChapter>
  )
}
