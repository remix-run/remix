import { clientEntry } from 'remix/ui'
import type { Controller } from 'remix/fetch-router'

import { render } from '../../config/render.tsx'
import type { routes } from '../../config/routes.ts'
import { findExample, loadExampleModule, readExampleSource } from './index.tsx'
import { ExampleContent, ExampleDocument } from './view.tsx'

type ExampleActions = Controller<typeof routes.examples>['actions']

let examplesController = {
  actions: {
    async content(context) {
      let example = findExample(context.params.slug)
      if (!example) {
        return notFound()
      }

      let ExampleComponent = clientEntry(
        `${example.assetHref}#default`,
        await loadExampleModule(example),
      )

      return render(
        context,
        <ExampleContent
          ExampleComponent={ExampleComponent}
          code={readExampleSource(example)}
          description={context.url.searchParams.get('description') ?? undefined}
          example={example}
          standalone={context.url.searchParams.get('standalone') === '1'}
          title={context.url.searchParams.get('title') ?? undefined}
        />,
        {
          headers: {
            'Cache-Control': 'no-store',
          },
        },
      )
    },

    show(context) {
      let example = findExample(context.params.slug)
      if (!example) {
        return notFound()
      }

      return render(
        context,
        <ExampleDocument example={example} pad={context.url.searchParams.has('pad')} />,
        {
          headers: {
            'Cache-Control': 'no-store',
          },
        },
      )
    },
  } satisfies ExampleActions,
} satisfies Controller<typeof routes.examples>

export default examplesController

function notFound() {
  return new Response('Example not found', {
    status: 404,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
