import { connect, css, on, pressEvents, type ComponentHandle } from '@remix-run/dom'
import { Drummer } from './drummer.ts'
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
import { tempoTaps } from './tempo-taps-mixin.tsx'
import { createVoiceLooper } from './voice-looper.ts'

export function App(handle: ComponentHandle<Drummer>) {
  handle.context.set(new Drummer(80))

  return () => (
    <Layout>
      <Equalizer />
      <DrumControls />
    </Layout>
  )
}

export function Equalizer(handle: ComponentHandle) {
  let drummer = handle.context.get(App)
  let kickVolumes = [0.4, 0.8, 0.3, 0.1]
  let snareVolumes = [0.4, 1, 0.7]
  let hatVolumes = [0.1, 0.8]
  let createVoice = createVoiceLooper(() => {
    handle.update()
  })

  let kick = createVoice()
  let snare = createVoice()
  let hat = createVoice()

  drummer.addEventListener('kick', () => {
    kick.trigger(1)
  })
  drummer.addEventListener('snare', () => {
    snare.trigger(1)
  })
  drummer.addEventListener('hat', () => {
    hat.trigger(1)
  })

  handle.queueTask(() => {
    handle.update()
  })

  return () => {
    let kicks = kickVolumes.map((volume) => kick.value * volume)
    let snares = snareVolumes.map((volume) => snare.value * volume)
    let hats = hatVolumes.map((volume) => hat.value * volume)

    return (
      <EqualizerLayout>
        <EqualizerBar volume={kicks[0]} />
        <EqualizerBar volume={kicks[1]} />
        <EqualizerBar volume={kicks[2]} />
        <EqualizerBar volume={kicks[3]} />

        <EqualizerBar volume={snares[0]} />
        <EqualizerBar volume={snares[1]} />
        <EqualizerBar volume={snares[2]} />

        <EqualizerBar volume={hats[0]} />
        <EqualizerBar volume={hats[1]} />
      </EqualizerLayout>
    )
  }
}

function DrumControls(handle: ComponentHandle) {
  let drummer = handle.context.get(App) as unknown as Drummer
  let playButton: HTMLButtonElement | null = null
  let stopButton: HTMLButtonElement | null = null
  drummer.addEventListener('change', () => {
    handle.update()
  })

  return () => (
    <ControlGroup>
      <Button
        mix={[
          tempoTaps(),
          on(tempoTaps.type, (event) => {
            drummer.play(event.bpm)
          }),
        ]}
      >
        SET TEMPO
      </Button>

      <TempoDisplay />

      <Button
        id="drummer-play"
        disabled={drummer.isPlaying}
        mix={[
          connect((node) => {
            playButton = node
          }),
          pressEvents(),
          on(pressEvents.down, async () => {
            drummer.play()
            await handle.update()
            stopButton?.focus()
          }),
        ]}
      >
        PLAY
      </Button>

      <Button
        id="drummer-stop"
        disabled={!drummer.isPlaying}
        mix={[
          connect((node) => {
            stopButton = node
          }),
          pressEvents(),
          on(pressEvents.down, async () => {
            drummer.stop()
            await handle.update()
            playButton?.focus()
          }),
        ]}
      >
        STOP
      </Button>
    </ControlGroup>
  )
}

function TempoDisplay(handle: ComponentHandle) {
  let drummer = handle.context.get(App)
  return () => (
    <TempoLayout>
      <BPMDisplay bpm={drummer.bpm} />
      <TempoButtons>
        <TempoButton
          orientation="up"
          mix={[
            pressEvents(),
            css({ borderTopRightRadius: 18 }),
            on(pressEvents.press, () => {
              drummer.setTempo(drummer.bpm + 1)
            }),
          ]}
        />
        <TempoButton
          orientation="down"
          mix={[
            pressEvents(),
            css({ borderBottomRightRadius: 18 }),
            on(pressEvents.press, () => {
              drummer.setTempo(drummer.bpm - 1)
            }),
          ]}
        />
      </TempoButtons>
    </TempoLayout>
  )
}
