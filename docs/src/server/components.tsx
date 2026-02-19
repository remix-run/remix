import type { RemixNode } from 'remix/component/jsx-runtime'
import type { DocFile } from './markdown.ts'
import { routes } from './routes.ts'
import type { Handle } from 'remix/component'
import { LightDarkToggle } from '../client/light-dark-toggle.tsx'

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

export type ServerContext = {
  docFiles: DocFile[]
  versions: { version: string; crawl: boolean }[]
  activeVersion?: string
  slug?: string
}

export function ServerProvider(handle: Handle<ServerContext>, setup: ServerContext) {
  handle.context.set(setup)
  return ({ children }: { children: RemixNode | RemixNode[] }) => children
}

export function Document(handle: Handle) {
  let { activeVersion } = handle.context.get(ServerProvider)
  return ({ children }: { children: RemixNode | RemixNode[] }) => (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {activeVersion != null ? <meta name="robots" content="noindex"></meta> : null}
        <title>Remix API Documentation</title>
        <link
          href={routes.assets.href({ version: activeVersion, asset: 'docs.css' })}
          rel="stylesheet"
        />
        <script
          async
          type="module"
          src={routes.assets.href({ version: activeVersion, asset: 'entry.js' })}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}

export function Layout(handle: Handle) {
  return ({ children }: { children: RemixNode | RemixNode[] }) => (
    <div class="container">
      <nav class="sidebar">
        <LightDarkToggle />
        <VersionDropdown />
        <Nav />
      </nav>
      <main class="main-content">
        <div class="content">{children}</div>
      </main>
    </div>
  )
}

export function VersionDropdown(handle: Handle) {
  let { versions, activeVersion } = handle.context.get(ServerProvider)
  let latestVersion = versions[0]?.version

  // When we're displaying an active version, only include versions up until
  // that version in the nav
  let navVersions = versions
  if (activeVersion) {
    let idx = versions.findIndex((v) => v.version === activeVersion)
    if (idx >= 0) {
      navVersions = versions.slice(idx)
    }
  }

  return () => (
    <NavDropdown title="Version">
      <ul>
        {...navVersions.map((version, index) => (
          <VersionLink
            version={version}
            latest={versions.length === 0 || version.version === latestVersion}
          />
        ))}
      </ul>
    </NavDropdown>
  )
}

function VersionLink(handle: Handle) {
  let { activeVersion, slug } = handle.context.get(ServerProvider)
  return ({
    version,
    latest,
  }: {
    version: { version: string; crawl: boolean }
    latest: boolean
  }) => {
    let includeLatestLink = latest && !activeVersion
    return (
      <li>
        <a
          href={routes.home.href({
            version: !includeLatestLink ? version.version : undefined,
          })}
          style={{ display: latest ? 'inline-block' : undefined }}
          rel={!version.crawl ? 'nofollow' : undefined}
        >
          {version.version}
        </a>

        {includeLatestLink ? (
          <>
            {/* Indicate latest only on root (latest) sites */}
            <span>(latest)</span>
            {/* Include a hidden link so that we generate a versioned output for the latest version */}
            <a
              href={routes.home.href({ version: version.version })}
              style={{ display: 'none' }}
              rel={!version.crawl ? 'nofollow' : undefined}
            >
              {version.version}
            </a>
          </>
        ) : null}
      </li>
    )
  }
}

type ApiTypes = {
  type: DocFile[]
  interface: DocFile[]
  function: DocFile[]
  class: DocFile[]
}

export function Nav(handle: Handle) {
  let { docFiles } = handle.context.get(ServerProvider)
  return () => {
    let packageGroups = new Map<string, ApiTypes>()

    for (let file of docFiles) {
      if (!packageGroups.has(file.package)) {
        packageGroups.set(file.package, { type: [], interface: [], function: [], class: [] })
      }
      packageGroups.get(file.package)![file.type as keyof ApiTypes].push(file)
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
          <NavDropdownSection title="Types" files={files} type="type" />
          <NavDropdownSection title="Interfaces" files={files} type="interface" />
          <NavDropdownSection title="Classes" files={files} type="class" />
          <NavDropdownSection title="Functions" files={files} type="function" />
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

function NavDropdownSection(handle: Handle) {
  let { activeVersion: version } = handle.context.get(ServerProvider)
  return ({ title, files, type }: { title: string; files: ApiTypes; type: keyof ApiTypes }) => {
    if (files[type].length === 0) {
      return null
    }

    return (
      <>
        <p>{title}</p>
        {...files[type].map((file) => (
          <li>
            {/* TODO: Add back active formatting */}
            <a href={routes.docs.href({ version, slug: file.urlPath })}>{file.name}</a>
          </li>
        ))}
      </>
    )
  }
}
