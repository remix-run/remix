import type { RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { routes } from '../../config/routes.ts'

type SettingsLayoutProps = {
  active: SettingsKey
  children?: RemixNode
}

export type SettingsKey =
  | 'overview'
  | 'profile'
  | 'notifications'
  | 'privacy'
  | 'grading'
  | 'integrations'

let settingsItems: Array<{ key: SettingsKey; href: string; label: string }> = [
  {
    key: 'overview',
    href: routes.settings.index.href(),
    label: 'Overview',
  },
  {
    key: 'profile',
    href: routes.settings.profile.href(),
    label: 'Profile',
  },
  {
    key: 'notifications',
    href: routes.settings.notifications.href(),
    label: 'Notifications',
  },
  {
    key: 'privacy',
    href: routes.settings.privacy.href(),
    label: 'Privacy',
  },
  {
    key: 'grading',
    href: routes.settings.grading.href(),
    label: 'Grading',
  },
  {
    key: 'integrations',
    href: routes.settings.integrations.href(),
    label: 'Integrations',
  },
]

export function SettingsLayout() {
  return ({ active, children }: SettingsLayoutProps) => (
    <section mix={contentShellStyle}>
      <aside mix={secondarySidebarStyle}>
        <p mix={secondarySidebarTitleStyle}>Settings</p>
        <nav mix={secondaryNavStyle}>
          {settingsItems.map((item) => (
            <a
              href={item.href}
              rmx-target="settings"
              rmx-src={item.href}
              mix={[
                secondaryNavItemBaseStyle,
                item.key === active ? secondaryNavItemActiveStyle : secondaryNavItemIdleStyle,
              ]}
            >
              {item.label}
            </a>
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
})

let secondaryNavItemBaseStyle = css({
  textDecoration: 'none',
  borderRadius: '10px',
  padding: '0.55rem 0.65rem',
  fontSize: '0.9rem',
})

let secondaryNavItemActiveStyle = css({
  color: '#0f172a',
  backgroundColor: '#e2e8f0',
  fontWeight: 600,
})

let secondaryNavItemIdleStyle = css({
  color: '#334155',
  backgroundColor: 'transparent',
  fontWeight: 500,
})

let secondaryContentStyle = css({
  minWidth: 0,
})
