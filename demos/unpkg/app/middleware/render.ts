import type { SafeHtml } from 'remix/html-template'
import { renderWith } from 'remix/middleware/render'
import { createHtmlResponse } from 'remix/response/html'

import { createDocument } from '../ui/document.ts'

export interface HtmlDocument {
  title: string
  content: SafeHtml
}

export function render() {
  return renderWith(
    () =>
      function render(document: HtmlDocument, init?: ResponseInit): Response {
        return createHtmlResponse(createDocument(document.title, document.content), init)
      },
  )
}
