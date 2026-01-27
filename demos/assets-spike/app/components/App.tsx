import type { Handle } from '@remix-run/component'

import { greet } from '../utils/greet.ts'
import { Counter } from './Counter.tsx'

export function App(handle: Handle) {
  // Props are received by the render function, not the setup function
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
