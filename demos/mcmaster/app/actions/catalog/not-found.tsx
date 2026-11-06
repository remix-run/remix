import type { Handle } from 'remix/component'

import { routes } from '../../routes.ts'
import { CatalogLink } from '../../ui/catalog-link.tsx'
import { headingStyle, linkStyle } from '../../ui/public/theme.ts'

export function NotFound(_handle: Handle) {
  return () => (
    <div>
      <h1 mix={headingStyle}>We couldn't find that part</h1>
      <p>
        It may have moved.{' '}
        <CatalogLink href={routes.home.href()} mix={linkStyle}>
          Browse the catalog
        </CatalogLink>{' '}
        to find what you need.
      </p>
    </div>
  )
}
