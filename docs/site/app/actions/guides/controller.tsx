import { createController } from 'remix/router'

import type { DocsContextLoader } from '../../data/docs.ts'
import { routes } from '../../routes.ts'
import { docsChapterHandler, docsChapterMarkdownHandler } from './markdown-chapters.tsx'

interface GuidesControllerOptions {
  getDocsContext: DocsContextLoader
}

export function createGuidesController(options: GuidesControllerOptions) {
  return createController(routes.guides, {
    actions: {
      markdown: (context) => docsChapterMarkdownHandler(context),
      chapter: (context) => docsChapterHandler(context, options.getDocsContext),
    },
  })
}
