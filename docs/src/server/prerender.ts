import * as cp from 'node:child_process'
import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as util from 'node:util'
import { parse } from 'node-html-parser'
import * as semver from 'semver'
import { type Router } from 'remix/fetch-router'
import { createRouter, getDefaultVersions } from './router.tsx'
import type { ServerContext } from './components.tsx'
import { routes } from './routes.ts'

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

await spider(docsRouter, outputDir)

// Spider the website served by router, beginning at /
async function spider(router: Router, outputDir: string, urlQueue = new Set(['/'])) {
  await fs.mkdir(outputDir, { recursive: true })

  // Track URLs we have already downloaded to avoid loops
  let downloadedUrls = new Set<string>()

  for (let urlPath of urlQueue) {
    if (urlPath && !downloadedUrls.has(urlPath)) {
      let { downloadedUrl, discoveredUrls } = await crawl(router, urlPath, outputDir)
      downloadedUrls.add(downloadedUrl)
      discoveredUrls
        .filter((href) => !downloadedUrls.has(href))
        .forEach((href) => urlQueue.add(href))
    }
  }

  console.log(`\nCrawling complete!`)
}

async function crawl(router: Router, urlPath: string, outputDir: string) {
  let response
  try {
    response = await router.fetch(new Request(`http://localhost${urlPath}`))
    if (!response.ok) {
      throw new Error(`Error fetching ${urlPath}: ${response.status} ${response.statusText}`)
    }
  } catch (error) {
    console.error('Error fetching', urlPath)
    throw error
  }

  let isHtmlFile = response.headers.get('Content-Type')?.includes('text/html')

  // Always put `index.html` files into directories - this leads to the best
  // support with and without trailing slashes on github pages:
  // https://github.com/slorber/trailing-slash-guide?tab=readme-ov-file#summary
  let outputPath = isHtmlFile
    ? path.join(outputDir, urlPath, 'index.html')
    : path.join(outputDir, urlPath)

  console.log(`Crawled ${urlPath} -> ./${path.relative(process.cwd(), outputPath)}`)

  await fs.mkdir(path.dirname(outputPath), { recursive: true })

  if (isHtmlFile) {
    let html = await response.text()
    await fs.writeFile(outputPath, html, 'utf-8')

    // Parse HTML files for other resources/links to add to queue
    return {
      downloadedUrl: urlPath,
      discoveredUrls: parse(html)
        .querySelectorAll('a:not([rel="nofollow"]),link:not([rel="preload"]):not([rel="prefetch"])')
        .map((link) => link.getAttribute('href'))
        .filter((href) => href && !isAbsoluteUrl(href))
        .map((href) => resolveRelativeLink(href!, urlPath))
        .flatMap((href) => {
          let match = routes.docs.match(`http://localhost${href}`)
          return match
            ? [href, routes.markdown.href(match.params), routes.fragment.href(match.params)]
            : [href]
        }),
    }
  } else {
    let content = await response.arrayBuffer()
    await fs.writeFile(outputPath, new Uint8Array(content))
    return { downloadedUrl: urlPath, discoveredUrls: [] }
  }
}

function isAbsoluteUrl(href: string): boolean {
  return href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')
}

function resolveRelativeLink(link: string, url: string): string {
  if (link.startsWith('/')) {
    return link
  }

  // Handle relative paths like '../' or 'page'
  let base = url.endsWith('/') ? url : path.dirname(url)
  return path.posix.join(base, link)
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
