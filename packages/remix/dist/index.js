// This file should only export agnostic Javascript/Web Fetch API exports that
// are available everywhere (server, client, etc.).  Anything relying on
// platform/runtime-specific APIs should not be re-exported here. Consumers
// can import them directly from the sub-package exports.
export { Cookie, createCookie } from "./lib/cookie.js";
export { createDeleteRoute, createFormRoutes, createGetRoute, createHeadRoute, createOptionsRoute, createPatchRoute, createPostRoute, createPutRoute, createResourceRoutes, createResourcesRoutes, createRouter, createRoutes, createStorageKey, del, form, get, head, options, patch, post, put, resource, resources, route, } from "./lib/fetch-router.js";
export { Cookie as CookieHeader, SetCookie } from "./lib/headers.js";
export { html, isSafeHtml } from "./lib/html-template.js";
export { createFileResponse } from "./lib/response/file.js";
export { createHtmlResponse } from "./lib/response/html.js";
export { createRedirectResponse, redirect } from "./lib/response/redirect.js";
