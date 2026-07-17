import type { Handle } from 'remix/ui'

import type { DocsNavigationItem } from './markdown-chapters.tsx'

type ChapterNavigationProps = {
  chapters: DocsNavigationItem[]
  currentSlug?: string
}

export function ChapterNavigationContent(handle: Handle<ChapterNavigationProps>) {
  return () => (
    <>
      <div class="docs-chapters-nav__heading">Guide chapters</div>
      <ol class="docs-chapters-nav__list">
        {handle.props.chapters.map((chapter) => (
          <li key={chapter.slug}>
            <a
              href={chapter.href}
              aria-current={chapter.slug === handle.props.currentSlug ? 'page' : undefined}
            >
              <span class="docs-chapters-nav__eyebrow">{chapter.order}.</span>
              <span class="docs-chapters-nav__title">{chapter.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </>
  )
}
