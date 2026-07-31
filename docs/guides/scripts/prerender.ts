import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as util from 'node:util'
import { prerender } from 'remix-docs-shared/prerender/run'

import { router } from '../app/router.ts'
import { routes } from '../app/routes.ts'
import { assetServer } from '../app/utils/assets.ts'

const guidesDir = path.resolve(import.meta.dirname, '..')
const publicDir = path.join(guidesDir, 'public')
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

const browserHrefs = await discoverBrowserEntries()
const paths = [routes.docs.index.href(), ...browserHrefs]

await prerender(router, {
  outputDir,
  publicDirs: [publicDir],
  paths,
  pagefindSiteDir: outputDir,
  onFinally: () => assetServer.close(),
})

async function discoverBrowserEntries(): Promise<string[]> {
  let hrefs = new Set<string>()

  let browserEntryPatterns = [
    'app/**/*.browser.ts',
    'app/**/*.browser.tsx',
    'app/**/*.demo.ts',
    'app/**/*.demo.tsx',
  ]

  for (let pattern of browserEntryPatterns) {
    for await (let entry of fs.glob(pattern, { cwd: guidesDir })) {
      if (entry.includes('.test.') || path.basename(entry).startsWith('dev-refresh.browser.')) {
        continue
      }

      let entryPath = path.join(guidesDir, entry)
      hrefs.add(await assetServer.getHref(entryPath))
      let preloads = await assetServer.getPreloads(entryPath).catch(() => [])
      preloads.forEach((preload) => hrefs.add(preload))
    }
  }

  return Array.from(hrefs).sort()
}
