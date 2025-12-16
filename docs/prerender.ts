import * as fs from 'node:fs'
import * as path from 'node:path'
import router from './router.ts'

// TODO: Don't use a regex to parse out links - probably want a DOM parser

let visited = new Set<string>()
let outputDir = path.resolve(process.cwd(), 'docs/public')

// Start crawling from the root
await crawlPage('/')

console.log(`\nCrawling complete! Visited ${visited.size} pages.`)

async function crawlPage(urlPath: string): Promise<void> {
  if (visited.has(urlPath)) {
    return
  }

  visited.add(urlPath)
  console.log(`Crawling: ${urlPath}`)

  try {
    let response = await router.fetch(new Request(`http://localhost${urlPath}`))
    let html = await response.text()

    // Determine the file path
    let filePath: string
    if (urlPath === '/' || urlPath === '') {
      filePath = path.join(outputDir, 'index.html')
    } else if (urlPath.endsWith('/')) {
      filePath = path.join(outputDir, urlPath, 'index.html')
    } else {
      filePath = path.join(outputDir, `${urlPath}.html`)
    }

    // Create directory if needed
    let dir = path.dirname(filePath)
    await fs.promises.mkdir(dir, { recursive: true })

    // Write the HTML file
    await fs.promises.writeFile(filePath, html, 'utf-8')
    console.log(`  Saved: ${path.relative(process.cwd(), filePath)}`)

    // Extract and download link tag resources (CSS, etc.)
    let linkResources = extractLinkTags(html)
    for (let link of linkResources) {
      // Resolve relative links
      let resolvedLink: string
      if (link.startsWith('/')) {
        resolvedLink = link
      } else {
        // Handle relative paths like '../' or 'resource.css'
        let base = urlPath.endsWith('/') ? urlPath : path.dirname(urlPath)
        resolvedLink = path.posix.join(base, link)
      }

      await downloadResource(resolvedLink)
    }

    // Extract and crawl links
    let links = extractLinks(html)
    for (let link of links) {
      // Resolve relative links
      let resolvedLink: string
      if (link.startsWith('/')) {
        resolvedLink = link
      } else {
        // Handle relative paths like '../' or 'page'
        let base = urlPath.endsWith('/') ? urlPath : path.dirname(urlPath)
        resolvedLink = path.posix.join(base, link)
      }

      await crawlPage(resolvedLink)
    }
  } catch (error) {
    console.error(`  Error crawling ${urlPath}:`, error)
  }
}

function extractLinks(html: string): string[] {
  let links: string[] = []
  let regex = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi
  let match: RegExpExecArray | null

  while ((match = regex.exec(html)) !== null) {
    let href = match[2]
    // Only include relative links (not absolute URLs)
    if (!isAbsoluteUrl(href)) {
      // Remove hash fragments
      let cleanHref = href.split('#')[0]
      if (cleanHref && cleanHref !== '') {
        links.push(cleanHref)
      }
    }
  }

  return [...new Set(links)]
}

function extractLinkTags(html: string): string[] {
  let links: string[] = []
  let regex = /<link\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi
  let match: RegExpExecArray | null

  while ((match = regex.exec(html)) !== null) {
    let href = match[2]
    // Only include relative links (not absolute URLs)
    if (!isAbsoluteUrl(href)) {
      // Remove hash fragments and query strings for deduplication
      let cleanHref = href.split('#')[0].split('?')[0]
      if (cleanHref && cleanHref !== '') {
        links.push(href) // Keep original href with query params
      }
    }
  }

  return [...new Set(links)]
}

function isAbsoluteUrl(href: string): boolean {
  return href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')
}

async function downloadResource(urlPath: string): Promise<void> {
  if (visited.has(urlPath)) {
    return
  }

  visited.add(urlPath)
  console.log(`Downloading: ${urlPath}`)

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
    console.log(`  Saved: ${path.relative(process.cwd(), filePath)}`)
  } catch (error) {
    console.error(`  Error downloading ${urlPath}:`, error)
  }
}
