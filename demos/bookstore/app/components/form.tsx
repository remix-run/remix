import type { Route, RequestMethod } from '@remix-run/fetch-router'
import type { Remix } from '@remix-run/dom'

export interface FormProps extends Remix.Props<'form'> {
  route: Route
}

export function Form({ route, ...props }: FormProps) {
  if (route.method === 'GET') {
    return <form method="GET" action={route.href()} {...props} />
  }

  return (
    <form method="POST" action={route.href()} {...props}>
      {route.method !== 'POST' && route.method !== 'ANY' && (
        <input type="hidden" name="_method" value={route.method} />
      )}
      {props.children}
    </form>
  )
}
