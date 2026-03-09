import * as path from 'node:path'
import sharp from 'sharp'
import type { Middleware } from 'remix/fetch-router'
import { createRouter } from 'remix/fetch-router'
import { asyncContext } from 'remix/async-context-middleware'
import { compression } from 'remix/compression-middleware'
import { createFileCache } from 'remix/file-cache'
import { createFsFileStorage } from 'remix/file-storage/fs'
import { formData } from 'remix/form-data-middleware'
import { openLazyFile } from 'remix/fs'
import { methodOverride } from 'remix/method-override-middleware'
import { logger } from 'remix/logger-middleware'
import { createFileResponse } from 'remix/response/file'
import { session } from 'remix/session-middleware'
import { staticFiles } from 'remix/static-middleware'

import { routes } from './routes.ts'
import { initializeBookstoreDatabase } from './data/setup.ts'
import { sessionCookie, sessionStorage } from './utils/session.ts'
import { uploadHandler, uploadsStorage } from './utils/uploads.ts'
import { scriptHandler } from './utils/scripts.ts'

import adminController from './admin.tsx'
import accountController from './account.tsx'
import authController from './auth.tsx'
import booksController from './books.tsx'
import cartController from './cart.tsx'
import { toggleCart } from './cart.tsx'
import checkoutController from './checkout.tsx'
import * as marketingController from './marketing.tsx'
import fragmentsController from './fragments.tsx'
import { loadDatabase } from './middleware/database.ts'
import { loadScriptEntry } from './middleware/script-entry.ts'

let root = path.resolve(import.meta.dirname, '..')

let imageCache = createFileCache(createFsFileStorage(path.join(root, 'tmp/image-cache')), {
  maxSize: 200 * 1024 * 1024,
})

await imageCache.prune()

let imageVariants = {
  optimized: async (file: File) => {
    let buf = await sharp(await file.arrayBuffer())
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer()
    return new File([new Uint8Array(buf)], 'output.jpg', { type: 'image/jpeg' })
  },
}

type ImageVariant = 'original' | keyof typeof imageVariants

function isImageVariant(value: string): value is ImageVariant {
  return value === 'original' || value in imageVariants
}

let middleware = []

if (process.env.NODE_ENV === 'development') {
  middleware.push(logger())
}

middleware.push(compression())
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
middleware.push(loadDatabase())
middleware.push(loadScriptEntry())

await initializeBookstoreDatabase()

export let router = createRouter({ middleware })

router.get(routes.images, async ({ request, params }) => {
  if (!params.path) return new Response('Not found', { status: 404 })

  let sourceFile: File
  try {
    sourceFile = openLazyFile(path.join(root, 'app/images', params.path))
  } catch {
    return new Response('Not found', { status: 404 })
  }

  let variantName = new URL(request.url).searchParams.get('variant') ?? 'optimized'
  if (!isImageVariant(variantName)) {
    return new Response('Unknown variant', { status: 400 })
  }

  if (variantName === 'original') {
    return createFileResponse(sourceFile, request, { cacheControl: 'no-cache' })
  }

  let result = await imageCache.getOrSet([sourceFile, variantName], () =>
    imageVariants[variantName](sourceFile),
  )
  return createFileResponse(result, request, { cacheControl: 'no-cache' })
})

router.get(routes.scripts, async ({ request, params }) => {
  if (!params.path) return new Response('Not found', { status: 404 })

  let script = await scriptHandler.handle(request, params.path)
  return script ?? new Response('Not found', { status: 404 })
})

router.get(routes.uploads, async ({ request, params }) => {
  if (!params.path) return new Response('Not found', { status: 404 })

  let sourceFile = await uploadsStorage.get(params.path)
  if (!sourceFile) {
    return new Response('Not found', { status: 404 })
  }

  let variantName = new URL(request.url).searchParams.get('variant') ?? 'optimized'
  if (!isImageVariant(variantName)) {
    return new Response('Unknown variant', { status: 400 })
  }

  if (variantName === 'original') {
    return createFileResponse(sourceFile, request, { cacheControl: 'no-cache' })
  }

  let result = await imageCache.getOrSet([sourceFile, variantName], () =>
    imageVariants[variantName](sourceFile),
  )
  return createFileResponse(result, request, { cacheControl: 'no-cache' })
})

router.map(routes.fragments, fragmentsController)
router.post(routes.api.cartToggle, toggleCart)

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
