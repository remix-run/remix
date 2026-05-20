import * as path from 'node:path'

import type { Router } from 'remix/router'
import { renderWith } from 'remix/middleware/render'
import { createHtmlResponse } from 'remix/response/html'
import type { RemixNode } from 'remix/ui'
import { renderToStream } from 'remix/ui/server'

import { assetServer } from '../utils/assets.ts'

export function render() {
  return renderWith(
    ({ request, router }) =>
      function render(node: RemixNode, init?: ResponseInit) {
        let stream = renderToStream(node, {
          signal: request.signal,
          resolveFrame: (src) => resolveFrame(router, request, src),
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
          onError(error) {
            console.error(error)
          },
        })

        return createHtmlResponse(stream, init)
      },
  )
}

async function resolveFrame(router: Router, request: Request, src: string) {
  let url = new URL(src, request.url)

  let headers = new Headers()
  headers.set('Accept', 'text/html')
  headers.set('Accept-Encoding', 'identity')

  let cookie = request.headers.get('Cookie')
  if (cookie) headers.set('Cookie', cookie)

  let res = await router.fetch(
    new Request(url, {
      method: 'GET',
      headers,
      signal: request.signal,
    }),
  )

  if (!res.ok) {
    return `<pre>Frame error: ${res.status} ${res.statusText}</pre>`
  }

  return res.text()
}

export function fragmentResponseInit(init?: ResponseInit): ResponseInit {
  let headers = new Headers(init?.headers)
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'no-store')
  }

  return { ...init, headers }
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
