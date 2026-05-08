import type { RequestContext } from './request-context.ts'

/**
 * Ambient router type configuration for application-wide defaults.
 *
 * Apps may augment this interface to define the default request context used by
 * `createAction()` and `createController()`. Multi-router apps should avoid this
 * global default and pass explicit context types instead.
 *
 * @example
 * ```ts
 * declare module '@remix-run/fetch-router' {
 *   interface RouterTypes {
 *     context: AppContext
 *   }
 * }
 * ```
 */
export interface RouterTypes {}

export type DefaultContext = RouterTypes extends {
  context: infer context extends RequestContext<any, any>
}
  ? context
  : RequestContext
