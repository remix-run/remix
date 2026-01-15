import * as fs from 'node:fs'
import * as path from 'node:path'
import router from './router.ts'
import { parse } from 'node-html-parser'
import { discoverMarkdownFiles, DOCS_DIR } from './markdown.ts'

let mdFiles = await discoverMarkdownFiles(DOCS_DIR)
let initialUrls = ['/', ...mdFiles.map((file) => file.urlPath)]
let outputDir = path.resolve(process.cwd(), 'docs/public')
let downloaded = new Set()

for (let url of initialUrls) {
  await crawlPage(url)
}

console.log(`\nCrawling complete!`)

async function crawlPage(urlPath: string): Promise<void> {
  if (downloaded.has(urlPath)) {
    return
  }

  let outputPath: string
  if (urlPath === '/' || urlPath === '') {
    outputPath = path.join(outputDir, 'index.html')
  } else if (urlPath.endsWith('/')) {
    outputPath = path.join(outputDir, urlPath, 'index.html')
  } else {
    outputPath = path.join(outputDir, `${urlPath}.html`)
  }

  console.log(`Crawling: ${urlPath} -> ${path.relative(process.cwd(), outputPath)}`)

  try {
    let response = await router.fetch(new Request(`http://localhost${urlPath}`))
    let html = await response.text()

    // Create directory if needed
    let dir = path.dirname(outputPath)
    await fs.promises.mkdir(dir, { recursive: true })

    // Write the HTML file
    await fs.promises.writeFile(outputPath, html, 'utf-8')
    downloaded.add(urlPath)

    // Extract and download link tag resources (CSS, etc.)
    let resources = parse(html)
      .querySelectorAll('link')
      .map((link) => link.getAttribute('href'))
      .filter((href) => href && !isAbsoluteUrl(href) && !downloaded.has(href))
      .map((href) => resolveRelativeLink(href!, urlPath))

    for (let href of resources) {
      await downloadResource(href)
    }

    // Extract and crawl links
    let links = parse(html)
      .querySelectorAll('a')
      .map((link) => link.getAttribute('href'))
      .filter((href) => href && !isAbsoluteUrl(href) && !downloaded.has(href))
      .map((href) => resolveRelativeLink(href!, urlPath))

    for (let href of links) {
      await crawlPage(href)
    }
  } catch (error) {
    console.error(`  Error crawling ${urlPath}:`, error)
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

async function downloadResource(urlPath: string): Promise<void> {
  if (downloaded.has(urlPath)) {
    return
  }

  try {
    let response = await router.fetch(new Request(`http://localhost${urlPath}`))
    let content = await response.arrayBuffer()

    // Determine the file path
    let filePath = path.join(outputDir, urlPath)

    // Create directory if needed
    let dir = path.dirname(filePath)
    await fs.promises.mkdir(dir, { recursive: true })

    // Write the file
    await fs.promises.writeFile(filePath, new Uint8Array(content))
    console.log(`  Saved asset: ${path.relative(process.cwd(), filePath)}`)
    downloaded.add(urlPath)
  } catch (error) {
    console.error(`  Error downloading ${urlPath}:`, error)
  }
}
