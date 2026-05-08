import { createController, type RequestContext } from 'remix/fetch-router'

import { render } from '../../config/render.tsx'
import { routes } from '../../config/routes.ts'
import { PAGE_LIST } from './registry.tsx'
import { ExplorerDocument } from './view.tsx'

function renderPage(context: RequestContext, page: (typeof PAGE_LIST)[number]) {
  return render(context, <ExplorerDocument page={page} />, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

const actions = Object.fromEntries(
  PAGE_LIST.map((page) => [page.actionKey, (context: RequestContext) => renderPage(context, page)]),
) as Record<
  (typeof PAGE_LIST)[number]['actionKey'],
  (context: RequestContext) => Response | Promise<Response>
>

const explorerController = createController(routes.explorer, {
  actions,
})

export default explorerController
