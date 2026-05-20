import { renderWith } from 'remix/middleware/render'
import { createHtmlResponse } from 'remix/response/html'
import type { RemixNode } from 'remix/ui'
import { renderToStream } from 'remix/ui/server'

export function render() {
  return renderWith(
    ({ request }) =>
      function render(node: RemixNode, init?: ResponseInit) {
        let stream = renderToStream(node, {
          signal: request.signal,
          onError(error) {
            console.error(error)
          },
        })

        return createHtmlResponse(stream, init)
      },
  )
}
