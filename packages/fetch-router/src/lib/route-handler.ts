import type { RequestContext } from './request-context.ts'

export interface RouteHandler<T extends string = string> {
  (ctx: RequestContext<T>): Response | Promise<Response>
}
