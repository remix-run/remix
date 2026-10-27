import type { Handle, RemixNode } from 'remix/component'
import { hasTableOfContents } from 'remix-docs-shared/ui/table-of-contents'
import type { DocsHeadingLink } from 'remix-docs-shared/ui/table-of-contents'

import type { DocsRegistry } from '../../data/registry.ts'
import { routes } from '../../routes.ts'
import { DocsDocument as SiteDocument, DocsNavigation, DocsPage } from '../../ui/document.tsx'

type DocsDocumentProps = {
  registry: DocsRegistry
  title: string
  description: string
  path: string
  currentChapterSlug?: string
  hasSecondaryNavigation?: boolean
  head?: RemixNode
  children: RemixNode
}

type DocsChapterProps = {
  registry: DocsRegistry
  slug: string
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
      handle.props.title === 'Remix Guides'
        ? 'Remix Guides'
        : `${handle.props.title} | Remix Guides`
    return (
      <SiteDocument
        title={title}
        description={handle.props.description}
        path={handle.props.path}
        head={handle.props.head}
        brandLabel="Remix Guides"
        navigation={
          <DocsNavigation
            registry={handle.props.registry}
            currentGuideSlug={handle.props.currentChapterSlug}
          />
        }
        navigationLabel="Docs navigation"
        mobileNavigationLabel={handle.props.title}
        navigationName="docs navigation"
        hasSecondaryNavigation={handle.props.hasSecondaryNavigation}
      >
        {handle.props.children}
      </SiteDocument>
    )
  }
}

export function DocsChapter(handle: Handle<DocsChapterProps>) {
  return () => (
    <DocsDocument
      registry={handle.props.registry}
      title={handle.props.title}
      description={handle.props.description}
      path={routes.guides.chapter.href({ chapter: handle.props.slug })}
      currentChapterSlug={handle.props.slug}
      hasSecondaryNavigation={hasTableOfContents(handle.props.sections)}
      head={
        <link
          rel="alternate"
          type="text/markdown"
          href={routes.guides.markdown.href({ chapter: handle.props.slug })}
          title={`Markdown for ${handle.props.title}`}
        />
      }
    >
      <DocsPage
        pageKey={`docs-chapter-${handle.props.slug}`}
        headings={handle.props.sections}
        contentClassName="docs-sections"
        secondaryNavigationPagefindIgnore
        beforeContent={
          <header class="docs-page-header">
            <p class="docs-page-eyebrow">{handle.props.chapter}</p>
            <h1 class="rmx-page-title">{handle.props.title}</h1>
          </header>
        }
        afterContent={
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
        }
      >
        {handle.props.children}
      </DocsPage>
    </DocsDocument>
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
