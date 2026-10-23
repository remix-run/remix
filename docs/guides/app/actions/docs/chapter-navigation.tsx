import type { Handle } from 'remix/component'

import remixPackage from '../../../../../packages/remix/package.json' with { type: 'json' }

import type { DocsNavigationItem } from './markdown-chapters.tsx'

type ChapterNavigationProps = {
  chapters: DocsNavigationItem[]
  currentSlug?: string
}

export function ChapterNavigationContent(handle: Handle<ChapterNavigationProps>) {
  return () => (
    <>
      <p class="docs-nav-heading docs-nav-title docs-chapters-nav__heading">
        Remix Guides <span class="docs-nav-version">v{remixPackage.version}</span>
      </p>
      <ol class="docs-chapters-nav__list">
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
                <span class="docs-nav-item docs-chapters-nav__item" aria-disabled="true">
                  {label}
                </span>
              ) : (
                <a
                  class="docs-nav-item docs-chapters-nav__item"
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
    </>
  )
}
