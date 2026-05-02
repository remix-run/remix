import { Auth } from 'remix/auth-middleware'
import type { Controller } from 'remix/fetch-router'
import { redirect } from 'remix/response/redirect'

import { getReturnToQuery, requireAuth } from '../middleware/auth.ts'
import { Session } from '../middleware/session.ts'
import type { AppContext } from '../router.ts'
import { routes } from '../routes.ts'
import { AccountPage } from '../ui/account-page.tsx'
import { LoginPage } from '../ui/home/page.tsx'
import {
  externalProviderRegistry,
  readExternalProviderLinks,
  type ExternalProviderRegistry,
} from '../utils/external-auth.ts'
import { render } from '../utils/render.tsx'

export function createRootController(
  registry: ExternalProviderRegistry = externalProviderRegistry,
) {
  return {
    actions: {
      home(context) {
        let auth = context.get(Auth)
        if (auth.ok) {
          return redirect(routes.account.href())
        }

        let session = context.get(Session)
        let error = session.get('error')
        let success = session.get('success')
        let returnToQuery = getReturnToQuery(context.url)

        return render(
          <LoginPage
            formAction={routes.auth.login.href(undefined, returnToQuery)}
            signupHref={routes.auth.signup.index.href(undefined, returnToQuery)}
            forgotPasswordHref={routes.auth.forgotPassword.index.href(undefined, returnToQuery)}
            providers={readExternalProviderLinks(returnToQuery, registry)}
            error={typeof error === 'string' ? error : undefined}
            success={typeof success === 'string' ? success : undefined}
          />,
        )
      },
      account: {
        middleware: [requireAuth] as const,
        handler(context) {
          let auth = context.get(Auth)
          if (!auth.ok) {
            return new Response('Unauthorized', { status: 401 })
          }

          return render(
            <AccountPage identity={auth.identity} logoutAction={routes.auth.logout.href()} />,
          )
        },
      },
    },
  } satisfies Controller<typeof routes, AppContext>
}
