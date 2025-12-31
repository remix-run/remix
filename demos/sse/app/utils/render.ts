import type { Remix } from '@remix-run/dom'
import { renderToStream } from '@remix-run/dom/server'
import { createHtmlResponse } from 'remix'

export function render(element: Remix.RemixElement, init?: ResponseInit) {
  return createHtmlResponse(renderToStream(element), init)
}
