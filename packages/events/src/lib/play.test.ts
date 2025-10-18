import { describe, it, expect, vi } from 'vitest'

class TempoEvent extends Event {
  public readonly tempo: number

  constructor(type: 'tempo:change' | 'tempo:reset', tempo: number) {
    super(type, { bubbles: false })
    this.tempo = tempo
  }
}

declare global {
  interface HTMLElementEventMap {
    'tempo:change': TempoEvent
    'tempo:reset': TempoEvent
  }
}

describe('interactions', () => {
  it('attaches interaction to event target', () => {
    let attachCalls = 0

    function Tempo(this: HTMLElement) {
      attachCalls++
      this.addEventListener('pointerdown', () => {
        this.dispatchEvent(new TempoEvent('tempo:change', 120))
      })
      this.addEventListener('keydown', (event) => {
        this.dispatchEvent(new TempoEvent('tempo:reset', 120))
      })
    }
    defineEvent('tempo:change', Tempo)
    defineEvent('tempo:reset', Tempo)

    let target = document.createElement('button')
    let mock = vi.fn()
    let mock2 = vi.fn()
    target.addEventListener('tempo:change', mock)
    target.addEventListener('tempo:reset', mock2)

    expect(attachCalls).toBe(1)

    target.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, clientY: 100 }))
    expect(mock).toHaveBeenCalled()
    expect(mock2).not.toHaveBeenCalled()

    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(mock2).toHaveBeenCalled()
  })
})

////////////////////////////////////////////////////////////////////////////////
// TODO: ref count to remove attachment
const registered = new Map<string, Function>()
const attachedInteractions = new WeakMap<EventTarget, Set<Function>>()

function defineEvent(name: string, interaction: Function) {
  registered.set(name, interaction)
}

let addEventListener = EventTarget.prototype.addEventListener

EventTarget.prototype.addEventListener = function (type, listener, options) {
  if (registered.has(type)) {
    if (!attachedInteractions.has(this)) {
      attachedInteractions.set(this, new Set())
    }
    let attached = attachedInteractions.get(this)!
    let interaction = registered.get(type)!
    if (!attached.has(interaction)) {
      interaction.call(this)
      attached.add(interaction)
    }
  }
  return addEventListener.call(this, type, listener, options)
}
