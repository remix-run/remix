import { startDocsServer } from 'remix-docs-shared/server'

import { router } from './app/router.ts'
import { assetServer } from './app/utils/assets.ts'
import { createDevRefreshEvents } from './app/utils/dev-refresh-server.ts'

const devRefresh = process.env.NODE_ENV === 'production' ? undefined : createDevRefreshEvents()

startDocsServer(router, {
  assetServer,
  devRefresh,
  label: 'Remix Guides server',
})
