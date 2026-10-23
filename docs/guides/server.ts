import * as path from 'node:path'
import { startDocsServer } from 'remix-docs-shared/server'

import { router } from './app/router.ts'
import { assetServer } from './app/assets.ts'

startDocsServer(router, {
  assetServer,
  content: { dir: path.resolve(import.meta.dirname, 'app/actions/docs/chapters') },
  label: 'Remix Guides server',
})
