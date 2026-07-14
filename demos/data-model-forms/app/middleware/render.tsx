import { renderWith } from 'remix/middleware/render'
import { createHtmlResponse } from 'remix/response/html'
import type { RemixNode } from 'remix/ui'
import { renderToStream } from 'remix/ui/server'

import { assetServer } from '../utils/assets.ts'

export function render() {
  return renderWith(
    ({ request }) =>
      function render(node: RemixNode, init?: ResponseInit): Response {
        let stream = renderToStream(node, {
          signal: request.signal,
          async resolveClientEntry(entryId, component) {
            if (!entryId.startsWith('file://')) {
              throw new Error(`Expected a source module URL, received '${entryId}'`)
            }

            let exportName = entryId.split('#')[1] || component.name

            if (!exportName) {
              throw new Error(`Unable to resolve a client entry export for '${entryId}'`)
            }

            return {
              href: await assetServer.getHref(entryId),
              exportName,
            }
          },
          onError(error) {
            console.error(error)
          },
        })

        return createHtmlResponse(stream, init)
      },
  )
}
