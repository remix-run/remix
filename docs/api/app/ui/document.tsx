import * as path from 'node:path'

import type { ScriptEntry } from 'remix/assets'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import { PagefindElements, shouldLoadPagefind } from 'remix-docs-shared/search'
import { CodeBlockCopyButtons } from 'remix-docs-shared/ui/code-block-copy'
import { DocsFooter } from 'remix-docs-shared/ui/docs-footer'
import { createDocsNavigationLinks, DocsHeader } from 'remix-docs-shared/ui/docs-header'
import { DocsSecondaryNavigation, DocsShell } from 'remix-docs-shared/ui/docs-shell'
import type { MarkdownHeading } from 'remix-docs-shared/markdown/types'
import { Icon } from 'remix-docs-shared/ui/icon'
import { docsMarkdownContentCss } from 'remix-docs-shared/ui/markdown-content'
import { DocsTableOfContents } from 'remix-docs-shared/ui/table-of-contents'

import type { DocsRegistry, NavItemKind, NavPackage, PageDefinition } from '../data/registry.ts'
import {
  buildNotFoundPage,
  getDocPage,
  getHomePage,
  getNavPackage,
  isPageActive,
} from '../data/registry.ts'
import { getAssetEntry } from '../middleware/asset-entry.ts'
import { routes, withVersion } from '../routes.ts'

const pagefindModulePath = path.resolve(
  import.meta.dirname,
  '../../build/site/assets/pagefind/pagefind-component-ui.js',
)

export function Document(
  handle: Handle<{
    activeVersion?: string
    slug?: string
    registry: DocsRegistry
    children?: RemixNode | RemixNode[]
    sourceUrl?: string
    headings?: MarkdownHeading[]
  }>,
) {
  return () => {
    let { registry, activeVersion, slug, sourceUrl, headings, children } = handle.props
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
            navigation={<SidebarContent registry={registry} page={page} />}
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
        {page.description ? (
          <meta data-rmx-key="docs-description" name="description" content={page.description} />
        ) : null}
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any" />
        {stylesheetPreloads.map((href) => (
          <link key={href} data-rmx-key={`preload:${href}`} rel="preload" href={href} as="style" />
        ))}
        {activeVersion != null ? (
          <>
            <meta data-rmx-key="docs-robots" name="robots" content="noindex,nofollow" />
            <meta data-rmx-key="docs-googlebot" name="googlebot" content="noindex,nofollow" />
          </>
        ) : shouldNofollow ? (
          // Overview pages already link densely to pages in the sidebar, while
          // demo links are examples rather than docs routes.
          <meta data-rmx-key="docs-robots" name="robots" content="nofollow" />
        ) : null}
        <title data-rmx-key="docs-title">{`${page.title || 'Remix'} | Remix API Documentation`}</title>
        {page.docFile ? (
          <link
            data-rmx-key="docs-markdown-alternate"
            rel="alternate"
            type="text/markdown"
            href={withVersion(
              routes.api.markdown.href({ slug: page.docFile.urlPath }),
              activeVersion,
            )}
            title={`Markdown docs for ${page.docFile.name ?? page.title}`}
          />
        ) : null}
        {/*
          Key every tag that varies between pages. The document diff pairs unkeyed tags by
          position, so an optional tag would shift the pairing and move (and briefly unload)
          the stylesheets below.
        */}
        {searchEnabled ? (
          <link
            data-rmx-key="docs-pagefind-stylesheet"
            href={withVersion(
              routes.assets.href({ asset: 'pagefind/pagefind-component-ui.css' }),
              activeVersion,
            )}
            rel="stylesheet"
          />
        ) : null}
        <link data-rmx-key="docs-stylesheet" rel="stylesheet" href={stylesheetHref} />
        <ImportMap value={importMap} />
        {preloads.map((preloadHref) => (
          <link
            key={preloadHref}
            data-rmx-key={`modulepreload:${preloadHref}`}
            rel="modulepreload"
            href={preloadHref}
          />
        ))}
        <script data-rmx-key="docs-client-entry" type="module" src={href} />
        {searchEnabled ? (
          <script
            data-rmx-key="docs-pagefind-client-entry"
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
      <div class="docs-layout" data-rmx-key={`api-page-${handle.props.page.path}`}>
        <article class="docs-article">
          <div id={contentId} class="api-page-content rmx-page-body" mix={docsMarkdownContentCss}>
            {handle.props.header}
            {handle.props.children}
          </div>
          <CodeBlockCopyButtons rootId={contentId} />
        </article>
        {headings.length > 0 ? (
          <DocsSecondaryNavigation>
            <h2 class="docs-nav-heading docs-toc__heading">On this page</h2>
            <DocsTableOfContents headings={headings} />
          </DocsSecondaryNavigation>
        ) : null}
      </div>
    )
  }
}

function SidebarContent(handle: Handle<{ registry: DocsRegistry; page: PageDefinition }>) {
  return () => {
    let { registry, page } = handle.props
    let homePage = getHomePage(registry)
    let navPackage = getNavPackage(registry, page.packageId)

    return (
      <div class="api-nav" data-api-nav-view={navPackage ? 'package' : 'root'}>
        <div class="api-nav-panel" data-api-nav-panel="root" inert={navPackage ? true : undefined}>
          <a
            class="docs-nav-item api-nav-row"
            href={homePage.path}
            aria-current={isPageActive(homePage, page.path) ? 'page' : undefined}
          >
            {homePage.navLabel}
          </a>
          <h2 class="docs-nav-heading api-nav-heading">Packages</h2>
          <ul class="api-nav-list">
            {registry.packages.map((item) => {
              let itemHome = registry.pages[item.homePageId]
              let current: 'page' | 'true' | undefined = isPageActive(itemHome, page.path)
                ? 'page'
                : item.id === navPackage?.id
                  ? 'true'
                  : undefined

              return (
                <li key={item.id}>
                  <a
                    class="docs-nav-item api-nav-row api-nav-package"
                    href={itemHome.path}
                    aria-current={current}
                  >
                    {item.label}
                    <Icon name="chevron-r" />
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
        <div
          class="api-nav-panel"
          data-api-nav-panel="package"
          inert={navPackage ? undefined : true}
        >
          {navPackage ? (
            <PackageMenu
              registry={registry}
              navPackage={navPackage}
              homePage={homePage}
              currentPath={page.path}
            />
          ) : null}
        </div>
      </div>
    )
  }
}

const kindLetters: Record<NavItemKind, string> = {
  function: 'F',
  class: 'C',
  interface: 'I',
  type: 'T',
  variable: 'V',
  mixin: 'M',
  demo: 'E',
}

function PackageMenu(
  handle: Handle<{
    registry: DocsRegistry
    navPackage: NavPackage
    homePage: PageDefinition
    currentPath: string
  }>,
) {
  return () => {
    let { registry, navPackage, homePage, currentPath } = handle.props
    // Groups like `middleware` have no root import path, so their index page heads the menu.
    let hasRoot = navPackage.subpackages.some((subpackage) => subpackage.label === navPackage.id)
    let sections = hasRoot
      ? navPackage.subpackages
      : [
          {
            id: registry.pages[navPackage.homePageId].title,
            label: navPackage.id,
            overviewPageId: navPackage.homePageId,
            pageIds: [],
          },
          ...navPackage.subpackages,
        ]

    return (
      <>
        <a class="docs-nav-item api-nav-row api-nav-back" href={homePage.path} data-api-nav-back>
          <Icon name="chevron-r" />
          All packages
        </a>
        <p class="docs-nav-heading api-nav-row api-nav-title">{navPackage.label}</p>
        {sections.map((subpackage) => (
          <section key={subpackage.id} class="api-nav-subpackage">
            {subpackage.label === navPackage.id ? null : (
              <p class="docs-nav-heading api-nav-row api-nav-subpackage__heading">
                <PathLabel label={subpackage.label} />
              </p>
            )}
            <ul class="api-nav-list" aria-label={subpackage.id}>
              {subpackage.overviewPageId ? (
                <NavLink page={registry.pages[subpackage.overviewPageId]} currentPath={currentPath}>
                  Overview
                </NavLink>
              ) : null}
              {subpackage.pageIds.map((pageId) => {
                let page = registry.pages[pageId]
                return (
                  <NavLink key={page.path} page={page} currentPath={currentPath}>
                    {page.kind ? (
                      <span class="api-nav-kind" data-kind={page.kind} aria-hidden="true">
                        {kindLetters[page.kind]}
                      </span>
                    ) : null}
                    <span class="api-nav-symbol__name">{page.navLabel}</span>
                  </NavLink>
                )
              })}
            </ul>
          </section>
        ))}
      </>
    )
  }
}

function NavLink(
  handle: Handle<{ page: PageDefinition; currentPath: string; children: RemixNode }>,
) {
  return () => {
    let { page, currentPath, children } = handle.props

    return (
      <li>
        <a
          class="docs-nav-item api-nav-row api-nav-symbol"
          href={page.path}
          aria-current={isPageActive(page, currentPath) ? 'page' : undefined}
        >
          {children}
        </a>
      </li>
    )
  }
}

// Long package paths wrap after a slash instead of at hyphens or mid-segment.
function PathLabel(handle: Handle<{ label: string }>) {
  return () => {
    let segments = handle.props.label.split('/')
    let last = segments.length - 1

    return (
      <span>
        {segments.flatMap((segment, index) =>
          index === last
            ? [
                <span key={`segment-${index}`} class="api-nav-path-segment">
                  {segment}
                </span>,
              ]
            : [
                <span key={`segment-${index}`} class="api-nav-path-segment">
                  {segment}/
                </span>,
                <wbr key={`break-${index}`} />,
              ],
        )}
      </span>
    )
  }
}

function PageHeader(handle: Handle<{ page: PageDefinition; sourceUrl?: string }>) {
  return () => {
    let { page, sourceUrl } = handle.props
    let showTitle = !page.docFile && page.title.length > 0

    if (!page.eyebrow && !showTitle && !page.description) return null

    return (
      <header class="docs-page-header api-page-header">
        {page.eyebrow || sourceUrl ? (
          <div class="api-page-meta">
            {page.eyebrow ? <p class="docs-page-eyebrow">{page.eyebrow}</p> : <span />}
            {sourceUrl ? (
              <a class="api-page-source" href={sourceUrl} target="_blank" rel="noopener">
                View Source
              </a>
            ) : null}
          </div>
        ) : null}
        {showTitle ? <h1 class="rmx-page-title">{page.title}</h1> : null}
        {page.description ? <p class="docs-page-description">{page.description}</p> : null}
      </header>
    )
  }
}
