import type { Handle } from 'remix/ui'

import { ChapterNavigationIndicator } from './chapter-navigation-indicator.browser.ts'
import type { DocsNavigationItem } from './markdown-chapters.tsx'

type ChapterNavigationProps = {
  chapters: DocsNavigationItem[]
  currentSlug?: string
}

export function ChapterNavigationContent(handle: Handle<ChapterNavigationProps>) {
  return () => {
    let listId = `${handle.id}-list`

    return (
      <>
        <div class="docs-chapters-nav__heading">Guide chapters</div>
        <ol id={listId} class="docs-chapters-nav__list docs-selection-list">
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
        <ChapterNavigationIndicator listId={listId} />
      </>
    )
  }
}
