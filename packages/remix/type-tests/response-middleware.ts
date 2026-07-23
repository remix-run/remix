import { asyncContext } from 'remix/middleware/async-context'
import { auth, type requireAuth } from 'remix/middleware/auth'
import type { compression } from 'remix/middleware/compression'
import type { cop } from 'remix/middleware/cop'
import type { cors } from 'remix/middleware/cors'
import type { csrf } from 'remix/middleware/csrf'
import { formData } from 'remix/middleware/form-data'
import type { logger } from 'remix/middleware/logger'
import { methodOverride } from 'remix/middleware/method-override'
import { renderWith } from 'remix/middleware/render'
import type { session } from 'remix/middleware/session'
import type { staticFiles } from 'remix/middleware/static'
import { createRouter } from 'remix/router'
import type { Middleware } from 'remix/router'
import type { RemixNode } from 'remix/ui'

declare module 'remix/router' {
  interface RouterTypes {
    output: RemixNode
  }
}

declare const authMiddleware: ReturnType<typeof requireAuth>
declare const compressionMiddleware: ReturnType<typeof compression>
declare const copMiddleware: ReturnType<typeof cop>
declare const corsMiddleware: ReturnType<typeof cors>
declare const csrfMiddleware: ReturnType<typeof csrf>
declare const loggerMiddleware: ReturnType<typeof logger>
declare const sessionMiddleware: ReturnType<typeof session>
declare const staticMiddleware: ReturnType<typeof staticFiles>

type MiddlewareOutput<middleware> =
  middleware extends Middleware<infer _transform, infer output> ? output : never
type IsEqual<left, right> =
  (<type>() => type extends left ? 1 : 2) extends <type>() => type extends right ? 1 : 2
    ? true
    : false

declare function expectResponseMiddleware<middleware>(
  middleware: middleware &
    (IsEqual<MiddlewareOutput<middleware>, Response> extends true ? unknown : never),
): void

if (false as boolean) {
  expectResponseMiddleware(authMiddleware)
  expectResponseMiddleware(compressionMiddleware)
  expectResponseMiddleware(copMiddleware)
  expectResponseMiddleware(corsMiddleware)
  expectResponseMiddleware(csrfMiddleware)
  expectResponseMiddleware(loggerMiddleware)
  expectResponseMiddleware(sessionMiddleware)
  expectResponseMiddleware(staticMiddleware)

  createRouter({
    defaultHandler: () => null,
    middleware: [
      asyncContext(),
      auth({
        schemes: [
          {
            name: 'test',
            authenticate: () => null,
          },
        ],
      }),
      formData(),
      methodOverride(),
      renderWith(() => () => new Response()),
    ],
  })

  createRouter({
    defaultHandler: () => null,
    // @ts-expect-error - requireAuth middleware requires Response output
    middleware: [authMiddleware],
  })

  createRouter({
    defaultHandler: () => null,
    // @ts-expect-error - compression middleware requires Response output
    middleware: [compressionMiddleware],
  })

  createRouter({
    defaultHandler: () => null,
    // @ts-expect-error - COP middleware requires Response output
    middleware: [copMiddleware],
  })

  createRouter({
    defaultHandler: () => null,
    // @ts-expect-error - CORS middleware requires Response output
    middleware: [corsMiddleware],
  })

  createRouter({
    defaultHandler: () => null,
    // @ts-expect-error - CSRF middleware requires Response output
    middleware: [csrfMiddleware],
  })

  createRouter({
    defaultHandler: () => null,
    // @ts-expect-error - logger middleware requires Response output
    middleware: [loggerMiddleware],
  })

  createRouter({
    defaultHandler: () => null,
    // @ts-expect-error - session middleware requires Response output
    middleware: [sessionMiddleware],
  })

  createRouter({
    defaultHandler: () => null,
    // @ts-expect-error - static middleware requires Response output
    middleware: [staticMiddleware],
  })
}
