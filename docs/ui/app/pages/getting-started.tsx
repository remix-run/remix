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
const stackingCode = await highlightSource(
  `
  :root {
    --rmx-layer-base: 100;
  }
`,
  'css',
)
const notificationStackingCode = await highlightSource(
  `
  .Notifications {
    z-index: calc(var(--rmx-layer-base, 0) + 1000);
  }
`,
  'css',
)
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
        <aside class="docs-notice" data-notice="warning" aria-label="Stability">
          <StabilityIcon />
          <p>
            <code>@remix-run/ui</code> is currently unstable and versioned in the v0.x range
            independently from Remix. APIs may change between minor releases, and experimental APIs
            may change in patch releases. Pin the version you use and review release notes before
            upgrading.
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
        <Section id="stacking" title="Stacking and overlays">
          <p>
            Remix UI automatically assigns z-index values to <a href="/patterns/dialog/">dialogs</a>
            , <a href="/patterns/popover/">popovers</a>, <a href="/patterns/menu/">menus</a>,{' '}
            <a href="/patterns/select/">selects</a> and <a href="/patterns/combobox/">comboboxes</a>
            . Backdrops sit below their dialogs, and nested popups appear above their parents. These
            patterns also coordinate dismissal so Escape closes the active child before its parent.
            Use the pattern's Portal component when ancestors would clip a surface or create a
            stacking context that constrains its z-index.
          </p>
          <p>
            Each surface's CSS <code>z-index</code> adds its position in the shared stack to{' '}
            <code>--rmx-layer-base</code>, which defaults to <code>0</code>. For example, if your
            app has a fixed header with <code>z-index: 100</code>, set the base to <code>100</code>{' '}
            on the document root so dialogs and their backdrops appear above it. This raises the
            whole stack while preserving the order of dialogs and nested popups. Setting it once on{' '}
            <code>:root</code> lets every surface inherit the same value, including content rendered
            through a portal.
          </p>
          <CodeBlock html={stackingCode} />
          <p>
            <a href="/patterns/toast/">Toast</a> leaves the notification region's z-index to your
            styles. Use the same base variable with a larger offset so changing the base moves both
            dialogs and notifications together. Here, <code>1000</code> reserves space above the
            dialog and popup layers. This offset is an application styling choice.
          </p>
          <CodeBlock html={notificationStackingCode} />
          <p>
            <a href="/patterns/dialog/">Dialog</a> and <a href="/patterns/toast/">Toast</a> mixins
            coordinate focus and dismissal automatically. Assigning a higher z-index to an unrelated
            widget only changes its visual position. See{' '}
            <a href="/patterns/dialog/#toasts">Dialog with Toast</a> for a complete example.
          </p>
        </Section>
        <Section id="explore" title="Explore the library">
          <p>
            Explore patterns such as <a href="/patterns/accordion/">accordions</a>,{' '}
            <a href="/patterns/menu/">menus</a> and <a href="/patterns/tabs/">tabs</a>, or browse
            the animation utilities.
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
