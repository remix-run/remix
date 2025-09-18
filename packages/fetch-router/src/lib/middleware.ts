import type { RequestContext } from './request-context.ts'

export type NextFunction = () => Promise<Response>

export interface Middleware<T extends string = string> {
  (ctx: RequestContext<T>, next: NextFunction): Response | Promise<Response> | void | Promise<void>
}
