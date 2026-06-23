import type { Handle } from 'remix/ui'

export type DocsHeadingLink = {
  id: string
  title: string
  titleHtml: string
}

export function DocsTableOfContents(handle: Handle<{ headings: DocsHeadingLink[] }>) {
  return () => (
    <ol class="docs-toc__list">
      {handle.props.headings.map((heading) => (
        <li key={heading.id}>
          <a href={`#${heading.id}`} innerHTML={heading.titleHtml} />
        </li>
      ))}
    </ol>
  )
}
