import * as fs from 'node:fs'
import * as http from 'node:http'
import * as path from 'node:path'
import { createRequestListener } from '@remix-run/node-fetch-server'
import { createRouter, route } from '@remix-run/fetch-router'
import { createHtmlResponse } from '@remix-run/response/html'
import { staticFiles } from '@remix-run/static-middleware'
import { html } from '@remix-run/html-template'
import * as frontmatter from 'front-matter'
import { marked } from 'marked'

let DOCS_DIR = path.resolve(process.cwd(), 'docs/api')

interface DocFile {
  path: string
  type: string
  name: string
  package: string
  urlPath: string
}

async function discoverMarkdownFiles(): Promise<DocFile[]> {
  let files: DocFile[] = []

  let packagesDir = path.resolve(process.cwd(), 'packages')
  let packageJsons = fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .map((d) => path.join(packagesDir, d.name, 'package.json'))
  let pkgMap: Record<string, string> = {}
  await Promise.all(
    packageJsons.map(async (pkgPath) => {
      let { name } = JSON.parse(await fs.promises.readFile(pkgPath, 'utf-8'))
      let urlName = name.replace(/^@remix-run\//, '').replace(/\//g, '-')
      pkgMap[urlName] = name
    }),
  )

  function walk(dir: string) {
    let entries = fs.readdirSync(dir, { withFileTypes: true })

    for (let entry of entries) {
      let fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        let relativePath = path.relative(DOCS_DIR, fullPath)
        let parts = relativePath.split(path.sep)
        let packageName = parts.slice(0, parts.length - 1).join('/')
        let urlPath = '/docs/' + relativePath.replace(/\.md$/, '').replace(/\\/g, '/')

        let markdown = fs.readFileSync(fullPath, 'utf-8')
        // @ts-expect-error No types
        let { attributes } = frontmatter.default(markdown)

        files.push({
          path: fullPath,
          type: attributes.type || 'unknown',
          name: entry.name.replace(/\.md$/, ''),
          package: packageName,
          urlPath: urlPath,
        })
      }
    }
  }

  walk(DOCS_DIR)
  return files.sort((a, b) => a.urlPath.localeCompare(b.urlPath))
}

let docFiles = await discoverMarkdownFiles()

function buildNavigation(currentPath: string): string {
  let packageGroups = new Map<string, DocFile[]>()

  for (let file of docFiles) {
    if (!packageGroups.has(file.package)) {
      packageGroups.set(file.package, [])
    }
    packageGroups.get(file.package)!.push(file)
  }

  let navItems: string[] = []

  let comparator = (a, b) => {
    // remix above remix/*
    if (a[0] === 'remix' && b[0].startsWith('remix/')) return -1
    if (b[0] === 'remix' && a[0].startsWith('remix/')) return 1
    // remix/* alphabetical
    if (a[0].startsWith('remix/') && b[0].startsWith('remix/')) return a[0].localeCompare(b[0])
    // remix and remix/* above all others
    if (a[0] === 'remix' || a[0].startsWith('remix/')) return -1
    if (b[0] === 'remix' || b[0].startsWith('remix/')) return 1
    // Everything else alphabetical
    return a[0].localeCompare(b[0])
  }
  let sortedNavItems = Array.from(packageGroups.entries()).sort(comparator)

  for (let [packageName, files] of sortedNavItems) {
    let fileLinks = files
      .map((file) => {
        let isActive = currentPath === file.urlPath
        return `
          <li>
            <a href="${file.urlPath}" class="${isActive ? 'active' : ''}">
              ${file.name} (${file.type})
            </a>
          </li>
        `
      })
      .join('')

    navItems.push(`
      <div class="package-group">
        <div class="package-name">${packageName}</div>
        <ul>
          ${fileLinks}
        </ul>
      </div>
    `)
  }

  return navItems.join('')
}

function createLayout(content: string, currentPath: string): string {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Remix API Documentation</title>
        <link href="/docs.css" rel="stylesheet" />
      </head>
      <body>
        <div class="container">
          <nav class="sidebar">
            <h1>Remix API Docs</h1>
            ${buildNavigation(currentPath)}
          </nav>
          <main class="main-content">
            <div class="content">${content}</div>
          </main>
        </div>
      </body>
    </html>
  `
}

function renderMarkdownFile(filePath: string): string {
  try {
    let markdown = fs.readFileSync(filePath, 'utf-8')

    // Remove frontmatter if present
    markdown = markdown.replace(/^---\n[\s\S]*?\n---\n/, '')

    let htmlContent = marked.parse(markdown)
    return htmlContent
  } catch (error) {
    return html`
      <div class="error">
        <h2>Error loading file</h2>
        <p>Could not read file: ${filePath}</p>
      </div>
    `
  }
}

let routes = route({
  docs: '/docs/*',
  home: '/',
})

let router = createRouter({
  middleware: [staticFiles(path.resolve(process.cwd(), 'docs/public'))],
})

router.get(routes.home, () => {
  let content = html`
    <div class="home-message">
      <h1>Welcome to Remix API Documentation</h1>
      <p>Select a document from the sidebar to get started.</p>
    </div>
  `
  return createHtmlResponse(createLayout(content, '/'))
})

router.get(routes.docs, ({ url }) => {
  let pathname = url.pathname

  // Find the matching doc file
  let docFile = docFiles.find((file) => file.urlPath === pathname)

  if (!docFile) {
    let content = html`
      <div class="error">
        <h2>404 - Not Found</h2>
        <p>The requested document was not found.</p>
        <p>Path: ${pathname}</p>
      </div>
    `
    return createHtmlResponse(createLayout(content, pathname), { status: 404 })
  }

  let htmlContent = renderMarkdownFile(docFile.path)
  return createHtmlResponse(createLayout(htmlContent, pathname))
})

let server = http.createServer(
  createRequestListener(async (request) => {
    try {
      return await router.fetch(request)
    } catch (error) {
      console.error(error)
      return new Response('Internal Server Error', { status: 500 })
    }
  }),
)

let port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000

server.listen(port, () => {
  console.log(`Remix API docs server running on http://localhost:${port}`)
})

let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  server.close(() => {
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
