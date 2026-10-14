import { startDocsServer } from 'remix-docs-shared/server'

import { router } from './app/router.ts'
import { assetServer } from './app/assets.ts'

startDocsServer(router, { assetServer, label: 'Remix UI docs server' })
