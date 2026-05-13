import { createController } from 'remix/fetch-router'
import { redirect } from 'remix/response/redirect'

import { getReturnToQuery, requireAuth } from '../middleware/auth.ts'
import { routes } from '../routes.ts'
import { AccountPage } from '../ui/account-page.tsx'
import { LoginPage } from '../ui/home/page.tsx'
import {
  externalProviderRegistry,
  readExternalProviderLinks,
  type ExternalProviderRegistry,
} from '../utils/external-auth.ts'

export function createRootController(
  registry: ExternalProviderRegistry = externalProviderRegistry,
) {
  return createController(routes, {
    actions: {
      home({ auth, render, session, url }) {
        if (auth.ok) {
          return redirect(routes.account.href())
        }

        let error = session.get('error')
        let success = session.get('success')
        let returnToQuery = getReturnToQuery(url)

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
        middleware: [requireAuth()],
        handler({ auth, render }) {
          if (!auth.ok) {
            return new Response('Unauthorized', { status: 401 })
          }

          return render(
            <AccountPage identity={auth.identity} logoutAction={routes.auth.logout.href()} />,
          )
        },
      },
    },
  })
}
