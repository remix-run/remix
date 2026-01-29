import type { Handle } from '@remix-run/component'

export function ConditionalChild(handle: Handle) {
  let value = 'Initial'

  return () => <div data-testid="conditional-child">Child: {value}</div>
}
