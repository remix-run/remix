import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import type { Product } from '../data/products.ts'
import { routes } from '../routes.ts'

export function ProductCard(handle: Handle<{ product: Product; prefetch?: boolean }>) {
  return () => {
    let { product, prefetch } = handle.props

    return (
      <a
        href={routes.product.href({ slug: product.slug })}
        data-rmx-prefetch={prefetch ? 'intent' : undefined}
        mix={cardStyle}
      >
        <span mix={nameStyle}>{product.name}</span>
        <span mix={priceStyle}>{product.price}</span>
      </a>
    )
  }
}

const cardStyle = css({
  display: 'grid',
  gap: '0.25rem',
  padding: '1.25rem',
  border: '1px solid #e7e5e4',
  borderRadius: '12px',
  backgroundColor: '#ffffff',
  color: 'inherit',
  textDecoration: 'none',
  '&:hover, &:focus-visible': {
    borderColor: '#a8a29e',
  },
})

const nameStyle = css({
  fontWeight: 600,
})

const priceStyle = css({
  color: '#57534e',
})
