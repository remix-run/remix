import { type Handle } from 'remix/component'
import { spring } from 'remix/component'

let initialOrder = ['#ff0088', '#dd00ee', '#9911ff', '#0d63f8']

function shuffle<T>(array: T[]): T[] {
  let result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function Reordering(handle: Handle) {
  let order = initialOrder

  function scheduleNextShuffle() {
    setTimeout(() => {
      if (handle.signal.aborted) return
      order = shuffle(order)
      handle.update()
      scheduleNextShuffle()
    }, 1000)
  }

  scheduleNextShuffle()

  return () => (
    <ul
      css={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        position: 'relative',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        width: 220,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {order.map((backgroundColor) => (
        <li
          key={backgroundColor}
          css={{
            width: 100,
            height: 100,
            borderRadius: 10,
          }}
          style={{ backgroundColor }}
          animate={{
            layout: spring({ duration: 600, bounce: 0.2 }),
          }}
        />
      ))}
    </ul>
  )
}
