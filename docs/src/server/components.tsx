import type { Handle, RemixNode } from 'remix/ui'
import type { DocFile } from './markdown.ts'
import {
  buildRegistry,
  buildNotFoundPage,
  getDocPage,
  getHomePage,
  type PageDefinition,
} from './registry.ts'
import { DocsDocument } from './view.tsx'

export type ServerContext = {
  docFiles: DocFile[]
  versions: { version: string; crawl: boolean }[]
  activeVersion?: string
  slug?: string
}

export type ServerPageProps = ServerContext & {
  children?: RemixNode | RemixNode[]
  sourceUrl?: string
}

export function ServerPage(handle: Handle<ServerPageProps>) {
  return () => {
    let { docFiles, versions, activeVersion, slug, sourceUrl, children } = handle.props
    let registry = buildRegistry(docFiles, activeVersion)
    let page: PageDefinition
    if (!slug) {
      page = getHomePage(registry)
    } else {
      let docPage = getDocPage(registry, slug)
      page = docPage ?? buildNotFoundPage(slug, activeVersion)
    }
    return (
      <DocsDocument
        page={page}
        registry={registry}
        versions={versions}
        activeVersion={activeVersion}
        sourceUrl={sourceUrl}
      >
        {children}
      </DocsDocument>
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

export function MarkdownContent(handle: Handle<{ html: string }>) {
  return () => <div innerHTML={handle.props.html} />
}
