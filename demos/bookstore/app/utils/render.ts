import type { RemixNode } from 'remix/component'
import { renderToString } from 'remix/component/server'
import { createHtmlResponse } from 'remix'
import { getContext } from 'remix/async-context-middleware'

export async function render(node: RemixNode, init?: ResponseInit) {
  let context = getContext()
  let assets = context?.assets

  let html = await renderToString(node, {
    resolveHydrationRootUrl(url) {
      if (!url.startsWith('file://')) {
        return url
      }

      let entry = assets?.get(url)
      if (!entry) {
        throw new Error(
          `Asset not found: ${url}. ` +
            `Make sure this file is included in your build's entry points.`,
        )
      }

      return entry.href
    },
  })
  return createHtmlResponse(html, init)
}
