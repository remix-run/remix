import type { RemixNode } from 'remix/component'
import { renderToString } from 'remix/component/server'
import { createHtmlResponse } from 'remix/response/html'

export async function render(node: RemixNode, init?: ResponseInit) {
  let html = await renderToString(node)
  return createHtmlResponse(html, init)
}
