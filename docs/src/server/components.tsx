import { type RemixNode } from 'remix/component/jsx-runtime'
import { type DocFile } from './markdown.ts'
import { routes } from './routes.ts'
import type { Handle } from 'remix/component'

export function Home() {
  return () => {
    return (
      <div class="home-message">
        <h1>Welcome to Remix API Documentation</h1>
        <p>Select a document from the sidebar to get started.</p>
      </div>
    )
  }
}

export function NotFound() {
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

export type AppContext = {
  docFiles: DocFile[]
  versions: { name: string; version?: string }[]
  slug?: string
  version?: string
}

export function App(handle: Handle<AppContext>, setup: AppContext) {
  handle.context.set(setup)
  return ({ children }: { children: RemixNode | RemixNode[] }) => <Layout>{children}</Layout>
}

export function Layout(handle: Handle) {
  let { version } = handle.context.get(App)
  return ({ children }: { children: RemixNode | RemixNode[] }) => (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Remix API Documentation</title>
        <link href={routes.assets.href({ version, asset: 'docs.css' })} rel="stylesheet" />
      </head>
      <body>
        <div class="container">
          <nav class="sidebar">
            <VersionDropdown />
            <Nav />
          </nav>
          <main class="main-content">
            <div class="content">{children}</div>
          </main>
        </div>
      </body>
    </html>
  )
}

export function VersionDropdown(handle: Handle) {
  let { versions } = handle.context.get(App)
  return () => (
    <NavDropdown title="Version">
      <ul>
        {...versions.map((version) => (
          <li>
            <a href={routes.home.href({ version: version.version })}>{version.name}</a>
          </li>
        ))}
      </ul>
    </NavDropdown>
  )
}

export function Nav(handle: Handle) {
  let { docFiles, version } = handle.context.get(App)
  return () => {
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
      <NavDropdown title={packageName}>
        <ul>
          {files.map((file) => (
            <li>
              {/* TODO: Add back active formatting */}
              <a href={routes.api.href({ version, slug: file.urlPath })}>{file.name}</a>
            </li>
          ))}
        </ul>
      </NavDropdown>
    ))
  }
}

function NavDropdown() {
  return ({ title, children }: { title: string; children: RemixNode | RemixNode[] }) => (
    <details>
      <summary>{title}</summary>
      {children}
    </details>
  )
}
