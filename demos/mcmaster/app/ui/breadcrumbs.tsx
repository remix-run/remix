import { css, type Handle } from 'remix/component'

import { CatalogLink } from './catalog-link.tsx'
import { colors, linkStyle } from './public/theme.ts'

export interface Breadcrumb {
  label: string
  href: string
}

export function Breadcrumbs(handle: Handle<{ items: Breadcrumb[] }>) {
  return () => (
    <nav aria-label="Breadcrumb">
      <ol mix={listStyle}>
        {handle.props.items.map((item) => (
          <li key={item.href}>
            <CatalogLink href={item.href} mix={linkStyle}>
              {item.label}
            </CatalogLink>
          </li>
        ))}
      </ol>
    </nav>
  )
}

const listStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.4rem',
  margin: '0 0 0.75rem',
  padding: 0,
  listStyle: 'none',
  color: colors.muted,
  fontSize: '0.85rem',
  '& li + li::before': { content: '"›"', marginRight: '0.4rem' },
})
