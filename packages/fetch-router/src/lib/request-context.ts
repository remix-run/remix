import type { Params } from '@remix-run/route-pattern'

import { AppContext } from './app-context.ts'

export class RequestContext<T extends string = string> {
  readonly context: AppContext
  readonly request: Request
  readonly params: Params<T>
  readonly url: URL

  constructor(request: Request, params: Params<T>, url: URL) {
    this.context = new AppContext()
    this.request = request
    this.params = params
    this.url = url
  }
}
