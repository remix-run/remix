import type { Controller } from 'remix/fetch-router'

import type { routes } from '../../config/routes.ts'
import { render } from '../../config/render.tsx'
import { Layout } from '../lib/Layout.tsx'
import { SettingsLayout } from './layout.tsx'
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
        <Layout title="Settings" active="settings">
          <SettingsLayout active="overview" />
        </Layout>,
      )
    },
    profile() {
      return render(
        <Layout title="Settings" active="settings">
          <SettingsLayout active="profile" />
        </Layout>,
      )
    },
    notifications() {
      return render(
        <Layout title="Settings" active="settings">
          <SettingsLayout active="notifications" />
        </Layout>,
      )
    },
    privacy() {
      return render(
        <Layout title="Settings" active="settings">
          <SettingsLayout active="privacy" />
        </Layout>,
      )
    },
    grading() {
      return render(
        <Layout title="Settings" active="settings">
          <SettingsLayout active="grading" />
        </Layout>,
      )
    },
    integrations() {
      return render(
        <Layout title="Settings" active="settings">
          <SettingsLayout active="integrations" />
        </Layout>,
      )
    },
    frame: {
      actions: {
        index() {
          return render(<SettingsIndexPage />)
        },
        profile() {
          return render(<SettingsProfilePage />)
        },
        notifications() {
          return render(<SettingsNotificationsPage />)
        },
        privacy() {
          return render(<SettingsPrivacyPage />)
        },
        grading() {
          return render(<SettingsGradingPage />)
        },
        integrations() {
          return render(<SettingsIntegrationsPage />)
        },
      },
    },
  },
}

export default settingsController
