import type { RemixNode } from 'remix/component/jsx-runtime'
import type { DocFile } from './markdown.ts'
import { routes } from './routes.ts'
import type { Handle } from 'remix/component'

export function Home() {
  return () => {
    return (
      <div class="home">
        <h1>Remix API Documentation</h1>
        <p>Select a document from the sidebar to get started.</p>
      </div>
    )
  }
}

export function NotFound(handle: Handle<{ slug: string }>) {
  return () => {
    let { slug } = handle.props
    return (
      <div class="error">
        <h2>Not Found</h2>
        <p>The requested document was not found:</p>
        <p>{slug}</p>
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

export function ServerPage(
  handle: Handle<{ children?: RemixNode | RemixNode[] } & ServerContext, ServerContext>,
) {
  handle.context.set(handle.props)
  return () => (
    <Document>
      <Layout>{handle.props.children}</Layout>
    </Document>
  )
}

function Document(handle: Handle<{ children?: RemixNode | RemixNode[] }>) {
  let { activeVersion, slug } = handle.context.get(ServerPage)
  let apiName = slug?.split('/').slice(-1)[0]
  return () => (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {activeVersion != null ? (
          <>
            <meta name="robots" content="noindex,nofollow" />
            <meta name="googlebot" content="noindex,nofollow" />
          </>
        ) : null}

        <title>Remix API Documentation</title>
        {slug ? (
          <link
            rel="alternate"
            type="text/markdown"
            href={routes.markdown.href({ version: activeVersion, slug })}
            title={`Markdown docs for ${apiName}`}
          />
        ) : null}
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
      <body>{handle.props.children}</body>
    </html>
  )
}

function Layout(handle: Handle<{ children?: RemixNode | RemixNode[] }>) {
  return () => (
    <>
      <input class="nav-toggle" id="nav-toggle" type="checkbox" aria-hidden="true" tabIndex={-1} />
      <div class="mobile-header">
        <label class="nav-toggle-open" for="nav-toggle" aria-label="Open navigation menu">
          <span aria-hidden="true">☰</span>
          <span class="visually-hidden">Open navigation menu</span>
        </label>
      </div>
      <div class="container">
        <main class="main">
          <div class="content">{handle.props.children}</div>
        </main>
        <div class="sidebar">
          <header>
            <a href={routes.home.href({ version: undefined })} class="logo">
              <RemixLogoLight />
              <RemixLogoDark />
            </a>
            <div class="sidebar-actions">
              <label class="nav-toggle-close" for="nav-toggle" aria-label="Close navigation menu">
                <span aria-hidden="true">×</span>
                <span class="visually-hidden">Close navigation menu</span>
              </label>
            </div>
          </header>
          <nav>
            <VersionDropdown />
            <Nav />
          </nav>
        </div>
        <div id="nav-overlay" aria-hidden="true" />
      </div>
    </>
  )
}

export function VersionDropdown(handle: Handle) {
  let { versions, activeVersion, slug } = handle.context.get(ServerPage)

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
    <NavDropdown title="Version" open={activeVersion != null}>
      <ul>
        <li>
          {...navVersions.map((version) => {
            let latest =
              (versions.length === 0 || version.version === versions[0]?.version) && !activeVersion
            let active = !slug && version.version === activeVersion
            let href = routes.home.href({ version: !latest ? version.version : undefined })
            return (
              <>
                <a
                  href={href}
                  class={active ? 'active' : undefined}
                  rel={!latest && !version.crawl ? 'nofollow' : undefined}
                >
                  {version.version}
                </a>
                {latest ? <span> (latest)</span> : null}
                <br />
              </>
            )
          })}
        </li>
      </ul>
    </NavDropdown>
  )
}

type ApiTypes = {
  type: DocFile[]
  interface: DocFile[]
  function: DocFile[]
  class: DocFile[]
}

export function Nav(handle: Handle) {
  let { docFiles, slug } = handle.context.get(ServerPage)
  return () => {
    let packageGroups = new Map<string, ApiTypes>()
    let activePackage = undefined

    for (let file of docFiles) {
      if (!packageGroups.has(file.package)) {
        packageGroups.set(file.package, { type: [], interface: [], function: [], class: [] })
      }
      packageGroups.get(file.package)![file.type as keyof ApiTypes].push(file)
      if (file.urlPath === slug) {
        activePackage = file.package
      }
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
      <NavDropdown title={packageName} open={packageName === activePackage}>
        <NavDropdownSection title="Types" files={files} type="type" />
        <NavDropdownSection title="Interfaces" files={files} type="interface" />
        <NavDropdownSection title="Classes" files={files} type="class" />
        <NavDropdownSection title="Functions" files={files} type="function" />
      </NavDropdown>
    ))
  }
}

function NavDropdown(
  handle: Handle<{
    title: string
    open: boolean
    children?: RemixNode | RemixNode[]
  }>,
) {
  return () => (
    <details open={handle.props.open}>
      <summary>{handle.props.title}</summary>
      <div class="items">{handle.props.children}</div>
    </details>
  )
}

function NavDropdownSection(
  handle: Handle<{ title: string; files: ApiTypes; type: keyof ApiTypes }>,
) {
  let { activeVersion: version, slug } = handle.context.get(ServerPage)
  return () => {
    let { title, files, type } = handle.props
    if (files[type].length === 0) {
      return null
    }

    return (
      <>
        <ul>
          <li>{title}</li>
          <ul>
            {...files[type].map((file) => (
              <li>
                <a
                  href={routes.docs.href({ version, slug: file.urlPath })}
                  class={slug === file.urlPath ? 'active' : undefined}
                >
                  {file.name}
                </a>
              </li>
            ))}
          </ul>
        </ul>
      </>
    )
  }
}

export function MarkdownContent(handle: Handle<{ html: string }>) {
  return () => <div innerHTML={handle.props.html} />
}

function RemixLogoLight(handle: Handle) {
  let { activeVersion } = handle.context.get(ServerPage)
  return () => {
    return (
      <div class="light">
        <img
          src={routes.assets.href({
            version: activeVersion,
            asset: 'remix-wordmark-lightmode.svg',
          })}
          alt="Remix"
          style="width: 100%; height: 100%;"
        />
      </div>
    )
  }
}

function RemixLogoDark(handle: Handle) {
  let { activeVersion } = handle.context.get(ServerPage)
  return () => {
    return (
      <div class="dark">
        <img
          src={routes.assets.href({ version: activeVersion, asset: 'remix-wordmark-darkmode.svg' })}
          alt="Remix"
          style="width: 100%; height: 100%;"
        />
      </div>
    )
  }
}
