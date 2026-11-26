import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as xb from 'xrblocks';
import { sound } from './audio/SoundEffects';
import { OpenWorldHudState, OpenWorldManager } from './career/OpenWorldManager';
import { CityGenerator } from './city/CityGenerator';
import { CityNPCSystem } from './city/CityNPCs';
import { CityTrafficSystem } from './city/CityTraffic';
import { DEFAULT_CHALLENGES, DEFAULT_PROFILE, DEFAULT_TRACKS, DEFAULT_VEHICLES } from './data/GameData';
import { CullingManager } from './graphics/CullingManager';
import { DeviceBenchmark, DeviceSpecs } from './graphics/DeviceBenchmark';
import { MultiplayerRoomManager } from './multiplayer/MultiplayerRoom';
import { VehiclePhysics } from './physics/VehiclePhysics';
import { PolicePursuitSystem } from './police/PoliceAI';
import { ReplayReturnSource, ReplaySystem } from './replay/ReplaySystem';
import { networkStatus } from './services/networkStatus';
import { FilmCutsceneDirector } from './story/FilmCutsceneDirector';
import { getCareerFilmCutscenes, getCareerOpenWorldIntro } from './story/StoryData';
import { GameUI } from './ui/GameUI';
import {
  CharacterProfile,
  DialogueLine,
  GameDifficulty,
  GameMode,
  GraphicsQuality,
  MultiplayerPlayer,
  OpenWorldTransportMode,
  ReplayCameraAngle,
  StoryChapter,
  TimeOfDay,
  TrackConfig,
  VehicleConfig,
  WeatherType,
} from './types';
import { OPEN_WORLD_TRANSPORTS, OpenWorldTraversalRig } from './vehicles/OpenWorldTransport';
import { VehicleMeshBuilder } from './vehicles/VehicleMesh';
import { DynamicWeatherSystem } from './weather/DynamicWeatherSystem';

export class OutlawGameScene extends xb.Script {
  // Core Scene Components
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  public renderer!: THREE.WebGLRenderer;

  // Subsystems & Optimization
  public culling: CullingManager = new CullingManager();
  public city!: CityGenerator;
  public weatherSystem!: DynamicWeatherSystem;
  public npcs!: CityNPCSystem;
  public traffic!: CityTrafficSystem;
  public police!: PolicePursuitSystem;
  public openWorld!: OpenWorldManager;
  public replay!: ReplaySystem;
  public transportRig!: OpenWorldTraversalRig;
  public filmDirector: FilmCutsceneDirector = new FilmCutsceneDirector();
  public mpManager: MultiplayerRoomManager = new MultiplayerRoomManager();
  public ui!: GameUI;
  public deviceSpecs!: DeviceSpecs;

  // Player Vehicle
  public playerPhysics!: VehiclePhysics;
  public playerVehicleMeshGroup: THREE.Group | null = null;
  public playerWheels: THREE.Group[] = [];
  public playerNeon: THREE.Mesh | null = null;
  public playerDamageDeform?: (damageRatio: number) => void;
  public playerImpactDeform?: (localHitDir: THREE.Vector3, impactSpeedMs: number) => void;
  public playerUpdateDamageEffects?: (
    dt: number,
    speedKmh: number,
    missingWheels?: [boolean, boolean, boolean, boolean]
  ) => void;
  public playerResetDeform?: () => void;
  public playerUpdateOccupants?: (
    dt: number,
    steerAngle: number,
    driftSlip: number,
    speedKmh: number,
    speakingRole?: 'pilot' | 'copilot' | null,
    cutTime?: number
  ) => void;
  public playerSetCabinLight?: (intensity: number) => void;
  public activeVehicleConfig: VehicleConfig = DEFAULT_VEHICLES[0];
  public activeTrackConfig: TrackConfig = DEFAULT_TRACKS[0];

  // Detached Loose Wheels Visuals
  private detachedWheels: Array<{
    mesh: THREE.Group;
    vel: THREE.Vector3;
    rotVel: THREE.Vector3;
    life: number;
  }> = [];
  private wheelLossCooldown: number = 0;

  // Real Online Multiplayer Remote Opponent 3D Cars
  private remotePlayers: Map<
    string,
    {
      group: THREE.Group;
      targetPos: THREE.Vector3;
      targetHeading: number;
      carId: string;
      carColor: string;
    }
  > = new Map();

  // Game Profile & State
  public profile: CharacterProfile = { ...DEFAULT_PROFILE };
  public currentMode: GameMode = 'title';
  public currentStoryChapter?: StoryChapter;
  public storyTimeElapsed: number = 0;
  public challengeTimer: number = 0;
  public freeRoamViolationsCount: number = 0;

  // Camera Chase Variables
  public cameraMode: 'chase' | 'hood' | 'orbit' = 'orbit';
  public cameraOffset: THREE.Vector3 = new THREE.Vector3(0, 3.2, -6.8);
  public cameraLookTarget: THREE.Vector3 = new THREE.Vector3();
  public currentCameraPos: THREE.Vector3 = new THREE.Vector3(0, 6, -10);

  // Time & Loop
  private clock: THREE.Clock = new THREE.Clock();
  private orbitAngle: number = 0;
  private isVerticalMode: boolean = false;

  // Achievement Tracking State (Zero-GC)
  private lastPlayerPos: THREE.Vector3 = new THREE.Vector3();
  private activeDriftTime: number = 0;
  private activeDriftPoints: number = 0;
  private activeDriftDamaged: boolean = false;

  private isEndingOutroCutscene: boolean = false;
  private isOpenWorldBustedPaused: boolean = false;
  private lastVehicleMode: OpenWorldTransportMode = 'car';
  private lastTransportUiKey: string = '';
  private stuntToastCooldown: number = 0;
  private readonly _owPaySprayMarkers: Array<{ x: number; z: number }> = [];
  private readonly _owStashMarkers: Array<{ x: number; z: number }> = [];
  private lastStartParams: { mode: GameMode; chapter?: StoryChapter; trackId?: string } | null = null;
  private replaySavedState: {
    playerPos: THREE.Vector3;
    playerHeading: number;
    playerPitch: number;
    playerRoll: number;
    missingWheels: [boolean, boolean, boolean, boolean];
    cameraMode: 'chase' | 'hood' | 'orbit';
    hiddenObjects: THREE.Object3D[];
  } | null = null;

  // Zero-GC Preallocated Math Helpers
  private static readonly _zeroVel = new THREE.Vector3();
  private static readonly _relVel = new THREE.Vector3();
  private static readonly _hitNormal = new THREE.Vector3();
  private static readonly _localHitDir = new THREE.Vector3();
  private static readonly _copLocalHitDir = new THREE.Vector3();
  private static readonly _wheelWorldPos = new THREE.Vector3();
  private static readonly _targetCamPos = new THREE.Vector3();
  private static readonly _targetLook = new THREE.Vector3();

  init() {
    this.scene = xb.core.scene;
    this.camera = xb.core.camera;
    this.renderer = xb.core.renderer as THREE.WebGLRenderer;

    // Handle Page Visibility to prevent background battery drain & delta spikes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        sound.stopAll();
      } else {
        this.clock.getDelta(); // flush accumulated pause time
      }
    });

    // 1. Hardware Detection & Device Benchmark
    this.deviceSpecs = DeviceBenchmark.detectOptimalSettings();
    const initialQuality = this.deviceSpecs.recommendedQuality;
    this.culling.setQuality(initialQuality);

    // Renderer & Color Pipeline Standards
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(
      this.deviceSpecs.isSoftwareGl || initialQuality === 'low'
        ? 1
        : Math.min(window.devicePixelRatio, initialQuality === 'ultra' ? 2 : 1.5)
    );
    this.renderer.shadowMap.enabled = initialQuality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Studio Environment Reflections
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 2. Initialize City Generator with Occlusion & Frustum Culling
    this.city = new CityGenerator(this.scene, this.culling);
    this.npcs = new CityNPCSystem(this.scene);
    this.traffic = new CityTrafficSystem(this.scene);
    this.police = new PolicePursuitSystem(this.scene);
    this.police.setDifficulty(this.profile.difficulty || 'very_easy');
    this.openWorld = new OpenWorldManager(this.scene);
    this.replay = new ReplaySystem(this.scene);
    this.transportRig = new OpenWorldTraversalRig(this.scene);
    this.weatherSystem = new DynamicWeatherSystem(this.scene);

    // Initial Track & Atmosphere Setup
    this.city.generateTrack(this.activeTrackConfig, initialQuality);
    this.city.applyAtmosphere('night', 'rain', initialQuality);
    this.repopulateNPCs(this.activeTrackConfig.id);
    this.repopulateTraffic(this.activeTrackConfig.id);

    // Spawn Player Vehicle
    this.setupPlayerVehicle(this.activeVehicleConfig);
    this.lastPlayerPos.copy(this.playerPhysics.position);

    // Initialize UI with Device Specs (may restore previous durable online save into this.profile & DEFAULT_VEHICLES)
    this.ui = new GameUI(this.profile, this.mpManager);
    this.ui.deviceSpecs = this.deviceSpecs;
    this.ui.quality = initialQuality;
    this.weatherSystem.setWeather(this.ui.weather);
    this.isVerticalMode = this.ui.isEffectiveVertical();

    this.police.setDifficulty(this.profile.difficulty || 'very_easy');
    const equippedAfterLoad =
      DEFAULT_VEHICLES.find((v) => v.id === this.profile.selectedCarId) || DEFAULT_VEHICLES[0];
    if (equippedAfterLoad.id !== this.activeVehicleConfig.id) {
      this.setupPlayerVehicle(equippedAfterLoad);
    }

    this.ui.renderEntryScreen();
    this.bindUICallbacks();
  }

  private repopulateNPCs(trackId: string) {
    this.npcs.populateForTrack(
      trackId,
      this.city.waypoints,
      this.city.roadHalfWidth,
      this.city.colliders,
      this.city.bridges,
      this.city.tunnels
    );
  }

  private repopulateTraffic(trackId: string) {
    this.traffic.populateForTrack(
      trackId,
      this.city.waypoints,
      this.city.roadHalfWidth,
      (pos, y) => this.city.getRoadElevation(pos, y)
    );
  }

  private async playFilmCutscene(lines: DialogueLine[], badge: string) {
    if (!lines || lines.length === 0) return;
    this.filmDirector.start(lines, this.playerPhysics.position, this.playerPhysics.heading);
    try {
      await this.ui.triggerDialogue(lines, {
        isFilmScene: true,
        filmBadge: badge,
        onLineChange: (_line, idx) => this.filmDirector.setLineIndex(idx),
      });
    } finally {
      this.filmDirector.stop();
      this.playerSetCabinLight?.(0);
    }
  }

  private resetDriftSession() {
    this.activeDriftTime = 0;
    this.activeDriftPoints = 0;
    this.activeDriftDamaged = false;
  }

  private setupPlayerVehicle(config: VehicleConfig) {
    if (this.playerVehicleMeshGroup) {
      this.scene.remove(this.playerVehicleMeshGroup);
    }

    this.activeVehicleConfig = config;
    const meshData = VehicleMeshBuilder.createVehicleGroup(config, false);
    this.playerVehicleMeshGroup = meshData.group;
    this.playerWheels = meshData.wheels;
    this.playerNeon = meshData.neonMesh;
    this.playerDamageDeform = meshData.applyDamageDeformation;
    this.playerImpactDeform = meshData.applyImpactDeformation;
    this.playerUpdateDamageEffects = meshData.updateDamageEffects;
    this.playerResetDeform = meshData.resetDeformation;
    this.playerUpdateOccupants = meshData.updateOccupants;
    this.playerSetCabinLight = meshData.setCabinLightIntensity;
    this.scene.add(this.playerVehicleMeshGroup);

    const startPos = this.city.waypoints[0]?.position.clone() || new THREE.Vector3(0, 0, 0);
    const startHeading = this.city.waypoints[0]?.heading || 0;

    if (!this.playerPhysics) {
      this.playerPhysics = new VehiclePhysics(config, startPos);
    } else {
      this.playerPhysics.config = config;
      this.playerPhysics.applyUpgrades();
      this.playerPhysics.reset(startPos, startHeading);
    }

    this.playerVehicleMeshGroup.position.copy(startPos);
    this.playerVehicleMeshGroup.rotation.y = startHeading;
  }

  private bindUICallbacks() {
    // Mode Selected
    this.ui.onStartMode = (mode: GameMode, chapter?: StoryChapter, trackId?: string) => {
      if (this.replay.active) {
        this.replay.stopPlayback();
        this.ui.removeReplayHUD();
      }
      this.lastStartParams = { mode, chapter, trackId };
      this.replay.clearRecording();
      this.isEndingOutroCutscene = false;
      this.isOpenWorldBustedPaused = false;
      this.filmDirector.stop();
      this.playerSetCabinLight?.(0);

      this.currentMode = mode;
      this.currentStoryChapter = chapter;
      this.storyTimeElapsed = 0;
      if (chapter?.dialogueMidList) {
        chapter.dialogueMidList.forEach((m) => (m.triggered = false));
      }
      this.cameraMode = 'chase';
      this.challengeTimer = 0;
      this.freeRoamViolationsCount = 0;

      // Select track
      const track = DEFAULT_TRACKS.find((t) => t.id === trackId) || DEFAULT_TRACKS[0];
      this.activeTrackConfig = track;
      this.city.generateTrack(track, this.ui.quality);
      this.city.applyAtmosphere(this.ui.timeOfDay, this.ui.weather, this.ui.quality);
      this.weatherSystem.setWeather(this.ui.weather);
      this.repopulateNPCs(track.id);
      this.repopulateTraffic(track.id);

      // Reset Player & Transport Mode
      const startWp = this.city.waypoints[0] || { position: new THREE.Vector3(0, 0, 0), heading: 0 };
      this.switchOpenWorldTransport('car', true);
      this.transportRig.clearParkedCarMarker();
      this.lastVehicleMode = 'car';
      this.lastTransportUiKey = '';
      this.playerPhysics.reset(startWp.position, startWp.heading);
      this.restorePlayerVehicleFull();
      if (this.playerVehicleMeshGroup) {
        this.playerVehicleMeshGroup.position.copy(startWp.position);
        this.playerVehicleMeshGroup.rotation.set(0, startWp.heading, 0);
        this.playerVehicleMeshGroup.visible = true;
      }
      this.lastPlayerPos.copy(startWp.position);
      this.resetDriftSession();
      this.clearRemotePlayers();

      // Mode-specific police & open world configuration
      if (mode === 'career_open_world') {
        this.openWorld.populateForTrack(
          track.id,
          this.city.waypoints,
          this.city.colliders,
          (pos, y) => this.city.getRoadElevation(pos, y)
        );
        this.spawnOpenWorldStreetMotos();
        this.ui.updateOpenWorldTransportUI('car', null);
        this.police.setHeat(0, startWp.position, this.city.waypoints);
        void this.playFilmCutscene(
          getCareerOpenWorldIntro(
            this.profile.name,
            this.profile.nickname,
            this.profile.copilotName || 'Nina "Apex"',
            track.name
          ),
          `CARREIRA MUNDO ABERTO · ${track.name.toUpperCase()}`
        );
      } else {
        this.openWorld.clear();
        this.transportRig.clearStreetMotorcycles();
        if (mode === 'story' && chapter) {
          this.police.setHeat(chapter.initialHeat, startWp.position, this.city.waypoints);
          void this.playFilmCutscene(chapter.dialogueIntro, `HISTÓRIA · CAPÍTULO ${chapter.id}`);
        } else if (mode === 'career') {
          this.police.setHeat(1, startWp.position, this.city.waypoints);
          const careerScenes = getCareerFilmCutscenes(
            this.profile.name,
            this.profile.nickname,
            this.profile.copilotName || 'Nina "Apex"',
            track.name,
            this.profile.careerWins
          );
          void this.playFilmCutscene(careerScenes.intro, `CARREIRA · ${track.name.toUpperCase()}`);
        } else if (mode === 'challenge') {
          this.police.setHeat(4, startWp.position, this.city.waypoints);
        } else if (mode === 'tutorial') {
          this.police.clearAll();
        } else if (mode === 'free_roam') {
          this.police.setHeat(0, startWp.position, this.city.waypoints);
        } else if (mode === 'multiplayer') {
          this.police.setHeat(2, startWp.position, this.city.waypoints);
        } else {
          this.police.setHeat(1, startWp.position, this.city.waypoints);
        }
      }

      sound.ensureRunning();
      sound.playCountdownBeep(true);
    };

    // Open World Multi-Transport Selector (Motos, Car, Bicycle, Skate, On Foot)
    this.ui.onSelectOpenWorldTransport = (mode) => {
      if (
        this.currentMode !== 'career_open_world' ||
        this.isOpenWorldBustedPaused ||
        this.ui.isPaused ||
        this.filmDirector.active
      ) {
        return;
      }
      this.switchOpenWorldTransport(mode, false);
    };

    this.ui.onToggleEnterExitVehicle = () => {
      this.handleToggleEnterExitVehicle();
    };

    this.ui.onCycleWeather = () => {
      const next = this.weatherSystem.cycleWeather();
      this.ui.weather = next;
      this.city.applyAtmosphere(this.ui.timeOfDay, next, this.ui.quality);
      this.ui.showToast(`🌤️ Clima alterado para: ${next.toUpperCase()}`);
    };

    this.ui.onInteractLocation = () => {
      this.handleLocationInteraction();
    };

    // Smartphone System Callbacks (Fast travel, weather change, tow summon)
    this.ui.onSmartphoneFastTravel = (coords) => {
      const targetPos = new THREE.Vector3(coords.x, coords.y || 0, coords.z);
      const heading = coords.heading ?? this.playerPhysics.heading;
      this.switchOpenWorldTransport('car', true);
      this.transportRig.clearParkedCarMarker();
      this.playerPhysics.reset(targetPos, heading);
      if (this.playerVehicleMeshGroup) {
        this.playerVehicleMeshGroup.position.copy(targetPos);
        this.playerVehicleMeshGroup.rotation.set(0, heading, 0);
        this.playerVehicleMeshGroup.visible = true;
      }
      this.lastPlayerPos.copy(targetPos);
      sound.playSuccessFanfare();
    };

    this.ui.onSmartphoneSetWeather = (w) => {
      this.weatherSystem.setWeather(w);
      this.ui.weather = w;
      this.city.applyAtmosphere(this.ui.timeOfDay, w, this.ui.quality);
      this.ui.showToast(`🌤️ Clima alterado para: ${w.toUpperCase()}`);
    };

    this.ui.onSmartphoneSpawnCar = () => {
      const spawnPos = this.playerPhysics.position.clone();
      if (this.transportRig.activeMode !== 'car') {
        this.switchOpenWorldTransport('car', true);
      }
      this.transportRig.clearParkedCarMarker();
      this.playerPhysics.reset(spawnPos, this.playerPhysics.heading);
      this.restorePlayerVehicleFull();
      if (this.playerVehicleMeshGroup) {
        this.playerVehicleMeshGroup.position.copy(spawnPos);
        this.playerVehicleMeshGroup.visible = true;
      }
      sound.playWrenchToolSound();
    };

    // GTA Open World Bail / Impound Yard Respawn
    this.ui.onOpenWorldBailRespawn = () => {
      const nearestWp = this.findNearestWaypoint(this.playerPhysics.position);
      this.switchOpenWorldTransport('car', true);
      this.transportRig.clearParkedCarMarker();
      this.playerPhysics.reset(nearestWp.position, nearestWp.heading);
      this.restorePlayerVehicleFull();
      if (this.playerVehicleMeshGroup) {
        this.playerVehicleMeshGroup.position.copy(nearestWp.position);
        this.playerVehicleMeshGroup.rotation.set(0, nearestWp.heading, 0);
        this.playerVehicleMeshGroup.visible = true;
      }
      this.lastPlayerPos.copy(nearestWp.position);
      this.resetDriftSession();
      this.police.clearAll();
      this.openWorld.resetAfterBusted();
      this.isOpenWorldBustedPaused = false;
      this.clock.getDelta();
      sound.ensureRunning();
      sound.playWrenchToolSound();
      this.ui.showToast('🚗 Carro liberado do pátio! Ficha limpa — explore o Mundo Aberto!');
    };

    // Settings Changed
    this.ui.onApplySettings = (quality: GraphicsQuality, weather: WeatherType, timeOfDay: TimeOfDay) => {
      this.culling.setQuality(quality);
      this.renderer.setPixelRatio(
        this.deviceSpecs.isSoftwareGl || quality === 'low'
          ? 1
          : Math.min(window.devicePixelRatio, quality === 'ultra' ? 2 : 1.5)
      );
      this.renderer.shadowMap.enabled = quality !== 'low';
      this.weatherSystem.setWeather(weather);
      this.city.applyAtmosphere(timeOfDay, weather, quality);
    };

    // Customization / Vehicle Changed
    this.ui.onVehicleChanged = (newVehicle: VehicleConfig) => {
      this.setupPlayerVehicle(newVehicle);
    };

    // Track Changed
    this.ui.onTrackChanged = (track: TrackConfig) => {
      this.activeTrackConfig = track;
      this.city.generateTrack(track, this.ui.quality);
      this.city.applyAtmosphere(this.ui.timeOfDay, this.ui.weather, this.ui.quality);
      this.repopulateNPCs(track.id);
      this.repopulateTraffic(track.id);
    };

    // Cloud Save Restored (Google Drive)
    this.ui.onCloudSaveRestored = (saveData) => {
      this.profile = saveData.profile;
      this.police.setDifficulty(this.profile.difficulty || 'very_easy');
      this.ui.achievements.syncProfileCounts(
        this.profile.copsDestroyed,
        this.profile.totalEscapes,
        DEFAULT_VEHICLES.filter((v) => v.unlocked).length,
        0
      );
      const equippedCar = DEFAULT_VEHICLES.find((v) => v.id === this.profile.selectedCarId) || DEFAULT_VEHICLES[0];
      this.setupPlayerVehicle(equippedCar);
    };

    // Difficulty Changed
    this.ui.onDifficultyChanged = (diff) => {
      this.profile.difficulty = diff;
      this.police.setDifficulty(diff);
    };

    // 3D Cinematic Animation on Purchase / Modifying Car
    this.ui.onPlayCinematicScene = (type, vehicle, detailText) => {
      this.playCinematicAnimation(type, vehicle, detailText);
    };

    // Horizontal / Vertical Game Mode Changed
    this.ui.onOrientationChanged = (_mode, isVertical) => {
      this.isVerticalMode = isVertical;
    };

    // Pause System (Offline freezes simulation; Online keeps live multiplayer running)
    this.ui.onPauseChanged = (paused) => {
      if (paused && this.currentMode !== 'multiplayer') {
        sound.stopAll();
      }
      if (!paused) {
        this.clock.getDelta();
      }
    };

    this.ui.onRestartMode = () => {
      if (!this.lastStartParams) return;
      const { mode, chapter, trackId } = this.lastStartParams;
      this.ui.renderHUD();
      this.ui.onStartMode?.(mode, chapter, trackId);
    };

    // Replay Theater Callbacks
    this.ui.hasReplayAvailable = () => this.replay.hasFrames();

    this.ui.onOpenReplay = (source) => {
      this.enterReplay(source);
    };

    this.ui.onReplayAction = (action, value) => {
      if (!this.replay.active) return;
      if (action === 'play_pause') {
        this.replay.togglePlayPause();
      } else if (action === 'seek' && typeof value === 'number') {
        this.replay.seekTo(value);
      } else if (action === 'speed' && typeof value === 'number') {
        this.replay.setPlaybackSpeed(value);
      } else if (action === 'camera' && typeof value === 'string') {
        this.replay.setCameraAngle(value as ReplayCameraAngle);
      } else if (action === 'restart') {
        this.replay.seekTo(0);
      } else if (action === 'close') {
        this.exitReplay();
      }
    };
  }

  private enterReplay(source: ReplayReturnSource) {
    if (this.replay.active) return;
    if (!this.replay.startPlayback(source)) {
      this.ui.showToast('🎬 Dirija alguns segundos para gravar um replay.');
      return;
    }

    sound.stopAll();
    if (this.transportRig) {
      this.transportRig.rootGroup.visible = false;
    }
    if (this.playerVehicleMeshGroup) {
      this.playerVehicleMeshGroup.visible = true;
    }

    // Hide live cops & roadblocks during replay so only recorded cop meshes render
    const hiddenObjects: THREE.Object3D[] = [];
    for (const cop of this.police.cops) {
      if (cop.mesh.visible) {
        cop.mesh.visible = false;
        hiddenObjects.push(cop.mesh);
      }
    }
    for (const rb of this.police.roadblocks) {
      if (rb.group.visible) {
        rb.group.visible = false;
        hiddenObjects.push(rb.group);
      }
    }

    this.replaySavedState = {
      playerPos: this.playerPhysics.position.clone(),
      playerHeading: this.playerPhysics.heading,
      playerPitch: this.playerPhysics.pitch,
      playerRoll: this.playerPhysics.roll,
      missingWheels: [...this.playerPhysics.missingWheels] as [boolean, boolean, boolean, boolean],
      cameraMode: this.cameraMode,
      hiddenObjects,
    };

    const hudEl = this.ui.root.querySelector('.hud-overlay') as HTMLElement | null;
    if (hudEl) hudEl.style.display = 'none';
    const screenEl = this.ui.root.querySelector('.screen-backdrop') as HTMLElement | null;
    if (screenEl) screenEl.style.display = 'none';

    this.ui.renderReplayHUD(this.replay.duration);
    this.clock.getDelta();
  }

  private exitReplay() {
    if (!this.replay.active) return;
    const returnSource = this.replay.returnSource;
    this.replay.stopPlayback();
    this.ui.removeReplayHUD();

    const saved = this.replaySavedState;
    this.replaySavedState = null;

    if (saved) {
      for (const obj of saved.hiddenObjects) {
        obj.visible = true;
      }
      if (this.playerVehicleMeshGroup) {
        if (this.transportRig && this.transportRig.activeMode !== 'car' && this.transportRig.hasParkedCar) {
          this.playerVehicleMeshGroup.position.copy(this.transportRig.parkedCarPos);
          this.playerVehicleMeshGroup.rotation.set(0, this.transportRig.parkedCarHeading, 0);
        } else {
          this.playerVehicleMeshGroup.position.copy(saved.playerPos);
          this.playerVehicleMeshGroup.rotation.set(saved.playerPitch, saved.playerHeading, saved.playerRoll);
        }
      }
      this.playerWheels.forEach((wheel, idx) => {
        wheel.visible = !saved.missingWheels[idx];
        wheel.rotation.y = 0;
      });
      this.playerUpdateDamageEffects?.(0, 0, saved.missingWheels);
      this.cameraMode = saved.cameraMode;
    }

    if (this.transportRig) {
      this.transportRig.setMode(this.transportRig.activeMode);
    }

    const hudEl = this.ui.root.querySelector('.hud-overlay') as HTMLElement | null;
    if (hudEl) hudEl.style.display = '';
    const screenEl = this.ui.root.querySelector('.screen-backdrop') as HTMLElement | null;
    if (screenEl) screenEl.style.display = '';

    this.clock.getDelta();

    if (returnSource === 'pause') {
      this.ui.showPauseModal();
    } else {
      this.currentMode = 'title';
      this.switchOpenWorldTransport('car', true);
      this.transportRig.clearParkedCarMarker();
      this.transportRig.clearStreetMotorcycles();
      this.ui.renderTitleScreen();
    }
  }

  // 3D Cinematic Showcase State
  private isCinematicActive: boolean = false;
  private cinematicTime: number = 0;
  private cinematicDuration: number = 4.5;
  private cinematicType: 'purchase' | 'upgrade' | 'paint' | 'neon' = 'purchase';
  private cinematicOverlayEl: HTMLElement | null = null;
  private showcaseSpotlight: THREE.SpotLight | null = null;
  private showcaseParticleGroup: THREE.Group | null = null;

  public playCinematicAnimation(
    type: 'purchase' | 'upgrade' | 'paint' | 'neon',
    vehicle: VehicleConfig,
    detailText: string
  ) {
    this.isCinematicActive = true;
    this.cinematicTime = 0;
    this.cinematicType = type;
    this.cinematicDuration = type === 'purchase' ? 5.2 : 4.0;

    // Reset car position to showroom center
    if (this.playerVehicleMeshGroup) {
      this.playerVehicleMeshGroup.position.set(0, 0, 0);
      this.playerVehicleMeshGroup.rotation.set(0, 0, 0);
    }
    if (this.playerPhysics) {
      this.playerPhysics.reset(new THREE.Vector3(0, 0, 0), 0);
    }

    // Audio effects
    if (type === 'purchase') {
      sound.playSuccessFanfare();
      setTimeout(() => sound.playShowroomRevSound(), 1400);
    } else {
      sound.playWrenchToolSound();
      setTimeout(() => sound.playShowroomRevSound(), 1200);
    }

    // Showroom Spotlight
    if (!this.showcaseSpotlight) {
      this.showcaseSpotlight = new THREE.SpotLight(0x00f0ff, 8, 30, Math.PI / 4, 0.4);
      this.showcaseSpotlight.position.set(0, 9, 0);
      this.showcaseSpotlight.castShadow = true;
      this.scene.add(this.showcaseSpotlight);
    }
    this.showcaseSpotlight.visible = true;
    this.showcaseSpotlight.color.set(type === 'purchase' ? 0xffd60a : 0x00f0ff);

    // Confetti / Sparks particle burst
    if (!this.showcaseParticleGroup) {
      this.showcaseParticleGroup = new THREE.Group();
      const sparkGeo = new THREE.SphereGeometry(0.08, 6, 6);
      const colors = [0xffd60a, 0x00f0ff, 0xff0055, 0x00ff88, 0xffffff];
      for (let i = 0; i < 45; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length] });
        const p = new THREE.Mesh(sparkGeo, mat);
        p.position.set(
          (Math.random() - 0.5) * 6,
          Math.random() * 4,
          (Math.random() - 0.5) * 6
        );
        p.userData = {
          velY: 1.5 + Math.random() * 2.5,
          rotSpeed: (Math.random() - 0.5) * 5,
        };
        this.showcaseParticleGroup.add(p);
      }
      this.scene.add(this.showcaseParticleGroup);
    }
    this.showcaseParticleGroup.visible = true;

    // Overlay with cinematic title & letterbox bars
    if (this.cinematicOverlayEl) this.cinematicOverlayEl.remove();
    this.cinematicOverlayEl = document.createElement('div');
    this.cinematicOverlayEl.className = 'cinematic-3d-overlay';
    this.cinematicOverlayEl.innerHTML = `
      <div class="letterbox-bar letterbox-top"></div>
      <div class="cinematic-title-box">
        <span class="cinematic-badge">${type === 'purchase' ? '🏆 NOVO VEÍCULO NA GARAGEM' : '⚡ PERSONALIZAÇÃO DE ALTA PERFORMANCE'}</span>
        <h1 class="cinematic-car-name">${vehicle.name.toUpperCase()}</h1>
        <p class="cinematic-sub-text">${detailText}</p>
        <div class="cinematic-stats-row">
          <span>Top Speed: <strong>${vehicle.topSpeed} km/h</strong></span>
          <span>Aceleração: <strong>${vehicle.acceleration}</strong></span>
          <span>Handling: <strong>${vehicle.handling}</strong></span>
        </div>
      </div>
      <div class="cinematic-actions-row">
        <button class="cinematic-skip-btn" id="btnEndCinematic">FECHAR ANIMAÇÃO ❯</button>
      </div>
      <div class="letterbox-bar letterbox-bottom"></div>
    `;
    document.body.appendChild(this.cinematicOverlayEl);

    this.cinematicOverlayEl.querySelector('#btnEndCinematic')?.addEventListener('click', () => {
      this.endCinematic();
    });
  }

  private endCinematic() {
    this.isCinematicActive = false;
    if (this.cinematicOverlayEl) {
      this.cinematicOverlayEl.remove();
      this.cinematicOverlayEl = null;
    }
    if (this.showcaseSpotlight) {
      this.showcaseSpotlight.visible = false;
    }
    if (this.showcaseParticleGroup) {
      this.showcaseParticleGroup.visible = false;
    }
    this.ui.renderTitleScreen();
  }

  update() {
    const dt = Math.min(this.clock.getDelta(), 0.05);

    // 3D Cinematic Scene Animation Loop
    if (this.isCinematicActive) {
      this.cinematicTime += dt;
      const progress = this.cinematicTime / this.cinematicDuration;

      // Dynamic cinematic camera sweeps (Slow drone dolly zoom + 360 sweeping orbit)
      const angle = this.cinematicTime * 0.95;
      const camHeight = 1.6 + Math.sin(this.cinematicTime * 1.5) * 0.6;
      const camRadius = 5.8 - Math.sin(progress * Math.PI) * 1.4;

      this.camera.position.set(
        Math.sin(angle) * camRadius,
        camHeight,
        Math.cos(angle) * camRadius
      );
      this.camera.lookAt(0, 0.75, 0);

      // Rotate car gently on the turntable
      if (this.playerVehicleMeshGroup) {
        this.playerVehicleMeshGroup.rotation.y = this.cinematicTime * 0.45;
      }

      // Animate showcase particles
      if (this.showcaseParticleGroup) {
        for (let i = 0; i < this.showcaseParticleGroup.children.length; i++) {
          const p = this.showcaseParticleGroup.children[i];
          p.position.y += p.userData.velY * dt;
          p.rotation.y += p.userData.rotSpeed * dt;
          if (p.position.y > 5.5) p.position.y = 0.2;
        }
      }

      if (this.cinematicTime >= this.cinematicDuration) {
        this.endCinematic();
      }
      return;
    }

    // Sync mode if player exited via HUD back to Title screen
    if (this.ui.currentMode === 'title' && this.currentMode !== 'title') {
      if (this.replay.active) {
        this.replay.stopPlayback();
        this.ui.removeReplayHUD();
        this.replaySavedState = null;
      }
      this.currentMode = 'title';
      this.isOpenWorldBustedPaused = false;
      this.switchOpenWorldTransport('car', true);
      this.transportRig.clearParkedCarMarker();
      this.transportRig.clearStreetMotorcycles();
      this.openWorld.clear();
      this.police.clearAll();
      sound.stopAll();
    }

    // 3D Instant Replay Theater Playback Loop (runs across pause, results, and main menu)
    if (this.replay.active) {
      const s = this.replay.updatePlayback(dt);
      if (this.playerVehicleMeshGroup) {
        this.playerVehicleMeshGroup.position.set(s.x, s.y, s.z);
        this.playerVehicleMeshGroup.rotation.set(s.pitch, s.heading, s.roll);

        this.playerWheels.forEach((wheel, idx) => {
          const isMissing = (s.missingMask & (1 << idx)) !== 0;
          wheel.visible = !isMissing;
          if (!isMissing) {
            wheel.rotation.x = s.wheelRoll;
            if (idx === 0 || idx === 1) {
              wheel.rotation.y = -s.steerAngle;
            }
          }
        });

        const missingTuple: [boolean, boolean, boolean, boolean] = [
          (s.missingMask & 1) !== 0,
          (s.missingMask & 2) !== 0,
          (s.missingMask & 4) !== 0,
          (s.missingMask & 8) !== 0,
        ];
        this.playerUpdateDamageEffects?.(this.replay.isPaused ? 0 : dt, s.speedKmh, missingTuple);
        this.playerUpdateOccupants?.(
          this.replay.isPaused ? 0 : dt,
          s.steerAngle,
          s.driftSlip,
          s.speedKmh,
          null,
          0
        );
      }

      this.replay.updateCamera(dt, this.camera, this.isVerticalMode);
      OutlawGameScene._targetCamPos.set(s.x, s.y, s.z);
      this.city.update(this.replay.isPaused ? 0 : dt, OutlawGameScene._targetCamPos, this.ui.weather);
      this.culling.update(this.camera, OutlawGameScene._targetCamPos);
      this.ui.updateReplayHUD(
        this.replay.playbackTime,
        this.replay.duration,
        s.speedKmh,
        s.isDrifting,
        this.replay.isPaused
      );
      return;
    }

    // Title / Menu Orbiting Camera
    if (this.currentMode === 'title') {
      if (this.filmDirector.active) {
        this.filmDirector.stop();
        this.playerSetCabinLight?.(0);
        this.isEndingOutroCutscene = false;
        document.getElementById('DialogueBoxOverlay')?.remove();
        document.getElementById('FilmLetterboxOverlay')?.remove();
      }
      if (this.remotePlayers.size > 0) this.clearRemotePlayers();
      this.orbitAngle += dt * 0.35;
      const radius = 8.5;
      this.camera.position.set(
        Math.sin(this.orbitAngle) * radius,
        3.2 + Math.sin(this.orbitAngle * 2) * 0.4,
        Math.cos(this.orbitAngle) * radius
      );
      this.camera.lookAt(0, 1.2, 0);
      this.npcs.update(dt, this.camera.position, 0, this.city.waypoints, this.city.roadHalfWidth);
      this.traffic.update(
        dt,
        this.camera.position,
        OutlawGameScene._zeroVel,
        0,
        this.city.waypoints,
        (pos, y) => this.city.getRoadElevation(pos, y),
        false
      );
      this.playerUpdateOccupants?.(dt, 0, 0, 0, null, 0);
      return;
    }

    // Movie-style 3D Cockpit Cutscene Loop (Story & Career)
    if (this.filmDirector.active) {
      if (this.playerVehicleMeshGroup) {
        this.playerVehicleMeshGroup.position.copy(this.playerPhysics.position);
        this.playerVehicleMeshGroup.rotation.set(0, this.playerPhysics.heading, 0);
      }
      this.filmDirector.update(
        dt,
        this.camera,
        this.playerPhysics.position,
        this.playerPhysics.heading,
        this.playerSetCabinLight
      );
      this.playerUpdateOccupants?.(
        dt,
        0,
        0,
        0,
        this.filmDirector.speakingRole,
        this.filmDirector.elapsed
      );
      this.city.update(dt, this.playerPhysics.position, this.ui.weather);
      this.npcs.update(dt, this.playerPhysics.position, 0, this.city.waypoints, this.city.roadHalfWidth);
      this.traffic.update(
        dt,
        this.playerPhysics.position,
        OutlawGameScene._zeroVel,
        0,
        this.city.waypoints,
        (pos, y) => this.city.getRoadElevation(pos, y),
        false
      );
      this.culling.update(this.camera, this.playerPhysics.position);
      return;
    }

    // Pause Handling:
    // - Offline modes freeze the entire simulation cleanly while the Pause menu is open.
    // - Online multiplayer keeps running live without freezing so other players aren't harmed;
    //   only local driving inputs stay neutralized while paused.
    if (this.ui.isPaused) {
      this.ui.controls.throttle = 0;
      this.ui.controls.brake = 0;
      this.ui.controls.steer = 0;
      this.ui.controls.handbrake = false;
      this.ui.controls.nitro = false;
      if (this.currentMode !== 'multiplayer') {
        return;
      }
    }

    if (this.isOpenWorldBustedPaused) {
      return;
    }

    // Update wheel loss cooldown & loose tumbling detached wheels
    if (this.wheelLossCooldown > 0) {
      this.wheelLossCooldown = Math.max(0, this.wheelLossCooldown - dt);
    }
    if (this.stuntToastCooldown > 0) {
      this.stuntToastCooldown = Math.max(0, this.stuntToastCooldown - dt);
    }
    this.updateDetachedWheels(dt);

    // Camera Switch Request
    if (this.ui.controls.switchCamera) {
      this.ui.controls.switchCamera = false;
      this.cameraMode = this.cameraMode === 'chase' ? 'hood' : 'chase';
    }

    // Reset Vehicle Request
    if (this.ui.controls.resetVehicle) {
      this.ui.controls.resetVehicle = false;
      const nearestWp = this.findNearestWaypoint(this.playerPhysics.position);
      this.playerPhysics.reset(nearestWp.position, nearestWp.heading);
      this.lastPlayerPos.copy(nearestWp.position);
      this.resetDriftSession();
      this.playerResetDeform?.();
      this.clearDetachedWheels();
      this.wheelLossCooldown = 0;
    }

    // 1. Check road elevation (bridges/overpass) & stunt jump ramps
    const groundHeight = this.city.getRoadElevation(this.playerPhysics.position, this.playerPhysics.position.y);
    const rampCheck = this.city.checkJumpRamp(this.playerPhysics.position, this.playerPhysics.speedKmh);

    if (rampCheck.hit && rampCheck.launch) {
      this.playerPhysics.launchRamp(rampCheck.launchSpeedY, rampCheck.pitch);
      sound.playCountdownBeep(true);
      this.ui.showToast('🚀 SALTO ESPORTIVO! +350 PTS');
      this.profile.cash += 350;
      this.playerPhysics.driftScore += 350;
      this.ui.achievements.recordStuntJump();
    }

    const targetHeight = rampCheck.hit ? rampCheck.height : groundHeight;
    const isNonCarMode =
      this.currentMode === 'career_open_world' && this.transportRig.activeMode !== 'car';
    const activeSpec = OPEN_WORLD_TRANSPORTS[this.transportRig.activeMode];
    let driftPointsAwarded = 0;

    if (isNonCarMode) {
      const owStep = this.transportRig.stepPhysics(dt, this.ui.controls, targetHeight, this.playerPhysics);
      driftPointsAwarded = owStep.wheelieAwarded;
      if (owStep.jumpTriggered && this.stuntToastCooldown <= 0) {
        this.stuntToastCooldown = 1.4;
        if (this.transportRig.activeMode === 'skateboard') {
          this.playerPhysics.driftScore += 150;
          this.ui.showToast('🛹 KICKFLIP / OLLIE! +150 PTS');
        } else if (this.transportRig.activeMode === 'moto_cross') {
          this.playerPhysics.driftScore += 200;
          this.ui.showToast('🏜️ SALTO MOTOCROSS! +200 PTS');
        }
      }
    } else {
      const physicsStep = this.playerPhysics.update(
        dt,
        this.ui.controls,
        targetHeight,
        this.weatherSystem.currentGripMultiplier,
        this.weatherSystem.currentBrakingMultiplier
      );
      driftPointsAwarded = physicsStep.driftPointsAwarded;
    }

    // Record distance & top speed milestones
    const frameDist = this.lastPlayerPos.distanceTo(this.playerPhysics.position);
    if (frameDist > 0.001 && frameDist < 30) {
      this.ui.achievements.recordDistance(frameDist);
    }
    this.lastPlayerPos.copy(this.playerPhysics.position);
    this.ui.achievements.recordSpeed(this.playerPhysics.speedKmh);

    // Off-road Penalty: 20 pts/s on 'very_easy', scaling up to 70 pts/s on 'professional'
    // Disabled in Career Open World (GTA-style) so players can cut alleys, plazas & shortcuts freely.
    const isOnRoad = this.city.isPositionOnRoadway(this.playerPhysics.position);
    if (!isOnRoad && !this.isCinematicActive && this.currentMode !== 'career_open_world') {
      const penaltyRates: Record<GameDifficulty, number> = {
        very_easy: 20,
        easy: 25,
        amateur: 30,
        normal: 35,
        hard: 45,
        legendary: 55,
        professional: 70,
      };
      const rate = penaltyRates[this.profile.difficulty] || 20;
      const lostPoints = rate * dt;
      this.playerPhysics.driftScore = Math.max(0, this.playerPhysics.driftScore - lostPoints);
      this.ui.showOffroadWarning(rate);
    } else {
      this.ui.hideOffroadWarning();
    }

    // 2. Execute Occlusion & Frustum Culling
    this.culling.update(this.camera, this.playerPhysics.position);

    // 3. Dynamic Story Mid-Chase Dialogues
    if (this.currentMode === 'story' && this.currentStoryChapter?.dialogueMidList) {
      this.storyTimeElapsed += dt;
      for (const mid of this.currentStoryChapter.dialogueMidList) {
        if (!mid.triggered && this.storyTimeElapsed >= mid.triggerSec) {
          mid.triggered = true;
          this.ui.triggerDialogue(mid.lines);
          break;
        }
      }
    }

    // 4. City Environment, Props & Accessible Locations
    this.city.update(dt, this.playerPhysics.position, this.ui.weather);

    // 4a. Dynamic Weather System & HUD Overlays
    const isLightning = this.weatherSystem.update(dt, this.camera.position, this.city.roadMaterial);
    this.ui.updateWeatherHUD(this.weatherSystem.currentWeather, isLightning);

    // 4b. Destructible Props Collision (trees, lamp posts, traffic lights)
    const propHit = this.city.checkDestructiblePropCollision(
      this.playerPhysics.position,
      this.playerPhysics.velocity,
      this.playerPhysics.speedKmh,
      isNonCarMode ? activeSpec.collisionRadius : 1.4
    );
    if (propHit.hit) {
      sound.playPropCrashSound(propHit.propType === 'tree' ? 'wood' : 'metal');
      if (this.playerPhysics.speedKmh > 25) {
        this.playerPhysics.speedKmh *= 0.88;
        this.playerPhysics.velocity.multiplyScalar(0.88);
      }
      this.playerPhysics.driftScore += propHit.score;
      this.profile.cash += Math.round(propHit.score / 2);
      this.ui.showToast(propHit.toast);
    }

    // 4c. Accessible Locations Proximity & Interactive Prompts
    const locationProximity = this.city.accessibleLocations.checkPlayerProximity(this.playerPhysics.position);
    if (locationProximity.canInteract && locationProximity.location) {
      this.ui.updateLocationInteractionPrompt({
        canInteract: true,
        locationName: locationProximity.location.name,
        actionName: locationProximity.nearEntrance ? 'ENTRAR' : 'INTERAGIR',
        icon: locationProximity.location.icon,
        instruction: locationProximity.location.interactPrompt,
      });
    } else if (locationProximity.isInside && locationProximity.location) {
      this.ui.updateLocationInteractionPrompt({
        canInteract: true,
        locationName: locationProximity.location.name,
        actionName: 'EXPLORAR',
        icon: locationProximity.location.icon,
        instruction: 'Interior acessível',
      });
    } else {
      this.ui.updateLocationInteractionPrompt(null);
    }

    // 5. Building Collisions
    const collisionNormal = this.city.checkBuildingCollision(
      this.playerPhysics.position,
      isNonCarMode ? activeSpec.collisionRadius : 1.4
    );
    if (collisionNormal) {
      const impactSpeed = this.playerPhysics.velocity.length();
      if (impactSpeed > 2.5) {
        if (this.playerPhysics.isDrifting) this.activeDriftDamaged = true;
        if (this.transportRig.activeMode !== 'foot') {
          sound.playCollisionSound(Math.min(1.0, impactSpeed / 30));
        }
        this.playerPhysics.applyCollisionImpulse(
          collisionNormal,
          this.transportRig.activeMode === 'foot' ? impactSpeed * 0.25 : impactSpeed
        );

        // Car-specific impact deformation & wheel detachment
        if (!isNonCarMode) {
          OutlawGameScene._hitNormal.copy(collisionNormal).negate();
          this.worldDirToLocal(
            OutlawGameScene._hitNormal,
            this.playerPhysics.heading,
            OutlawGameScene._localHitDir
          );
          this.playerImpactDeform?.(OutlawGameScene._localHitDir, impactSpeed);
          this.maybeDetachWheel(OutlawGameScene._localHitDir, impactSpeed);
        }

        // Infraction in Free Roam or Career Open World -> Triggers / Escalates Police Heat
        if (this.currentMode === 'free_roam' && this.police.heatLevel === 0) {
          this.freeRoamViolationsCount++;
          if (this.freeRoamViolationsCount >= 2) {
            this.police.setHeat(1, this.playerPhysics.position, this.city.waypoints);
          }
        } else if (this.currentMode === 'career_open_world' && this.transportRig.activeMode !== 'foot') {
          const esc = this.openWorld.registerChaos(0.55, this.police.heatLevel);
          if (esc && esc > this.police.heatLevel) {
            this.police.setHeat(esc, this.playerPhysics.position, this.city.waypoints);
            this.ui.showToast(`⭐ PROCURADO: ${esc} ESTRELA(S)!`);
          }
        }
      }
    }

    // Speeding violation in Free Roam / Career Open World
    if (
      (this.currentMode === 'free_roam' || this.currentMode === 'career_open_world') &&
      this.police.heatLevel === 0 &&
      this.playerPhysics.speedKmh > 140
    ) {
      this.police.setHeat(1, this.playerPhysics.position, this.city.waypoints);
      if (this.currentMode === 'career_open_world') {
        this.openWorld.registerChaos(1.0, 0);
        this.ui.showToast('⭐ EXCESSO DE VELOCIDADE! POLÍCIA NA SUA COLA (1★)');
      }
    }

    // 4. Update Police Pursuit System (capture active heat prior to possible escape clear)
    const heatBeforePursuitUpdate = this.police.heatLevel;
    const pursuitResult = this.police.update(
      dt,
      this.playerPhysics.position,
      this.playerPhysics.velocity,
      this.playerPhysics.speedKmh,
      this.city.waypoints
    );

    // Check collisions with Police Vehicles
    this.police.cops.forEach((cop, idx) => {
      if (cop.destroyed) return;
      const dist = cop.position.distanceTo(this.playerPhysics.position);
      if (dist < 3.2) {
        // Impact collision without allocations!
        OutlawGameScene._relVel.subVectors(this.playerPhysics.velocity, cop.velocity);
        const impactSpeed = OutlawGameScene._relVel.length();
        if (impactSpeed > 3.0) {
          if (this.playerPhysics.isDrifting) this.activeDriftDamaged = true;
          sound.playCollisionSound(Math.min(1.0, impactSpeed / 25));
          OutlawGameScene._hitNormal.subVectors(this.playerPhysics.position, cop.position).normalize();
          const copImpulseFactor = this.profile.difficulty === 'very_easy' ? 0.14 : 0.4;
          this.playerPhysics.applyCollisionImpulse(OutlawGameScene._hitNormal, impactSpeed * copImpulseFactor);

          // Cop local hit direction (toward player)
          this.worldDirToLocal(
            OutlawGameScene._hitNormal,
            cop.heading,
            OutlawGameScene._copLocalHitDir
          );

          // Player car impact deformation & wheel detachment (cars only)
          if (!isNonCarMode) {
            OutlawGameScene._hitNormal.negate();
            this.worldDirToLocal(
              OutlawGameScene._hitNormal,
              this.playerPhysics.heading,
              OutlawGameScene._localHitDir
            );
            if (this.profile.difficulty !== 'very_easy') {
              this.playerImpactDeform?.(OutlawGameScene._localHitDir, impactSpeed);
              this.maybeDetachWheel(OutlawGameScene._localHitDir, impactSpeed);
            } else {
              this.playerImpactDeform?.(OutlawGameScene._localHitDir, impactSpeed * 0.35);
            }
          }

          // Damage Cop!
          const destroyed = this.police.damageCop(
            idx,
            impactSpeed * (this.profile.difficulty === 'very_easy' ? 7.5 : 3.5),
            OutlawGameScene._copLocalHitDir,
            impactSpeed
          );
          if (destroyed) {
            this.profile.copsDestroyed++;
            this.profile.cash += 2500;
            this.ui.achievements.recordCopDestroyed();
            if (this.currentMode === 'career_open_world') {
              const esc = this.openWorld.registerChaos(2.5, this.police.heatLevel);
              if (esc && esc > this.police.heatLevel) {
                this.police.setHeat(esc, this.playerPhysics.position, this.city.waypoints);
                this.ui.showToast(`⭐ VIATURA DESTRUÍDA! PROCURADO: ${esc} ESTRELA(S)!`);
              }
            }
          } else if (this.currentMode === 'career_open_world' && impactSpeed > 11) {
            const esc = this.openWorld.registerChaos(0.85, this.police.heatLevel);
            if (esc && esc > this.police.heatLevel) {
              this.police.setHeat(esc, this.playerPhysics.position, this.city.waypoints);
              this.ui.showToast(`⭐ PROCURADO: ${esc} ESTRELA(S)!`);
            }
          }
        }
      }
    });

    // Check collisions with Police Roadblocks (Barricades & Spike Strips)
    const rbCollision = this.police.checkRoadblockCollision(
      this.playerPhysics.position,
      isNonCarMode ? activeSpec.collisionRadius + 0.35 : 1.8
    );
    if (rbCollision && rbCollision.hit) {
      if (this.playerPhysics.isDrifting) this.activeDriftDamaged = true;
      OutlawGameScene._hitNormal.copy(rbCollision.normal).negate();
      this.worldDirToLocal(
        OutlawGameScene._hitNormal,
        this.playerPhysics.heading,
        OutlawGameScene._localHitDir
      );

      if (rbCollision.spikeHit) {
        this.playerPhysics.health = Math.max(0, this.playerPhysics.health - 25);
        this.playerPhysics.velocity.multiplyScalar(0.5);
        this.playerPhysics.speedKmh *= 0.5;
        sound.playCollisionSound(0.85);
        this.ui.showToast('💥 FITA DE PREGOS (SPIKE STRIP)! PNEUS FURADOS (-25% SAÚDE)');
        if (!isNonCarMode) {
          this.maybeDetachWheel(OutlawGameScene._localHitDir, 24, true);
        }
        this.police.smashRoadblock(rbCollision.roadblockIndex);
      } else {
        const impactSpeedKmh = this.playerPhysics.speedKmh;
        const impactSpeedMs = impactSpeedKmh / 3.6;
        if (!isNonCarMode) {
          this.playerImpactDeform?.(OutlawGameScene._localHitDir, impactSpeedMs);
          this.maybeDetachWheel(OutlawGameScene._localHitDir, impactSpeedMs);
        }

        if (impactSpeedKmh > 75) {
          // High-speed breach! Smash through the cruisers
          this.police.smashRoadblock(rbCollision.roadblockIndex);
          this.playerPhysics.applyCollisionImpulse(rbCollision.normal, impactSpeedKmh * 0.25);
          this.playerPhysics.health = Math.max(0, this.playerPhysics.health - 12);
          this.profile.cash += 1500;
          this.playerPhysics.driftScore += 1000;
          sound.playSuccessFanfare();
          this.ui.showToast('💥 BARREIRA POLICIAL DESTRUÍDA! +R$ 1.500 (+1000 PTS)');
        } else {
          // Too slow to smash through: bounced back
          this.playerPhysics.applyCollisionImpulse(rbCollision.normal, Math.max(12, impactSpeedKmh * 0.45));
          this.playerPhysics.health = Math.max(0, this.playerPhysics.health - 15);
          sound.playCollisionSound(0.9);
          this.ui.showToast('⚠️ BLOQUEIO POLICIAL! IMPACTO FORTE');
        }
      }
    }

    // Track clean/perfect drifts (sustained drift without collisions)
    if (this.playerPhysics.isDrifting && this.playerPhysics.speedKmh > 38) {
      this.activeDriftTime += dt;
      this.activeDriftPoints += driftPointsAwarded;
    } else {
      if (!this.activeDriftDamaged && this.activeDriftTime >= 1.1 && this.activeDriftPoints >= 150) {
        this.ui.achievements.recordPerfectDrift(this.activeDriftPoints);
        this.ui.showToast(`🔥 ${activeSpec.isMotorcycle ? 'GRAU / DRIFT DE MOTO PERFEITO' : 'DRIFT PERFEITO'}! (+${Math.round(this.activeDriftPoints)} PTS)`);
      }
      this.resetDriftSession();
    }

    // Update Street & Sidewalk Pedestrians (NPCs)
    const npcResult = this.npcs.update(
      dt,
      this.playerPhysics.position,
      this.playerPhysics.speedKmh,
      this.city.waypoints,
      this.city.roadHalfWidth
    );
    if (npcResult.hitCount > 0) {
      sound.playNpcBumpSound();
      this.playerPhysics.driftScore = Math.max(0, this.playerPhysics.driftScore - 100 * npcResult.hitCount);
      this.ui.showToast('⚠️ CUIDADO COM OS PEDESTRES! (-100 PTS)');
      if (this.currentMode === 'free_roam' && this.police.heatLevel === 0) {
        this.police.setHeat(1, this.playerPhysics.position, this.city.waypoints);
      } else if (this.currentMode === 'career_open_world') {
        const esc = this.openWorld.registerChaos(1.2 * npcResult.hitCount, this.police.heatLevel);
        if (esc && esc > this.police.heatLevel) {
          this.police.setHeat(esc, this.playerPhysics.position, this.city.waypoints);
          this.ui.showToast(`⭐ PROCURADO: ${esc} ESTRELA(S)!`);
        }
      }
    }

    // Update NPC Traffic Vehicles (with visible 3D NPC drivers inside)
    const trafficHit = this.traffic.update(
      dt,
      this.playerPhysics.position,
      this.playerPhysics.velocity,
      this.playerPhysics.speedKmh,
      this.city.waypoints,
      (pos, y) => this.city.getRoadElevation(pos, y),
      true
    );
    if (trafficHit && trafficHit.hit) {
      if (this.playerPhysics.isDrifting) this.activeDriftDamaged = true;
      sound.playCollisionSound(Math.min(1.0, trafficHit.impactSpeedMs / 24));
      this.playerPhysics.applyCollisionImpulse(trafficHit.normal, trafficHit.impactSpeedMs * 0.55);

      if (!isNonCarMode) {
        OutlawGameScene._hitNormal.copy(trafficHit.normal).negate();
        this.worldDirToLocal(
          OutlawGameScene._hitNormal,
          this.playerPhysics.heading,
          OutlawGameScene._localHitDir
        );
        this.playerImpactDeform?.(OutlawGameScene._localHitDir, trafficHit.impactSpeedMs);
        this.maybeDetachWheel(OutlawGameScene._localHitDir, trafficHit.impactSpeedMs);
      }
      this.ui.showToast('🚘 COLISÃO NO TRÂNSITO! CUIDADO COM OS MOTORISTAS');

      if (this.currentMode === 'free_roam' && this.police.heatLevel === 0) {
        this.freeRoamViolationsCount++;
        if (this.freeRoamViolationsCount >= 2) {
          this.police.setHeat(1, this.playerPhysics.position, this.city.waypoints);
        }
      } else if (this.currentMode === 'career_open_world') {
        const esc = this.openWorld.registerChaos(0.75, this.police.heatLevel);
        if (esc && esc > this.police.heatLevel) {
          this.police.setHeat(esc, this.playerPhysics.position, this.city.waypoints);
          this.ui.showToast(`⭐ PROCURADO: ${esc} ESTRELA(S)!`);
        }
      }
    }

    // 4b. Update Career Open World (GTA-style Pay & Spray, Contraband Stashes, Speed Traps)
    let openWorldHud: OpenWorldHudState | undefined;
    let openWorldMarkers:
      | { paySprays: Array<{ x: number; z: number }>; stashes: Array<{ x: number; z: number }> }
      | undefined;

    if (this.currentMode === 'career_open_world' && this.openWorld.active) {
      const owEvents = this.openWorld.update(
        dt,
        this.playerPhysics.position,
        this.playerPhysics.speedKmh,
        this.police.heatLevel
      );
      openWorldHud = owEvents.hudState;

      if (owEvents.payAndSprayTriggered) {
        const hadHeat = this.police.heatLevel > 0;
        this.restorePlayerVehicleFull();
        if (hadHeat) {
          this.police.clearAll();
        }
        sound.playSuccessFanfare();
        this.ui.showToast(
          hadHeat
            ? '🔧 PAY & SPRAY: CARRO 100% REPARADO E FICHA LIMPA!'
            : '🔧 PAY & SPRAY: CARRO REPARADO E NITRO RECARREGADO!'
        );
      }

      if (owEvents.stashCollected) {
        this.profile.cash += 3500;
        this.profile.repPoints += 120;
        this.profile.openWorldStashes = (this.profile.openWorldStashes || 0) + 1;
        this.playerPhysics.driftScore += 1500;
        if (this.profile.repPoints >= this.profile.repLevel * 1000) {
          this.profile.repLevel++;
        }
        if (owEvents.allStashesCompleted) {
          this.profile.cash += 25000;
          sound.playSuccessFanfare();
          this.ui.showToast('🏆 TODOS OS 10 PACOTES COLETADOS! BÔNUS +R$ 25.000!');
        } else {
          sound.playCountdownBeep(true);
          this.ui.showToast(
            `📦 ${owEvents.stashCollected.label} (${this.openWorld.stashesCollected}/${this.openWorld.stashes.length}) +R$ 3.500!`
          );
        }
        this.ui.persistDurableProgress();
      }

      if (owEvents.speedTrapHit) {
        const { speedKmh, rewardCash } = owEvents.speedTrapHit;
        this.profile.cash += rewardCash;
        this.playerPhysics.driftScore += speedKmh * 5;
        sound.playCountdownBeep(true);
        this.ui.showToast(`📸 RADAR ${speedKmh} KM/H! +R$ ${rewardCash.toLocaleString()}`);
      }

      if (owEvents.escalateToHeat && owEvents.escalateToHeat > this.police.heatLevel) {
        this.police.setHeat(owEvents.escalateToHeat, this.playerPhysics.position, this.city.waypoints);
        this.ui.showToast(`⭐ PROCURADO: ${owEvents.escalateToHeat} ESTRELA(S)!`);
      }

      this._owPaySprayMarkers.length = 0;
      for (let i = 0; i < this.openWorld.payAndSprays.length; i++) {
        const ps = this.openWorld.payAndSprays[i];
        this._owPaySprayMarkers.push({ x: ps.position.x, z: ps.position.z });
      }
      this._owStashMarkers.length = 0;
      for (let i = 0; i < this.openWorld.stashes.length; i++) {
        const st = this.openWorld.stashes[i];
        if (!st.collected) {
          this._owStashMarkers.push({ x: st.position.x, z: st.position.z });
        }
      }
      openWorldMarkers = {
        paySprays: this._owPaySprayMarkers,
        stashes: this._owStashMarkers,
      };
    }

    // 5. Update 3D Mesh Transformations
    if (isNonCarMode) {
      if (this.playerVehicleMeshGroup) {
        if (this.transportRig.hasParkedCar) {
          this.playerVehicleMeshGroup.visible = true;
          this.playerVehicleMeshGroup.position.copy(this.transportRig.parkedCarPos);
          this.playerVehicleMeshGroup.rotation.set(0, this.transportRig.parkedCarHeading, 0);
          this.playerUpdateDamageEffects?.(0, 0, this.playerPhysics.missingWheels);
        } else {
          this.playerVehicleMeshGroup.visible = false;
        }
      }
      this.transportRig.updateVisuals(
        dt,
        this.playerPhysics.position,
        this.playerPhysics.heading,
        this.playerPhysics.speedKmh,
        this.playerPhysics.steerAngle,
        this.playerPhysics.isAirborne
      );
    } else if (this.playerVehicleMeshGroup) {
      this.playerVehicleMeshGroup.visible = true;
      this.playerVehicleMeshGroup.position.copy(this.playerPhysics.position);
      this.playerVehicleMeshGroup.rotation.y = this.playerPhysics.heading;

      // Chassis Roll and Pitch suspension tilts
      this.playerVehicleMeshGroup.rotation.z = this.playerPhysics.roll;
      this.playerVehicleMeshGroup.rotation.x = this.playerPhysics.pitch;

      // Rotate Visible Wheels
      const wheelRollAngle = (this.playerPhysics.speedKmh / 3.6) * dt * 8;
      this.playerWheels.forEach((wheel, idx) => {
        if (!wheel.visible) return;
        wheel.rotation.x += wheelRollAngle;
        // Front wheels turn visually with steer angle (-X is right, +X is left)
        if (idx === 0 || idx === 1) {
          wheel.rotation.y = -this.playerPhysics.steerAngle;
        }
      });

      // Dynamic Speed-Based Damage Effects (wind flutter, smoke, missing-wheel sparks)
      this.playerUpdateDamageEffects?.(
        dt,
        this.playerPhysics.speedKmh,
        this.playerPhysics.missingWheels
      );

      // Animate 3D Pilot & Co-Pilot inside the cockpit
      this.playerUpdateOccupants?.(
        dt,
        this.playerPhysics.steerAngle,
        this.playerPhysics.driftSlip,
        this.playerPhysics.speedKmh,
        null,
        0
      );
    }

    // Update nearby mountable prompt (GTA "[F] Entrar no Carro / Montar Moto")
    if (this.currentMode === 'career_open_world') {
      let nearLabel: string | null = null;
      if (this.transportRig.activeMode === 'foot') {
        const mount = this.transportRig.findNearestMountable(this.playerPhysics.position, 5.8);
        if (mount) {
          nearLabel =
            mount.type === 'car'
              ? 'Entrar no Carro'
              : `Montar ${OPEN_WORLD_TRANSPORTS[mount.mode].shortLabel}`;
        }
      }
      const uiKey = `${this.transportRig.activeMode}|${nearLabel ?? ''}`;
      if (uiKey !== this.lastTransportUiKey) {
        this.lastTransportUiKey = uiKey;
        this.ui.updateOpenWorldTransportUI(this.transportRig.activeMode, nearLabel);
      }
    }

    // 6. Camera Chase Logic with Exponential Damping (Zero allocations)
    const carHeading = this.playerPhysics.heading;
    const forwardX = Math.sin(carHeading);
    const forwardZ = Math.cos(carHeading);

    if (this.cameraMode === 'chase') {
      const speedDistanceStretch = isNonCarMode
        ? Math.min(1.6, (this.playerPhysics.speedKmh / 240) * 1.6)
        : Math.min(2.5, (this.playerPhysics.speedKmh / 250) * 2.5);
      const baseDist = isNonCarMode
        ? activeSpec.camDist * (this.isVerticalMode ? 1.18 : 1.0)
        : this.isVerticalMode
          ? 7.6
          : 6.2;
      const baseHeight = isNonCarMode
        ? activeSpec.camHeight * (this.isVerticalMode ? 1.08 : 1.0)
        : this.isVerticalMode
          ? 2.85
          : 2.4;
      const camDist = baseDist + speedDistanceStretch;
      const camHeight = baseHeight + (this.playerPhysics.speedKmh / 250) * (isNonCarMode ? 0.35 : 0.8);
      const lookAhead = isNonCarMode ? activeSpec.lookAhead : 4.0;
      const lookHeight = isNonCarMode
        ? activeSpec.lookHeight
        : this.isVerticalMode
          ? 1.35
          : 1.2;

      OutlawGameScene._targetCamPos.set(
        this.playerPhysics.position.x - forwardX * camDist,
        this.playerPhysics.position.y + camHeight,
        this.playerPhysics.position.z - forwardZ * camDist
      );

      OutlawGameScene._targetLook.set(
        this.playerPhysics.position.x + forwardX * lookAhead,
        this.playerPhysics.position.y + lookHeight,
        this.playerPhysics.position.z + forwardZ * lookAhead
      );
    } else {
      // Hood / First-Person Cam
      const fpHeight =
        this.transportRig.activeMode === 'foot'
          ? 1.56
          : isNonCarMode
            ? 1.42
            : 1.35;
      const fpForward = isNonCarMode ? 0.32 : 0.8;
      OutlawGameScene._targetCamPos.set(
        this.playerPhysics.position.x + forwardX * fpForward,
        this.playerPhysics.position.y + fpHeight,
        this.playerPhysics.position.z + forwardZ * fpForward
      );
      OutlawGameScene._targetLook.set(
        this.playerPhysics.position.x + forwardX * 25.0,
        this.playerPhysics.position.y + fpHeight - 0.15,
        this.playerPhysics.position.z + forwardZ * 25.0
      );
    }

    // Smoothly damp camera movement
    this.currentCameraPos.lerp(OutlawGameScene._targetCamPos, Math.min(1, dt * 10));
    this.camera.position.copy(this.currentCameraPos);
    this.cameraLookTarget.lerp(OutlawGameScene._targetLook, Math.min(1, dt * 12));
    this.camera.lookAt(this.cameraLookTarget);

    // Dynamic FOV kick on high speeds / nitro (wider baseline in vertical mode)
    const baseFov = this.isVerticalMode ? 69 : 60;
    const targetFOV = baseFov + (this.playerPhysics.speedKmh / 280) * 18 + (this.ui.controls.nitro ? 8 : 0);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFOV, 8, dt);
    this.camera.updateProjectionMatrix();

    // 7. Update Audio Synthesizer & Dynamic City Ambiance Layer
    const envAcoustics = this.city.getEnvironmentAcoustics(this.playerPhysics.position);
    sound.updateContinuousAudio(
      this.playerPhysics.speedKmh,
      this.playerPhysics.rpm,
      this.playerPhysics.driftSlip,
      this.ui.controls.nitro && this.playerPhysics.nitroReserve > 2,
      this.police.heatLevel,
      pursuitResult.closestCopDist,
      envAcoustics,
      this.currentMode === 'career_open_world' ? activeSpec.enginePitchMult : 1.0
    );

    // 8. Update HUD & Telemetry
    const copPositions = this.police.cops
      .filter((c) => !c.destroyed)
      .map((c) => ({ x: c.position.x, z: c.position.z }));

    this.ui.updateHUD(
      this.playerPhysics.speedKmh,
      isNonCarMode ? activeSpec.gearTag : this.playerPhysics.gear,
      this.playerPhysics.rpm,
      this.playerPhysics.nitroReserve,
      this.playerPhysics.health,
      this.police.heatLevel,
      pursuitResult.statusText,
      this.playerPhysics.isDrifting,
      this.playerPhysics.driftScore,
      this.playerPhysics.position.x,
      this.playerPhysics.position.z,
      copPositions,
      openWorldHud,
      openWorldMarkers
    );

    // 9. Real Online Multiplayer Telemetry Broadcast & Remote 3D Cars
    if (this.currentMode === 'multiplayer') {
      const progress = this.calculateTrackProgress(this.playerPhysics.position);
      this.mpManager.updateLocalTelemetry(
        this.playerPhysics.speedKmh,
        progress,
        1,
        0,
        this.playerPhysics.position.x,
        this.playerPhysics.position.y,
        this.playerPhysics.position.z,
        this.playerPhysics.heading,
        this.playerPhysics.driftScore
      );
      if (this.mpManager.currentRoom && networkStatus.isOnline) {
        this.syncRemotePlayers(this.mpManager.currentRoom.players, dt);
      } else if (this.remotePlayers.size > 0) {
        this.clearRemotePlayers();
      }
    } else if (this.remotePlayers.size > 0) {
      this.clearRemotePlayers();
    }

    // 10. Record Instant Replay Frame (30 Hz circular buffer)
    this.replay.recordFrame(
      dt,
      this.playerPhysics,
      this.police.cops,
      this.ui.controls.nitro && this.playerPhysics.nitroReserve > 2
    );

    // 11. Check Win / Loss / Bust conditions
    this.checkGameRules(pursuitResult.busted, pursuitResult.escaped, heatBeforePursuitUpdate);
  }

  private restorePlayerVehicleFull() {
    if (!this.playerPhysics) return;
    const armorBoost = 1 + (this.playerPhysics.config.levelArmor - 1) * 0.2;
    this.playerPhysics.health = 100 * armorBoost;
    this.playerPhysics.nitroReserve = 100;
    this.playerPhysics.missingWheels = [false, false, false, false];
    this.playerWheels.forEach((w) => {
      w.visible = true;
    });
    this.clearDetachedWheels();
    this.wheelLossCooldown = 0;
    this.playerResetDeform?.();
    this.playerUpdateDamageEffects?.(0, 0, this.playerPhysics.missingWheels);
  }

  private checkGameRules(isBusted: boolean, isEscaped: boolean, activeHeatBeforeUpdate: number = 0) {
    if (this.isEndingOutroCutscene || this.isOpenWorldBustedPaused) return;

    // Continuous GTA-style Open World Loop inside Career Mode
    if (this.currentMode === 'career_open_world') {
      if (this.playerPhysics.health <= 0 || isBusted) {
        const reason: 'busted' | 'wrecked' = this.playerPhysics.health <= 0 ? 'wrecked' : 'busted';
        if (reason === 'wrecked') this.playerPhysics.health = 0;
        this.isOpenWorldBustedPaused = true;
        const bailFee = Math.min(this.profile.cash, 1500);
        this.profile.cash = Math.max(0, this.profile.cash - bailFee);
        this.ui.persistDurableProgress();
        sound.stopAll();
        this.ui.showOpenWorldBustedModal(reason, bailFee, {
          escapes: this.openWorld.sessionEscapes,
          stashes: this.openWorld.stashesCollected,
          stashesTotal: this.openWorld.stashes.length,
        });
        return;
      }

      if (isEscaped) {
        const escapedStars = Math.max(1, activeHeatBeforeUpdate);
        const bonusCash = 4000 * escapedStars;
        const bonusRep = 150 * escapedStars;
        this.ui.achievements.recordEscape();
        this.profile.totalEscapes++;
        this.profile.openWorldEscapes = (this.profile.openWorldEscapes || 0) + 1;
        this.profile.openWorldMaxHeatEscaped = Math.max(
          this.profile.openWorldMaxHeatEscaped || 0,
          escapedStars
        );
        this.profile.cash += bonusCash;
        this.profile.repPoints += bonusRep;
        if (this.profile.repPoints >= this.profile.repLevel * 1000) {
          this.profile.repLevel++;
        }
        this.openWorld.onEscaped(escapedStars);
        this.ui.persistDurableProgress();
        sound.playSuccessFanfare();
        this.ui.showToast(
          `⭐ FUGA GTA (${escapedStars}★)! +R$ ${bonusCash.toLocaleString()} (+${bonusRep} RP) — Continue explorando!`
        );
      }
      return;
    }

    // Health zero = Wrecked
    if (this.playerPhysics.health <= 0) {
      this.playerPhysics.health = 0;
      this.endGameRound('busted', 'VEÍCULO TOTALMENTE DESTRUÍDO', 'Seu carro não aguentou os impactos das viaturas e bateu feio.', 500, 20);
      return;
    }

    if (isBusted) {
      this.endGameRound('busted', 'PRESO PELA POLÍCIA!', 'Você foi cercado e detido pelas viaturas do Capitão Ramos.', 1000, 50);
      return;
    }

    if (isEscaped) {
      this.ui.achievements.recordEscape();
      if (this.currentMode === 'story' && this.currentStoryChapter) {
        const chapter = this.currentStoryChapter;
        if (this.profile.storyChapter <= chapter.id) {
          this.profile.storyChapter++;
        }
        this.profile.totalEscapes++;
        this.isEndingOutroCutscene = true;
        this.police.clearAll();
        this.playerPhysics.velocity.set(0, 0, 0);
        this.playerPhysics.speedKmh = 0;
        sound.stopAll();
        void this.playFilmCutscene(chapter.dialogueOutro, `HISTÓRIA · FINAL DO CAPÍTULO ${chapter.id}`).then(() => {
          this.isEndingOutroCutscene = false;
          if (this.currentMode !== 'title') {
            this.endGameRound(
              'victory',
              'MISSÃO CUMPRIDA: FUGA BEM-SUCEDIDA!',
              'Você e Miguel escaparam com maestria do cerco policial!',
              chapter.rewardCash,
              chapter.rewardRep
            );
          }
        });
      } else if (this.currentMode === 'career') {
        this.profile.totalEscapes++;
        this.profile.careerWins++;
        this.isEndingOutroCutscene = true;
        this.police.clearAll();
        this.playerPhysics.velocity.set(0, 0, 0);
        this.playerPhysics.speedKmh = 0;
        sound.stopAll();
        const careerScenes = getCareerFilmCutscenes(
          this.profile.name,
          this.profile.nickname,
          this.profile.copilotName || 'Nina "Apex"',
          this.activeTrackConfig.name,
          this.profile.careerWins
        );
        void this.playFilmCutscene(careerScenes.outro, `CARREIRA · VITÓRIA DE COCKPIT`).then(() => {
          this.isEndingOutroCutscene = false;
          if (this.currentMode !== 'title') {
            this.endGameRound(
              'victory',
              'VITÓRIA NA CARREIRA!',
              `${this.profile.name} & ${this.profile.copilotName || 'Nina "Apex"'} dominaram ${this.activeTrackConfig.name}!`,
              18000,
              300
            );
          }
        });
      } else {
        this.profile.totalEscapes++;
        this.endGameRound(
          'escaped',
          'FUGA BEM-SUCEDIDA!',
          'A polícia perdeu o sinal de rastreamento. Você está livre!',
          12000,
          200
        );
      }
    }
  }

  private spawnOpenWorldStreetMotos() {
    if (!this.transportRig || this.city.waypoints.length === 0) return;
    const spots: Array<{ pos: THREE.Vector3; heading: number; mode: OpenWorldTransportMode }> = [];
    const motoPool: OpenWorldTransportMode[] = ['moto_street', 'moto_super', 'moto_cross'];

    // Spot 0: Parked right on the shoulder ahead of spawn so the player spots motorcycles immediately!
    const wpNear = this.city.waypoints[Math.min(1, this.city.waypoints.length - 1)];
    const rightX0 = Math.cos(wpNear.heading);
    const rightZ0 = -Math.sin(wpNear.heading);
    const p0 = new THREE.Vector3(
      wpNear.position.x + rightX0 * 4.8,
      0,
      wpNear.position.z + rightZ0 * 4.8
    );
    p0.y = this.city.getRoadElevation(p0, 0);
    spots.push({ pos: p0, heading: wpNear.heading, mode: 'moto_street' });

    // Spot 1: Second motorcycle slightly further ahead on opposite shoulder (Superbike)
    const wpSuper = this.city.waypoints[Math.min(3, this.city.waypoints.length - 1)];
    const rightX1 = Math.cos(wpSuper.heading);
    const rightZ1 = -Math.sin(wpSuper.heading);
    const p1 = new THREE.Vector3(
      wpSuper.position.x - rightX1 * 5.0,
      0,
      wpSuper.position.z - rightZ1 * 5.0
    );
    p1.y = this.city.getRoadElevation(p1, 0);
    spots.push({ pos: p1, heading: wpSuper.heading + Math.PI * 0.15, mode: 'moto_super' });

    // Spots outside Pay & Spray garages across the open world map
    this.openWorld.payAndSprays.forEach((ps, idx) => {
      const p = new THREE.Vector3(ps.position.x + 6.2, 0, ps.position.z + 2.5);
      p.y = this.city.getRoadElevation(p, 0);
      spots.push({
        pos: p,
        heading: idx * 1.1,
        mode: motoPool[(idx + 2) % motoPool.length],
      });
    });

    this.transportRig.populateStreetMotorcycles(spots);
  }

  private switchOpenWorldTransport(
    mode: OpenWorldTransportMode,
    silent: boolean = false,
    mountAt?: {
      position: THREE.Vector3;
      heading: number;
      streetMotoIndex?: number;
    }
  ) {
    if (!this.transportRig || !this.playerPhysics) return;
    const prevMode = this.transportRig.activeMode;

    if (prevMode !== mode && prevMode !== 'foot') {
      this.lastVehicleMode = prevMode;
    }

    // Leave player's car parked cleanly at its spot with a glowing beacon
    if (prevMode === 'car' && mode !== 'car') {
      this.transportRig.markParkedCar(this.playerPhysics.position, this.playerPhysics.heading);
      if (this.playerVehicleMeshGroup) {
        this.playerVehicleMeshGroup.visible = true;
        this.playerVehicleMeshGroup.position.copy(this.transportRig.parkedCarPos);
        this.playerVehicleMeshGroup.rotation.set(0, this.transportRig.parkedCarHeading, 0);
      }
    }

    // Entering a specific parked street motorcycle removes that parked prop from the curb
    if (mountAt && typeof mountAt.streetMotoIndex === 'number') {
      const targetMoto = this.transportRig.parkedStreetMotos[mountAt.streetMotoIndex];
      if (targetMoto) {
        targetMoto.group.removeFromParent();
        this.transportRig.parkedStreetMotos.splice(mountAt.streetMotoIndex, 1);
      }
    }

    if (mountAt) {
      this.playerPhysics.position.copy(mountAt.position);
      this.playerPhysics.heading = mountAt.heading;
    }

    if (mode === 'car') {
      this.transportRig.clearParkedCarMarker();
      if (this.playerVehicleMeshGroup) {
        this.playerVehicleMeshGroup.visible = true;
      }
    } else if (prevMode !== 'foot' && mode === 'foot' && !silent) {
      // Step out to the left side of the vehicle so the player stands clearly beside it
      const rightX = Math.cos(this.playerPhysics.heading);
      const rightZ = -Math.sin(this.playerPhysics.heading);
      this.playerPhysics.position.x -= rightX * 1.9;
      this.playerPhysics.position.z -= rightZ * 1.9;
      this.playerPhysics.position.y = this.city.getRoadElevation(
        this.playerPhysics.position,
        this.playerPhysics.position.y
      );
    }

    this.playerPhysics.velocity.set(0, 0, 0);
    this.playerPhysics.speedKmh = 0;
    this.playerPhysics.angularVelocity = 0;
    this.playerPhysics.pitch = 0;
    this.playerPhysics.roll = 0;
    this.playerPhysics.steerAngle = 0;

    this.transportRig.setMode(mode);
    this.transportRig.updateVisuals(
      0,
      this.playerPhysics.position,
      this.playerPhysics.heading,
      0,
      0,
      false
    );

    this.lastTransportUiKey = '';
    if (this.currentMode !== 'title') {
      this.ui.updateOpenWorldTransportUI(mode, null);
    }

    if (!silent) {
      sound.ensureRunning();
      const spec = OPEN_WORLD_TRANSPORTS[mode];
      if (spec.isMotorized) {
        sound.playWrenchToolSound();
      } else {
        sound.playCountdownBeep(false);
      }
      if (spec.isMotorcycle) {
        this.ui.showToast(
          `${spec.icon} ${spec.label} pronta! Segure Nitro/Espaço para empinar (Grau)!`
        );
      } else if (mode === 'foot') {
        this.ui.showToast('🚶 Modo A Pé! Pressione [F] perto de carros/motos para montar.');
      } else if (mode === 'skateboard') {
        this.ui.showToast('🛹 Skate Street! Use Espaço para mandar Ollie & Kickflip!');
      } else if (mode === 'bicycle') {
        this.ui.showToast('🚲 Bicicleta Urbana! Pressione Espaço para saltar e Nitro para sprint.');
      } else {
        this.ui.showToast('🚗 De volta ao seu carro da garagem!');
      }
    }
  }

  private handleToggleEnterExitVehicle() {
    if (
      this.currentMode === 'title' ||
      this.isOpenWorldBustedPaused ||
      this.ui.isPaused ||
      this.filmDirector.active
    ) {
      return;
    }

    if (this.transportRig.activeMode !== 'foot') {
      this.lastVehicleMode = this.transportRig.activeMode;
      this.switchOpenWorldTransport('foot', false);
      return;
    }

    const mount = this.transportRig.findNearestMountable(this.playerPhysics.position, 5.8);
    if (mount) {
      this.switchOpenWorldTransport(mount.mode, false, mount);
      return;
    }

    const quickTarget: OpenWorldTransportMode =
      this.lastVehicleMode !== 'car' ? this.lastVehicleMode : 'car';
    this.switchOpenWorldTransport(quickTarget, false);
  }

  private handleLocationInteraction() {
    const dummyState = {
      health: this.playerPhysics.health,
      nitroReserve: this.playerPhysics.nitroReserve,
      cash: this.profile.cash,
      rep: this.profile.repPoints,
    };
    const res = this.city.accessibleLocations.triggerLocationInteraction(
      this.playerPhysics.position,
      dummyState
    );
    if (res.handled) {
      if (res.teleportPos) {
        this.playerPhysics.position.copy(res.teleportPos);
        if (res.teleportHeading !== undefined) {
          this.playerPhysics.heading = res.teleportHeading;
        }
        this.playerPhysics.velocity.set(0, 0, 0);
        this.playerPhysics.speedKmh = 0;
      }
      this.playerPhysics.health = dummyState.health;
      this.playerPhysics.nitroReserve = dummyState.nitroReserve;
      if (dummyState.health >= 100) {
        this.restorePlayerVehicleFull();
      }
      this.ui.showToast(res.toastText);
    } else {
      const prox = this.city.accessibleLocations.checkPlayerProximity(this.playerPhysics.position);
      if (prox.isInside && prox.location) {
        this.ui.showToast(`📍 ${prox.location.name}`);
      }
    }
  }

  private endGameRound(type: 'escaped' | 'busted' | 'victory', title: string, desc: string, cash: number, rep: number) {
    this.currentMode = 'title';
    this.switchOpenWorldTransport('car', true);
    this.transportRig.clearParkedCarMarker();
    this.transportRig.clearStreetMotorcycles();
    this.openWorld.clear();
    this.police.clearAll();
    sound.stopAll();
    this.ui.showGameResultModal(type, title, desc, cash, rep);
  }

  private findNearestWaypoint(pos: THREE.Vector3) {
    let nearest = this.city.waypoints[0];
    let minD = 9999;
    for (const wp of this.city.waypoints) {
      const d = wp.position.distanceTo(pos);
      if (d < minD) {
        minD = d;
        nearest = wp;
      }
    }
    return nearest || { position: new THREE.Vector3(0, 0, 0), heading: 0 };
  }

  private worldDirToLocal(worldDir: THREE.Vector3, heading: number, out: THREE.Vector3) {
    const sinH = Math.sin(heading);
    const cosH = Math.cos(heading);
    out.set(worldDir.x * cosH - worldDir.z * sinH, 0, worldDir.x * sinH + worldDir.z * cosH);
    if (out.lengthSq() > 0.0001) out.normalize();
  }

  private maybeDetachWheel(
    localHitDir: THREE.Vector3,
    impactSpeedMs: number,
    forceLoss: boolean = false
  ) {
    if (this.wheelLossCooldown > 0) return;

    const missingCount = this.playerPhysics.missingWheels.filter(Boolean).length;
    const isCornerOrSideHit = Math.abs(localHitDir.x) > 0.25;
    const shouldDetach =
      forceLoss ||
      (impactSpeedMs >= 21 && isCornerOrSideHit) ||
      impactSpeedMs >= 28 ||
      (missingCount === 0 && this.playerPhysics.health < 62 && impactSpeedMs >= 13);

    if (!shouldDetach) return;

    const isFront = localHitDir.z >= -0.05;
    const isPlusX = localHitDir.x >= 0;
    const preferredIdx = (isFront ? 0 : 2) + (isPlusX ? 1 : 0);

    const lostIdx = this.playerPhysics.triggerWheelLoss(preferredIdx);
    if (lostIdx < 0) return;

    this.wheelLossCooldown = 3.5;

    // Spawn loose tumbling wheel flying off the struck corner
    const sourceWheel = this.playerWheels[lostIdx];
    if (sourceWheel) {
      sourceWheel.getWorldPosition(OutlawGameScene._wheelWorldPos);
      const looseWheel = sourceWheel.clone();
      looseWheel.visible = true;
      looseWheel.position.copy(OutlawGameScene._wheelWorldPos);
      this.scene.add(looseWheel);

      const sideSign = lostIdx === 1 || lostIdx === 3 ? 1 : -1;
      const rightX = Math.cos(this.playerPhysics.heading);
      const rightZ = -Math.sin(this.playerPhysics.heading);
      const vel = new THREE.Vector3(
        this.playerPhysics.velocity.x * 0.65 + rightX * sideSign * 6.5,
        4.5 + Math.random() * 2.5,
        this.playerPhysics.velocity.z * 0.65 + rightZ * sideSign * 6.5
      );
      this.detachedWheels.push({
        mesh: looseWheel,
        vel,
        rotVel: new THREE.Vector3(10, (Math.random() - 0.5) * 8, sideSign * 5),
        life: 3.5,
      });
    }

    this.ui.showToast('⚠️ RODA ARRANCADA! O carro está puxando para o lado sem roda!');
  }

  private updateDetachedWheels(dt: number) {
    for (let i = this.detachedWheels.length - 1; i >= 0; i--) {
      const w = this.detachedWheels[i];
      w.life -= dt;
      if (w.life <= 0) {
        this.scene.remove(w.mesh);
        this.detachedWheels.splice(i, 1);
        continue;
      }
      w.vel.y -= 20 * dt;
      w.mesh.position.addScaledVector(w.vel, dt);
      if (w.mesh.position.y < 0.36) {
        w.mesh.position.y = 0.36;
        w.vel.y = Math.abs(w.vel.y) * 0.48;
        w.vel.x *= 0.86;
        w.vel.z *= 0.86;
      }
      w.mesh.rotation.x += w.rotVel.x * dt;
      w.mesh.rotation.y += w.rotVel.y * dt;
      w.mesh.rotation.z += w.rotVel.z * dt;
    }
  }

  private clearDetachedWheels() {
    for (const w of this.detachedWheels) {
      this.scene.remove(w.mesh);
    }
    this.detachedWheels = [];
  }

  private calculateTrackProgress(pos: THREE.Vector3): number {
    if (this.city.waypoints.length === 0) return 0;
    let closestIdx = 0;
    let minD = 9999;
    for (let i = 0; i < this.city.waypoints.length; i++) {
      const d = this.city.waypoints[i].position.distanceTo(pos);
      if (d < minD) {
        minD = d;
        closestIdx = i;
      }
    }
    return closestIdx / this.city.waypoints.length;
  }

  private syncRemotePlayers(players: MultiplayerPlayer[], dt: number) {
    const activeIds = new Set<string>();
    const startWp = this.city.waypoints[0]?.position || new THREE.Vector3(0, 0, 0);

    let slotIdx = 0;
    for (const p of players) {
      if (p.isLocal) continue;
      activeIds.add(p.id);
      slotIdx++;

      let remote = this.remotePlayers.get(p.id);
      const carId = p.carId || 'car_viper';
      if (!remote || remote.carId !== carId || remote.carColor !== p.carColor) {
        if (remote) {
          this.scene.remove(remote.group);
        }
        const baseConfig = DEFAULT_VEHICLES.find((v) => v.id === carId) || DEFAULT_VEHICLES[0];
        const cfg: VehicleConfig = { ...baseConfig, color: p.carColor || baseConfig.color };
        const meshData = VehicleMeshBuilder.createVehicleGroup(cfg, false);
        const initX = typeof p.x === 'number' && (p.x !== 0 || p.z !== 0) ? p.x : startWp.x + (slotIdx % 2 === 0 ? -3.5 : 3.5);
        const initY = typeof p.y === 'number' ? p.y : startWp.y;
        const initZ = typeof p.z === 'number' && (p.x !== 0 || p.z !== 0) ? p.z : startWp.z - slotIdx * 5;
        meshData.group.position.set(initX, initY, initZ);
        meshData.group.rotation.y = p.heading || 0;
        this.scene.add(meshData.group);

        remote = {
          group: meshData.group,
          targetPos: new THREE.Vector3(initX, initY, initZ),
          targetHeading: p.heading || 0,
          carId,
          carColor: p.carColor,
        };
        this.remotePlayers.set(p.id, remote);
      }

      if (typeof p.x === 'number' && typeof p.z === 'number' && (p.x !== 0 || p.z !== 0 || p.currentSpeed > 0)) {
        remote.targetPos.set(p.x, p.y || 0, p.z);
        remote.targetHeading = p.heading || 0;
      }

      remote.group.position.lerp(remote.targetPos, Math.min(1, dt * 12));
      const diff = Math.atan2(
        Math.sin(remote.targetHeading - remote.group.rotation.y),
        Math.cos(remote.targetHeading - remote.group.rotation.y)
      );
      remote.group.rotation.y += diff * Math.min(1, dt * 12);
    }

    for (const [id, remote] of this.remotePlayers.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(remote.group);
        this.remotePlayers.delete(id);
      }
    }
  }

  private clearRemotePlayers() {
    for (const remote of this.remotePlayers.values()) {
      this.scene.remove(remote.group);
    }
    this.remotePlayers.clear();
  }

  dispose() {
    sound.stopAll();
    this.filmDirector.stop();
    this.transportRig?.dispose();
    this.openWorld?.dispose();
    this.replay?.dispose();
    this.npcs?.dispose();
    this.traffic?.dispose();
    this.clearDetachedWheels();
    this.clearRemotePlayers();
  }
}

// App Entry Point
document.addEventListener('DOMContentLoaded', () => {
  const options = new xb.Options();
  options.setAppTitle('THE LINE OF DRIFT');
  options.setAppDescription('O melhor jogo de Drift e perseguição que você vai ver!');

  xb.add(new OutlawGameScene());
  xb.init(options);
});
