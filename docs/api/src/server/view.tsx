import type { Handle, RemixNode } from 'remix/ui'
import { DocsFooter } from 'remix-docs-shared/ui/docs-footer'
import { createDocsNavigationLinks, DocsHeader } from 'remix-docs-shared/ui/docs-header'
import { DocsSecondaryNavigation, DocsShell } from 'remix-docs-shared/ui/docs-shell'
import { docsMarkdownContentCss } from 'remix-docs-shared/ui/markdown-content'

import type { DemoDocFile } from './demos.tsx'
import type { MarkdownHeading } from './markdown.ts'
import type { DocsRegistry, NavGroup, PageDefinition } from './registry.ts'
import { buildNotFoundPage, getDocPage, getHomePage, isPageActive } from './registry.ts'
import { routes } from './routes.ts'
import { TableOfContents } from './table-of-contents.tsx'

export type Versions = string[]

export function Document(
  handle: Handle<{
    versions: Versions
    activeVersion?: string
    slug?: string
    registry: DocsRegistry
    children?: RemixNode | RemixNode[]
    sourceUrl?: string
    headings?: MarkdownHeading[]
    entryHref: string
    entryPreloads: readonly string[]
    tableOfContentsEntryHref: string
  }>,
) {
  return () => {
    let {
      registry,
      versions,
      activeVersion,
      slug,
      sourceUrl,
      headings,
      children,
      entryHref,
      entryPreloads,
      tableOfContentsEntryHref,
    } = handle.props
    let page = slug
      ? (getDocPage(registry, slug) ?? buildNotFoundPage(slug, activeVersion))
      : getHomePage(registry)
    let navigationLinks = createDocsNavigationLinks()
    navigationLinks.set('api', {
      href: routes.home.href({ version: activeVersion }),
      label: 'API',
      current: 'page',
    })

    return (
      <html lang="en">
        <Head
          page={page}
          activeVersion={activeVersion}
          entryHref={entryHref}
          entryPreloads={entryPreloads}
        />
        <body>
          <DocsShell
            header={
              <DocsHeader
                brandLabel="Remix API Documentation"
                navigationLinks={[...navigationLinks.values()]}
                compactSearch
              />
            }
            navigation={
              <SidebarContent
                registry={registry}
                currentPath={page.path}
                versions={versions}
                activeVersion={activeVersion}
              />
            }
            navigationLabel="API reference"
            mobileNavigationLabel="Reference"
            navigationName="API navigation"
            hasSecondaryNavigation={(headings?.length ?? 0) > 0}
            footer={<DocsFooter />}
          >
            <MainContent
              page={page}
              headings={headings}
              tableOfContentsEntryHref={tableOfContentsEntryHref}
              header={<PageHeader page={page} sourceUrl={sourceUrl} />}
            >
              {children}
            </MainContent>
          </DocsShell>
          <pagefind-config
            base-url={routes.home.href({ version: activeVersion })}
            bundle-path={routes.assets.href({ version: activeVersion, asset: 'pagefind/' })}
          ></pagefind-config>
          <pagefind-modal data-key="pagefind-modal" rmx-preserve-dom reset-on-close />
        </body>
      </html>
    )
  }
}

function Head(
  handle: Handle<{
    page: PageDefinition
    activeVersion?: string
    entryHref: string
    entryPreloads: readonly string[]
  }>,
) {
  return () => {
    let { page, activeVersion, entryHref, entryPreloads } = handle.props
    let shouldNofollow = page.docFile?.kind === 'package' || page.docFile?.kind === 'demo'

    return (
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {page.description ? <meta name="description" content={page.description} /> : null}
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any" />
        {/* Keep Pagefind first so the docs theme can override its component defaults. */}
        <link
          href={routes.assets.href({
            version: activeVersion,
            asset: 'pagefind/pagefind-component-ui.css',
          })}
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/docs.css" />
        {activeVersion != null ? (
          <>
            <meta name="robots" content="noindex,nofollow" />
            <meta name="googlebot" content="noindex,nofollow" />
          </>
        ) : shouldNofollow ? (
          // Overview pages already link densely to pages in the sidebar, while
          // demo links are examples rather than docs routes.
          <meta name="robots" content="nofollow" />
        ) : null}
        <title>{`${page.title || 'Remix'} | Remix API Documentation`}</title>
        {page.docFile ? (
          <link
            rel="alternate"
            type="text/markdown"
            href={routes.markdown.href({ version: activeVersion, slug: page.docFile.urlPath })}
            title={`Markdown docs for ${page.docFile.name ?? page.title}`}
          />
        ) : null}
        {[
          ...new Set([
            ...entryPreloads,
            ...(page.docFile?.kind === 'demo' ? page.docFile.preloads : []),
          ]),
        ].map((href) => (
          <link key={href} rel="modulepreload" href={href} />
        ))}
        <script type="module" src={entryHref} />
        <script
          src={routes.assets.href({
            version: activeVersion,
            asset: 'pagefind/pagefind-component-ui.js',
          })}
          type="module"
        />
      </head>
    )
  }
}

function MainContent(
  handle: Handle<{
    page: PageDefinition
    headings?: MarkdownHeading[]
    tableOfContentsEntryHref: string
    header?: RemixNode
    children: RemixNode | RemixNode[]
  }>,
) {
  return () => {
    let headings = handle.props.headings ?? []

    return (
      <div class="docs-layout">
        <article class="docs-article">
          <div
            class="api-page-content rmx-page-body"
            mix={[docsMarkdownContentCss, handle.props.page.css]}
          >
            {handle.props.header}
            {handle.props.children}
          </div>
        </article>
        {headings.length > 0 ? (
          <DocsSecondaryNavigation>
            <h2 class="docs-toc__heading">On this page</h2>
            <TableOfContents
              headings={headings}
              behaviorEntryHref={handle.props.tableOfContentsEntryHref}
            />
          </DocsSecondaryNavigation>
        ) : null}
      </div>
    )
  }
}

export function Home() {
  return () => (
    <>
      <h1>Welcome to Remix 3!</h1>
      <p>
        Remix is a batteries-included, ultra-productive, zero-dependency, bundler-free framework,
        ready for development in a model-first world. Remix 3 is built on the following principles:
      </p>

      <ol>
        <li>
          <b>Model-First Development.</b> AI fundamentally shifts the human-computer interaction
          model for both user experience and developer workflows. Optimize the source code,
          documentation, tooling, and abstractions for LLMs. Additionally, develop abstractions for
          applications to use models in the product itself, not just as a tool to develop it.
        </li>
        <li>
          <b>Build on Web APIs.</b> Sharing abstractions across the stack greatly reduces the amount
          of context switching, both for humans and machines. Build on the foundation of Web APIs
          and JavaScript because it is the only full stack ecosystem.
        </li>
        <li>
          <b>Religiously Runtime.</b> Designing for bundlers/compilers/typegen (and any pre-runtime
          static analysis) leads to poor API design that eventually pollutes the entire system. All
          packages must be designed with no expectation of static analysis and all tests must run
          without bundling. Because browsers are involved, --import loaders for simple
          transformations like TypeScript and JSX are permissible.
        </li>
        <li>
          <b>Avoid Dependencies.</b> Dependencies lock you into somebody else's roadmap. Choose them
          wisely, wrap them completely, and expect to replace most of them with our own package
          eventually. The goal is zero.
        </li>
        <li>
          <b>Demand Composition.</b> Abstractions should be single-purpose and replaceable. A
          composable abstraction is easy to add and remove from an existing program. Every package
          must be useful and documented independent of any other context. New features should first
          be attempted as a new package. If impossible, attempt to break up the existing package to
          make it more composable. However, tightly coupled modules that almost always change
          together in both directions should be moved to the same package.
        </li>
        <li>
          <b>Distribute Cohesively.</b> Extremely composable ecosystems are difficult to learn and
          use. Remix will be distributed as a single remix package for both distribution and
          documentation.
        </li>
      </ol>
    </>
  )
}

export function MarkdownContent(handle: Handle<{ html: string }>) {
  return () => <div innerHTML={handle.props.html} />
}

export function DemoContent(
  handle: Handle<{
    demo: Pick<DemoDocFile, 'description' | 'name'>
    sourceHtml: string
    children: RemixNode
  }>,
) {
  return () => {
    let { demo, sourceHtml, children } = handle.props

    return (
      <div class="api-demo">
        <header class="api-demo__header">
          <h1>{demo.name}</h1>
          <p>{demo.description}</p>
        </header>

        <div class="api-demo__frame">
          <div class="api-demo__preview">{children}</div>
          <div class="api-demo__source" innerHTML={sourceHtml} />
        </div>
      </div>
    )
  }
}

export function NotFound(handle: Handle<{ slug: string }>) {
  return () => (
    <div class="error">
      <p>Could not find a document at:</p>
      <p>
        <code>{handle.props.slug}</code>
      </p>
    </div>
  )
}

function SidebarContent(
  handle: Handle<{
    registry: DocsRegistry
    currentPath: string
    versions: Versions
    activeVersion?: string
  }>,
) {
  return () => {
    let { registry, currentPath, versions, activeVersion } = handle.props
    let activePage = Object.values(registry.pages).find((page) => page.path === currentPath)
    let openSections = activePage?.docFile ? [activePage.sectionId] : []

    return (
      <div class="api-nav-sections">
        <VersionSwitcher versions={versions} activeVersion={activeVersion} />
        {registry.sections.map((section) => (
          <details
            key={section.id}
            class="api-nav-section"
            open={openSections.includes(section.id) || undefined}
          >
            <summary>{section.label}</summary>
            <div class="api-nav-content">
              {section.groups.map((group) => (
                <SidebarGroup
                  key={group.id}
                  registry={registry}
                  group={group}
                  currentPath={currentPath}
                  sectionLabel={section.label}
                />
              ))}
            </div>
          </details>
        ))}
      </div>
    )
  }
}

function SidebarGroup(
  handle: Handle<{
    registry: DocsRegistry
    group: NavGroup
    currentPath: string
    sectionLabel: string
  }>,
) {
  return () => {
    let { registry, group, currentPath, sectionLabel } = handle.props

    return (
      <div class="api-nav-group">
        {group.label ? <p class="api-nav-group__heading">{group.label}</p> : null}
        <nav
          class="api-nav-links"
          aria-label={group.label ? `${sectionLabel} ${group.label}` : `${sectionLabel} pages`}
        >
          {group.pageIds.map((pageId) => {
            let page = registry.pages[pageId]
            let active = isPageActive(page, currentPath)

            return (
              <a
                key={page.path}
                href={page.path}
                aria-current={active ? 'page' : undefined}
                data-active-doc={active ? 'true' : undefined}
              >
                {page.navLabel}
              </a>
            )
          })}
        </nav>
      </div>
    )
  }
}

function VersionSwitcher(handle: Handle<{ versions: Versions; activeVersion?: string }>) {
  return () => {
    let { versions, activeVersion } = handle.props
    let navVersions = versions

    if (activeVersion) {
      let index = versions.findIndex((version) => version === activeVersion)
      if (index >= 0) navVersions = versions.slice(index)
    }

    return (
      <details class="api-nav-section" open={activeVersion != null || undefined}>
        <summary>Version</summary>
        <div class="api-nav-content">
          <nav class="api-nav-links" aria-label="Versions">
            {navVersions.map((version) => {
              let latest = (versions.length === 0 || version === versions[0]) && !activeVersion
              let active = version === activeVersion || latest
              let href = routes.home.href({ version: !latest ? version : undefined })

              return (
                <a
                  key={version}
                  href={href}
                  rel={active ? undefined : 'nofollow'}
                  aria-current={active ? 'page' : undefined}
                >
                  {version}
                  {latest ? ' (latest)' : null}
                </a>
              )
            })}
          </nav>
        </div>
      </details>
    )
  }
}

function PageHeader(handle: Handle<{ page: PageDefinition; sourceUrl?: string }>) {
  return () => {
    let { page, sourceUrl } = handle.props
    let showTitle = !page.docFile && page.title.length > 0

    if (!page.eyebrow && !showTitle && !page.description) return null

    return (
      <header class="api-page-header">
        {page.eyebrow || sourceUrl ? (
          <div class="api-page-meta">
            {page.eyebrow ? <p class="docs-chapter-eyebrow">{page.eyebrow}</p> : <span />}
            {sourceUrl ? (
              <a class="api-page-source" href={sourceUrl} target="_blank" rel="noopener">
                View Source
              </a>
            ) : null}
          </div>
        ) : null}
        {showTitle ? <h1 class="rmx-page-title">{page.title}</h1> : null}
        {page.description ? <p class="api-page-description">{page.description}</p> : null}
      </header>
    )
  }
}
