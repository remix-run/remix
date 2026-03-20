import { Auth } from 'remix/auth-middleware'
import { createAction } from 'remix/fetch-router'

import { AccountPage } from './account-page.tsx'
import { requireAuth } from '../../middleware/auth.ts'
import type { RouteContext } from '../../router.ts'
import { routes } from '../../routes.ts'
import { render } from '../render.tsx'

let accountMiddleware = [requireAuth] as const

export let accountAction = createAction<
  typeof routes.account,
  RouteContext,
  typeof accountMiddleware
>(routes.account, {
  middleware: accountMiddleware,
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
