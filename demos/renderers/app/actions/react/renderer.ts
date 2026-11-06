import type { ReactNode } from 'react'
import { renderToReadableStream } from 'react-dom/server'
import { renderWith } from 'remix/middleware/render'
import { createHtmlResponse } from 'remix/response/html'

/**
 * Installs `context.render(node, init)` for controllers that render React.
 *
 * `renderToReadableStream` resolves once the shell has rendered, so shell errors surface as
 * rejected promises instead of half-written responses. React emits its own doctype for `<html>`
 * roots; `createHtmlResponse` leaves it alone and adds the `Content-Type`.
 */
export function reactRenderer() {
  return renderWith(
    ({ request }) =>
      async function render(node: ReactNode, init?: ResponseInit): Promise<Response> {
        let stream = await renderToReadableStream(node, { signal: request.signal })

        return createHtmlResponse(stream, init)
      },
  )
}
