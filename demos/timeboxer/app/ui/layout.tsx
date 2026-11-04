import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { theme } from './public/design.ts'

import { routes } from '../routes.ts'
import { Document } from './document.tsx'

export interface LayoutProps {
  children?: RemixNode
  title?: string
}

export function Layout(handle: Handle<LayoutProps>) {
  return () => {
    let { title, children } = handle.props

    return (
      <Document title={title}>
        <header
          mix={css({
            borderBottom: `1px solid ${theme.colors.border.subtle}`,
            backgroundColor: theme.surface.lvl0,
          })}
        >
          <nav
            mix={css({
              alignItems: 'center',
              display: 'flex',
              justifyContent: 'space-between',
              margin: '0 auto',
              maxWidth: '960px',
              minHeight: '64px',
              padding: `0 ${theme.space.xl}`,
            })}
          >
            <a
              href={routes.home.index.href()}
              mix={css({
                color: theme.colors.text.primary,
                fontSize: theme.fontSize.md,
                fontWeight: theme.fontWeight.semibold,
                textDecoration: 'none',
              })}
            >
              Timeboxer
            </a>
            <div
              mix={css({
                display: 'flex',
                gap: theme.space.md,
              })}
            >
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
}

const navLinkStyle = css({
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  textDecoration: 'none',
  '&:hover': {
    color: theme.colors.text.primary,
  },
})
