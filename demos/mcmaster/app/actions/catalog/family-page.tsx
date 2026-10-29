import { css, type Handle } from 'remix/component'

import type { Category, Family, Part, Presentation } from '../../data/schema.ts'
import type { SpecColumn } from '../../data/specs.ts'
import { routes } from '../../routes.ts'
import { Breadcrumbs } from '../../ui/breadcrumbs.tsx'
import { CatalogLink } from '../../ui/catalog-link.tsx'
import { colors, headingStyle, linkStyle } from '../../ui/public/theme.ts'
import { ProductImage, type ProductImageSource } from '../../ui/product-image.tsx'
import { formatCount, formatPrice } from '../../utils/format.ts'
import { getFilterHref, type Filter } from './family-filters.ts'

export interface PresentationSection {
  presentation: Presentation
  image: ProductImageSource
  eager: boolean
  /** Parts in this presentation that match the active filters. */
  matchCount: number
  parts: Array<Part & { specValues: string[] }>
}

export interface FamilyPageProps {
  family: Family
  category: Category
  columns: SpecColumn[]
  filters: Filter[]
  sections: PresentationSection[]
  singlePresentation: boolean
  url: URL
}

export function FamilyPage(handle: Handle<FamilyPageProps>) {
  return () => {
    let { family, category, columns, filters, sections, singlePresentation, url } = handle.props
    let presentationFilter = filters[0]
    let hasFilters = filters.some((filter) => filter.options.some((option) => option.selected))
    let matchCount = sections.reduce((total, section) => total + section.matchCount, 0)

    return (
      <div>
        {sections[0] ? <link rel="preload" as="image" href={sections[0].image.src} /> : null}
        <Breadcrumbs
          items={[
            { label: 'Catalog', href: routes.home.href() },
            {
              label: category.name,
              href: routes.catalog.category.href({ category: category.slug }),
            },
          ]}
        />
        <h1 mix={headingStyle}>{family.name}</h1>
        <p mix={descriptionStyle}>{family.description}</p>

        <div mix={layoutStyle}>
          <aside aria-label="Filters" mix={filtersStyle}>
            {filters.map((filter) => (
              <section key={filter.param}>
                <h2 mix={filterHeadingStyle}>{filter.name}</h2>
                <ul mix={filterListStyle}>
                  {filter.options.map((option) => (
                    <li key={option.value}>
                      {option.selected ? (
                        <CatalogLink
                          href={getFilterHref(url, filter.param, null)}
                          aria-label={`Remove filter ${filter.name}: ${option.label}`}
                          data-rmx-reset-scroll="manual"
                          mix={selectedOptionStyle}
                        >
                          <span>{option.label}</span>
                          <span aria-hidden="true">×</span>
                        </CatalogLink>
                      ) : option.count === 0 ? (
                        <span mix={unavailableOptionStyle}>{option.label}</span>
                      ) : (
                        <CatalogLink
                          href={getFilterHref(url, filter.param, option.value)}
                          data-rmx-reset-scroll="manual"
                          mix={optionStyle}
                        >
                          <span>{option.label}</span>
                          <span mix={countStyle}>{formatCount(option.count)}</span>
                        </CatalogLink>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </aside>

          <div>
            <p mix={resultCountStyle}>
              {formatCount(matchCount)} of {formatCount(family.part_count)} parts
              {hasFilters ? (
                <>
                  {' · '}
                  <CatalogLink href={url.pathname} data-rmx-reset-scroll="manual" mix={linkStyle}>
                    Clear filters
                  </CatalogLink>
                </>
              ) : null}
            </p>

            {sections.map((section) => (
              <section
                key={section.presentation.slug}
                aria-labelledby={`presentation-${section.presentation.slug}`}
                mix={presentationStyle}
              >
                <div mix={presentationHeaderStyle}>
                  <ProductImage image={section.image} loading={section.eager ? 'eager' : 'lazy'} />
                  <div>
                    <h2
                      id={`presentation-${section.presentation.slug}`}
                      mix={presentationTitleStyle}
                    >
                      {section.presentation.name} {family.name}
                    </h2>
                    <p mix={presentationDescriptionStyle}>{section.presentation.description}</p>
                  </div>
                </div>

                <div mix={tableWrapStyle}>
                  <table mix={tableStyle}>
                    <thead>
                      <tr>
                        <th scope="col">Part Number</th>
                        {columns.map((column) => (
                          <th key={column.param} scope="col">
                            {column.name}
                          </th>
                        ))}
                        <th scope="col" mix={numericCellStyle}>
                          Price
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.parts.map((part) => (
                        <tr key={part.part_number}>
                          <th scope="row">
                            <CatalogLink
                              href={routes.catalog.part.href({ partNumber: part.part_number })}
                              mix={partNumberStyle}
                            >
                              {part.part_number}
                            </CatalogLink>
                          </th>
                          {part.specValues.map((value, index) => (
                            <td key={columns[index].param}>{value}</td>
                          ))}
                          <td mix={numericCellStyle}>{formatPrice(part.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <MoreParts
                  section={section}
                  familyName={family.name}
                  href={getFilterHref(url, presentationFilter.param, section.presentation.slug)}
                  singlePresentation={singlePresentation}
                />
              </section>
            ))}
          </div>
        </div>
      </div>
    )
  }
}

interface MorePartsProps {
  section: PresentationSection
  familyName: string
  href: string
  singlePresentation: boolean
}

function MoreParts(handle: Handle<MorePartsProps>) {
  return () => {
    let { section, familyName, href, singlePresentation } = handle.props
    let hidden = section.matchCount - section.parts.length
    if (hidden <= 0) return null

    if (singlePresentation) {
      return (
        <p mix={moreStyle}>
          Showing {formatCount(section.parts.length)} of {formatCount(section.matchCount)}. Choose
          more specs to narrow the list.
        </p>
      )
    }

    return (
      <p mix={moreStyle}>
        <CatalogLink href={href} mix={linkStyle}>
          See {formatCount(section.matchCount)} {section.presentation.name.toLowerCase()}{' '}
          {familyName.toLowerCase()}
        </CatalogLink>
      </p>
    )
  }
}

const descriptionStyle = css({ margin: '0 0 1rem', color: colors.muted, maxWidth: '44rem' })

const layoutStyle = css({
  display: 'grid',
  gridTemplateColumns: '13rem minmax(0, 1fr)',
  gap: '1.5rem',
  alignItems: 'start',
  '@media (max-width: 900px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
})

const filtersStyle = css({ display: 'grid', gap: '1rem' })

const filterHeadingStyle = css({
  margin: '0 0 0.3rem',
  fontSize: '0.8rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: colors.muted,
})

const filterListStyle = css({
  display: 'grid',
  gap: '1px',
  maxHeight: '18rem',
  overflowY: 'auto',
  margin: 0,
  padding: 0,
  listStyle: 'none',
})

const optionBase = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '0.5rem',
  padding: '0.15rem 0.4rem',
  borderRadius: '3px',
}

const optionStyle = css({
  ...optionBase,
  color: colors.text,
  textDecoration: 'none',
  '&:hover': { backgroundColor: colors.subtle, color: colors.link },
})

const selectedOptionStyle = css({
  ...optionBase,
  backgroundColor: colors.brand,
  color: colors.text,
  fontWeight: 600,
  textDecoration: 'none',
})

const unavailableOptionStyle = css({ ...optionBase, color: '#a3a9b0' })

const countStyle = css({ color: colors.muted, fontVariantNumeric: 'tabular-nums' })

const resultCountStyle = css({ margin: '0 0 0.75rem', color: colors.muted })

const presentationStyle = css({
  marginBottom: '2rem',
  paddingTop: '0.75rem',
  borderTop: `2px solid ${colors.text}`,
})

const presentationHeaderStyle = css({
  display: 'flex',
  gap: '1rem',
  alignItems: 'center',
  marginBottom: '0.5rem',
})

const presentationTitleStyle = css({ margin: '0 0 0.2rem', fontSize: '1.05rem' })

const presentationDescriptionStyle = css({ margin: 0, color: colors.muted })

const tableWrapStyle = css({ overflowX: 'auto' })

const tableStyle = css({
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.9rem',
  '& th, & td': {
    padding: '0.25rem 0.6rem',
    borderBottom: `1px solid ${colors.border}`,
    textAlign: 'left',
    whiteSpace: 'nowrap',
  },
  '& thead th': { backgroundColor: colors.subtle, fontSize: '0.8rem' },
  '& tbody tr:hover': { backgroundColor: '#fffbe6' },
})

const numericCellStyle = css({
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  '&&': { textAlign: 'right' },
})

const partNumberStyle = css({
  color: colors.link,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontWeight: 500,
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' },
})

const moreStyle = css({ margin: '0.5rem 0 0', color: colors.muted })
