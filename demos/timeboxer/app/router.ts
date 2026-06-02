import { csrf } from 'remix/csrf-middleware'
import { createRouter, type RouterContext } from 'remix/fetch-router'
import { formData } from 'remix/form-data-middleware'
import { session } from 'remix/session-middleware'

import { assets } from './controllers/assets.ts'
import { auth, authLogin, authSignup } from './controllers/auth/controller.tsx'
import { home } from './controllers/home/controller.tsx'
import { schedulesController } from './controllers/schedules/controller.tsx'
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
export type AppContext = RouterContext<typeof router>

router.map(routes.assets, assets)
router.map(routes.home, home)
router.map(routes.auth, auth)
router.map(routes.auth.login, authLogin)
router.map(routes.auth.signup, authSignup)
router.map(routes.schedules, schedulesController)
