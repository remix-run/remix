import { renderWith } from 'remix/middleware/render'
import { createHtmlResponse } from 'remix/response/html'
import type { RemixNode } from 'remix/ui'
import { renderToStream } from 'remix/ui/server'

import { assetServer } from '../assets.ts'
import { Document } from '../ui/document.tsx'
import { AssetEntry, type AssetEntryValue } from './asset-entry.ts'

export interface RenderOptions {
  document?: { title?: string } | false
  responseInit?: ResponseInit
}

export function render() {
  return renderWith(
    ({ get, request }) =>
      function render(node: RemixNode, options?: RenderOptions): Response {
        let documentOptions = options?.document
        let renderedNode = node

        if (documentOptions !== false) {
          // renderWith cannot retain the upstream middleware entries in its factory context type.
          let assetEntry = get(AssetEntry) as AssetEntryValue
          renderedNode = (
            <Document assetEntry={assetEntry} title={documentOptions?.title}>
              {node}
            </Document>
          )
        }

        let stream = renderToStream(renderedNode, {
          signal: request.signal,
          async resolveClientEntry(entryId, component) {
            if (!entryId.startsWith('file://')) {
              throw new Error(`Expected a source module URL, received '${entryId}'`)
            }

            let exportName = entryId.split('#')[1] || component.name

            if (!exportName) {
              throw new Error(`Unable to resolve a client entry export for '${entryId}'`)
            }

            return {
              href: await assetServer.getHref(entryId),
              exportName,
            }
          },
          onError(error) {
            console.error(error)
          },
        })

        return createHtmlResponse(stream, options?.responseInit)
      },
  )
}
