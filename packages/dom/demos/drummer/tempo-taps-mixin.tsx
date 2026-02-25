import { createMixin } from '@remix-run/dom/spa'

const tapEventType = 'rmx:tempo-taps' as const

declare global {
  interface HTMLElementEventMap {
    [tapEventType]: TempoTapsEvent
  }
}

export class TempoTapsEvent extends Event {
  bpm: number

  constructor(bpm: number) {
    super(tapEventType)
    this.bpm = bpm
  }
}

let tempoTapsMixin = createMixin<[], HTMLElement>((handle) => {
  let activeNode: null | HTMLElement = null
  let removeListeners: null | (() => void) = null
  let taps: number[] = []
  let resetTimer = 0

  function clearResetTimer() {
    if (!resetTimer) return
    clearTimeout(resetTimer)
    resetTimer = 0
  }

  function cleanup() {
    clearResetTimer()
    removeListeners?.()
    removeListeners = null
    activeNode = null
    taps = []
  }

  function handleTap(node: HTMLElement) {
    clearResetTimer()

    taps.push(Date.now())
    taps = taps.filter((tap) => Date.now() - tap < 4000)

    if (taps.length >= 4) {
      let intervals: number[] = []
      for (let index = 1; index < taps.length; index++) {
        intervals.push(taps[index] - taps[index - 1])
      }
      let bpms = intervals.map((interval) => 60000 / interval)
      let averageBpm = Math.round(bpms.reduce((sum, value) => sum + value, 0) / bpms.length)
      node.dispatchEvent(new TempoTapsEvent(averageBpm))
    }

    resetTimer = window.setTimeout(() => {
      taps = []
    }, 4000)
  }

  function attach(node: HTMLElement) {
    if (activeNode === node) return
    cleanup()
    activeNode = node
    let controller = new AbortController()
    let { signal } = controller

    node.addEventListener(
      'pointerdown',
      () => {
        handleTap(node)
      },
      { signal },
    )

    node.addEventListener(
      'keydown',
      (event) => {
        if (event.repeat) return
        if (event.key === 'Enter' || event.key === ' ') {
          handleTap(node)
        }
      },
      { signal },
    )

    removeListeners = () => {
      controller.abort()
    }
  }

  handle.addEventListener('remove', cleanup)

  return (props) => {
    handle.queueTask((node) => {
      if (!(node instanceof HTMLElement)) return
      attach(node)
    })
    return <handle.element {...props} />
  }
})

export let tempoTaps = Object.assign(tempoTapsMixin, {
  type: tapEventType,
})
