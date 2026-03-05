import type { Controller } from 'remix/fetch-router'

import { routes } from '../../config/routes.ts'
import { render } from '../../config/render.tsx'
import { Layout } from '../lib/Layout.tsx'
import { SettingsGradingPage } from './grading.tsx'
import { SettingsIndexPage } from './index.tsx'
import { SettingsIntegrationsPage } from './integrations.tsx'
import { SettingsNotificationsPage } from './notifications.tsx'
import { SettingsPrivacyPage } from './privacy.tsx'
import { SettingsProfilePage } from './profile.tsx'

let settingsController: Controller<typeof routes.settings> = {
  actions: {
    index() {
      return render(
        <Layout
          title="Settings"
          active="settings"
          secondaryNavigation={getSettingsNavigation('overview')}
        >
          <SettingsIndexPage />
        </Layout>,
      )
    },
    profile() {
      return render(
        <Layout
          title="Settings"
          active="settings"
          secondaryNavigation={getSettingsNavigation('profile')}
        >
          <SettingsProfilePage />
        </Layout>,
      )
    },
    notifications() {
      return render(
        <Layout
          title="Settings"
          active="settings"
          secondaryNavigation={getSettingsNavigation('notifications')}
        >
          <SettingsNotificationsPage />
        </Layout>,
      )
    },
    privacy() {
      return render(
        <Layout
          title="Settings"
          active="settings"
          secondaryNavigation={getSettingsNavigation('privacy')}
        >
          <SettingsPrivacyPage />
        </Layout>,
      )
    },
    grading() {
      return render(
        <Layout
          title="Settings"
          active="settings"
          secondaryNavigation={getSettingsNavigation('grading')}
        >
          <SettingsGradingPage />
        </Layout>,
      )
    },
    integrations() {
      return render(
        <Layout
          title="Settings"
          active="settings"
          secondaryNavigation={getSettingsNavigation('integrations')}
        >
          <SettingsIntegrationsPage />
        </Layout>,
      )
    },
  },
}

function getSettingsNavigation(activeKey: string) {
  return {
    title: 'Settings',
    activeKey,
    items: [
      { key: 'overview', href: routes.settings.index.href(), label: 'Overview' },
      { key: 'profile', href: routes.settings.profile.href(), label: 'Profile' },
      { key: 'notifications', href: routes.settings.notifications.href(), label: 'Notifications' },
      { key: 'privacy', href: routes.settings.privacy.href(), label: 'Privacy' },
      { key: 'grading', href: routes.settings.grading.href(), label: 'Grading' },
      { key: 'integrations', href: routes.settings.integrations.href(), label: 'Integrations' },
    ],
  }
}

export default settingsController
