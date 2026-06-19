import type { Handle, RemixNode } from 'remix/ui'

import { routes } from '../../routes.ts'
import type { AppContext } from '../../middleware/render.ts'
import type { DocsPageProps } from './shared.tsx'
import { DocsDocument, docsResponseInit } from './shared.tsx'

export async function docsIndexHandler({ render, request }: AppContext) {
  return render(<DocsIndexPage requestUrl={request.url} />, docsResponseInit)
}

function DocsIndexPage(handle: Handle<DocsPageProps>) {
  return () => (
    <DocsDocument
      requestUrl={handle.props.requestUrl}
      title="Remix Docs"
      description="Guides, explanations, examples, and tutorials for learning Remix."
    >
      <div class="docs-index">
        <header class="docs-index__header">
          <p class="docs-chapter-eyebrow text-red-brand">Remix Docs</p>
          <h1 class="rmx-page-title">Learn Remix from the request up.</h1>
          <p class="rmx-page-body">
            These guide chapters introduce Remix at a high level, then progressively deepen into
            routing, rendering, interactivity, data, security, assets, testing, production,
            examples, and tutorials.
          </p>
          <p class="rmx-page-body">
            API reference lives separately at <a href="https://api.remix.run">api.remix.run</a>.
          </p>
        </header>

        <ol class="docs-index__cards">
          <ChapterCard
            chapter="Chapter 1"
            title="Start Here"
            href={routes.docs.startHere.href()}
            description="A high-level introduction to Remix and the mental model behind a Remix application."
          >
            <li>
              <a href={routes.docs.startHere.href() + '#what-is-remix'}>What is Remix?</a>
            </li>
            <li>
              <a href={routes.docs.startHere.href() + '#quickstart-create-and-run-a-remix-app'}>
                Quickstart: create and run a Remix app
              </a>
            </li>
            <li>
              <a
                href={
                  routes.docs.startHere.href() +
                  '#project-tour-server-ts-app-routes-ts-app-router-ts-controllers-ui-assets'
                }
              >
                Project tour: server.ts, app/routes.ts, app/router.ts, controllers, UI, assets
              </a>
            </li>
            <li>
              <a
                href={
                  routes.docs.startHere.href() +
                  '#the-core-model-request-middleware-router-controller-response'
                }
              >
                The core model: Request, middleware, router, controller, Response
              </a>
            </li>
            <li>
              <a href={routes.docs.startHere.href() + '#build-your-first-page'}>
                Build your first page
              </a>
            </li>
            <li>
              <a href={routes.docs.startHere.href() + '#build-your-first-form-action'}>
                Build your first form action
              </a>
            </li>
            <li>
              <a href={routes.docs.startHere.href() + '#add-your-first-hydrated-component'}>
                Add your first hydrated component
              </a>
            </li>
          </ChapterCard>
          <ChapterCard
            chapter="Chapter 2"
            title="Core App Structure"
            href={routes.docs.coreAppStructure.href()}
            description="The files, ownership boundaries, and route conventions that shape a Remix app."
          >
            <li>
              <a href={routes.docs.coreAppStructure.href() + '#routes-as-the-url-contract'}>
                Routes as the URL contract
              </a>
            </li>
            <li>
              <a
                href={
                  routes.docs.coreAppStructure.href() +
                  '#route-builders-route-get-post-put-del-form-resources'
                }
              >
                Route builders: route, get, post, put, del, form, resources
              </a>
            </li>
            <li>
              <a href={routes.docs.coreAppStructure.href() + '#controllers-and-actions'}>
                Controllers and actions
              </a>
            </li>
            <li>
              <a href={routes.docs.coreAppStructure.href() + '#nested-route-maps-and-ownership'}>
                Nested route maps and ownership
              </a>
            </li>
            <li>
              <a
                href={
                  routes.docs.coreAppStructure.href() + '#responses-redirects-headers-and-errors'
                }
              >
                Responses, redirects, headers, and errors
              </a>
            </li>
            <li>
              <a href={routes.docs.coreAppStructure.href() + '#app-organization-patterns'}>
                App organization patterns
              </a>
            </li>
          </ChapterCard>
          <ChapterCard
            chapter="Chapter 3"
            title="Server Runtime"
            href={routes.docs.serverRuntime.href()}
            description="How Remix bridges Web API request handling into a Node server and middleware stack."
          >
            <li>
              <a href={routes.docs.serverRuntime.href() + '#the-node-server-entry'}>
                The Node server entry
              </a>
            </li>
            <li>
              <a href={routes.docs.serverRuntime.href() + '#createrequestlistener'}>
                createRequestListener
              </a>
            </li>
            <li>
              <a href={routes.docs.serverRuntime.href() + '#middleware-ordering'}>
                Middleware ordering
              </a>
            </li>
            <li>
              <a href={routes.docs.serverRuntime.href() + '#typed-request-context'}>
                Typed request context
              </a>
            </li>
            <li>
              <a href={routes.docs.serverRuntime.href() + '#static-files'}>Static files</a>
            </li>
            <li>
              <a href={routes.docs.serverRuntime.href() + '#compression-logging-method-override'}>
                Compression, logging, method override
              </a>
            </li>
            <li>
              <a href={routes.docs.serverRuntime.href() + '#cors-cop-and-csrf'}>
                CORS, COP, and CSRF
              </a>
            </li>
            <li>
              <a href={routes.docs.serverRuntime.href() + '#custom-middleware'}>
                Custom middleware
              </a>
            </li>
          </ChapterCard>
          <ChapterCard
            chapter="Chapter 4"
            title="Rendering UI"
            href={routes.docs.renderingUi.href()}
            description="How Remix components render on the server, collect styles, and form the document shell."
          >
            <li>
              <a href={routes.docs.renderingUi.href() + '#the-remix-component-model'}>
                The Remix component model
              </a>
            </li>
            <li>
              <a href={routes.docs.renderingUi.href() + '#handle-props-setup-render-and-updates'}>
                Handle, props, setup, render, and updates
              </a>
            </li>
            <li>
              <a
                href={
                  routes.docs.renderingUi.href() +
                  '#server-rendering-with-rendertostream-and-rendertostring'
                }
              >
                Server rendering with renderToStream and renderToString
              </a>
            </li>
            <li>
              <a href={routes.docs.renderingUi.href() + '#document-shells-and-head-content'}>
                Document shells and head content
              </a>
            </li>
            <li>
              <a href={routes.docs.renderingUi.href() + '#styling-with-css'}>Styling with css</a>
            </li>
            <li>
              <a href={routes.docs.renderingUi.href() + '#theme-tokens-and-createtheme'}>
                Theme tokens and createTheme
              </a>
            </li>
            <li>
              <a
                href={
                  routes.docs.renderingUi.href() +
                  '#first-party-ui-components-buttons-menus-popovers-listboxes-selects-comboboxes'
                }
              >
                First-party UI components: buttons, menus, popovers, listboxes, selects, comboboxes
              </a>
            </li>
          </ChapterCard>
          <ChapterCard
            chapter="Chapter 5"
            title="Interactivity"
            href={routes.docs.interactivity.href()}
            description="How browser behavior layers onto server-rendered Remix UI without replacing the server path."
          >
            <li>
              <a href={routes.docs.interactivity.href() + '#progressive-enhancement'}>
                Progressive enhancement
              </a>
            </li>
            <li>
              <a href={routes.docs.interactivity.href() + '#cliententry'}>clientEntry</a>
            </li>
            <li>
              <a href={routes.docs.interactivity.href() + '#browser-entry-with-run'}>
                Browser entry with run
              </a>
            </li>
            <li>
              <a href={routes.docs.interactivity.href() + '#events-with-on'}>Events with on</a>
            </li>
            <li>
              <a href={routes.docs.interactivity.href() + '#refs-attrs-and-dom-lifecycle'}>
                Refs, attrs, and DOM lifecycle
              </a>
            </li>
            <li>
              <a href={routes.docs.interactivity.href() + '#the-mix-prop'}>The mix prop</a>
            </li>
            <li>
              <a href={routes.docs.interactivity.href() + '#built-in-mixins'}>Built-in mixins</a>
            </li>
            <li>
              <a href={routes.docs.interactivity.href() + '#creating-custom-mixins'}>
                Creating custom mixins
              </a>
            </li>
            <li>
              <a href={routes.docs.interactivity.href() + '#client-navigation'}>
                Client navigation
              </a>
            </li>
            <li>
              <a href={routes.docs.interactivity.href() + '#frames-and-partial-server-rendered-ui'}>
                Frames and partial server-rendered UI
              </a>
            </li>
            <li>
              <a
                href={
                  routes.docs.interactivity.href() +
                  '#coordinating-forms-fetches-frame-reloads-and-navigation'
                }
              >
                Coordinating forms, fetches, frame reloads, and navigation
              </a>
            </li>
          </ChapterCard>
          <ChapterCard
            chapter="Chapter 6"
            title="Animation"
            href={routes.docs.animation.href()}
            description="The CSS-first animation model and Remix UI helpers for motion that respects rendering state."
          >
            <li>
              <a href={routes.docs.animation.href() + '#css-first-visual-states'}>
                CSS-first visual states
              </a>
            </li>
            <li>
              <a href={routes.docs.animation.href() + '#entrance-and-exit-animations'}>
                Entrance and exit animations
              </a>
            </li>
            <li>
              <a href={routes.docs.animation.href() + '#layout-animations'}>Layout animations</a>
            </li>
            <li>
              <a href={routes.docs.animation.href() + '#springs-tweens-and-easing'}>
                Springs, tweens, and easing
              </a>
            </li>
            <li>
              <a href={routes.docs.animation.href() + '#interruptible-interactions'}>
                Interruptible interactions
              </a>
            </li>
            <li>
              <a href={routes.docs.animation.href() + '#reduced-motion-behavior'}>
                Reduced-motion behavior
              </a>
            </li>
          </ChapterCard>
          <ChapterCard
            chapter="Chapter 7"
            title="Data and Validation"
            href={routes.docs.dataAndValidation.href()}
            description="How Remix validates trust boundaries and carries typed values into persistence."
          >
            <li>
              <a href={routes.docs.dataAndValidation.href() + '#validating-trust-boundaries'}>
                Validating trust boundaries
              </a>
            </li>
            <li>
              <a href={routes.docs.dataAndValidation.href() + '#remix-data-schema'}>
                remix/data-schema
              </a>
            </li>
            <li>
              <a
                href={
                  routes.docs.dataAndValidation.href() +
                  '#form-parsing-with-remix-data-schema-form-data'
                }
              >
                Form parsing with remix/data-schema/form-data
              </a>
            </li>
            <li>
              <a href={routes.docs.dataAndValidation.href() + '#coercion-and-checks'}>
                Coercion and checks
              </a>
            </li>
            <li>
              <a href={routes.docs.dataAndValidation.href() + '#tables-with-remix-data-table'}>
                Tables with remix/data-table
              </a>
            </li>
            <li>
              <a href={routes.docs.dataAndValidation.href() + '#queries-and-crud-helpers'}>
                Queries and CRUD helpers
              </a>
            </li>
            <li>
              <a href={routes.docs.dataAndValidation.href() + '#transactions'}>Transactions</a>
            </li>
            <li>
              <a href={routes.docs.dataAndValidation.href() + '#migrations'}>Migrations</a>
            </li>
            <li>
              <a
                href={routes.docs.dataAndValidation.href() + '#sqlite-postgres-and-mysql-adapters'}
              >
                SQLite, Postgres, and MySQL adapters
              </a>
            </li>
            <li>
              <a href={routes.docs.dataAndValidation.href() + '#request-scoped-database-access'}>
                Request-scoped database access
              </a>
            </li>
          </ChapterCard>
          <ChapterCard
            chapter="Chapter 8"
            title="Forms and Mutations"
            href={routes.docs.formsAndMutations.href()}
            description="How forms, actions, redirects, validation errors, and resource endpoints fit together."
          >
            <li>
              <a href={routes.docs.formsAndMutations.href() + '#html-first-form-workflows'}>
                HTML-first form workflows
              </a>
            </li>
            <li>
              <a href={routes.docs.formsAndMutations.href() + '#form-routes'}>Form routes</a>
            </li>
            <li>
              <a href={routes.docs.formsAndMutations.href() + '#post-redirect-get'}>
                POST-redirect-GET
              </a>
            </li>
            <li>
              <a href={routes.docs.formsAndMutations.href() + '#validation-failures'}>
                Validation failures
              </a>
            </li>
            <li>
              <a href={routes.docs.formsAndMutations.href() + '#optimistic-ui'}>Optimistic UI</a>
            </li>
            <li>
              <a
                href={routes.docs.formsAndMutations.href() + '#resource-routes-and-json-endpoints'}
              >
                Resource routes and JSON endpoints
              </a>
            </li>
            <li>
              <a
                href={
                  routes.docs.formsAndMutations.href() + '#method-override-for-put-patch-and-delete'
                }
              >
                Method override for PUT, PATCH, and DELETE
              </a>
            </li>
          </ChapterCard>
          <ChapterCard
            chapter="Chapter 9"
            title="Auth, Sessions, and Security"
            href={routes.docs.authSessionsSecurity.href()}
            description="The Remix model for per-browser state, identity, authorization, and browser request safety."
          >
            <li>
              <a href={routes.docs.authSessionsSecurity.href() + '#cookies-vs-sessions'}>
                Cookies vs sessions
              </a>
            </li>
            <li>
              <a href={routes.docs.authSessionsSecurity.href() + '#session-storage-strategies'}>
                Session storage strategies
              </a>
            </li>
            <li>
              <a href={routes.docs.authSessionsSecurity.href() + '#login-and-logout'}>
                Login and logout
              </a>
            </li>
            <li>
              <a href={routes.docs.authSessionsSecurity.href() + '#flash-messages'}>
                Flash messages
              </a>
            </li>
            <li>
              <a href={routes.docs.authSessionsSecurity.href() + '#regenerating-session-ids'}>
                Regenerating session IDs
              </a>
            </li>
            <li>
              <a href={routes.docs.authSessionsSecurity.href() + '#credentials-auth'}>
                Credentials auth
              </a>
            </li>
            <li>
              <a href={routes.docs.authSessionsSecurity.href() + '#oauth-and-oidc-providers'}>
                OAuth and OIDC providers
              </a>
            </li>
            <li>
              <a
                href={
                  routes.docs.authSessionsSecurity.href() + '#route-protection-with-requireauth'
                }
              >
                Route protection with requireAuth
              </a>
            </li>
            <li>
              <a href={routes.docs.authSessionsSecurity.href() + '#authorization-checks'}>
                Authorization checks
              </a>
            </li>
            <li>
              <a href={routes.docs.authSessionsSecurity.href() + '#csrf-protection'}>
                CSRF protection
              </a>
            </li>
            <li>
              <a href={routes.docs.authSessionsSecurity.href() + '#cross-origin-protection'}>
                Cross-origin protection
              </a>
            </li>
          </ChapterCard>
          <ChapterCard
            chapter="Chapter 10"
            title="Files and Assets"
            href={routes.docs.filesAndAssets.href()}
            description="How Remix serves static files, browser modules, uploads, downloads, and source assets."
          >
            <li>
              <a href={routes.docs.filesAndAssets.href() + '#static-files-vs-source-served-assets'}>
                Static files vs source-served assets
              </a>
            </li>
            <li>
              <a href={routes.docs.filesAndAssets.href() + '#remix-s-unbundled-asset-server'}>
                Remix's unbundled asset server
              </a>
            </li>
            <li>
              <a
                href={
                  routes.docs.filesAndAssets.href() +
                  '#file-maps-allow-and-deny-rules-and-browser-only-modules'
                }
              >
                File maps, allow and deny rules, and browser-only modules
              </a>
            </li>
            <li>
              <a
                href={routes.docs.filesAndAssets.href() + '#client-entry-hrefs-and-module-preloads'}
              >
                Client entry hrefs and module preloads
              </a>
            </li>
            <li>
              <a
                href={
                  routes.docs.filesAndAssets.href() + '#fingerprinting-source-maps-minification'
                }
              >
                Fingerprinting, source maps, minification
              </a>
            </li>
            <li>
              <a href={routes.docs.filesAndAssets.href() + '#file-uploads'}>File uploads</a>
            </li>
            <li>
              <a href={routes.docs.filesAndAssets.href() + '#multipart-parsing'}>
                Multipart parsing
              </a>
            </li>
            <li>
              <a href={routes.docs.filesAndAssets.href() + '#file-storage-memory-filesystem-s3'}>
                File storage: memory, filesystem, S3
              </a>
            </li>
            <li>
              <a
                href={
                  routes.docs.filesAndAssets.href() +
                  '#file-downloads-lazy-files-mime-types-and-range-responses'
                }
              >
                File downloads, lazy files, MIME types, and range responses
              </a>
            </li>
          </ChapterCard>
          <ChapterCard
            chapter="Chapter 11"
            title="Testing"
            href={routes.docs.testing.href()}
            description="How to test Remix apps at the router, component, browser, middleware, and CI layers."
          >
            <li>
              <a href={routes.docs.testing.href() + '#testing-philosophy'}>Testing philosophy</a>
            </li>
            <li>
              <a href={routes.docs.testing.href() + '#router-tests-with-router-fetch'}>
                Router tests with router.fetch
              </a>
            </li>
            <li>
              <a href={routes.docs.testing.href() + '#component-tests-with-remix-ui-test'}>
                Component tests with remix/ui/test
              </a>
            </li>
            <li>
              <a href={routes.docs.testing.href() + '#browser-and-e2e-tests'}>
                Browser and E2E tests
              </a>
            </li>
            <li>
              <a href={routes.docs.testing.href() + '#session-and-database-test-isolation'}>
                Session and database test isolation
              </a>
            </li>
            <li>
              <a href={routes.docs.testing.href() + '#testing-middleware'}>Testing middleware</a>
            </li>
            <li>
              <a href={routes.docs.testing.href() + '#testing-uploads'}>Testing uploads</a>
            </li>
            <li>
              <a href={routes.docs.testing.href() + '#coverage-and-ci-patterns'}>
                Coverage and CI patterns
              </a>
            </li>
          </ChapterCard>
          <ChapterCard
            chapter="Chapter 12"
            title="CLI and Tooling"
            href={routes.docs.cliAndTooling.href()}
            description="The Remix command-line workflow for creating, inspecting, testing, and checking projects."
          >
            <li>
              <a href={routes.docs.cliAndTooling.href() + '#remix-new'}>remix new</a>
            </li>
            <li>
              <a href={routes.docs.cliAndTooling.href() + '#remix-routes'}>remix routes</a>
            </li>
            <li>
              <a href={routes.docs.cliAndTooling.href() + '#remix-doctor'}>remix doctor</a>
            </li>
            <li>
              <a href={routes.docs.cliAndTooling.href() + '#remix-doctor-fix'}>
                remix doctor --fix
              </a>
            </li>
            <li>
              <a href={routes.docs.cliAndTooling.href() + '#remix-test'}>remix test</a>
            </li>
            <li>
              <a href={routes.docs.cliAndTooling.href() + '#remix-version'}>remix version</a>
            </li>
            <li>
              <a href={routes.docs.cliAndTooling.href() + '#shell-completion'}>Shell completion</a>
            </li>
            <li>
              <a href={routes.docs.cliAndTooling.href() + '#typescript-and-jsx-setup'}>
                TypeScript and JSX setup
              </a>
            </li>
            <li>
              <a href={routes.docs.cliAndTooling.href() + '#using-remix-node-tsx'}>
                Using remix/node-tsx
              </a>
            </li>
          </ChapterCard>
          <ChapterCard
            chapter="Chapter 13"
            title="Production"
            href={routes.docs.production.href()}
            description="Operational concerns for running Remix applications outside the development loop."
          >
            <li>
              <a href={routes.docs.production.href() + '#environment-variables-and-secrets'}>
                Environment variables and secrets
              </a>
            </li>
            <li>
              <a href={routes.docs.production.href() + '#startup-and-shutdown'}>
                Startup and shutdown
              </a>
            </li>
            <li>
              <a href={routes.docs.production.href() + '#caching'}>Caching</a>
            </li>
            <li>
              <a href={routes.docs.production.href() + '#streaming-and-aborts'}>
                Streaming and aborts
              </a>
            </li>
            <li>
              <a href={routes.docs.production.href() + '#error-handling'}>Error handling</a>
            </li>
            <li>
              <a href={routes.docs.production.href() + '#deployment-checklist'}>
                Deployment checklist
              </a>
            </li>
            <li>
              <a href={routes.docs.production.href() + '#observability-hooks'}>
                Observability hooks
              </a>
            </li>
          </ChapterCard>
          <ChapterCard
            chapter="Chapter 14"
            title="Advanced Guides"
            href={routes.docs.advancedGuides.href()}
            description="Deeper patterns for extending Remix, integrating services, and building specialized systems."
          >
            <li>
              <a href={routes.docs.advancedGuides.href() + '#building-custom-ui-primitives'}>
                Building custom UI primitives
              </a>
            </li>
            <li>
              <a href={routes.docs.advancedGuides.href() + '#building-reusable-mixin-libraries'}>
                Building reusable mixin libraries
              </a>
            </li>
            <li>
              <a href={routes.docs.advancedGuides.href() + '#low-level-route-patterns'}>
                Low-level route patterns
              </a>
            </li>
            <li>
              <a href={routes.docs.advancedGuides.href() + '#fetch-proxying'}>Fetch proxying</a>
            </li>
            <li>
              <a href={routes.docs.advancedGuides.href() + '#server-sent-events'}>
                Server-sent events
              </a>
            </li>
            <li>
              <a
                href={
                  routes.docs.advancedGuides.href() + '#tar-parsing-and-package-browser-style-apps'
                }
              >
                Tar parsing and package-browser style apps
              </a>
            </li>
            <li>
              <a href={routes.docs.advancedGuides.href() + '#building-clis-with-remix-packages'}>
                Building CLIs with Remix packages
              </a>
            </li>
            <li>
              <a href={routes.docs.advancedGuides.href() + '#integrating-external-services'}>
                Integrating external services
              </a>
            </li>
          </ChapterCard>
          <ChapterCard
            chapter="Chapter 15"
            title="Example Apps"
            href={routes.docs.exampleApps.href()}
            description="Guided tours through complete Remix demos and the framework concepts each one demonstrates."
          >
            <li>
              <a href={routes.docs.exampleApps.href() + '#bookstore-full-stack-commerce-app'}>
                Bookstore: full-stack commerce app
              </a>
            </li>
            <li>
              <a href={routes.docs.exampleApps.href() + '#social-auth-credentials-plus-oauth-oidc'}>
                Social Auth: credentials plus OAuth/OIDC
              </a>
            </li>
            <li>
              <a href={routes.docs.exampleApps.href() + '#frames-partial-server-ui'}>
                Frames: partial server UI
              </a>
            </li>
            <li>
              <a href={routes.docs.exampleApps.href() + '#frame-navigation-app-shell-navigation'}>
                Frame Navigation: app-shell navigation
              </a>
            </li>
            <li>
              <a href={routes.docs.exampleApps.href() + '#assets-source-served-browser-modules'}>
                Assets: source-served browser modules
              </a>
            </li>
            <li>
              <a
                href={
                  routes.docs.exampleApps.href() +
                  '#timeboxer-auth-csrf-json-endpoints-calendar-export'
                }
              >
                Timeboxer: auth, CSRF, JSON endpoints, calendar export
              </a>
            </li>
            <li>
              <a
                href={
                  routes.docs.exampleApps.href() +
                  '#unpkg-clone-tar-parsing-file-responses-package-browsing'
                }
              >
                UNPKG clone: tar parsing, file responses, package browsing
              </a>
            </li>
            <li>
              <a href={routes.docs.exampleApps.href() + '#sse-streaming-server-events'}>
                SSE: streaming server events
              </a>
            </li>
          </ChapterCard>
          <ChapterCard
            chapter="Chapter 16"
            title="Tutorials"
            href={routes.docs.tutorials.href()}
            description="Complete walkthroughs that turn the guide chapters into working Remix applications."
          >
            <li>
              <a href={routes.docs.tutorials.href() + '#build-your-first-remix-app'}>
                Build your first Remix app
              </a>
            </li>
            <li>
              <a href={routes.docs.tutorials.href() + '#build-a-contact-form'}>
                Build a contact form
              </a>
            </li>
            <li>
              <a href={routes.docs.tutorials.href() + '#build-a-crud-resource'}>
                Build a CRUD resource
              </a>
            </li>
            <li>
              <a href={routes.docs.tutorials.href() + '#build-authenticated-routes'}>
                Build authenticated routes
              </a>
            </li>
            <li>
              <a href={routes.docs.tutorials.href() + '#build-a-file-upload-flow'}>
                Build a file upload flow
              </a>
            </li>
            <li>
              <a href={routes.docs.tutorials.href() + '#build-a-progressively-enhanced-cart'}>
                Build a progressively enhanced cart
              </a>
            </li>
            <li>
              <a href={routes.docs.tutorials.href() + '#build-a-frame-powered-dashboard'}>
                Build a frame-powered dashboard
              </a>
            </li>
            <li>
              <a href={routes.docs.tutorials.href() + '#build-a-data-backed-admin-area'}>
                Build a data-backed admin area
              </a>
            </li>
            <li>
              <a href={routes.docs.tutorials.href() + '#build-and-test-a-production-feature'}>
                Build and test a production feature
              </a>
            </li>
            <li>
              <a href={routes.docs.tutorials.href() + '#build-a-small-app-from-scratch'}>
                Build a small app from scratch
              </a>
            </li>
          </ChapterCard>
        </ol>
      </div>
    </DocsDocument>
  )
}

function ChapterCard(
  handle: Handle<{
    chapter: string
    title: string
    href: string
    description: string
    children: RemixNode
  }>,
) {
  return () => (
    <li class="chapter-card">
      <div class="chapter-card__eyebrow">{handle.props.chapter}</div>
      <h2 class="rmx-page-title rmx-page-title-xs chapter-card__title">
        <a href={handle.props.href}>{handle.props.title}</a>
      </h2>
      <p class="rmx-page-body rmx-page-body-sm chapter-card__description">
        {handle.props.description}
      </p>
      <ul class="chapter-card__links">{handle.props.children}</ul>
    </li>
  )
}
