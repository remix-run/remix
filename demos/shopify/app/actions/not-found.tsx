import type { RouterTypes } from 'remix/router'

import { routes } from '../routes.ts'
import { Document } from '../ui/document.tsx'

export function notFound({ method, render }: RouterTypes['context']): Response {
  let response = render(<NotFoundPage />, { status: 404 })
  // The router strips HEAD bodies for matched GET routes, but not for its default handler.
  return method === 'HEAD' ? new Response(null, response) : response
}

function NotFoundPage() {
  return () => (
    <Document title="Page not found" description="This page is not part of the Shopify demo.">
      <section class="not-found section-space container">
        <p class="eyebrow">404 / A little off the map</p>
        <h1>
          Let’s find your
          <br />
          next step.
        </h1>
        <p>That page isn’t here. There’s plenty more to explore.</p>
        <a class="button button-white" href={routes.home.href()}>
          Back to the homepage →
        </a>
      </section>
    </Document>
  )
}
