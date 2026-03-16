import { Auth } from 'remix/auth-middleware'
import type { Auth as RequestAuth } from 'remix/auth-middleware'
import type { BuildAction } from 'remix/fetch-router'

import type { SocialLoginConfig } from './config.ts'
import { HomePage } from './home/page.tsx'
import type { AuthenticatedUser } from './middleware/auth.ts'
import type { routes } from './routes.ts'
import { getSocialProviderStates } from './social-providers.ts'
import { render } from './utils/render.ts'
import { Session } from './utils/session.ts'

export function createHomeAction(
  config: SocialLoginConfig,
): BuildAction<'GET', typeof routes.home> {
  return {
    action({ get }) {
      let session = get(Session)
      let auth = get(Auth) as RequestAuth<AuthenticatedUser, string>
      let error = session.get('error')
      let user = auth.ok ? auth.identity : null
      let providers = getSocialProviderStates(config)

      return render(
        <HomePage error={typeof error === 'string' ? error : null} user={user} providers={providers} />,
        {
          headers: {
            'Cache-Control': 'no-store',
          },
        },
      )
    },
  }
}
