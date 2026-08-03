import { startDocsServer } from 'remix-docs-shared/server'

import { createAssetServer } from './assets.ts'
import { createRouter, getDefaultVersions } from './router.tsx'

const assetServer = createAssetServer()
const router = createRouter({ assetServer, versions: getDefaultVersions() })

startDocsServer(router, {
  assetServer,
  label: 'Remix API docs server',
})
