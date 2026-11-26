import * as THREE from 'three';
import { sound } from '../audio/SoundEffects';
import { GraphicsQuality, TimeOfDay, WeatherType } from '../types';

export interface WeatherConditionInfo {
  type: WeatherType;
  label: string;
  icon: string;
  gripMultiplier: number; // 1.0 = 100% grip
  brakingMultiplier: number; // 1.0 = normal braking
  driftSlipBonus: number; // higher = kicks out into drift easier
  fogDensity: number;
  fogColor: number;
  sunIntensity: number;
  roadRoughness: number;
  roadMetalness: number;
  description: string;
}

export const WEATHER_CONDITIONS: Record<WeatherType, WeatherConditionInfo> = {
  sunny: {
    type: 'sunny',
    label: 'ENSOLARADO',
    icon: '☀️',
    gripMultiplier: 1.0,
    brakingMultiplier: 1.0,
    driftSlipBonus: 0.0,
    fogDensity: 0.0022,
    fogColor: 0x90b4d6,
    sunIntensity: 2.6,
    roadRoughness: 0.78,
    roadMetalness: 0.12,
    description: 'Pista seca · Aderência 100% · Visibilidade máxima',
  },
  rain: {
    type: 'rain',
    label: 'CHUVA',
    icon: '🌧️',
    gripMultiplier: 0.75, // -25% grip
    brakingMultiplier: 1.35,
    driftSlipBonus: 0.35,
    fogDensity: 0.0055,
    fogColor: 0x16202e,
    sunIntensity: 1.4,
    roadRoughness: 0.15, // wet glassy sheen
    roadMetalness: 0.65,
    description: 'Asfalto molhado · Aderência 75% (-25%) · Drift facilitado',
  },
  storm: {
    type: 'storm',
    label: 'TEMPESTADE',
    icon: '⚡',
    gripMultiplier: 0.65, // -35% grip
    brakingMultiplier: 1.6,
    driftSlipBonus: 0.55,
    fogDensity: 0.0085,
    fogColor: 0x070c14,
    sunIntensity: 0.8,
    roadRoughness: 0.08,
    roadMetalness: 0.8,
    description: 'Aquaplanagem severa · Aderência 65% (-35%) · Relâmpagos e trovões',
  },
  fog: {
    type: 'fog',
    label: 'NEBLINA',
    icon: '🌫️',
    gripMultiplier: 0.85, // -15% grip
    brakingMultiplier: 1.15,
    driftSlipBonus: 0.18,
    fogDensity: 0.016,
    fogColor: 0x1a2433,
    sunIntensity: 1.1,
    roadRoughness: 0.45,
    roadMetalness: 0.35,
    description: 'Nevoeiro denso · Visibilidade reduzida · Aderência 85% (-15%)',
  },
};

export class DynamicWeatherSystem {
  public scene: THREE.Scene;
  public currentWeather: WeatherType = 'rain';
  public targetWeather: WeatherType = 'rain';
  public timeOfDay: TimeOfDay = 'night';
  public quality: GraphicsQuality = 'high';

  // Dynamic cycle parameters
  public autoCycleEnabled: boolean = true;
  private weatherCycleTimer: number = 0;
  private weatherCycleInterval: number = 110; // Change weather every ~110 seconds

  // Transition smoothing (0 to 1)
  private transitionAlpha: number = 1.0;
  private transitionDuration: number = 7.0; // 7 seconds smooth blend

  // Current interpolated values for physics & rendering
  public currentGripMultiplier: number = 0.75;
  public currentBrakingMultiplier: number = 1.35;
  public currentFogDensity: number = 0.0055;
  public currentSunIntensity: number = 1.4;

  // Lightning dynamics during storm
  public isLightningActive: boolean = false;
  private lightningTimer: number = 6.0;
  private lightningFlashDuration: number = 0;

  // Rain Particles
  private rainMesh: THREE.Points | null = null;
  private rainPositions: Float32Array | null = null;
  private rainCount: number = 1200;

  // Scene references (set by CityGenerator or Scene)
  public sunLight: THREE.DirectionalLight | null = null;
  public hemiLight: THREE.HemisphereLight | null = null;
  public roadMaterials: THREE.MeshStandardMaterial[] = [];

  // Callbacks
  public onWeatherChanged?: (weather: WeatherType, info: WeatherConditionInfo) => void;
  public onLightningFlash?: (intensity: number) => void;

  constructor(scene: THREE.Scene, initialWeather: WeatherType = 'rain', initialTime: TimeOfDay = 'night') {
    this.scene = scene;
    const safeWeather: WeatherType = WEATHER_CONDITIONS[initialWeather] ? initialWeather : 'rain';
    this.currentWeather = safeWeather;
    this.targetWeather = safeWeather;
    this.timeOfDay = initialTime;

    const info = WEATHER_CONDITIONS[safeWeather] || WEATHER_CONDITIONS.rain;
    this.currentGripMultiplier = info.gripMultiplier;
    this.currentBrakingMultiplier = info.brakingMultiplier;
    this.currentFogDensity = info.fogDensity;
    this.currentSunIntensity = info.sunIntensity;

    this.setupRainParticles();
  }

  public setupRainParticles() {
    if (this.rainMesh) {
      this.scene.remove(this.rainMesh);
      this.rainMesh.geometry.dispose();
      (this.rainMesh.material as THREE.Material).dispose();
      this.rainMesh = null;
    }

    this.rainCount = this.quality === 'low' ? 600 : this.quality === 'medium' ? 1400 : 2500;
    const positions = new Float32Array(this.rainCount * 3);
    for (let i = 0; i < this.rainCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 220;
      positions[i * 3 + 1] = Math.random() * 55;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 220;
    }
    this.rainPositions = positions;

    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const rainMat = new THREE.PointsMaterial({
      color: 0x99ccff,
      size: 0.28,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });

    this.rainMesh = new THREE.Points(rainGeo, rainMat);
    this.rainMesh.visible = this.currentWeather === 'rain' || this.currentWeather === 'storm';
    this.scene.add(this.rainMesh);
  }

  public setQuality(quality: GraphicsQuality) {
    this.quality = quality;
    this.setupRainParticles();
  }

  public registerRoadMaterial(mat: THREE.MeshStandardMaterial) {
    if (!this.roadMaterials.includes(mat)) {
      this.roadMaterials.push(mat);
    }
  }

  public clearRoadMaterials() {
    this.roadMaterials = [];
  }

  /**
   * Sets new weather with optional smooth transition or instantaneous snap.
   */
  public setWeather(newWeather: WeatherType, immediate: boolean = false) {
    if (this.targetWeather === newWeather && !immediate) return;

    this.targetWeather = newWeather;
    if (immediate) {
      this.currentWeather = newWeather;
      this.transitionAlpha = 1.0;
      const info = WEATHER_CONDITIONS[newWeather];
      this.currentGripMultiplier = info.gripMultiplier;
      this.currentBrakingMultiplier = info.brakingMultiplier;
      this.currentFogDensity = info.fogDensity;
      this.currentSunIntensity = info.sunIntensity;
    } else {
      this.transitionAlpha = 0.0;
    }

    this.weatherCycleTimer = 0;
    const targetInfo = WEATHER_CONDITIONS[newWeather];
    this.onWeatherChanged?.(newWeather, targetInfo);
  }

  public cycleNextWeather(): WeatherType {
    const list: WeatherType[] = ['sunny', 'rain', 'storm', 'fog'];
    const nextIdx = (list.indexOf(this.targetWeather) + 1) % list.length;
    const next = list[nextIdx];
    this.setWeather(next, false);
    return next;
  }

  public cycleWeather(): WeatherType {
    return this.cycleNextWeather();
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    roadMaterial?: THREE.MeshStandardMaterial | null
  ): boolean {
    if (roadMaterial && !this.roadMaterials.includes(roadMaterial)) {
      this.registerRoadMaterial(roadMaterial);
    }

    // 1. Auto cycle weather timer
    if (this.autoCycleEnabled) {
      this.weatherCycleTimer += dt;
      if (this.weatherCycleTimer >= this.weatherCycleInterval) {
        this.weatherCycleTimer = 0;
        this.cycleNextWeather();
      }
    }

    // 2. Smooth weather transition interpolation
    if (this.transitionAlpha < 1.0) {
      this.transitionAlpha += dt / this.transitionDuration;
      if (this.transitionAlpha >= 1.0) {
        this.transitionAlpha = 1.0;
        this.currentWeather = this.targetWeather;
      }

      const fromInfo = WEATHER_CONDITIONS[this.currentWeather];
      const toInfo = WEATHER_CONDITIONS[this.targetWeather];
      const t = THREE.MathUtils.smoothstep(this.transitionAlpha, 0, 1);

      this.currentGripMultiplier = THREE.MathUtils.lerp(fromInfo.gripMultiplier, toInfo.gripMultiplier, t);
      this.currentBrakingMultiplier = THREE.MathUtils.lerp(fromInfo.brakingMultiplier, toInfo.brakingMultiplier, t);
      this.currentFogDensity = THREE.MathUtils.lerp(fromInfo.fogDensity, toInfo.fogDensity, t);
      this.currentSunIntensity = THREE.MathUtils.lerp(fromInfo.sunIntensity, toInfo.sunIntensity, t);

      const targetRoughness = THREE.MathUtils.lerp(fromInfo.roadRoughness, toInfo.roadRoughness, t);
      const targetMetalness = THREE.MathUtils.lerp(fromInfo.roadMetalness, toInfo.roadMetalness, t);
      for (let i = 0; i < this.roadMaterials.length; i++) {
        this.roadMaterials[i].roughness = targetRoughness;
        this.roadMaterials[i].metalness = targetMetalness;
      }
    } else {
      const info = WEATHER_CONDITIONS[this.currentWeather];
      this.currentGripMultiplier = info.gripMultiplier;
      this.currentBrakingMultiplier = info.brakingMultiplier;
      this.currentFogDensity = info.fogDensity;
      this.currentSunIntensity = info.sunIntensity;
    }

    // 3. Lightning Flash generator in Storm
    if (this.currentWeather === 'storm' || this.targetWeather === 'storm') {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.isLightningActive = true;
        this.lightningFlashDuration = 0.14 + Math.random() * 0.12;
        this.lightningTimer = 8.0 + Math.random() * 14.0; // Next strike in 8-22s
        this.onLightningFlash?.(1.0);
        sound.playThunderRumble();
      }

      if (this.isLightningActive) {
        this.lightningFlashDuration -= dt;
        if (this.lightningFlashDuration <= 0) {
          this.isLightningActive = false;
          this.onLightningFlash?.(0.0);
        }
      }
    } else {
      this.isLightningActive = false;
    }

    // 4. Update Fog & Sun Light
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = this.currentFogDensity;
    }
    if (this.sunLight) {
      if (this.isLightningActive) {
        this.sunLight.intensity = 8.5; // Blinding lightning flash
      } else {
        this.sunLight.intensity = this.currentSunIntensity;
      }
    }

    // 5. Rain Particle Simulation
    const isRaining = this.currentWeather === 'rain' || this.currentWeather === 'storm' ||
      (this.targetWeather === 'rain' || this.targetWeather === 'storm');

    if (this.rainMesh) {
      this.rainMesh.visible = isRaining;
      if (isRaining && this.rainPositions) {
        const fallSpeed = this.currentWeather === 'storm' ? 65 : 42;
        const count = this.rainPositions.length / 3;
        for (let i = 0; i < count; i++) {
          const py = i * 3 + 1;
          this.rainPositions[py] -= fallSpeed * dt;
          if (this.rainPositions[py] < 0) {
            this.rainPositions[py] = 45 + Math.random() * 12;
            this.rainPositions[i * 3] = playerPos.x + (Math.random() - 0.5) * 190;
            this.rainPositions[i * 3 + 2] = playerPos.z + (Math.random() - 0.5) * 190;
          }
        }
        this.rainMesh.geometry.attributes.position.needsUpdate = true;
      }
    }

    return this.isLightningActive;
  }

  public getCurrentInfo(): WeatherConditionInfo {
    return WEATHER_CONDITIONS[this.currentWeather];
  }

  public dispose() {
    if (this.rainMesh) {
      this.scene.remove(this.rainMesh);
      this.rainMesh.geometry.dispose();
      (this.rainMesh.material as THREE.Material).dispose();
      this.rainMesh = null;
    }
    this.roadMaterials = [];
  }
}
