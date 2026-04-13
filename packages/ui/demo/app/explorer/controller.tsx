import type { Controller } from 'remix/fetch-router'

import { render } from '../../config/render.tsx'
import type { routes } from '../../config/routes.ts'
import { PAGE_LIST } from './registry.tsx'
import { ExplorerDocument } from './view.tsx'

function renderPage(page: (typeof PAGE_LIST)[number]) {
  return render(<ExplorerDocument page={page} />, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

type ExplorerActions = Controller<typeof routes.explorer>['actions']

let actions = Object.fromEntries(
  PAGE_LIST.map((page) => [page.actionKey, () => renderPage(page)]),
) as unknown as ExplorerActions

let explorerController = {
  actions,
} satisfies Controller<typeof routes.explorer>

export default explorerController
