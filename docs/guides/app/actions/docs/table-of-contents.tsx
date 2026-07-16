import type { Handle } from 'remix/ui'

import { TableOfContentsBehavior } from './table-of-contents.browser.tsx'

export type DocsHeadingLink = {
  id: string
  title: string
  titleHtml: string
}

export function DocsTableOfContents(handle: Handle<{ headings: DocsHeadingLink[] }>) {
  return () => {
    let listId = `${handle.id}-list`

    return (
      <>
        <ol id={listId} class="docs-toc__list">
          {handle.props.headings.map((heading) => (
            <li key={heading.id}>
              <a href={`#${heading.id}`} innerHTML={heading.titleHtml} />
            </li>
          ))}
        </ol>
        <TableOfContentsBehavior listId={listId} />
      </>
    )
  }
}
