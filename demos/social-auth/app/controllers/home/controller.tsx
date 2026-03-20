import type { BuildAction } from 'remix/fetch-router'
import { Auth } from 'remix/auth-middleware'
import { redirect } from 'remix/response/redirect'

import { LoginPage } from './login-page.tsx'
import { getProviderAvailability } from '../../utils/external-auth.ts'
import { getReturnToQuery, readFlash } from '../../middleware/auth.ts'
import type { SocialAuthContext } from '../../router.ts'
import { routes } from '../../routes.ts'
import { render } from '../render.tsx'
import { Session } from '../../middleware/session.ts'

export let home = {
  action(context) {
    let auth = context.get(Auth)
    if (auth.ok) {
      return redirect(routes.account.href())
    }

    let session = context.get(Session)
    let flash = readFlash(session)
    let returnToQuery = getReturnToQuery(context.url)
    let availability = getProviderAvailability()

    return render(
      <LoginPage
        formAction={routes.auth.login.href(undefined, returnToQuery)}
        signupHref={routes.auth.signup.index.href(undefined, returnToQuery)}
        forgotPasswordHref={routes.auth.forgotPassword.index.href(undefined, returnToQuery)}
        providers={[
          {
            name: 'google',
            href: availability.google
              ? routes.auth.google.login.href(undefined, returnToQuery)
              : undefined,
            disabledReason: availability.google
              ? undefined
              : 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google login.',
          },
          {
            name: 'github',
            href: availability.github
              ? routes.auth.github.login.href(undefined, returnToQuery)
              : undefined,
            disabledReason: availability.github
              ? undefined
              : 'Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to enable GitHub login.',
          },
          {
            name: 'x',
            href: availability.x ? routes.auth.x.login.href(undefined, returnToQuery) : undefined,
            disabledReason: availability.x
              ? undefined
              : 'Set X_CLIENT_ID and X_CLIENT_SECRET to enable X login.',
          },
        ]}
        error={flash.error}
        success={flash.success}
      />,
    )
  },
} satisfies BuildAction<'GET', typeof routes.home, SocialAuthContext>
