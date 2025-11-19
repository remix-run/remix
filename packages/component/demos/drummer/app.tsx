import { arrowDown, arrowUp, space } from '@remix-run/interaction/keys'
import { press } from '@remix-run/interaction/press'
import { Drummer } from './drummer.ts'
import { tempo } from './tempo-interaction.ts'
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

export function App(this: Remix.Handle<Drummer>) {
  let drummer = new Drummer(80)

  this.on(document, {
    [space]() {
      drummer.toggle()
    },
    [arrowUp]() {
      drummer.setTempo(drummer.bpm + 1)
    },
    [arrowDown]() {
      drummer.setTempo(drummer.bpm - 1)
    },
  })

  this.context.set(drummer)

  return () => (
    <Layout>
      <Equalizer />
      <DrumControls />
    </Layout>
  )
}

export function Equalizer(this: Remix.Handle) {
  let drummer = this.context.get(App)

  let kickVolumes = [0.4, 0.8, 0.3, 0.1]
  let snareVolumes = [0.4, 1, 0.7]
  let hatVolumes = [0.1, 0.8]

  let createVoice = createVoiceLooper(this.update)

  let kick = createVoice()
  let snare = createVoice()
  let hat = createVoice()

  this.on(drummer, {
    kick() {
      kick.trigger(1)
    },
    snare() {
      snare.trigger(1)
    },
    hat() {
      hat.trigger(1)
    },
  })

  // initial animation on connect
  this.queueTask(() => {
    this.update()
  })

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

function DrumControls(this: Remix.Handle) {
  let drummer = this.context.get(App)
  let stop: HTMLButtonElement
  let play: HTMLButtonElement

  this.on(drummer, {
    change: () => this.update(),
  })

  return () => (
    <ControlGroup>
      <Button
        on={{
          [tempo]: (event) => {
            drummer.play(event.bpm)
          },
        }}
      >
        SET TEMPO
      </Button>

      <TempoDisplay />

      <Button
        disabled={drummer.isPlaying}
        connect={(node) => (play = node)}
        on={{
          click: () => {
            console.log('play')
            drummer.play()
            this.queueTask(() => {
              stop.focus()
            })
          },
        }}
      >
        PLAY
      </Button>

      <Button
        disabled={!drummer.isPlaying}
        connect={(node) => (stop = node)}
        on={{
          [press]: () => {
            drummer.stop()
            this.queueTask(() => {
              play.focus()
            })
          },
        }}
      >
        STOP
      </Button>
    </ControlGroup>
  )
}

function TempoDisplay(this: Remix.Handle) {
  let drummer = this.context.get(App)
  return () => (
    <TempoLayout>
      <BPMDisplay bpm={drummer.bpm} />
      <TempoButtons>
        <TempoButton
          css={{ borderTopRightRadius: '24px' }}
          orientation="up"
          on={{
            [press]: () => {
              drummer.setTempo(drummer.bpm + 1)
            },
          }}
        />
        <TempoButton
          css={{ borderBottomRightRadius: '24px' }}
          orientation="down"
          on={{
            [press]: () => {
              drummer.setTempo(drummer.bpm - 1)
            },
          }}
        />
      </TempoButtons>
    </TempoLayout>
  )
}
