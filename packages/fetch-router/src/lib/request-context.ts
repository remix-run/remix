import type { Params } from '@remix-run/route-pattern'

import { AppStorage } from './app-storage.ts'

export class RequestContext<T extends string = string> {
  readonly params: Params<T>
  readonly request: Request
  readonly url: URL
  readonly storage: AppStorage

  constructor(params: Params<T>, request: Request, url: URL) {
    this.params = params
    this.request = request
    this.url = url
    this.storage = new AppStorage()
  }
}
