import { createController } from 'remix/router'
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
      return render(
        <SettingsPage activeItem="overview" {...getSettingsFrameProps(request)}>
          <Index />
        </SettingsPage>,
      )
    },
    profile({ render, request }) {
      return render(
        <SettingsPage activeItem="profile" {...getSettingsFrameProps(request)}>
          <Profile />
        </SettingsPage>,
      )
    },
    notifications({ render, request }) {
      return render(
        <SettingsPage activeItem="notifications" {...getSettingsFrameProps(request)}>
          <Notifications />
        </SettingsPage>,
      )
    },
    privacy({ render, request }) {
      return render(
        <SettingsPage activeItem="privacy" {...getSettingsFrameProps(request)}>
          <Privacy />
        </SettingsPage>,
        { status: 500 },
      )
    },
    grading({ render, request }) {
      return render(
        <SettingsPage activeItem="grading" {...getSettingsFrameProps(request)}>
          <Grading />
        </SettingsPage>,
      )
    },
    integrations({ render, request }) {
      return render(
        <SettingsPage activeItem="integrations" {...getSettingsFrameProps(request)}>
          <Integrations />
        </SettingsPage>,
      )
    },
  },
})

type SettingsPageProps = {
  activeItem: SettingsNavItem
  children?: RemixNode
  frameSrc: string
  isFrameRequest: boolean
}

function getSettingsFrameProps(request: Request) {
  return {
    frameSrc: request.url,
    isFrameRequest: request.headers.get('X-Remix-Target') === frames.settings,
  }
}

function SettingsPage(handle: Handle<SettingsPageProps>) {
  return () => {
    let { activeItem, children, frameSrc, isFrameRequest } = handle.props
    if (isFrameRequest) {
      return <SettingsLayout activeItem={activeItem}>{children}</SettingsLayout>
    }

    return (
      <Layout title="Settings" activeNav="settings">
        <Frame name={frames.settings} src={frameSrc} />
      </Layout>
    )
  }
}
