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
import { DocsSocialMeta } from 'remix-docs-shared/ui/social-meta'
import { DocsTableOfContents } from 'remix-docs-shared/ui/table-of-contents'

import type { DocsRegistry, NavNode, NavSection, PageDefinition } from '../data/registry.ts'
import {
  buildNotFoundPage,
  getDocPage,
  getHomePage,
  getNavChain,
  HOME_PAGE_ID,
  isPageActive,
} from '../data/registry.ts'
import { ApiNav } from '../actions/public/api-nav.tsx'
import type { ApiNavPanel } from '../actions/public/api-nav.tsx'
import { getAssetEntry } from '../middleware/asset-entry.ts'
import { routes } from '../routes.ts'
import remixPackage from '../../../../packages/remix/package.json' with { type: 'json' }

const pagefindModulePath = path.resolve(
  import.meta.dirname,
  '../../build/site/_assets/pagefind/pagefind-component-ui.js',
)

export function Document(
  handle: Handle<{
    slug?: string
    registry: DocsRegistry
    children?: RemixNode | RemixNode[]
    sourceUrl?: string
    headings?: MarkdownHeading[]
  }>,
) {
  return () => {
    let { registry, slug, sourceUrl, headings, children } = handle.props
    let { scriptEntry, stylesheetHref, stylesheetPreloads } = getAssetEntry()
    let searchEnabled = shouldLoadPagefind(pagefindModulePath)
    let page = slug
      ? (getDocPage(registry, slug) ?? buildNotFoundPage(slug))
      : getHomePage(registry)
    let navigationLinks = createDocsNavigationLinks()
    navigationLinks.set('api', {
      href: routes.home.href(),
      label: 'Docs',
      current: 'page',
    })

    return (
      <html lang="en">
        <Head
          page={page}
          scriptEntry={scriptEntry}
          stylesheetHref={stylesheetHref}
          stylesheetPreloads={stylesheetPreloads}
          searchEnabled={searchEnabled}
        />
        <body>
          <DocsShell
            header={
              <DocsHeader
                brandLabel="Remix Docs"
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
              baseUrl={routes.home.href()}
              bundlePath={routes.assets.href({ asset: 'pagefind/' })}
            />
          ) : null}
        </body>
      </html>
    )
  }
}

const siteUrl = 'https://docs.remix.run'

// Most pages have no written description, so link previews describe what the page documents.
function getPageDescription(page: PageDefinition): string {
  if (page.description) return page.description
  if (page.id === HOME_PAGE_ID) {
    return 'API reference for Remix, a full-stack TypeScript framework for building web applications on web standards.'
  }
  let { docFile } = page
  if (!docFile) return `API reference for ${page.title}.`
  if (docFile.kind === 'demo') return docFile.description
  if (docFile.kind === 'api') return `API reference for ${page.navLabel} from ${docFile.package}.`
  return `API reference for ${docFile.package}.`
}

function Head(
  handle: Handle<{
    page: PageDefinition
    scriptEntry: ScriptEntry
    stylesheetHref: string
    stylesheetPreloads: readonly string[]
    searchEnabled: boolean
  }>,
) {
  return () => {
    let { page, scriptEntry, stylesheetHref, stylesheetPreloads, searchEnabled } = handle.props
    let { href, importMap, preloads } = scriptEntry
    let shouldNofollow = page.docFile?.kind === 'package' || page.docFile?.kind === 'demo'
    let title = `${page.title || 'Remix'} | Remix Docs`
    let description = getPageDescription(page)

    return (
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta data-rmx-key="docs-description" name="description" content={description} />
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any" />
        {stylesheetPreloads.map((href) => (
          <link key={href} data-rmx-key={`preload:${href}`} rel="preload" href={href} as="style" />
        ))}
        {shouldNofollow ? (
          // Overview pages already link densely to pages in the sidebar, while
          // demo links are examples rather than docs routes.
          <meta data-rmx-key="docs-robots" name="robots" content="nofollow" />
        ) : null}
        <title data-rmx-key="docs-title">{title}</title>
        <DocsSocialMeta
          siteName="Remix Docs"
          url={`${siteUrl}${page.path}`}
          title={title}
          description={description}
          image={`${siteUrl}/social/docs.png`}
          imageAlt="Remix Docs"
        />
        {page.docFile ? (
          <link
            data-rmx-key="docs-markdown-alternate"
            rel="alternate"
            type="text/markdown"
            href={routes.api.markdown.href({ slug: page.docFile.urlPath })}
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
            href={routes.assets.href({ asset: 'pagefind/pagefind-component-ui.css' })}
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
            src={routes.assets.href({ asset: 'pagefind/pagefind-component-ui.js' })}
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
          <div id={contentId} class="api-page-content rmx-page-body docs-markdown">
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

const navSections: NavSection[] = ['Examples', 'API', 'Types']

function SidebarContent(handle: Handle<{ registry: DocsRegistry; page: PageDefinition }>) {
  return () => {
    let { registry, page } = handle.props
    let homePage = getHomePage(registry)
    // One panel per menu from the package list down to this page's import path.
    let chain = getNavChain(registry, page.navId)

    // Client entry props are serialized, and fragments don't survive that, so each panel's
    // content is a flat array of keyed elements.
    let panels: ApiNavPanel[] = [
      {
        id: 'root',
        content: [
          <a
            key="home"
            class="docs-nav-item api-nav-row"
            href={homePage.path}
            aria-current={isPageActive(homePage, page.path) ? 'page' : undefined}
          >
            {homePage.navLabel}
          </a>,
          <h2 key="packages-heading" class="docs-nav-heading api-nav-heading">
            Packages
          </h2>,
          <NodeLinks
            key="packages"
            registry={registry}
            nodes={registry.packages}
            open={chain[0]}
          />,
        ],
      },
      ...chain.map((node, index) => {
        let parent = chain[index - 1]
        let back = parent ? registry.pages[parent.homePageId] : homePage
        let content: RemixNode[] = [
          <a
            key="back"
            class="docs-nav-item api-nav-row api-nav-back"
            href={back.path}
            data-api-nav-back
          >
            <Icon name="chevron-r" />
            {parent ? parent.label : 'All packages'}
          </a>,
          <HeadingLink
            key="title"
            class="api-nav-title"
            page={registry.pages[node.homePageId]}
            currentPath={page.path}
          >
            <PathLabel label={node.label} />
          </HeadingLink>,
        ]

        if (node.children.length > 0) {
          content.push(
            <h2 key="modules-heading" class="docs-nav-heading api-nav-heading">
              Modules
            </h2>,
            <NodeLinks
              key="modules"
              registry={registry}
              nodes={node.children}
              open={chain[index + 1]}
            />,
          )
        }

        for (let section of navSections) {
          let items = node.pageIds
            .map((pageId) => registry.pages[pageId])
            .filter((item) => item.navSection === section)
          if (items.length === 0) continue

          content.push(
            <h2 key={`${section}-heading`} class="docs-nav-heading api-nav-heading">
              {section}
            </h2>,
            <ul key={section} class="api-nav-list">
              {items.map((item) => (
                <li key={item.path}>
                  <a
                    class="docs-nav-item api-nav-row api-nav-symbol"
                    href={item.path}
                    aria-current={isPageActive(item, page.path) ? 'page' : undefined}
                  >
                    {item.navLabel}
                  </a>
                </li>
              ))}
            </ul>,
          )
        }

        return { id: node.id, content }
      }),
    ]

    return (
      <>
        <p class="docs-nav-heading docs-nav-title">
          Remix <span class="docs-nav-version">v{remixPackage.version}</span>
        </p>
        <ApiNav panels={panels} />
      </>
    )
  }
}

// Rows that open a nested menu. The row for the open menu stays highlighted.
function NodeLinks(handle: Handle<{ registry: DocsRegistry; nodes: NavNode[]; open?: NavNode }>) {
  return () => {
    let { registry, nodes, open } = handle.props

    return (
      <ul class="api-nav-list">
        {nodes.map((node) => (
          <li key={node.id}>
            <a
              class="docs-nav-item api-nav-row api-nav-node"
              href={registry.pages[node.homePageId].path}
              aria-current={node === open ? 'true' : undefined}
            >
              <PathLabel label={node.label} />
              <Icon name="chevron-r" />
            </a>
          </li>
        ))}
      </ul>
    )
  }
}

// The menu title links to its overview but keeps the heading style.
function HeadingLink(
  handle: Handle<{ class: string; page: PageDefinition; currentPath: string; children: RemixNode }>,
) {
  return () => {
    let { page, currentPath, children } = handle.props

    return (
      <a
        class={`docs-nav-item api-nav-row api-nav-heading-link ${handle.props.class}`}
        href={page.path}
        aria-current={isPageActive(page, currentPath) ? 'page' : undefined}
      >
        {children}
      </a>
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
