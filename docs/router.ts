import * as path from 'node:path'
import { createRouter, route } from '@remix-run/fetch-router'
import { createHtmlResponse } from '@remix-run/response/html'
import { staticFiles } from '@remix-run/static-middleware'
import { html, SafeHtml } from '@remix-run/html-template'
import { discoverMarkdownFiles, DOCS_DIR, renderMarkdownFile, type DocFile } from './markdown.ts'

let docFiles = await discoverMarkdownFiles(DOCS_DIR)

function buildNavigation(currentPath: string): string {
  let packageGroups = new Map<string, DocFile[]>()

  for (let file of docFiles) {
    if (!packageGroups.has(file.package)) {
      packageGroups.set(file.package, [])
    }
    packageGroups.get(file.package)!.push(file)
  }

  let navItems: string[] = []

  let sortedNavItems = Array.from(packageGroups.entries()).sort((a, b) => {
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
  })

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

function createLayout(content: string | SafeHtml, currentPath: string): SafeHtml {
  return html`
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

router.get(routes.docs, async ({ url }) => {
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

  let htmlContent = await renderMarkdownFile(docFile.path)
  return createHtmlResponse(createLayout(htmlContent, pathname))
})

export default router
