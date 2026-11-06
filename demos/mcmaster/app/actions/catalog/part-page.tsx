import { css, type Handle } from 'remix/component'

import type { Category, Family, Part, Presentation } from '../../data/schema.ts'
import { toParam, type SpecColumn } from '../../data/specs.ts'
import { routes } from '../../routes.ts'
import { Breadcrumbs } from '../../ui/breadcrumbs.tsx'
import { CatalogLink } from '../../ui/catalog-link.tsx'
import { ProductImage, type ProductImageSource } from '../../ui/product-image.tsx'
import { colors, headingStyle, linkStyle } from '../../ui/public/theme.ts'
import { formatPrice } from '../../utils/format.ts'
import { AddToCartForm } from './public/add-to-cart-form.tsx'

export interface PartPageProps {
  part: Part
  image: ProductImageSource
  family: Family
  presentation: Presentation
  category: Category
  columns: SpecColumn[]
  specValues: string[]
}

export function PartPage(handle: Handle<PartPageProps>) {
  return () => {
    let { part, image, family, presentation, category, columns, specValues } = handle.props
    let title = `${presentation.name} ${family.name}, ${specValues.join(', ')}`
    let familyHref = routes.catalog.family.href({ category: category.slug, family: family.slug })

    return (
      <div>
        {/* Declaring the photo lets hover prefetching download it along with this page's HTML. */}
        <link rel="preload" as="image" href={image.src} fetchpriority="high" />
        <Breadcrumbs
          items={[
            { label: 'Catalog', href: routes.home.href() },
            {
              label: category.name,
              href: routes.catalog.category.href({ category: category.slug }),
            },
            { label: family.name, href: familyHref },
          ]}
        />

        <div mix={layoutStyle}>
          <div mix={imageStyle}>
            <ProductImage image={image} alt={title} loading="eager" fetchpriority="high" />
          </div>

          <div>
            <p mix={partNumberStyle}>{part.part_number}</p>
            <h1 mix={headingStyle}>{title}</h1>

            <p mix={priceStyle}>
              {formatPrice(part.price)}{' '}
              <span mix={packStyle}>{specValues[specValues.length - 1]}</span>
            </p>
            <AddToCartForm partNumber={part.part_number} />

            <table mix={specTableStyle}>
              <caption>Specifications</caption>
              <tbody>
                <tr>
                  <th scope="row">{family.presentation_label}</th>
                  <td>
                    <CatalogLink
                      href={`${familyHref}?${new URLSearchParams({ [toParam(family.presentation_label)]: presentation.slug })}`}
                      mix={linkStyle}
                    >
                      {presentation.name}
                    </CatalogLink>
                  </td>
                </tr>
                {columns.map((column, index) => (
                  <tr key={column.param}>
                    <th scope="row">{column.name}</th>
                    <td>
                      <CatalogLink
                        href={`${familyHref}?${new URLSearchParams({ [column.param]: specValues[index] })}`}
                        mix={linkStyle}
                      >
                        {specValues[index]}
                      </CatalogLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p mix={hintStyle}>
              Select a value to see every {family.name.toLowerCase()} that share it.
            </p>
          </div>
        </div>
      </div>
    )
  }
}

const layoutStyle = css({
  display: 'grid',
  gridTemplateColumns: '18rem minmax(0, 36rem)',
  gap: '2rem',
  alignItems: 'start',
  '@media (max-width: 720px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
})

const imageStyle = css({
  display: 'grid',
  placeItems: 'center',
  aspectRatio: '1',
  border: `1px solid ${colors.border}`,
  borderRadius: '4px',
})

const partNumberStyle = css({
  margin: '0 0 0.2rem',
  color: colors.muted,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
})

const priceStyle = css({ margin: '0 0 0.75rem', fontSize: '1.4rem', fontWeight: 700 })

const packStyle = css({ fontSize: '0.9rem', fontWeight: 400, color: colors.muted })

const specTableStyle = css({
  width: '100%',
  marginTop: '1.5rem',
  borderCollapse: 'collapse',
  '& caption': { textAlign: 'left', fontWeight: 700, paddingBottom: '0.4rem' },
  '& th, & td': {
    padding: '0.35rem 0.5rem',
    borderBottom: `1px solid ${colors.border}`,
    textAlign: 'left',
  },
  '& th': { width: '40%', color: colors.muted, fontWeight: 500 },
})

const hintStyle = css({ margin: '0.5rem 0 0', color: colors.muted, fontSize: '0.85rem' })
