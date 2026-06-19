import type { Handle } from 'remix/ui'

import { routes } from '../../../routes.ts'
import type { AppContext } from '../../../middleware/render.ts'
import type { DocsPageProps } from '../shared.tsx'
import { DocsChapter, DocsSection, docsResponseInit } from '../shared.tsx'

export async function startHereHandler({ render, request }: AppContext) {
  return render(<StartHerePage requestUrl={request.url} />, docsResponseInit)
}

function StartHerePage(handle: Handle<DocsPageProps>) {
  return () => (
    <DocsChapter
      requestUrl={handle.props.requestUrl}
      chapter="Chapter 1"
      title="Start Here"
      description="A high-level introduction to Remix and the mental model behind a Remix application."
      next={{
        href: routes.docs.coreAppStructure.href(),
        title: 'Core App Structure',
      }}
    >
      <DocsSection id="what-is-remix" title="What is Remix?">
        <p>Placeholder for What is Remix?.</p>
      </DocsSection>

      <DocsSection
        id="quickstart-create-and-run-a-remix-app"
        title="Quickstart: create and run a Remix app"
      >
        <p>Placeholder for Quickstart: create and run a Remix app.</p>
      </DocsSection>

      <DocsSection
        id="project-tour-server-ts-app-routes-ts-app-router-ts-controllers-ui-assets"
        title="Project tour: server.ts, app/routes.ts, app/router.ts, controllers, UI, assets"
      >
        <p>
          Placeholder for Project tour: server.ts, app/routes.ts, app/router.ts, controllers, UI,
          assets.
        </p>
      </DocsSection>

      <DocsSection
        id="the-core-model-request-middleware-router-controller-response"
        title="The core model: Request, middleware, router, controller, Response"
      >
        <p>Placeholder for The core model: Request, middleware, router, controller, Response.</p>
      </DocsSection>

      <DocsSection id="build-your-first-page" title="Build your first page">
        <p>Placeholder for Build your first page.</p>
      </DocsSection>

      <DocsSection id="build-your-first-form-action" title="Build your first form action">
        <p>Placeholder for Build your first form action.</p>
      </DocsSection>

      <DocsSection id="add-your-first-hydrated-component" title="Add your first hydrated component">
        <p>Placeholder for Add your first hydrated component.</p>
      </DocsSection>
    </DocsChapter>
  )
}
