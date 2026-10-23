import * as path from 'node:path'
import * as util from 'node:util'
import { discoverPublicModuleHrefs } from 'remix-docs-shared/prerender/public-modules'
import { prerender } from 'remix-docs-shared/prerender/run'

import { createDocsContextLoader } from '../app/data/docs.ts'
import { HOME_PAGE_ID } from '../app/data/registry.ts'
import { createApiRouter } from '../app/router.ts'
import { routes } from '../app/routes.ts'
import { createAssetServer } from '../app/assets.ts'

let { values: cliArgs } = util.parseArgs({
  options: {
    dir: {
      type: 'string',
      short: 'd',
      default: path.join('build', 'site'),
    },
  },
})

const apiDir = path.resolve(import.meta.dirname, '..')
const sharedDir = path.join(apiDir, '..', 'shared')
const publicDir = path.join(apiDir, 'public')
const sharedAssetsDir = path.join(sharedDir, 'assets')
const outputDir = path.resolve(apiDir, cliArgs.dir)

const assetServer = createAssetServer()
const router = createApiRouter({ assetServer })

const publicModuleHrefs = await discoverPublicModuleHrefs(assetServer, [
  path.join(apiDir, 'app'),
  sharedDir,
])
// List every docs page rather than relying on the crawl, which stops at nofollow package pages.
const { registry } = await createDocsContextLoader()()
const pagePaths = Object.values(registry.pages).flatMap((page) => {
  if (page.id === HOME_PAGE_ID) return []
  if (!page.docFile) return [page.path]
  return [page.path, routes.api.markdown.href({ slug: page.id })]
})
const paths = [
  routes.home.href(),
  routes.lookup.href(),
  ...publicModuleHrefs,
  ...pagePaths,
]

await prerender(router, {
  outputDir,
  publicDirs: [sharedAssetsDir, publicDir],
  paths,
  pagefindSiteDir: outputDir,
  assetsDir: '_assets',
  onFinally: () => assetServer.close(),
})
