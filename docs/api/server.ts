import * as path from 'node:path'
import { startDocsServer } from 'remix-docs-shared/server'

import { createApiRouter, getDefaultVersions } from './app/router.ts'
import { createAssetServer } from './app/assets.ts'

const assetServer = createAssetServer()
const router = createApiRouter({ assetServer, versions: getDefaultVersions() })

startDocsServer(router, {
  assetServer,
  // `pnpm run docs` deletes and recreates `build/md/`, so watch its parent.
  content: {
    dir: path.resolve(import.meta.dirname, 'build'),
    filter: (file) => file.startsWith('md'),
  },
  label: 'Remix API docs server',
})
