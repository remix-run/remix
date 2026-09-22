import type { Handle } from 'remix/ui'

import { ChapterNavigationIndicator } from './public/chapter-navigation-indicator.ts'
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
          {handle.props.chapters.map((chapter) => {
            let label = (
              <>
                <span class="docs-chapters-nav__eyebrow">{chapter.order}.</span>
                <span class="docs-chapters-nav__title">{chapter.title}</span>
              </>
            )

            return (
              <li key={chapter.slug}>
                {chapter.disabled ? (
                  <span class="docs-chapters-nav__item" aria-disabled="true">
                    {label}
                  </span>
                ) : (
                  <a
                    class="docs-chapters-nav__item"
                    href={chapter.href}
                    aria-current={chapter.slug === handle.props.currentSlug ? 'page' : undefined}
                  >
                    {label}
                  </a>
                )}
              </li>
            )
          })}
        </ol>
        <ChapterNavigationIndicator listId={listId} />
      </>
    )
  }
}
