import { unsafeHTML } from 'remix/component'
import type { Handle } from 'remix/component'
import type { UiPage } from '../../data/pages.ts'
import type { LoadedExample } from '../../data/examples.tsx'
import { routes } from '../../routes.ts'

interface GettingStartedProps {
  previews: { page: UiPage; example?: LoadedExample }[]
  installHtml: string
  configHtml: string
}

export function GettingStarted(handle: Handle<GettingStartedProps>) {
  return () => (
    <>
      <header class="ui-page-header ui-landing-header">
        <p class="ui-eyebrow">Remix UI</p>
        <h1 class="rmx-page-title">
          Your interface.
          <br />
          Your styles.
        </h1>
        <p class="ui-description">
          Unstyled UI primitives and animation utilities for Remix. Build with accessible behavior,
          flexible markup and motion you can make your own.
        </p>
        <div class="ui-landing-actions">
          <a class="ui-primary-link" href="#installation">
            Get started
          </a>
          <a href="#explore">
            Explore the examples <span aria-hidden="true">↓</span>
          </a>
        </div>
      </header>
      <aside class="ui-notice" aria-label="Stability">
        <strong>Currently unstable</strong>
        <p>
          <code>@remix-run/ui</code> is versioned independently from Remix. APIs may change between
          releases. Pin the version you use and review release notes before upgrading.
        </p>
      </aside>
      <section id="installation" class="ui-doc-section">
        <h2>Installation</h2>
        <p>Install Remix and the separate UI package.</p>
        <div data-code-block innerHTML={unsafeHTML(handle.props.installHtml)} />
        <p>
          UI is currently available through <code>@remix-run/ui/*</code> imports. It is not yet
          included in the <code>remix</code> package.
        </p>
      </section>
      <section id="using-ui" class="ui-doc-section">
        <h2>Using the library</h2>
        <p>
          Primitives provide interaction and accessibility behavior. You supply the elements and
          styles with the <code>css()</code> mixin, and compose styling and behavior with the{' '}
          <code>mix</code> prop.
        </p>
        <p>
          Remix UI is designed for the Remix component runtime. In a TypeScript project, configure
          JSX in <code>tsconfig.json</code>.
        </p>
        <div data-code-block innerHTML={unsafeHTML(handle.props.configHtml)} />
        <p>
          Render your UI as Remix components and hydrate it with <code>clientEntry</code> and{' '}
          <code>run</code> for browser interaction. Follow the{' '}
          <a href="https://guides.remix.run/rendering-ui/">rendering UI guide</a> and{' '}
          <a href="https://guides.remix.run/interactivity/">interactivity guide</a> for application
          setup.
        </p>
        <p>
          The animation utilities also work with CSS transitions and the browser's Web Animations
          API.
        </p>
      </section>
      <section id="explore" class="ui-doc-section">
        <h2>Explore the library</h2>
        <p>
          Browse the primitives for common interaction patterns or explore the animation utilities.
        </p>
        <div class="ui-preview-grid">
          {handle.props.previews.map(({ page, example }) => {
            let Preview = example?.Preview
            return (
              <section key={page.slug} class="ui-preview-card">
                <div class="ui-preview-card-demo" data-pagefind-ignore aria-hidden="true" inert>
                  {Preview ? <Preview /> : null}
                </div>
                <div class="ui-preview-card-content">
                  <p class="ui-eyebrow">
                    {page.category === 'primitives' ? 'Primitives' : 'Animation'}
                  </p>
                  <h3>
                    <a href={routes.docs.page.href({ category: page.category, slug: page.slug })}>
                      {page.title} <span aria-hidden="true">→</span>
                    </a>
                  </h3>
                  <p>{page.description}</p>
                </div>
              </section>
            )
          })}
        </div>
      </section>
    </>
  )
}
