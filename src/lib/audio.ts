// Offline procedural Web Audio synthesis for Inkling — 0 external audio assets.
// Procedural Lo-Fi study beats & analog tape warmth synthesis.

export type SoundscapeType = 'off' | 'lofi'

class SanctuaryAudioEngine {
  private ctx: AudioContext | null = null
  private ambientGain: GainNode | null = null
  private currentSoundscape: SoundscapeType = 'off'
  private ambientSources: { stop: () => void }[] = []
  private volume = 0.35

  private initCtx(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new AudioCtx()
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol))
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05)
    }
  }

  getVolume() {
    return this.volume
  }

  getSoundscape() {
    return this.currentSoundscape
  }

  stopSoundscape() {
    for (const src of this.ambientSources) {
      try {
        src.stop()
      } catch {
        // ignore
      }
    }
    this.ambientSources = []
    this.currentSoundscape = 'off'
  }

  setSoundscape(type: SoundscapeType) {
    this.stopSoundscape()
    if (type === 'off') return

    const ctx = this.initCtx()
    this.currentSoundscape = type

    if (!this.ambientGain) {
      this.ambientGain = ctx.createGain()
      this.ambientGain.gain.setValueAtTime(this.volume, ctx.currentTime)
      this.ambientGain.connect(ctx.destination)
    }

    if (type === 'lofi') {
      this.startLofi(ctx, this.ambientGain)
    }
  }

  /**
   * Procedural Lo-Fi Study Engine (100% offline Web Audio synthesis)
   * Psychoacoustics & Cognitive Load Architecture:
   * - Tempo: 66 BPM (synchronizes with resting heart rate ~60-70 BPM, promotes alpha-band 8-12 Hz neural focus)
   * - Harmony: F Major / D Minor 9th & 13th modal jazz progression (8 bars; avoids abrupt cadence distractions)
   * - Timbre: Warm Rhodes electric piano with micro-strum (28ms) + 0.35Hz tape wow & flutter
   * - Rhythm: 4/4 boom-bap with natural J Dilla micro-swing (+28ms on off-beats) & soft acoustic-damped transients
   * - Masking: Pink noise (1/f) tape hiss buffer for room auditory masking (Baddeley working memory protection)
   * - Sparkle: Low-density generative pentatonic chimes to prevent repetitive auditory fatigue
   */
  private startLofi(ctx: AudioContext, master: GainNode) {
    let active = true

    // Master filter: vintage cassette head curve (~1250Hz low-pass)
    const tapeFilter = ctx.createBiquadFilter()
    tapeFilter.type = 'lowpass'
    tapeFilter.frequency.setValueAtTime(1250, ctx.currentTime)

    // Master flutter LFO: subtle analog motor drift (0.35 Hz)
    const flutterLfo = ctx.createOscillator()
    const flutterGain = ctx.createGain()
    flutterLfo.frequency.setValueAtTime(0.35, ctx.currentTime)
    flutterGain.gain.setValueAtTime(1.8, ctx.currentTime) // micro-cents pitch drift
    flutterLfo.connect(flutterGain)
    flutterLfo.start()

    // Pink noise generator for acoustic background masking (Paul Kellet's filter)
    const pinkNoiseLength = ctx.sampleRate * 2
    const pinkBuffer = ctx.createBuffer(1, pinkNoiseLength, ctx.sampleRate)
    const channelData = pinkBuffer.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < pinkNoiseLength; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.96900 * b2 + white * 0.1538520
      b3 = 0.86650 * b3 + white * 0.3104856
      b4 = 0.55000 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.0168980
      channelData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.015
      b6 = white * 0.115926
    }
    const noiseSource = ctx.createBufferSource()
    noiseSource.buffer = pinkBuffer
    noiseSource.loop = true

    const noiseFilter = ctx.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.setValueAtTime(1800, ctx.currentTime)
    noiseFilter.Q.setValueAtTime(0.9, ctx.currentTime)

    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.045, ctx.currentTime)
    noiseSource.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(master)
    noiseSource.start()

    // 8-Bar Relaxing Modal Chord Progression (Fmaj9 -> Am7 -> Dm9 -> Bbmaj7 -> Gm9 -> C13 -> Dm7 -> Cmaj9)
    const progression = [
      { bass: 87.31, chord: [220.0, 261.63, 329.63, 392.0] },        // Fmaj9
      { bass: 110.0, chord: [261.63, 329.63, 392.0, 493.88] },       // Am7
      { bass: 73.42, chord: [174.61, 220.0, 261.63, 329.63] },       // Dm9
      { bass: 116.54, chord: [220.0, 293.66, 349.23, 440.0] },       // Bbmaj7
      { bass: 98.0, chord: [233.08, 293.66, 349.23, 440.0] },        // Gm9
      { bass: 65.41, chord: [164.81, 233.08, 293.66, 440.0] },       // C13
      { bass: 73.42, chord: [174.61, 220.0, 261.63, 349.23] },       // Dm7
      { bass: 82.41, chord: [196.0, 246.94, 293.66, 329.63, 392.0] } // Cmaj9/E
    ]

    // Pentatonic chime pool for light ambient sparkle (F, G, A, C, D, F)
    const chimePool = [349.23, 392.0, 440.0, 523.25, 587.33, 698.46]

    // Tempo calculations: 66 BPM = 0.909s / beat
    const bpm = 66
    const tBeat = 60 / bpm
    const tBar = tBeat * 4
    let barIndex = 0
    let nextBarTime = ctx.currentTime + 0.05

    // Procedural sound generators
    const playKick = (time: number, velocity = 1.0) => {
      if (!active) return
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(86, time)
      osc.frequency.exponentialRampToValueAtTime(36, time + 0.14)
      gain.gain.setValueAtTime(0.08 * velocity, time)
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16)
      osc.connect(gain)
      gain.connect(master)
      osc.start(time)
      osc.stop(time + 0.18)
    }

    const playSnareRim = (time: number, velocity = 1.0) => {
      if (!active) return
      // Body tone
      const osc = ctx.createOscillator()
      const oscGain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(210, time)
      oscGain.gain.setValueAtTime(0.03 * velocity, time)
      oscGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.08)
      osc.connect(oscGain)
      oscGain.connect(master)
      osc.start(time)
      osc.stop(time + 0.09)

      // Soft brush/noise snap
      const noise = ctx.createBufferSource()
      noise.buffer = pinkBuffer
      const nFilter = ctx.createBiquadFilter()
      nFilter.type = 'bandpass'
      nFilter.frequency.setValueAtTime(1400, time)
      nFilter.Q.setValueAtTime(1.5, time)
      const nGain = ctx.createGain()
      nGain.gain.setValueAtTime(0.04 * velocity, time)
      nGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.11)
      noise.connect(nFilter)
      nFilter.connect(nGain)
      nGain.connect(master)
      noise.start(time)
      noise.stop(time + 0.12)
    }

    const playHiHat = (time: number, velocity = 1.0) => {
      if (!active) return
      const hat = ctx.createBufferSource()
      hat.buffer = pinkBuffer
      const hFilter = ctx.createBiquadFilter()
      hFilter.type = 'highpass'
      hFilter.frequency.setValueAtTime(4200, time)
      const hGain = ctx.createGain()
      hGain.gain.setValueAtTime(0.012 * velocity, time)
      hGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045)
      hat.connect(hFilter)
      hFilter.connect(hGain)
      hGain.connect(master)
      hat.start(time)
      hat.stop(time + 0.05)
    }

    const playChime = (time: number, freq: number) => {
      if (!active) return
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, time)
      flutterGain.connect(osc.frequency)
      gain.gain.setValueAtTime(0.0001, time)
      gain.gain.linearRampToValueAtTime(0.016, time + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.6)
      osc.connect(gain)
      gain.connect(tapeFilter)
      osc.start(time)
      osc.stop(time + 1.7)
    }

    const scheduleBar = (startTime: number, barIdx: number) => {
      const { bass, chord } = progression[barIdx % progression.length]

      // 1. Warm Electric Piano Chords (Humanized strum)
      chord.forEach((freq, noteIdx) => {
        const strumDelay = noteIdx * 0.028 // 28ms humanized finger roll
        const noteTime = startTime + strumDelay

        const osc = ctx.createOscillator()
        const noteGain = ctx.createGain()
        osc.type = noteIdx % 2 === 0 ? 'sine' : 'triangle'
        osc.frequency.setValueAtTime(freq, noteTime)
        flutterGain.connect(osc.frequency) // Analog wow/flutter

        noteGain.gain.setValueAtTime(0.0001, noteTime)
        noteGain.gain.linearRampToValueAtTime(0.038, noteTime + 0.035)
        noteGain.gain.exponentialRampToValueAtTime(0.0003, noteTime + tBar * 0.95)

        osc.connect(noteGain)
        noteGain.connect(tapeFilter)
        osc.start(noteTime)
        osc.stop(noteTime + tBar)
      })

      // 2. Warm Sub Bass
      const bassOsc = ctx.createOscillator()
      const bassGain = ctx.createGain()
      bassOsc.type = 'sine'
      bassOsc.frequency.setValueAtTime(bass, startTime)
      bassGain.gain.setValueAtTime(0.0001, startTime)
      bassGain.gain.linearRampToValueAtTime(0.07, startTime + 0.04)
      bassGain.gain.exponentialRampToValueAtTime(0.0005, startTime + tBar * 0.9)
      bassOsc.connect(bassGain)
      bassGain.connect(master)
      bassOsc.start(startTime)
      bassOsc.stop(startTime + tBar)

      // 3. Boom-Bap Swing Rhythm Section
      // Beat 1: Kick
      playKick(startTime, 1.0)

      // Beat 2: Snare/Rim
      playSnareRim(startTime + tBeat * 1, 0.9)

      // Beat 2.75: Ghost Kick with J Dilla swing (+24ms)
      playKick(startTime + tBeat * 1.75 + 0.024, 0.55)

      // Beat 3: Soft Kick
      playKick(startTime + tBeat * 2, 0.7)

      // Beat 4: Snare/Rim
      playSnareRim(startTime + tBeat * 3, 1.0)

      // 8th-note Hi-hats with swing on off-beats
      for (let eighth = 0; eighth < 8; eighth++) {
        const isOffBeat = eighth % 2 !== 0
        const swingOffset = isOffBeat ? 0.026 : 0 // +26ms J Dilla swing delay
        const hatTime = startTime + eighth * (tBeat / 2) + swingOffset
        const velocity = isOffBeat ? 0.6 : 1.0
        playHiHat(hatTime, velocity)
      }

      // 4. Subtle Ambient Pentatonic Chime (50% chance each bar on beat 2 or 3)
      if (Math.random() > 0.4) {
        const chimeNote = chimePool[Math.floor(Math.random() * chimePool.length)]
        const chimeBeat = Math.random() > 0.5 ? 1.5 : 2.5
        playChime(startTime + tBeat * chimeBeat, chimeNote)
      }
    }

    tapeFilter.connect(master)

    // Master Web Audio Clock scheduler (100ms interval looking ahead 400ms)
    const scheduleInterval = setInterval(() => {
      if (!active || ctx.state === 'closed') return
      while (nextBarTime < ctx.currentTime + 0.4) {
        scheduleBar(nextBarTime, barIndex)
        nextBarTime += tBar
        barIndex++
      }
    }, 100)

    this.ambientSources.push({
      stop: () => {
        active = false
        clearInterval(scheduleInterval)
        try {
          flutterLfo.stop()
          flutterLfo.disconnect()
          noiseSource.stop()
          noiseSource.disconnect()
          tapeFilter.disconnect()
        } catch {
          // ignore
        }
      },
    })
  }
}

export const sanctuaryAudio = new SanctuaryAudioEngine()
