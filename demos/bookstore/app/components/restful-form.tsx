import type { Remix } from '@remix-run/dom'

export interface RestfulFormProps extends Remix.Props<'form'> {
  /**
   * The name of the hidden <input> field that contains the method override value.
   * Default is `_method`.
   */
  methodOverrideField?: string
}

/**
 * A wrapper around the `<form>` element that supports RESTful API methods like `PUT` and `DELETE`.
 *
 * When the method is not `GET` or `POST`, a hidden <input> field is added to the form with a
 * "method override" value that instructs the server to use the specified method when routing
 * the request.
 */
export function RestfulForm({
  method = 'GET',
  methodOverrideField = '_method',
  ...props
}: RestfulFormProps) {
  method = method.toUpperCase()

  if (method === 'GET') {
    return <form method="GET" {...props} />
  }

  return (
    <form method="POST" {...props}>
      {method !== 'POST' && <input type="hidden" name={methodOverrideField} value={method} />}
      {props.children}
    </form>
  )
}
