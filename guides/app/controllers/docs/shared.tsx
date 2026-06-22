import type { Handle, RemixElement, RemixNode } from 'remix/ui'

import { DocsTableOfContents } from '../../assets/docs-table-of-contents.tsx'
import type { DocsHeadingLink } from '../../assets/docs-table-of-contents.tsx'
import { routes } from '../../routes.ts'
import { Document } from '../../ui/document.tsx'

type DocsDocumentProps = {
  requestUrl: string
  title: string
  description: string
  children: RemixNode
}

export type DocsPageProps = {
  requestUrl: string
}

type DocsChapterProps = {
  requestUrl: string
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
  children: RemixNode
}

export const docsResponseInit = {
  headers: {
    'Cache-Control': 'public, max-age=0, must-revalidate',
  },
} satisfies ResponseInit

export function DocsDocument(handle: Handle<DocsDocumentProps>) {
  return () => {
    let title =
      handle.props.title === 'Remix Docs' ? 'Remix Docs' : `${handle.props.title} | Remix Docs`

    return (
      <Document title={title} description={handle.props.description}>
        <SiteHeader />
        <main id="main-content" class="docs-main" tabIndex={-1}>
          {handle.props.children}
        </main>
      </Document>
    )
  }
}

function SiteHeader() {
  return () => (
    <header class="site-header">
      <a href={routes.docs.index.href()} class="site-header__brand">
        Remix Docs
      </a>
      <nav class="site-header__nav">
        <a href="https://api.remix.run">API reference</a>
        <a href="https://github.com/remix-run/remix">GitHub</a>
      </nav>
    </header>
  )
}

export function DocsChapter(handle: Handle<DocsChapterProps>) {
  return () => (
    <DocsDocument
      requestUrl={handle.props.requestUrl}
      title={handle.props.title}
      description={handle.props.description}
    >
      <div class="docs-layout">
        <article class="docs-article">
          <nav class="docs-breadcrumb">
            <a href={routes.docs.index.href()}>Docs</a>
            <span class="docs-breadcrumb__sep">/</span>
            <span>{handle.props.title}</span>
          </nav>

          <header class="docs-chapter-header">
            <p class="docs-chapter-eyebrow text-red-brand">{handle.props.chapter}</p>
            <h1 class="rmx-page-title">{handle.props.title}</h1>
            <p class="rmx-page-body">{handle.props.description}</p>
          </header>

          <div class="docs-sections">{handle.props.children}</div>

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
          <DocsTableOfContents headings={extractHeadingLinks(handle.props.children)} />
        </aside>
      </div>
    </DocsDocument>
  )
}

export function DocsSection(handle: Handle<{ id: string; title: string; children: RemixNode }>) {
  return () => (
    <section id={handle.props.id} class="docs-section">
      <h2 class="rmx-page-title rmx-page-title-sm docs-section__title">{handle.props.title}</h2>
      <div class="rmx-page-body">{handle.props.children}</div>
    </section>
  )
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

function extractHeadingLinks(node: RemixNode) {
  let headings: DocsHeadingLink[] = []

  function visit(value: RemixNode) {
    if (Array.isArray(value)) {
      for (let child of value) visit(child)
      return
    }

    if (value && typeof value === 'object' && 'type' in value && value.type === DocsSection) {
      let props = (value as RemixElement).props as {
        id?: unknown
        title?: unknown
      }
      if (typeof props.id === 'string' && typeof props.title === 'string') {
        headings.push({ id: props.id, title: props.title })
      }
    }
  }

  visit(node)
  return headings
}
