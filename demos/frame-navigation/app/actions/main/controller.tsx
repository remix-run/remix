import { createController } from 'remix/router'
import { Frame } from 'remix/ui'

import { requireAuth } from '../../middleware/auth.ts'
import { frames, routes } from '../../routes.ts'
import { Layout } from '../../ui/layout.tsx'
import { MainCalendarPage } from './calendar-page.tsx'
import { MainCoursesPage } from './courses-page.tsx'
import { MainIndexPage } from './index-page.tsx'

export default createController(routes.main, {
  middleware: [requireAuth],
  actions: {
    index({ render }) {
      return render(
        <Layout title="Dashboard" activeNav="dashboard">
          <MainIndexPage />
        </Layout>,
      )
    },
    courses({ render, request, url }) {
      let page = <MainCoursesPage query={url.searchParams.get('q')?.trim() ?? ''} />
      if (isCoursesFrameRequest(request)) return render(page)

      return render(
        <Layout title="Courses" activeNav="courses">
          <Frame name={frames.courses} src={request.url} />
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
  },
})

function isCoursesFrameRequest(request: Request): boolean {
  return (
    request.headers.get('X-Remix-Frame') === 'true' &&
    request.headers.get('X-Remix-Target') === frames.courses
  )
}
