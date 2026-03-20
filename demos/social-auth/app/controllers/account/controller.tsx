import { Auth, type AuthState } from 'remix/auth-middleware'
import { createRouter, type GetContextValue, type Router, type SetContextValue } from 'remix/fetch-router'

import { AccountPage } from './account-page.tsx'
import { requireAuth } from '../../middleware/auth.ts'
import type { SocialAuthRouteContext } from '../../router.ts'
import { routes } from '../../routes.ts'
import type { AuthIdentity } from '../../utils/auth-session.ts'
import { render } from '../render.tsx'

type LoadedAuthContext<context extends SocialAuthRouteContext<Record<string, string>>> = SetContextValue<
  context,
  typeof Auth,
  AuthState<AuthIdentity, 'session'>
>

const accountMiddleware = [requireAuth()] as const

export function mountAccountRoutes<context extends SocialAuthRouteContext<Record<string, string>>>(
  router: Router<context, context> &
    (GetContextValue<context, typeof Auth> extends AuthState<AuthIdentity, 'session'>
      ? unknown
      : never),
): void {
  let account = createRouter<LoadedAuthContext<context>, typeof accountMiddleware>({
    middleware: accountMiddleware,
  })

  account.get('/', context => {
    let auth = context.get(Auth)

    return render(
      <AccountPage
        identity={auth.identity}
        logoutAction={routes.auth.logout.href()}
      />,
    )
  })

  router.mount('/', account)
}
