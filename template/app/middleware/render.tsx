import * as path from 'node:path'

import { renderWith } from 'remix/middleware/render'
import { createHtmlResponse } from 'remix/response/html'
import type { RemixNode } from 'remix/ui'
import { renderToStream } from 'remix/ui/server'

import { assetServer } from '../assets.ts'

export function render() {
  return renderWith((context) => {
    let request = context.request
    let router = context.router

    return function render(node: RemixNode, init?: ResponseInit) {
      let stream = renderToStream(node, {
        frameSrc: request.url,
        async resolveClientEntry(entryId, component) {
          if (!entryId.startsWith('file://')) {
            throw new Error(
              `Expected \`import.meta.url\` for clientEntry ID, received '${entryId}'`,
            )
          }

          return {
            href: await assetServer.getHref(entryId),
            exportName: entryId.split('#')[1] || component.name || titleCaseFileName(entryId),
          }
        },
        async resolveFrame(src, target, context) {
          let frameSrc = context?.currentFrameSrc ?? request.url
          let url = new URL(src, frameSrc)

          let headers = new Headers()
          headers.set('Accept', 'text/html')
          headers.set('Accept-Encoding', 'identity')
          headers.set('X-Remix-Frame', 'true')

          let cookie = request.headers.get('Cookie')
          if (cookie) headers.set('Cookie', cookie)
          if (target) headers.set('X-Remix-Target', target)

          let response = await router.fetch(url, {
            method: 'GET',
            headers,
            signal: request.signal,
          })

          if (!response.ok) {
            return `<pre>Frame error: ${response.status} ${response.statusText}</pre>`
          }

          return response.body ?? response.text()
        },
      })

      return createHtmlResponse(stream, init)
    }
  })
}

function titleCaseFileName(fileUrl: string): string {
  let url = new URL(fileUrl)
  let fileName = path.basename(url.pathname, path.extname(url.pathname))
  return fileName
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment[0]!.toUpperCase() + segment.slice(1))
    .join('')
}
