import { highlightSource } from '../data/examples.tsx'
import { pages } from '../data/pages.ts'
import { categories } from '../data/categories.ts'
import { routes } from '../routes.ts'
import { UiDocument } from '../ui/document.tsx'
import { CodeBlock, readPageHeadings, Section } from './page.tsx'

const previews = categories.flatMap((category) => {
  let page = pages.find((page) => page.category === category.id)
  return page ? [{ category, page, Preview: page.preview?.Preview }] : []
})

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
        <header class="docs-page-header">
          <h1 class="rmx-page-title">Unstyled, accessible UI patterns and animation for Remix</h1>
          <p class="docs-page-description">
            Compose accessible behavior directly onto your own elements with Remix's mixins feature,
            without the need for extra wrapper components. Keep semantic markup explicit and provide
            your own styles and motion.
          </p>
        </header>
        <aside class="ui-notice" aria-label="Stability">
          <StabilityIcon />
          <p>
            <code>@remix-run/ui</code> is currently unstable and versioned in the v0.x range
            independently from Remix. APIs may change between minor releases. Pin the version you
            use and review release notes before upgrading.
          </p>
        </aside>
        <Section id="installation" title="Installation">
          <p>
            Install Remix and <code>@remix-run/ui</code>.
          </p>
          <CodeBlock html={installCode} />
          <p>
            Remix UI is currently available through <code>@remix-run/ui/*</code> imports. It is not
            yet included in the <code>remix</code> package.
          </p>
        </Section>
        <Section id="using-ui" title="Using the library">
          <p>
            The <code>mix</code> prop applies behavior and styles to an element. Combine mixins in
            an array, use <code>css()</code> for styling, and wrap related elements in providers to
            share state.
          </p>
          <p>
            Remix UI is designed for the Remix component runtime. In a TypeScript project, configure
            JSX in <code>tsconfig.json</code>.
          </p>
          <CodeBlock html={configCode} />
          <p>
            Render your UI as Remix components and hydrate it with <code>clientEntry</code> and{' '}
            <code>run</code> for browser interaction. Follow the{' '}
            <a href="https://docs.remix.run/rendering-ui/">rendering UI guide</a> and{' '}
            <a href="https://docs.remix.run/interactivity/">interactivity guide</a> for application
            setup.
          </p>
          <p>
            The animation utilities also work with CSS transitions and the browser's Web Animations
            API.
          </p>
        </Section>
        <Section id="explore" title="Explore the library">
          <p>
            Explore patterns such as accordions, menus and tabs, or browse the animation utilities.
          </p>
          <div class="ui-preview-grid">
            {previews.map(({ category, page, Preview }) => (
              <section key={category.id} class="ui-preview-card">
                {Preview ? (
                  <div class="ui-preview-card-demo" data-pagefind-ignore aria-hidden="true" inert>
                    <Preview />
                  </div>
                ) : null}
                <div class="ui-preview-card-content">
                  <h3>
                    <a href={routes.docs.page.href({ category: page.category, slug: page.slug })}>
                      {category.title} <span aria-hidden="true">→</span>
                    </a>
                  </h3>
                  <p>{category.description}</p>
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
        description="Accessible UI patterns and animation utilities for Remix."
        pages={pages}
        headings={readPageHeadings(content)}
      >
        {content}
      </UiDocument>
    )
  }
}

function StabilityIcon() {
  return () => (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" />
      <path d="M12 7.5v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
    </svg>
  )
}
