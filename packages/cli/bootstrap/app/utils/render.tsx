import type { RemixNode } from 'remix/ui'
import { renderToStream } from 'remix/ui/server'

import { assets } from '../assets.ts'
import { router } from '../router.ts'

export function render(node: RemixNode, request: Request, init?: ResponseInit) {
  let stream = renderToStream(node, {
    frameSrc: request.url,
    async resolveClientEntry(entryId, component) {
      let { href, exportName } = splitClientEntryId(entryId, component.name)
      return {
        href: href.startsWith('file://') ? await assets.getHref(href) : href,
        exportName,
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

function splitClientEntryId(entryId: string, fallbackExportName: string) {
  let hashIndex = entryId.lastIndexOf('#')
  let href = hashIndex === -1 ? entryId : entryId.slice(0, hashIndex)
  let exportName =
    hashIndex === -1 ? fallbackExportName : entryId.slice(hashIndex + 1) || fallbackExportName

  if (!href) {
    throw new Error(`Unable to resolve client entry href for ${entryId}`)
  }

  if (!exportName) {
    throw new Error(`Unable to resolve client entry export for ${entryId}`)
  }

  return { href, exportName }
}
