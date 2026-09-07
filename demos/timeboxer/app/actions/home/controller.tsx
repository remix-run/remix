import { Auth } from 'remix/middleware/auth'
import { getCsrfToken } from 'remix/middleware/csrf'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { listSchedules } from '../../data/schedules.ts'
import { databaseContext } from '../../middleware/database.ts'
import { routes } from '../../routes.ts'
import { SchedulePage } from '../schedules/page.tsx'
import { HomePage } from './page.tsx'

export const home = createController(routes.home, {
  actions: {
    async index(context) {
      let { get } = context
      let auth = get(Auth)

      if (auth.ok) {
        let schedules = await listSchedules(get(databaseContext), auth.identity.id)
        let latestSchedule = schedules.at(0)

        if (latestSchedule) {
          return redirect(routes.schedules.show.href({ scheduleId: String(latestSchedule.id) }))
        }

        return context.render(
          <SchedulePage
            activeScheduleId={undefined}
            csrfToken={getCsrfToken(context)}
            schedule={undefined}
            schedules={schedules}
          />,
        )
      }

      return context.render(<HomePage />)
    },
  },
})
