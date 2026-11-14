import type { RouterTypes } from 'remix/router'

import { routes } from '../routes.ts'
import { Document } from '../ui/document.tsx'

export function notFound({ render }: RouterTypes['context']): Response {
  return render(
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
    </Document>,
    { status: 404 },
  )
}
