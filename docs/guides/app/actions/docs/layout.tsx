import type { Handle, RemixNode } from 'remix/ui'
import { DocsFooter } from 'remix-docs-shared/ui/docs-footer'
import { createDocsNavigationLinks, DocsHeader } from 'remix-docs-shared/ui/docs-header'
import { DocsSecondaryNavigation, DocsShell } from 'remix-docs-shared/ui/docs-shell'

import { routes } from '../../routes.ts'
import { Document } from '../../ui/document.tsx'
import { ChapterNavigationContent } from './chapter-navigation.tsx'
import { CodeBlockCopyButtons } from './code-block-copy.browser.tsx'
import type { DocsNavigationItem } from './markdown-chapters.tsx'
import { DocsTableOfContents } from './table-of-contents.tsx'
import type { DocsHeadingLink } from './table-of-contents.tsx'

const navigationLinks = createDocsNavigationLinks()

navigationLinks.set('guides', {
  href: routes.docs.index.href(),
  label: 'Guides',
  current: 'location',
})

type DocsDocumentProps = {
  title: string
  description: string
  chapters: DocsNavigationItem[]
  currentChapterSlug?: string
  hasSecondaryNavigation?: boolean
  children: RemixNode
}

type DocsChapterProps = {
  slug: string
  chapter: string
  title: string
  description: string
  chapters: DocsNavigationItem[]
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
        <DocsShell
          header={
            <DocsHeader brandLabel="Remix Docs" navigationLinks={[...navigationLinks.values()]} />
          }
          navigation={
            <ChapterNavigationContent
              chapters={handle.props.chapters}
              currentSlug={handle.props.currentChapterSlug}
            />
          }
          navigationLabel="Guide chapters"
          mobileNavigationLabel="Chapters"
          navigationName="chapter navigation"
          hasSecondaryNavigation={handle.props.hasSecondaryNavigation}
          footer={<DocsFooter />}
        >
          {handle.props.children}
        </DocsShell>
      </Document>
    )
  }
}

export function DocsChapter(handle: Handle<DocsChapterProps>) {
  return () => {
    let sectionsId = `${handle.id}-sections`

    return (
      <DocsDocument
        title={handle.props.title}
        description={handle.props.description}
        chapters={handle.props.chapters}
        currentChapterSlug={handle.props.slug}
        hasSecondaryNavigation
      >
        <div class="docs-layout">
          <article class="docs-article">
            <nav class="docs-breadcrumb" aria-label="Breadcrumb" data-pagefind-ignore>
              <a href={routes.docs.index.href()}>Docs</a>
              <span class="docs-breadcrumb__sep" aria-hidden="true">
                /
              </span>
              <span aria-current="page">{handle.props.title}</span>
            </nav>

            <header class="docs-chapter-header">
              <p class="docs-chapter-eyebrow">{handle.props.chapter}</p>
              <h1 class="rmx-page-title">{handle.props.title}</h1>
            </header>

            <div id={sectionsId} class="docs-sections">
              {handle.props.children}
            </div>
            <CodeBlockCopyButtons rootId={sectionsId} />

            <nav aria-label="Chapter navigation" class="docs-pagination" data-pagefind-ignore>
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

          <DocsSecondaryNavigation pagefindIgnore>
            <h2 class="docs-toc__heading">On this page</h2>
            <DocsTableOfContents headings={handle.props.sections} />
          </DocsSecondaryNavigation>
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
