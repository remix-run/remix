import { createController } from 'remix/router'
import { clientEntry } from 'remix/component'

import type { DocsContext } from '../../data/docs.ts'
import { loadDemoComponent, renderDemoSource } from '../../data/demos.tsx'
import { renderMarkdownFile } from '../../data/markdown.ts'
import { getDocPage, getNavChain } from '../../data/registry.ts'
import { routes } from '../../routes.ts'
import { ReferenceDocument } from '../../ui/document.tsx'
import { fileResponse } from '../file-response.ts'
import { DemoContent, MarkdownContent, NotFound, PackageIndex } from './page.tsx'

interface ReferenceControllerOptions {
  getDocsContext(): Promise<DocsContext>
}

export function createReferenceController(options: ReferenceControllerOptions) {
  return createController(routes.reference, {
    actions: {
      async document({ params, render }) {
        let docsContext = await options.getDocsContext()
        let docFile = docsContext.docFiles.find((file) => file.urlPath === params.slug)
        let registry = docsContext.registry
        let docProps = { registry, slug: params.slug }

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

        let node = getNavChain(registry, getDocPage(registry, params.slug)?.navId).at(-1)
        if (node) {
          return render(
            <ReferenceDocument {...docProps}>
              <PackageIndex registry={registry} node={node} />
            </ReferenceDocument>,
          )
        }

        return render(
          <ReferenceDocument {...docProps}>
            <NotFound slug={params.slug} />
          </ReferenceDocument>,
          { status: 404 },
        )
      },
      async markdown({ request, params }) {
        let docsContext = await options.getDocsContext()
        let docFile = docsContext.docFiles.find((file) => file.urlPath === params.slug)
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
      },
    },
  })
}
