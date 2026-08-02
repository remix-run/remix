import * as cp from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as util from 'node:util'

import { crawl } from '../../api/src/prerender/crawl.ts'
import { writeResult } from '../../api/src/prerender/utils.ts'
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

// Copy public files (favicons, wordmarks) to the output root
await fs.cp(publicDir, outputDir, { recursive: true })

const browserHrefs = await discoverBrowserEntries()
const paths = [routes.docs.index.href(), ...browserHrefs]

try {
  // Spider the site
  for await (let { pathname, filepath, response } of crawl(router, { paths })) {
    await writeResult(outputDir, pathname, filepath, response)
  }
} finally {
  // Release the asset server's file watcher so the process can exit cleanly.
  await assetServer.close()
}

// Run pagefind to generate the search index and assets
const cmd = `pnpm exec pagefind --site ${outputDir} --output-subdir ${outputDir}/assets/pagefind`
console.log(`Running Pagefind:\n  ${cmd}`)
await cp.execSync(cmd)

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
