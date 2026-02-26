import type { RemixNode } from 'remix/component/jsx-runtime'
import type { DocFile } from './markdown.ts'
import { routes } from './routes.ts'
import type { Handle } from 'remix/component'
import { LightDarkToggle } from '../client/light-dark-toggle.tsx'

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

export function NotFound() {
  return ({ slug }: { slug: string }) => {
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

export function ServerPage(handle: Handle<ServerContext>, setup: ServerContext) {
  handle.context.set(setup)
  return ({ children }: { children: RemixNode | RemixNode[] }) => (
    <Document>
      <Layout>{children}</Layout>
    </Document>
  )
}

function Document(handle: Handle) {
  let { activeVersion } = handle.context.get(ServerPage)
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

function Layout() {
  return ({ children }: { children: RemixNode | RemixNode[] }) => (
    <>
      <input class="nav-toggle" id="nav-toggle" type="checkbox" aria-hidden="true" tabIndex={-1} />
      <div class="mobile-header">
        <label class="nav-toggle-open" for="nav-toggle" aria-label="Open navigation menu">
          <span aria-hidden="true">☰</span>
          <span class="visually-hidden">Open navigation menu</span>
        </label>
      </div>
      <div class="container">
        <div class="sidebar">
          <header>
            <a href={routes.home.href({ version: undefined })} class="logo">
              <RemixLogoLight />
              <RemixLogoDark />
            </a>
            <div class="sidebar-actions">
              <div class="toggle">
                <LightDarkToggle />
              </div>
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
        <main class="main">
          <div class="content">{children}</div>
        </main>
      </div>
    </>
  )
}

export function VersionDropdown(handle: Handle) {
  let { versions, activeVersion } = handle.context.get(ServerPage)
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
    <NavDropdown title="Version" open={activeVersion != null}>
      <ul>
        <li>
          {...navVersions.map((version) => (
            <VersionLink
              version={version}
              latest={versions.length === 0 || version.version === latestVersion}
            />
          ))}
        </li>
      </ul>
    </NavDropdown>
  )
}

function VersionLink(handle: Handle) {
  let { activeVersion, slug } = handle.context.get(ServerPage)
  return ({
    version,
    latest,
  }: {
    version: { version: string; crawl: boolean }
    latest: boolean
  }) => {
    let isRootDocsLink = latest && !activeVersion
    return (
      <>
        <a
          href={routes.home.href({
            version: !isRootDocsLink ? version.version : undefined,
          })}
          rel={!version.crawl ? 'nofollow' : undefined}
          class={!slug && version.version === activeVersion ? 'active' : undefined}
        >
          {version.version}
        </a>

        {/* Indicate latest only on root (latest) sites */}
        {isRootDocsLink ? <span> (latest)</span> : null}

        {/* Hidden link to allow crawling for the latest version */}
        {isRootDocsLink && version.crawl ? (
          <a href={routes.home.href({ version: version.version })} style={{ display: 'none' }}>
            {version.version}
          </a>
        ) : null}
      </>
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

function NavDropdown(handle: Handle) {
  return ({
    title,
    open,
    children,
  }: {
    title: string
    open: boolean
    children: RemixNode | RemixNode[]
  }) => (
    <details open={open}>
      <summary>{title}</summary>
      <div class="items">{children}</div>
    </details>
  )
}

function NavDropdownSection(handle: Handle) {
  let { activeVersion: version, slug } = handle.context.get(ServerPage)
  return ({ title, files, type }: { title: string; files: ApiTypes; type: keyof ApiTypes }) => {
    if (files[type].length === 0) {
      return null
    }

    return (
      <>
        <p>{title}</p>
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
      </>
    )
  }
}

export function MarkdownContent() {
  return ({ html }: { html: string }) => <div innerHTML={html} />
}

function RemixLogoLight() {
  return () => {
    return (
      <svg
        class="light"
        style="width: 100%; height:100%;"
        width="745"
        height="186"
        viewBox="0 0 745 186"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g clip-path="url(#clip0_3_131)">
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M151.744 141.947C153.387 163.214 153.387 173.183 153.387 184.065H104.558C104.558 181.694 104.6 179.526 104.642 177.327C104.774 170.492 104.912 163.365 103.813 148.971C102.361 127.899 93.3557 123.216 76.7978 123.216H62.1282H0V84.8755H79.1217C100.037 84.8755 110.494 78.4641 110.494 61.489C110.494 46.5626 100.037 37.5172 79.1217 37.5172H0V0H87.8364C135.186 0 158.716 22.5359 158.716 58.5348C158.716 85.4608 142.158 103.021 119.79 105.948C138.672 109.753 149.71 120.582 151.744 141.947Z"
            fill="#121212"
          />
          <path
            d="M0 184.065V155.483H51.6297C60.2536 155.483 62.1261 161.929 62.1261 165.772V184.065H0Z"
            fill="#121212"
          />
          <path
            d="M740.943 55.5244H692.548L670.523 86.4736L649.079 55.5244H597.206L643.862 119.467L593.148 185.745H641.544L667.336 150.416L693.127 185.745H745L693.996 117.423L740.943 55.5244Z"
            fill="#121212"
          />
          <path
            d="M436.111 77.1051C430.604 61.9225 418.723 51.4114 395.829 51.4114C376.413 51.4114 362.503 60.1706 355.548 74.4774V54.9151H308.602V185.135H355.548V121.193C355.548 101.631 361.054 88.7841 376.413 88.7841C390.613 88.7841 394.091 98.1272 394.091 115.938V185.135H441.037V121.193C441.037 101.631 446.253 88.7841 461.902 88.7841C476.102 88.7841 479.29 98.1272 479.29 115.938V185.135H526.236V103.383C526.236 76.2292 515.804 51.4114 480.159 51.4114C458.425 51.4114 443.066 62.5064 436.111 77.1051Z"
            fill="#121212"
          />
          <path
            d="M259.716 134.598C255.369 144.817 247.255 149.197 234.504 149.197C220.304 149.197 208.712 141.606 207.553 125.547H298.258V112.408C298.258 77.0796 275.365 47.2982 232.185 47.2982C191.904 47.2982 161.766 76.7876 161.766 117.956C161.766 159.416 191.325 184.526 232.765 184.526C266.961 184.526 290.724 167.883 297.389 138.102L259.716 134.598ZM208.133 102.773C209.871 90.5104 216.537 81.1672 231.606 81.1672C245.516 81.1672 253.05 91.0943 253.63 102.773H208.133Z"
            fill="#121212"
          />
          <path
            d="M541.592 55.7797V186H588.538V55.7797H541.592ZM541.302 43.5168H588.828V2.05647H541.302V43.5168Z"
            fill="#121212"
          />
        </g>
        <defs>
          <clipPath id="clip0_3_131">
            <rect width="745" height="186" fill="white" />
          </clipPath>
        </defs>
      </svg>
    )
  }
}

function RemixLogoDark() {
  return () => {
    return (
      <svg
        class="dark"
        style="width: 100%; height: 100%;"
        width="745"
        height="186"
        viewBox="0 0 745 186"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g clip-path="url(#clip0_3_140)">
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M151.379 140.512C153.018 161.564 153.018 171.433 153.018 182.204H104.306C104.306 179.858 104.348 177.712 104.39 175.535C104.522 168.769 104.66 161.714 103.564 147.466C102.115 126.606 93.1311 121.971 76.6131 121.971H61.9787H0V84.0178H78.9314C99.7963 84.0178 110.229 77.6712 110.229 60.8676C110.229 46.0921 99.7963 37.138 78.9314 37.138H0V0H87.6251C134.861 0 158.334 22.3082 158.334 57.9433C158.334 84.5972 141.816 101.98 119.502 104.877C138.338 108.644 149.35 119.363 151.379 140.512Z"
            fill="url(#paint0_linear_3_140)"
          />
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M151.379 140.512C153.018 161.564 153.018 171.433 153.018 182.204H104.306C104.306 179.858 104.348 177.712 104.39 175.535C104.522 168.769 104.66 161.714 103.564 147.466C102.115 126.606 93.1311 121.971 76.6131 121.971H61.9787H0V84.0178H78.9314C99.7963 84.0178 110.229 77.6712 110.229 60.8676C110.229 46.0921 99.7963 37.138 78.9314 37.138H0V0H87.6251C134.861 0 158.334 22.3082 158.334 57.9433C158.334 84.5972 141.816 101.98 119.502 104.877C138.338 108.644 149.35 119.363 151.379 140.512Z"
            fill="white"
          />
          <path
            d="M0 182.204V153.912H51.5056C60.1087 153.912 61.9767 160.292 61.9767 164.097V182.204H0Z"
            fill="url(#paint1_linear_3_140)"
          />
          <path
            d="M0 182.204V153.912H51.5056C60.1087 153.912 61.9767 160.292 61.9767 164.097V182.204H0Z"
            fill="white"
          />
          <path
            d="M0 182.207V153.914H51.5062C60.1094 153.914 61.9774 160.294 61.9774 164.099V182.207H0Z"
            fill="white"
          />
          <path
            d="M740.943 53.3079H692.548L670.523 84.0182L649.079 53.3079H597.206L643.862 116.757L593.148 182.523H641.544L667.335 147.467L693.127 182.523H745L693.996 114.728L740.943 53.3079Z"
            fill="white"
          />
          <path
            d="M259.716 136.458C255.369 146.598 247.255 150.944 234.504 150.944C220.304 150.944 208.713 143.411 207.553 127.477H298.259V114.439C298.259 79.3831 275.365 49.8317 232.186 49.8317C191.905 49.8317 161.766 79.0934 161.766 119.944C161.766 161.084 191.325 186 232.765 186C266.961 186 290.724 169.486 297.389 139.935L259.716 136.458ZM208.133 104.878C209.872 92.7102 216.537 83.4392 231.606 83.4392C245.516 83.4392 253.051 93.2897 253.631 104.878H208.133Z"
            fill="white"
          />
          <path
            d="M436.111 75.327C430.604 60.2616 418.723 49.8317 395.829 49.8317C376.413 49.8317 362.503 58.5233 355.548 72.7196V53.3083H308.602V182.523H355.548V119.075C355.548 99.6635 361.054 86.9158 376.413 86.9158C390.613 86.9158 394.091 96.1869 394.091 113.86V182.523H441.037V119.075C441.037 99.6635 446.253 86.9158 461.902 86.9158C476.102 86.9158 479.29 96.1869 479.29 113.86V182.523H526.236V101.402C526.236 74.4579 515.804 49.8317 480.159 49.8317C458.425 49.8317 443.066 60.841 436.111 75.327Z"
            fill="white"
          />
          <path
            d="M541.591 53.3085V182.524H588.538V53.3085H541.591ZM541.301 41.1402H588.827V0H541.301V41.1402Z"
            fill="white"
          />
        </g>
        <defs>
          <linearGradient
            id="paint0_linear_3_140"
            x1="79.1669"
            y1="0"
            x2="79.1669"
            y2="182.204"
            gradientUnits="userSpaceOnUse"
          >
            <stop stop-color="white" />
            <stop offset="1" stop-color="white" stop-opacity="0" />
          </linearGradient>
          <linearGradient
            id="paint1_linear_3_140"
            x1="30.9883"
            y1="153.912"
            x2="30.9883"
            y2="182.204"
            gradientUnits="userSpaceOnUse"
          >
            <stop stop-color="white" />
            <stop offset="1" stop-color="white" stop-opacity="0" />
          </linearGradient>
          <clipPath id="clip0_3_140">
            <rect width="745" height="186" fill="white" />
          </clipPath>
        </defs>
      </svg>
    )
  }
}
