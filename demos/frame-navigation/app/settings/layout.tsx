import type { RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { frames, routes } from '../../config/routes.ts'
import { NavLink } from '../lib/NavLink.tsx'

type SettingsLayoutProps = {
  children?: RemixNode
}

let settingsItems = [
  {
    route: routes.settings.index,
    label: 'Overview',
  },
  {
    route: routes.settings.profile,
    label: 'Profile',
  },
  {
    route: routes.settings.notifications,
    label: 'Notifications',
  },
  {
    route: routes.settings.privacy,
    label: 'Privacy',
  },
  {
    route: routes.settings.grading,
    label: 'Grading',
  },
  {
    route: routes.settings.integrations,
    label: 'Integrations',
  },
]

export function SettingsLayout() {
  return ({ children }: SettingsLayoutProps) => (
    <section mix={contentShellStyle}>
      <aside mix={secondarySidebarStyle}>
        <p mix={secondarySidebarTitleStyle}>Settings</p>
        <nav mix={secondaryNavStyle}>
          {settingsItems.map((item) => (
            <NavLink route={item.route} target={frames.settings}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <section mix={secondaryContentStyle}>{children}</section>
    </section>
  )
}

let contentShellStyle = css({
  display: 'grid',
  gridTemplateColumns: '240px minmax(0, 1fr)',
  gap: '1.25rem',
  alignItems: 'start',
})

let secondarySidebarStyle = css({
  position: 'sticky',
  top: '1.5rem',
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  backgroundColor: '#ffffff',
  padding: '0.9rem',
})

let secondarySidebarTitleStyle = css({
  margin: 0,
  color: '#64748b',
  fontSize: '0.85rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  fontWeight: 600,
})

let secondaryNavStyle = css({
  marginTop: '0.7rem',
  display: 'grid',
  gap: '0.35rem',
  '& a': {
    textDecoration: 'none',
    borderRadius: '10px',
    padding: '0.55rem 0.65rem',
    fontSize: '0.9rem',
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

let secondaryContentStyle = css({
  minWidth: 0,
})
