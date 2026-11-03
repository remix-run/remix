import { createRouter, type RouterContext } from 'remix/router'
import { asyncContext } from 'remix/middleware/async-context'
import { logger } from 'remix/middleware/logger'
import { render } from 'remix/middleware/render'
import { staticFiles } from 'remix/middleware/static'

import authController from './actions/auth/controller.tsx'
import authLoginController from './actions/auth/login/controller.tsx'
import rootController from './actions/controller.tsx'
import mainAccountController from './actions/main/account/controller.tsx'
import mainAccountEditController from './actions/main/account/edit/controller.tsx'
import mainController from './actions/main/controller.tsx'
import settingsController from './actions/settings/controller.tsx'
import { loadAssetEntry } from './middleware/asset-entry.ts'
import { loadAuth } from './middleware/auth.ts'
import { routes } from './routes.ts'
import { assets } from './utils/assets.ts'

export const router = createRouter({
  middleware: [
    ...(process.env.NODE_ENV === 'development' ? [logger()] : []),
    staticFiles('./public', {
      cacheControl: 'no-store',
      etag: false,
      lastModified: false,
      index: false,
    }),
    asyncContext(),
    loadAssetEntry(),
    loadAuth(),
    render({ assets }),
  ],
})

type AppContext = RouterContext<typeof router>

declare module 'remix' {
  interface RouterTypes {
    context: AppContext
  }
}

router.map(routes, rootController)
router.map(routes.main, mainController)
router.map(routes.main.account, mainAccountController)
router.map(routes.main.account.edit, mainAccountEditController)
router.map(routes.auth, authController)
router.map(routes.auth.login, authLoginController)
router.map(routes.settings, settingsController)
