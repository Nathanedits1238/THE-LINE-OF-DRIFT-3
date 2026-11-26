import * as THREE from 'three';
import { sound } from '../audio/SoundEffects';
import { CityNPCSystem } from '../city/CityNPCs';
import { CullingManager } from '../graphics/CullingManager';
import { DestructiblePropSystem } from '../props/DestructibleProps';
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

export interface DayNightClockInfo {
  phase: TimeOfDay;
  label: string;
  icon: string;
  clockText: string;
  sunElevation: number;
  isNight: boolean;
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
  private currentWeatherSunFactor: number = 0.65;
  public currentStreetLightLevel: number = 1.0;

  // Lightning dynamics during storm
  public isLightningActive: boolean = false;
  private lightningTimer: number = 6.0;
  private lightningFlashDuration: number = 0;

  // Rain Particles
  private rainMesh: THREE.Points | null = null;
  private rainPositions: Float32Array | null = null;
  private rainCount: number = 1200;

  // Scene references & Day-Night Cycle
  public sunLight: THREE.DirectionalLight | null = null;
  public hemiLight: THREE.HemisphereLight | null = null;
  public streetLights: THREE.PointLight[] = [];
  public lampBulbMaterials: THREE.MeshBasicMaterial[] = [];
  public culling: CullingManager | null = null;
  public npcsSystem: CityNPCSystem | null = null;
  public destructibleProps: DestructiblePropSystem | null = null;
  public roadMaterials: THREE.MeshStandardMaterial[] = [];

  // 0.0 = 00:00 Midnight, 0.25 = 06:00 Dawn, 0.50 = 12:00 Noon, 0.75 = 18:00 Sunset
  public dayNightProgress: number = 0.85;
  public dayCycleDuration: number = 180; // 3 minutes per full 24h cycle
  public dayNightCycleEnabled: boolean = true;

  // Zero-GC color interpolation helpers
  private static readonly _cNightSky = new THREE.Color(0x060a14);
  private static readonly _cDawnSky = new THREE.Color(0xd96b43);
  private static readonly _cDaySky = new THREE.Color(0x90b9e2);
  private static readonly _cSunsetSky = new THREE.Color(0xc85432);
  private static readonly _cSunNight = new THREE.Color(0x284070);
  private static readonly _cSunWarm = new THREE.Color(0xff7f42);
  private static readonly _cSunDay = new THREE.Color(0xfff8eb);
  private static readonly _cHemiNightSky = new THREE.Color(0x111a2e);
  private static readonly _cHemiWarmSky = new THREE.Color(0xd47148);
  private static readonly _cHemiDaySky = new THREE.Color(0x95c8f8);
  private static readonly _cHemiNightGnd = new THREE.Color(0x070a10);
  private static readonly _cHemiDayGnd = new THREE.Color(0x3a4959);
  private static readonly _cWeatherTint = new THREE.Color();
  private static readonly _cWorkSky = new THREE.Color();
  private static readonly _cWorkSun = new THREE.Color();
  private static readonly _cWorkHemiSky = new THREE.Color();
  private static readonly _cWorkHemiGnd = new THREE.Color();
  private static readonly _cBulbOff = new THREE.Color(0x3c434d);
  private static readonly _cBulbOn = new THREE.Color(0xfff0bb);
  private static readonly _cBulbWork = new THREE.Color();

  // Callbacks
  public onWeatherChanged?: (weather: WeatherType, info: WeatherConditionInfo) => void;
  public onLightningFlash?: (intensity: number) => void;

  constructor(scene: THREE.Scene, initialWeather: WeatherType = 'rain', initialTime: TimeOfDay = 'night') {
    this.scene = scene;
    const safeWeather: WeatherType = WEATHER_CONDITIONS[initialWeather] ? initialWeather : 'rain';
    this.currentWeather = safeWeather;
    this.targetWeather = safeWeather;
    this.setTimeOfDay(initialTime);

    const info = WEATHER_CONDITIONS[safeWeather] || WEATHER_CONDITIONS.rain;
    this.currentGripMultiplier = info.gripMultiplier;
    this.currentBrakingMultiplier = info.brakingMultiplier;
    this.currentFogDensity = info.fogDensity;
    this.currentWeatherSunFactor = info.sunIntensity / 2.6;
    this.currentSunIntensity = info.sunIntensity;

    this.setupRainParticles();
  }

  public setTimeOfDay(timeOfDay: TimeOfDay) {
    this.timeOfDay = timeOfDay;
    switch (timeOfDay) {
      case 'midnight':
        this.dayNightProgress = 0.0;
        break;
      case 'night':
        this.dayNightProgress = 0.86;
        break;
      case 'sunset':
        this.dayNightProgress = 0.74;
        break;
      case 'day':
        this.dayNightProgress = 0.5;
        break;
    }
  }

  public getClockInfo(): DayNightClockInfo {
    const p = ((this.dayNightProgress % 1) + 1) % 1;
    const totalMinutes = Math.floor(p * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const mins = totalMinutes % 60;
    const clockText = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;

    const sunAngle = p * Math.PI * 2 - Math.PI / 2;
    const sunY = Math.sin(sunAngle);

    let phase: TimeOfDay = 'day';
    let label = 'DIA';
    let icon = '☀️';

    if (hours >= 5 && hours < 8) {
      phase = 'sunset';
      label = 'AMANHECER';
      icon = '🌅';
    } else if (hours >= 8 && hours < 17) {
      phase = 'day';
      label = 'DIA';
      icon = '☀️';
    } else if (hours >= 17 && hours < 20) {
      phase = 'sunset';
      label = 'ENTARDECER';
      icon = '🌇';
    } else if (hours >= 20 && hours < 23) {
      phase = 'night';
      label = 'NOITE';
      icon = '🌙';
    } else {
      phase = 'midnight';
      label = 'MADRUGADA';
      icon = '🌌';
    }

    return {
      phase,
      label,
      icon,
      clockText,
      sunElevation: sunY,
      isNight: sunY < 0.12,
    };
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
    const safeWeather = WEATHER_CONDITIONS[newWeather] ? newWeather : 'rain';
    if (this.targetWeather === safeWeather && !immediate) return;

    this.targetWeather = safeWeather;
    if (immediate) {
      this.currentWeather = safeWeather;
      this.transitionAlpha = 1.0;
      const info = WEATHER_CONDITIONS[safeWeather] || WEATHER_CONDITIONS['rain'];
      this.currentGripMultiplier = info.gripMultiplier;
      this.currentBrakingMultiplier = info.brakingMultiplier;
      this.currentFogDensity = info.fogDensity;
      this.currentWeatherSunFactor = info.sunIntensity / 2.6;
    } else {
      this.transitionAlpha = 0.0;
    }

    this.weatherCycleTimer = 0;
    const targetInfo = WEATHER_CONDITIONS[safeWeather] || WEATHER_CONDITIONS['rain'];
    this.onWeatherChanged?.(safeWeather, targetInfo);
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

    // 2. Smooth weather transition interpolation (does NOT clobber day-night intensity)
    if (this.transitionAlpha < 1.0) {
      this.transitionAlpha += dt / this.transitionDuration;
      if (this.transitionAlpha >= 1.0) {
        this.transitionAlpha = 1.0;
        this.currentWeather = this.targetWeather;
      }

      const fromInfo = WEATHER_CONDITIONS[this.currentWeather] || WEATHER_CONDITIONS['rain'];
      const toInfo = WEATHER_CONDITIONS[this.targetWeather] || WEATHER_CONDITIONS['rain'];
      const t = THREE.MathUtils.smoothstep(this.transitionAlpha, 0, 1);

      this.currentGripMultiplier = THREE.MathUtils.lerp(fromInfo.gripMultiplier, toInfo.gripMultiplier, t);
      this.currentBrakingMultiplier = THREE.MathUtils.lerp(fromInfo.brakingMultiplier, toInfo.brakingMultiplier, t);
      this.currentFogDensity = THREE.MathUtils.lerp(fromInfo.fogDensity, toInfo.fogDensity, t);
      this.currentWeatherSunFactor = THREE.MathUtils.lerp(fromInfo.sunIntensity / 2.6, toInfo.sunIntensity / 2.6, t);

      const targetRoughness = THREE.MathUtils.lerp(fromInfo.roadRoughness, toInfo.roadRoughness, t);
      const targetMetalness = THREE.MathUtils.lerp(fromInfo.roadMetalness, toInfo.roadMetalness, t);
      for (let i = 0; i < this.roadMaterials.length; i++) {
        this.roadMaterials[i].roughness = targetRoughness;
        this.roadMaterials[i].metalness = targetMetalness;
      }
    } else {
      const info = WEATHER_CONDITIONS[this.currentWeather] || WEATHER_CONDITIONS['rain'];
      this.currentGripMultiplier = info.gripMultiplier;
      this.currentBrakingMultiplier = info.brakingMultiplier;
      this.currentFogDensity = info.fogDensity;
      this.currentWeatherSunFactor = info.sunIntensity / 2.6;
    }

    // 3. Real-time Day-Night Cycle (lighting intensities, sky/fog blend, street lights, NPC density)
    if (this.dayNightCycleEnabled) {
      this.dayNightProgress += dt / this.dayCycleDuration;
      if (this.dayNightProgress >= 1.0) this.dayNightProgress %= 1.0;
    }

    const p = this.dayNightProgress;
    const sunAngle = p * Math.PI * 2 - Math.PI / 2;
    const sunY = Math.sin(sunAngle); // -1 midnight, 0 dawn/sunset, +1 noon
    const sunX = Math.cos(sunAngle);

    // Day factor (0 at night, 1 at bright day) and golden twilight factor (peaks near sunY == 0)
    const dayFactor = THREE.MathUtils.smoothstep(sunY, -0.18, 0.38);
    const twilightFactor = Math.max(0, 1 - Math.abs(sunY) / 0.34);
    const isSunsetHalf = p > 0.5;

    // Update sky, sun, and hemisphere light colors smoothly without allocations
    const skyWarmTarget = isSunsetHalf
      ? DynamicWeatherSystem._cSunsetSky
      : DynamicWeatherSystem._cDawnSky;

    DynamicWeatherSystem._cWorkSky.copy(DynamicWeatherSystem._cNightSky).lerp(
      DynamicWeatherSystem._cDaySky,
      dayFactor
    );
    DynamicWeatherSystem._cWorkSky.lerp(skyWarmTarget, twilightFactor * 0.65);

    // Blend sky color slightly toward storm/rain/fog mood
    const weatherOverlayStrength =
      this.currentWeather === 'storm'
        ? 0.78
        : this.currentWeather === 'rain'
          ? 0.45
          : this.currentWeather === 'fog'
            ? 0.4
            : 0.0;
    if (weatherOverlayStrength > 0) {
      const wInfo = WEATHER_CONDITIONS[this.currentWeather];
      DynamicWeatherSystem._cWeatherTint.setHex(wInfo.fogColor);
      DynamicWeatherSystem._cWorkSky.lerp(DynamicWeatherSystem._cWeatherTint, weatherOverlayStrength);
    }

    DynamicWeatherSystem._cWorkSun.copy(DynamicWeatherSystem._cSunNight).lerp(
      DynamicWeatherSystem._cSunDay,
      dayFactor
    );
    DynamicWeatherSystem._cWorkSun.lerp(DynamicWeatherSystem._cSunWarm, twilightFactor * 0.8);

    DynamicWeatherSystem._cWorkHemiSky.copy(DynamicWeatherSystem._cHemiNightSky).lerp(
      DynamicWeatherSystem._cHemiDaySky,
      dayFactor
    );
    DynamicWeatherSystem._cWorkHemiSky.lerp(DynamicWeatherSystem._cHemiWarmSky, twilightFactor * 0.55);

    DynamicWeatherSystem._cWorkHemiGnd.copy(DynamicWeatherSystem._cHemiNightGnd).lerp(
      DynamicWeatherSystem._cHemiDayGnd,
      dayFactor
    );

    // Directional Sun / Moon light orbit & gradual intensity
    const baseSunIntensity = THREE.MathUtils.lerp(0.32, 2.65, dayFactor) + twilightFactor * 0.45;
    this.currentSunIntensity = baseSunIntensity * this.currentWeatherSunFactor;

    if (this.sunLight) {
      // Keep moon elevated slightly at night so subtle night shadows/rims remain clean
      const lightHeight = sunY >= 0 ? Math.max(25, sunY * 190) : Math.max(40, -sunY * 140);
      const lightHoriz = sunY >= 0 ? sunX * 190 : -sunX * 140;
      this.sunLight.position.set(lightHoriz, lightHeight, 60);
      this.sunLight.color.copy(DynamicWeatherSystem._cWorkSun);
    }

    if (this.hemiLight) {
      this.hemiLight.color.copy(DynamicWeatherSystem._cWorkHemiSky);
      this.hemiLight.groundColor.copy(DynamicWeatherSystem._cWorkHemiGnd);
      this.hemiLight.intensity = THREE.MathUtils.lerp(0.45, 1.75, dayFactor) *
        (this.currentWeather === 'storm' ? 0.65 : this.currentWeather === 'rain' ? 0.82 : 1.0);
    }

    // Apply gradual sky background & fog updates
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(DynamicWeatherSystem._cWorkSky);
    } else {
      this.scene.background = DynamicWeatherSystem._cWorkSky.clone();
    }

    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(DynamicWeatherSystem._cWorkSky);
      const nightFogBoost = (1 - dayFactor) * 0.0014;
      this.scene.fog.density = this.currentFogDensity + nightFogBoost;
    }

    // Street Lights activation at dusk/night or heavy storm
    const duskGlow = THREE.MathUtils.smoothstep(-sunY, -0.15, 0.16);
    const targetStreetLightLevel =
      this.currentWeather === 'storm' ? Math.max(0.85, duskGlow) : duskGlow;
    this.currentStreetLightLevel = THREE.MathUtils.damp(
      this.currentStreetLightLevel,
      targetStreetLightLevel,
      3.5,
      dt
    );

    const lightScale = this.currentStreetLightLevel * 1.85;
    if (this.culling) {
      this.culling.setStreetLightScale(lightScale);
    } else {
      for (let i = 0; i < this.streetLights.length; i++) {
        this.streetLights[i].intensity = lightScale;
      }
    }
    this.destructibleProps?.setStreetLightScale(lightScale);

    // Shift street light bulb emissive/basic color between off (day) and glowing warm white (night)
    DynamicWeatherSystem._cBulbWork.copy(DynamicWeatherSystem._cBulbOff).lerp(
      DynamicWeatherSystem._cBulbOn,
      this.currentStreetLightLevel
    );
    for (let i = 0; i < this.lampBulbMaterials.length; i++) {
      this.lampBulbMaterials[i].color.copy(DynamicWeatherSystem._cBulbWork);
    }

    // Adjust NPC spawn density dynamically based on time of day & weather
    if (this.npcsSystem) {
      let targetDensity = THREE.MathUtils.lerp(0.36, 1.0, dayFactor);
      if (this.currentWeather === 'storm') {
        targetDensity *= 0.62;
      } else if (this.currentWeather === 'rain') {
        targetDensity *= 0.78;
      }
      this.npcsSystem.densityMultiplier = THREE.MathUtils.damp(
        this.npcsSystem.densityMultiplier,
        THREE.MathUtils.clamp(targetDensity, 0.22, 1.0),
        1.8,
        dt
      );
    }

    // 4. Lightning Flash generator in Storm
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

    // 5. Final Sun Light intensity (with lightning flash override)
    if (this.sunLight) {
      if (this.isLightningActive) {
        this.sunLight.intensity = 8.5; // Blinding lightning flash
      } else {
        this.sunLight.intensity = this.currentSunIntensity;
      }
    }

    // 6. Rain Particle Simulation
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
    this.streetLights = [];
    this.lampBulbMaterials = [];
  }
}
