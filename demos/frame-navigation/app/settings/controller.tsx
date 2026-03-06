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
import { SettingsLayout, type SettingsKey } from './layout.tsx'
import { Notifications } from './notifications.tsx'
import { Privacy } from './privacy.tsx'
import { Profile } from './profile.tsx'

export default {
  actions: {
    index() {
      return render(
        <SettingsShellOrFragment active="overview">
          <Index />
        </SettingsShellOrFragment>,
      )
    },
    profile() {
      return render(
        <SettingsShellOrFragment active="profile">
          <Profile />
        </SettingsShellOrFragment>,
      )
    },
    notifications() {
      return render(
        <SettingsShellOrFragment active="notifications">
          <Notifications />
        </SettingsShellOrFragment>,
      )
    },
    privacy() {
      return render(
        <SettingsShellOrFragment active="privacy">
          <Privacy />
        </SettingsShellOrFragment>,
      )
    },
    grading() {
      return render(
        <SettingsShellOrFragment active="grading">
          <Grading />
        </SettingsShellOrFragment>,
      )
    },
    integrations() {
      return render(
        <SettingsShellOrFragment active="integrations">
          <Integrations />
        </SettingsShellOrFragment>,
      )
    },
  },
} satisfies Controller<typeof routes.settings>

type SettingsPageProps = {
  active: SettingsKey
  children?: RemixNode
}

function SettingsShellOrFragment() {
  return ({ active, children }: SettingsPageProps) => {
    if (isFrameRequest()) {
      return <SettingsLayout active={active}>{children}</SettingsLayout>
    }

    return (
      <Layout title="Settings" active="settings">
        <Frame name="settings" src={getContext().request.url} />
      </Layout>
    )
  }
}

function isFrameRequest() {
  return getContext().request.headers.get('x-remix-target') === 'settings'
}
