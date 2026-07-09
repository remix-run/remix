import type { Handle, RemixNode } from 'remix/ui'

import { CodeBlockCopyButtons, codeBlockCopyStyles } from './code-block-copy.browser.tsx'
import { DocsTableOfContents } from './table-of-contents.tsx'
import type { DocsHeadingLink } from './table-of-contents.tsx'
import { routes } from '../../routes.ts'
import { Document } from '../../ui/document.tsx'

type DocsDocumentProps = {
  title: string
  description: string
  children: RemixNode
}

type DocsChapterProps = {
  chapter: string
  title: string
  description: string
  previous?: {
    href: string
    title: string
  }
  next?: {
    href: string
    title: string
  }
  sections: DocsHeadingLink[]
  children: RemixNode
}

export function DocsDocument(handle: Handle<DocsDocumentProps>) {
  return () => {
    let title =
      handle.props.title === 'Remix Docs' ? 'Remix Docs' : `${handle.props.title} | Remix Docs`

    return (
      <Document title={title} description={handle.props.description}>
        <header class="site-header">
          <a href={routes.docs.index.href()} class="site-header__brand" aria-label="Remix Docs">
            <img src="/remix-wordmark-light-mode.svg" alt="" />
          </a>
          <nav class="site-header__nav" aria-label="Primary">
            <a href={routes.docs.index.href()} aria-current="location">
              Guides
            </a>
            <a href="https://api.remix.run">API</a>
            <a href="https://remix.run/blog">Blog</a>
            <a href="https://remix.run/jam/2026">Jam</a>
            <a href="https://shop.remix.run">Store</a>
            <a href="https://github.com/remix-run/remix">GitHub</a>
          </nav>
        </header>
        <main id="main-content" class="docs-main" tabIndex={-1}>
          {handle.props.children}
        </main>
        <footer aria-label="Site footer" class="site-footer">
          <div class="site-footer__links">
            <a href="https://remix.run" aria-label="Remix" class="site-footer__brand">
              <img src="/remix-wordmark-light-mode.svg" alt="" />
            </a>
            <nav aria-label="Find us on the web" class="site-footer__social">
              <a href="https://github.com/remix-run" aria-label="GitHub">
                <svg aria-hidden="true" fill="none">
                  <use href="/icons.svg#github" />
                </svg>
              </a>
              <a href="https://x.com/remix_run" aria-label="X">
                <svg aria-hidden="true" fill="none">
                  <use href="/icons.svg#x" />
                </svg>
              </a>
              <a href="https://youtube.com/remix_run" aria-label="YouTube">
                <svg aria-hidden="true" fill="none">
                  <use href="/icons.svg#youtube" />
                </svg>
              </a>
              <a href="https://remix.run/discord" aria-label="Discord">
                <svg aria-hidden="true" fill="none">
                  <use href="/icons.svg#discord" />
                </svg>
              </a>
            </nav>
          </div>
          <div class="site-footer__legal">
            <p>docs and examples licensed under mit</p>
            <p>&copy;{new Date().getFullYear()} Shopify, Inc.</p>
          </div>
        </footer>
      </Document>
    )
  }
}

export function DocsChapter(handle: Handle<DocsChapterProps>) {
  return () => {
    let sectionsId = `${handle.id}-sections`

    return (
      <DocsDocument title={handle.props.title} description={handle.props.description}>
        <div class="docs-layout">
          <article class="docs-article">
            <nav class="docs-breadcrumb">
              <a href={routes.docs.index.href()}>Docs</a>
              <span class="docs-breadcrumb__sep">/</span>
              <span>{handle.props.title}</span>
            </nav>

            <header class="docs-chapter-header">
              <p class="docs-chapter-eyebrow docs-accent">{handle.props.chapter}</p>
              <h1 class="rmx-page-title">{handle.props.title}</h1>
            </header>

            <div id={sectionsId} class="docs-sections" mix={codeBlockCopyStyles}>
              {handle.props.children}
            </div>
            <CodeBlockCopyButtons rootId={sectionsId} />

            <nav aria-label="Chapter navigation" class="docs-pagination">
              {handle.props.previous ? (
                <ChapterPaginationLink
                  label="Previous"
                  href={handle.props.previous.href}
                  title={handle.props.previous.title}
                  align="left"
                />
              ) : (
                <div />
              )}
              {handle.props.next ? (
                <ChapterPaginationLink
                  label="Next"
                  href={handle.props.next.href}
                  title={handle.props.next.title}
                  align="right"
                />
              ) : null}
            </nav>
          </article>

          <aside class="docs-aside">
            <h2 class="docs-toc__heading">On this page</h2>
            <DocsTableOfContents headings={handle.props.sections} />
          </aside>
        </div>
      </DocsDocument>
    )
  }
}

function ChapterPaginationLink(
  handle: Handle<{
    label: 'Previous' | 'Next'
    href: string
    title: string
    align: 'left' | 'right'
  }>,
) {
  return () => (
    <a
      href={handle.props.href}
      class={`docs-pagination__link ${
        handle.props.align === 'right' ? 'docs-pagination__link--right' : ''
      }`}
    >
      <span class="docs-pagination__label">{handle.props.label}</span>
      <span class="docs-pagination__title">{handle.props.title}</span>
    </a>
  )
}
