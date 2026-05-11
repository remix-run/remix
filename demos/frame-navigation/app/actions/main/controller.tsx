import { createController } from 'remix/fetch-router'
import type { RemixNode } from 'remix/ui'
import { Renderer, type Renderer as Render } from 'remix/render-middleware'

import { requireAuth } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'
import { Layout, type MainNavItem } from '../../ui/layout.tsx'
import { MainAccountPage } from './account-page.tsx'
import { MainCalendarPage } from './calendar-page.tsx'
import { MainCoursesPage } from './courses-page.tsx'
import { MainIndexPage } from './index-page.tsx'

function renderMainPage(
  render: Render<RemixNode>,
  title: string,
  activeNav: MainNavItem,
  content: RemixNode,
) {
  return render(
    <Layout title={title} activeNav={activeNav}>
      {content}
    </Layout>,
  )
}

export default createController(routes.main, {
  middleware: [requireAuth],
  actions: {
    index({ get }) {
      return renderMainPage(get(Renderer), 'Dashboard', 'dashboard', <MainIndexPage />)
    },
    courses({ get }) {
      return renderMainPage(get(Renderer), 'Courses', 'courses', <MainCoursesPage />)
    },
    calendar({ get }) {
      return renderMainPage(get(Renderer), 'Calendar', 'calendar', <MainCalendarPage />)
    },
    account({ get }) {
      return renderMainPage(get(Renderer), 'Account', 'account', <MainAccountPage />)
    },
  },
})
