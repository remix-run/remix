import type { Controller } from 'remix/fetch-router'
import type { RemixNode } from 'remix/component'
import { Frame } from 'remix/component'
import { getContext } from 'remix/async-context-middleware'

import { frames, type routes } from '../../config/routes.ts'
import { render } from '../../config/render.tsx'
import { Layout } from '../lib/Layout.tsx'
import { type SettingsNavItem, SettingsLayout } from './layout.tsx'

import { Grading } from './grading.tsx'
import { Index } from './index.tsx'
import { Integrations } from './integrations.tsx'
import { Notifications } from './notifications.tsx'
import { Privacy } from './privacy.tsx'
import { Profile } from './profile.tsx'

export default {
  actions: {
    index() {
      return renderSettingsPage('overview', <Index />)
    },
    profile() {
      return renderSettingsPage('profile', <Profile />)
    },
    notifications() {
      return renderSettingsPage('notifications', <Notifications />)
    },
    privacy() {
      return renderSettingsPage('privacy', <Privacy />, { status: 500 })
    },
    grading() {
      return renderSettingsPage('grading', <Grading />)
    },
    integrations() {
      return renderSettingsPage('integrations', <Integrations />)
    },
  },
} satisfies Controller<typeof routes.settings>

type SettingsPageProps = {
  activeItem: SettingsNavItem
  children?: RemixNode
}

function renderSettingsPage(activeItem: SettingsNavItem, content: RemixNode, init?: ResponseInit) {
  return render(
    <SettingsShellOrFragment activeItem={activeItem}>
      {content}
    </SettingsShellOrFragment>,
    init,
  )
}

function SettingsShellOrFragment() {
  return ({ activeItem, children }: SettingsPageProps) => {
    if (isFrameRequest()) {
      return <SettingsLayout activeItem={activeItem}>{children}</SettingsLayout>
    }

    return (
      <Layout title="Settings" activeNav="settings">
        <Frame name={frames.settings} src={getContext().request.url} />
      </Layout>
    )
  }
}

function isFrameRequest() {
  return getContext().request.headers.get('x-remix-target') === frames.settings
}
