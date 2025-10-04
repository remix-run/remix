import type { Route, RequestMethod } from '@remix-run/fetch-router'
import type { Remix } from '@remix-run/dom'

export function Form({
  children,
  route,
}: {
  children?: Remix.RemixNode
  route: Route<RequestMethod, string>
}) {
  if (route.method === 'GET') {
    return (
      <form method="GET" action={route.href()}>
        {children}
      </form>
    )
  }

  return (
    <form method="POST" action={route.href()}>
      <input type="hidden" name="_method" value={route.method} />
      {children}
    </form>
  )
}
