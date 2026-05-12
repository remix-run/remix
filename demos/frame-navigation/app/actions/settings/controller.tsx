import { createController } from 'remix/fetch-router'
import type { Renderer as Render } from 'remix/render-middleware'
import type { Handle, RemixNode } from 'remix/ui'
import { Frame } from 'remix/ui'

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
    index({ render, request }) {
      return renderSettingsPage(render, request, 'overview', <Index />)
    },
    profile({ render, request }) {
      return renderSettingsPage(render, request, 'profile', <Profile />)
    },
    notifications({ render, request }) {
      return renderSettingsPage(render, request, 'notifications', <Notifications />)
    },
    privacy({ render, request }) {
      return renderSettingsPage(render, request, 'privacy', <Privacy />, { status: 500 })
    },
    grading({ render, request }) {
      return renderSettingsPage(render, request, 'grading', <Grading />)
    },
    integrations({ render, request }) {
      return renderSettingsPage(render, request, 'integrations', <Integrations />)
    },
  },
})

type SettingsPageProps = {
  activeItem: SettingsNavItem
  children?: RemixNode
  isSettingsFrameRequest: boolean
  requestUrl: string
}

function renderSettingsPage(
  render: Render<RemixNode>,
  request: Request,
  activeItem: SettingsNavItem,
  content: RemixNode,
  init?: ResponseInit,
) {
  return render(
    <SettingsShellOrFragment
      activeItem={activeItem}
      isSettingsFrameRequest={request.headers.get('X-Remix-Target') === frames.settings}
      requestUrl={request.url}
    >
      {content}
    </SettingsShellOrFragment>,
    init,
  )
}

function SettingsShellOrFragment(handle: Handle<SettingsPageProps>) {
  return () => {
    let { activeItem, children, isSettingsFrameRequest, requestUrl } = handle.props
    if (isSettingsFrameRequest) {
      return <SettingsLayout activeItem={activeItem}>{children}</SettingsLayout>
    }

    return (
      <Layout title="Settings" activeNav="settings">
        <Frame name={frames.settings} src={requestUrl} />
      </Layout>
    )
  }
}
