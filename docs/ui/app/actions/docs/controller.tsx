import { createController } from 'remix/router'
import { loadDocs } from '../../data/docs.ts'
import { highlightSource, loadExample, loadSection } from '../../data/examples.tsx'
import { routes } from '../../routes.ts'
import { UiDocument } from '../../ui/document.tsx'
import { GettingStarted } from './getting-started.tsx'
import { FeaturePage } from './page.tsx'

export default createController(routes.docs, {
  actions: {
    async index({ render }) {
      let pages = await loadDocs()
      let previews = await Promise.all(
        pages
          .filter((page) => page.slug === 'accordion' || page.slug === 'spring')
          .map(async (page) => ({
            page,
            example: page.examples[0] ? await loadExample(page.examples[0]) : undefined,
          })),
      )
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
    async page({ params, render }) {
      let pages = await loadDocs()
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
      let [examples, sections] = await Promise.all([
        Promise.all(page.examples.map(loadExample)),
        Promise.all((page.sections ?? []).map(loadSection)),
      ])
      return render(
        <UiDocument
          title={page.title}
          description={page.description}
          pages={pages}
          currentPage={page}
        >
          <FeaturePage page={page} examples={examples} sections={sections} />
        </UiDocument>,
      )
    },
  },
})
