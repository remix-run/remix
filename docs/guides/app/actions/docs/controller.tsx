import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { docsIndexHandler } from './index-page.tsx'
import { docsChapterHandler, docsChapterMarkdownHandler } from './markdown-chapters.tsx'

export default createController(routes.docs, {
  actions: {
    index: docsIndexHandler,
    markdown: docsChapterMarkdownHandler,
    chapter: docsChapterHandler,
  },
})
