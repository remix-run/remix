import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { docsIndexHandler } from './index-page.tsx'
import { docsChapterHandler } from './markdown-chapters.tsx'

export const docsController = createController(routes.docs, {
  actions: {
    index: docsIndexHandler,
    chapter: docsChapterHandler,
  },
})
