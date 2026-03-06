import type { Controller } from 'remix/fetch-router'
import type { RemixNode } from 'remix/component'
import { Frame } from 'remix/component'
import { getContext } from 'remix/async-context-middleware'

import type { routes } from '../../config/routes.ts'
import { render } from '../../config/render.tsx'
import { Layout } from '../lib/Layout.tsx'

import { Grading } from './grading.tsx'
import { Index } from './index.tsx'
import { Integrations } from './integrations.tsx'
import { SettingsLayout } from './layout.tsx'
import { Notifications } from './notifications.tsx'
import { Privacy } from './privacy.tsx'
import { Profile } from './profile.tsx'

export default {
  actions: {
    index() {
      return render(
        <SettingsShellOrFragment>
          <Index />
        </SettingsShellOrFragment>,
      )
    },
    profile() {
      return render(
        <SettingsShellOrFragment>
          <Profile />
        </SettingsShellOrFragment>,
      )
    },
    notifications() {
      return render(
        <SettingsShellOrFragment>
          <Notifications />
        </SettingsShellOrFragment>,
      )
    },
    privacy() {
      return render(
        <SettingsShellOrFragment>
          <Privacy />
        </SettingsShellOrFragment>,
      )
    },
    grading() {
      return render(
        <SettingsShellOrFragment>
          <Grading />
        </SettingsShellOrFragment>,
      )
    },
    integrations() {
      return render(
        <SettingsShellOrFragment>
          <Integrations />
        </SettingsShellOrFragment>,
      )
    },
  },
} satisfies Controller<typeof routes.settings>

type SettingsPageProps = { children?: RemixNode }

function SettingsShellOrFragment() {
  return ({ children }: SettingsPageProps) => {
    if (isFrameRequest()) {
      return <SettingsLayout>{children}</SettingsLayout>
    }

    return (
      <Layout title="Settings">
        <Frame name="settings" src={getContext().request.url} />
      </Layout>
    )
  }
}

function isFrameRequest() {
  return getContext().request.headers.get('x-remix-target') === 'settings'
}
