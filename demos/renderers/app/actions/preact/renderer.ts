import type { VNode } from 'preact'
import { renderToReadableStream } from 'preact-render-to-string/stream'
import { renderWith } from 'remix/middleware/render'
import { createHtmlResponse } from 'remix/response/html'

/**
 * Installs `context.render(vnode, init)` for controllers that render Preact.
 *
 * This is the whole renderer contract: turn the framework's output into a `Response`.
 * `createHtmlResponse` adds the doctype and `Content-Type`, and `init` carries the status
 * and headers the action wants on the response.
 */
export function preactRenderer() {
  return renderWith(
    ({ request }) =>
      function render(vnode: VNode, init?: ResponseInit): Response {
        // Stop rendering when the browser goes away, since Preact's stream has no signal option.
        let stream = renderToReadableStream(vnode).pipeThrough(new TransformStream(), {
          signal: request.signal,
        })

        return createHtmlResponse(stream, init)
      },
  )
}
