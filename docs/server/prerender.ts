import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as util from 'node:util'
import { parse } from 'node-html-parser'
import { router as docsRouter } from './router.tsx'
import { Router } from 'remix/fetch-router'

let { values: cliArgs } = util.parseArgs({
  options: {
    dir: {
      type: 'string',
      short: 'd',
      default: 'site',
    },
  },
})

await spider(docsRouter, cliArgs.dir)

// Spider the website served by router, beginning at /
async function spider(router: Router, outDir: string, urlQueue = ['/']) {
  let outputDir = path.resolve(process.cwd(), outDir)
  console.log(`Clearing output directory: ${outputDir}`)
  await fs.rm(outputDir, { recursive: true, force: true })

  // Track URLs we have already downloaded to avoid loops
  let downloadedUrls = new Set<string>()

  while (urlQueue.length > 0) {
    await crawl(router, urlQueue, downloadedUrls, outputDir)
  }

  console.log(`\nCrawling complete!`)
}

async function crawl(
  router: Router,
  urlQueue: string[],
  downloadedUrls: Set<string>,
  outputDir: string,
): Promise<void> {
  let urlPath = urlQueue.shift()
  if (!urlPath || downloadedUrls.has(urlPath)) {
    return
  }

  // Always put `index.html` files into directories - this leads to the best
  // support with and without trailing slashes on github pages:
  // https://github.com/slorber/trailing-slash-guide?tab=readme-ov-file#summary
  let isResource = path.basename(urlPath).includes('.')
  let outputPath = isResource
    ? path.join(outputDir, urlPath)
    : path.join(outputDir, urlPath, 'index.html')

  console.log(
    `${isResource ? ` - Asset` : `Crawling`} ` +
      `${urlPath} -> ./${path.relative(process.cwd(), outputPath)}`,
  )

  let response = await router.fetch(new Request(`http://localhost${urlPath}`))
  if (!response.ok) {
    throw new Error(`Error fetching ${urlPath}: ${response.status} ${response.statusText}`)
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true })

  if (isResource) {
    let content = await response.arrayBuffer()
    await fs.writeFile(outputPath, new Uint8Array(content))
  } else {
    let html = await response.text()
    await fs.writeFile(outputPath, html, 'utf-8')

    // Parse HTML files for other resources/links to add to queue
    urlQueue.push(
      ...parse(html)
        .querySelectorAll('a,link')
        .map((link) => link.getAttribute('href'))
        .filter((href) => href && !isAbsoluteUrl(href) && !downloadedUrls.has(href))
        .map((href) => resolveRelativeLink(href!, urlPath)),
    )
  }

  downloadedUrls.add(urlPath)
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
