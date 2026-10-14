import { startDocsServer } from 'remix-docs-shared/server'

import { createApiRouter, getDefaultVersions } from './app/router.ts'
import { createAssetServer } from './app/assets.ts'

const assetServer = createAssetServer()
const router = createApiRouter({ assetServer, versions: getDefaultVersions() })

startDocsServer(router, {
  assetServer,
  label: 'Remix API docs server',
})
