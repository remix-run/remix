import { css, type Handle } from 'remix/component'

import type { Category, Family, Section } from '../data/schema.ts'
import { routes } from '../routes.ts'
import { CatalogLink } from '../ui/catalog-link.tsx'
import { ProductImage, type ProductImageSource } from '../ui/product-image.tsx'
import { colors, headingStyle, linkStyle } from '../ui/public/theme.ts'

export interface HomeSection extends Section {
  categories: Array<Category & { families: Family[]; image: ProductImageSource }>
}

export function HomePage(handle: Handle<{ sections: HomeSection[] }>) {
  return () => (
    <div>
      <h1 mix={headingStyle}>Browse the catalog</h1>
      <p mix={introStyle}>
        Hover any link and its page starts loading before you click. Watch the Speed HUD in the
        corner to see where each page came from.
      </p>

      {handle.props.sections.map((section, sectionIndex) => (
        <section key={section.slug} mix={sectionStyle}>
          <h2 mix={sectionHeadingStyle}>{section.name}</h2>
          <ul mix={gridStyle}>
            {section.categories.map((category) => (
              <li key={category.slug} mix={tileStyle}>
                <CatalogLink
                  href={routes.catalog.category.href({ category: category.slug })}
                  mix={tileLinkStyle}
                >
                  <ProductImage
                    image={category.image}
                    loading={sectionIndex === 0 ? 'eager' : 'lazy'}
                  />
                  <span>{category.name}</span>
                </CatalogLink>
                <ul mix={familyListStyle}>
                  {category.families.map((family) => (
                    <li key={family.slug}>
                      <CatalogLink
                        href={routes.catalog.family.href({
                          category: category.slug,
                          family: family.slug,
                        })}
                        mix={linkStyle}
                      >
                        {family.name}
                      </CatalogLink>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

const introStyle = css({ margin: '0 0 1.5rem', color: colors.muted, maxWidth: '40rem' })

const sectionStyle = css({ marginBottom: '1.75rem' })

const sectionHeadingStyle = css({
  margin: '0 0 0.75rem',
  paddingBottom: '0.3rem',
  borderBottom: `2px solid ${colors.text}`,
  fontSize: '1.05rem',
})

const gridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(12rem, 1fr))',
  gap: '1rem 1.5rem',
  margin: 0,
  padding: 0,
  listStyle: 'none',
})

const tileStyle = css({ display: 'grid', gap: '0.35rem', alignContent: 'start' })

const tileLinkStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  color: colors.text,
  fontWeight: 600,
  textDecoration: 'none',
  '&:hover span:last-child': { textDecoration: 'underline' },
})

const familyListStyle = css({
  margin: 0,
  paddingLeft: 'calc(64px + 0.6rem)',
  listStyle: 'none',
  fontSize: '0.9rem',
})
