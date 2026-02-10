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

/**
 * Get the middleware required for assets in the current environment.
 *
 * In development: devAssets only (on-the-fly transform).
 * In test: mock assets middleware.
 * In production: assets middleware (manifest/entry resolution) plus staticFiles
 * for serving the built asset output at /assets.
 */
async function getAssetsMiddleware(): Promise<Middleware[]> {
  if (process.env.NODE_ENV === 'development') {
    let { devAssets } = await import('remix/dev-assets-middleware')
    return [
      devAssets({
        allow: ['app/**'],
        workspaceRoot: '../..',
        workspaceAllow: ['**/node_modules/**', 'packages/**'],
      }),
    ]
  }
  if (process.env.NODE_ENV === 'test') {
    return [mockAssets()]
  }
  let { assets } = await import('remix/assets-middleware')
  let manifestPath = './build/assets-manifest.json'
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Build manifest not found at ${manifestPath}. Run "pnpm run build" or "pnpm run build:bundled" before starting in production mode.`,
    )
  }
  let manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  return [
    assets(manifest, {
      baseUrl: '/assets',
    }),
    staticFiles('./build/assets', {
      basePath: '/assets',
      cacheControl: 'public, max-age=31536000, immutable',
    }),
  ]
}

let middleware = []

if (process.env.NODE_ENV === 'development') {
  middleware.push(logger())
}

middleware.push(compression())
middleware.push(...(await getAssetsMiddleware()))

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
