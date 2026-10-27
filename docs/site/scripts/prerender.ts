import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as util from 'node:util'
import { discoverPublicModuleHrefs } from 'remix-docs-shared/prerender/public-modules'
import { prerender } from 'remix-docs-shared/prerender/run'

import { createDocsContextLoader } from '../app/data/docs.ts'
import { API_PAGE_ID, HOME_PAGE_ID } from '../app/data/registry.ts'
import { loadDocsChapterSummaries } from '../app/actions/guides/markdown-chapters.tsx'
import { createDocsRouter } from '../app/router.ts'
import { routes } from '../app/routes.ts'
import { createAssetServer } from '../app/assets.ts'

const { values: cliArgs } = util.parseArgs({
  options: {
    dir: {
      type: 'string',
      short: 'd',
      default: path.join('build', 'site'),
    },
  },
})

const siteDir = path.resolve(import.meta.dirname, '..')
const sharedDir = path.join(siteDir, '..', 'shared')
const publicDir = path.join(siteDir, 'public')
const sharedAssetsDir = path.join(sharedDir, 'assets')
const outputDir = path.resolve(siteDir, cliArgs.dir)

const assetServer = createAssetServer()
const router = createDocsRouter({ assetServer })

const publicModuleHrefs = await discoverPublicModuleHrefs(assetServer, [
  path.join(siteDir, 'app'),
  sharedDir,
])
// List every docs page rather than relying on the crawl, which stops at nofollow package pages.
const { registry } = await createDocsContextLoader()()
const pagePaths = Object.values(registry.pages).flatMap((page) => {
  if (page.id === HOME_PAGE_ID || page.id === API_PAGE_ID) return []
  if (!page.docFile) return [page.path]
  return [page.path, routes.reference.markdown.href({ slug: page.id })]
})
const guidePaths = (await loadDocsChapterSummaries('production')).flatMap((chapter) => [
  chapter.href,
  routes.guides.markdown.href({ chapter: chapter.slug }),
])
const paths = [
  routes.home.href(),
  routes.api.href(),
  routes.lookup.href(),
  // The overview embeds this frame, and the crawl doesn't follow frame sources.
  routes.guides.examples.show.href({ chapter: 'overview', example: 'install-command' }),
  ...publicModuleHrefs,
  ...pagePaths,
  ...guidePaths,
]

await fs.rm(outputDir, { recursive: true, force: true })
await prerender(router, {
  outputDir,
  publicDirs: [sharedAssetsDir, publicDir],
  paths,
  pagefindSiteDir: outputDir,
  assetsDir: '_assets',
  onFinally: () => assetServer.close(),
})
