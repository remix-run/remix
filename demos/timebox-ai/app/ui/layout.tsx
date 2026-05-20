import type { RemixNode } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'

import { routes } from '../routes.ts'
import { Document } from './document.tsx'

export interface LayoutProps {
  children?: RemixNode
  title?: string
}

export function Layout() {
  return ({ title, children }: LayoutProps) => (
    <Document title={title}>
      <header mix={headerStyle}>
        <nav mix={navStyle}>
          <a href={routes.home.index.href()} mix={brandStyle}>
            Timebox Ai
          </a>
          <div mix={navLinksStyle}>
            <a href={routes.home.index.href()} mix={navLinkStyle}>
              Home
            </a>
            <a href={routes.auth.index.href()} mix={navLinkStyle}>
              Account
            </a>
          </div>
        </nav>
      </header>
      <main>{children}</main>
    </Document>
  )
}

const headerStyle = css({
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  backgroundColor: theme.surface.lvl0,
})

const navStyle = css({
  alignItems: 'center',
  display: 'flex',
  justifyContent: 'space-between',
  margin: '0 auto',
  maxWidth: '960px',
  minHeight: '64px',
  padding: `0 ${theme.space.xl}`,
})

const brandStyle = css({
  color: theme.colors.text.primary,
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.semibold,
  textDecoration: 'none',
})

const navLinksStyle = css({
  display: 'flex',
  gap: theme.space.md,
})

const navLinkStyle = css({
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  textDecoration: 'none',
  '&:hover': {
    color: theme.colors.text.primary,
  },
})
