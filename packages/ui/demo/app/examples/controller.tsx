import type { Controller } from 'remix/fetch-router'

import { render } from '../../config/render.tsx'
import type { routes } from '../../config/routes.ts'
import { EXAMPLE_LIST } from './index.tsx'
import { ExampleDocument } from './view.tsx'

function renderExample(
  example: (typeof EXAMPLE_LIST)[number],
  options?: { pad?: boolean },
) {
  return render(<ExampleDocument example={example} pad={options?.pad ?? false} />, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

type ExampleActions = Controller<typeof routes.examples>['actions']

let actions = Object.fromEntries(
  EXAMPLE_LIST.map((example) => [
    example.id,
    ({ url }: { url: URL }) =>
      renderExample(example, {
        pad: url.searchParams.has('pad'),
      }),
  ]),
) as ExampleActions

let examplesController = {
  actions,
} satisfies Controller<typeof routes.examples>

export default examplesController
