import * as cp from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as util from 'node:util'
import { createAssetServer } from '../server/asset-server.ts'
import { createRouter, getDefaultVersions } from '../server/router.tsx'
import { routes } from '../server/routes.ts'
import { crawl } from './crawl.ts'
import { getVersionsForPicker } from './versions.ts'
import { writeResult } from './utils.ts'

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

const publicDir = path.join(process.cwd(), 'build', 'public')
const outputDir = path.join(process.cwd(), cliArgs.dir)

const versions = getVersionsForPicker(buildVersion, getDefaultVersions())
console.log(`Prerendering ${buildVersion ? buildVersion : 'root'} docs`)
console.log('Version picker options:\n', JSON.stringify(versions, null, 2))

const assetServer = createAssetServer(buildVersion)
const router = createRouter({ assetServer, versions })

// Copy public files (favicons, wordmarks) to the output root. URLs are
// unversioned so a single copy at the output root covers every version.
await fs.cp(publicDir, outputDir, { recursive: true })

// Spider the site
const homePath = routes.home.href({ version: buildVersion })
const paths = [homePath, routes.lookup.href({ version: buildVersion })]

for await (let { pathname, filepath, response } of crawl(router, {
  paths,
  // Versioned pages stay noindex,nofollow for public crawlers, but the
  // prerender spider needs the versioned home page's sidebar links to seed
  // the static docs graph.
  ignorePageNofollow: buildVersion ? (pathname) => pathname === homePath : undefined,
})) {
  await writeResult(outputDir, pathname, filepath, response)
}

// Run pagefind to generate the search index and assets
let versionedDir = buildVersion ? path.join(outputDir, buildVersion) : outputDir
let cmd = `pnpm exec pagefind --site ${versionedDir} --output-subdir ${versionedDir}/assets/pagefind`
console.log(`Running Pagefind:\n  ${cmd}`)
await cp.execSync(cmd)

// Release the asset server's file watcher so the process can exit cleanly.
await assetServer.close()
