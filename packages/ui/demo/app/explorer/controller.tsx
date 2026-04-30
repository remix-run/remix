import type { Controller } from 'remix/fetch-router'
import type { RequestContext } from 'remix/fetch-router'

import { render } from '../../config/render.tsx'
import type { routes } from '../../config/routes.ts'
import { PAGE_LIST } from './registry.tsx'
import { ExplorerDocument } from './view.tsx'

function renderPage(context: RequestContext, page: (typeof PAGE_LIST)[number]) {
  return render(context, <ExplorerDocument page={page} />, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

type ExplorerActions = Controller<typeof routes.explorer>['actions']

const actions = Object.fromEntries(
  PAGE_LIST.map((page) => [page.actionKey, (context: RequestContext) => renderPage(context, page)]),
) as unknown as ExplorerActions

const explorerController = {
  actions,
} satisfies Controller<typeof routes.explorer>

export default explorerController
