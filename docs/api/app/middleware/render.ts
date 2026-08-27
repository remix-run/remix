import { renderWith } from 'remix/middleware/render'
import type { RequestContext } from 'remix/router'
import { createHtmlResponse } from 'remix/response/html'
import type { RemixNode } from 'remix/ui'
import { renderToStream, type ResolveFrameContext } from 'remix/ui/server'

import type { DocsAssetServer } from '../assets.ts'

export function render(assetServer: DocsAssetServer) {
  return renderWith(
    (context) =>
      function renderDocument(node: RemixNode, init?: ResponseInit) {
        let stream = renderToStream(node, {
          frameSrc: context.request.url,
          signal: context.request.signal,
          resolveFrame: (src, target, frameContext) =>
            resolveFrame(context, src, target, frameContext),
          async resolveClientEntry(entryId, component) {
            let { moduleId, exportName: explicitExportName } = parseClientEntryId(entryId)
            let exportName = explicitExportName || component.name
            if (!exportName) {
              throw new Error(`Unable to resolve client entry export for ${entryId}`)
            }

            if (!moduleId.startsWith('file://')) {
              return { href: moduleId, exportName }
            }

            let { href, importMap, preloads } = await assetServer.getScriptEntry(moduleId)

            return {
              href,
              importMap,
              exportName,
              preloads,
            }
          },
          onError(error) {
            console.error(error)
          },
        })

        return createHtmlResponse(stream, init)
      },
  )
}

function parseClientEntryId(entryId: string): {
  moduleId: string
  exportName?: string
} {
  let hashIndex = entryId.lastIndexOf('#')
  if (hashIndex === -1) {
    return { moduleId: entryId }
  }

  let exportName = entryId.slice(hashIndex + 1)
  return {
    moduleId: entryId.slice(0, hashIndex),
    ...(exportName ? { exportName } : {}),
  }
}

async function resolveFrame(
  context: RequestContext,
  src: string,
  target?: string,
  frameContext?: ResolveFrameContext,
) {
  let frameUrl = new URL(src, frameContext?.currentFrameSrc ?? context.request.url)
  let headers = new Headers({
    Accept: 'text/html',
    'Accept-Encoding': 'identity',
    'X-Remix-Frame': 'true',
  })

  if (target) {
    headers.set('X-Remix-Target', target)
  }

  let response = await context.router.fetch(
    new Request(frameUrl, {
      method: 'GET',
      headers,
      signal: context.request.signal,
    }),
  )

  if (response.ok) {
    return response.body ?? response.text()
  }

  return `<pre>Frame error: ${response.status} ${response.statusText}</pre>`
}
