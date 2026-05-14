import { renderWith } from 'remix/middleware/render'
import { createHtmlResponse } from 'remix/response/html'
import type { RemixNode } from 'remix/ui'
import { renderToStream } from 'remix/ui/server'

export function render() {
  return renderWith(
    () =>
      function render(node: RemixNode, init?: ResponseInit) {
        return createHtmlResponse(renderToStream(node), init)
      },
  )
}
