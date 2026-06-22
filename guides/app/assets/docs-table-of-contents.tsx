import { clientEntry, on } from 'remix/ui'
import type { Handle } from 'remix/ui'

export type DocsHeadingLink = {
  id: string
  title: string
}

export const DocsTableOfContents = clientEntry(
  import.meta.url,
  function DocsTableOfContents(handle: Handle<{ headings: DocsHeadingLink[] }>) {
    return () => (
      <ol class="docs-toc__list">
        {handle.props.headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              mix={on('click', (event) => {
                let section = document.getElementById(heading.id)
                if (!section) return

                event.preventDefault()
                window.history.pushState(null, '', event.currentTarget.hash)
                section.scrollIntoView({ behavior: 'smooth', block: 'start' })
              })}
            >
              {heading.title}
            </a>
          </li>
        ))}
      </ol>
    )
  },
)
