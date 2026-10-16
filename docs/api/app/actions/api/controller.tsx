import { createController } from 'remix/router'

import type { DocsContext, Versions } from '../../data/docs.ts'
import { renderMarkdownFile } from '../../data/markdown.ts'
import { routes } from '../../routes.ts'
import { Document } from '../../ui/document.tsx'
import { fileResponse } from '../file-response.ts'
import { MarkdownContent, NotFound } from './page.tsx'

interface ApiControllerOptions {
  activeVersion?: string
  getDocsContext(): Promise<DocsContext>
  versions: Versions
}

export function createApiController(options: ApiControllerOptions) {
  return createController(routes.api, {
    actions: {
      async document({ params, render }) {
        let docsContext = await options.getDocsContext()
        let docFile = docsContext.docFiles.find((file) => file.urlPath === params.slug)
        let docProps = {
          registry: docsContext.getRegistry(options.activeVersion),
          versions: options.versions,
          slug: params.slug,
          activeVersion: options.activeVersion,
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

        return fileResponse(request, docFile.path)
      },
    },
  })
}
