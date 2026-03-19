import type { BuildAction } from 'remix/fetch-router'

import { AccountPage } from './account/index.ts'
import { getGoodAuth, requireAuth } from './middleware/auth.ts'
import { routes } from './routes.ts'
import { render } from './utils/render.tsx'

export let account: BuildAction<'GET', typeof routes.account> = {
  middleware: [requireAuth()],
  action(context) {
    let auth = getGoodAuth(context)

    return render(
      <AccountPage
        identity={auth.identity}
        logoutAction={routes.auth.logout.href()}
      />,
    )
  },
}
