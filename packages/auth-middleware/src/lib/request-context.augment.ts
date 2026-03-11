import type { AuthState } from './types.ts'

declare module '@remix-run/fetch-router' {
  interface RequestContext {
    auth?: AuthState
  }
}

export {}
