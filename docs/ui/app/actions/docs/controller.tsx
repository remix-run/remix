import { createController } from 'remix/router'
import { pages } from '../../data/docs.ts'
import { highlightSource } from '../../data/examples.tsx'
import { routes } from '../../routes.ts'
import { UiDocument } from '../../ui/document.tsx'
import { GettingStarted } from './getting-started.tsx'

export default createController(routes.docs, {
  actions: {
    async index({ render }) {
      let previews = pages
        .filter((page) => page.preview)
        .map((page) => ({ page, example: page.preview }))
      return render(
        <UiDocument
          title="Remix UI"
          description="Unstyled UI primitives and animation utilities for Remix."
          pages={pages}
        >
          <GettingStarted
            previews={previews}
            installHtml={await highlightSource('npm i remix @remix-run/ui', 'sh')}
            configHtml={await highlightSource(
              JSON.stringify(
                { compilerOptions: { jsx: 'react-jsx', jsxImportSource: 'remix/component' } },
                null,
                2,
              ),
              'json',
            )}
          />
        </UiDocument>,
      )
    },
    page({ params, render }) {
      let page = pages.find(
        (page) => page.category === params.category && page.slug === params.slug,
      )
      if (!page) {
        return render(
          <UiDocument
            title="Page not found"
            description="This UI page could not be found."
            pages={pages}
          >
            <h1>Page not found</h1>
            <p>
              <a href={routes.docs.index.href()}>Get started with Remix UI</a>
            </p>
          </UiDocument>,
          { status: 404 },
        )
      }
      let Page = page.Component
      return render(<Page pages={pages} />)
    },
  },
})
