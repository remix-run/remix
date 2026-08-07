import type { Middleware } from 'remix/router'

import { Layout } from '../ui/layout.tsx'

export function render(): Middleware {
  return async (_context, next) => {
    let node = await next()
    return <Layout>{node}</Layout>
  }
}
