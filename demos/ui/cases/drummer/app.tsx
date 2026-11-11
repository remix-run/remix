import { css, on, ref, type Handle } from 'remix/component'
import { press } from '@remix-run/ui/press'
import { Drummer } from './drummer.ts'
import { tempoEvents } from './tempo-interaction.tsx'
import {
  BPMDisplay,
  Button,
  ControlGroup,
  EqualizerBar,
  EqualizerLayout,
  Layout,
  TempoButton,
  TempoButtons,
  TempoLayout,
} from './components.tsx'
import { createVoiceLooper } from './voice-looper.ts'

export function App(handle: Handle<{}, Drummer>) {
  let drummer = new Drummer(80)

  handle.context.set(drummer)

  handle.queueTask(() => {
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key === ' ') {
          drummer.toggle()
        }
        if (event.key === 'ArrowUp') {
          drummer.setTempo(drummer.bpm + 1)
        }
        if (event.key === 'ArrowDown') {
          drummer.setTempo(drummer.bpm - 1)
        }
      },
      { signal: handle.signal },
    )
  })

  return () => (
    <Layout>
      <Equalizer />
      <DrumControls />
    </Layout>
  )
}

export function Equalizer(handle: Handle) {
  let drummer = handle.context.get(App)

  let kickVolumes = [0.4, 0.8, 0.3, 0.1]
  let snareVolumes = [0.4, 1, 0.7]
  let hatVolumes = [0.1, 0.8]

  let createVoice = createVoiceLooper(handle.update)

  let kick = createVoice()
  let snare = createVoice()
  let hat = createVoice()

  drummer.addEventListener('kick', () => kick.trigger(1), { signal: handle.signal })
  drummer.addEventListener('snare', () => snare.trigger(1), { signal: handle.signal })
  drummer.addEventListener('hat', () => hat.trigger(1), { signal: handle.signal })

  return () => {
    // get values from all the generators
    let kicks = kickVolumes.map((volume) => kick.value * volume)
    let snares = snareVolumes.map((volume) => snare.value * volume)
    let hats = hatVolumes.map((volume) => hat.value * volume)

    return (
      <EqualizerLayout>
        {/* kick */}
        <EqualizerBar volume={kicks[0]} />
        <EqualizerBar volume={kicks[1]} />
        <EqualizerBar volume={kicks[2]} />
        <EqualizerBar volume={kicks[3]} />

        {/* snare */}
        <EqualizerBar volume={snares[0]} />
        <EqualizerBar volume={snares[1]} />
        <EqualizerBar volume={snares[2]} />

        {/* hat */}
        <EqualizerBar volume={hats[0]} />
        <EqualizerBar volume={hats[1]} />
      </EqualizerLayout>
    )
  }
}

function DrumControls(handle: Handle) {
  let drummer = handle.context.get(App)
  let stop: HTMLButtonElement
  let play: HTMLButtonElement

  drummer.addEventListener('change', () => handle.update(), { signal: handle.signal })

  return () => (
    <ControlGroup>
      <Button
        mix={[
          tempoEvents(),
          on(tempoEvents.type, (event) => {
            drummer.play(event.bpm)
          }),
        ]}
      >
        SET TEMPO
      </Button>

      <TempoDisplay />

      <Button
        disabled={drummer.isPlaying}
        mix={[
          ref((node: HTMLButtonElement) => (play = node)),
          on('click', () => {
            drummer.play()
            handle.queueTask(() => {
              stop.focus()
            })
          }),
        ]}
      >
        PLAY
      </Button>

      <Button
        disabled={!drummer.isPlaying}
        mix={[
          ref((node: HTMLButtonElement) => (stop = node)),
          press({
            activate: false,
            onPressStart() {
              drummer.stop()
              handle.queueTask(() => {
                play.focus()
              })
            },
          }),
        ]}
      >
        STOP
      </Button>
    </ControlGroup>
  )
}

function TempoDisplay(handle: Handle) {
  let drummer = handle.context.get(App)
  return () => (
    <TempoLayout>
      <BPMDisplay bpm={drummer.bpm} />
      <TempoButtons>
        <TempoButton
          orientation="up"
          mix={[
            press({
              activate: false,
              onPressStart() {
                drummer.setTempo(drummer.bpm + 1)
              },
            }),
            css({ borderTopRightRadius: '18px' }),
          ]}
        />
        <TempoButton
          mix={[
            press({
              activate: false,
              onPressStart() {
                drummer.setTempo(drummer.bpm - 1)
              },
            }),
            css({ borderBottomRightRadius: '18px' }),
          ]}
          orientation="down"
        />
      </TempoButtons>
    </TempoLayout>
  )
}
