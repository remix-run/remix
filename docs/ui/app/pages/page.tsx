import { unsafeHTML } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import type { DocsHeadingLink } from 'remix-docs-shared/ui/table-of-contents'
import type { PageMeta, UiPage } from '../data/pages.ts'
import { categories } from '../data/categories.ts'
import { UiDocument } from '../ui/document.tsx'
import { Example } from './example.tsx'
import { routes } from '../routes.ts'

export function PageLayout(
  handle: Handle<{ page: PageMeta; pages: UiPage[]; intro?: RemixNode; children: RemixNode }>,
) {
  return () => {
    let { page, pages, intro, children } = handle.props
    let index = pages.findIndex(
      (entry) => entry.category === page.category && entry.slug === page.slug,
    )
    let previous = index > 0 ? pages[index - 1] : undefined
    let next = index >= 0 ? pages[index + 1] : undefined
    return (
      <UiDocument
        title={page.title}
        description={page.description}
        pages={pages}
        currentPage={page}
        headings={readPageHeadings(children)}
      >
        <header class="docs-page-header">
          <p class="docs-page-eyebrow">
            {categories.find((category) => category.id === page.category)?.title}
          </p>
          <h1 class="rmx-page-title">{page.title}</h1>
          <p class="docs-page-description">{page.description}</p>
          {intro}
        </header>
        {children}
        {index >= 0 ? (
          <nav class="ui-page-navigation" aria-label="Page navigation" data-pagefind-ignore>
            <a
              href={
                previous
                  ? routes.docs.page.href({ category: previous.category, slug: previous.slug })
                  : routes.docs.index.href()
              }
              rel="prev"
            >
              <span class="ui-page-navigation-direction">
                <span aria-hidden="true">← </span>Previous
              </span>
              <span>{previous?.title ?? 'Getting Started'}</span>
            </a>
            {next ? (
              <a
                href={routes.docs.page.href({ category: next.category, slug: next.slug })}
                rel="next"
              >
                <span class="ui-page-navigation-direction">
                  Next<span aria-hidden="true"> →</span>
                </span>
                <span>{next.title}</span>
              </a>
            ) : null}
          </nav>
        ) : null}
      </UiDocument>
    )
  }
}

export function Section(handle: Handle<{ id: string; title: string; children: RemixNode }>) {
  return () => (
    <section id={handle.props.id} class="docs-section ui-doc-section">
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
    let isApiHeading = node.type === 'h3' && typeof id === 'string'
    if (node.type === Section || node.type === Example || isApiHeading) {
      if (typeof id !== 'string') throw new Error('A docs section or example needs an ID')
      if (ids.has(id)) throw new Error(`Duplicate docs ID: ${id}`)
      ids.add(id)
      if (isApiHeading) {
        title = readHeadingText(children)
          .trim()
          .replace(/\s+/g, ' ')
          .replace(/\(.*\)$/, '()')
      }
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

function readHeadingText(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(readHeadingText).join('')
  if (isRecord(node) && isRecord(node.props)) return readHeadingText(node.props.children)
  return ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}
