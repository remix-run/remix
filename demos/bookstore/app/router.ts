import * as fs from 'node:fs'
import type { Middleware } from 'remix'
import { createRouter } from 'remix'
import { asyncContext } from 'remix/async-context-middleware'
import { compression } from 'remix/compression-middleware'
import { formData } from 'remix/form-data-middleware'
import { logger } from 'remix/logger-middleware'
import { methodOverride } from 'remix/method-override-middleware'
import { session } from 'remix/session-middleware'
import { staticFiles } from 'remix/static-middleware'
import { getEsbuildConfig } from '../esbuild.config.ts'

import { routes } from './routes.ts'
import { sessionCookie, sessionStorage } from './utils/session.ts'
import { uploadHandler } from './utils/uploads.ts'

import adminController from './admin.tsx'
import accountController from './account.tsx'
import authController from './auth.tsx'
import booksController from './books.tsx'
import cartController from './cart.tsx'
import checkoutController from './checkout.tsx'
import * as marketingController from './marketing.tsx'
import { uploadsAction } from './uploads.tsx'

// Mock assets middleware for tests (returns mock asset entries)
function mockAssets(): Middleware {
  return (context, next) => {
    context.assets = {
      get: (path: string) => ({
        href: `/mock/${path}`,
        chunks: [],
      }),
    }
    return next()
  }
}

let middleware = []

if (process.env.NODE_ENV === 'development') {
  middleware.push(logger())
}

middleware.push(compression())

export let disposeAssetsMiddleware: (() => Promise<void>) | undefined

// Assets middleware - dev, test, or prod
if (process.env.NODE_ENV === 'development') {
  // Development: use dev assets with HMR
  let { devAssets } = await import('remix/dev-assets-middleware')
  let assetsMiddleware = devAssets({
    hmr: true,
    allow: ['app/**'],
    workspace: {
      root: '../..',
      allow: ['**/node_modules/**', 'packages/**'],
    },
    esbuildConfig: await getEsbuildConfig(),
  })
  middleware.push(assetsMiddleware)
  disposeAssetsMiddleware = assetsMiddleware.dispose
} else if (process.env.NODE_ENV === 'test') {
  // Test: use mock assets middleware
  middleware.push(mockAssets())
} else {
  // Production (default): use pre-built assets with manifest
  let { assets } = await import('remix/assets-middleware')
  let metafilePath = './build/metafile.json'
  if (!fs.existsSync(metafilePath)) {
    throw new Error(
      `Build manifest not found at ${metafilePath}. ` +
        `Run "pnpm run build" before starting in production mode.`,
    )
  }
  let manifest = JSON.parse(fs.readFileSync(metafilePath, 'utf-8'))
  middleware.push(assets(manifest))

  // Serve built assets from build/ directory
  middleware.push(staticFiles('.', { filter: (path) => path.startsWith('build/') }))
}

middleware.push(
  staticFiles('./public', {
    cacheControl: 'no-store, must-revalidate',
    etag: false,
    lastModified: false,
  }),
)
middleware.push(formData({ uploadHandler }))
middleware.push(methodOverride())
middleware.push(session(sessionCookie, sessionStorage))
middleware.push(asyncContext())

export let router = createRouter({ middleware })

router.get(routes.uploads, uploadsAction)

router.map(routes.home, marketingController.home)
router.map(routes.about, marketingController.about)
router.map(routes.contact, marketingController.contact)
router.map(routes.search, marketingController.search)

router.map(routes.books, booksController)
router.map(routes.auth, authController)
router.map(routes.cart, cartController)
router.map(routes.account, accountController)
router.map(routes.checkout, checkoutController)
router.map(routes.admin, adminController)
