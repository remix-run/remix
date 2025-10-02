import type { Remix } from '@remix-run/dom'
import { hydrated } from '@remix-run/dom'
import { press } from '@remix-run/events/press'

function Counter(this: Remix.Handle) {
  let count = 0

  return () => {
    return (
      <button
        on={press(() => {
          count++
          this.render()
        })}
      >
        {count}
      </button>
    )
  }
}

export const HydratedCounter = hydrated('/dist/counter.js#HydratedCounter', Counter)
