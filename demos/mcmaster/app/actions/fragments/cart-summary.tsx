import { css, type Handle } from 'remix/component'

import { routes } from '../../routes.ts'
import { CatalogLink } from '../../ui/catalog-link.tsx'
import { colors } from '../../ui/public/theme.ts'
import { formatPrice } from '../../utils/format.ts'

export function CartSummary(handle: Handle<{ itemCount: number; subtotal: number }>) {
  return () => {
    let { itemCount, subtotal } = handle.props

    return (
      <CatalogLink href={routes.cart.index.href()} prefetch={false} mix={summaryStyle}>
        <strong>Order</strong>
        <span>
          {itemCount === 1 ? '1 item' : `${itemCount} items`} · {formatPrice(subtotal)}
        </span>
      </CatalogLink>
    )
  }
}

const summaryStyle = css({
  display: 'inline-flex',
  gap: '0.5rem',
  padding: '0.35rem 0.75rem',
  border: `1px solid ${colors.border}`,
  borderRadius: '3px',
  color: colors.text,
  textDecoration: 'none',
  fontVariantNumeric: 'tabular-nums',
  '&:hover': { borderColor: colors.muted },
})
