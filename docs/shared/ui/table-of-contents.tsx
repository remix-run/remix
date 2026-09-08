import type { Handle } from 'remix/ui'

import { TableOfContentsBehavior } from './public/table-of-contents.tsx'

export type DocsHeadingLink = {
  id: string
  depth: 2 | 3
  title: string
  titleHtml: string
}

// Correct the server-rendered fallback using the restored viewport before the first paint.
// The hydrated behavior below takes over for later scrolling and layout changes.
export const initializeTableOfContentsScript = `
{
  let list = document.currentScript?.previousElementSibling
  if (list instanceof HTMLOListElement) {
    let entries = Array.from(list.querySelectorAll('a[href^="#"]')).flatMap((link) => {
      let id = link.getAttribute('href')?.slice(1)
      let heading = id ? document.getElementById(id) : null
      return heading ? [{ heading, link }] : []
    })
    let activationLine = window.matchMedia('(width >= 900px)').matches ? 116 : 88
    let activeIndex = 0
    for (let [index, entry] of entries.entries()) {
      if (entry.heading.getBoundingClientRect().top > activationLine) break
      activeIndex = index
    }
    for (let [index, entry] of entries.entries()) {
      if (index === activeIndex) {
        entry.link.setAttribute('aria-current', 'location')
      } else {
        entry.link.removeAttribute('aria-current')
      }
    }
  }
}
`

export function DocsTableOfContents(handle: Handle<{ headings: DocsHeadingLink[] }>) {
  return () => {
    let listId = `${handle.id}-list`

    return (
      <>
        <ol id={listId} class="docs-toc__list docs-selection-list">
          {handle.props.headings.map((heading, index) => (
            <li key={heading.id} class={heading.depth === 3 ? 'docs-toc__item--nested' : undefined}>
              <a
                href={`#${heading.id}`}
                aria-current={index === 0 ? 'location' : undefined}
                innerHTML={heading.titleHtml}
              />
            </li>
          ))}
        </ol>
        <script innerHTML={initializeTableOfContentsScript} />
        <TableOfContentsBehavior listId={listId} />
      </>
    )
  }
}
