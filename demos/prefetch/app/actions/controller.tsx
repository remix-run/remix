import { createController } from 'remix/router'

import { findProduct } from '../data/products.ts'
import { routes } from '../routes.ts'
import { Document } from '../ui/document.tsx'
import { assets } from '../utils/assets.ts'
import { HomePage } from './home-page.tsx'
import { ProductPage, type RequestKind } from './product-page.tsx'

const ASSET_RESPONSE_DELAY_MS = 200
const PRODUCT_RENDER_DELAY_MS = 800

const PRODUCT_STYLESHEET_PATH = new URL('./public/product.css', import.meta.url).pathname

export default createController(routes, {
  actions: {
    async assets({ request }) {
      await new Promise((resolve) => setTimeout(resolve, ASSET_RESPONSE_DELAY_MS))
      let assetResponse = await assets.fetch(request)
      return assetResponse ?? new Response('Not found', { status: 404 })
    },
    async home({ render, url }) {
      let mode = url.searchParams.get('prefetch')
      return render(
        <Document title="Catalog">
          <HomePage prefetchMode={mode === 'render' || mode === 'viewport' ? mode : 'intent'} />
        </Document>,
        { headers: { 'Cache-Control': 'no-store' } },
      )
    },
    async product({ params, render, request }) {
      let product = findProduct(params.slug)
      if (!product) return new Response('Not found', { status: 404 })

      await new Promise((resolve) => setTimeout(resolve, PRODUCT_RENDER_DELAY_MS))

      let cacheControl = product.slug === 'enamel-mug' ? 'no-store' : 'private, max-age=30'
      return render(
        <Document title={product.name} stylesheet={await assets.getHref(PRODUCT_STYLESHEET_PATH)}>
          <ProductPage
            product={product}
            requestedAs={getRequestKind(request)}
            renderedAt={new Date()}
            cacheControl={cacheControl}
          />
        </Document>,
        { headers: { 'Cache-Control': cacheControl } },
      )
    },
  },
})

function getRequestKind(request: Request): RequestKind {
  if (request.headers.get('X-Remix-Frame') === 'true') return 'frame request'
  return 'document load'
}
