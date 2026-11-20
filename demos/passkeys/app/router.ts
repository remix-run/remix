import { createRouter, type RouterContext } from 'remix/router'
import { asyncContext } from 'remix/middleware/async-context'
import { cop } from 'remix/middleware/cop'
import { formData } from 'remix/middleware/form-data'
import { methodOverride } from 'remix/middleware/method-override'
import { render } from 'remix/middleware/render'
import { session } from 'remix/middleware/session'
import { staticFiles } from 'remix/middleware/static'
import type { SessionStorage } from 'remix/session'

import { createAccountController } from './actions/account/controller.tsx'
import { createAuthController } from './actions/auth/controller.ts'
import { rootController } from './actions/controller.tsx'
import { loadAssetEntry } from './middleware/asset-entry.ts'
import { loadAuth } from './middleware/auth.ts'
import { loadDatabase } from './middleware/database.ts'
import { sessionCookie, sessionStorage } from './middleware/session.ts'
import { routes } from './routes.ts'
import { assets } from './utils/assets.ts'
import { createPasskeyProvider, getDemoOrigin } from './utils/passkeys.ts'

type AppContext = RouterContext<ReturnType<typeof createPasskeysRouter>>

declare module 'remix' {
  interface RouterTypes {
    context: AppContext
  }
}

export interface PasskeysRouterOptions {
  /** The origin the browser loads the app from. Passkeys are bound to its hostname. */
  origin?: string
  sessionStorage?: SessionStorage
}

export function createPasskeysRouter(options: PasskeysRouterOptions = {}) {
  let passkeyProvider = createPasskeyProvider(options.origin ?? getDemoOrigin())
  let router = createRouter({
    middleware: [
      staticFiles('./public', {
        cacheControl: 'no-store, must-revalidate',
        etag: false,
        lastModified: false,
      }),
      cop(),
      formData(),
      methodOverride(),
      session(sessionCookie, options.sessionStorage ?? sessionStorage),
      asyncContext(),
      loadDatabase(),
      loadAuth(),
      loadAssetEntry(),
      render({ assets }),
    ],
  })

  router.map(routes, rootController)
  router.map(routes.auth, createAuthController(passkeyProvider))
  router.map(routes.account, createAccountController(passkeyProvider))

  return router
}
