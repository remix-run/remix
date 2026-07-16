import { renderWith } from 'remix/middleware/render'
import type { RequestContext } from 'remix/router'
import { createHtmlResponse } from 'remix/response/html'
import type { RemixNode } from 'remix/ui'
import { renderToStream, type ResolveFrameContext } from 'remix/ui/server'

import { assetServer } from '../utils/assets.ts'

export function render() {
  return renderWith(
    (context) =>
      function render(node: RemixNode, init?: ResponseInit) {
        let stream = renderToStream(node, {
          frameSrc: context.request.url,
          signal: context.request.signal,
          resolveFrame: (src, target, frameContext) =>
            resolveFrame(context, src, target, frameContext),
          async resolveClientEntry(entryId, component) {
            let { moduleId, exportName: explicitExportName } = parseClientEntryId(entryId)

            if (!moduleId.startsWith('file://')) {
              throw new Error(
                `Expected \`import.meta.url\` for clientEntry ID, received '${entryId}'`,
              )
            }

            let exportName = explicitExportName || component.name
            if (!exportName) {
              throw new Error(`Unable to resolve client entry export for ${entryId}`)
            }

            return {
              href: await assetServer.getHref(moduleId),
              exportName,
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

  let cookie = context.request.headers.get('Cookie')
  if (cookie) {
    headers.set('Cookie', cookie)
  }

  let response = await followFrameRedirects(context, frameUrl, headers)

  if (response.ok) {
    return response.body ?? response.text()
  }

  return `<pre>Frame error: ${response.status} ${response.statusText}</pre>`
}

async function followFrameRedirects(context: RequestContext, url: URL, headers: Headers) {
  let currentUrl = url
  let redirectsRemaining = 10

  while (true) {
    let response = await context.router.fetch(
      new Request(currentUrl, {
        method: 'GET',
        headers,
        signal: context.request.signal,
      }),
    )

    let location = response.headers.get('Location')
    if (!location || response.status < 300 || response.status >= 400) {
      return response
    }

    if (redirectsRemaining-- <= 0) {
      throw new Error('Too many frame redirects')
    }

    currentUrl = new URL(location, currentUrl)
  }
}
