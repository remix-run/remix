import { Auth } from 'remix/auth-middleware'
import { redirect } from 'remix/response/redirect'

import { LoginPage } from './page.tsx'
import { getReturnToQuery } from '../../middleware/auth.ts'
import { Session } from '../../middleware/session.ts'
import type { AppContext } from '../../router.ts'
import { routes } from '../../routes.ts'
import {
  externalProviderRegistry,
  readExternalProviderLinks,
  type ExternalProviderRegistry,
} from '../../utils/external-auth.ts'
import { render } from '../../utils/render.tsx'

export function createHomeController(
  registry: ExternalProviderRegistry = externalProviderRegistry,
) {
  return function home(context: AppContext) {
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
        atmosphereLoginHref={routes.auth.atmosphere.login.href()}
        returnTo={returnToQuery.returnTo}
        providers={readExternalProviderLinks(returnToQuery, registry)}
        error={typeof error === 'string' ? error : undefined}
        success={typeof success === 'string' ? success : undefined}
      />,
    )
  }
}
