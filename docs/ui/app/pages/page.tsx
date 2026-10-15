import { unsafeHTML } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import type { DocsHeadingLink } from 'remix-docs-shared/ui/table-of-contents'
import type { PageMeta, UiPage } from '../data/pages.ts'
import { UiDocument } from '../ui/document.tsx'
import { Example } from './example.tsx'

export function PageLayout(
  handle: Handle<{ page: PageMeta; pages: UiPage[]; children: RemixNode }>,
) {
  return () => {
    let { page, pages, children } = handle.props
    return (
      <UiDocument
        title={page.title}
        description={page.description}
        pages={pages}
        currentPage={page}
        headings={readPageHeadings(children)}
      >
        <header class="ui-page-header">
          <p class="ui-eyebrow">{page.category === 'behaviors' ? 'Behaviors' : 'Animation'}</p>
          <h1 class="rmx-page-title">{page.title}</h1>
          <p class="ui-description">{page.description}</p>
        </header>
        {children}
        <aside class="ui-reference-link">
          <p>
            <a href={`https://api.remix.run/${page.importPath.replace(/^@/, '')}`}>
              Generated API documentation
            </a>
          </p>
        </aside>
      </UiDocument>
    )
  }
}

export function Section(handle: Handle<{ id: string; title: string; children: RemixNode }>) {
  return () => (
    <section id={handle.props.id} class="ui-doc-section">
      <h2>{handle.props.title}</h2>
      {handle.props.children}
    </section>
  )
}

export function CodeBlock(handle: Handle<{ html: string }>) {
  return () => <div data-code-block innerHTML={unsafeHTML(handle.props.html)} />
}

export function readPageHeadings(children: RemixNode): DocsHeadingLink[] {
  let headings: DocsHeadingLink[] = []
  let ids = new Set<string>()

  function visit(node: unknown): void {
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    if (!isRecord(node) || !isRecord(node.props)) return
    let { id, title, children } = node.props
    if (node.type === Section || node.type === Example) {
      if (typeof id !== 'string') throw new Error('A docs section or example needs an ID')
      if (ids.has(id)) throw new Error(`Duplicate docs ID: ${id}`)
      ids.add(id)
      if (typeof title === 'string') {
        headings.push({
          id,
          title,
          titleHtml: title.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
          depth: node.type === Section ? 2 : 3,
        })
      }
    }
    visit(children)
  }

  visit(children)
  return headings
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}
