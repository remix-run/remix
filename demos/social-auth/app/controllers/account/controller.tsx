import { Auth } from 'remix/auth-middleware'
import { createRouter } from 'remix/fetch-router'

import { AccountPage } from './account-page.tsx'
import { requireAuth } from '../../middleware/auth.ts'
import type { SocialAuthContext } from '../../router.ts'
import { routes } from '../../routes.ts'
import { render } from '../render.tsx'

const accountMiddleware = [requireAuth()] as const

export function createAccountRouter() {
  let router = createRouter<SocialAuthContext, typeof accountMiddleware>({
    middleware: accountMiddleware,
  })

  router.get('/', context => {
    let auth = context.get(Auth)

    return render(
      <AccountPage
        identity={auth.identity}
        logoutAction={routes.auth.logout.href()}
      />,
    )
  })

  return router
}
