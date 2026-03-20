import { Auth } from 'remix/auth-middleware'

import { AccountPage } from './account-page.tsx'
import { requireAuth } from '../../middleware/auth.ts'
import type { SocialAuthMount } from '../../router.ts'
import { routes } from '../../routes.ts'
import { render } from '../render.tsx'

let accountMiddleware = [requireAuth()] as const

export let mountAccountRoutes: SocialAuthMount = router => {
  router.scope({ middleware: accountMiddleware }, account => {
    account.get('/', context => {
      let auth = context.get(Auth)

      return render(
        <AccountPage
          identity={auth.identity}
          logoutAction={routes.auth.logout.href()}
        />,
      )
    })
  })
}
