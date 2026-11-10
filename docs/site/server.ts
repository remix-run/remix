import * as path from 'node:path'
import { startDocsServer } from 'remix-docs-shared/server'

import { createDocsRouter } from './app/router.ts'
import { createAssetServer } from './app/assets.ts'

const assetServer = createAssetServer()
const router = createDocsRouter({ assetServer })
const siteDir = path.resolve(import.meta.dirname)

startDocsServer(router, {
  assetServer,
  content: {
    dir: siteDir,
    filter: (file) =>
      file.startsWith(path.join('build', 'md')) ||
      file.startsWith(path.join('app', 'actions', 'guides', 'chapters')),
  },
  label: 'Remix docs server',
})
