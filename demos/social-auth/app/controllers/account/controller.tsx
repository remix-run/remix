import { Database } from 'remix/data-table'
import { Auth } from 'remix/auth-middleware'
import type { BuildAction } from 'remix/fetch-router'

import { AccountPage } from './page.tsx'
import type { AuthenticatedAppContext } from '../../router.ts'
import { routes } from '../../routes.ts'
import { render } from '../../utils/render.tsx'
import {
  getUsableAuthAccountTokens,
  type ExternalTokenState,
} from '../../utils/auth-account-tokens.ts'
import {
  externalProviderRegistry,
  type ExternalProviderRegistry,
} from '../../utils/external-auth.ts'

export function createAccountAction(registry: ExternalProviderRegistry = externalProviderRegistry) {
  return {
    async handler(context) {
      let auth = context.get(Auth)
      let externalTokenState: ExternalTokenState | null = null

      if (auth.identity.authAccount != null) {
        let db = context.get(Database)
        externalTokenState = (
          await getUsableAuthAccountTokens(db, auth.identity.authAccount, registry)
        ).state
      }

      return render(
        <AccountPage
          identity={auth.identity}
          logoutAction={routes.auth.logout.href()}
          externalTokenState={externalTokenState}
        />,
      )
    },
  } satisfies BuildAction<'GET', typeof routes.account, AuthenticatedAppContext>
}
