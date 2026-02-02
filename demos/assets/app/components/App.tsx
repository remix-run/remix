import type { Handle } from '@remix-run/component'

import { greet } from '../utils/greet.ts'
import { Counter } from './Counter.tsx'

export function App(handle: Handle) {
  return (props: { name: string }) => {
    let message = greet(props.name)

    return (
      <div>
        <h2>{message}</h2>
        <Counter />
      </div>
    )
  }
}
