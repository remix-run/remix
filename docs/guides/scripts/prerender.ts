import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as util from 'node:util'
import { discoverBrowserAssetHrefs } from 'remix-docs-shared/prerender/browser-assets'
import { prerender } from 'remix-docs-shared/prerender/run'

import { router } from '../app/router.ts'
import { routes } from '../app/routes.ts'
import { assetServer } from '../app/utils/assets.ts'

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

const browserHrefs = await discoverBrowserAssetHrefs(assetServer, [
  {
    rootDir: guidesDir,
    patterns: [
      'app/**/*.browser.ts',
      'app/**/*.browser.tsx',
      'app/**/*.demo.ts',
      'app/**/*.demo.tsx',
    ],
  },
  {
    rootDir: sharedDir,
    patterns: ['**/*.browser.ts', '**/*.browser.tsx'],
  },
])
const paths = [routes.docs.index.href(), ...browserHrefs]

await fs.rm(outputDir, { recursive: true, force: true })
await prerender(router, {
  outputDir,
  publicDirs: [sharedAssetsDir, publicDir],
  paths,
  pagefindSiteDir: outputDir,
  onFinally: () => assetServer.close(),
})
