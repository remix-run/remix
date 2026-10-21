import { createController } from 'remix/router'
import { clientEntry } from 'remix/component'

import type { DocsContext } from '../../data/docs.ts'
import { loadDemoComponent, renderDemoSource } from '../../data/demos.tsx'
import { renderMarkdownFile } from '../../data/markdown.ts'
import { getDocPage, getNavPackage } from '../../data/registry.ts'
import { routes } from '../../routes.ts'
import { Document } from '../../ui/document.tsx'
import { fileResponse } from '../file-response.ts'
import { DemoContent, MarkdownContent, NotFound, PackageIndex } from './page.tsx'

interface ApiControllerOptions {
  activeVersion?: string
  getDocsContext(): Promise<DocsContext>
}

export function createApiController(options: ApiControllerOptions) {
  return createController(routes.api, {
    actions: {
      async document({ params, render }) {
        let docsContext = await options.getDocsContext()
        let docFile = docsContext.docFiles.find((file) => file.urlPath === params.slug)
        let registry = docsContext.getRegistry(options.activeVersion)
        let docProps = {
          registry,
          slug: params.slug,
          activeVersion: options.activeVersion,
        }

        if (docFile?.kind === 'demo') {
          let ExampleComponent = clientEntry(
            `${docFile.importHref}#default`,
            await loadDemoComponent(docFile),
          )
          let sourceHtml = await renderDemoSource(docFile.source)
          return render(
            <Document {...docProps} sourceUrl={docFile.sourceUrl}>
              <DemoContent demo={docFile} sourceHtml={sourceHtml}>
                <ExampleComponent key={docFile.slug} />
              </DemoContent>
            </Document>,
          )
        }

        if (docFile !== undefined) {
          let { html, headings, source } = await renderMarkdownFile(
            docFile.path,
            docsContext.docFilesLookup,
            options.activeVersion,
            // Don't auto-link code symbols in README - too many false positives.
            docFile.kind !== 'package',
          )
          return render(
            <Document {...docProps} sourceUrl={source} headings={headings}>
              <MarkdownContent html={html} />
            </Document>,
          )
        }

        let navPackage = getNavPackage(registry, getDocPage(registry, params.slug)?.packageId)
        if (navPackage) {
          return render(
            <Document {...docProps}>
              <PackageIndex registry={registry} navPackage={navPackage} />
            </Document>,
          )
        }

        return render(
          <Document {...docProps}>
            <NotFound slug={params.slug} />
          </Document>,
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
            headers: { 'content-type': 'text/markdown; charset=utf-8' },
          })
        }

        return fileResponse(request, docFile.path)
      },
    },
  })
}
