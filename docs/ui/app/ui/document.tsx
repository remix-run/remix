import * as path from 'node:path'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import { PagefindElements, shouldLoadPagefind } from 'remix-docs-shared/search'
import { CodeBlockCopyButtons } from 'remix-docs-shared/ui/code-block-copy'
import { DocsFooter } from 'remix-docs-shared/ui/docs-footer'
import { createDocsNavigationLinks, DocsHeader } from 'remix-docs-shared/ui/docs-header'
import { DocsShell, DocsSecondaryNavigation } from 'remix-docs-shared/ui/docs-shell'
import { DocsSocialMeta } from 'remix-docs-shared/ui/social-meta'
import { DocsTableOfContents, hasTableOfContents } from 'remix-docs-shared/ui/table-of-contents'
import type { DocsHeadingLink } from 'remix-docs-shared/ui/table-of-contents'
import uiPackage from '../../../../packages/ui/package.json' with { type: 'json' }
import type { PageMeta, UiPage } from '../data/pages.ts'
import { categories } from '../data/categories.ts'

import { scriptEntry, stylesheetHref, stylesheetPreloads } from '../assets.ts'
import { routes } from '../routes.ts'

interface UiDocumentProps {
  title: string
  description: string
  pages: UiPage[]
  currentPage?: PageMeta
  headings?: DocsHeadingLink[]
  children: RemixNode
}

const siteUrl = 'https://ui.remix.run'

const pagefindModulePath = path.resolve(
  import.meta.dirname,
  '../../build/site/assets/pagefind/pagefind-component-ui.js',
)

export function UiDocument(handle: Handle<UiDocumentProps>) {
  return () => {
    let { title, description, pages, currentPage, children, headings = [] } = handle.props
    let searchEnabled = shouldLoadPagefind(pagefindModulePath)
    let links = createDocsNavigationLinks()
    let contentId = `${handle.id}-content`
    let pageTitle = title === 'Remix UI' ? title : `${title} | Remix UI`
    let pagePath = currentPage
      ? routes.docs.page.href({ category: currentPage.category, slug: currentPage.slug })
      : routes.docs.index.href()
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="description" content={description} />
          <title>{pageTitle}</title>
          <DocsSocialMeta
            siteName="Remix UI"
            url={`${siteUrl}${pagePath.replace(/\/?$/, '/')}`}
            title={pageTitle}
            description={description}
            image={`${siteUrl}/social/remix.jpg`}
            imageAlt="Remix"
          />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          {searchEnabled ? (
            <link rel="stylesheet" href="/assets/pagefind/pagefind-component-ui.css" />
          ) : null}
          <link rel="stylesheet" href={stylesheetHref} />
          <ImportMap value={scriptEntry.importMap} />
          {scriptEntry.preloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}
          {stylesheetPreloads.map((href) => (
            <link key={href} rel="preload" href={href} as="style" />
          ))}
          {searchEnabled ? (
            <script type="module" src="/assets/pagefind/pagefind-component-ui.js" />
          ) : null}
          <script type="module" src={scriptEntry.href} />
        </head>
        <body>
          <DocsShell
            header={
              <DocsHeader
                brandLabel="Remix UI"
                navigationLinks={[...links.values()]}
                searchEnabled={searchEnabled}
              />
            }
            navigation={<Sidebar pages={pages} currentPage={currentPage} />}
            navigationLabel="Remix UI documentation"
            mobileNavigationLabel={currentPage?.title ?? 'Getting Started'}
            navigationName="Remix UI navigation"
            hasSecondaryNavigation={hasTableOfContents(headings)}
            footer={<DocsFooter />}
          >
            <div class="docs-layout ui-docs-layout">
              <article id={contentId} class="docs-article ui-article">
                {children}
                <CodeBlockCopyButtons rootId={contentId} />
              </article>
              {hasTableOfContents(headings) ? (
                <DocsSecondaryNavigation pagefindIgnore>
                  <h2 class="docs-nav-heading docs-toc__heading">On this page</h2>
                  <DocsTableOfContents headings={headings} />
                </DocsSecondaryNavigation>
              ) : null}
            </div>
          </DocsShell>
          {searchEnabled ? <PagefindElements baseUrl="/" bundlePath="/assets/pagefind/" /> : null}
        </body>
      </html>
    )
  }
}

function Sidebar(handle: Handle<{ pages: UiPage[]; currentPage?: PageMeta }>) {
  return () => (
    <>
      <p class="docs-nav-heading docs-nav-title">
        Remix UI <span class="docs-nav-version">v{uiPackage.version}</span>
      </p>
      <a
        class="docs-nav-item ui-nav-link ui-nav-start"
        href={routes.docs.index.href()}
        aria-current={handle.props.currentPage === undefined ? 'page' : undefined}
      >
        Getting Started
      </a>
      {categories.map((category) => (
        <section key={category.id} class="ui-nav-group">
          <h2 class="docs-nav-heading">{category.title}</h2>
          <ul>
            {handle.props.pages
              .filter((page) => page.category === category.id)
              .map((page) => (
                <li key={page.slug}>
                  <a
                    class="docs-nav-item ui-nav-link"
                    href={routes.docs.page.href({ category: category.id, slug: page.slug })}
                    aria-current={
                      handle.props.currentPage?.category === page.category &&
                      handle.props.currentPage?.slug === page.slug
                        ? 'page'
                        : undefined
                    }
                  >
                    {page.title}
                  </a>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </>
  )
}
