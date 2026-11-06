import { css, Frame, type Handle, type RemixNode } from 'remix/component'

import type { Category, Section } from '../data/schema.ts'
import { getSpeedSettings } from '../middleware/speed-settings.ts'
import { frames, routes } from '../routes.ts'
import { latencyOptions } from '../utils/speed-settings.ts'
import { CatalogLink } from './catalog-link.tsx'
import { Document } from './document.tsx'
import { SpeedHud } from './public/speed-hud.tsx'
import { colors } from './public/theme.ts'

export interface NavigationSection extends Section {
  categories: Category[]
}

export interface LayoutProps {
  title: string
  navigation: NavigationSection[]
  children?: RemixNode
}

/**
 * The document shell. Only full document requests render it; content-frame navigations leave the
 * header, catalog navigation, cart summary, and HUD in place and swap only `children`.
 */
export function Layout(handle: Handle<LayoutProps>) {
  return () => {
    let { title, navigation, children } = handle.props
    let { techniques, latency } = getSpeedSettings()

    return (
      <Document title={title}>
        <div mix={shellStyle}>
          <header mix={headerStyle}>
            <CatalogLink href={routes.home.href()} mix={brandStyle}>
              <span mix={logoStyle}>RS</span>
              <span>Remix Supply</span>
            </CatalogLink>
            <p mix={taglineStyle}>A McMaster-Carr speed study, built with Remix</p>
            <Frame name={frames.cartSummary} src={routes.fragments.cartSummary.href()} />
          </header>

          <nav aria-label="Catalog" mix={sidebarStyle}>
            {navigation.map((section) => (
              <section key={section.slug}>
                <h2 mix={sidebarHeadingStyle}>{section.name}</h2>
                <ul mix={sidebarListStyle}>
                  {section.categories.map((category) => (
                    <li key={category.slug}>
                      <CatalogLink href={routes.catalog.category.href({ category: category.slug })}>
                        {category.name}
                      </CatalogLink>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </nav>

          <main mix={mainStyle}>{children}</main>
        </div>

        <SpeedHud techniques={techniques} latency={latency} latencyOptions={latencyOptions} />
      </Document>
    )
  }
}

const shellStyle = css({
  display: 'grid',
  gridTemplateColumns: '13rem minmax(0, 1fr)',
  gridTemplateRows: 'auto 1fr',
  gridTemplateAreas: '"header header" "sidebar main"',
  minHeight: '100vh',
  '@media (max-width: 720px)': {
    gridTemplateColumns: 'minmax(0, 1fr)',
    gridTemplateAreas: '"header" "main" "sidebar"',
  },
})

const headerStyle = css({
  gridArea: 'header',
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  padding: '0.6rem 1rem',
  borderBottom: `1px solid ${colors.border}`,
})

const brandStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  color: colors.text,
  fontSize: '1.15rem',
  fontWeight: 700,
  textDecoration: 'none',
})

const logoStyle = css({
  display: 'inline-grid',
  placeItems: 'center',
  width: '2rem',
  height: '2rem',
  borderRadius: '3px',
  backgroundColor: colors.brand,
  fontSize: '0.85rem',
  fontWeight: 800,
})

const taglineStyle = css({
  flex: 1,
  margin: 0,
  color: colors.muted,
  '@media (max-width: 720px)': { display: 'none' },
})

const sidebarStyle = css({
  gridArea: 'sidebar',
  padding: '1rem',
  borderRight: `1px solid ${colors.border}`,
  backgroundColor: colors.subtle,
  '& a': { color: colors.text, textDecoration: 'none' },
  '& a:hover': { color: colors.link, textDecoration: 'underline' },
})

const sidebarHeadingStyle = css({
  margin: '0 0 0.25rem',
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: colors.muted,
})

const sidebarListStyle = css({
  margin: '0 0 1rem',
  padding: 0,
  listStyle: 'none',
  '& li': { padding: '0.1rem 0' },
})

const mainStyle = css({
  gridArea: 'main',
  minWidth: 0,
  padding: '1rem 1.5rem 6rem',
})
