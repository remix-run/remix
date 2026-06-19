import type { Handle } from 'remix/ui'

import { routes } from '../../../routes.ts'
import type { AppContext } from '../../../middleware/render.ts'
import type { DocsPageProps } from '../shared.tsx'
import { DocsChapter, DocsSection, docsResponseInit } from '../shared.tsx'

export async function cliAndToolingHandler({ render, request }: AppContext) {
  return render(<CliAndToolingPage requestUrl={request.url} />, docsResponseInit)
}

function CliAndToolingPage(handle: Handle<DocsPageProps>) {
  return () => (
    <DocsChapter
      requestUrl={handle.props.requestUrl}
      chapter="Chapter 12"
      title="CLI and Tooling"
      description="The Remix command-line workflow for creating, inspecting, testing, and checking projects."
      previous={{ href: routes.docs.testing.href(), title: 'Testing' }}
      next={{ href: routes.docs.production.href(), title: 'Production' }}
    >
      <DocsSection id="remix-new" title="remix new">
        <p>Placeholder for remix new.</p>
      </DocsSection>

      <DocsSection id="remix-routes" title="remix routes">
        <p>Placeholder for remix routes.</p>
      </DocsSection>

      <DocsSection id="remix-doctor" title="remix doctor">
        <p>Placeholder for remix doctor.</p>
      </DocsSection>

      <DocsSection id="remix-doctor-fix" title="remix doctor --fix">
        <p>Placeholder for remix doctor --fix.</p>
      </DocsSection>

      <DocsSection id="remix-test" title="remix test">
        <p>Placeholder for remix test.</p>
      </DocsSection>

      <DocsSection id="remix-version" title="remix version">
        <p>Placeholder for remix version.</p>
      </DocsSection>

      <DocsSection id="shell-completion" title="Shell completion">
        <p>Placeholder for Shell completion.</p>
      </DocsSection>

      <DocsSection id="typescript-and-jsx-setup" title="TypeScript and JSX setup">
        <p>Placeholder for TypeScript and JSX setup.</p>
      </DocsSection>

      <DocsSection id="using-remix-node-tsx" title="Using remix/node-tsx">
        <p>Placeholder for Using remix/node-tsx.</p>
      </DocsSection>
    </DocsChapter>
  )
}
