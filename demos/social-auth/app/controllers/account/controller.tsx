import { Auth } from 'remix/auth-middleware'
import { createAction } from 'remix/fetch-router'

import { AccountPage } from './account-page.tsx'
import { requireAuth } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'
import { render } from '../render.tsx'

export let account = createAction(routes.account, {
  middleware: [requireAuth()],
  action(context) {
    let auth = context.get(Auth)

    return render(
      <AccountPage
        identity={auth.identity}
        logoutAction={routes.auth.logout.href()}
      />,
    )
  },
})
