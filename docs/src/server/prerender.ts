import * as cp from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as util from 'node:util'
import * as semver from 'semver'
import { createRouter, getDefaultVersions } from './router.tsx'
import type { ServerContext } from './components.tsx'
import { routes } from './routes.ts'
import { crawl } from 'remix/fetch-router'

let { values: cliArgs } = util.parseArgs({
  options: {
    dir: {
      type: 'string',
      short: 'd',
      default: 'build/site',
    },
  },
})

const assetsDir = path.join(process.cwd(), 'build', 'assets')
const outputDir = path.join(process.cwd(), cliArgs.dir)
const versions = await getVersionsToBuild()
console.log('Prerendering versions:\n', JSON.stringify(versions, null, 2))

const docsRouter = createRouter(versions)

// Copy static assets to the output directory
await fs.cp(assetsDir, path.join(outputDir, 'assets'), { recursive: true })
for (let version of versions || getDefaultVersions()) {
  if (version.crawl) {
    await fs.cp(assetsDir, path.join(outputDir, version.version, 'assets'), { recursive: true })
  }
}

// First pass: spider the site and collect fragment/markdown variant paths
let paths = [
  '/',
  '/api.json',
  ...(versions
    ?.filter((v) => v.crawl)
    .flatMap((v) => [`/${v.version}/api.json`, `/${v.version}/`]) || []),
]
let variantPaths: string[] = []
for await (let { pathname, filepath, response } of crawl(docsRouter, { paths })) {
  await writeResult(pathname, filepath, response)
  let url = `http://localhost${pathname}`
  let match = routes.docs.match(url)
  if (match && !routes.markdown.match(url)) {
    variantPaths.push(routes.fragment.href(match.params))
    variantPaths.push(routes.markdown.href(match.params))
  }
}

// Second pass: fetch variant paths without spidering
for await (let { pathname, filepath, response } of crawl(docsRouter, {
  paths: variantPaths,
  spider: false,
})) {
  await writeResult(pathname, filepath, response)
}

async function writeResult(pathname: string, filepath: string, response: Response) {
  let outputPath = path.join(outputDir, filepath)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, new Uint8Array(await response.arrayBuffer()))
  console.log(`Crawled ${pathname} -> ./${path.relative(process.cwd(), outputPath)}`)
}

async function getVersionsToBuild(): Promise<ServerContext['versions']> {
  // Get all Remix v3 tags, transform them to vX.Y.Z format, sort newest to oldest
  const remixVersions = cp
    .execSync('git tag', { encoding: 'utf-8' })
    .trim()
    .split('\n')
    .filter((tag) => tag.startsWith('remix@3'))
    .map((tag) => tag.replace('remix@', 'v'))
    .filter((tag) => semver.valid(tag) && !semver.prerelease(tag))
    .sort((a, b) => semver.rcompare(a, b))

  // Crawl only the most recent tag
  return remixVersions.length > 0
    ? remixVersions.map((tag, i) => ({ version: tag, crawl: i === 0 }))
    : getDefaultVersions()
}
