import type { BuildAction } from 'remix/fetch-router'

import { AccountPage } from './account-page.tsx'
import { getGoodAuth, requireAuth } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'
import { render } from '../../utils/render.tsx'

export let account = {
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
} satisfies BuildAction<'GET', typeof routes.account>
