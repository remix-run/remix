import { clientEntry, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { getMotion } from './motion.ts'

/**
 * Pauses and resumes every autoplay video on the page. It stays hidden until it hydrates, because
 * it has nothing to control without JavaScript.
 */
export const PauseAnimationsButton = clientEntry(
  import.meta.url,
  function PauseAnimationsButton(handle: Handle<{ class: string }>) {
    let hydrated = false
    let paused = false

    handle.queueTask(() => {
      let motion = getMotion()
      hydrated = true
      paused = motion.paused
      motion.addEventListener(
        'change',
        () => {
          paused = motion.paused
          void handle.update()
        },
        { signal: handle.signal },
      )
      void handle.update()
    })

    return () => (
      <button
        class={handle.props.class}
        type="button"
        hidden={!hydrated}
        mix={on('click', () => getMotion().toggle())}
      >
        {paused ? 'Play animations' : 'Pause animations'}
      </button>
    )
  },
)
