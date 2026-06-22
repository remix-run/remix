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
        <p>
          Remix is a full-stack TypeScript web framework, complete with a server, router, data
          layer, UI components, testing, and much more.
        </p>
        <p>
          Remix is a collection of single-purpose packages that each handle a specific part of your
          application, all designed to work in isolation just as effectively as they do together.
          The <code>remix</code> package is the out-of-the-box combination of all those individual
          packages, ready for you to build anything.
        </p>
        <p>
          Because Remix is so modular, it is also highly flexible. Don't want a server? You can use
          our expressive and composable UI library to create a Single-Page App. Just want to create
          some type-safe API endpoints? Remix is perfect for that, too. Want Server-Side Rendering,
          Server-Sent Events, or Cache-Control? Remix gives you the tools to build whatever website
          you want.
        </p>
        <p>
          Remix is designed with these 6 principles in mind. While they are not necessary to
          memorize to be effective with Remix, knowing our design principles will help you
          understand the heart of what makes Remix special. You'll see the implications of these
          principles in every package, API, and concept.
        </p>
        <ol>
          <li>
            <b>Agent-First Development.</b> Remix is built for the modern AI era. Our
            standard-aligned APIs and clean architecture make it incredibly easy for AI assistants
            (like Copilot or Claude) to understand and write your code. Additionally, Remix provides
            the primitives you need to integrate AI models directly into your product.
          </li>
          <li>
            <b>Build on Web APIs.</b> Rather than inventing custom, framework-specific abstractions,
            Remix uses standard Web APIs like <code>Request</code>, <code>Response</code>, and{' '}
            <code>URL</code> across the entire stack. This eliminates context switching, reduces
            what you have to learn, and ensures your skills remain transferable to any modern web
            platform.
          </li>
          <li>
            <b>Religiously Runtime.</b> Remix values runtime predictability over compiler magic. By
            designing for the runtime instead of relying on complex static analysis or
            code-generation, Remix keeps your code predictable, easy to test, and straightforward to
            debug. What you write is exactly what executes.
          </li>
          <li>
            <b>Avoid Dependencies.</b> To protect you from dependency bloat, breaking third-party
            roadmaps, and security vulnerabilities, Remix packages are built with a goal of zero
            external dependencies. You get a lightweight, stable, and highly secure foundation that
            is completely under your control.
          </li>
          <li>
            <b>Demand Composition.</b> Remix gives you ultimate architectural freedom by providing
            single-purpose, composable modules. You can adopt only what you need—whether that's just
            the expressive UI library, type-safe API routing, or the complete full-stack
            framework—making it easy to adapt your app as it grows.
          </li>
          <li>
            <b>Distribute Cohesively.</b> While highly modular under the hood, Remix is distributed
            as a single <code>remix</code> package with unified documentation. You get a
            frictionless, out-of-the-box experience from day one without the complexity of managing
            a fractured ecosystem of packages.
          </li>
        </ol>
        <p>
          This guide will show you how to get started with a basic, full-stack Remix application,
          complete with type-safe routes, server-side rendering, and hydrated client components. We
          have a number of other guides for more advanced concepts and deep dives into all the
          topics covered here.
        </p>
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
