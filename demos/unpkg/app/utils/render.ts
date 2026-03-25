import type { SafeHtml } from 'remix/html-template'
import { createHtmlResponse } from 'remix/response/html'

import { createDocument } from '../ui/document.ts'

export function render(title: string, content: SafeHtml, init?: ResponseInit): Response {
  return createHtmlResponse(createDocument(title, content), init)
}
