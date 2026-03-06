import * as cp from 'node:child_process'
import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as util from 'node:util'
import * as semver from 'semver'
import { createRouter, getDefaultVersions } from './router.tsx'
import type { ServerContext } from './components.tsx'
import { routes } from './routes.ts'
import type { CrawlOptions } from 'remix/fetch-router'

let { values: cliArgs } = util.parseArgs({
  options: {
    dir: {
      type: 'string',
      short: 'd',
      default: 'build/site',
    },
    all: {
      type: 'boolean',
      short: 'a',
    },
  },
})

const assetsDir = path.join(process.cwd(), 'build', 'assets')
const outputDir = path.join(process.cwd(), cliArgs.dir)
const versions = await getVersionsToBuild(outputDir, cliArgs.all === true)
if (versions) {
  console.log('Prerendering versions:\n', JSON.stringify(versions, null, 2))
} else {
  console.log('No remix version tags found, defaulting to current version only')
}

const docsRouter = createRouter(versions)

// Copy static assets to the output directory
await fs.cp(assetsDir, path.join(outputDir, 'assets'), { recursive: true })
for (let version of versions || getDefaultVersions()) {
  if (version.crawl) {
    await fs.cp(assetsDir, path.join(outputDir, version.version, 'assets'), { recursive: true })
  }
}

let crawlOpts: CrawlOptions = {
  // Crawl the root path and any requested version paths
  paths: ['/', ...(versions?.filter((v) => v.crawl).map((v) => `/${v.version}/`) || [])],
  // Crawl fragment and markdown variants of docs pages
  variants(path) {
    let url = `http://localhost${path}`
    let match = routes.docs.match(url)
    if (match && !routes.markdown.match(url)) {
      return [routes.fragment.href(match.params), routes.markdown.href(match.params)]
    }
  },
}

for await (let result of docsRouter.crawl(crawlOpts)) {
  // Output files
  let { pathname, filepath, response } = result
  let outputPath = path.join(outputDir, filepath)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, new Uint8Array(await response.arrayBuffer()))
  console.log(`Crawled ${pathname} -> ./${path.relative(process.cwd(), outputPath)}`)
}

async function getVersionsToBuild(
  outputDir: string,
  all: boolean,
): Promise<ServerContext['versions'] | undefined> {
  // Get all Remix v3 tags, transform them to vX.Y.Z format, sort newest to oldest
  const remixVersions = cp
    .execSync('git tag', { encoding: 'utf-8' })
    .trim()
    .split('\n')
    .filter((tag) => tag.startsWith('remix@3'))
    .map((tag) => tag.replace('remix@', 'v'))
    .filter((tag) => semver.valid(tag) && !semver.prerelease(tag))
    .sort((a, b) => semver.rcompare(a, b))

  if (remixVersions.length === 0) {
    return undefined
  } else if (all) {
    // When --all is specified, crawl all Remix tags that don't currently have a
    // set of docs on disk
    let versions = existsSync(outputDir)
      ? (await fs.readdir(outputDir, { withFileTypes: true }))
          .filter((entry) => entry.isDirectory() && entry.name.startsWith('v'))
          .map((entry) => entry.name)
      : []
    const alreadyBuilt = new Set(versions)
    return remixVersions.map((tag) => ({ version: tag, crawl: !alreadyBuilt.has(tag) }))
  } else {
    // Otherwise, just crawl the most recent tag
    return remixVersions.map((tag) => ({
      version: tag,
      crawl: tag === remixVersions[0],
    }))
  }
}
