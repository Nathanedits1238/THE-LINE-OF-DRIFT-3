/**
 * Procedural Web Audio Engine for Outlaw Velocity: Police Pursuit 3D
 * All audio is synthesized via Web Audio API oscillators, noise generators, and filters.
 * Zero external asset or 404 dependencies.
 */

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted: boolean = false;

  // Engine sound nodes
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private engineRunning: boolean = false;

  // Drift sound nodes
  private driftNoiseGain: GainNode | null = null;
  private driftFilter: BiquadFilterNode | null = null;

  // Nitro sound nodes
  private nitroNoiseGain: GainNode | null = null;
  private nitroOsc: OscillatorNode | null = null;

  // Siren sound nodes
  private sirenOsc: OscillatorNode | null = null;
  private sirenLfo: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private sirenPlaying: boolean = false;

  // Dynamic City Ambiance & Environmental Acoustics nodes
  private cityHumGain: GainNode | null = null;
  private cityHumFilter: BiquadFilterNode | null = null;

  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;

  private tireResonanceGain: GainNode | null = null;
  private tireResonanceFilter: BiquadFilterNode | null = null;

  private sirenEchoDelay: DelayNode | null = null;
  private sirenEchoFeedback: GainNode | null = null;
  private sirenEchoWetGain: GainNode | null = null;

  private tunnelDelay: DelayNode | null = null;
  private tunnelFeedback: GainNode | null = null;
  private tunnelWetGain: GainNode | null = null;

  // Pre-allocated noise buffer for zero GC audio
  private sharedNoiseBuffer: AudioBuffer | null = null;

  // Voice-over playback queue (Alan tutorial narration & game voice clips)
  private activeVoiceAudio: HTMLAudioElement | null = null;
  private activeVoiceVolume: number = 0.92;
  private voiceQueue: Array<{
    src: string;
    volume?: number;
    onStart?: () => void;
    onEnd?: () => void;
  }> = [];
  private preloadedVoiceMap: Map<string, HTMLAudioElement> = new Map();
  private voicePlaybackToken: number = 0;
  private pendingVoiceUnlockCleanup: (() => void) | null = null;

  constructor() {
    // Initialized on user interaction to comply with browser autoplay policies
  }

  private initContext() {
    if (this.ctx) return;
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Pre-allocate 2 seconds of white noise once
    const bufferSize = this.ctx.sampleRate * 2;
    this.sharedNoiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = this.sharedNoiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.setupEngineSynth();
    this.setupDriftSynth();
    this.setupNitroSynth();
    this.setupSirenSynth();
    this.setupCityAmbianceSynth();
  }

  public ensureRunning() {
    this.initContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(
        this.muted ? 0 : 0.7,
        this.ctx.currentTime
      );
    }
    if (this.activeVoiceAudio) {
      this.activeVoiceAudio.volume = this.muted ? 0 : this.activeVoiceVolume;
    }
    return this.muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public preloadVoiceClips(urls: string[]) {
    for (const url of urls) {
      if (this.preloadedVoiceMap.has(url)) continue;
      const audio = new Audio(url);
      audio.preload = 'auto';
      this.preloadedVoiceMap.set(url, audio);
    }
  }

  public playVoiceSequence(
    clips: Array<{
      src: string;
      volume?: number;
      onStart?: () => void;
      onEnd?: () => void;
    }>
  ) {
    this.stopVoiceClips();
    if (!clips.length) return;
    this.voiceQueue = [...clips];
    this.playNextVoiceClip(this.voicePlaybackToken);
  }

  private playNextVoiceClip(token: number) {
    if (token !== this.voicePlaybackToken) return;
    const nextClip = this.voiceQueue.shift();
    if (!nextClip) {
      this.activeVoiceAudio = null;
      return;
    }

    const audio = new Audio(nextClip.src);
    audio.preload = 'auto';
    this.activeVoiceVolume = nextClip.volume ?? 0.92;
    audio.volume = this.muted ? 0 : this.activeVoiceVolume;
    this.activeVoiceAudio = audio;

    let finished = false;
    const finishClip = () => {
      if (finished) return;
      finished = true;
      if (this.activeVoiceAudio === audio) {
        this.activeVoiceAudio = null;
      }
      if (token === this.voicePlaybackToken) {
        nextClip.onEnd?.();
        this.playNextVoiceClip(token);
      }
    };

    audio.addEventListener('ended', finishClip, { once: true });
    audio.addEventListener('error', finishClip, { once: true });

    nextClip.onStart?.();
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        if (token !== this.voicePlaybackToken) return;
        this.clearPendingVoiceUnlock();
        const retryPlay = () => {
          this.clearPendingVoiceUnlock();
          if (token !== this.voicePlaybackToken || this.activeVoiceAudio !== audio) return;
          audio.volume = this.muted ? 0 : this.activeVoiceVolume;
          void audio.play().catch(finishClip);
        };
        window.addEventListener('pointerdown', retryPlay, { once: true });
        window.addEventListener('keydown', retryPlay, { once: true });
        this.pendingVoiceUnlockCleanup = () => {
          window.removeEventListener('pointerdown', retryPlay);
          window.removeEventListener('keydown', retryPlay);
        };
      });
    }
  }

  private clearPendingVoiceUnlock() {
    this.pendingVoiceUnlockCleanup?.();
    this.pendingVoiceUnlockCleanup = null;
  }

  public pauseVoiceClip() {
    if (this.activeVoiceAudio && !this.activeVoiceAudio.paused) {
      this.activeVoiceAudio.pause();
    }
  }

  public resumeVoiceClip() {
    if (this.activeVoiceAudio && this.activeVoiceAudio.paused && !this.activeVoiceAudio.ended) {
      this.activeVoiceAudio.volume = this.muted ? 0 : this.activeVoiceVolume;
      void this.activeVoiceAudio.play().catch(() => {});
    }
  }

  public stopVoiceClips() {
    this.voicePlaybackToken++;
    this.voiceQueue = [];
    this.clearPendingVoiceUnlock();
    if (this.activeVoiceAudio) {
      this.activeVoiceAudio.pause();
      try {
        this.activeVoiceAudio.currentTime = 0;
      } catch {
        // Ignore seek errors on unbuffered audio elements
      }
      this.activeVoiceAudio = null;
    }
  }

  // Engine synthesizer
  private setupEngineSynth() {
    if (!this.ctx || !this.masterGain) return;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(450, this.ctx.currentTime);

    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.setValueAtTime(55, this.ctx.currentTime);

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.setValueAtTime(110, this.ctx.currentTime);

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOsc1.start();
    this.engineOsc2.start();
    this.engineRunning = true;
  }

  // Drift / Tire screech synthesizer (White noise + bandpass filter)
  private setupDriftSynth() {
    if (!this.ctx || !this.masterGain || !this.sharedNoiseBuffer) return;

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = this.sharedNoiseBuffer;
    whiteNoise.loop = true;

    this.driftFilter = this.ctx.createBiquadFilter();
    this.driftFilter.type = 'bandpass';
    this.driftFilter.frequency.setValueAtTime(1100, this.ctx.currentTime);
    this.driftFilter.Q.setValueAtTime(3.5, this.ctx.currentTime);

    this.driftNoiseGain = this.ctx.createGain();
    this.driftNoiseGain.gain.setValueAtTime(0, this.ctx.currentTime);

    whiteNoise.connect(this.driftFilter);
    this.driftFilter.connect(this.driftNoiseGain);
    this.driftNoiseGain.connect(this.masterGain);

    whiteNoise.start();
  }

  // Nitro boost sound
  private setupNitroSynth() {
    if (!this.ctx || !this.masterGain || !this.sharedNoiseBuffer) return;

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = this.sharedNoiseBuffer;
    whiteNoise.loop = true;

    const nitroFilter = this.ctx.createBiquadFilter();
    nitroFilter.type = 'highpass';
    nitroFilter.frequency.setValueAtTime(800, this.ctx.currentTime);

    this.nitroNoiseGain = this.ctx.createGain();
    this.nitroNoiseGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.nitroOsc = this.ctx.createOscillator();
    this.nitroOsc.type = 'sine';
    this.nitroOsc.frequency.setValueAtTime(180, this.ctx.currentTime);

    whiteNoise.connect(nitroFilter);
    nitroFilter.connect(this.nitroNoiseGain);
    this.nitroNoiseGain.connect(this.masterGain);

    whiteNoise.start();
    this.nitroOsc.start();
  }

  // Police Siren Synthesizer
  private setupSirenSynth() {
    if (!this.ctx || !this.masterGain) return;

    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'sine';
    this.sirenOsc.frequency.setValueAtTime(750, this.ctx.currentTime);

    // LFO to modulate siren frequency (yelp vs wail)
    this.sirenLfo = this.ctx.createOscillator();
    this.sirenLfo.type = 'triangle';
    this.sirenLfo.frequency.setValueAtTime(1.8, this.ctx.currentTime);

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(280, this.ctx.currentTime);

    this.sirenLfo.connect(lfoGain);
    lfoGain.connect(this.sirenOsc.frequency);

    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.masterGain);

    this.sirenOsc.start();
    this.sirenLfo.start();
  }

  // Dynamic City Ambiance Layer: Urban bed, skyscraper siren echoes, bridge wind, tunnel tire resonance
  private setupCityAmbianceSynth() {
    if (!this.ctx || !this.masterGain || !this.sharedNoiseBuffer) return;
    const now = this.ctx.currentTime;

    // 1. Urban Background Hum (low-passed city traffic/atmosphere bed)
    const cityNoise = this.ctx.createBufferSource();
    cityNoise.buffer = this.sharedNoiseBuffer;
    cityNoise.loop = true;

    this.cityHumFilter = this.ctx.createBiquadFilter();
    this.cityHumFilter.type = 'lowpass';
    this.cityHumFilter.frequency.setValueAtTime(220, now);

    this.cityHumGain = this.ctx.createGain();
    this.cityHumGain.gain.setValueAtTime(0, now);

    cityNoise.connect(this.cityHumFilter);
    this.cityHumFilter.connect(this.cityHumGain);
    this.cityHumGain.connect(this.masterGain);
    cityNoise.start();

    // 2. High-Altitude Bridge Wind Layer
    const windNoise = this.ctx.createBufferSource();
    windNoise.buffer = this.sharedNoiseBuffer;
    windNoise.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.setValueAtTime(480, now);
    this.windFilter.Q.setValueAtTime(1.6, now);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0, now);

    windNoise.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    windNoise.start();

    // 3. Tunnel Tire Resonance Layer (hollow acoustic roar of tires on concrete)
    const tireNoise = this.ctx.createBufferSource();
    tireNoise.buffer = this.sharedNoiseBuffer;
    tireNoise.loop = true;

    this.tireResonanceFilter = this.ctx.createBiquadFilter();
    this.tireResonanceFilter.type = 'bandpass';
    this.tireResonanceFilter.frequency.setValueAtTime(340, now);
    this.tireResonanceFilter.Q.setValueAtTime(5.2, now);

    this.tireResonanceGain = this.ctx.createGain();
    this.tireResonanceGain.gain.setValueAtTime(0, now);

    tireNoise.connect(this.tireResonanceFilter);
    this.tireResonanceFilter.connect(this.tireResonanceGain);
    this.tireResonanceGain.connect(this.masterGain);
    tireNoise.start();

    // 4. Skyscraper Siren Echo Bus (Slapback urban canyon delay on siren)
    if (this.sirenGain) {
      this.sirenEchoDelay = this.ctx.createDelay(1.0);
      this.sirenEchoDelay.delayTime.setValueAtTime(0.21, now);

      const echoFilter = this.ctx.createBiquadFilter();
      echoFilter.type = 'bandpass';
      echoFilter.frequency.setValueAtTime(1150, now);
      echoFilter.Q.setValueAtTime(1.1, now);

      this.sirenEchoFeedback = this.ctx.createGain();
      this.sirenEchoFeedback.gain.setValueAtTime(0.38, now);

      this.sirenEchoWetGain = this.ctx.createGain();
      this.sirenEchoWetGain.gain.setValueAtTime(0, now);

      this.sirenGain.connect(this.sirenEchoDelay);
      this.sirenEchoDelay.connect(echoFilter);
      echoFilter.connect(this.sirenEchoFeedback);
      this.sirenEchoFeedback.connect(this.sirenEchoDelay);
      echoFilter.connect(this.sirenEchoWetGain);
      this.sirenEchoWetGain.connect(this.masterGain);
    }

    // 5. Tunnel Slapback Reflection Bus (reflects engine & drift inside tunnels)
    this.tunnelDelay = this.ctx.createDelay(0.5);
    this.tunnelDelay.delayTime.setValueAtTime(0.058, now);

    const tunnelBoxFilter = this.ctx.createBiquadFilter();
    tunnelBoxFilter.type = 'bandpass';
    tunnelBoxFilter.frequency.setValueAtTime(520, now);
    tunnelBoxFilter.Q.setValueAtTime(1.4, now);

    this.tunnelFeedback = this.ctx.createGain();
    this.tunnelFeedback.gain.setValueAtTime(0.45, now);

    this.tunnelWetGain = this.ctx.createGain();
    this.tunnelWetGain.gain.setValueAtTime(0, now);

    if (this.engineGain) this.engineGain.connect(this.tunnelDelay);
    if (this.driftNoiseGain) this.driftNoiseGain.connect(this.tunnelDelay);
    this.tunnelDelay.connect(tunnelBoxFilter);
    tunnelBoxFilter.connect(this.tunnelFeedback);
    this.tunnelFeedback.connect(this.tunnelDelay);
    tunnelBoxFilter.connect(this.tunnelWetGain);
    this.tunnelWetGain.connect(this.masterGain);
  }

  /**
   * Updates dynamic continuous audio parameters per frame.
   * @param speedKmh Current vehicle speed
   * @param rpm 0.0 to 1.0 (engine rev level)
   * @param driftSlip 0.0 to 1.0 (lateral tire slip)
   * @param nitroActive boolean
   * @param policeHeat 0 to 5
   * @param nearestCopDistance distance in meters to nearest cop
   * @param acoustics Environmental factors for urban echoes, bridge wind, and tunnel resonance
   */
  public updateContinuousAudio(
    speedKmh: number,
    rpm: number,
    driftSlip: number,
    nitroActive: boolean,
    policeHeat: number,
    nearestCopDistance: number,
    acoustics: {
      skyscraperDensity: number;
      bridgeAltitudeFactor: number;
      tunnelFactor: number;
      cityDensity: number;
    } = { skyscraperDensity: 0, bridgeAltitudeFactor: 0, tunnelFactor: 0, cityDensity: 0.4 },
    enginePitchMult: number = 1.0
  ) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    // 1. Engine (silent when enginePitchMult === 0 for foot / bicycle / skateboard)
    if (this.engineGain && this.engineOsc1 && this.engineOsc2 && this.engineFilter) {
      if (enginePitchMult <= 0.01) {
        this.engineGain.gain.setTargetAtTime(0, now, 0.05);
      } else {
        const targetGain = 0.08 + Math.min(speedKmh / 280, 0.25) * 0.5;
        this.engineGain.gain.setTargetAtTime(targetGain, now, 0.05);

        const baseFreq = (45 + rpm * 140) * enginePitchMult;
        this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.04);
        this.engineOsc2.frequency.setTargetAtTime(baseFreq * 2.01, now, 0.04);

        const filterFreq = (300 + rpm * 2200) * Math.min(1.5, 0.7 + enginePitchMult * 0.35);
        this.engineFilter.frequency.setTargetAtTime(filterFreq, now, 0.05);
      }
    }

    // 2. Drift / Tire Screech
    if (this.driftNoiseGain && this.driftFilter) {
      const driftIntensity = Math.max(0, Math.min(driftSlip, 1));
      const targetDriftGain = driftIntensity > 0.15 ? driftIntensity * 0.4 : 0;
      this.driftNoiseGain.gain.setTargetAtTime(targetDriftGain, now, 0.04);
      this.driftFilter.frequency.setTargetAtTime(
        900 + driftIntensity * 600,
        now,
        0.05
      );
    }

    // 3. Nitro
    if (this.nitroNoiseGain) {
      const nitroTarget = nitroActive ? 0.35 : 0;
      this.nitroNoiseGain.gain.setTargetAtTime(nitroTarget, now, 0.05);
    }

    // 4. Police Siren + Skyscraper Echo Modulation
    if (this.sirenGain && this.sirenLfo) {
      if (policeHeat > 0 && nearestCopDistance < 150) {
        // Distance falloff (closer = louder)
        const distFactor = Math.max(0, 1 - nearestCopDistance / 150);
        const sirenVol = (0.05 + 0.3 * distFactor) * (policeHeat >= 3 ? 1.2 : 0.8);
        this.sirenGain.gain.setTargetAtTime(sirenVol, now, 0.1);

        // Heat 3+ has faster yelp siren
        const lfoSpeed = policeHeat >= 3 ? 3.5 : 1.6;
        this.sirenLfo.frequency.setTargetAtTime(lfoSpeed, now, 0.1);
      } else {
        this.sirenGain.gain.setTargetAtTime(0, now, 0.2);
      }
    }

    // 5. Dynamic City Ambiance Layer
    const speedRatio = Math.min(1, speedKmh / 240);

    // 5a. Urban background hum (muted slightly inside tunnels, stronger in dense city)
    if (this.cityHumGain && this.cityHumFilter) {
      const humVol = Math.max(0.015, acoustics.cityDensity * 0.055) * (1 - acoustics.tunnelFactor * 0.4);
      this.cityHumGain.gain.setTargetAtTime(humVol, now, 0.15);
      this.cityHumFilter.frequency.setTargetAtTime(180 + acoustics.skyscraperDensity * 140, now, 0.15);
    }

    // 5b. High-altitude bridge wind rush
    if (this.windGain && this.windFilter) {
      const altitudeBoost = acoustics.bridgeAltitudeFactor * 0.22;
      const openAirSpeedWind = speedRatio * speedRatio * (0.04 + acoustics.bridgeAltitudeFactor * 0.18);
      const windVol = Math.max(0, (altitudeBoost * 0.45 + openAirSpeedWind) * (1 - acoustics.tunnelFactor * 0.85));
      this.windGain.gain.setTargetAtTime(windVol, now, 0.12);
      this.windFilter.frequency.setTargetAtTime(340 + speedRatio * 550 + acoustics.bridgeAltitudeFactor * 260, now, 0.12);
    }

    // 5c. Tire resonance & acoustic tunnel slapback inside tunnels/underpasses
    if (this.tireResonanceGain && this.tireResonanceFilter && this.tunnelWetGain) {
      const tireResVol = acoustics.tunnelFactor * (0.04 + speedRatio * 0.26);
      this.tireResonanceGain.gain.setTargetAtTime(tireResVol, now, 0.08);
      this.tireResonanceFilter.frequency.setTargetAtTime(260 + speedRatio * 420, now, 0.08);
      this.tunnelWetGain.gain.setTargetAtTime(acoustics.tunnelFactor * 0.42, now, 0.08);
    }

    // 5d. Skyscraper siren echo slapback (stronger around tall buildings or tunnels)
    if (this.sirenEchoWetGain && this.sirenEchoFeedback && this.sirenEchoDelay) {
      const echoIntensity = Math.min(1, acoustics.skyscraperDensity * 0.9 + acoustics.tunnelFactor * 0.5);
      this.sirenEchoWetGain.gain.setTargetAtTime(echoIntensity * 0.58, now, 0.12);
      this.sirenEchoFeedback.gain.setTargetAtTime(0.25 + echoIntensity * 0.35, now, 0.12);
      this.sirenEchoDelay.delayTime.setTargetAtTime(0.16 + acoustics.skyscraperDensity * 0.09, now, 0.15);
    }
  }

  // Crash / Metal Collision sound
  public playCollisionSound(intensity: number = 0.5) {
    if (!this.ctx || this.muted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140 * (1 + intensity), now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);

    const gain = this.ctx.createGain();
    const vol = Math.min(0.6, 0.15 + intensity * 0.45);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    // Filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.32);

    // Noise burst for crunch
    this.playNoiseBurst(0.2, vol * 0.7);
  }

  private playNoiseBurst(duration: number, volume: number) {
    if (!this.ctx || !this.masterGain || !this.sharedNoiseBuffer) return;
    const now = this.ctx.currentTime;

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = this.sharedNoiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    whiteNoise.start(now);
  }

  // Police Radio Beep / Chatter sound
  public playPoliceRadioChirp() {
    if (!this.ctx || this.muted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.setValueAtTime(2200, now + 0.04);
    osc.frequency.setValueAtTime(1600, now + 0.08);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  // UI / Gameplay Jingles
  public playCountdownBeep(highPitch: boolean = false) {
    if (!this.ctx || this.muted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(highPitch ? 880 : 440, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (highPitch ? 0.35 : 0.18));

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  public playSuccessFanfare() {
    if (!this.ctx || this.muted) return;
    this.ensureRunning();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const now = this.ctx!.currentTime + idx * 0.12;
      const osc = this.ctx!.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + 0.38);
    });
  }

  public playBustedSound() {
    if (!this.ctx || this.muted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.8);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.95);
  }

  public playWrenchToolSound() {
    if (!this.ctx || this.muted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;
    // Rachet / wrench click impact
    for (let i = 0; i < 3; i++) {
      const clickTime = now + i * 0.06;
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1400 + i * 200, clickTime);
      osc.frequency.exponentialRampToValueAtTime(300, clickTime + 0.03);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.3, clickTime);
      gain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.04);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(clickTime);
      osc.stop(clickTime + 0.05);
    }
  }

  public playShowroomRevSound() {
    if (!this.ctx || this.muted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;
    // V8 Engine Revving burst in showroom
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc2.type = 'triangle';

    osc.frequency.setValueAtTime(60, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.5);
    osc.frequency.exponentialRampToValueAtTime(90, now + 1.2);

    osc2.frequency.setValueAtTime(120, now);
    osc2.frequency.exponentialRampToValueAtTime(480, now + 0.5);
    osc2.frequency.exponentialRampToValueAtTime(180, now + 1.2);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(2200, now + 0.5);
    filter.frequency.exponentialRampToValueAtTime(500, now + 1.2);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0.5, now + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 1.35);
    osc2.stop(now + 1.35);
  }

  public playAchievementUnlockSound() {
    if (!this.ctx || this.muted) return;
    this.ensureRunning();
    // Crisp celebratory crystalline arpeggio (D5 -> F#5 -> A5 -> D6 -> A6)
    const notes = [587.33, 739.99, 880.0, 1174.66, 1760.0];
    const baseTime = this.ctx.currentTime;
    notes.forEach((freq, idx) => {
      const start = baseTime + idx * 0.08;
      const osc = this.ctx!.createOscillator();
      osc.type = idx === notes.length - 1 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(idx === notes.length - 1 ? 0.3 : 0.22, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + (idx === notes.length - 1 ? 0.65 : 0.28));

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(start);
      osc.stop(start + 0.7);
    });
  }

  public playNpcBumpSound() {
    if (!this.ctx || this.muted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.14);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playThunderRumble() {
    if (!this.ctx || this.muted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    // Deep sub-bass thunder oscillator
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(65, now);
    osc.frequency.exponentialRampToValueAtTime(24, now + 1.8);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(140, now);
    filter.frequency.linearRampToValueAtTime(70, now + 1.8);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.48, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 2.3);

    // Rumble noise component
    if (this.sharedNoiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.sharedNoiseBuffer;
      noise.loop = true;

      const nFilter = this.ctx.createBiquadFilter();
      nFilter.type = 'bandpass';
      nFilter.frequency.setValueAtTime(110, now);
      nFilter.Q.setValueAtTime(2.5, now);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.35, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

      noise.connect(nFilter);
      nFilter.connect(nGain);
      nGain.connect(this.masterGain!);
      noise.start(now);
      noise.stop(now + 2.1);
    }
  }

  public playPropCrashSound(type: 'wood' | 'metal' = 'metal') {
    if (!this.ctx || this.muted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    if (type === 'wood') {
      // Wood splinter / snap sound
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.18);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.25);
    } else {
      // Metallic crunch + glass clang
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.25);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);
      filter.Q.setValueAtTime(3.0, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.42, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.35);
    }

    // Impact burst noise
    if (this.sharedNoiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.sharedNoiseBuffer;
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.32, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      noise.connect(nGain);
      nGain.connect(this.masterGain!);
      noise.start(now);
      noise.stop(now + 0.18);
    }
  }

  public playDoorEnterSound() {
    if (!this.ctx || this.muted) return;
    this.ensureRunning();
    const now = this.ctx.currentTime;

    // Two-tone welcoming chime (F5 -> A5)
    [700, 880].forEach((freq, idx) => {
      const start = now + idx * 0.11;
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.24, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  }

  public stopAll() {
    const t = this.ctx?.currentTime || 0;
    if (this.engineGain) this.engineGain.gain.setValueAtTime(0, t);
    if (this.sirenGain) this.sirenGain.gain.setValueAtTime(0, t);
    if (this.driftNoiseGain) this.driftNoiseGain.gain.setValueAtTime(0, t);
    if (this.nitroNoiseGain) this.nitroNoiseGain.gain.setValueAtTime(0, t);
    if (this.cityHumGain) this.cityHumGain.gain.setValueAtTime(0, t);
    if (this.windGain) this.windGain.gain.setValueAtTime(0, t);
    if (this.tireResonanceGain) this.tireResonanceGain.gain.setValueAtTime(0, t);
    if (this.sirenEchoWetGain) this.sirenEchoWetGain.gain.setValueAtTime(0, t);
    if (this.tunnelWetGain) this.tunnelWetGain.gain.setValueAtTime(0, t);
    this.stopVoiceClips();
  }
}

export const sound = new SoundEngine();
