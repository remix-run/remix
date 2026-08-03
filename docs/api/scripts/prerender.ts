import * as path from 'node:path'
import * as util from 'node:util'
import { discoverBrowserAssetHrefs } from 'remix-docs-shared/prerender/browser-assets'
import { prerender } from 'remix-docs-shared/prerender/run'

import { createApiRouter, getDefaultVersions } from '../app/router.ts'
import { routes, withVersion } from '../app/routes.ts'
import { createAssetServer } from '../app/utils/assets.ts'
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

const browserHrefs = await discoverBrowserAssetHrefs(assetServer, [
  {
    rootDir: path.join(apiDir, 'app'),
    patterns: ['**/*.browser.ts', '**/*.browser.tsx'],
  },
  {
    rootDir: sharedDir,
    patterns: ['**/*.browser.ts', '**/*.browser.tsx'],
  },
])
const homePath = withVersion(routes.home.href(), buildVersion)
const paths = [homePath, withVersion(routes.lookup.href(), buildVersion), ...browserHrefs]
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
  onFinally: () => assetServer.close(),
})
