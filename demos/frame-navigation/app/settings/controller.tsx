import type { Controller } from 'remix/fetch-router'
import type { RemixNode } from 'remix/component'
import { Frame } from 'remix/component'
import { getContext } from 'remix/async-context-middleware'

import { routes } from '../../config/routes.ts'
import { render } from '../../config/render.tsx'
import { Layout } from '../lib/Layout.tsx'
import { SettingsLayout } from './layout.tsx'
import type { SettingsKey } from './layout.tsx'
import { SettingsGradingPage } from './grading.tsx'
import { SettingsIndexPage } from './index.tsx'
import { SettingsIntegrationsPage } from './integrations.tsx'
import { SettingsNotificationsPage } from './notifications.tsx'
import { SettingsPrivacyPage } from './privacy.tsx'
import { SettingsProfilePage } from './profile.tsx'

let settingsController: Controller<typeof routes.settings> = {
  actions: {
    index() {
      return renderSettingsPage('overview', routes.settings.index.href(), <SettingsIndexPage />)
    },
    profile() {
      return renderSettingsPage('profile', routes.settings.profile.href(), <SettingsProfilePage />)
    },
    notifications() {
      return renderSettingsPage(
        'notifications',
        routes.settings.notifications.href(),
        <SettingsNotificationsPage />,
      )
    },
    privacy() {
      return renderSettingsPage('privacy', routes.settings.privacy.href(), <SettingsPrivacyPage />)
    },
    grading() {
      return renderSettingsPage('grading', routes.settings.grading.href(), <SettingsGradingPage />)
    },
    integrations() {
      return renderSettingsPage(
        'integrations',
        routes.settings.integrations.href(),
        <SettingsIntegrationsPage />,
      )
    },
  },
}

function renderSettingsPage(active: SettingsKey, frameSrc: string, page: RemixNode) {
  if (isFrameRequest()) {
    return render(<SettingsLayout active={active}>{page}</SettingsLayout>)
  }

  return render(
    <Layout title="Settings" active="settings">
      <Frame name="settings" src={frameSrc} fallback={<p>Loading settings...</p>} />
    </Layout>,
  )
}

function isFrameRequest() {
  return getContext().request.headers.get('x-remix-frame-target') === 'settings'
}

export default settingsController
