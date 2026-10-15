import { highlightSource } from '../data/examples.tsx'
import { pages } from '../data/pages.ts'
import { routes } from '../routes.ts'
import { UiDocument } from '../ui/document.tsx'
import { CodeBlock, readPageHeadings, Section } from './page.tsx'

const previews = pages.flatMap((page) =>
  page.preview ? [{ page, Preview: page.preview.Preview }] : [],
)

const installCode = await highlightSource('npm i remix @remix-run/ui', 'sh')
const configCode = await highlightSource(
  `
  {
    "compilerOptions": {
      "jsx": "react-jsx",
      "jsxImportSource": "remix/component"
    }
  }
`,
  'json',
)

export default function GettingStarted() {
  return () => {
    let content = (
      <>
        <header class="ui-page-header ui-landing-header">
          <p class="ui-eyebrow">Remix UI</p>
          <h1 class="rmx-page-title">
            Your interface.
            <br />
            Your styles.
          </h1>
          <p class="ui-description">
            Accessible UI behaviors and animation utilities for Remix. Bring your own markup and
            styles.
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
            <code>@remix-run/ui</code> is versioned independently from Remix. APIs may change
            between releases. Pin the version you use and review release notes before upgrading.
          </p>
        </aside>
        <Section id="installation" title="Installation">
          <p>Install Remix and the separate UI package.</p>
          <CodeBlock html={installCode} />
          <p>
            UI is currently available through <code>@remix-run/ui/*</code> imports. It is not yet
            included in the <code>remix</code> package.
          </p>
        </Section>
        <Section id="using-ui" title="Using the library">
          <p>
            Add interaction and accessibility behavior to your own elements. Apply styles with the{' '}
            <code>css()</code> mixin, and compose styles and behaviors with the <code>mix</code>{' '}
            prop.
          </p>
          <p>
            Remix UI is designed for the Remix component runtime. In a TypeScript project, configure
            JSX in <code>tsconfig.json</code>.
          </p>
          <CodeBlock html={configCode} />
          <p>
            Render your UI as Remix components and hydrate it with <code>clientEntry</code> and{' '}
            <code>run</code> for browser interaction. Follow the{' '}
            <a href="https://guides.remix.run/rendering-ui/">rendering UI guide</a> and{' '}
            <a href="https://guides.remix.run/interactivity/">interactivity guide</a> for
            application setup.
          </p>
          <p>
            The animation utilities also work with CSS transitions and the browser's Web Animations
            API.
          </p>
        </Section>
        <Section id="explore" title="Explore the library">
          <p>
            Explore behaviors for accordions, menus, tabs and other controls, or browse the
            animation utilities.
          </p>
          <div class="ui-preview-grid">
            {previews.map(({ page, Preview }) => (
              <section key={page.slug} class="ui-preview-card">
                <div class="ui-preview-card-demo" data-pagefind-ignore aria-hidden="true" inert>
                  <Preview />
                </div>
                <div class="ui-preview-card-content">
                  <p class="ui-eyebrow">
                    {page.category === 'behaviors' ? 'Behaviors' : 'Animation'}
                  </p>
                  <h3>
                    <a href={routes.docs.page.href({ category: page.category, slug: page.slug })}>
                      {page.title} <span aria-hidden="true">→</span>
                    </a>
                  </h3>
                  <p>{page.description}</p>
                </div>
              </section>
            ))}
          </div>
        </Section>
      </>
    )
    return (
      <UiDocument
        title="Remix UI"
        description="Accessible UI behaviors and animation utilities for Remix."
        pages={pages}
        headings={readPageHeadings(content)}
      >
        {content}
      </UiDocument>
    )
  }
}
