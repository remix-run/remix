import { createController } from 'remix/router'

import { findProduct } from '../data/products.ts'
import { routes } from '../routes.ts'
import { Document } from '../ui/document.tsx'
import { assets } from '../utils/assets.ts'
import { HomePage } from './home-page.tsx'
import { ProductPage, type RequestKind } from './product-page.tsx'

const PRODUCT_RENDER_DELAY_MS = 800

// The default prefetch strategy relies on the browser's HTTP cache, so prefetched pages must be
// cacheable. Without this header, a prefetch would only add a second request.
const PRODUCT_CACHE_CONTROL = 'private, max-age=30'

export default createController(routes, {
  actions: {
    async assets({ request }) {
      let assetResponse = await assets.fetch(request)
      return assetResponse ?? new Response('Not found', { status: 404 })
    },
    home({ render }) {
      return render(
        <Document title="Catalog">
          <HomePage />
        </Document>,
      )
    },
    async product({ params, render, request }) {
      let product = findProduct(params.slug)
      if (!product) return new Response('Not found', { status: 404 })

      await new Promise((resolve) => setTimeout(resolve, PRODUCT_RENDER_DELAY_MS))

      return render(
        <Document title={product.name}>
          <ProductPage
            product={product}
            requestedAs={getRequestKind(request)}
            renderedAt={new Date()}
          />
        </Document>,
        { headers: { 'Cache-Control': PRODUCT_CACHE_CONTROL } },
      )
    },
  },
})

function getRequestKind(request: Request): RequestKind {
  if (request.headers.get('Sec-Purpose')?.includes('prefetch')) return 'prefetch'
  if (request.headers.get('X-Remix-Frame') === 'true') return 'frame navigation'
  return 'document load'
}
