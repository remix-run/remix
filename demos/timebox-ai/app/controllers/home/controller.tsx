import { Auth } from 'remix/auth-middleware'
import { getCsrfToken } from 'remix/csrf-middleware'
import { Database } from 'remix/data-table'
import type { Controller } from 'remix/fetch-router'
import { redirect } from 'remix/response/redirect'

import { listSchedules } from '../../data/schedules.ts'
import type { AppContext } from '../../router.ts'
import { routes } from '../../routes.ts'
import { render } from '../../utils/render.tsx'
import { SchedulePage } from '../schedules/page.tsx'
import { HomePage } from './page.tsx'

export const home = {
  actions: {
    async index(context) {
      let { get, request } = context
      let auth = get(Auth)

      if (auth.ok) {
        let schedules = await listSchedules(get(Database), auth.identity.id)
        let latestSchedule = schedules.at(0)

        if (latestSchedule) {
          return redirect(routes.schedules.show.href({ scheduleId: String(latestSchedule.id) }))
        }

        return render(
          <SchedulePage
            activeScheduleId={undefined}
            csrfToken={getCsrfToken(context)}
            schedule={undefined}
            schedules={schedules}
          />,
          request,
        )
      }

      return render(<HomePage />, request)
    },
  },
} satisfies Controller<typeof routes.home, AppContext>
