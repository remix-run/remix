import type { Handle } from 'remix/ui'

import { TableOfContentsBehavior } from './table-of-contents.browser.tsx'

export type DocsHeadingLink = {
  id: string
  depth: 2 | 3
  title: string
  titleHtml: string
}

export function DocsTableOfContents(handle: Handle<{ headings: DocsHeadingLink[] }>) {
  return () => {
    let listId = `${handle.id}-list`

    return (
      <>
        <ol id={listId} class="docs-toc__list docs-selection-list">
          {handle.props.headings.map((heading) => (
            <li key={heading.id} class={heading.depth === 3 ? 'docs-toc__item--nested' : undefined}>
              <a href={`#${heading.id}`} innerHTML={heading.titleHtml} />
            </li>
          ))}
        </ol>
        <TableOfContentsBehavior listId={listId} />
      </>
    )
  }
}
