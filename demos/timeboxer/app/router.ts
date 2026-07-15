import { createRouter, type RouterContext } from 'remix/router'
import { csrf } from 'remix/middleware/csrf'
import { formData } from 'remix/middleware/form-data'
import { session } from 'remix/middleware/session'

import { assets } from './actions/assets/controller.ts'
import { auth, authLogin, authSignup } from './actions/auth/controller.tsx'
import { home } from './actions/home/controller.tsx'
import { schedulesController } from './actions/schedules/controller.tsx'
import { loadAuth } from './middleware/auth.ts'
import { loadDatabase } from './middleware/database.ts'
import { sessionCookie, sessionStorage } from './middleware/session.ts'
import { routes } from './routes.ts'

export const router = createRouter({
  middleware: [
    session(sessionCookie, sessionStorage),
    formData(),
    csrf(),
    loadDatabase(),
    loadAuth(),
  ],
})
type AppContext = RouterContext<typeof router>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

router.map(routes.assets, assets)
router.map(routes.home, home)
router.map(routes.auth, auth)
router.map(routes.auth.login, authLogin)
router.map(routes.auth.signup, authSignup)
router.map(routes.schedules, schedulesController)
