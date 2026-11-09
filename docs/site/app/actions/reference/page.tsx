import type { Handle, RemixNode } from 'remix/component'
import { unsafeHTML } from 'remix/component'
import { DocsDemo } from 'remix-docs-shared/ui/demo'

import type { DemoDocFile } from '../../data/demos.tsx'
import type { DocsRegistry, NavNode } from '../../data/registry.ts'

export function MarkdownContent(handle: Handle<{ html: string }>) {
  return () => <div innerHTML={unsafeHTML(handle.props.html)} />
}

export function DemoContent(
  handle: Handle<{
    demo: Pick<DemoDocFile, 'description' | 'name'>
    sourceHtml: string
    children: RemixNode
  }>,
) {
  return () => {
    let { demo, sourceHtml, children } = handle.props

    return (
      <div class="api-demo">
        <header class="api-demo__header">
          <h1>{demo.name}</h1>
          <p>{demo.description}</p>
        </header>

        <DocsDemo sourceHtml={sourceHtml}>{children}</DocsDemo>
      </div>
    )
  }
}

export function NotFound(handle: Handle<{ slug: string }>) {
  return () => (
    <div class="error">
      <p>Could not find a document at:</p>
      <p>
        <code>{handle.props.slug}</code>
      </p>
    </div>
  )
}

export function PackageIndex(handle: Handle<{ registry: DocsRegistry; node: NavNode }>) {
  return () => {
    let { registry, node } = handle.props
    let hasExports = node.pageIds.length > 0

    return (
      <>
        {hasExports ? (
          <>
            <p>
              <code>{node.id}</code> exports:
            </p>
            <ul>
              {node.pageIds.map((pageId) => (
                <li key={pageId}>
                  <a href={registry.pages[pageId].path}>
                    <code>{registry.pages[pageId].navLabel}</code>
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {node.children.length > 0 ? (
          <>
            <p>
              {hasExports ? (
                'Nested import paths:'
              ) : (
                <>
                  <code>{node.id}</code> has no exports of its own. Import one of these instead:
                </>
              )}
            </p>
            <ul>
              {node.children.map((child) => (
                <li key={child.id}>
                  <a href={registry.pages[child.homePageId].path}>
                    <code>{child.id}</code>
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </>
    )
  }
}
