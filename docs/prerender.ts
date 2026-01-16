import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import router from './router.tsx'
import { parse } from 'node-html-parser'
import { discoverMarkdownFiles, API_DOCS_DIR, DOCS_DIR } from './markdown.ts'
import { html } from '../packages/html-template/src/lib/safe-html.ts'

let outputDir = path.resolve(DOCS_DIR, 'site')
console.log(`Clearing output directory: ${outputDir}`)
await fs.rm(outputDir, { recursive: true, force: true })

// Queue of URLs to download
let queuedUrls = ['/']

// Track URLs we have already downloaded to avoid loops
let downloadedUrls = new Set<string>()

while (queuedUrls.length > 0) {
  await crawlPage(queuedUrls.shift()!)
}

console.log(`\nCrawling complete!`)

async function crawlPage(urlPath: string): Promise<void> {
  if (downloadedUrls.has(urlPath)) {
    return
  }

  // Always put `index.html` files into directories - this leads to the best
  // support with and without trailing slashes on github pages:
  // https://github.com/slorber/trailing-slash-guide?tab=readme-ov-file#summary
  let isResource = urlPath.split('/').pop()?.includes('.')
  let outputPath = isResource
    ? path.join(outputDir, urlPath)
    : path.join(outputDir, urlPath, 'index.html')

  console.log(`Crawling: ${urlPath} -> ${path.relative(process.cwd(), outputPath)}`)

  let response = await router.fetch(new Request(`http://localhost${urlPath}`))
  if (!response.ok) {
    throw new Error(`Error fetching ${urlPath}: ${response.status} ${response.statusText}`)
  }

  if (isResource) {
    let content = await response.arrayBuffer()
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, new Uint8Array(content))
  } else {
    let html = await response.text()
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, html, 'utf-8')

    // Parse HTML files for other resources/links to add to queue
    queuedUrls.push(
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

async function downloadResource(urlPath: string): Promise<void> {
  if (downloadedUrls.has(urlPath)) {
    return
  }

  try {
    let response = await router.fetch(new Request(`http://localhost${urlPath}`))
    let content = await response.arrayBuffer()

    // Determine the file path
    let filePath = path.join(outputDir, urlPath)

    // Create directory if needed
    let dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })

    // Write the file
    await fs.writeFile(filePath, new Uint8Array(content))
    console.log(`  Saved asset: ${path.relative(process.cwd(), filePath)}`)
    downloadedUrls.add(urlPath)
  } catch (error) {
    console.error(`  Error downloading ${urlPath}:`, error)
  }
}
