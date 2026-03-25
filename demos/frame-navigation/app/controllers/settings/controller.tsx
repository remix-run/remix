import type { Controller } from 'remix/fetch-router'
import type { RemixNode } from 'remix/component'
import { Frame } from 'remix/component'
import { getContext } from 'remix/async-context-middleware'

import { requireAuth } from '../../middleware/auth.ts'
import { frames, type routes } from '../../routes.ts'
import { Layout } from '../../ui/layout.tsx'
import { render } from '../../utils/render.tsx'
import { SettingsLayout, type SettingsNavItem } from './layout.tsx'

import { Grading } from './grading-page.tsx'
import { Index } from './index-page.tsx'
import { Integrations } from './integrations-page.tsx'
import { Notifications } from './notifications-page.tsx'
import { Privacy } from './privacy-page.tsx'
import { Profile } from './profile-page.tsx'

export default {
  middleware: [requireAuth],
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
    <SettingsShellOrFragment activeItem={activeItem}>{content}</SettingsShellOrFragment>,
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
