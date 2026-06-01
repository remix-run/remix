import { createController, createMiddleware } from 'remix/router'

import { requireAuth } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'
import { Layout } from '../../ui/layout.tsx'
import { MainAccountPage } from './account-page.tsx'
import { MainCalendarPage } from './calendar-page.tsx'
import { MainCoursesPage } from './courses-page.tsx'
import { MainIndexPage } from './index-page.tsx'

export default createController(routes.main, {
  middleware: createMiddleware(requireAuth),
  actions: {
    index({ render }) {
      return render(
        <Layout title="Dashboard" activeNav="dashboard">
          <MainIndexPage />
        </Layout>,
      )
    },
    courses({ render }) {
      return render(
        <Layout title="Courses" activeNav="courses">
          <MainCoursesPage />
        </Layout>,
      )
    },
    calendar({ render }) {
      return render(
        <Layout title="Calendar" activeNav="calendar">
          <MainCalendarPage />
        </Layout>,
      )
    },
    account({ render }) {
      return render(
        <Layout title="Account" activeNav="account">
          <MainAccountPage />
        </Layout>,
      )
    },
  },
})
