import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import type { Product } from '../data/products.ts'
import { routes } from '../routes.ts'

export type RequestKind = 'prefetch' | 'frame navigation' | 'document load'

type ProductPageProps = {
  product: Product
  requestedAs: RequestKind
  renderedAt: Date
}

export function ProductPage(handle: Handle<ProductPageProps>) {
  return () => {
    let { product, requestedAs, renderedAt } = handle.props

    return (
      <article>
        <a href={routes.home.href()} mix={backLinkStyle}>
          ← Back to catalog
        </a>
        <h1 mix={titleStyle}>{product.name}</h1>
        <p mix={priceStyle}>{product.price}</p>
        <p mix={descriptionStyle}>{product.description}</p>

        <dl mix={detailsStyle}>
          <dt>Requested as</dt>
          <dd data-testid="requested-as">{requestedAs}</dd>
          <dt>Rendered at</dt>
          <dd>{renderedAt.toISOString().slice(11, 23)} UTC</dd>
        </dl>
      </article>
    )
  }
}

const backLinkStyle = css({
  color: '#57534e',
})

const titleStyle = css({
  margin: '1.5rem 0 0.25rem',
})

const priceStyle = css({
  margin: 0,
  fontSize: '1.25rem',
  color: '#57534e',
})

const descriptionStyle = css({
  maxWidth: '36rem',
  lineHeight: 1.6,
})

const detailsStyle = css({
  display: 'grid',
  gridTemplateColumns: 'max-content 1fr',
  gap: '0.5rem 1.5rem',
  marginTop: '2rem',
  padding: '1rem 1.25rem',
  border: '1px dashed #a8a29e',
  borderRadius: '12px',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '0.875rem',
  '& dt': {
    color: '#57534e',
  },
  '& dd': {
    margin: 0,
  },
})
