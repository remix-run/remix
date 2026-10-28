import * as cp from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as util from 'node:util'
import type { RequestContext, Router } from 'remix/router'

import { crawl } from './crawl.ts'
import type { CrawlOptions } from './crawl.ts'
import { writeResult } from './utils.ts'

const execFile = util.promisify(cp.execFile)

export interface PrerenderOptions {
  outputDir: string
  publicDirs?: string[]
  paths?: string[]
  crawlOptions?: Omit<CrawlOptions, 'paths'>
  pagefindSiteDir?: string
  // The site's asset folder, where Pagefind writes its bundle. Defaults to `assets`.
  assetsDir?: string
  onFinally?: () => void | Promise<void>
}

export async function prerender<context extends RequestContext<any, any>>(
  router: Router<context>,
  options: PrerenderOptions,
): Promise<void> {
  let {
    outputDir,
    publicDirs = [],
    paths,
    crawlOptions,
    pagefindSiteDir,
    assetsDir = 'assets',
    onFinally,
  } = options

  try {
    for (let publicDir of publicDirs) {
      await fs.cp(publicDir, outputDir, { recursive: true })
    }

    for await (let { pathname, filepath, response } of crawl(router, {
      ...crawlOptions,
      paths,
    })) {
      await writeResult(outputDir, pathname, filepath, response)
    }

    if (pagefindSiteDir != null) {
      await runPagefind(pagefindSiteDir, assetsDir)
    }
  } finally {
    await onFinally?.()
  }
}

async function runPagefind(siteDir: string, assetsDir: string): Promise<void> {
  let pagefindArgs = [
    'exec',
    'pagefind',
    '--site',
    siteDir,
    '--output-subdir',
    path.join(siteDir, assetsDir, 'pagefind'),
  ]
  console.log(`Running Pagefind:\n  pnpm ${pagefindArgs.join(' ')}`)
  await execFile('pnpm', pagefindArgs, { shell: process.platform === 'win32' })
}
