import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { parseArgs } from 'node:util'
import { discoverPublicModuleHrefs } from 'remix-docs-shared/prerender/public-modules'
import { prerender } from 'remix-docs-shared/prerender/run'
import { assetServer } from '../app/assets.ts'
import { pages } from '../app/data/pages.ts'
import { router } from '../app/router.ts'
import { routes } from '../app/routes.ts'

const uiDir = path.resolve(import.meta.dirname, '..')
const sharedDir = path.join(uiDir, '..', 'shared')
const { values } = parseArgs({
  options: { dir: { type: 'string', short: 'd', default: 'build/site' } },
})
const outputDir = path.resolve(uiDir, values.dir)

const publicModules = await discoverPublicModuleHrefs(assetServer, [
  path.join(uiDir, 'app'),
  sharedDir,
])
const paths = [
  routes.docs.index.href(),
  ...pages.map((page) => routes.docs.page.href({ category: page.category, slug: page.slug })),
  ...publicModules,
]

await fs.rm(outputDir, { recursive: true, force: true })
await prerender(router, {
  outputDir,
  publicDirs: [path.join(sharedDir, 'assets')],
  paths,
  pagefindSiteDir: outputDir,
  onFinally: () => assetServer.close(),
})
