import * as path from 'node:path'

import type { ScriptEntry } from 'remix/assets'
import type { Handle, RemixNode } from 'remix/ui'
import { PagefindElements, shouldLoadPagefind } from 'remix-docs-shared/search'
import { CodeBlockCopyButtons } from 'remix-docs-shared/ui/code-block-copy'
import { DocsFooter } from 'remix-docs-shared/ui/docs-footer'
import { createDocsNavigationLinks, DocsHeader } from 'remix-docs-shared/ui/docs-header'
import { DocsSecondaryNavigation, DocsShell } from 'remix-docs-shared/ui/docs-shell'
import type { MarkdownHeading } from 'remix-docs-shared/markdown/types'
import { docsMarkdownContentCss } from 'remix-docs-shared/ui/markdown-content'
import { DocsTableOfContents } from 'remix-docs-shared/ui/table-of-contents'

import type { Versions } from '../data/docs.ts'
import type { DocsRegistry, NavGroup, PageDefinition } from '../data/registry.ts'
import { buildNotFoundPage, getDocPage, getHomePage, isPageActive } from '../data/registry.ts'
import { getAssetEntry } from '../middleware/asset-entry.ts'
import { routes, withVersion } from '../routes.ts'

const pagefindModulePath = path.resolve(
  import.meta.dirname,
  '../../build/site/assets/pagefind/pagefind-component-ui.js',
)

export function Document(
  handle: Handle<{
    versions: Versions
    activeVersion?: string
    slug?: string
    registry: DocsRegistry
    children?: RemixNode | RemixNode[]
    sourceUrl?: string
    headings?: MarkdownHeading[]
  }>,
) {
  return () => {
    let { registry, versions, activeVersion, slug, sourceUrl, headings, children } = handle.props
    let { scriptEntry, stylesheetHref, stylesheetPreloads } = getAssetEntry()
    let searchEnabled = shouldLoadPagefind(pagefindModulePath)
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
          scriptEntry={scriptEntry}
          stylesheetHref={stylesheetHref}
          stylesheetPreloads={stylesheetPreloads}
          searchEnabled={searchEnabled}
        />
        <body>
          <DocsShell
            header={
              <DocsHeader
                brandLabel="Remix API Documentation"
                navigationLinks={[...navigationLinks.values()]}
                compactSearch
                searchEnabled={searchEnabled}
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
            mobileNavigationLabel={page.title || page.navLabel}
            navigationName="API navigation"
            hasSecondaryNavigation={(headings?.length ?? 0) > 0}
            footer={<DocsFooter />}
          >
            <MainContent
              page={page}
              headings={headings}
              header={<PageHeader page={page} sourceUrl={sourceUrl} />}
            >
              {children}
            </MainContent>
          </DocsShell>
          {searchEnabled ? (
            <PagefindElements
              baseUrl={withVersion(routes.home.href(), activeVersion)}
              bundlePath={withVersion(routes.assets.href({ asset: 'pagefind/' }), activeVersion)}
            />
          ) : null}
        </body>
      </html>
    )
  }
}

function Head(
  handle: Handle<{
    page: PageDefinition
    activeVersion?: string
    scriptEntry: ScriptEntry
    stylesheetHref: string
    stylesheetPreloads: readonly string[]
    searchEnabled: boolean
  }>,
) {
  return () => {
    let { page, activeVersion, scriptEntry, stylesheetHref, stylesheetPreloads, searchEnabled } =
      handle.props
    let { href, importMap, preloads } = scriptEntry
    let shouldNofollow = page.docFile?.kind === 'package' || page.docFile?.kind === 'demo'

    return (
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {page.description ? <meta name="description" content={page.description} /> : null}
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any" />
        {stylesheetPreloads.map((href) => (
          <link key={href} rel="preload" href={href} as="style" />
        ))}
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
            href={withVersion(
              routes.api.markdown.href({ slug: page.docFile.urlPath }),
              activeVersion,
            )}
            title={`Markdown docs for ${page.docFile.name ?? page.title}`}
          />
        ) : null}
        {/* Keep styles after variable head content so frame diffs do not reload them. */}
        {searchEnabled ? (
          <link
            data-key="docs-pagefind-stylesheet"
            href={withVersion(
              routes.assets.href({ asset: 'pagefind/pagefind-component-ui.css' }),
              activeVersion,
            )}
            rel="stylesheet"
          />
        ) : null}
        <link data-key="docs-stylesheet" rel="stylesheet" href={stylesheetHref} />
        <script type="importmap">{JSON.stringify(importMap)}</script>
        {preloads.map((preloadHref) => (
          <link key={preloadHref} rel="modulepreload" href={preloadHref} />
        ))}
        <script data-key="docs-client-entry" type="module" src={href} />
        {searchEnabled ? (
          <script
            data-key="docs-pagefind-client-entry"
            src={withVersion(
              routes.assets.href({ asset: 'pagefind/pagefind-component-ui.js' }),
              activeVersion,
            )}
            type="module"
          />
        ) : null}
      </head>
    )
  }
}

function MainContent(
  handle: Handle<{
    page: PageDefinition
    headings?: MarkdownHeading[]
    header?: RemixNode
    children: RemixNode | RemixNode[]
  }>,
) {
  return () => {
    let headings = handle.props.headings ?? []
    let contentId = `${handle.id}-content`

    return (
      <div class="docs-layout" data-key={`api-page-${handle.props.page.path}`}>
        <article class="docs-article">
          <div
            id={contentId}
            class="api-page-content rmx-page-body"
            mix={[docsMarkdownContentCss, handle.props.page.css]}
          >
            {handle.props.header}
            {handle.props.children}
          </div>
          <CodeBlockCopyButtons rootId={contentId} />
        </article>
        {headings.length > 0 ? (
          <DocsSecondaryNavigation>
            <h2 class="docs-toc__heading">On this page</h2>
            <DocsTableOfContents headings={headings} />
          </DocsSecondaryNavigation>
        ) : null}
      </div>
    )
  }
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
              let href = withVersion(routes.home.href(), !latest ? version : undefined)

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
