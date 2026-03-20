import type { AppContext } from './router.ts'

declare module 'remix/async-context-middleware' {
  interface AsyncContextTypes {
    requestContext: AppContext
  }
}
