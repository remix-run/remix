import { createMixin, on } from 'remix/component'

declare global {
  interface HTMLElementEventMap {
    [tempoEventType]: TempoEvent
  }
}

export class TempoEvent extends Event {
  bpm: number

  constructor(type: typeof tempoEventType, bpm: number) {
    super(type)
    this.bpm = bpm
  }
}

export let tempoEventType = 'my:tempo' as const

let baseTempoEvents = createMixin<HTMLElement>((handle) => {
  let taps: number[] = []
  let resetTimer = 0

  let handleTap = (node: HTMLElement) => {
    clearTimeout(resetTimer)

    taps.push(Date.now())
    taps = taps.filter((tap) => Date.now() - tap < 4000)

    if (taps.length >= 4) {
      let intervals = []
      for (let i = 1; i < taps.length; i++) {
        intervals.push(taps[i] - taps[i - 1])
      }
      let bpm = intervals.map((interval) => 60000 / interval)
      let avgBpm = Math.round(bpm.reduce((sum, value) => sum + value, 0) / bpm.length)
      node.dispatchEvent(new TempoEvent(tempoEventType, avgBpm))
    }

    resetTimer = window.setTimeout(() => {
      taps = []
    }, 4000)
  }

  return (props) => (
    <handle.element
      {...props}
      mix={[
        on('pointerdown', (event) => {
          console.log('pointerdown', event)
          handleTap(event.currentTarget)
        }),
        on('keydown', (event) => {
          if (event.repeat) return
          if (event.key === 'Enter' || event.key === ' ') {
            handleTap(event.currentTarget)
          }
        }),
      ]}
    />
  )
})

type TempoEventsMixin = typeof baseTempoEvents & {
  readonly type: typeof tempoEventType
}

export let tempoEvents: TempoEventsMixin = Object.assign(baseTempoEvents, {
  type: tempoEventType,
})
