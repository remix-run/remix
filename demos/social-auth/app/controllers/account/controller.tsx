import { Auth } from 'remix/auth-middleware'
import type { BuildAction } from 'remix/fetch-router'

import { AccountPage } from './account-page.tsx'
import type { AuthenticatedRouteContext } from '../../router.ts'
import { routes } from '../../routes.ts'
import { render } from '../render.tsx'

export let accountAction = {
  action(context) {
    let auth = context.get(Auth)

    return render(
      <AccountPage
        identity={auth.identity}
        logoutAction={routes.auth.logout.href()}
      />,
    )
  },
} satisfies BuildAction<'GET', typeof routes.account, AuthenticatedRouteContext>
