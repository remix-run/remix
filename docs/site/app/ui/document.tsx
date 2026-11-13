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
import { DocsTableOfContents, hasTableOfContents } from 'remix-docs-shared/ui/table-of-contents'
import type { DocsHeadingLink } from 'remix-docs-shared/ui/table-of-contents'

import type {
  DocsRegistry,
  GuideNavigationItem,
  NavNode,
  NavSection,
  PageDefinition,
} from '../data/registry.ts'
import {
  API_PAGE_ID,
  buildNotFoundPage,
  getApiPage,
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

export function ReferenceDocument(
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
    let page = slug
      ? (getDocPage(registry, slug) ?? buildNotFoundPage(slug))
      : getHomePage(registry)
    let shouldNofollow = page.docFile?.kind === 'package' || page.docFile?.kind === 'demo'
    let description = getPageDescription(page)

    return (
      <DocsDocument
        title={`${page.title || 'Remix'} | Remix Docs`}
        description={description}
        path={page.path}
        head={
          page.docFile ? (
            <link
              data-rmx-key="docs-markdown-alternate"
              rel="alternate"
              type="text/markdown"
              href={routes.reference.markdown.href({ slug: page.docFile.urlPath })}
              title={`Markdown docs for ${page.docFile.name ?? page.title}`}
            />
          ) : null
        }
        nofollow={shouldNofollow}
        brandLabel="Remix Docs"
        compactSearch
        navigation={<DocsNavigation registry={registry} page={page} />}
        navigationLabel="API reference"
        mobileNavigationLabel={page.title || page.navLabel}
        navigationName="API navigation"
        hasSecondaryNavigation={hasTableOfContents(headings)}
      >
        <DocsPage
          pageKey={`api-page-${page.path}`}
          headings={headings}
          contentClassName="api-page-content rmx-page-body docs-markdown"
        >
          <PageHeader page={page} sourceUrl={sourceUrl} />
          {children}
        </DocsPage>
      </DocsDocument>
    )
  }
}

export function DocsDocument(
  handle: Handle<{
    title: string
    description?: string
    path: string
    head?: RemixNode
    nofollow?: boolean
    brandLabel: string
    compactSearch?: boolean
    navigation: RemixNode
    navigationLabel: string
    mobileNavigationLabel: string
    navigationName: string
    hasSecondaryNavigation?: boolean
    children: RemixNode
  }>,
) {
  return () => {
    let { scriptEntry, stylesheetHref, stylesheetPreloads } = getAssetEntry()
    let searchEnabled = shouldLoadPagefind(pagefindModulePath)
    let navigationLinks = createDocsNavigationLinks()
    navigationLinks.set('docs', {
      href: routes.home.href(),
      label: 'Docs',
      current: 'location',
    })

    return (
      <html lang="en">
        <Head
          title={handle.props.title}
          description={handle.props.description}
          path={handle.props.path}
          head={handle.props.head}
          nofollow={handle.props.nofollow}
          scriptEntry={scriptEntry}
          stylesheetHref={stylesheetHref}
          stylesheetPreloads={stylesheetPreloads}
          searchEnabled={searchEnabled}
        />
        <body>
          <DocsShell
            header={
              <DocsHeader
                brandLabel={handle.props.brandLabel}
                navigationLinks={[...navigationLinks.values()]}
                compactSearch={handle.props.compactSearch}
                searchEnabled={searchEnabled}
              />
            }
            navigation={handle.props.navigation}
            navigationLabel={handle.props.navigationLabel}
            mobileNavigationLabel={handle.props.mobileNavigationLabel}
            navigationName={handle.props.navigationName}
            hasSecondaryNavigation={handle.props.hasSecondaryNavigation}
            footer={<DocsFooter />}
          >
            {handle.props.children}
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
    return 'Guides and API reference for Remix, a full-stack TypeScript framework for building web applications on web standards.'
  }
  if (page.id === API_PAGE_ID) {
    return 'API reference for every Remix module, function and type.'
  }
  let { docFile } = page
  if (!docFile) return `API reference for ${page.title}.`
  if (docFile.kind === 'demo') return docFile.description
  if (docFile.kind === 'api') return `API reference for ${page.navLabel} from ${docFile.package}.`
  return `API reference for ${docFile.package}.`
}

function Head(
  handle: Handle<{
    title: string
    description?: string
    path: string
    head?: RemixNode
    nofollow?: boolean
    scriptEntry: ScriptEntry
    stylesheetHref: string
    stylesheetPreloads: readonly string[]
    searchEnabled: boolean
  }>,
) {
  return () => {
    let { scriptEntry, stylesheetHref, stylesheetPreloads, searchEnabled } = handle.props
    let { href, importMap, preloads } = scriptEntry

    return (
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {handle.props.description ? (
          <meta
            data-rmx-key="docs-description"
            name="description"
            content={handle.props.description}
          />
        ) : null}
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any" />
        {stylesheetPreloads.map((href) => (
          <link key={href} data-rmx-key={`preload:${href}`} rel="preload" href={href} as="style" />
        ))}
        {handle.props.nofollow ? (
          <meta data-rmx-key="docs-robots" name="robots" content="nofollow" />
        ) : null}
        <title data-rmx-key="docs-title">{handle.props.title}</title>
        <DocsSocialMeta
          siteName="Remix Docs"
          url={`${siteUrl}${handle.props.path}`}
          title={handle.props.title}
          description={handle.props.description}
          image={`${siteUrl}/social/remix.jpg`}
          imageAlt="Remix"
        />
        {handle.props.head}
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

export function DocsPage(
  handle: Handle<{
    pageKey: string
    headings?: DocsHeadingLink[]
    beforeContent?: RemixNode
    afterContent?: RemixNode
    contentClassName: string
    secondaryNavigationPagefindIgnore?: boolean
    children: RemixNode | RemixNode[]
  }>,
) {
  return () => {
    let headings = handle.props.headings ?? []
    let contentId = `${handle.id}-content`

    return (
      <div class="docs-layout" data-rmx-key={handle.props.pageKey}>
        <article class="docs-article">
          {handle.props.beforeContent}
          <div id={contentId} class={handle.props.contentClassName}>
            {handle.props.children}
          </div>
          <CodeBlockCopyButtons rootId={contentId} />
          {handle.props.afterContent}
        </article>
        {hasTableOfContents(headings) ? (
          <DocsSecondaryNavigation pagefindIgnore={handle.props.secondaryNavigationPagefindIgnore}>
            <h2 class="docs-nav-heading docs-toc__heading">On this page</h2>
            <DocsTableOfContents headings={headings} />
          </DocsSecondaryNavigation>
        ) : null}
      </div>
    )
  }
}

const navSections: NavSection[] = ['Examples', 'API', 'Types']

export function DocsNavigation(
  handle: Handle<{
    registry: DocsRegistry
    page?: PageDefinition
    currentGuideSlug?: string
  }>,
) {
  return () => {
    let { registry, page } = handle.props
    let homePage = getHomePage(registry)
    let apiPage = getApiPage(registry)
    // One panel per menu from the API reference down to this page's import path.
    let chain = page ? getNavChain(registry, page.navId) : []
    let inApiReference = page !== undefined && (page.id === API_PAGE_ID || chain.length > 0)
    let nestedPanels: ApiNavPanel[] = []

    if (page && inApiReference) {
      let currentPage = page
      nestedPanels = [
        {
          id: 'api-reference',
          content: [
            <a
              key="back"
              class="docs-nav-item api-nav-row api-nav-back"
              href={homePage.path}
              data-api-nav-back
            >
              <Icon name="chevron-r" />
              Docs
            </a>,
            <HeadingLink
              key="title"
              class="api-nav-title"
              page={apiPage}
              currentPath={currentPage.path}
            >
              API Reference
            </HeadingLink>,
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
          let back = parent ? registry.pages[parent.homePageId] : apiPage
          let content: RemixNode[] = [
            <a
              key="back"
              class="docs-nav-item api-nav-row api-nav-back"
              href={back.path}
              data-api-nav-back
            >
              <Icon name="chevron-r" />
              {parent ? parent.label : 'API Reference'}
            </a>,
            <HeadingLink
              key="title"
              class="api-nav-title"
              page={registry.pages[node.homePageId]}
              currentPath={currentPage.path}
            >
              {node.label}
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
                      aria-current={isPageActive(item, currentPage.path) ? 'page' : undefined}
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
    }

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
            aria-current={page && isPageActive(homePage, page.path) ? 'page' : undefined}
          >
            {homePage.navLabel}
          </a>,
          <GuideLinks
            key="guides"
            chapters={registry.guides}
            currentSlug={handle.props.currentGuideSlug}
          />,
          <a
            key="api-reference"
            class="docs-nav-item api-nav-row api-nav-node api-nav-section-break"
            href={apiPage.path}
            aria-current={inApiReference ? 'true' : undefined}
          >
            API Reference
            <Icon name="chevron-r" />
          </a>,
        ],
      },
      ...nestedPanels,
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

function GuideLinks(handle: Handle<{ chapters: GuideNavigationItem[]; currentSlug?: string }>) {
  return () => (
    <ol class="api-nav-list">
      {handle.props.chapters.map((chapter) => (
        <li key={chapter.slug}>
          {chapter.disabled ? (
            <span class="docs-nav-item api-nav-row" aria-disabled="true">
              {chapter.order}. {chapter.title}
            </span>
          ) : (
            <a
              class="docs-nav-item api-nav-row"
              href={chapter.href}
              aria-current={chapter.slug === handle.props.currentSlug ? 'page' : undefined}
            >
              {chapter.order}. {chapter.title}
            </a>
          )}
        </li>
      ))}
    </ol>
  )
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

// The package link at the top of an API menu.
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
