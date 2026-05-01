import { Auth } from 'remix/auth-middleware'
import type { Controller } from 'remix/fetch-router'

import { AccountPage } from './account/page.tsx'
import { createHomeController } from './home/controller.tsx'
import { requireAuth } from '../middleware/auth.ts'
import type { AppContext } from '../router.ts'
import { routes } from '../routes.ts'
import { externalProviderRegistry, type ExternalProviderRegistry } from '../utils/external-auth.ts'
import { render } from '../utils/render.tsx'

export function createRootController(
  registry: ExternalProviderRegistry = externalProviderRegistry,
) {
  return {
    actions: {
      home: createHomeController(registry),
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
