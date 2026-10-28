import { createController } from 'remix/router'
import { clientEntry } from 'remix/component'

import type { DocsContext } from '../../data/docs.ts'
import { loadDemoComponent, renderDemoSource } from '../../data/demos.tsx'
import { renderMarkdownFile } from '../../data/markdown.ts'
import { getDocPage, getNavChain } from '../../data/registry.ts'
import type { AppContext } from '../../router.ts'
import { routes } from '../../routes.ts'
import { ReferenceDocument } from '../../ui/document.tsx'
import { fileResponse } from '../file-response.ts'
import { DemoContent, MarkdownContent, NotFound, PackageIndex } from './page.tsx'

interface ReferenceControllerOptions {
  getDocsContext(): Promise<DocsContext>
}

type Render = AppContext['render']

export async function renderReferenceDocument(
  getDocsContext: ReferenceControllerOptions['getDocsContext'],
  { slug, render }: { slug: string; render: Render },
): Promise<Response> {
        let docsContext = await getDocsContext()
        let docFile = docsContext.docFiles.find((file) => file.urlPath === slug)
        let registry = docsContext.registry
        let docProps = { registry, slug }

        if (docFile?.kind === 'demo') {
          let ExampleComponent = clientEntry(
            `${docFile.importHref}#default`,
            await loadDemoComponent(docFile),
          )
          let sourceHtml = await renderDemoSource(docFile.source)
          return render(
            <ReferenceDocument {...docProps} sourceUrl={docFile.sourceUrl}>
              <DemoContent demo={docFile} sourceHtml={sourceHtml}>
                <ExampleComponent key={docFile.slug} />
              </DemoContent>
            </ReferenceDocument>,
          )
        }

        if (docFile !== undefined) {
          let { html, headings, source } = await renderMarkdownFile(
            docFile.path,
            docsContext.docFilesLookup,
            // Don't auto-link code symbols in README - too many false positives.
            docFile.kind !== 'package',
          )
          return render(
            <ReferenceDocument {...docProps} sourceUrl={source} headings={headings}>
              <MarkdownContent html={html} />
            </ReferenceDocument>,
          )
        }

        let node = getNavChain(registry, getDocPage(registry, slug)?.navId).at(-1)
        if (node) {
          return render(
            <ReferenceDocument {...docProps}>
              <PackageIndex registry={registry} node={node} />
            </ReferenceDocument>,
          )
        }

        return render(
          <ReferenceDocument {...docProps}>
            <NotFound slug={slug} />
          </ReferenceDocument>,
          { status: 404 },
        )
}

export async function serveReferenceMarkdown(
  getDocsContext: ReferenceControllerOptions['getDocsContext'],
  { request, slug }: { request: Request; slug: string },
): Promise<Response> {
        let docsContext = await getDocsContext()
        let docFile = docsContext.docFiles.find((file) => file.urlPath === slug)
        if (!docFile) {
          return new Response('Not Found', { status: 404 })
        }

        if (docFile.kind === 'demo') {
          let markdown = `# ${docFile.name}\n\n${docFile.description}\n\n\`\`\`tsx\n${docFile.source}\n\`\`\`\n`
          return new Response(markdown, {
            headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
          })
        }

        return fileResponse(request, docFile.path)
}

export function createReferenceController(options: ReferenceControllerOptions) {
  return createController(routes.reference, {
    actions: {
      document: ({ params, render }) => renderReferenceDocument(options.getDocsContext, { slug: params.slug, render }),
      markdown: ({ request, params }) =>
        serveReferenceMarkdown(options.getDocsContext, { request, slug: params.slug }),
    },
  })
}
