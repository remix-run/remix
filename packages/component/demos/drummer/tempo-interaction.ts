import { defineInteraction, type Interaction } from 'remix/interaction'

declare global {
  interface HTMLElementEventMap {
    [tempo]: TempoEvent
  }
}

export class TempoEvent extends Event {
  bpm: number

  constructor(type: typeof tempo, bpm: number) {
    super(type)
    this.bpm = bpm
  }
}

export let tempo = defineInteraction('my:tempo', function (this: Interaction) {
  if (!(this.target instanceof HTMLElement)) return

  let taps: number[] = []
  let resetTimer = 0

  let handleTap = () => {
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
      this.target.dispatchEvent(new TempoEvent(tempo, avgBpm))
    }

    resetTimer = window.setTimeout(() => {
      taps = []
    }, 4000)
  }

  this.on(this.target, {
    pointerdown: handleTap,
    keydown: (event) => {
      if (event.repeat) return
      if (event.key === 'Enter' || event.key === ' ') {
        handleTap()
      }
    },
  })
})
