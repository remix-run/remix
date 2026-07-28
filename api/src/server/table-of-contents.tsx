import { clientEntry, type Handle } from 'remix/ui'

import { TableOfContentsBehavior } from '../client/table-of-contents.browser.tsx'
import type { MarkdownHeading } from './markdown.ts'

export function TableOfContents(
  handle: Handle<{ behaviorEntryHref: string; headings: MarkdownHeading[] }>,
) {
  let Behavior = clientEntry(
    `${handle.props.behaviorEntryHref}#TableOfContentsBehavior`,
    TableOfContentsBehavior,
  )

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
        <Behavior listId={listId} />
      </>
    )
  }
}
