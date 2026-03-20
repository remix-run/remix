import { Auth } from 'remix/auth-middleware'
import { redirect } from 'remix/response/redirect'

import { LoginPage } from './login-page.tsx'
import { getReturnToQuery, readFlash } from '../../middleware/auth.ts'
import { Session } from '../../middleware/session.ts'
import type { RouteContext } from '../../router.ts'
import { routes } from '../../routes.ts'
import { readExternalProviderLinks } from '../../utils/external-auth.ts'
import { render } from '../render.tsx'

export function home(context: RouteContext) {
  let auth = context.get(Auth)
  if (auth.ok) {
    return redirect(routes.account.href())
  }

  let session = context.get(Session)
  let flash = readFlash(session)
  let returnToQuery = getReturnToQuery(context.url)

  return render(
    <LoginPage
      formAction={routes.auth.login.href(undefined, returnToQuery)}
      signupHref={routes.auth.signup.index.href(undefined, returnToQuery)}
      forgotPasswordHref={routes.auth.forgotPassword.index.href(undefined, returnToQuery)}
      providers={readExternalProviderLinks(returnToQuery)}
      error={flash.error}
      success={flash.success}
    />,
  )
}
