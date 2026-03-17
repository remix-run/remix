import type { Controller } from 'remix/fetch-router'
import type { RemixNode } from 'remix/component'

import type { routes } from '../../config/routes.ts'
import { render } from '../../config/render.tsx'
import { type MainNavItem, Layout } from '../lib/Layout.tsx'
import { MainAccountPage } from './account.tsx'
import { MainCalendarPage } from './calendar.tsx'
import { MainCoursesPage } from './courses.tsx'
import { MainIndexPage } from './index.tsx'

function renderMainPage(title: string, activeNav: MainNavItem, content: RemixNode) {
  return render(
    <Layout title={title} activeNav={activeNav}>
      {content}
    </Layout>,
  )
}

let mainController: Controller<typeof routes.main> = {
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
}

export default mainController
