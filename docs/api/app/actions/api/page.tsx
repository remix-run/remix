import type { Handle, RemixNode } from 'remix/component'
import { unsafeHTML } from 'remix/component'
import { DocsDemo } from 'remix-docs-shared/ui/demo'

import type { DemoDocFile } from '../../data/demos.tsx'
import type { DocsRegistry, NavPackage } from '../../data/registry.ts'

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

export function PackageIndex(handle: Handle<{ registry: DocsRegistry; navPackage: NavPackage }>) {
  return () => {
    let { registry, navPackage } = handle.props

    return (
      <>
        <p>
          <code>{registry.pages[navPackage.homePageId].title}</code> has no exports of its own.
          Import one of these instead:
        </p>
        <ul>
          {navPackage.subpackages.map((subpackage) => {
            let overview = subpackage.overviewPageId
              ? registry.pages[subpackage.overviewPageId]
              : undefined
            return (
              <li key={subpackage.id}>
                {overview ? (
                  <a href={overview.path}>
                    <code>{subpackage.id}</code>
                  </a>
                ) : (
                  <code>{subpackage.id}</code>
                )}
              </li>
            )
          })}
        </ul>
      </>
    )
  }
}
