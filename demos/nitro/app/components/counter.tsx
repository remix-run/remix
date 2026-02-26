import type { Handle } from 'remix/component'
import { press } from 'remix/interaction/press'

import { clientEntry } from '../utils/client.ts'

import assets from './counter.tsx?assets=client'
import './counter.css'

export let Counter = clientEntry(
  assets,
  'Counter',
  function Counter({ update }: Handle, initialCount: number) {
    let count = initialCount

    let incrementCount = () => {
      count++
      update()
    }

    return () => (
      <button
        class="counter"
        on={{
          [press]: incrementCount,
        }}
      >
        Pressed: {count}
      </button>
    )
  },
)
