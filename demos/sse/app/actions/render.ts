import type { RemixNode } from 'remix/ui'
import { renderToStream } from 'remix/ui/server'
import { createHtmlResponse } from 'remix/response/html'

export function render(node: RemixNode, init?: ResponseInit) {
  return createHtmlResponse(renderToStream(node), init)
}
