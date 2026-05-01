import { createRouter } from 'remix/fetch-router'

import { assets } from './controllers/assets.ts'
import { auth } from './controllers/auth.tsx'
import { home } from './controllers/home.tsx'
import { routes } from './routes.ts'

export const router = createRouter()

router.map(routes.assets, assets)
router.map(routes.home, home)
router.map(routes.auth, auth)
