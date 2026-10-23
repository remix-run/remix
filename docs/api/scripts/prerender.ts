import * as path from 'node:path'
import * as util from 'node:util'
import { discoverPublicModuleHrefs } from 'remix-docs-shared/prerender/public-modules'
import { prerender } from 'remix-docs-shared/prerender/run'

import { createDocsContextLoader } from '../app/data/docs.ts'
import { HOME_PAGE_ID } from '../app/data/registry.ts'
import { createApiRouter, getDefaultVersions } from '../app/router.ts'
import { routes, withVersion } from '../app/routes.ts'
import { createAssetServer } from '../app/assets.ts'
import { getVersionsForPicker } from './versions.ts'

let { values: cliArgs } = util.parseArgs({
  options: {
    dir: {
      type: 'string',
      short: 'd',
      default: path.join('build', 'site'),
    },
    version: {
      type: 'string',
    },
  },
})

const buildVersion = cliArgs.version
if (buildVersion != null && (buildVersion.length === 0 || buildVersion.includes('/'))) {
  throw new Error(`Invalid --version value: ${buildVersion}`)
}

const apiDir = path.resolve(import.meta.dirname, '..')
const sharedDir = path.join(apiDir, '..', 'shared')
const publicDir = path.join(apiDir, 'public')
const sharedAssetsDir = path.join(sharedDir, 'assets')
const outputDir = path.resolve(apiDir, cliArgs.dir)

const versions = getVersionsForPicker(buildVersion, getDefaultVersions())
console.log(`Prerendering ${buildVersion ? buildVersion : 'root'} docs`)
console.log('Version picker options:\n', JSON.stringify(versions, null, 2))

const assetServer = createAssetServer(buildVersion)
const router = createApiRouter({ assetServer, versions })

const publicModuleHrefs = await discoverPublicModuleHrefs(assetServer, [
  path.join(apiDir, 'app'),
  sharedDir,
])
const homePath = withVersion(routes.home.href(), buildVersion)
// List every docs page rather than relying on the crawl, which stops at nofollow package pages.
const registry = (await createDocsContextLoader()()).getRegistry(buildVersion)
const pagePaths = Object.values(registry.pages).flatMap((page) => {
  if (page.id === HOME_PAGE_ID) return []
  if (!page.docFile) return [page.path]
  return [page.path, withVersion(routes.api.markdown.href({ slug: page.id }), buildVersion)]
})
// Docs used to live under `/api/`. Until api.remix.run redirects them, write a redirect page at
// each old URL and a copy of the Markdown at each old `.md` URL.
const legacyPaths = Object.values(registry.pages).flatMap((page) => {
  if (!page.docFile || page.docFile.kind === 'demo') return []
  let { docsPath } = page.docFile
  let slugs =
    page.docFile.kind === 'package'
      ? [`${docsPath}/overview/`, `${docsPath}/overview.md`]
      : [`${docsPath}/`, `${docsPath}.md`]
  return slugs.map((slug) => withVersion(routes.legacy.href({ slug }), buildVersion))
})
const paths = [
  homePath,
  withVersion(routes.lookup.href(), buildVersion),
  ...publicModuleHrefs,
  ...pagePaths,
  ...legacyPaths,
]
const pagefindSiteDir = buildVersion ? path.join(outputDir, buildVersion) : outputDir

await prerender(router, {
  outputDir,
  // Public URLs are unversioned, so a single copy at the output root covers every version.
  publicDirs: [sharedAssetsDir, publicDir],
  paths,
  crawlOptions: {
    // Versioned pages stay noindex,nofollow for public crawlers, but the
    // prerender spider needs the versioned home page's sidebar links to seed
    // the static docs graph.
    ignorePageNofollow: buildVersion ? (pathname) => pathname === homePath : undefined,
  },
  pagefindSiteDir,
  assetsDir: '_assets',
  onFinally: () => assetServer.close(),
})
