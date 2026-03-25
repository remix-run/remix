import type { Controller } from 'remix/fetch-router'
import type { RemixNode } from 'remix/component'

import type { routes } from '../../routes.ts'
import { Layout, type MainNavItem } from '../../ui/layout.tsx'
import { render } from '../../utils/render.tsx'
import { MainAccountPage } from './account-page.tsx'
import { MainCalendarPage } from './calendar-page.tsx'
import { MainCoursesPage } from './courses-page.tsx'
import { MainIndexPage } from './index-page.tsx'

function renderMainPage(title: string, activeNav: MainNavItem, content: RemixNode) {
  return render(
    <Layout title={title} activeNav={activeNav}>
      {content}
    </Layout>,
  )
}

export default {
  actions: {
    index() {
      return renderMainPage('Dashboard', 'dashboard', <MainIndexPage />)
    },
    courses() {
      return renderMainPage('Courses', 'courses', <MainCoursesPage />)
    },
    calendar() {
      return renderMainPage('Calendar', 'calendar', <MainCalendarPage />)
    },
    account() {
      return renderMainPage('Account', 'account', <MainAccountPage />)
    },
  },
} satisfies Controller<typeof routes.main>
