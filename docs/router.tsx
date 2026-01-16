import * as path from 'node:path'
import { type Remix } from '@remix-run/dom'
import { renderToStream } from '@remix-run/dom/server'
import { createRouter, route } from '@remix-run/fetch-router'
import { createHtmlResponse } from '@remix-run/response/html'
import { staticFiles } from '@remix-run/static-middleware'
import {
  discoverMarkdownFiles,
  API_DOCS_DIR,
  renderMarkdownFile,
  type DocFile,
  DOCS_DIR,
} from './markdown.ts'

const docFiles = await discoverMarkdownFiles(API_DOCS_DIR)

const routes = route({
  home: '/',
  api: '/api/*path',
})

const router = createRouter({
  middleware: [staticFiles(path.resolve(DOCS_DIR, 'public'))],
})

const render = (node: Remix.RemixNode, init?: ResponseInit) =>
  createHtmlResponse(renderToStream(<Layout docFiles={docFiles}>{node}</Layout>), init)

router.map(routes, {
  home: () => render(<Home />),
  async api({ url, params }) {
    // Find the matching doc file
    let docFile = docFiles.find((file) => file.urlPath === params.path)

    if (!docFile) {
      return render(<NotFound url={url} />, { status: 404 })
    }

    return render(await renderMarkdownFile(docFile.path))
  },
})

function Home() {
  return () => {
    return (
      <div class="home-message">
        <h1>Welcome to Remix API Documentation</h1>
        <p>Select a document from the sidebar to get started.</p>
      </div>
    )
  }
}

function NotFound() {
  return ({ url }: { url: URL }) => {
    return (
      <div class="error">
        <h2>404 - Not Found</h2>
        <p>The requested document was not found.</p>
        <p>Path: {url.pathname}</p>
      </div>
    )
  }
}

export function Layout() {
  return ({ docFiles, children }: { docFiles: DocFile[]; children: Remix.RemixNode }) => (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Remix API Documentation</title>
        <link href="/docs.css" rel="stylesheet" />
      </head>
      <body>
        <div class="container">
          <nav class="sidebar">
            <h1>Remix API Docs</h1>
            <SideBarNav docFiles={docFiles} />
          </nav>
          <main class="main-content">
            <div class="content">{children}</div>
          </main>
        </div>
      </body>
    </html>
  )
}

export function SideBarNav() {
  return ({ docFiles }: { docFiles: DocFile[] }) => {
    let packageGroups = new Map<string, DocFile[]>()

    for (let file of docFiles) {
      if (!packageGroups.has(file.package)) {
        packageGroups.set(file.package, [])
      }
      packageGroups.get(file.package)!.push(file)
    }

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

    return sortedNavItems.map(([packageName, files]) => (
      <SideBarNavGroup packageName={packageName} files={files} />
    ))
  }
}

function SideBarNavGroup() {
  return ({ packageName, files }: { packageName: string; files: DocFile[] }) => (
    <div class="package-group">
      <div class="package-name">{packageName}</div>
      <ul>
        {files.map((file) => (
          <li>
            {/* TODO: Add back active formatting */}
            <a href={routes.api.href({ path: file.urlPath })}>{file.name}</a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default router
