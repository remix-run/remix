import type { Remix } from '@remix-run/dom'
import { renderToStream } from '@remix-run/dom/server'
import { html } from '@remix-run/fetch-router/response-helpers'

export function render(element: Remix.RemixElement, init?: ResponseInit) {
  return html(renderToStream(element), init)
}
