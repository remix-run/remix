import { css, type Handle } from 'remix/component'

import { routes } from '../../routes.ts'
import { CatalogLink } from '../../ui/catalog-link.tsx'
import {
  colors,
  headingStyle,
  inputStyle,
  linkStyle,
  secondaryButtonStyle,
} from '../../ui/public/theme.ts'
import { formatPrice } from '../../utils/format.ts'
import { maxQuantity, type CartLine } from '../cart-items.ts'

export interface CartPageProps {
  lines: CartLine[]
  subtotal: number
}

export function CartPage(handle: Handle<CartPageProps>) {
  return () => {
    let { lines, subtotal } = handle.props

    if (lines.length === 0) {
      return (
        <div>
          <h1 mix={headingStyle}>Your order</h1>
          <p>
            Your order is empty.{' '}
            <CatalogLink href={routes.home.href()} mix={linkStyle}>
              Browse the catalog
            </CatalogLink>{' '}
            to add parts.
          </p>
        </div>
      )
    }

    return (
      <div>
        <h1 mix={headingStyle}>Your order</h1>
        <table mix={tableStyle}>
          <thead>
            <tr>
              <th scope="col">Part Number</th>
              <th scope="col">Description</th>
              <th scope="col" mix={numericStyle}>
                Price
              </th>
              <th scope="col">Quantity</th>
              <th scope="col" mix={numericStyle}>
                Total
              </th>
              <th scope="col">
                <span mix={visuallyHiddenStyle}>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.partNumber}>
                <th scope="row">
                  <CatalogLink
                    href={routes.catalog.part.href({ partNumber: line.partNumber })}
                    mix={linkStyle}
                  >
                    {line.partNumber}
                  </CatalogLink>
                </th>
                <td>{line.description}</td>
                <td mix={numericStyle}>{formatPrice(line.part.price)}</td>
                <td>
                  <form method="post" action={routes.cart.update.href()} mix={inlineFormStyle}>
                    <input type="hidden" name="partNumber" value={line.partNumber} />
                    <input
                      type="number"
                      name="quantity"
                      value={String(line.quantity)}
                      min="0"
                      max={String(maxQuantity)}
                      required
                      aria-label={`Quantity for ${line.partNumber}`}
                      mix={inputStyle}
                    />
                    <button type="submit" mix={secondaryButtonStyle}>
                      Update
                    </button>
                  </form>
                </td>
                <td mix={numericStyle}>{formatPrice(line.total)}</td>
                <td>
                  <form method="post" action={routes.cart.remove.href()}>
                    <input type="hidden" name="partNumber" value={line.partNumber} />
                    <button
                      type="submit"
                      aria-label={`Remove ${line.partNumber}`}
                      mix={secondaryButtonStyle}
                    >
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={4} mix={numericStyle}>
                Subtotal
              </th>
              <td mix={numericStyle}>{formatPrice(subtotal)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
        <p mix={mutedStyle}>
          Checkout isn't part of this demo, but your order is saved in a cookie.
        </p>
      </div>
    )
  }
}

const tableStyle = css({
  width: '100%',
  maxWidth: '64rem',
  marginBottom: '1rem',
  borderCollapse: 'collapse',
  '& th, & td': {
    padding: '0.5rem',
    borderBottom: `1px solid ${colors.border}`,
    textAlign: 'left',
    verticalAlign: 'top',
  },
  '& thead th': { backgroundColor: colors.subtle, fontSize: '0.8rem' },
  '& tfoot th, & tfoot td': { fontWeight: 700, borderBottom: 0 },
})

const numericStyle = css({
  fontVariantNumeric: 'tabular-nums',
  '&&': { textAlign: 'right' },
})

const inlineFormStyle = css({ display: 'flex', gap: '0.4rem' })

const mutedStyle = css({ color: colors.muted, fontSize: '0.85rem' })

const visuallyHiddenStyle = css({
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
})
