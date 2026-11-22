import { css, type Handle } from 'remix/component'

import type { Category, Family } from '../../data/schema.ts'
import { routes } from '../../routes.ts'
import { Breadcrumbs } from '../../ui/breadcrumbs.tsx'
import { CatalogLink } from '../../ui/catalog-link.tsx'
import { ProductImage, type ProductImageSource } from '../../ui/product-image.tsx'
import { colors, headingStyle } from '../../ui/public/theme.ts'
import { formatCount, formatPrice } from '../../utils/format.ts'

export interface FamilySummary {
  family: Family
  image: ProductImageSource
  specNames: string[]
}

export interface CategoryPageProps {
  category: Category
  families: FamilySummary[]
}

export function CategoryPage(handle: Handle<CategoryPageProps>) {
  return () => {
    let { category, families } = handle.props

    return (
      <div>
        <Breadcrumbs items={[{ label: 'Catalog', href: routes.home.href() }]} />
        <h1 mix={headingStyle}>{category.name}</h1>

        <ul mix={listStyle}>
          {families.map(({ family, image, specNames }) => (
            <li key={family.slug}>
              <CatalogLink
                href={routes.catalog.family.href({ category: category.slug, family: family.slug })}
                mix={cardStyle}
              >
                <ProductImage image={image} loading="eager" />
                <div mix={cardBodyStyle}>
                  <h2 mix={cardTitleStyle}>{family.name}</h2>
                  <p mix={descriptionStyle}>{family.description}</p>
                  <p mix={metaStyle}>
                    {formatCount(family.part_count)} parts · from {formatPrice(family.lowest_price)}{' '}
                    · Choose by {specNames.join(', ').toLowerCase()}
                  </p>
                </div>
              </CatalogLink>
            </li>
          ))}
        </ul>
      </div>
    )
  }
}

const listStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(22rem, 1fr))',
  gap: '1rem',
  margin: 0,
  padding: 0,
  listStyle: 'none',
})

const cardStyle = css({
  display: 'flex',
  gap: '1rem',
  height: '100%',
  padding: '1rem',
  border: `1px solid ${colors.border}`,
  borderRadius: '4px',
  color: colors.text,
  textDecoration: 'none',
  '&:hover': { borderColor: colors.muted },
  '&:hover h2': { color: colors.link, textDecoration: 'underline' },
})

const cardBodyStyle = css({ display: 'grid', gap: '0.3rem', alignContent: 'start' })

const cardTitleStyle = css({ margin: 0, fontSize: '1.05rem' })

const descriptionStyle = css({ margin: 0 })

const metaStyle = css({ margin: 0, color: colors.muted, fontSize: '0.85rem' })
