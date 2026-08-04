import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as util from 'node:util'
import { discoverPublicModuleHrefs } from 'remix-docs-shared/prerender/public-modules'
import { prerender } from 'remix-docs-shared/prerender/run'

import { assetServer } from '../app/assets.ts'
import { router } from '../app/router.ts'
import { routes } from '../app/routes.ts'

const guidesDir = path.resolve(import.meta.dirname, '..')
const sharedDir = path.join(guidesDir, '..', 'shared')
const publicDir = path.join(guidesDir, 'public')
const sharedAssetsDir = path.join(sharedDir, 'assets')
const defaultOutputDir = path.join(guidesDir, 'build', 'site')

const { values: cliArgs } = util.parseArgs({
  options: {
    dir: {
      type: 'string',
      short: 'd',
      default: defaultOutputDir,
    },
    'base-path': {
      type: 'string',
      default: process.env.REMIX_GUIDES_BASE_PATH ?? '',
    },
  },
})

const outputDir = path.resolve(guidesDir, cliArgs.dir)

const publicModuleHrefs = await discoverPublicModuleHrefs(assetServer, [
  path.join(guidesDir, 'app'),
  sharedDir,
])
const paths = [routes.docs.index.href(), ...publicModuleHrefs]

await fs.rm(outputDir, { recursive: true, force: true })
await prerender(router, {
  outputDir,
  publicDirs: [sharedAssetsDir, publicDir],
  paths,
  pagefindSiteDir: outputDir,
  onFinally: () => assetServer.close(),
})
