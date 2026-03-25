import type { RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { frames, routes } from '../../routes.ts'
import { NavLink } from '../../ui/nav-link.tsx'

type SettingsNavItem =
  | 'overview'
  | 'profile'
  | 'notifications'
  | 'privacy'
  | 'grading'
  | 'integrations'

type SettingsLayoutProps = {
  activeItem?: SettingsNavItem
  children?: RemixNode
}

const settingsItems = [
  {
    id: 'overview',
    route: routes.settings.index,
    label: 'Overview',
  },
  {
    id: 'profile',
    route: routes.settings.profile,
    label: 'Profile',
  },
  {
    id: 'notifications',
    route: routes.settings.notifications,
    label: 'Notifications',
  },
  {
    id: 'privacy',
    route: routes.settings.privacy,
    label: 'Privacy',
  },
  {
    id: 'grading',
    route: routes.settings.grading,
    label: 'Grading',
  },
  {
    id: 'integrations',
    route: routes.settings.integrations,
    label: 'Integrations',
  },
]

export function SettingsLayout() {
  return ({ activeItem, children }: SettingsLayoutProps) => (
    <section mix={contentShellStyle}>
      <aside mix={secondarySidebarStyle}>
        <p mix={secondarySidebarTitleStyle}>Settings</p>
        <nav mix={secondaryNavStyle}>
          {settingsItems.map((item) => (
            <NavLink route={item.route} target={frames.settings} active={activeItem === item.id}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <section mix={secondaryContentStyle}>{children}</section>
    </section>
  )
}

const contentShellStyle = css({
  display: 'grid',
  gridTemplateColumns: '240px minmax(0, 1fr)',
  gap: '1.25rem',
  alignItems: 'start',
})

const secondarySidebarStyle = css({
  position: 'sticky',
  top: '1.5rem',
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  backgroundColor: '#ffffff',
  padding: '0.9rem',
})

const secondarySidebarTitleStyle = css({
  margin: 0,
  color: '#64748b',
  fontSize: '0.85rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  fontWeight: 600,
})

const secondaryNavStyle = css({
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

const secondaryContentStyle = css({
  minWidth: 0,
})

export type { SettingsNavItem }
