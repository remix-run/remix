import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { docsIndexHandler } from './index-page.tsx'
import { docsChapterHandler } from './markdown-chapters.tsx'
import { packageMapHandler } from './package-map.tsx'

export default createController(routes.docs, {
  actions: {
    index: docsIndexHandler,
    packageMap: packageMapHandler,
    chapter: docsChapterHandler,
  },
})
