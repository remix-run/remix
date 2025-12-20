// This file should only export agnostic Javascript/Web Fetch API exports that
// are available everywhere (server, client, etc.).  Anything relying on
// platform/runtime-specific APIs should not be re-exported here. Consumers
// can import them directly from the sub-package exports.

export { Cookie, createCookie } from './lib/cookie.ts'
export {
  createDeleteRoute,
  createFormRoutes,
  createGetRoute,
  createHeadRoute,
  createOptionsRoute,
  createPatchRoute,
  createPostRoute,
  createPutRoute,
  createResourceRoutes,
  createResourcesRoutes,
  createRouter,
  createRoutes,
  createStorageKey,
  del,
  form,
  get,
  head,
  options,
  patch,
  post,
  put,
  resource,
  resources,
  route,
  type BuildAction,
  type Controller,
  type Middleware,
  type Route,
} from './lib/fetch-router.ts'
export { Cookie as CookieHeader, SetCookie } from './lib/headers.ts'
export { html, isSafeHtml, type SafeHtml } from './lib/html-template.ts'
export { createFileResponse } from './lib/response/file.ts'
export { createHtmlResponse } from './lib/response/html.ts'
export { createRedirectResponse, redirect } from './lib/response/redirect.ts'
