import { TypedEventTarget } from '@remix-run/typed-event-target'

interface DrummerEventMap {
  kick: DrumEvent
  snare: DrumEvent
  hat: DrumEvent
  play: DrumEvent
  stop: DrumEvent
  tempoChange: DrumEvent
  change: DrumEvent
}

class DrumEvent extends Event {
  tempo: number

  constructor(type: keyof DrummerEventMap, tempo: number) {
    super(type)
    this.tempo = tempo
  }
}

export class Drummer extends TypedEventTarget<DrummerEventMap> {
  #audioContext: AudioContext | null = null
  #masterGain: GainNode | null = null
  #noiseBuffer: AudioBuffer | null = null

  #isPlaying = false
  #tempoBpm = 90
  #current16th = 0
  #nextNoteTime = 0
  #intervalId: number | null = null

  #lookaheadMs = 25
  #scheduleAheadS = 0.1

  constructor(tempoBpm: number = 90) {
    super()
    this.#tempoBpm = tempoBpm
  }

  get isPlaying() {
    return this.#isPlaying
  }

  get bpm() {
    return this.#tempoBpm
  }

  async toggle() {
    if (this.isPlaying) {
      await this.stop()
    } else {
      await this.play()
    }
  }

  setTempo(bpm: number) {
    this.#tempoBpm = Math.max(30, Math.min(300, Math.floor(bpm || this.#tempoBpm)))
    this.dispatchEvent(new DrumEvent('tempoChange', this.#tempoBpm))
    this.dispatchEvent(new DrumEvent('change', this.#tempoBpm))
  }

  async play(bpm?: number) {
    this.#ensureContext()
    if (!this.#audioContext) return
    if (bpm) this.setTempo(bpm)
    await this.#audioContext.resume()
    if (this.#isPlaying) return
    this.#isPlaying = true
    this.#nextNoteTime = this.#audioContext.currentTime
    if (this.#intervalId != null) window.clearInterval(this.#intervalId)
    this.#intervalId = window.setInterval(this.#scheduler, this.#lookaheadMs)
    this.dispatchEvent(new DrumEvent('play', this.#tempoBpm))
    this.dispatchEvent(new DrumEvent('change', this.#tempoBpm))
  }

  async stop() {
    if (!this.#audioContext) return
    if (this.#intervalId != null) {
      window.clearInterval(this.#intervalId)
      this.#intervalId = null
    }
    this.#isPlaying = false
    this.#current16th = 0
    this.#nextNoteTime = this.#audioContext.currentTime
    this.dispatchEvent(new DrumEvent('stop', this.#tempoBpm))
    this.dispatchEvent(new DrumEvent('change', this.#tempoBpm))
  }

  #ensureContext() {
    if (this.#audioContext) return
    let Context = window.AudioContext || (window as any).webkitAudioContext
    let audioContext = new Context()
    this.#audioContext = audioContext
    this.#masterGain = audioContext.createGain()
    this.#masterGain.gain.value = 0.8
    this.#masterGain.connect(audioContext.destination)
    this.#noiseBuffer = this.#createNoiseBuffer(audioContext)
  }

  #secondsPer16th() {
    return 60 / Math.max(1, this.#tempoBpm) / 4
  }

  #createNoiseBuffer(audioContext: AudioContext) {
    let length = audioContext.sampleRate
    let buffer = audioContext.createBuffer(1, length, audioContext.sampleRate)
    let data = buffer.getChannelData(0)
    for (let index = 0; index < length; index++) {
      data[index] = Math.random() * 2 - 1
    }
    return buffer
  }

  #playKick(time: number) {
    if (!this.#audioContext || !this.#masterGain) return
    let oscillator = this.#audioContext.createOscillator()
    let gain = this.#audioContext.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(150, time)
    oscillator.frequency.exponentialRampToValueAtTime(50, time + 0.1)
    gain.gain.setValueAtTime(1, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15)
    oscillator.connect(gain).connect(this.#masterGain)
    oscillator.start(time)
    oscillator.stop(time + 0.2)
    this.dispatchEvent(new DrumEvent('kick', this.#tempoBpm))
    this.dispatchEvent(new DrumEvent('change', this.#tempoBpm))
  }

  #playSnare(time: number) {
    if (!this.#audioContext || !this.#masterGain || !this.#noiseBuffer) return

    let noise = this.#audioContext.createBufferSource()
    noise.buffer = this.#noiseBuffer
    let bandPass = this.#audioContext.createBiquadFilter()
    bandPass.type = 'bandpass'
    bandPass.frequency.value = 1800
    let noiseGain = this.#audioContext.createGain()
    noiseGain.gain.setValueAtTime(1, time)
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2)
    noise.connect(bandPass).connect(noiseGain).connect(this.#masterGain)
    noise.start(time)
    noise.stop(time + 0.2)

    let oscillator = this.#audioContext.createOscillator()
    let oscillatorGain = this.#audioContext.createGain()
    oscillator.type = 'triangle'
    oscillator.frequency.setValueAtTime(200, time)
    oscillatorGain.gain.setValueAtTime(0.6, time)
    oscillatorGain.gain.exponentialRampToValueAtTime(0.01, time + 0.12)
    oscillator.connect(oscillatorGain).connect(this.#masterGain)
    oscillator.start(time)
    oscillator.stop(time + 0.15)
    this.dispatchEvent(new DrumEvent('snare', this.#tempoBpm))
    this.dispatchEvent(new DrumEvent('change', this.#tempoBpm))
  }

  #playHiHat(time: number) {
    if (!this.#audioContext || !this.#masterGain || !this.#noiseBuffer) return
    let noise = this.#audioContext.createBufferSource()
    noise.buffer = this.#noiseBuffer
    let highPass = this.#audioContext.createBiquadFilter()
    highPass.type = 'highpass'
    highPass.frequency.value = 7000
    let gain = this.#audioContext.createGain()
    gain.gain.setValueAtTime(0.5, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04)
    noise.connect(highPass).connect(gain).connect(this.#masterGain)
    noise.start(time)
    noise.stop(time + 0.05)
    this.dispatchEvent(new DrumEvent('hat', this.#tempoBpm))
    this.dispatchEvent(new DrumEvent('change', this.#tempoBpm))
  }

  #scheduleStep(step: number, time: number) {
    if (step === 0 || step === 10) this.#playKick(time)
    if (step === 4 || step === 12) this.#playSnare(time)
    if (step % 2 === 0) this.#playHiHat(time)
    if (step === 7 || step === 9) this.#playHiHat(time)
  }

  #advanceNote() {
    this.#nextNoteTime += this.#secondsPer16th()
    this.#current16th = (this.#current16th + 1) % 16
  }

  #scheduler = () => {
    if (!this.#audioContext) return
    while (this.#nextNoteTime < this.#audioContext.currentTime + this.#scheduleAheadS) {
      this.#scheduleStep(this.#current16th, this.#nextNoteTime)
      this.#advanceNote()
    }
  }
}
