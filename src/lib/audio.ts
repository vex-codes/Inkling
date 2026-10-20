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

  /** Procedural Lo-Fi Beats & Warm Electric Chords (100% offline synthesis) */
  private startLofi(ctx: AudioContext, master: GainNode) {
    let active = true

    // Master filter for that warm, muffled cassette tone
    const lofiFilter = ctx.createBiquadFilter()
    lofiFilter.type = 'lowpass'
    lofiFilter.frequency.setValueAtTime(1050, ctx.currentTime)

    // Tape wow/flutter LFO
    const flutterLfo = ctx.createOscillator()
    const flutterGain = ctx.createGain()
    flutterLfo.frequency.setValueAtTime(0.4, ctx.currentTime) // slow analog drift
    flutterGain.gain.setValueAtTime(2.2, ctx.currentTime) // micro pitch detune
    flutterLfo.connect(flutterGain)
    flutterLfo.start()

    // Gentle vinyl / cassette tape hiss
    const hissBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const hissData = hissBuffer.getChannelData(0)
    let lastOut = 0
    for (let i = 0; i < hissData.length; i++) {
      const white = Math.random() * 2 - 1
      hissData[i] = (lastOut + 0.02 * white) / 1.02 * 0.04
      lastOut = hissData[i]
    }
    const hissSource = ctx.createBufferSource()
    hissSource.buffer = hissBuffer
    hissSource.loop = true
    const hissFilter = ctx.createBiquadFilter()
    hissFilter.type = 'bandpass'
    hissFilter.frequency.setValueAtTime(2200, ctx.currentTime)
    hissFilter.Q.setValueAtTime(1.2, ctx.currentTime)

    const hissGain = ctx.createGain()
    hissGain.gain.setValueAtTime(0.08, ctx.currentTime)

    hissSource.connect(hissFilter)
    hissFilter.connect(hissGain)
    hissGain.connect(master)
    hissSource.start()

    // 4 Classic Lo-Fi Chords: Dm9 -> G13 -> Cmaj9 -> Am9
    const chords = [
      [146.83, 220.0, 261.63, 329.63, 392.0], // Dm9
      [98.0, 196.0, 246.94, 329.63, 440.0],  // G13
      [130.81, 196.0, 246.94, 329.63, 392.0], // Cmaj9
      [110.0, 164.81, 220.0, 261.63, 329.63], // Am9
    ]

    let step = 0
    const chordDuration = 2.4 // seconds per chord (~62.5 BPM)

    const playChord = () => {
      if (!active || ctx.state === 'closed') return

      const freqs = chords[step % chords.length]
      step++

      // Play soft electric piano voice for each note in chord
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const noteGain = ctx.createGain()

        // Soft Rhodes electric piano timbre: mix of sine and triangle
        osc.type = idx === 0 ? 'sine' : 'triangle'
        osc.frequency.setValueAtTime(freq, ctx.currentTime)
        flutterGain.connect(osc.frequency) // tape wow/flutter

        const now = ctx.currentTime
        noteGain.gain.setValueAtTime(0.0001, now)
        noteGain.gain.linearRampToValueAtTime(idx === 0 ? 0.08 : 0.04, now + 0.06)
        noteGain.gain.exponentialRampToValueAtTime(0.0005, now + chordDuration * 0.95)

        osc.connect(noteGain)
        noteGain.connect(lofiFilter)

        osc.start(now)
        osc.stop(now + chordDuration)
      })

      // Soft Sub Kick on beat 1
      const kickOsc = ctx.createOscillator()
      const kickGain = ctx.createGain()
      kickOsc.type = 'sine'
      const now = ctx.currentTime
      kickOsc.frequency.setValueAtTime(95, now)
      kickOsc.frequency.exponentialRampToValueAtTime(38, now + 0.16)
      kickGain.gain.setValueAtTime(0.09, now)
      kickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
      kickOsc.connect(kickGain)
      kickGain.connect(master)
      kickOsc.start(now)
      kickOsc.stop(now + 0.2)

      // Warm rim/shaker click on beat 2
      const rimTime = now + chordDuration * 0.5
      const rimOsc = ctx.createOscillator()
      const rimGain = ctx.createGain()
      rimOsc.type = 'triangle'
      rimOsc.frequency.setValueAtTime(320, rimTime)
      rimGain.gain.setValueAtTime(0.0001, rimTime)
      rimGain.gain.linearRampToValueAtTime(0.025, rimTime + 0.01)
      rimGain.gain.exponentialRampToValueAtTime(0.0001, rimTime + 0.08)
      rimOsc.connect(rimGain)
      rimGain.connect(master)
      rimOsc.start(rimTime)
      rimOsc.stop(rimTime + 0.09)
    }

    lofiFilter.connect(master)
    playChord()
    const chordTimer = setInterval(playChord, chordDuration * 1000)

    this.ambientSources.push({
      stop: () => {
        active = false
        clearInterval(chordTimer)
        try {
          flutterLfo.stop()
          flutterLfo.disconnect()
          hissSource.stop()
          hissSource.disconnect()
          lofiFilter.disconnect()
        } catch {
          // ignore
        }
      },
    })
  }
}

export const sanctuaryAudio = new SanctuaryAudioEngine()
