import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as util from 'node:util'
import { parse } from 'node-html-parser'
import { type Router } from 'remix/fetch-router'

import { router } from '../config/router.tsx'

const { values: cliArgs } = util.parseArgs({
  options: {
    dir: {
      type: 'string',
      short: 'd',
      default: 'build/site',
    },
  },
})

const publicDir = path.join(process.cwd(), 'public')
const outputDir = path.join(process.cwd(), cliArgs.dir)

await fs.mkdir(outputDir, { recursive: true })

// Copy `public/*` into the output dir so any unreferenced assets (sourcemaps,
// fonts, etc.) still ship even if the crawler doesn't discover them.
await fs.cp(publicDir, outputDir, { recursive: true })

await spider(router, outputDir, new Set(['/', '/api/airports', '/theme-builder']))

async function spider(router: Router, outputDir: string, urlQueue = new Set(['/'])) {
  await fs.mkdir(outputDir, { recursive: true })

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
  let response: Response
  try {
    response = await router.fetch(new Request(`http://localhost${urlPath}`))
  } catch (error) {
    console.error('Error fetching', urlPath)
    throw error
  }

  // 404s on illustrative/external-looking links inside example content (e.g.
  // breadcrumb demos) shouldn't fail the build. Skip without writing.
  if (response.status === 404) {
    console.warn(`Skipping ${urlPath}: 404 Not Found`)
    return { downloadedUrl: urlPath, discoveredUrls: [] as string[] }
  }

  if (!response.ok) {
    throw new Error(`Error fetching ${urlPath}: ${response.status} ${response.statusText}`)
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

    return {
      downloadedUrl: urlPath,
      discoveredUrls: parse(html)
        .querySelectorAll('a:not([rel="nofollow"]),link:not([rel="preload"]):not([rel="prefetch"])')
        .map((link) => link.getAttribute('href'))
        .filter((href) => href && !isAbsoluteUrl(href))
        .map((href) => stripFragment(resolveRelativeLink(href!, urlPath)))
        .filter((href) => href.length > 0),
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

  let base = url.endsWith('/') ? url : path.dirname(url)
  return path.posix.join(base, link)
}

function stripFragment(href: string): string {
  let hash = href.indexOf('#')
  return hash === -1 ? href : href.slice(0, hash)
}
