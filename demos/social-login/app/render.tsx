import type { RemixNode } from 'remix/component'
import { renderToStream } from 'remix/component/server'
import { createHtmlResponse } from 'remix/response/html'

export function render(node: RemixNode, init?: ResponseInit) {
  let stream = renderToStream(node, {
    onError(error) {
      console.error(error)
    },
  })

  return createHtmlResponse(stream, init)
}
