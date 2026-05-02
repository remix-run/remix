import * as path from 'node:path'

import type { RemixNode } from 'remix/ui'
import { renderToStream } from 'remix/ui/server'

import { assetServer } from './controller.tsx'
import { router } from '../router.ts'

export function render(node: RemixNode, request: Request, init?: ResponseInit) {
  let stream = renderToStream(node, {
    frameSrc: request.url,
    async resolveClientEntry(entryId, component) {
      if (!entryId.startsWith('file://')) {
        throw new Error(`Expected \`import.meta.url\` for clientEntry ID, received '${entryId}'`)
      }

      return {
        href: await assetServer.getHref(entryId),
        exportName: entryId.split('#')[1] || component.name || titleCaseFileName(entryId),
      }
    },
    async resolveFrame(src, target) {
      let headers = new Headers({ accept: 'text/html' })
      let cookie = request.headers.get('cookie')
      if (cookie) headers.set('cookie', cookie)
      if (target) headers.set('x-remix-target', target)

      let response = await router.fetch(new Request(new URL(src, request.url), { headers }))
      return response.body ?? response.text()
    },
  })

  let headers = new Headers(init?.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'text/html; charset=utf-8')
  }

  return new Response(stream, { ...init, headers })
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
