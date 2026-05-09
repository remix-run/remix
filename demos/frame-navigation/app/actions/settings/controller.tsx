import { createController } from 'remix/fetch-router'
import type { Renderer as Render } from 'remix/render-middleware'
import type { Handle, RemixNode } from 'remix/ui'
import { Frame } from 'remix/ui'
import { getContext } from 'remix/async-context-middleware'

import { requireAuth } from '../../middleware/auth.ts'
import { frames, routes } from '../../routes.ts'
import { Layout } from '../../ui/layout.tsx'
import { SettingsLayout, type SettingsNavItem } from './layout.tsx'

import { Grading } from './grading-page.tsx'
import { Index } from './index-page.tsx'
import { Integrations } from './integrations-page.tsx'
import { Notifications } from './notifications-page.tsx'
import { Privacy } from './privacy-page.tsx'
import { Profile } from './profile-page.tsx'

export default createController(routes.settings, {
  middleware: [requireAuth],
  actions: {
    index({ render }) {
      return renderSettingsPage(render, 'overview', <Index />)
    },
    profile({ render }) {
      return renderSettingsPage(render, 'profile', <Profile />)
    },
    notifications({ render }) {
      return renderSettingsPage(render, 'notifications', <Notifications />)
    },
    privacy({ render }) {
      return renderSettingsPage(render, 'privacy', <Privacy />, { status: 500 })
    },
    grading({ render }) {
      return renderSettingsPage(render, 'grading', <Grading />)
    },
    integrations({ render }) {
      return renderSettingsPage(render, 'integrations', <Integrations />)
    },
  },
})

type SettingsPageProps = {
  activeItem: SettingsNavItem
  children?: RemixNode
}

function renderSettingsPage(
  render: Render<RemixNode>,
  activeItem: SettingsNavItem,
  content: RemixNode,
  init?: ResponseInit,
) {
  return render(
    <SettingsShellOrFragment activeItem={activeItem}>{content}</SettingsShellOrFragment>,
    init,
  )
}

function SettingsShellOrFragment(handle: Handle<SettingsPageProps>) {
  return () => {
    let { activeItem, children } = handle.props
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
  return getContext().request.headers.get('X-Remix-Target') === frames.settings
}
