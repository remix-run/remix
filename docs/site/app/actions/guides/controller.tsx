import { createController } from 'remix/router'

import type { DocsContextLoader } from '../../data/docs.ts'
import { routes } from '../../routes.ts'
import { renderReferenceDocument, serveReferenceMarkdown } from '../reference/controller.tsx'
import { docsChapterHandler, docsChapterMarkdownHandler } from './markdown-chapters.tsx'

interface GuidesControllerOptions {
  getDocsContext: DocsContextLoader
}

// Guides live at the URL root, so a single-segment path that isn't a chapter may be a package
// page (`/router/`). Unknown chapters fall through to the reference handlers.
export function createGuidesController(options: GuidesControllerOptions) {
  return createController(routes.guides, {
    actions: {
      markdown: (context) =>
        docsChapterMarkdownHandler(context, (slug) =>
          serveReferenceMarkdown(options.getDocsContext, { request: context.request, slug }),
        ),
      chapter: (context) =>
        docsChapterHandler(context, options.getDocsContext, (slug) =>
          renderReferenceDocument(options.getDocsContext, { slug, render: context.render }),
        ),
    },
  })
}
