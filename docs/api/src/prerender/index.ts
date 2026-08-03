import * as path from 'node:path'
import * as util from 'node:util'
import { prerender } from 'remix-docs-shared/prerender/run'

import { createAssetServer } from '../server/assets.ts'
import { createRouter, getDefaultVersions } from '../server/router.tsx'
import { routes, withVersion } from '../server/routes.ts'
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

const publicDir = path.join(process.cwd(), 'public')
const sharedAssetsDir = path.resolve(import.meta.dirname, '..', '..', '..', 'shared', 'assets')
const outputDir = path.join(process.cwd(), cliArgs.dir)

const versions = getVersionsForPicker(buildVersion, getDefaultVersions())
console.log(`Prerendering ${buildVersion ? buildVersion : 'root'} docs`)
console.log('Version picker options:\n', JSON.stringify(versions, null, 2))

const assetServer = createAssetServer(buildVersion)
const router = createRouter({ assetServer, versions })

const homePath = withVersion(routes.home.href(), buildVersion)
const paths = [homePath, withVersion(routes.lookup.href(), buildVersion)]
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
