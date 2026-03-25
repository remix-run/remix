import type { RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { routes } from '../routes.ts'
import { NavLink } from './nav-link.tsx'

type MainNavItem = 'dashboard' | 'courses' | 'calendar' | 'account' | 'settings'

type LayoutProps = {
  title: string
  activeNav?: MainNavItem
  children?: RemixNode
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', route: routes.main.index },
  { id: 'courses', label: 'Courses', route: routes.main.courses },
  { id: 'calendar', label: 'Calendar', route: routes.main.calendar },
  { id: 'account', label: 'Account', route: routes.main.account },
  { id: 'settings', label: 'Settings', route: routes.settings.index },
]

export function Layout() {
  return ({ title, activeNav, children }: LayoutProps) => (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title} | LMS</title>
        <script async type="module" src="/assets/entry.js" />
      </head>
      <body mix={bodyStyle}>
        <div mix={appShellStyle}>
          <aside mix={sidebarStyle}>
            <a href={routes.main.index.href()} mix={brandLinkStyle}>
              Atlas LMS
            </a>
            <p mix={sidebarSubtitleStyle}>Student workspace</p>
            <nav mix={navStyle}>
              {navItems.map((item) => (
                <NavLink route={item.route} active={activeNav === item.id}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <form method="POST" action={routes.auth.logout.href()} mix={logoutFormStyle}>
              <button type="submit" mix={logoutButtonStyle}>
                Logout
              </button>
            </form>
          </aside>

          <main mix={mainStyle}>
            <header mix={mainHeaderStyle}>
              <h1 mix={mainTitleStyle}>{title}</h1>
            </header>
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}

const bodyStyle = css({
  margin: 0,
  minHeight: '100vh',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji',
  color: '#0f172a',
  backgroundColor: '#f8fafc',
})

const appShellStyle = css({
  height: '100vh',
  display: 'grid',
  gridTemplateColumns: '280px minmax(0, 1fr)',
})

const sidebarStyle = css({
  position: 'sticky',
  top: 0,
  alignSelf: 'start',
  height: '100vh',
  boxSizing: 'border-box',
  borderRight: '1px solid #e2e8f0',
  backgroundColor: '#ffffff',
  padding: '1.25rem 1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
})

const brandLinkStyle = css({
  fontWeight: 700,
  letterSpacing: '-0.01em',
  color: '#0f172a',
  textDecoration: 'none',
  fontSize: '1.1rem',
})

const sidebarSubtitleStyle = css({
  margin: 0,
  color: '#64748b',
  fontSize: '0.9rem',
})

const navStyle = css({
  display: 'grid',
  gap: '0.35rem',
  marginTop: '0.5rem',
  '& a': {
    textDecoration: 'none',
    borderRadius: '10px',
    padding: '0.55rem 0.75rem',
    fontSize: '0.95rem',
    color: '#334155',
    backgroundColor: 'transparent',
    fontWeight: 500,
  },
  '& a[aria-current="page"]': {
    color: '#0f172a',
    backgroundColor: '#e2e8f0',
    fontWeight: 600,
  },
})

const logoutFormStyle = css({
  marginTop: 'auto',
  paddingTop: '1rem',
})

const logoutButtonStyle = css({
  width: '100%',
  border: 'none',
  borderRadius: '10px',
  padding: '0.65rem 0.75rem',
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
  backgroundColor: '#e2e8f0',
  color: '#0f172a',
})

const mainStyle = css({
  padding: '1.5rem 2rem 3rem',
})

const mainHeaderStyle = css({
  marginBottom: '1.25rem',
  paddingBottom: '0.75rem',
  borderBottom: '1px solid #e2e8f0',
})

const mainTitleStyle = css({
  margin: 0,
  fontSize: '1.25rem',
  color: '#0f172a',
})

export type { MainNavItem }
