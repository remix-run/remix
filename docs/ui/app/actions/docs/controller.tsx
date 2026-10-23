import { createController } from 'remix/router'
import { pages } from '../../data/pages.ts'
import GettingStarted from '../../pages/getting-started.tsx'
import { routes } from '../../routes.ts'
import { UiDocument } from '../../ui/document.tsx'

export default createController(routes.docs, {
  actions: {
    index({ render }) {
      return render(<GettingStarted />)
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
