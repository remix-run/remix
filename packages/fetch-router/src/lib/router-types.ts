import type { RequestContext } from './request-context.ts'

/**
 * Ambient router type configuration for application-wide defaults.
 *
 * Apps may augment this interface to define the default request context and output used by router
 * APIs. Multi-router apps should avoid these global defaults and pass explicit types instead.
 *
 * @example
 * ```ts
 * declare module '@remix-run/fetch-router' {
 *   interface RouterTypes {
 *     context: AppContext
 *     output: AppNode
 *   }
 * }
 * ```
 */
export interface RouterTypes {}

export type DefaultContext = RouterTypes extends {
  context: infer context extends RequestContext<any, any, any>
}
  ? context
  : RequestContext

export type DefaultOutput = RouterTypes extends { output: infer output } ? output : Response
