import type { Controller } from 'remix/fetch-router'

import type { routes } from '../../config/routes.ts'
import { render } from '../../config/render.tsx'
import { Layout } from '../lib/Layout.tsx'
import { MainAccountPage } from './account.tsx'
import { MainCalendarPage } from './calendar.tsx'
import { MainCoursesPage } from './courses.tsx'
import { MainIndexPage } from './index.tsx'

let mainController: Controller<typeof routes.main> = {
  actions: {
    index() {
      return render(
        <Layout title="Dashboard" active="dashboard">
          <MainIndexPage />
        </Layout>,
      )
    },
    courses() {
      return render(
        <Layout title="Courses" active="courses">
          <MainCoursesPage />
        </Layout>,
      )
    },
    calendar() {
      return render(
        <Layout title="Calendar" active="calendar">
          <MainCalendarPage />
        </Layout>,
      )
    },
    account() {
      return render(
        <Layout title="Account" active="account">
          <MainAccountPage />
        </Layout>,
      )
    },
  },
}

export default mainController
