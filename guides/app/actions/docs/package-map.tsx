import { css } from 'remix/ui'
import type { Handle } from 'remix/ui'

import type { AppContext } from '../../router.ts'
import { DocsDocument } from './layout.tsx'

type Link = {
  label: string
  href: string
}

type PackageGroup = {
  title: string
  summary: string
  guides: Link[]
  packages: Link[]
}

const packageGroups: PackageGroup[] = [
  {
    title: 'App structure and request runtime',
    summary:
      'Define URLs, match requests, run controllers, and adapt servers to the Web fetch handler.',
    guides: [
      guide('Routing and Controllers', 'routing-and-controllers'),
      guide('Request Handling', 'request-handling'),
    ],
    packages: [
      pkg('remix/routes'),
      pkg('remix/router'),
      pkg('remix/node-fetch-server'),
      pkg('remix/route-pattern'),
      pkg('remix/fetch-proxy'),
    ],
  },
  {
    title: 'Middleware',
    summary:
      'Compose request lifecycle behavior around the router: rendering, static files, form data, and context.',
    guides: [guide('Request Handling', 'request-handling')],
    packages: [
      pkg('remix/middleware/render'),
      pkg('remix/middleware/static'),
      pkg('remix/middleware/form-data'),
      pkg('remix/middleware/compression'),
      pkg('remix/middleware/logger'),
      pkg('remix/middleware/method-override'),
      pkg('remix/middleware/async-context'),
    ],
  },
  {
    title: 'HTTP primitives',
    summary:
      'Read and build headers, cookies, sessions, redirects, and responses as Web API values.',
    guides: [guide('Routing and Controllers', 'routing-and-controllers')],
    packages: [
      pkg('remix/headers'),
      pkg('remix/cookie'),
      pkg('remix/session'),
      pkg('remix/response/redirect'),
      pkg('remix/response/html'),
      pkg('remix/response/file'),
      pkg('remix/mime'),
    ],
  },
  {
    title: 'Data and validation',
    summary: 'Validate trust boundaries, model relational tables, query data, and run migrations.',
    guides: [guide('Data and Validation', 'data-and-validation')],
    packages: [
      pkg('remix/data-schema'),
      pkg('remix/data-schema/form-data'),
      pkg('remix/data-schema/coerce'),
      pkg('remix/data-table'),
      pkg('remix/data-table/migrations'),
      pkg('remix/data-table/sqlite'),
      pkg('remix/data-table/postgres'),
      pkg('remix/data-table/mysql'),
    ],
  },
  {
    title: 'Auth, sessions, and security',
    summary:
      'Represent identity, protect routes, store per-browser state, and defend mutation paths.',
    guides: [guide('Auth, Sessions, and Security', 'auth-sessions-security')],
    packages: [
      pkg('remix/auth'),
      pkg('remix/middleware/auth'),
      pkg('remix/middleware/session'),
      pkg('remix/session-storage/redis'),
      pkg('remix/session-storage/memcache'),
      pkg('remix/middleware/csrf'),
      pkg('remix/middleware/cors'),
      pkg('remix/middleware/cop'),
    ],
  },
  {
    title: 'Files, uploads, and assets',
    summary:
      'Serve static files, compile browser modules, parse multipart uploads, and stream downloads.',
    guides: [guide('Files and Assets', 'files-and-assets')],
    packages: [
      pkg('remix/assets'),
      pkg('remix/form-data-parser'),
      pkg('remix/multipart-parser'),
      pkg('remix/file-storage'),
      pkg('remix/file-storage/fs'),
      pkg('remix/file-storage/s3'),
      pkg('remix/lazy-file'),
      pkg('remix/tar-parser'),
    ],
  },
  {
    title: 'UI and browser behavior',
    summary:
      'Render on the server, hydrate only what needs it, style native controls, and animate state.',
    guides: [
      guide('Rendering UI', 'rendering-ui'),
      guide('Interactivity', 'interactivity'),
      guide('Animation', 'animation'),
    ],
    packages: [
      pkg('remix/ui'),
      pkg('remix/ui/server'),
      pkg('remix/ui/animation'),
      pkg('remix/ui/button'),
      pkg('remix/ui/popover'),
      pkg('remix/ui/menu'),
      pkg('remix/ui/select'),
    ],
  },
  {
    title: 'Tooling and tests',
    summary: 'Create and inspect apps, run TypeScript in Node, and test routers and components.',
    guides: [guide('Testing', 'testing'), guide('CLI and Tooling', 'cli-and-tooling')],
    packages: [
      pkg('remix/cli'),
      pkg('remix/test'),
      pkg('remix/assert'),
      pkg('remix/node-tsx'),
      pkg('remix/terminal'),
    ],
  },
]

export async function packageMapHandler(context: AppContext) {
  return context.render(<PackageMapPage />)
}

function PackageMapPage() {
  return () => (
    <DocsDocument
      title="Package map"
      description="How Remix packages map to layers, guide chapters, and API reference."
    >
      <div mix={pageStyles}>
        <div class="rmx-page-body">
          <header mix={headerStyles}>
            <h1 class="rmx-page-title">Package map</h1>
            <p mix={ledeStyles}>
              Remix installs as one dependency and is used through focused subpath imports. Each
              group below maps a layer to the guide chapters that teach it and the packages that
              implement it. Two presentations of the same content follow.
            </p>
          </header>

          <section aria-labelledby="cards-heading" mix={sectionStyles}>
            <h2 id="cards-heading">Cards</h2>
            <PackageMapCards />
          </section>

          <section aria-labelledby="table-heading" mix={sectionStyles}>
            <h2 id="table-heading">Table</h2>
            <PackageMapTable />
          </section>
        </div>
      </div>
    </DocsDocument>
  )
}

function PackageMapCards() {
  return () => (
    <div mix={gridStyles}>
      {packageGroups.map((group) => (
        <PackageGroupCard key={group.title} group={group} />
      ))}
    </div>
  )
}

function PackageGroupCard(handle: Handle<{ group: PackageGroup }>) {
  return () => {
    let group = handle.props.group

    return (
      <article mix={cardStyles}>
        <h3 mix={cardTitleStyles}>{group.title}</h3>
        <p mix={cardSummaryStyles}>{group.summary}</p>

        <ul mix={packageListStyles}>
          {group.packages.map((pkgLink) => (
            <li key={pkgLink.label}>
              <a href={pkgLink.href} mix={packageLinkStyles}>
                {pkgLink.label}
              </a>
            </li>
          ))}
        </ul>

        <div mix={guideRowStyles}>
          <span mix={guideLabelStyles}>Guides</span>
          {group.guides.map((guideLink) => (
            <a href={guideLink.href} key={guideLink.href} mix={guideLinkStyles}>
              {guideLink.label}
            </a>
          ))}
        </div>
      </article>
    )
  }
}

function PackageMapTable() {
  return () => (
    <table>
      <thead>
        <tr>
          <th scope="col">Layer</th>
          <th scope="col">What it's for</th>
          <th scope="col">Guides</th>
          <th scope="col">Packages</th>
        </tr>
      </thead>
      <tbody>
        {packageGroups.map((group) => (
          <tr key={group.title}>
            <th scope="row" mix={rowHeaderStyles}>
              {group.title}
            </th>
            <td>{group.summary}</td>
            <td>
              <div mix={cellStackStyles}>
                {group.guides.map((guideLink) => (
                  <a href={guideLink.href} key={guideLink.href}>
                    {guideLink.label}
                  </a>
                ))}
              </div>
            </td>
            <td>
              <div mix={cellPackagesStyles}>
                {group.packages.map((pkgLink) => (
                  <a href={pkgLink.href} key={pkgLink.label} mix={packageLinkStyles}>
                    {pkgLink.label}
                  </a>
                ))}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function guide(label: string, slug: string): Link {
  return { label, href: `/docs/${slug}` }
}

function pkg(label: string, apiPath = label): Link {
  return { label, href: `https://api.remix.run/api/${apiPath}/` }
}

const pageStyles = css({
  width: '100%',
  maxWidth: '56rem',
  margin: 'calc(var(--rmx-space-xl) * 2) auto',
  padding: '0 var(--rmx-page-gutter)',
})

const headerStyles = css({
  maxWidth: 'var(--rmx-content-max-width)',
})

const ledeStyles = css({
  marginTop: 'var(--rmx-space-md)',
  color: 'var(--rmx-color-text-secondary)',
})

const sectionStyles = css({
  marginTop: 'calc(var(--rmx-space-xl) * 2)',
})

// Card presentation ------------------------------------------------------

const gridStyles = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 17rem), 1fr))',
  gap: 'var(--rmx-space-lg)',
})

const cardStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--rmx-space-md)',
  padding: 'var(--rmx-space-lg)',
  border: 'var(--rmx-space-px) solid var(--rmx-color-border-subtle)',
  borderRadius: 'var(--rmx-radius-lg)',
  background: 'var(--rmx-surface-lvl0)',
})

const cardTitleStyles = css({
  margin: '0',
  fontSize: 'var(--rmx-font-size-lg)',
  fontWeight: 'var(--rmx-font-weight-bold)',
  letterSpacing: 'var(--rmx-letter-spacing-tight)',
  lineHeight: 'var(--rmx-line-height-tight)',
})

const cardSummaryStyles = css({
  margin: '0',
  color: 'var(--rmx-color-text-secondary)',
  fontSize: 'var(--rmx-font-size-sm)',
  lineHeight: 'var(--rmx-line-height-normal)',
})

const packageListStyles = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--rmx-space-xs) var(--rmx-space-md)',
  margin: '0',
  padding: '0',
  listStyle: 'none',
})

// Link color and underline come from the global `a` rule in docs.css (unlayered,
// so it wins over css() mixins). Only set properties that rule leaves alone.
const packageLinkStyles = css({
  fontFamily: 'var(--rmx-font-family-mono)',
  fontSize: 'var(--rmx-font-size-xs)',
})

const guideRowStyles = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: 'var(--rmx-space-xs) var(--rmx-space-md)',
  marginTop: 'auto',
  paddingTop: 'var(--rmx-space-md)',
  borderTop: 'var(--rmx-space-px) solid var(--rmx-color-border-subtle)',
  fontSize: 'var(--rmx-font-size-sm)',
})

const guideLabelStyles = css({
  color: 'var(--rmx-color-text-muted)',
  fontFamily: 'var(--rmx-font-family-mono)',
  fontSize: 'var(--rmx-font-size-xs)',
  letterSpacing: 'var(--rmx-letter-spacing-meta)',
  textTransform: 'uppercase',
})

const guideLinkStyles = css({
  fontWeight: 'var(--rmx-font-weight-medium)',
})

// Table presentation -----------------------------------------------------

const rowHeaderStyles = css({
  fontWeight: 'var(--rmx-font-weight-semibold)',
  whiteSpace: 'nowrap',
})

const cellStackStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--rmx-space-xs)',
})

const cellPackagesStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--rmx-space-xs)',
})
