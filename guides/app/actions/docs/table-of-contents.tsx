import type { Handle } from 'remix/ui'

export type DocsHeadingLink = {
  id: string
  title: string
}

export function DocsTableOfContents(handle: Handle<{ headings: DocsHeadingLink[] }>) {
  return () => (
    <ol class="docs-toc__list">
      {handle.props.headings.map((heading) => (
        <li key={heading.id}>
          <a href={`#${heading.id}`}>{heading.title}</a>
        </li>
      ))}
    </ol>
  )
}
