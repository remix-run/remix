import { createController } from 'remix/router'
import { createRedirectResponse } from 'remix/response/redirect'

import type { DocsContextLoader } from '../../data/docs.ts'
import { routes } from '../../routes.ts'
import { docsChapterHandler, docsChapterMarkdownHandler } from './markdown-chapters.tsx'

interface GuidesControllerOptions {
  getDocsContext: DocsContextLoader
}

export function createGuidesController(options: GuidesControllerOptions) {
  return createController(routes.guides, {
    actions: {
      index: () => createRedirectResponse(routes.home.href(), 308),
      markdown: docsChapterMarkdownHandler,
      chapter: (context) => docsChapterHandler(context, options.getDocsContext),
    },
  })
}
