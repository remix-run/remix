// This file should only export agnostic Javascript/Web Fetch API exports that
// are available everywhere (server, client, etc.).  Anything relying on
// platform-specific APIs should be exported from `index-platform.ts`

export { Cookie, createCookie } from './lib/cookie.ts'
export {
  createRouter,
  createStorageKey,
  del,
  form,
  get,
  post,
  put,
  resources,
  route,
  type BuildAction,
  type Controller,
  type Middleware,
  type Route,
} from './lib/fetch-router.ts'
export { formData } from './lib/form-data-middleware.ts'
export type { FileUpload } from './lib/form-data-middleware.ts'
export { Cookie as CookieHeader, SetCookie } from './lib/headers.ts'
export { html, isSafeHtml, type SafeHtml } from './lib/html-template.ts'
export { on } from './lib/interaction.ts'
export { logger } from './lib/logger-middleware.ts'
export { methodOverride } from './lib/method-override-middleware.ts'
export { detectMimeType, isCompressibleMimeType } from './lib/mime.ts'
export { createFileResponse } from './lib/response/file.ts'
export { createHtmlResponse } from './lib/response/html.ts'
export { createRedirectResponse } from './lib/response/redirect.ts'
