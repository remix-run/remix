export type DecayGenerator = Generator<number, number, number>

export function createExponentialDecayGenerator(
  halfLifeMs: number,
  startValue: number,
  startMs: number,
): DecayGenerator {
  let localEpsilon = 0.001
  function* decay(): Generator<number, number, number> {
    let value = startValue
    let lastMs = startMs
    while (value > localEpsilon) {
      let input = yield value
      let nowMs = typeof input === 'number' ? input : performance.now()
      let deltaMs = Math.max(0, nowMs - lastMs)
      lastMs = nowMs
      let decayFactor = Math.pow(0.5, deltaMs / halfLifeMs)
      value = value * decayFactor
    }
    return 0
  }
  return decay()
}

export function createVoiceLooper(render: () => void, epsilon: number = 0.001) {
  let frameId: number | null = null

  type EnvelopeState = {
    value: number
    halfLifeMs: number
    generator: DecayGenerator | null
  }

  let envelopes: EnvelopeState[] = []

  function ensureLoop() {
    if (frameId != null) return
    frameId = requestAnimationFrame(tick)
    render()
  }

  function tick(now: number) {
    let anyActive = false
    for (let index = 0; index < envelopes.length; index++) {
      let state = envelopes[index]
      if (!state.generator) continue
      let result = state.generator.next(now)
      state.value = result.value ?? 0
      if (result.done) {
        state.generator = null
        state.value = 0
      } else if (state.value > epsilon) {
        anyActive = true
      }
    }

    if (anyActive) {
      render()
      frameId = requestAnimationFrame(tick)
    } else {
      frameId = null
    }
  }

  function createVoice(halfLifeMs: number = 220) {
    let state: EnvelopeState = {
      value: 0,
      halfLifeMs,
      generator: null,
    }
    envelopes.push(state)
    return {
      get value() {
        return state.value
      },
      trigger(amplitude: number = 1) {
        let now = performance.now()
        state.value = amplitude
        state.generator = createExponentialDecayGenerator(state.halfLifeMs, amplitude, now)
        void state.generator.next()
        ensureLoop()
      },
    }
  }

  return createVoice
}
