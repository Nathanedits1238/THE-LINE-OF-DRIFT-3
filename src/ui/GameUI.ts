import { AchievementSystem } from '../achievements/AchievementSystem';
import { sound } from '../audio/SoundEffects';
import { OpenWorldHudState } from '../career/OpenWorldManager';
import {
  CAREER_ATTRIBUTE_BUDGET,
  DEFAULT_CAREER_CHARACTER,
  DEFAULT_CHALLENGES,
  DEFAULT_TRACKS,
  DEFAULT_VEHICLES,
} from '../data/GameData';
import { DeviceSpecs } from '../graphics/DeviceBenchmark';
import { MultiplayerRoomManager } from '../multiplayer/MultiplayerRoom';
import {
  AuthUserProfile,
  getCurrentUserProfile,
  googleSignIn,
  googleSignOut,
  initAuth,
} from '../services/firebaseAuth';
import { GameSaveData, GoogleDriveSaveService } from '../services/googleDriveSave';
import { GlobalRacerEntry, GoogleSheetsRankingService } from '../services/googleSheetsRanking';
import { networkStatus } from '../services/networkStatus';
import { SmartphoneSystem } from '../smartphone/SmartphoneSystem';
import { CAREER_COPILOTS, STORY_CHAPTERS, STORY_ENDINGS } from '../story/StoryData';
import {
  AchievementCategory,
  AchievementDefinition,
  CareerCharacterAppearance,
  CareerCharacterConfig,
  CareerCharacterStats,
  CharacterProfile,
  DialogueLine,
  GameDifficulty,
  GameMode,
  GraphicsQuality,
  HudControlStyle,
  LeaderboardEntry,
  OpenWorldTransportMode,
  OrientationMode,
  PlayerControls,
  StoryChapter,
  StoryEndingId,
  TimeOfDay,
  TrackConfig,
  VehicleConfig,
  WeatherType,
} from '../types';
import { DayNightClockInfo } from '../weather/DynamicWeatherSystem';

export class GameUI {
  public root: HTMLElement;
  public deviceSpecs?: DeviceSpecs;
  public controls: PlayerControls = {
    throttle: 0,
    brake: 0,
    steer: 0,
    handbrake: false,
    nitro: false,
    resetVehicle: false,
    switchCamera: false,
  };

  // State
  public currentMode: GameMode = 'title';
  public quality: GraphicsQuality = 'high';
  public weather: WeatherType = 'rain'; // default rainy/night city
  public timeOfDay: TimeOfDay = 'night';
  public gyroActive: boolean = false;
  private gyroPermitted: boolean = false;
  public orientationMode: OrientationMode = 'horizontal';
  public isPaused: boolean = false;
  public isReplayActive: boolean = false;

  // Google Authentication & Cloud Save State
  public googleUser: AuthUserProfile | null = null;
  public onCloudSaveRestored?: (saveData: GameSaveData) => void;
  private authUnsubscribe?: () => void;

  // Callbacks to main game
  public onStartMode?: (mode: GameMode, chapter?: StoryChapter, trackId?: string) => void;
  public onApplySettings?: (quality: GraphicsQuality, weather: WeatherType, timeOfDay: TimeOfDay) => void;
  public onVehicleChanged?: (vehicle: VehicleConfig) => void;
  public onTrackChanged?: (track: TrackConfig) => void;
  public onPlayCinematicScene?: (type: 'purchase' | 'upgrade' | 'paint' | 'neon', vehicle: VehicleConfig, detailText: string) => void;
  public onDifficultyChanged?: (diff: GameDifficulty) => void;
  public onOrientationChanged?: (mode: OrientationMode, effectiveIsVertical: boolean) => void;
  public onPauseChanged?: (paused: boolean) => void;
  public onRestartMode?: () => void;
  public onOpenReplay?: (source: 'pause' | 'result' | 'title') => void;
  public onReplayAction?: (
    action: 'play_pause' | 'seek' | 'speed' | 'camera' | 'restart' | 'close',
    value?: number | string
  ) => void;
  public hasReplayAvailable?: () => boolean;
  public onOpenWorldBailRespawn?: () => void;
  public onSelectOpenWorldTransport?: (mode: OpenWorldTransportMode) => void;
  public onToggleEnterExitVehicle?: () => void;
  public onInteractLocation?: () => void;
  public onCycleWeather?: () => void;
  public onSmartphoneFastTravel?: (coords: { x: number; y: number; z: number; heading?: number }) => void;
  public onSmartphoneSetWeather?: (weather: WeatherType) => void;
  public onSmartphoneSpawnCar?: (carId: string) => void;
  public onSmartphoneOpenChanged?: (open: boolean) => void;

  // In-Game Smartphone System
  public smartphone: SmartphoneSystem;

  // Active dialogue / film cutscene state
  private activeDialogueLines: DialogueLine[] = [];
  private dialogueIndex: number = 0;
  private dialogueResolve?: () => void;
  private dialogueOptions: {
    isFilmScene?: boolean;
    filmBadge?: string;
    onLineChange?: (line: DialogueLine, index: number) => void;
  } = {};
  private static readonly GAME_COVER_URL = '/assets/aistudio/1795732406388_015ad713.jpg';
  private static readonly GAME_BANNER_URL = '/assets/aistudio/1795732412848_f9cc8f19.jpg';
  private static readonly GAME_LOGO_URL = '/assets/aistudio/1795732487333_55b4f9ac.jpg';
  private static readonly WORLD_MAP_URL = '/assets/aistudio/1795733062242_b5391972.jpg';
  private static readonly ALAN_TUTORIAL_AUDIO = {
    intro: '/assets/aistudio/ElevenLabs_2026-11-26T23_03_36_Johnny_Lukien_gen_s50_sim75_v4_10f4f7eb.mp3',
    followSteps: '/assets/aistudio/ElevenLabs_2026-11-26T23_04_57_Johnny_Lukien_gen_s50_sim75_v4_3b02e440.mp3',
    finished: '/assets/aistudio/ElevenLabs_2026-11-26T23_05_40_Johnny_Lukien_gen_s50_sim75_v4_81b62590.mp3',
    cloudSaveTip: '/assets/aistudio/ElevenLabs_2026-11-26T23_06_54_Johnny_Lukien_gen_s50_sim75_v4_d4f6dad3.mp3',
  } as const;

  // Cached DOM elements for 60FPS HUD updates
  private cachedHud: {
    speedEl: HTMLElement | null;
    gearEl: HTMLElement | null;
    rpmFill: HTMLElement | null;
    nitroFill: HTMLElement | null;
    healthFill: HTMLElement | null;
    heatStarsEl: HTMLElement | null;
    statusEl: HTMLElement | null;
    driftBadge: HTMLElement | null;
    driftPointsEl: HTMLElement | null;
    minimapCanvas: HTMLCanvasElement | null;
    minimapCtx: CanvasRenderingContext2D | null;
    roomRankingBox: HTMLElement | null;
    roomEntries: HTMLElement | null;
    offroadWarningEl: HTMLElement | null;
    offroadRateEl: HTMLElement | null;
    openWorldBox: HTMLElement | null;
    districtEl: HTMLElement | null;
    stashCountEl: HTMLElement | null;
    paySprayEl: HTMLElement | null;
    owMountPromptEl: HTMLElement | null;
    weatherRainLayer: HTMLElement | null;
    weatherFogLayer: HTMLElement | null;
    weatherLightningFlash: HTMLElement | null;
    weatherBadgeEl: HTMLElement | null;
    toggleVehicleBtnEl: HTMLElement | null;
    locationPromptEl: HTMLElement | null;
    locationIconEl: HTMLElement | null;
    locationNameEl: HTMLElement | null;
    locationDescEl: HTMLElement | null;
    locationActionBtnEl: HTMLElement | null;
    touchInteractBtnEl: HTMLElement | null;
  } | null = null;
  private cachedReplayHud: {
    speedEl: HTMLElement | null;
    driftEl: HTMLElement | null;
    timeEl: HTMLElement | null;
    scrubberEl: HTMLInputElement | null;
    playBtn: HTMLElement | null;
  } | null = null;
  private minimapFrameSkip: number = 0;
  private static readonly STAR_STRINGS = ['☆☆☆☆☆', '★☆☆☆☆', '★★☆☆☆', '★★★☆☆', '★★★★☆', '★★★★★'];

  // Entry screen vs Main menu state
  private hasEnteredMainMenu: boolean = false;
  private activeTouchCleanup?: () => void;

  // Interactive Step-by-Step Tutorial State
  private tutorialActive: boolean = false;
  private tutorialStepIndex: number = 0;
  private tutorialCompletedBannerShown: boolean = false;
  private googleVeteranBypassed: boolean = false;
  private tutorialMetrics = {
    gasHoldSec: 0,
    steeredLeftSec: 0,
    steeredRightSec: 0,
    driftOrBrakeSec: 0,
    nitroHoldSec: 0,
    switchedCameraOrFoot: false,
    openedPhoneOrLocation: false,
  };
  private tutorialLastTransportMode: OpenWorldTransportMode = 'car';
  private alanVoiceCaption: string = 'Fala jogador! Eu me chamo Alan, e vou te ensinar a jogar o Grand Proved It.';
  private alanVoiceSpeaking: boolean = false;

  private static readonly HUD_CONTROL_OPTIONS: Array<{
    id: HudControlStyle;
    title: string;
    badge: string;
    desc: string;
  }> = [
    {
      id: 'classic',
      title: 'Clássico The Line',
      badge: 'PADRÃO',
      desc: 'Setas ◀ ▶ na esquerda · Pedais Acelerar/Freio, Drift e Nitro à direita.',
    },
    {
      id: 'nfs_tap',
      title: 'Estilo Need for Speed (Toque na Tela)',
      badge: 'NFS ANDROID',
      desc: 'Toque na metade esquerda ou direita da tela para virar · Aceleração automática + Nitro e Drift à direita.',
    },
    {
      id: 'nfs_pedals',
      title: 'Estilo Asphalt / Cantos Divididos',
      badge: 'ARCADE SPLIT',
      desc: '◀ e Freio/Ré no canto esquerdo · ▶, Pedal vertical de Acelerador, Drift e Nitro no canto direito.',
    },
    {
      id: 'joystick',
      title: 'Joystick Analógico 360°',
      badge: 'ANALÓGICO',
      desc: 'Analógico virtual suave para curvas precisas à esquerda · Pedais e Nitro arcade à direita.',
    },
    {
      id: 'auto_gas',
      title: 'Piloto Automático (Foco em Drift)',
      badge: 'AUTO-GÁS',
      desc: 'O carro acelera sozinho! Use apenas ◀ ▶ grandes, 🛑 Drift, Freio/Ré e ⚡ Nitro.',
    },
  ];

  // Achievements System & Custom Unlock Toast Queue
  public achievements: AchievementSystem = new AchievementSystem();
  private achievementToastQueue: AchievementDefinition[] = [];
  private isShowingAchievementToast: boolean = false;
  private hasPendingDurableSave: boolean = false;
  private unsubscribeConnectivity?: () => void;
  private static readonly DURABLE_SAVE_KEY = 'tlod_durable_save_v1';

  constructor(
    public profile: CharacterProfile,
    public mpManager: MultiplayerRoomManager
  ) {
    this.root = document.createElement('div');
    this.root.id = 'GameUIRoot';
    this.root.className = 'game-ui-container';
    document.body.appendChild(this.root);

    // Restore any prior durable save made while online (read-only on boot)
    this.loadDurableSaveSnapshot();
    this.achievements.setPersistenceEnabled(networkStatus.isOnline);

    this.achievements.syncProfileCounts(
      this.profile.copsDestroyed,
      this.profile.totalEscapes,
      DEFAULT_VEHICLES.filter((v) => v.unlocked).length,
      0
    );
    this.achievements.onAchievementUnlocked = (ach) => this.handleAchievementUnlocked(ach);

    // Initialize Smartphone System
    this.smartphone = new SmartphoneSystem(this.profile, {
      onFastTravel: (coords) => this.onSmartphoneFastTravel?.(coords),
      onSetWeather: (w) => this.onSmartphoneSetWeather?.(w),
      onCashBonus: () => this.persistDurableProgress(),
      onRepBonus: () => this.persistDurableProgress(),
      onShowToast: (msg) => this.showToast(msg),
      onSpawnCar: (carId) => this.onSmartphoneSpawnCar?.(carId),
      onOpenStateChanged: (open) => {
        if (open) {
          this.resetDrivingControls();
          this.notifyTutorialAction('phone_open');
        }
        this.onSmartphoneOpenChanged?.(open);
      },
    });

    this.setupKeyboardListeners();
    this.setupGyroscope();
    window.addEventListener('resize', () => this.applyOrientationClass());
    window.addEventListener('orientationchange', () => this.applyOrientationClass());
    window.visualViewport?.addEventListener('resize', () => this.applyOrientationClass());
    this.applyOrientationClass();

    this.unsubscribeConnectivity = networkStatus.subscribe((online) => {
      this.handleConnectivityChange(online);
    });

    this.authUnsubscribe = initAuth((_user, _token) => {
      this.googleUser = getCurrentUserProfile();
      if (this.googleUser?.displayName && this.profile.name === 'Piloto Fugitivo') {
        this.profile.name = this.googleUser.displayName;
      }
      if (this.googleUser) {
        this.handleGoogleVeteranBypass(false);
      }
      if (this.currentMode === 'title') {
        this.refreshActiveMenuScreen(true);
      }
    });

    this.renderEntryScreen();
  }

  private loadDurableSaveSnapshot() {
    try {
      const raw = localStorage.getItem(GameUI.DURABLE_SAVE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<GameSaveData>;
      if (parsed.profile) {
        Object.assign(this.profile, parsed.profile);
        this.profile.careerCharacter = this.normalizeCareerCharacter(parsed.profile.careerCharacter);
      }
      if (Array.isArray(parsed.vehicles)) {
        for (const savedV of parsed.vehicles) {
          const target = DEFAULT_VEHICLES.find((v) => v.id === savedV.id);
          if (target) Object.assign(target, savedV);
        }
      }
      if (Array.isArray(parsed.tracks)) {
        for (const savedT of parsed.tracks) {
          const target = DEFAULT_TRACKS.find((t) => t.id === savedT.id);
          if (target) Object.assign(target, savedT);
        }
      }
      if (Array.isArray(parsed.challenges)) {
        for (const savedC of parsed.challenges) {
          const target = DEFAULT_CHALLENGES.find((c) => c.id === savedC.id);
          if (target) Object.assign(target, savedC);
        }
      }
    } catch {
      // Ignore malformed local save
    }
  }

  public persistDurableProgress(forceServerSync: boolean = false) {
    if (!networkStatus.isOnline) {
      this.hasPendingDurableSave = true;
      return;
    }
    this.hasPendingDurableSave = false;

    const payload: GameSaveData = {
      version: 2,
      savedAt: Date.now(),
      savedAtFormatted: new Date().toLocaleString('pt-BR'),
      pilotName: this.profile.name,
      googleUserEmail: this.googleUser?.email || null,
      profile: { ...this.profile },
      vehicles: DEFAULT_VEHICLES.map((v) => ({ ...v })),
      tracks: DEFAULT_TRACKS.map((t) => ({ ...t })),
      challenges: DEFAULT_CHALLENGES.map((c) => ({ ...c })),
      achievementData: this.achievements.exportData(),
    };

    try {
      localStorage.setItem(GameUI.DURABLE_SAVE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }

    this.achievements.flushDurableSave();

    if (forceServerSync || this.googleUser?.uid || this.mpManager.localPlayerId) {
      const playerKey = this.googleUser?.uid || this.mpManager.localPlayerId;
      void fetch(`/api/save/${encodeURIComponent(playerKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
  }

  private handleConnectivityChange(isOnline: boolean) {
    this.achievements.setPersistenceEnabled(isOnline);

    if (isOnline) {
      const hadUnsaved = this.hasPendingDurableSave || this.achievements.hasPendingDurableSave;
      if (hadUnsaved) {
        this.persistDurableProgress(true);
        this.showToast('🌐 Wi-Fi / Dados conectados! Servidores online ativos e progresso salvo de forma duradoura.');
      } else {
        this.showToast('🟢 Conexão online restabelecida! Multiplayer e Ranking Global liberados.');
      }
    } else {
      if (this.currentMode === 'multiplayer') {
        this.mpManager.leaveRoom();
        this.currentMode = 'title';
        this.renderTitleScreen();
        this.showToast('🔴 Sem Wi-Fi / Dados Móveis! Multiplayer desconectado — usando apenas modos offline.');
      } else {
        this.showToast('🔴 Sem Wi-Fi / Dados Móveis! Modos offline ativos — progresso não será salvo duradouramente até reconectar.');
      }
    }

    if (this.currentMode === 'title') {
      this.refreshActiveMenuScreen(true);
    } else {
      const netBadge = document.getElementById('hudNetBadge');
      if (netBadge) {
        netBadge.className = `hud-net-badge ${isOnline ? 'is-online' : 'is-offline'}`;
        netBadge.innerText = isOnline ? '🟢 ONLINE' : '🔴 OFFLINE (SEM SALVAMENTO)';
      }
    }
  }

  public isEffectiveVertical(): boolean {
    if (this.orientationMode === 'vertical') return true;
    if (this.orientationMode === 'horizontal') return false;
    return window.innerHeight > window.innerWidth;
  }

  public setOrientationMode(mode: OrientationMode) {
    this.orientationMode = mode;
    this.applyOrientationClass();

    // Best-effort native mobile orientation lock when supported
    try {
      const scrOrient = screen.orientation as unknown as {
        lock?: (o: string) => Promise<void>;
        unlock?: () => void;
      };
      if (scrOrient) {
        if (mode === 'horizontal' && typeof scrOrient.lock === 'function') {
          void scrOrient.lock('landscape').catch(() => {});
        } else if (mode === 'vertical' && typeof scrOrient.lock === 'function') {
          void scrOrient.lock('portrait').catch(() => {});
        } else if (mode === 'auto' && typeof scrOrient.unlock === 'function') {
          scrOrient.unlock();
        }
      }
    } catch {
      // Desktop / iframe environments handle layout cleanly via CSS mode classes
    }
  }

  public toggleHorizontalVertical() {
    const nextMode: OrientationMode = this.isEffectiveVertical() ? 'horizontal' : 'vertical';
    this.setOrientationMode(nextMode);
    this.showToast(
      nextMode === 'vertical' ? '📲 Modo Vertical (Retrato) ativado!' : '↔️ Modo Horizontal (Paisagem) ativado!'
    );
  }

  public applyOrientationClass() {
    const isVert = this.isEffectiveVertical();
    document.body.classList.toggle('mode-vertical', isVert);
    document.body.classList.toggle('mode-horizontal', !isVert);
    document.body.setAttribute('data-orientation-pref', this.orientationMode);

    const hudBtn = document.getElementById('hudOrientationBtn');
    if (hudBtn) {
      hudBtn.innerText = isVert ? '📲 VERT' : '↔️ HORIZ';
    }
    const menuBtn = document.getElementById('btnToggleOrientation');
    if (menuBtn) {
      menuBtn.innerText = isVert ? '📲 Modo: Vertical' : '↔️ Modo: Horizontal';
    }

    this.applyDynamicHudScale();
    this.onOrientationChanged?.(this.orientationMode, isVert);
  }

  public applyDynamicHudScale() {
    const isVert = this.isEffectiveVertical();
    const rawW = window.visualViewport?.width || window.innerWidth || 1280;
    const rawH = window.visualViewport?.height || window.innerHeight || 720;
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);

    const hudW = isVert ? Math.min(rawW, 480) : rawW;
    const hudH = rawH;
    const aspect = hudW / Math.max(1, hudH);

    // Subtle DPR legibility compensation for high-density compact displays
    const dprComp = dpr >= 2.25 && Math.min(hudW, hudH) < 420 ? 1.05 : dpr >= 2 ? 1.02 : 1.0;

    // Ergonomic edge inset on ultra-wide screens (prevents stretched corner HUD)
    const edgeX =
      !isVert && aspect > 2.02
        ? Math.round(Math.min(220, Math.max(22, (hudW - hudH * 1.92) * 0.36)))
        : hudW < 420
          ? 10
          : hudW < 680
            ? 14
            : 20;
    const edgeY = hudH < 430 ? 8 : 14;

    let topScale = isVert
      ? Math.max(0.76, Math.min(1.0, (hudW / 420) * dprComp))
      : Math.max(0.74, Math.min(1.12, Math.min(hudW / 1200, hudH / 640) * 1.04));

    if (!isVert && hudH < 440) {
      topScale = Math.min(topScale, Math.max(0.72, hudH / 500));
    }

    let minimapSize = isVert
      ? Math.round(Math.max(72, Math.min(112, hudW * 0.22 * dprComp)))
      : Math.round(Math.max(76, Math.min(156, Math.min(hudW * 0.125, hudH * 0.21) * dprComp)));

    let speedoScale = isVert
      ? Math.max(0.68, Math.min(1.04, (hudW / 400) * dprComp))
      : Math.max(0.62, Math.min(1.18, Math.min(hudW / 1180, hudH / 660) * 1.08));

    let touchScale = isVert
      ? Math.max(0.72, Math.min(1.02, (hudW / 405) * dprComp))
      : Math.max(0.66, Math.min(1.08, Math.min(hudW / 980, hudH / 520) * 1.04));

    const dockScale = isVert
      ? Math.max(0.74, Math.min(1.0, hudW / 410))
      : Math.max(0.74, Math.min(1.08, Math.min(hudW / 1100, hudH / 640) * 1.04));

    if (!isVert && aspect >= 2.05 && hudH >= 720) {
      const uwBoost = Math.min(1.16, 1 + (dpr - 1) * 0.04 + Math.min(0.08, (aspect - 2.0) * 0.06));
      minimapSize = Math.round(Math.min(160, minimapSize * uwBoost));
      speedoScale = Math.min(1.22, speedoScale * uwBoost);
      topScale = Math.min(1.12, topScale * Math.min(1.08, uwBoost));
    }

    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--hud-edge-x', `${edgeX}px`);
    rootStyle.setProperty('--hud-edge-y', `${edgeY}px`);
    rootStyle.setProperty('--hud-top-scale', topScale.toFixed(3));
    rootStyle.setProperty('--hud-minimap-size', `${minimapSize}px`);
    rootStyle.setProperty('--hud-speedo-scale', speedoScale.toFixed(3));
    rootStyle.setProperty('--hud-touch-scale', touchScale.toFixed(3));
    rootStyle.setProperty('--hud-dock-scale', dockScale.toFixed(3));

    this.syncMinimapCanvasResolution(minimapSize, dpr);
    this.updateHudClearances(hudW, hudH, isVert, edgeX, edgeY, minimapSize, speedoScale, touchScale, dpr);
    requestAnimationFrame(() => {
      this.updateHudClearances(hudW, hudH, isVert, edgeX, edgeY, minimapSize, speedoScale, touchScale, dpr);
    });
  }

  private syncMinimapCanvasResolution(cssSize: number, dpr: number) {
    const canvas = this.cachedHud?.minimapCanvas || (document.getElementById('minimapCanvas') as HTMLCanvasElement | null);
    if (!canvas) return;
    const effectiveDpr = Math.min(Math.max(dpr, 1), 2.5);
    const backing = Math.max(96, Math.round(cssSize * effectiveDpr));
    if (canvas.width !== backing || canvas.height !== backing) {
      canvas.width = backing;
      canvas.height = backing;
      this.minimapFrameSkip = 2; // redraw immediately on next frame
    }
  }

  private updateHudClearances(
    hudW: number,
    hudH: number,
    isVert: boolean,
    edgeX: number,
    edgeY: number,
    initialMinimapSize: number,
    initialSpeedoScale: number,
    initialTouchScale: number,
    dpr: number
  ) {
    const overlay = this.root.querySelector('.hud-overlay') as HTMLElement | null;
    if (!overlay) return;

    const rootStyle = document.documentElement.style;
    const topBar = overlay.querySelector('.hud-top-bar') as HTMLElement | null;
    const leftPanel = overlay.querySelector('.hud-left-panel') as HTMLElement | null;
    const rightPanel = overlay.querySelector('.hud-right-panel') as HTMLElement | null;
    const touchLeft = overlay.querySelector('.touch-zone-left') as HTMLElement | null;
    const touchRight = overlay.querySelector('.touch-zone-right') as HTMLElement | null;
    const owWrapper = overlay.querySelector('.ow-transport-wrapper') as HTMLElement | null;

    const topBarH = topBar ? topBar.getBoundingClientRect().height : isVert ? 94 : 52;
    const topClearance = Math.ceil(edgeY + topBarH + (isVert ? 8 : 10));
    rootStyle.setProperty('--hud-top-clearance', `${topClearance}px`);

    let minimapSize = initialMinimapSize;
    let speedoScale = initialSpeedoScale;
    let touchScale = initialTouchScale;

    const touchLeftRect = touchLeft?.getBoundingClientRect();
    const touchRightRect = touchRight?.getBoundingClientRect();
    let touchLeftW = touchLeftRect?.width || 0;
    let touchRightW = touchRightRect?.width || 0;
    let touchLeftH = touchLeftRect?.height || 0;
    let touchRightH = touchRightRect?.height || 0;

    // Prevent left and right touch clusters from colliding horizontally on narrow screens
    const availTouchW = hudW - edgeX * 2 - 14;
    if (touchLeftW + touchRightW > availTouchW && touchLeftW + touchRightW > 0) {
      const shrink = Math.max(0.56, availTouchW / (touchLeftW + touchRightW));
      touchScale = Math.max(0.52, touchScale * shrink);
      rootStyle.setProperty('--hud-touch-scale', touchScale.toFixed(3));
      touchLeftW *= shrink;
      touchRightW *= shrink;
      touchLeftH *= shrink;
      touchRightH *= shrink;
    }

    const speedoRect = rightPanel?.getBoundingClientRect();
    const speedoNaturalW = speedoRect && speedoScale > 0 ? speedoRect.width / speedoScale : isVert ? 170 : 225;
    const speedoNaturalH = speedoRect && speedoScale > 0 ? speedoRect.height / speedoScale : isVert ? 125 : 145;

    if (isVert) {
      // Portrait: minimap (left) & speedometer (right) share the upper band below top bar
      const maxPairW = hudW - edgeX * 2 - 14;
      const currentSpeedoW = speedoNaturalW * speedoScale;
      if (minimapSize + currentSpeedoW > maxPairW) {
        const pairShrink = Math.max(0.68, maxPairW / (minimapSize + currentSpeedoW));
        minimapSize = Math.max(66, Math.floor(minimapSize * pairShrink));
        speedoScale = Math.max(0.56, speedoScale * pairShrink);
        rootStyle.setProperty('--hud-minimap-size', `${minimapSize}px`);
        rootStyle.setProperty('--hud-speedo-scale', speedoScale.toFixed(3));
        this.syncMinimapCanvasResolution(minimapSize, dpr);
      }

      const maxTouchH = Math.max(touchLeftH, touchRightH);
      const dockBottom = Math.ceil(maxTouchH > 0 ? maxTouchH + 18 : 20);
      rootStyle.setProperty('--hud-dock-bottom', `${dockBottom}px`);

      const leftH = leftPanel ? leftPanel.getBoundingClientRect().height : minimapSize;
      const upperBandBottom = topClearance + Math.max(leftH, speedoNaturalH * speedoScale);
      rootStyle.setProperty('--hud-tutorial-top', `${Math.ceil(upperBandBottom + 10)}px`);
      rootStyle.setProperty('--hud-bottom-clearance', 'auto');
    } else {
      // Landscape: speedometer sits above touch-right without touching top bar
      let bottomClearance = Math.ceil(14 + (touchRightH > 0 ? touchRightH + 12 : 16));
      const maxStackH = hudH - topClearance - 8;
      const currentStackH = speedoNaturalH * speedoScale + bottomClearance;

      if (currentStackH > maxStackH && maxStackH > 120) {
        const stackRatio = Math.max(0.56, maxStackH / currentStackH);
        speedoScale = Math.max(0.54, speedoScale * stackRatio);
        touchScale = Math.max(0.54, touchScale * Math.min(1, stackRatio + 0.06));
        rootStyle.setProperty('--hud-speedo-scale', speedoScale.toFixed(3));
        rootStyle.setProperty('--hud-touch-scale', touchScale.toFixed(3));

        const updatedTouchRightH = touchRight ? touchRight.getBoundingClientRect().height : touchRightH * stackRatio;
        bottomClearance = Math.ceil(12 + (updatedTouchRightH > 0 ? updatedTouchRightH + 10 : 14));
        touchLeftH = touchLeft ? touchLeft.getBoundingClientRect().height : touchLeftH * stackRatio;
        touchRightH = updatedTouchRightH;
      }

      rootStyle.setProperty('--hud-bottom-clearance', `${bottomClearance}px`);
      rootStyle.setProperty('--hud-tutorial-top', `${Math.ceil(topClearance)}px`);

      const maxTouchH = Math.max(touchLeftH, touchRightH);
      const owRect = owWrapper?.getBoundingClientRect();
      const centerLaneW = hudW - edgeX * 2 - Math.max(touchLeftW, minimapSize) - Math.max(touchRightW, speedoNaturalW * speedoScale) - 24;
      const needsElevatedDock = maxTouchH > 0 && (!owRect || owRect.width > centerLaneW);
      rootStyle.setProperty('--hud-dock-bottom', `${Math.ceil(needsElevatedDock ? maxTouchH + 18 : 16)}px`);
    }
  }

  // --- Keyboard Handling (WASD / Arrows / Space / Shift) ---
  private setupKeyboardListeners() {
    const keys: Record<string, boolean> = {};

    window.addEventListener('keydown', (e) => {
      keys[e.code] = true;
      const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
      const isTypingInInput = activeTag === 'INPUT' || activeTag === 'TEXTAREA';

      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && !isTypingInInput) {
        e.preventDefault();
      }

      if (this.isReplayActive) {
        if (e.code === 'Escape') {
          e.preventDefault();
          this.onReplayAction?.('close');
        } else if (e.code === 'Space') {
          e.preventDefault();
          this.onReplayAction?.('play_pause');
        }
        return;
      }

      if (this.smartphone?.isOpen) {
        if (e.code === 'Escape' || e.code === 'Tab' || (e.code === 'KeyT' && !isTypingInInput)) {
          e.preventDefault();
          this.smartphone.close();
          return;
        }
        // Keep vehicle immobilized while interacting with smartphone apps / inputs
        this.resetDrivingControls();
        return;
      }

      if ((e.code === 'Escape' || e.code === 'KeyP') && this.currentMode !== 'title') {
        const dialogueOpen = Boolean(document.getElementById('DialogueBoxOverlay'));
        if (!dialogueOpen) {
          e.preventDefault();
          this.togglePause();
        }
        return;
      }

      if (this.isPaused) return;

      this.updateKeyboardControls(keys);

      if (e.code === 'KeyC') {
        this.controls.switchCamera = true;
        this.notifyTutorialAction('camera_switch');
      }
      if (e.code === 'KeyR') {
        this.controls.resetVehicle = true;
      }
      if (e.code === 'KeyM') {
        sound.toggleMute();
      }

      if (this.currentMode !== 'title') {
        if (!isTypingInInput) {
          if (e.code === 'KeyT' || e.code === 'Tab') {
            e.preventDefault();
            this.toggleSmartphone();
          } else if (e.code === 'KeyF') {
            e.preventDefault();
            this.notifyTutorialAction('transport_switch');
            this.onToggleEnterExitVehicle?.();
          } else if (e.code === 'KeyE') {
            e.preventDefault();
            this.notifyTutorialAction('location_interact');
            this.onInteractLocation?.();
          } else if (e.code === 'Digit1') {
            this.notifyTutorialAction('transport_switch');
            this.onSelectOpenWorldTransport?.('moto_street');
          } else if (e.code === 'Digit2') {
            this.notifyTutorialAction('transport_switch');
            this.onSelectOpenWorldTransport?.('moto_super');
          } else if (e.code === 'Digit3') {
            this.notifyTutorialAction('transport_switch');
            this.onSelectOpenWorldTransport?.('moto_cross');
          } else if (e.code === 'Digit4') {
            this.notifyTutorialAction('transport_switch');
            this.onSelectOpenWorldTransport?.('car');
          } else if (e.code === 'Digit5') {
            this.notifyTutorialAction('transport_switch');
            this.onSelectOpenWorldTransport?.('bicycle');
          } else if (e.code === 'Digit6') {
            this.notifyTutorialAction('transport_switch');
            this.onSelectOpenWorldTransport?.('skateboard');
          } else if (e.code === 'Digit7') {
            this.notifyTutorialAction('transport_switch');
            this.onSelectOpenWorldTransport?.('foot');
          }
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      keys[e.code] = false;
      if (this.smartphone?.isOpen || this.isPaused) {
        this.resetDrivingControls();
        return;
      }
      this.updateKeyboardControls(keys);
    });

    window.addEventListener('blur', () => {
      Object.keys(keys).forEach((k) => (keys[k] = false));
      this.resetDrivingControls();
    });
  }

  public resetDrivingControls() {
    this.controls.throttle = 0;
    this.controls.brake = 0;
    this.controls.steer = 0;
    this.controls.handbrake = false;
    this.controls.nitro = false;
  }

  private updateKeyboardControls(keys: Record<string, boolean>) {
    if (this.currentMode === 'title' || this.smartphone?.isOpen) return;

    // Throttle & Brake
    const up = keys['KeyW'] || keys['ArrowUp'];
    const down = keys['KeyS'] || keys['ArrowDown'];
    this.controls.throttle = up ? 1 : 0;
    this.controls.brake = down ? 1 : 0;

    // Steer (if not using gyroscope)
    if (!this.gyroActive) {
      const left = keys['KeyA'] || keys['ArrowLeft'];
      const right = keys['KeyD'] || keys['ArrowRight'];
      this.controls.steer = left ? -1 : right ? 1 : 0;
    }

    // Handbrake & Nitro
    this.controls.handbrake = Boolean(keys['Space']);
    this.controls.nitro = Boolean(keys['ShiftLeft'] || keys['ShiftRight'] || keys['KeyN']);
  }

  // --- Gyroscope / DeviceOrientation Steering ---
  private setupGyroscope() {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (!this.gyroActive) return;
      const gamma = e.gamma || 0;
      const beta = e.beta || 0;

      // Detect landscape vs portrait reliably without deprecated window.orientation
      const isLandscape = window.innerWidth >= window.innerHeight;
      const steerValue = isLandscape ? -beta / 30 : gamma / 30;

      // Deadzone and clamp
      if (Math.abs(steerValue) < 0.08) {
        this.controls.steer = 0;
      } else {
        this.controls.steer = Math.max(-1, Math.min(1, steerValue * this.profile.gyroSensitivity));
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
  }

  public async enableGyroscope(): Promise<boolean> {
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
        .requestPermission === 'function'
    ) {
      try {
        const permission = await (
          DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }
        ).requestPermission();
        this.gyroPermitted = permission === 'granted';
      } catch {
        this.gyroPermitted = false;
      }
    } else {
      this.gyroPermitted = true;
    }

    this.gyroActive = this.gyroPermitted;
    return this.gyroActive;
  }

  // ================= LOADING SCREEN & TRANSITIONS =================

  public updateBootLoading(percent: number, statusText: string, tipText?: string) {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    const textEl = document.getElementById('bootLoadingText');
    const fillEl = document.getElementById('bootLoadingBarFill');
    const pctEl = document.getElementById('bootLoadingPercent');
    const tipEl = document.getElementById('bootLoadingTip');
    if (textEl) textEl.textContent = statusText;
    if (fillEl) (fillEl as HTMLElement).style.width = `${clamped}%`;
    if (pctEl) pctEl.textContent = `${clamped}%`;
    if (tipEl && tipText) tipEl.textContent = tipText;
  }

  public hideBootLoading() {
    const el = document.getElementById('bootLoadingScreen');
    if (!el || el.classList.contains('is-hidden')) return;
    this.updateBootLoading(100, 'Pronto! Bem-vindo a GRAND PROVED IT.', 'Tudo carregado.');
    window.setTimeout(() => {
      el.classList.add('is-hidden');
      window.setTimeout(() => el.remove(), 460);
    }, 180);
  }

  public showTransitionLoading(title: string, subtitle = 'Construindo cidade 3D e posicionando veículos...', tip = 'Ajustando tráfego, NPCs e iluminação...') {
    let el = document.getElementById('transitionLoadingOverlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'transitionLoadingOverlay';
      el.className = 'game-loading-overlay';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.innerHTML = `
        <img src="${GameUI.GAME_BANNER_URL}" alt="" class="loading-cover-bg" referrerpolicy="no-referrer" />
        <div class="loading-card">
          <div class="loading-poster-wrap">
            <img src="${GameUI.GAME_COVER_URL}" alt="Capa GRAND PROVED IT" class="loading-poster" referrerpolicy="no-referrer" />
          </div>
          <div class="loading-info-col">
            <div class="loading-kicker-row">
              <img src="${GameUI.GAME_LOGO_URL}" alt="Logo GPI" class="brand-logo-crest" referrerpolicy="no-referrer" />
              <div class="loading-kicker">
                <span class="loading-spinner" aria-hidden="true"></span>
                <span id="transLoadingKicker">CARREGANDO SESSÃO</span>
              </div>
            </div>
            <h1 class="loading-title" id="transLoadingTitle">GRAND <span>PROVED IT</span></h1>
            <p class="loading-status-text" id="transLoadingSubtitle"></p>
            <div class="loading-progress-track">
              <div class="loading-progress-fill" id="transLoadingBarFill" style="width:32%;"></div>
            </div>
            <div class="loading-meta-row">
              <span id="transLoadingTip"></span>
              <strong id="transLoadingPercent">32%</strong>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(el);
    }

    el.classList.remove('is-hidden');
    const kickerEl = el.querySelector('#transLoadingKicker');
    const subEl = el.querySelector('#transLoadingSubtitle');
    const tipEl = el.querySelector('#transLoadingTip');
    const fillEl = el.querySelector('#transLoadingBarFill') as HTMLElement | null;
    const pctEl = el.querySelector('#transLoadingPercent');
    if (kickerEl) kickerEl.textContent = title.toUpperCase();
    if (subEl) subEl.textContent = subtitle;
    if (tipEl) tipEl.textContent = tip;
    if (fillEl) fillEl.style.width = '38%';
    if (pctEl) pctEl.textContent = '38%';
  }

  public hideTransitionLoading() {
    const el = document.getElementById('transitionLoadingOverlay');
    if (!el) return;
    const fillEl = el.querySelector('#transLoadingBarFill') as HTMLElement | null;
    const pctEl = el.querySelector('#transLoadingPercent');
    const subEl = el.querySelector('#transLoadingSubtitle');
    if (fillEl) fillEl.style.width = '100%';
    if (pctEl) pctEl.textContent = '100%';
    if (subEl) subEl.textContent = 'Pista pronta! Boa direção!';
    window.setTimeout(() => {
      el.classList.add('is-hidden');
      window.setTimeout(() => {
        if (el.classList.contains('is-hidden')) {
          el.remove();
        }
      }, 460);
    }, 220);
  }

  private runModeLaunchWithLoading(
    title: string,
    subtitle: string,
    launchFn: () => void,
    afterLoadFn?: () => void
  ) {
    this.showTransitionLoading(title, subtitle);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const fillEl = document.getElementById('transLoadingBarFill');
        const pctEl = document.getElementById('transLoadingPercent');
        if (fillEl) fillEl.style.width = '78%';
        if (pctEl) pctEl.textContent = '78%';

        try {
          launchFn();
        } finally {
          window.setTimeout(() => {
            this.hideTransitionLoading();
            afterLoadFn?.();
          }, 260);
        }
      });
    });
  }

  // ================= UI RENDERING =================

  private refreshActiveMenuScreen(preserveModals: boolean = false) {
    if (this.currentMode !== 'title') return;
    const activeModals = preserveModals
      ? Array.from(this.root.querySelectorAll(':scope > .modal-backdrop'))
      : [];
    activeModals.forEach((m) => m.remove());

    if (this.hasEnteredMainMenu) {
      this.renderTitleScreen();
    } else if (preserveModals && document.getElementById('entryAuthWidget')) {
      this.renderEntryAuthWidget();
    } else {
      this.renderEntryScreen();
    }

    activeModals.forEach((m) => this.root.appendChild(m));
  }

  private clearPendingDialogue() {
    document.getElementById('DialogueBoxOverlay')?.remove();
    document.getElementById('FilmLetterboxOverlay')?.remove();
    const resolve = this.dialogueResolve;
    this.dialogueResolve = undefined;
    this.activeDialogueLines = [];
    resolve?.();
  }

  private renderEntryAuthWidget() {
    const container = document.getElementById('entryAuthWidget');
    if (!container) return;
    const isOnline = networkStatus.isOnline;

    if (this.googleUser) {
      container.innerHTML = `
        <div class="entry-google-pill">
          <img src="${this.googleUser.photoURL || 'https://lh3.googleusercontent.com/a/default-user'}" alt="Avatar" class="entry-google-avatar" referrerpolicy="no-referrer" />
          <div class="entry-google-meta">
            <span class="entry-google-name">${this.googleUser.displayName || 'Piloto Google'}</span>
            <span class="entry-google-sub">${isOnline ? '✅ Google & Google Drive conectados' : '🔴 Offline — Reconecte para usar Drive'}</span>
            <span class="entry-veteran-badge">🏅 Piloto Veterano · Tutorial obrigatório dispensado!</span>
          </div>
        </div>
        <div class="entry-google-actions">
          <button class="entry-drive-btn ${!isOnline ? 'is-offline-disabled' : ''}" id="btnEntryGoogleDrive" type="button">
            ☁️ Google Drive (Save)
          </button>
          <button class="entry-signout-mini-btn" id="btnEntryGoogleSignOut" type="button">
            Sair da Conta
          </button>
        </div>
      `;

      document.getElementById('btnEntryGoogleDrive')?.addEventListener('click', () => {
        if (!networkStatus.isOnline) {
          this.showToast('🔒 Google Drive requer Wi-Fi ou Dados Móveis.');
          return;
        }
        this.showDriveCloudSaveModal();
      });

      document.getElementById('btnEntryGoogleSignOut')?.addEventListener('click', async () => {
        try {
          await googleSignOut();
          this.googleUser = null;
          this.renderEntryAuthWidget();
          this.showToast('Desconectado da conta Google.');
        } catch (err) {
          console.error('Sign out error:', err);
        }
      });
      return;
    }

    container.innerHTML = `
      <div class="entry-google-buttons">
        <button class="gsi-material-button ${!isOnline ? 'is-offline-disabled' : ''}" id="btnEntryGoogleSignIn" type="button">
          <div class="gsi-material-button-state"></div>
          <div class="gsi-material-button-content-wrapper">
            <div class="gsi-material-button-icon">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="display: block;">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.79l7.97-6.2z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                <path fill="none" d="M0 0h48v48H0z"></path>
              </svg>
            </div>
            <span class="gsi-material-button-contents">${isOnline ? 'Entrar com Google' : 'Google (Requer Wi-Fi)'}</span>
          </div>
        </button>
        <button class="entry-drive-btn ${!isOnline ? 'is-offline-disabled' : ''}" id="btnEntryGoogleDrive" type="button">
          ☁️ Google Drive
        </button>
      </div>
      <span class="entry-google-hint">${isOnline ? 'Entre com sua conta Google para salvar no Drive e burlar o tutorial obrigatório (se você já jogava antes).' : 'Conecte Wi-Fi ou Dados Móveis para entrar com Google / Drive.'}</span>
    `;

    document.getElementById('btnEntryGoogleSignIn')?.addEventListener('click', async () => {
      if (!networkStatus.isOnline) {
        this.showToast('🔒 Login Google indisponível sem Wi-Fi ou Dados Móveis.');
        return;
      }
      try {
        const { user } = await googleSignIn();
        sound.playSuccessFanfare();
        this.googleUser = getCurrentUserProfile();
        if (user.displayName) {
          this.profile.name = user.displayName;
        }
        const bypassed = this.handleGoogleVeteranBypass(true);
        this.persistDurableProgress(true);
        this.renderEntryAuthWidget();
        if (!bypassed) {
          this.showToast(`Conectado como ${user.displayName || user.email}! ☁️ Google Drive liberado.`);
        }
      } catch (err: unknown) {
        console.error('Google Sign-In error:', err);
        this.showToast(`Não foi possível conectar com o Google: ${(err as Error).message || err}`);
      }
    });

    document.getElementById('btnEntryGoogleDrive')?.addEventListener('click', () => {
      if (!networkStatus.isOnline) {
        this.showToast('🔒 Google Drive requer Wi-Fi ou Dados Móveis.');
        return;
      }
      this.showDriveCloudSaveModal();
    });
  }

  public renderEntryScreen() {
    this.currentMode = 'title';
    this.hasEnteredMainMenu = false;
    this.smartphone?.setClosedSilently();
    this.clearPendingDialogue();
    sound.stopAll();

    this.root.innerHTML = `
      <div class="entry-screen-backdrop">
        <img src="${GameUI.GAME_BANNER_URL}" alt="" class="entry-cover-bg" referrerpolicy="no-referrer" />
        <div class="entry-screen-card entry-split-layout">
          <div class="entry-cover-frame">
            <img src="${GameUI.GAME_COVER_URL}" alt="Capa GRAND PROVED IT" class="entry-cover-poster" referrerpolicy="no-referrer" />
          </div>
          <div class="entry-copy-col">
            <div class="entry-brand-row">
              <img src="${GameUI.GAME_LOGO_URL}" alt="Emblema GPI" class="brand-logo-crest" referrerpolicy="no-referrer" />
              <span class="entry-brand-badge">GPI EDITION</span>
            </div>
            <h1 class="entry-game-title">GRAND PROVED IT</h1>
            <p class="entry-game-subtitle">O melhor jogo de Drift e perseguição que você vai ver!</p>
            <div class="entry-actions-stack">
              <button class="entry-bw-btn entry-btn-primary" id="btnEntryStart" type="button">Começar</button>
              <button class="entry-bw-btn entry-btn-secondary" id="btnEntryExit" type="button">Sair</button>
            </div>
            <div class="entry-google-section" id="entryAuthWidget"></div>
          </div>
        </div>
      </div>
    `;

    this.renderEntryAuthWidget();

    document.getElementById('btnEntryStart')?.addEventListener('click', () => {
      sound.ensureRunning();
      sound.playCountdownBeep(true);
      this.hasEnteredMainMenu = true;
      if (this.isTutorialLocked()) {
        this.launchTutorialMode();
      } else {
        this.renderTitleScreen();
      }
    });

    document.getElementById('btnEntryExit')?.addEventListener('click', () => {
      this.renderExitConfirmScreen();
    });
  }

  /**
   * Exit Confirmation Screen ("Você quer mesmo sair?" with Sair / Ficar)
   */
  public renderExitConfirmScreen() {
    this.currentMode = 'title';
    this.clearPendingDialogue();
    this.root.innerHTML = `
      <div class="entry-screen-backdrop">
        <img src="${GameUI.GAME_BANNER_URL}" alt="" class="entry-cover-bg" referrerpolicy="no-referrer" />
        <div class="entry-screen-card exit-confirm-card">
          <img src="${GameUI.GAME_COVER_URL}" alt="Capa GRAND PROVED IT" class="exit-cover-thumb" referrerpolicy="no-referrer" />
          <h1 class="entry-game-title exit-question-title">Você quer mesmo sair?</h1>
          <p class="entry-game-subtitle">GRAND PROVED IT — O melhor jogo de Drift e perseguição que você vai ver!</p>
          <div class="entry-actions-row">
            <button class="entry-bw-btn entry-btn-secondary" id="btnConfirmExit" type="button">Sair</button>
            <button class="entry-bw-btn entry-btn-primary" id="btnConfirmStay" type="button">Ficar</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btnConfirmExit')?.addEventListener('click', () => {
      sound.stopAll();
      try {
        window.close();
      } catch {
        // Browsers often block script-initiated tab closure; show exited state below
      }
      this.renderExitedScreen();
    });

    document.getElementById('btnConfirmStay')?.addEventListener('click', () => {
      if (this.hasEnteredMainMenu) {
        this.renderTitleScreen();
      } else {
        this.renderEntryScreen();
      }
    });
  }

  private renderExitedScreen() {
    this.root.innerHTML = `
      <div class="entry-screen-backdrop">
        <img src="${GameUI.GAME_BANNER_URL}" alt="" class="entry-cover-bg" referrerpolicy="no-referrer" />
        <div class="entry-screen-card">
          <img src="${GameUI.GAME_COVER_URL}" alt="Capa GRAND PROVED IT" class="exit-cover-thumb" referrerpolicy="no-referrer" />
          <h1 class="entry-game-title">GRAND PROVED IT</h1>
          <p class="entry-game-subtitle">Jogo encerrado. Obrigado por jogar!</p>
          <div class="entry-actions-stack">
            <button class="entry-bw-btn entry-btn-primary" id="btnReturnFromExit" type="button">Voltar ao Início</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btnReturnFromExit')?.addEventListener('click', () => {
      this.renderEntryScreen();
    });
  }

  public renderTitleScreen() {
    this.currentMode = 'title';
    this.isPaused = false;
    this.isReplayActive = false;
    this.hasEnteredMainMenu = true;
    this.smartphone?.setClosedSilently();
    this.clearPendingDialogue();
    sound.stopVoiceClips();
    document.getElementById('PauseModalOverlay')?.remove();
    document.getElementById('ReplayHudOverlay')?.remove();
    const isOnline = networkStatus.isOnline;
    const tutorialLocked = this.isTutorialLocked();

    this.root.innerHTML = `
      <div class="screen-backdrop title-screen">
        <img src="${GameUI.GAME_BANNER_URL}" alt="" class="title-screen-cover-bg" referrerpolicy="no-referrer" />
        <div class="top-auth-bar">
          <div class="top-left-status-wrap">
            ${
              this.googleUser
                ? `
              <div class="google-account-pill">
                <img src="${this.googleUser.photoURL || 'https://lh3.googleusercontent.com/a/default-user'}" alt="Avatar" class="google-user-avatar" referrerpolicy="no-referrer" />
                <div class="google-user-info">
                  <span class="google-user-name">${this.googleUser.displayName || 'Piloto Google'}</span>
                  <span class="google-user-badge">${isOnline ? (this.googleVeteranBypassed ? '✅ Google Verificado · 🏅 Veterano (Tutorial Dispensado)' : '✅ Google Verificado · ☁️ Drive Ativo') : '🔴 Offline · Reconecte para Drive'}</span>
                </div>
                <button class="google-signout-btn" id="btnGoogleSignOut" title="Desconectar do Google">Sair</button>
              </div>
            `
                : `
              <div class="google-login-box">
                <button class="gsi-material-button ${!isOnline ? 'is-offline-disabled' : ''}" id="btnGoogleSignIn" type="button">
                  <div class="gsi-material-button-state"></div>
                  <div class="gsi-material-button-content-wrapper">
                    <div class="gsi-material-button-icon">
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="display: block;">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.79l7.97-6.2z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                      </svg>
                    </div>
                    <span class="gsi-material-button-contents">${isOnline ? 'Entrar com Google' : 'Google (Requer Wi-Fi)'}</span>
                  </div>
                </button>
                <span class="google-login-hint">${isOnline ? '1-Clique: Salva no Drive & Ranking' : 'Conecte Wi-Fi/Dados para login'}</span>
              </div>
            `
            }

            <div class="network-status-pill ${isOnline ? 'status-online' : 'status-offline'}" id="menuNetworkBadge">
              <span class="net-dot"></span>
              <span>${isOnline ? 'ONLINE · Servidores Ativos' : 'OFFLINE · Sem Wi-Fi / Dados'}</span>
            </div>
          </div>

          <div class="profile-pill-top">
            <span class="profile-name">👤 ${this.profile.name} (${this.profile.nickname})</span>
            <span class="profile-cash">💰 R$ ${this.profile.cash.toLocaleString()}</span>
            <span class="profile-rep">⭐ Nível ${this.profile.repLevel}</span>
          </div>
        </div>

        ${
          !isOnline
            ? `
          <div class="offline-warning-banner">
            ⚠️ <strong>MODO OFFLINE ATIVO (Sem Wi-Fi / Dados Móveis):</strong> Apenas modos offline funcionam agora. O progresso feito nesta sessão é temporário e <strong>NÃO será salvo de forma duradoura</strong> até o Wi-Fi/Dados Móveis serem ligados novamente.
          </div>
        `
            : ''
        }

        ${
          tutorialLocked
            ? `
          <div class="tutorial-mandatory-banner">
            <div class="tutorial-mandatory-copy">
              <strong>🎓 TUTORIAL OBRIGATÓRIO PENDENTE:</strong> Conclua os 6 passos rápidos no Modo Tutorial para liberar todos os modos — ou conecte sua <strong>conta Google</strong> se você já jogava antes!
            </div>
            <div class="tutorial-mandatory-actions">
              <button class="primary-btn tutorial-mandatory-cta" id="btnForceTutorialNow" type="button">▶ INICIAR TUTORIAL</button>
              <button class="secondary-btn tutorial-google-bypass-btn ${!isOnline ? 'is-offline-disabled' : ''}" id="btnTutorialGoogleBypass" type="button">🔓 Já jogava? Pular c/ Google</button>
            </div>
          </div>
        `
            : ''
        }

        <div class="title-header title-header-with-cover">
          <div class="title-cover-card">
            <img src="${GameUI.GAME_COVER_URL}" alt="Capa Oficial GRAND PROVED IT" class="title-cover-img" referrerpolicy="no-referrer" />
          </div>
          <div class="title-header-text">
            <div class="title-crest-row">
              <img src="${GameUI.GAME_LOGO_URL}" alt="Logo GPI" class="brand-logo-crest" referrerpolicy="no-referrer" />
              <div class="badge-tag">3D DRIFT &amp; POLICE PURSUIT</div>
            </div>
            <h1 class="game-logo">GRAND <span>PROVED IT</span></h1>
            <p class="tagline">O melhor jogo de Drift e perseguição que você vai ver!</p>
            <div class="device-preset-tag">
              <span>📱 <strong>Gráfico Padrão:</strong> ${this.quality === 'low' ? 'Baixo' : this.quality === 'medium' ? 'Médio' : this.quality === 'high' ? 'Alto' : 'Ultra (Realista)'}</span>
              <span class="preset-tag-desc">(${this.deviceSpecs?.recommendationReason || 'Auto-calibrado para o seu aparelho'})</span>
            </div>
          </div>
        </div>

        <div class="main-menu-grid">
          <button class="menu-btn primary-btn ${tutorialLocked ? 'menu-btn-tutorial-locked' : ''}" id="btnStory">
            <span class="btn-icon">${tutorialLocked ? '🔒' : '🎬'}</span>
            <div class="btn-info">
              <span class="btn-title">MODO HISTÓRIA</span>
              <span class="btn-sub">${tutorialLocked ? 'Bloqueado — Conclua o Tutorial passo a passo' : 'Offline · A Carreira de Luca & Miguel'}</span>
            </div>
          </button>

          <button class="menu-btn ${tutorialLocked ? 'menu-btn-tutorial-locked' : ''}" id="btnCareer">
            <span class="btn-icon">${tutorialLocked ? '🔒' : '🏆'}</span>
            <div class="btn-info">
              <span class="btn-title">MODO CARREIRA</span>
              <span class="btn-sub">${tutorialLocked ? 'Bloqueado — Conclua o Tutorial passo a passo' : 'Offline · Crie seu Piloto e Vença Corridas'}</span>
            </div>
          </button>

          <button class="menu-btn ${tutorialLocked ? 'menu-btn-tutorial-locked' : ''}" id="btnChallenge">
            <span class="btn-icon">${tutorialLocked ? '🔒' : '⚡'}</span>
            <div class="btn-info">
              <span class="btn-title">MODO DESAFIO</span>
              <span class="btn-sub">${tutorialLocked ? 'Bloqueado — Conclua o Tutorial passo a passo' : 'Offline · Missões Extremas 5 Estrelas'}</span>
            </div>
          </button>

          <button class="menu-btn ${tutorialLocked ? 'menu-btn-tutorial-locked' : ''}" id="btnFreeRoam">
            <span class="btn-icon">${tutorialLocked ? '🔒' : '🏙️'}</span>
            <div class="btn-info">
              <span class="btn-title">MODO LIVRE</span>
              <span class="btn-sub">${tutorialLocked ? 'Bloqueado — Conclua o Tutorial passo a passo' : 'Offline · Passeio Livre pela Cidade'}</span>
            </div>
          </button>

          <button class="menu-btn ${tutorialLocked ? 'tutorial-priority-btn' : ''}" id="btnTutorial">
            <span class="btn-icon">🎓</span>
            <div class="btn-info">
              <span class="btn-title">MODO TUTORIAL ${tutorialLocked ? '· OBRIGATÓRIO' : ''}</span>
              <span class="btn-sub">${tutorialLocked ? 'Comece aqui! Passo a passo dos comandos básicos' : 'Offline · Repetir Treinamento Passo a Passo'}</span>
            </div>
          </button>

          <button class="menu-btn highlight-btn ${!isOnline || tutorialLocked ? 'menu-btn-offline-locked' : ''}" id="btnMultiplayer">
            <span class="btn-icon">${!isOnline || tutorialLocked ? '🔒' : '🌐'}</span>
            <div class="btn-info">
              <span class="btn-title">MULTIPLAYER ONLINE</span>
              <span class="btn-sub">${tutorialLocked ? 'Bloqueado — Conclua o Tutorial passo a passo' : isOnline ? 'Servidores Reais · Salas com Código de 4 Números' : 'Bloqueado offline — Requer Wi-Fi ou Dados Móveis'}</span>
            </div>
          </button>
        </div>

        <div class="bottom-dock-nav">
          <button class="dock-btn" id="btnGarage">🚗 Garagem & Tuning</button>
          <button class="dock-btn" id="btnReplayDock">🎬 Replay${this.hasReplayAvailable?.() ? ' (Pronto)' : ''}</button>
          <button class="dock-btn achievements-dock-btn" id="btnAchievements">🎖️ Conquistas (${this.achievements.getUnlockedCount()}/${this.achievements.achievements.length})</button>
          <button class="dock-btn cloud-dock-btn ${!isOnline ? 'dock-btn-offline-locked' : ''}" id="btnDriveCloud">${isOnline ? '☁️ Salvar no Drive' : '🔒 Drive (Offline)'}</button>
          <button class="dock-btn ranking-dock-btn ${!isOnline ? 'dock-btn-offline-locked' : ''}" id="btnLiveRanking">${isOnline ? '🏆 Ranking Global' : '🔒 Ranking (Offline)'}</button>
          <button class="dock-btn ${!isOnline || tutorialLocked ? 'dock-btn-offline-locked' : ''}" id="btnLeaderboard">${tutorialLocked ? '🔒 Salas (Tutorial)' : isOnline ? '🌐 Salas Online' : '🔒 Salas (Offline)'}</button>
          <button class="dock-btn" id="btnToggleOrientation">${this.isEffectiveVertical() ? '📲 Modo: Vertical' : '↔️ Modo: Horizontal'}</button>
          <button class="dock-btn" id="btnSettings">⚙️ Configurações</button>
          <button class="dock-btn" id="btnMainMenuExit">🚪 Sair</button>
        </div>
      </div>
    `;

    // Event Bindings
    document.getElementById('btnForceTutorialNow')?.addEventListener('click', () => {
      this.launchTutorialMode();
    });
    document.getElementById('btnTutorialGoogleBypass')?.addEventListener('click', async () => {
      if (!networkStatus.isOnline) {
        this.showToast('🔒 Conecte Wi-Fi ou Dados Móveis para entrar com Google e pular o tutorial.');
        return;
      }
      try {
        const { user } = await googleSignIn();
        sound.playSuccessFanfare();
        this.googleUser = getCurrentUserProfile();
        if (user.displayName) {
          this.profile.name = user.displayName;
        }
        const bypassed = this.handleGoogleVeteranBypass(true);
        this.persistDurableProgress(true);
        this.renderTitleScreen();
        if (!bypassed) {
          this.showToast(`Conectado como ${user.displayName || user.email}! Todos os modos liberados.`);
        }
      } catch (err: unknown) {
        console.error('Google Sign-In error:', err);
        this.showToast(`Não foi possível conectar com o Google: ${(err as Error).message || err}`);
      }
    });
    document.getElementById('btnReplayDock')?.addEventListener('click', () => {
      if (!this.hasReplayAvailable?.()) {
        this.showToast('🎬 Dirija alguns segundos em qualquer modo para gravar um Replay!');
        return;
      }
      this.onOpenReplay?.('title');
    });
    document.getElementById('btnAchievements')?.addEventListener('click', () => this.showAchievementsModal());
    document.getElementById('btnToggleOrientation')?.addEventListener('click', () => {
      this.toggleHorizontalVertical();
    });
    document.getElementById('btnMainMenuExit')?.addEventListener('click', () => this.renderExitConfirmScreen());

    document.getElementById('menuNetworkBadge')?.addEventListener('click', async () => {
      const online = await networkStatus.recheckNow();
      this.showToast(
        online
          ? '🟢 Conexão verificada: Servidores Online ativos!'
          : '🔴 Sem Wi-Fi ou Dados Móveis detectados. Ligue sua conexão para liberar o Multiplayer e salvamento duradouro.'
      );
      this.renderTitleScreen();
    });

    document.getElementById('btnGoogleSignIn')?.addEventListener('click', async () => {
      if (!networkStatus.isOnline) {
        this.showToast('🔒 Login Google indisponível sem Wi-Fi ou Dados Móveis.');
        return;
      }
      try {
        const { user } = await googleSignIn();
        sound.playSuccessFanfare();
        this.googleUser = getCurrentUserProfile();
        if (user.displayName) {
          this.profile.name = user.displayName;
        }
        const bypassed = this.handleGoogleVeteranBypass(true);
        this.persistDurableProgress(true);
        this.renderTitleScreen();
        if (!bypassed) {
          this.showToast(`Conectado como ${user.displayName || user.email}! ☁️ Salve seus dados no Drive.`);
        }
      } catch (err: unknown) {
        console.error('Google Sign-In error:', err);
        this.showToast(`Não foi possível conectar com o Google: ${(err as Error).message || err}`);
      }
    });

    document.getElementById('btnGoogleSignOut')?.addEventListener('click', async () => {
      try {
        await googleSignOut();
        this.googleUser = null;
        this.renderTitleScreen();
        this.showToast('Desconectado da conta Google.');
      } catch (err) {
        console.error('Sign out error:', err);
      }
    });

    document.getElementById('btnDriveCloud')?.addEventListener('click', () => {
      if (!networkStatus.isOnline) {
        this.showToast('🔒 Google Drive requer Wi-Fi ou Dados Móveis.');
        return;
      }
      this.showDriveCloudSaveModal();
    });
    document.getElementById('btnLiveRanking')?.addEventListener('click', () => {
      if (!networkStatus.isOnline) {
        this.showToast('🔒 Ranking Global Online requer Wi-Fi ou Dados Móveis.');
        return;
      }
      this.showLiveRankingModal();
    });
    const guardTutorialLock = (action: () => void) => {
      if (this.isTutorialLocked()) {
        this.showToast('🎓 Conclua o Tutorial passo a passo primeiro para desbloquear este modo!');
        const tutBtn = document.getElementById('btnTutorial');
        tutBtn?.classList.remove('tutorial-nudge');
        void tutBtn?.offsetWidth;
        tutBtn?.classList.add('tutorial-nudge');
        return;
      }
      action();
    };
    document.getElementById('btnStory')?.addEventListener('click', () => guardTutorialLock(() => this.showStoryChaptersModal()));
    document.getElementById('btnCareer')?.addEventListener('click', () => guardTutorialLock(() => this.showCareerModal()));
    document.getElementById('btnChallenge')?.addEventListener('click', () => guardTutorialLock(() => this.showChallengesModal()));
    document.getElementById('btnFreeRoam')?.addEventListener('click', () =>
      guardTutorialLock(() => {
        this.showFreeRoamMapModal();
      })
    );
    document.getElementById('btnTutorial')?.addEventListener('click', () => {
      this.launchTutorialMode();
    });
    document.getElementById('btnMultiplayer')?.addEventListener('click', () =>
      guardTutorialLock(() => {
        if (!networkStatus.isOnline) {
          this.showToast('🔒 Modo Offline: ligue o Wi-Fi ou Dados Móveis para jogar nos Servidores Online!');
          return;
        }
        this.showMultiplayerModal();
      })
    );
    document.getElementById('btnGarage')?.addEventListener('click', () => this.showGarageModal());
    document.getElementById('btnLeaderboard')?.addEventListener('click', () =>
      guardTutorialLock(() => {
        if (!networkStatus.isOnline) {
          this.showToast('🔒 Salas Online requerem Wi-Fi ou Dados Móveis.');
          return;
        }
        this.showLeaderboardModal();
      })
    );
    document.getElementById('btnSettings')?.addEventListener('click', () => this.showSettingsModal());
  }

  public isTutorialLocked(): boolean {
    return !this.profile.tutorialCompleted && !this.googleUser;
  }

  private handleGoogleVeteranBypass(showModal: boolean): boolean {
    if (!this.googleUser) return false;
    const wasLocked = !this.profile.tutorialCompleted;
    if (!wasLocked) return false;

    this.profile.tutorialCompleted = true;
    this.googleVeteranBypassed = true;
    this.persistDurableProgress(true);

    if (showModal) {
      this.showGoogleVeteranBypassModal();
    }
    return true;
  }

  private showGoogleVeteranBypassModal() {
    document.getElementById('GoogleVeteranBypassModal')?.remove();
    const displayName = this.googleUser?.displayName || this.profile.name || 'Piloto Google';
    const inTutorial = this.currentMode === 'tutorial';

    if (inTutorial) {
      this.isPaused = true;
      this.onPauseChanged?.(true);
    }

    const modal = document.createElement('div');
    modal.id = 'GoogleVeteranBypassModal';
    modal.className = 'modal-backdrop';
    const isMidGame = this.currentMode !== 'title' && !inTutorial;

    modal.innerHTML = `
      <div class="modal-card result-modal veteran-bypass-modal">
        <div class="veteran-bypass-chip">🏅 CONTA GOOGLE RECONHECIDA</div>
        <h2 class="text-victory">PILOTO VETERANO CONFIRMADO!</h2>
        <p class="modal-desc">
          Bem-vindo de volta, <strong>${displayName}</strong>! Como você conectou sua conta Google e já jogava antes, o <strong>tutorial obrigatório foi burlado e todos os modos já estão liberados</strong>.
        </p>
        <div class="result-rewards">
          <div class="reward-box">🔓 Todos os Modos Desbloqueados</div>
          <div class="reward-box">☁️ Google Drive Pronto para Sincronizar</div>
        </div>
        <div class="modal-actions result-actions-row">
          ${
            isMidGame
              ? ''
              : `<button class="secondary-btn" id="btnVeteranTryTutorialAnyway" type="button">
                   ${inTutorial ? '🎓 CONTINUAR NO TUTORIAL' : '🎓 REVER TUTORIAL MESMO ASSIM'}
                 </button>`
          }
          <button class="primary-btn" id="btnVeteranGoMenu" type="button">
            ${isMidGame ? '✔ VOLTAR AO PAUSE' : '🚀 IR DIRETO PARA O MENU'}
          </button>
        </div>
      </div>
    `;
    this.root.appendChild(modal);

    modal.querySelector('#btnVeteranTryTutorialAnyway')?.addEventListener('click', () => {
      modal.remove();
      if (inTutorial) {
        this.isPaused = false;
        this.onPauseChanged?.(false);
        this.renderTutorialOverlay();
      } else {
        this.launchTutorialMode();
      }
    });

    modal.querySelector('#btnVeteranGoMenu')?.addEventListener('click', () => {
      modal.remove();
      if (isMidGame) {
        this.showToast('🏅 Conta Google vinculada! Progresso sincronizável nas Configurações.');
        return;
      }
      this.tutorialActive = false;
      this.clearTutorialHighlights();
      const guide = document.getElementById('tutorialGuideOverlay');
      if (guide) guide.style.display = 'none';
      if (this.smartphone?.isOpen) {
        this.smartphone.close();
      }
      this.isPaused = false;
      this.onPauseChanged?.(false);
      this.renderTitleScreen();
      this.showToast('🏅 Conta Google vinculada! Todos os modos de GRAND PROVED IT estão liberados.');
    });
  }

  public getHudControlStyle(): HudControlStyle {
    return this.profile.hudControlStyle || 'classic';
  }

  public setHudControlStyle(style: HudControlStyle) {
    this.profile.hudControlStyle = style;
    this.persistDurableProgress();
    const container = document.getElementById('touchControlsContainer');
    if (container && this.currentMode !== 'title') {
      container.className = `touch-controls-container hud-style-${style}`;
      container.innerHTML = this.renderTouchControlsMarkup();
      this.bindTouchControls();
      this.updateTutorialHighlight();
      this.applyDynamicHudScale();
    }
  }

  public launchTutorialMode() {
    sound.ensureRunning();
    sound.preloadVoiceClips(Object.values(GameUI.ALAN_TUTORIAL_AUDIO));
    this.runModeLaunchWithLoading(
      'MODO TUTORIAL',
      'Preparando avenida aberta para o treinamento inicial...',
      () => {
        this.currentMode = 'tutorial';
        this.onStartMode?.('tutorial', undefined, 'track_city');
        this.renderHUD();
      },
      () => {
        this.startInteractiveTutorial();
      }
    );
  }

  // --- World Atlas Modal ---
  public showWorldMapModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-card extra-large-modal world-atlas-modal">
        <div class="modal-header">
          <h2>🗺️ ATLAS DO MUNDO · GRAND PROVED IT</h2>
          <button class="close-modal-btn" type="button">&times;</button>
        </div>
        <div class="world-atlas-layout">
          <div class="world-atlas-image-wrap">
            <img src="${GameUI.WORLD_MAP_URL}" alt="Mapa do Mundo: The Jounnte, The Chamed e The Laymed" class="world-atlas-img" referrerpolicy="no-referrer" />
          </div>
          <div class="world-atlas-legend">
            <div class="atlas-region-card">
              <h4>🏙️ Mapa 1: The Jounnte (Cidade)</h4>
              <p>Dividida em <strong>Bairro Comercial</strong>, <strong>Bairro Residencial</strong>, <strong>Bairro Industrial</strong>, <strong>Praia</strong> e <strong>The Lained</strong> — onde ocorre a fuga noturna da prisão.</p>
            </div>
            <div class="atlas-region-card">
              <h4>🌲 Mapa 2: The Chamed (Floresta)</h4>
              <p>Floresta com campo marcada por <strong>Árvores</strong>, a <strong>Avenida Principal</strong>, Bairro Residencial/Industrial e a <strong>Fronteira Principal</strong> com The Jounnte.</p>
            </div>
            <div class="atlas-region-card">
              <h4>🏜️ Mapa 3: The Laymed (Deserto)</h4>
              <p>Pequenos estabelecimentos espalhados pelos <strong>Bairros Pequenos</strong>, <strong>Vales de Areia</strong> e a temida <strong>Zona de Perigo</strong>.</p>
            </div>
            <div class="atlas-region-card">
              <h4>🏛️ Mapa 4: The San Bernard (Cidade / Vila Grande)</h4>
              <p>Grande cidade e vila estratégica fora das rotas comuns, palco decisivo para conquistar o poder acima do próprio governo.</p>
            </div>
          </div>
        </div>
      </div>
    `;
    this.root.appendChild(modal);
    modal.querySelector('.close-modal-btn')?.addEventListener('click', () => modal.remove());
  }

  // --- Free Roam Region Picker ---
  private showFreeRoamMapModal() {
    const unlockedTracks = DEFAULT_TRACKS.filter((t) => t.unlocked);
    let selectedMapId =
      unlockedTracks.find((t) => t.id === this.profile.selectedTrackId)?.id ||
      unlockedTracks[0]?.id ||
      'track_city';

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-card large-modal">
        <div class="modal-header">
          <h2>🏙️ MODO LIVRE: ESCOLHA O MAPA &amp; REGIÃO</h2>
          <button class="close-modal-btn" type="button">&times;</button>
        </div>
        <div class="atlas-banner-strip">
          <img src="${GameUI.WORLD_MAP_URL}" alt="Mapa Geral" class="atlas-thumb-preview" referrerpolicy="no-referrer" />
          <div class="atlas-banner-copy">
            <strong>Explore livremente The Jounnte, The Chamed, The Laymed &amp; The San Bernard</strong>
            <span>Escolha qualquer região abaixo ou abra o Atlas completo para ver bairros, fronteiras e zonas.</span>
          </div>
          <button class="option-btn" id="btnOpenWorldAtlasFromFree" type="button">🗺️ Ver Atlas</button>
        </div>
        <div class="freeroam-tracks-grid">
          ${unlockedTracks
            .map(
              (t) => `
            <button type="button" class="freeroam-track-card ${t.id === selectedMapId ? 'selected' : ''}" data-track-id="${t.id}">
              <div class="ftc-top">
                <strong>${t.name}</strong>
                <span class="ftc-diff">${t.difficulty}</span>
              </div>
              <span class="ftc-loc">📍 ${t.location}</span>
              <p class="ftc-desc">${t.description}</p>
            </button>
          `
            )
            .join('')}
        </div>
        <div class="modal-actions result-actions-row">
          <button class="primary-btn" id="btnLaunchFreeRoamSelected" type="button">🚗 INICIAR MODO LIVRE</button>
        </div>
      </div>
    `;
    this.root.appendChild(modal);

    modal.querySelector('.close-modal-btn')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#btnOpenWorldAtlasFromFree')?.addEventListener('click', () => this.showWorldMapModal());

    modal.querySelectorAll('.freeroam-track-card').forEach((card) => {
      card.addEventListener('click', () => {
        selectedMapId = card.getAttribute('data-track-id') || selectedMapId;
        this.profile.selectedTrackId = selectedMapId;
        this.persistDurableProgress();
        modal.querySelectorAll('.freeroam-track-card').forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
      });
    });

    modal.querySelector('#btnLaunchFreeRoamSelected')?.addEventListener('click', () => {
      const chosen = unlockedTracks.find((t) => t.id === selectedMapId) || unlockedTracks[0];
      modal.remove();
      this.runModeLaunchWithLoading(
        `MODO LIVRE · ${chosen?.name?.toUpperCase() || 'CIDADE'}`,
        'Carregando cenário, ruas, tráfego e pontos de spawn...',
        () => {
          this.currentMode = 'free_roam';
          this.onStartMode?.('free_roam', undefined, selectedMapId);
          this.renderHUD();
        }
      );
    });
  }

  // --- Story Chapters Modal ---
  private showStoryChaptersModal() {
    const unlockedEndings = this.profile.unlockedEndings || [];
    const endingKeys: StoryEndingId[] = ['true', 'good', 'bad', 'false'];

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-card large-modal">
        <div class="modal-header">
          <h2>🎬 HISTÓRIA: MIGUEL &amp; LUCA — DA PRISÃO AO PODER</h2>
          <button class="close-modal-btn" type="button">&times;</button>
        </div>
        <div class="story-cast-bar">
          <span>👤 <strong>Protagonistas:</strong> Miguel &amp; Luca</span>
          <span>🛡️ <strong>Aliados:</strong> Alan, André (Andreiwalt) &amp; Ana</span>
          <button class="option-btn" id="btnStoryAtlas" type="button">🗺️ Mapa das Regiões</button>
        </div>
        <p class="modal-desc">Quebrem o muro das celas à noite, escapem pela explosão do carro sem controle e avancem por The Jounnte, The Chamed, The Laymed e The San Bernard até um dos 4 finais distintos.</p>

        <div class="story-endings-strip">
          <div class="story-endings-header">
            <strong>🎭 Finais Desbloqueados: ${unlockedEndings.length}/4</strong>
            <span>Suas decisões e desempenho no Capítulo 5 revelam cada desfecho.</span>
          </div>
          <div class="story-endings-pills">
            ${endingKeys
              .map((key) => {
                const info = STORY_ENDINGS[key];
                const got = unlockedEndings.includes(key);
                return `
                  <button type="button" class="ending-pill ${got ? `is-unlocked ${info.toneClass}` : 'is-locked'}" data-ending-id="${key}">
                    <span>${got ? '✅' : '🔒'} ${info.badge.split('·')[0].trim()}</span>
                    <small>${got ? info.title : 'Desbloqueie no Cap. 5'}</small>
                  </button>
                `;
              })
              .join('')}
          </div>
        </div>

        <div class="chapters-grid">
          ${STORY_CHAPTERS.map(
            (ch) => `
            <div class="chapter-card ${this.profile.storyChapter >= ch.id ? 'unlocked' : 'locked'}">
              <div class="ch-badge">${ch.id <= this.profile.storyChapter ? 'DESBLOQUEADO' : 'BLOQUEADO'}</div>
              <h3 class="ch-title">${ch.title}</h3>
              <p class="ch-sub">${ch.subtitle}</p>
              <p class="ch-briefing">${ch.briefing}</p>
              <div class="ch-meta">
                <span>⭐ Heat Inicial: ${'★'.repeat(ch.initialHeat)}</span>
                <span>💰 Recompensa: R$ ${ch.rewardCash.toLocaleString()}</span>
              </div>
              <button class="start-ch-btn ${this.profile.storyChapter >= ch.id ? 'btn-active' : 'btn-disabled'}" data-id="${ch.id}">
                ${this.profile.storyChapter >= ch.id ? 'INICIAR MISSÃO' : 'BLOQUEADO'}
              </button>
            </div>
          `
          ).join('')}
        </div>
      </div>
    `;
    this.root.appendChild(modal);

    modal.querySelector('.close-modal-btn')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#btnStoryAtlas')?.addEventListener('click', () => this.showWorldMapModal());
    modal.querySelectorAll('.ending-pill.is-unlocked').forEach((pill) => {
      pill.addEventListener('click', () => {
        const eid = pill.getAttribute('data-ending-id') as StoryEndingId;
        if (eid && STORY_ENDINGS[eid]) {
          this.showStoryEndingResultModal(eid, true);
        }
      });
    });

    modal.querySelectorAll('.start-ch-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = parseInt((e.currentTarget as HTMLElement).getAttribute('data-id') || '1');
        if (this.profile.storyChapter >= id) {
          modal.remove();
          const chapter = STORY_CHAPTERS.find((c) => c.id === id);
          if (chapter) {
            this.runModeLaunchWithLoading(
              `HISTÓRIA · CAPÍTULO ${chapter.id}`,
              'Preparando cenário, fuga e cena cinematográfica...',
              () => {
                this.currentMode = 'story';
                this.renderHUD();
                this.onStartMode?.('story', chapter, chapter.trackId);
              }
            );
          }
        }
      });
    });
  }

  private normalizeCareerCharacter(raw?: Partial<CareerCharacterConfig>): CareerCharacterConfig {
    const baseStats = { ...DEFAULT_CAREER_CHARACTER.stats };
    const s = raw?.stats;
    if (s) {
      baseStats.speed = Math.max(0, Math.min(CAREER_ATTRIBUTE_BUDGET, Math.round(Number(s.speed) || 0)));
      baseStats.agility = Math.max(0, Math.min(CAREER_ATTRIBUTE_BUDGET, Math.round(Number(s.agility) || 0)));
      baseStats.driving = Math.max(0, Math.min(CAREER_ATTRIBUTE_BUDGET, Math.round(Number(s.driving) || 0)));
      baseStats.health = Math.max(0, Math.min(CAREER_ATTRIBUTE_BUDGET, Math.round(Number(s.health) || 0)));
    }
    // Enforce <= 70 total pool cap
    let total = baseStats.speed + baseStats.agility + baseStats.driving + baseStats.health;
    const keys: Array<keyof CareerCharacterStats> = ['health', 'driving', 'agility', 'speed'];
    for (const k of keys) {
      if (total <= CAREER_ATTRIBUTE_BUDGET) break;
      const excess = total - CAREER_ATTRIBUTE_BUDGET;
      const reduce = Math.min(baseStats[k], excess);
      baseStats[k] -= reduce;
      total -= reduce;
    }

    const app: CareerCharacterAppearance = {
      skinTone: raw?.appearance?.skinTone || DEFAULT_CAREER_CHARACTER.appearance.skinTone,
      jacketColor: raw?.appearance?.jacketColor || DEFAULT_CAREER_CHARACTER.appearance.jacketColor,
      pantsColor: raw?.appearance?.pantsColor || DEFAULT_CAREER_CHARACTER.appearance.pantsColor,
      build:
        raw?.appearance?.build === 'lean' ||
        raw?.appearance?.build === 'heavy' ||
        raw?.appearance?.build === 'athletic'
          ? raw.appearance.build
          : DEFAULT_CAREER_CHARACTER.appearance.build,
    };

    return {
      created: Boolean(raw?.created),
      stats: baseStats,
      appearance: app,
    };
  }

  private renderCareerCharacterSvg(appearance: CareerCharacterAppearance, sizePx: number = 128): string {
    const torsoW = appearance.build === 'lean' ? 36 : appearance.build === 'heavy' ? 52 : 44;
    const armW = appearance.build === 'lean' ? 10 : appearance.build === 'heavy' ? 15 : 12;
    const torsoX = (120 - torsoW) / 2;
    return `
      <svg viewBox="0 0 120 156" width="${sizePx}" height="${Math.round(sizePx * 1.3)}" class="career-char-svg" aria-hidden="true">
        <defs>
          <radialGradient id="charGlow" cx="50%" cy="45%" r="50%">
            <stop offset="0%" stop-color="${appearance.jacketColor}" stop-opacity="0.32" />
            <stop offset="100%" stop-color="${appearance.jacketColor}" stop-opacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="60" cy="146" rx="34" ry="7" fill="rgba(0,0,0,0.45)" />
        <circle cx="60" cy="70" r="54" fill="url(#charGlow)" />
        <!-- Cap / Hair -->
        <rect x="44" y="13" width="32" height="12" rx="6" fill="${appearance.jacketColor}" />
        <rect x="48" y="21" width="34" height="5" rx="2.5" fill="#0f172a" />
        <!-- Head -->
        <circle cx="60" cy="34" r="14" fill="${appearance.skinTone}" />
        <!-- Eyes -->
        <circle cx="55" cy="33" r="1.8" fill="#0f172a" />
        <circle cx="65" cy="33" r="1.8" fill="#0f172a" />
        <!-- Arms -->
        <rect x="${torsoX - armW - 2}" y="52" width="${armW}" height="38" rx="5" fill="${appearance.jacketColor}" />
        <circle cx="${torsoX - armW / 2 - 2}" cy="92" r="5" fill="${appearance.skinTone}" />
        <rect x="${torsoX + torsoW + 2}" y="52" width="${armW}" height="38" rx="5" fill="${appearance.jacketColor}" />
        <circle cx="${torsoX + torsoW + armW / 2 + 2}" cy="92" r="5" fill="${appearance.skinTone}" />
        <!-- Torso Jacket -->
        <rect x="${torsoX}" y="50" width="${torsoW}" height="46" rx="8" fill="${appearance.jacketColor}" />
        <rect x="${torsoX + 4}" y="54" width="${torsoW - 8}" height="10" rx="3" fill="rgba(15,23,42,0.72)" />
        <!-- Legs -->
        <rect x="${60 - torsoW * 0.38}" y="95" width="${torsoW * 0.34}" height="44" rx="5" fill="${appearance.pantsColor}" />
        <rect x="${60 + torsoW * 0.04}" y="95" width="${torsoW * 0.34}" height="44" rx="5" fill="${appearance.pantsColor}" />
        <!-- Shoes -->
        <rect x="${60 - torsoW * 0.4}" y="136" width="${torsoW * 0.38}" height="9" rx="4" fill="#f8fafc" />
        <rect x="${60 + torsoW * 0.02}" y="136" width="${torsoW * 0.38}" height="9" rx="4" fill="#f8fafc" />
      </svg>
    `;
  }

  // --- Career Modal (Character Creator up to 70 pts + Circuit Career + GTA-Style Open World) ---
  private showCareerModal(initialTab?: 'creator' | 'career') {
    this.profile.careerCharacter = this.normalizeCareerCharacter(this.profile.careerCharacter);
    const charCfg = this.profile.careerCharacter;
    const draftStats: CareerCharacterStats = { ...charCfg.stats };
    const draftAppearance: CareerCharacterAppearance = { ...charCfg.appearance };

    const currentCopilot = this.profile.copilotName || CAREER_COPILOTS[0];
    const unlockedTracks = DEFAULT_TRACKS.filter((t) => t.unlocked);
    let selectedMapId =
      unlockedTracks.find((t) => t.id === this.profile.selectedTrackId)?.id ||
      unlockedTracks[0]?.id ||
      'track_city';
    let activeTab: 'creator' | 'career' =
      initialTab ?? (charCfg.created ? 'career' : 'creator');

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    this.root.appendChild(modal);

    const getUsedPoints = () =>
      draftStats.speed + draftStats.agility + draftStats.driving + draftStats.health;

    const attrDefs: Array<{
      key: keyof CareerCharacterStats;
      icon: string;
      label: string;
      desc: string;
      effectText: (val: number) => string;
      color: string;
    }> = [
      {
        key: 'speed',
        icon: '⚡',
        label: 'Velocidade',
        desc: 'Aumenta velocidade máxima e aceleração em carros, motos e corrida a pé.',
        effectText: (v) =>
          `+${Math.round((v / CAREER_ATTRIBUTE_BUDGET) * 25)}% Vel. Máx · +${Math.round((v / CAREER_ATTRIBUTE_BUDGET) * 28)}% Acel.`,
        color: '#d4a24c',
      },
      {
        key: 'agility',
        icon: '🤸',
        label: 'Agilidade',
        desc: 'Melhora resposta de curvas, altura de saltos e velocidade de recarga do Nitro.',
        effectText: (v) =>
          `+${Math.round((v / CAREER_ATTRIBUTE_BUDGET) * 26)}% Esterço · +${Math.round((v / CAREER_ATTRIBUTE_BUDGET) * 55)}% Nitro`,
        color: '#94a3b8',
      },
      {
        key: 'driving',
        icon: '🏎️',
        label: 'Qualidade para Dirigir',
        desc: 'Mais aderência lateral, frenagem precisa e multiplicador de pontos de Drift.',
        effectText: (v) =>
          `+${Math.round((v / CAREER_ATTRIBUTE_BUDGET) * 32)}% Aderência · +${Math.round((v / CAREER_ATTRIBUTE_BUDGET) * 45)}% Drift`,
        color: '#84a98c',
      },
      {
        key: 'health',
        icon: '❤️',
        label: 'Integridade Corporal (Saúde)',
        desc: 'Amplia a vida máxima (HP) e reduz o dano recebido em batidas e cercos policiais.',
        effectText: (v) =>
          `+${Math.round((v / CAREER_ATTRIBUTE_BUDGET) * 80)}% Saúde Máx · -${Math.round((v / CAREER_ATTRIBUTE_BUDGET) * 35)}% Dano`,
        color: '#c53030',
      },
    ];

    const skinSwatches = ['#f6d5b8', '#d9a06c', '#a96e44', '#6d4026', '#3d2214'];
    const jacketSwatches = ['#00d2ff', '#ef4444', '#22c55e', '#facc15', '#a855f7', '#1e293b', '#f8fafc'];
    const pantsSwatches = ['#1e293b', '#0f172a', '#334155', '#3f2e21', '#1e3a5f'];

    const renderModalContent = () => {
      const usedPts = getUsedPoints();
      const remainingPts = CAREER_ATTRIBUTE_BUDGET - usedPts;
      const savedChar = this.profile.careerCharacter!;

      modal.innerHTML = `
        <div class="modal-card extra-large-modal career-modal-shell">
          <div class="modal-header">
            <h2>🏆 MODO CARREIRA · ${activeTab === 'creator' ? 'CRIAÇÃO DE PERSONAGEM' : 'PILOTO & MUNDO ABERTO'}</h2>
            <button class="close-modal-btn" type="button">&times;</button>
          </div>

          <div class="career-top-tabs">
            <button type="button" class="career-tab-btn ${activeTab === 'creator' ? 'active' : ''}" data-career-tab="creator">
              👤 Criação de Personagem <span class="career-tab-pts">${usedPts}/${CAREER_ATTRIBUTE_BUDGET} pts</span>
            </button>
            <button type="button" class="career-tab-btn ${activeTab === 'career' ? 'active' : ''}" data-career-tab="career">
              🏁 Modos da Carreira & Corrida
            </button>
          </div>

          ${
            activeTab === 'creator'
              ? `
            <div class="char-creator-layout">
              <div class="char-preview-column">
                <div class="char-preview-stage" id="charPreviewStage">
                  ${this.renderCareerCharacterSvg(draftAppearance, 132)}
                  <div class="char-preview-identity">
                    <strong id="charPreviewName">${this.profile.name}</strong>
                    <span id="charPreviewNick">"${this.profile.nickname}" · ${this.profile.team}</span>
                  </div>
                </div>

                <div class="char-identity-inputs">
                  <div class="form-group">
                    <label>Nome do Personagem:</label>
                    <input type="text" id="creatorName" value="${this.profile.name}" class="text-input" maxlength="24" />
                  </div>
                  <div class="form-group">
                    <label>Apelido nas Ruas:</label>
                    <input type="text" id="creatorNick" value="${this.profile.nickname}" class="text-input" maxlength="16" />
                  </div>
                  <div class="form-group">
                    <label>Equipe / Facção:</label>
                    <input type="text" id="creatorTeam" value="${this.profile.team}" class="text-input" maxlength="24" />
                  </div>
                </div>

                <div class="char-appearance-box">
                  <div class="char-swatch-row">
                    <span class="swatch-label">Porte Físico:</span>
                    <div class="char-build-btns">
                      <button type="button" class="option-btn char-build-btn ${draftAppearance.build === 'lean' ? 'active' : ''}" data-build="lean">Ágil</button>
                      <button type="button" class="option-btn char-build-btn ${draftAppearance.build === 'athletic' ? 'active' : ''}" data-build="athletic">Atlético</button>
                      <button type="button" class="option-btn char-build-btn ${draftAppearance.build === 'heavy' ? 'active' : ''}" data-build="heavy">Pesado</button>
                    </div>
                  </div>
                  <div class="char-swatch-row">
                    <span class="swatch-label">Pele:</span>
                    <div class="swatch-list">
                      ${skinSwatches
                        .map(
                          (c) => `
                        <button type="button" class="char-swatch ${draftAppearance.skinTone === c ? 'active' : ''}" data-skin="${c}" style="background:${c};" aria-label="Tom de pele ${c}"></button>
                      `
                        )
                        .join('')}
                    </div>
                  </div>
                  <div class="char-swatch-row">
                    <span class="swatch-label">Jaqueta / Boné:</span>
                    <div class="swatch-list">
                      ${jacketSwatches
                        .map(
                          (c) => `
                        <button type="button" class="char-swatch ${draftAppearance.jacketColor === c ? 'active' : ''}" data-jacket="${c}" style="background:${c};" aria-label="Cor da jaqueta ${c}"></button>
                      `
                        )
                        .join('')}
                    </div>
                  </div>
                  <div class="char-swatch-row">
                    <span class="swatch-label">Calça:</span>
                    <div class="swatch-list">
                      ${pantsSwatches
                        .map(
                          (c) => `
                        <button type="button" class="char-swatch ${draftAppearance.pantsColor === c ? 'active' : ''}" data-pants="${c}" style="background:${c};" aria-label="Cor da calça ${c}"></button>
                      `
                        )
                        .join('')}
                    </div>
                  </div>
                </div>
              </div>

              <div class="char-attributes-column">
                <div class="char-budget-banner">
                  <div>
                    <div class="char-budget-kicker">DISTRIBUIÇÃO DE QUALIDADES (MÁX. 70 PONTOS)</div>
                    <div class="char-budget-sub">Invista até <strong>70 pontos</strong> nas suas qualidades de piloto para o Modo Carreira.</div>
                  </div>
                  <div class="char-budget-counter ${remainingPts === 0 ? 'is-full' : ''}">
                    <span class="budget-num" id="charRemainingPts">${remainingPts}</span>
                    <span class="budget-label">PTS LIVRES<br/><small>(${usedPts}/70 usados)</small></span>
                  </div>
                </div>

                <div class="char-presets-bar">
                  <span class="preset-title">Perfis Rápidos:</span>
                  <button type="button" class="option-btn char-preset-btn" data-preset="balanced">⚖️ Equilibrado (70)</button>
                  <button type="button" class="option-btn char-preset-btn" data-preset="speedster">⚡ Velocista</button>
                  <button type="button" class="option-btn char-preset-btn" data-preset="driver">🏎️ Rei do Volante</button>
                  <button type="button" class="option-btn char-preset-btn" data-preset="tank">🛡️ Tanque</button>
                  <button type="button" class="option-btn char-preset-btn" data-preset="reset">🔄 Zerar</button>
                </div>

                <div class="char-attrs-list">
                  ${attrDefs
                    .map((attr) => {
                      const val = draftStats[attr.key];
                      const pct = Math.round((val / CAREER_ATTRIBUTE_BUDGET) * 100);
                      return `
                        <div class="char-attr-card">
                          <div class="char-attr-top">
                            <div class="char-attr-title-wrap">
                              <span class="char-attr-icon">${attr.icon}</span>
                              <div>
                                <div class="char-attr-name">${attr.label}</div>
                                <div class="char-attr-desc">${attr.desc}</div>
                              </div>
                            </div>
                            <div class="char-attr-val-box">
                              <strong style="color:${attr.color};">${val}</strong><span>/70</span>
                            </div>
                          </div>
                          <div class="char-attr-bar-row">
                            <div class="char-attr-bar-track">
                              <div class="char-attr-bar-fill" style="width:${pct}%; background:${attr.color};"></div>
                            </div>
                            <div class="char-attr-steppers">
                              <button type="button" class="attr-step-btn" data-attr="${attr.key}" data-delta="-5" ${val <= 0 ? 'disabled' : ''}>-5</button>
                              <button type="button" class="attr-step-btn" data-attr="${attr.key}" data-delta="-1" ${val <= 0 ? 'disabled' : ''}>-</button>
                              <button type="button" class="attr-step-btn is-plus" data-attr="${attr.key}" data-delta="1" ${remainingPts <= 0 ? 'disabled' : ''}>+</button>
                              <button type="button" class="attr-step-btn is-plus" data-attr="${attr.key}" data-delta="5" ${remainingPts <= 0 ? 'disabled' : ''}>+5</button>
                            </div>
                          </div>
                          <div class="char-attr-bonus" style="color:${attr.color};">${attr.effectText(val)}</div>
                        </div>
                      `;
                    })
                    .join('')}
                </div>

                <div class="char-creator-footer">
                  <button type="button" class="primary-btn char-save-btn" id="btnSaveCareerCharacter">
                    💾 SALVAR PERSONAGEM (${usedPts}/${CAREER_ATTRIBUTE_BUDGET} PTS) & IR PARA CARREIRA
                  </button>
                </div>
              </div>
            </div>
          `
              : `
            <div class="career-form">
              <div class="career-character-summary-card">
                <div class="summary-avatar-box">
                  ${this.renderCareerCharacterSvg(savedChar.appearance, 78)}
                </div>
                <div class="summary-char-info">
                  <div class="summary-char-header">
                    <div>
                      <span class="summary-char-kicker">${savedChar.created ? '✅ PERSONAGEM DA CARREIRA ATIVO' : '⚠️ PERSONALIZE SEU PILOTO (ATÉ 70 PTS)'}</span>
                      <h3>${this.profile.name} <small>"${this.profile.nickname}"</small></h3>
                    </div>
                    <button type="button" class="secondary-btn summary-edit-btn" id="btnGoToCharacterCreator">
                      ✏️ Editar Personagem & Pontos
                    </button>
                  </div>
                  <div class="summary-attr-pills">
                    <span>⚡ Velocidade: <strong>${savedChar.stats.speed}</strong></span>
                    <span>🤸 Agilidade: <strong>${savedChar.stats.agility}</strong></span>
                    <span>🏎️ Dirigir: <strong>${savedChar.stats.driving}</strong></span>
                    <span>❤️ Saúde: <strong>${savedChar.stats.health}</strong></span>
                    <span class="summary-total-pill">Total: ${savedChar.stats.speed + savedChar.stats.agility + savedChar.stats.driving + savedChar.stats.health}/70 pts</span>
                  </div>
                </div>
              </div>

              <div class="career-form-grid">
                <div class="form-group">
                  <label>Nome do Piloto:</label>
                  <input type="text" id="careerName" value="${this.profile.name}" class="text-input" />
                </div>
                <div class="form-group">
                  <label>Apelido nas Ruas:</label>
                  <input type="text" id="careerNick" value="${this.profile.nickname}" class="text-input" />
                </div>
                <div class="form-group">
                  <label>Equipe / Facção:</label>
                  <input type="text" id="careerTeam" value="${this.profile.team}" class="text-input" />
                </div>
                <div class="form-group">
                  <label>Cidade / Mapa para Explorar:</label>
                  <div class="career-map-chips" id="careerMapChips">
                    ${unlockedTracks
                      .map(
                        (t) => `
                      <button type="button" class="option-btn career-map-chip ${t.id === selectedMapId ? 'active' : ''}" data-track-id="${t.id}">
                        ${t.name}
                      </button>
                    `
                      )
                      .join('')}
                  </div>
                </div>
              </div>

              <div class="form-group">
                <label>🎧 Copiloto (Cenas 3D de Cockpit):</label>
                <div class="copilot-chip-row">
                  ${CAREER_COPILOTS.map(
                    (cp) => `
                    <button type="button" class="option-btn copilot-chip ${currentCopilot === cp ? 'active' : ''}" data-copilot="${cp}">
                      ${cp}
                    </button>
                  `
                  ).join('')}
                </div>
                <input type="text" id="careerCopilot" value="${currentCopilot}" class="text-input" />
              </div>

              <div class="career-stats-box">
                <div><strong>Vitórias em Corridas:</strong> ${this.profile.careerWins}</div>
                <div><strong>Fugas com Sucesso:</strong> ${this.profile.totalEscapes}</div>
                <div><strong>Fugas no Mundo Aberto:</strong> ${this.profile.openWorldEscapes || 0}</div>
                <div><strong>Pacotes Clandestinos:</strong> ${this.profile.openWorldStashes || 0}</div>
                <div><strong>Viaturas Destruídas:</strong> ${this.profile.copsDestroyed}</div>
                <div><strong>Reputação:</strong> ${this.profile.repPoints} RP (Nível ${this.profile.repLevel})</div>
              </div>

              <div class="career-mode-split">
                <div class="career-mode-card career-openworld-card">
                  <div class="career-mode-kicker">NOVO · ESTILO GRAND THEFT AUTO</div>
                  <h3>🌆 Mundo Aberto da Carreira</h3>
                  <p>Liberdade total para explorar a cidade <strong>a pé</strong>, pilotar <strong>3 tipos de motos</strong> (Street, Superbike e Cross), andar de <strong>carro</strong>, <strong>bicicleta</strong> ou <strong>skate</strong>, coletar pacotes clandestinos, provocar estrelas (1★ a 5★) e limpar a ficha nas oficinas <strong>Pay & Spray</strong>!</p>
                  <button class="primary-btn career-launch-btn" id="btnStartCareerOpenWorld" type="button">🌆 ENTRAR NO MUNDO ABERTO (GTA)</button>
                </div>

                <div class="career-mode-card">
                  <div class="career-mode-kicker">CIRCUITO CLANDESTINO</div>
                  <h3>🏁 Corrida & Fuga Clássica</h3>
                  <p>Desafio focado de circuito contra o cerco policial com cenas cinematográficas completas de piloto e copiloto no início e na vitória.</p>
                  <button class="secondary-btn career-launch-btn" id="btnStartCareerRace" type="button">🏁 CORRER NO CIRCUITO</button>
                </div>
              </div>
            </div>
          `
          }
        </div>
      `;

      modal.querySelector('.close-modal-btn')?.addEventListener('click', () => modal.remove());

      modal.querySelectorAll('[data-career-tab]').forEach((tabBtn) => {
        tabBtn.addEventListener('click', () => {
          const nextTab = tabBtn.getAttribute('data-career-tab') as 'creator' | 'career';
          if (nextTab === activeTab) return;
          if (activeTab === 'creator') {
            syncCreatorTextInputs();
          } else {
            saveCareerFields();
          }
          activeTab = nextTab;
          renderModalContent();
        });
      });

      if (activeTab === 'creator') {
        const syncCreatorTextInputs = () => {
          const n = (modal.querySelector('#creatorName') as HTMLInputElement)?.value.trim();
          const k = (modal.querySelector('#creatorNick') as HTMLInputElement)?.value.trim();
          const t = (modal.querySelector('#creatorTeam') as HTMLInputElement)?.value.trim();
          if (n) this.profile.name = n;
          if (k) this.profile.nickname = k;
          if (t) this.profile.team = t;
        };

        modal.querySelector('#creatorName')?.addEventListener('input', (e) => {
          const v = (e.target as HTMLInputElement).value;
          if (v.trim()) this.profile.name = v.trim();
          const previewName = modal.querySelector('#charPreviewName');
          if (previewName) previewName.textContent = v || 'Piloto';
        });
        modal.querySelector('#creatorNick')?.addEventListener('input', (e) => {
          const v = (e.target as HTMLInputElement).value;
          if (v.trim()) this.profile.nickname = v.trim();
          const previewNick = modal.querySelector('#charPreviewNick');
          if (previewNick) previewNick.textContent = `"${v || 'Apex'}" · ${this.profile.team}`;
        });
        modal.querySelector('#creatorTeam')?.addEventListener('input', (e) => {
          const v = (e.target as HTMLInputElement).value;
          if (v.trim()) this.profile.team = v.trim();
          const previewNick = modal.querySelector('#charPreviewNick');
          if (previewNick) previewNick.textContent = `"${this.profile.nickname}" · ${v || 'Facção'}`;
        });

        modal.querySelectorAll('.char-build-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            syncCreatorTextInputs();
            draftAppearance.build = (btn.getAttribute('data-build') as CareerCharacterAppearance['build']) || 'athletic';
            renderModalContent();
          });
        });

        modal.querySelectorAll('[data-skin]').forEach((btn) => {
          btn.addEventListener('click', () => {
            syncCreatorTextInputs();
            draftAppearance.skinTone = btn.getAttribute('data-skin') || draftAppearance.skinTone;
            renderModalContent();
          });
        });

        modal.querySelectorAll('[data-jacket]').forEach((btn) => {
          btn.addEventListener('click', () => {
            syncCreatorTextInputs();
            draftAppearance.jacketColor = btn.getAttribute('data-jacket') || draftAppearance.jacketColor;
            renderModalContent();
          });
        });

        modal.querySelectorAll('[data-pants]').forEach((btn) => {
          btn.addEventListener('click', () => {
            syncCreatorTextInputs();
            draftAppearance.pantsColor = btn.getAttribute('data-pants') || draftAppearance.pantsColor;
            renderModalContent();
          });
        });

        modal.querySelectorAll('.attr-step-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            syncCreatorTextInputs();
            const key = btn.getAttribute('data-attr') as keyof CareerCharacterStats;
            const delta = parseInt(btn.getAttribute('data-delta') || '0', 10);
            if (!key || !delta) return;

            const remaining = CAREER_ATTRIBUTE_BUDGET - getUsedPoints();
            const allowedDelta = delta > 0 ? Math.min(delta, remaining) : Math.max(delta, -draftStats[key]);
            if (allowedDelta === 0) return;

            draftStats[key] = Math.max(0, Math.min(CAREER_ATTRIBUTE_BUDGET, draftStats[key] + allowedDelta));
            renderModalContent();
          });
        });

        modal.querySelectorAll('.char-preset-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            syncCreatorTextInputs();
            const preset = btn.getAttribute('data-preset');
            if (preset === 'balanced') {
              Object.assign(draftStats, { speed: 18, agility: 17, driving: 18, health: 17 });
            } else if (preset === 'speedster') {
              Object.assign(draftStats, { speed: 32, agility: 20, driving: 12, health: 6 });
            } else if (preset === 'driver') {
              Object.assign(draftStats, { speed: 18, agility: 12, driving: 32, health: 8 });
            } else if (preset === 'tank') {
              Object.assign(draftStats, { speed: 10, agility: 8, driving: 16, health: 36 });
            } else if (preset === 'reset') {
              Object.assign(draftStats, { speed: 0, agility: 0, driving: 0, health: 0 });
            }
            renderModalContent();
          });
        });

        modal.querySelector('#btnSaveCareerCharacter')?.addEventListener('click', () => {
          syncCreatorTextInputs();
          this.profile.careerCharacter = this.normalizeCareerCharacter({
            created: true,
            stats: { ...draftStats },
            appearance: { ...draftAppearance },
          });
          this.persistDurableProgress(true);
          sound.playSuccessFanfare();
          const total = getUsedPoints();
          this.showToast(`👤 Personagem ${this.profile.name} salvo com ${total}/70 pontos aplicados!`);
          activeTab = 'career';
          renderModalContent();
        });
      } else {
        const copilotInput = modal.querySelector('#careerCopilot') as HTMLInputElement;
        modal.querySelectorAll('.copilot-chip').forEach((chip) => {
          chip.addEventListener('click', () => {
            const val = chip.getAttribute('data-copilot') || CAREER_COPILOTS[0];
            if (copilotInput) copilotInput.value = val;
            modal.querySelectorAll('.copilot-chip').forEach((c) => c.classList.remove('active'));
            chip.classList.add('active');
          });
        });

        modal.querySelectorAll('.career-map-chip').forEach((chip) => {
          chip.addEventListener('click', () => {
            selectedMapId = chip.getAttribute('data-track-id') || selectedMapId;
            this.profile.selectedTrackId = selectedMapId;
            modal.querySelectorAll('.career-map-chip').forEach((c) => c.classList.remove('active'));
            chip.classList.add('active');
          });
        });

        modal.querySelector('#btnGoToCharacterCreator')?.addEventListener('click', () => {
          saveCareerFields();
          activeTab = 'creator';
          renderModalContent();
        });

        modal.querySelector('#btnStartCareerOpenWorld')?.addEventListener('click', () => {
          saveCareerFields();
          modal.remove();
          this.runModeLaunchWithLoading(
            'CARREIRA · MUNDO ABERTO',
            'Gerando mapa, personagem, motos, pontos interativos e tráfego...',
            () => {
              this.currentMode = 'career_open_world';
              this.renderHUD();
              this.onStartMode?.('career_open_world', undefined, selectedMapId);
            }
          );
        });

        modal.querySelector('#btnStartCareerRace')?.addEventListener('click', () => {
          saveCareerFields();
          modal.remove();
          this.runModeLaunchWithLoading(
            'MODO CARREIRA',
            'Montando circuito e preparando a largada...',
            () => {
              this.currentMode = 'career';
              this.renderHUD();
              this.onStartMode?.('career', undefined, selectedMapId);
            }
          );
        });
      }
    };

    const syncCreatorTextInputs = () => {
      const n = (modal.querySelector('#creatorName') as HTMLInputElement)?.value.trim();
      const k = (modal.querySelector('#creatorNick') as HTMLInputElement)?.value.trim();
      const t = (modal.querySelector('#creatorTeam') as HTMLInputElement)?.value.trim();
      if (n) this.profile.name = n;
      if (k) this.profile.nickname = k;
      if (t) this.profile.team = t;
    };

    const saveCareerFields = () => {
      const copilotEl = modal.querySelector('#careerCopilot') as HTMLInputElement | null;
      this.profile.name = (modal.querySelector('#careerName') as HTMLInputElement)?.value || this.profile.name;
      this.profile.nickname = (modal.querySelector('#careerNick') as HTMLInputElement)?.value || this.profile.nickname;
      this.profile.copilotName = copilotEl?.value.trim() || this.profile.copilotName || CAREER_COPILOTS[0];
      this.profile.team = (modal.querySelector('#careerTeam') as HTMLInputElement)?.value || this.profile.team;
      this.profile.selectedTrackId = selectedMapId;
      this.persistDurableProgress();
    };

    renderModalContent();
  }

  // --- Challenges Modal ---
  private showChallengesModal() {
    const unlockedTracks = DEFAULT_TRACKS.filter((t) => t.unlocked);
    let selectedMapId =
      unlockedTracks.find((t) => t.id === this.profile.selectedTrackId)?.id ||
      unlockedTracks[0]?.id ||
      'track_city';

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-card large-modal">
        <div class="modal-header">
          <h2>⚡ MODO DESAFIO</h2>
          <button class="close-modal-btn" type="button">&times;</button>
        </div>
        <p class="modal-desc">Teste suas habilidades extremas nas regiões de The Jounnte, The Chamed, The Laymed e The San Bernard.</p>
        <div class="form-group" style="margin-bottom:14px;">
          <label>Mapa do Desafio:</label>
          <div class="career-map-chips" id="challengeMapChips">
            ${unlockedTracks
              .map(
                (t) => `
              <button type="button" class="option-btn challenge-map-chip ${t.id === selectedMapId ? 'active' : ''}" data-track-id="${t.id}">
                ${t.name}
              </button>
            `
              )
              .join('')}
          </div>
        </div>
        <div class="challenges-list">
          ${DEFAULT_CHALLENGES.map(
            (c) => `
            <div class="challenge-row ${c.completed ? 'completed' : ''}">
              <div class="ch-info">
                <h3>${c.title} ${c.completed ? '✅' : ''}</h3>
                <p>${c.description}</p>
              </div>
              <div class="ch-rewards">
                <span>💰 R$ ${c.reward.toLocaleString()}</span>
                <span>⭐ +${c.rewardRep} RP</span>
              </div>
              <button class="play-challenge-btn primary-btn" data-id="${c.id}">JOGAR DESAFIO</button>
            </div>
          `
          ).join('')}
        </div>
      </div>
    `;
    this.root.appendChild(modal);

    modal.querySelector('.close-modal-btn')?.addEventListener('click', () => modal.remove());
    modal.querySelectorAll('.challenge-map-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        selectedMapId = chip.getAttribute('data-track-id') || selectedMapId;
        modal.querySelectorAll('.challenge-map-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });

    modal.querySelectorAll('.play-challenge-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = parseInt((e.currentTarget as HTMLElement).getAttribute('data-id') || '1');
        modal.remove();
        this.runModeLaunchWithLoading(
          `DESAFIO #${id}`,
          'Posicionando bloqueios policiais e pista de alta velocidade...',
          () => {
            this.currentMode = 'challenge';
            this.onStartMode?.('challenge', undefined, selectedMapId);
            this.renderHUD();
          }
        );
      });
    });
  }

  // --- Real Online Multiplayer Modal (WebSocket + 4-Digit Room Codes) ---
  private showMultiplayerModal() {
    if (!networkStatus.isOnline) {
      this.showToast('🔒 Sem Wi-Fi ou Dados Móveis. Conecte-se para acessar servidores online!');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-card large-modal">
        <div class="modal-header">
          <h2>🌐 SERVIDORES PÚBLICOS & ONLINE (TEMPO LIMITADO)</h2>
          <button class="close-modal-btn">&times;</button>
        </div>
        <div class="mp-server-status-bar">
          <span id="mpServerStatusPill" class="mp-conn-pill">🔄 Conectando ao servidor WebSocket...</span>
          <button class="option-btn" id="btnRefreshRooms">🔄 Atualizar Salas</button>
        </div>
        <p class="modal-desc">Servidores públicos oficiais expiram a cada 1 hora e resetam. Pilotos de <strong>Nível 50 ou superior</strong> podem estender a sessão em +30 minutos!</p>
        
        <div class="mp-tabs">
          <div class="mp-box">
            <h3>CRIAR SALA PRIVADA</h3>
            <p>Gere um código de 4 números para convidar amigos:</p>
            <button class="primary-btn" id="btnCreateRoom">CRIAR SALA PRIVADA</button>
          </div>

          <div class="mp-box">
            <h3>ENTRAR POR CÓDIGO</h3>
            <p>Digite o código de 4 números de uma sala:</p>
            <div class="code-input-row">
              <input type="text" maxlength="4" placeholder="Ex: 1001" id="roomCodeInput" class="code-input" />
              <button class="primary-btn" id="btnJoinRoom">ENTRAR</button>
            </div>
          </div>
        </div>

        <div class="mp-public-rooms-section">
          <h4>🏛️ SERVIDORES PÚBLICOS OFICIAIS & SALAS ATIVAS</h4>
          <div id="publicRoomsList" class="players-list-box">
            <div class="player-entry"><span>Carregando servidores públicos...</span></div>
          </div>
        </div>

        <div id="roomDetailsArea" style="display:none;" class="room-details-area">
          <div class="room-code-badge" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <span>SALA / SERVIDOR: <strong id="displayRoomCode">----</strong></span>
            <span id="displaySessionTimer" style="font-size:0.85rem; color:#e5b963;">⏳ Tempo Restante: --:--</span>
          </div>
          <div id="sessionBonusInfo" style="font-size:0.8rem; color:#d4a24c; margin-bottom:6px;"></div>
          <h4>PILOTOS REAIS CONECTADOS NA SALA</h4>
          <div id="roomPlayersList" class="players-list-box"></div>
          <div class="mp-room-actions" style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="option-btn" id="btnExtendSession" title="Estender +30 min (Requer Nível 50)">⏳ Estender Sessão (+30m | Nível 50+)</button>
            <button class="primary-btn start-mp-btn" id="btnLaunchMpRace">INICIAR CORRIDA ONLINE</button>
            <button class="secondary-btn" id="btnLeaveRoom">Sair da Sala</button>
          </div>
        </div>
      </div>
    `;
    this.root.appendChild(modal);

    const statusPill = modal.querySelector('#mpServerStatusPill') as HTMLElement;
    const roomDetailsArea = modal.querySelector('#roomDetailsArea') as HTMLElement;
    const displayRoomCode = modal.querySelector('#displayRoomCode') as HTMLElement;
    const displaySessionTimer = modal.querySelector('#displaySessionTimer') as HTMLElement;
    const sessionBonusInfo = modal.querySelector('#sessionBonusInfo') as HTMLElement;
    const roomPlayersList = modal.querySelector('#roomPlayersList') as HTMLElement;
    const publicRoomsList = modal.querySelector('#publicRoomsList') as HTMLElement;
    const launchBtn = modal.querySelector('#btnLaunchMpRace') as HTMLButtonElement;

    const updateStatusPill = () => {
      if (!statusPill) return;
      if (this.mpManager.connectionStatus === 'connected') {
        statusPill.innerText = '🟢 Conectado ao Servidor Online (/ws)';
        statusPill.className = 'mp-conn-pill is-connected';
      } else if (this.mpManager.connectionStatus === 'connecting') {
        statusPill.innerText = '🟡 Conectando ao servidor WebSocket...';
        statusPill.className = 'mp-conn-pill is-connecting';
      } else {
        statusPill.innerText = '🔴 Desconectado do Servidor';
        statusPill.className = 'mp-conn-pill is-disconnected';
      }
    };

    const formatTime = (sec: number): string => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const renderPublicRooms = async () => {
      const rooms = await this.mpManager.fetchPublicRooms();
      if (!publicRoomsList) return;
      if (rooms.length === 0) {
        publicRoomsList.innerHTML = `<div class="player-entry"><span>Nenhuma sala aberta no momento.</span></div>`;
        return;
      }
      publicRoomsList.innerHTML = rooms
        .map((r) => {
          const timeStr = r.timeRemainingSec !== undefined ? formatTime(r.timeRemainingSec) : '60:00';
          const badge = r.isOfficial ? '🏛️ SERVIDOR OFICIAL PÚBLICO' : '🔑 SALA PRIVADA';
          const bonusText = r.bonusUnlockedBy ? ` | Bônus: ${r.bonusUnlockedBy}` : '';
          return `
          <div class="player-entry" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div>
              <strong>#${r.code}</strong> ${r.name || r.hostName} <span style="color:#d4a24c; font-size:0.75rem;">(${badge})</span><br/>
              <span style="font-size:0.8rem; opacity:0.8;">⏱️ Expira em: ${timeStr} · 👥 ${r.playerCount}/8 pilotos${bonusText}</span>
            </div>
            <button class="option-btn quick-join-btn" data-code="${r.code}">Entrar</button>
          </div>
        `;
        })
        .join('');

      publicRoomsList.querySelectorAll('.quick-join-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const code = btn.getAttribute('data-code') || '';
          const activeCar = DEFAULT_VEHICLES.find((v) => v.id === this.profile.selectedCarId) || DEFAULT_VEHICLES[0];
          const res = await this.mpManager.joinRoom(code, this.profile.name, activeCar.id, activeCar.name, activeCar.color);
          if (res.success) {
            updateRoomUI();
            void renderPublicRooms();
          } else {
            this.showToast(res.error || 'Não foi possível entrar na sala.');
          }
        });
      });
    };

    const updateRoomUI = () => {
      if (!this.mpManager.currentRoom) {
        roomDetailsArea.style.display = 'none';
        return;
      }
      roomDetailsArea.style.display = 'block';
      const r = this.mpManager.currentRoom;
      displayRoomCode.innerText = `${r.code} ${r.name ? '- ' + r.name : ''}`;
      if (r.timeRemainingSec !== undefined && displaySessionTimer) {
        displaySessionTimer.innerText = `⏳ Tempo Restante: ${formatTime(r.timeRemainingSec)}`;
      }
      if (sessionBonusInfo) {
        sessionBonusInfo.innerText = r.bonusUnlockedBy ? `✨ Sessão estendida por ${r.bonusUnlockedBy} (Piloto Nível 50+)` : '';
      }

      const localPlayer = r.players.find((p) => p.isLocal);
      const isHost = Boolean(localPlayer?.isHost || r.isOfficial);
      if (launchBtn) {
        launchBtn.disabled = !isHost && !r.isOfficial;
        launchBtn.innerText = r.isOfficial ? 'INICIAR CORRIDA OFICIAL' : (isHost ? 'INICIAR CORRIDA ONLINE' : 'AGUARDANDO LÍDER INICIAR...');
      }
      roomPlayersList.innerHTML = r.players
        .map(
          (p, idx) => `
        <div class="player-entry">
          <span>#${idx + 1} <strong>${p.name}</strong> ${p.isHost ? '(Líder)' : ''} ${p.isLocal ? '(Você)' : ''}</span>
          <span>Carro: ${p.carName}</span>
          <span class="status-ready">${p.isReady ? 'PRONTO' : 'AGUARDANDO'}</span>
        </div>
      `
        )
        .join('');
    };

    this.mpManager.onConnectionChange = () => updateStatusPill();
    this.mpManager.onRoomUpdate = () => updateRoomUI();
    this.mpManager.onError = (msg) => this.showToast(`⚠️ ${msg}`);
    this.mpManager.onRaceStarted = (room) => {
      modal.remove();
      this.runModeLaunchWithLoading(
        `MULTIPLAYER · SALA ${room.code}`,
        'Sincronizando pista e pilotos conectados...',
        () => {
          this.currentMode = 'multiplayer';
          this.onStartMode?.('multiplayer', undefined, room.trackId || 'track_city');
          this.renderHUD();
        },
        () => {
          this.showToast(`🏁 Corrida Online iniciada na Sala ${room.code}!`);
        }
      );
    };

    void this.mpManager
      .connect()
      .then(() => {
        updateStatusPill();
        updateRoomUI();
        void renderPublicRooms();
      })
      .catch((err) => {
        updateStatusPill();
        this.showToast((err as Error).message || 'Erro ao conectar no servidor.');
      });

    modal.querySelector('.close-modal-btn')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#btnRefreshRooms')?.addEventListener('click', () => void renderPublicRooms());

    modal.querySelector('#btnCreateRoom')?.addEventListener('click', async () => {
      const activeCar = DEFAULT_VEHICLES.find((v) => v.id === this.profile.selectedCarId) || DEFAULT_VEHICLES[0];
      const res = await this.mpManager.createRoom(
        this.profile.name,
        activeCar.id,
        activeCar.name,
        activeCar.color,
        this.profile.selectedTrackId
      );
      if (res.success) {
        updateRoomUI();
        void renderPublicRooms();
        this.showToast(`🌐 Sala Online #${res.room?.code} criada! Compartilhe o código.`);
      } else {
        this.showToast(res.error || 'Erro ao criar sala online.');
      }
    });

    modal.querySelector('#btnJoinRoom')?.addEventListener('click', async () => {
      const code = (modal.querySelector('#roomCodeInput') as HTMLInputElement).value;
      const activeCar = DEFAULT_VEHICLES.find((v) => v.id === this.profile.selectedCarId) || DEFAULT_VEHICLES[0];
      const res = await this.mpManager.joinRoom(code, this.profile.name, activeCar.id, activeCar.name, activeCar.color);
      if (res.success) {
        updateRoomUI();
        void renderPublicRooms();
      } else {
        this.showToast(res.error || 'Sala não encontrada ou código inválido.');
      }
    });

    modal.querySelector('#btnExtendSession')?.addEventListener('click', () => {
      if (this.profile.repLevel < 50) {
        this.showToast(`⚠️ Nível insuficiente (${this.profile.repLevel}/50)! É necessário Nível 50 (alto) para estender a sessão do servidor.`);
        return;
      }
      this.mpManager.extendSession(this.profile.repLevel, this.profile.name);
      this.showToast(`⏳ Sessão estendida em +30 minutos por ${this.profile.name} (Nível ${this.profile.repLevel})!`);
    });

    modal.querySelector('#btnLeaveRoom')?.addEventListener('click', () => {
      this.mpManager.leaveRoom();
      updateRoomUI();
      void renderPublicRooms();
    });

    modal.querySelector('#btnLaunchMpRace')?.addEventListener('click', () => {
      if (!this.mpManager.currentRoom) return;
      this.mpManager.startRoomRace();
    });
  }

  // --- Garage & Customization Modal ---
  private showGarageModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';

    let selectedVehicle = DEFAULT_VEHICLES.find((v) => v.id === this.profile.selectedCarId) || DEFAULT_VEHICLES[0];

    const renderGarageContent = () => {
      modal.innerHTML = `
        <div class="modal-card extra-large-modal">
          <div class="modal-header">
            <h2>🚗 GARAGEM & PERSONALIZAÇÃO DE CARRO</h2>
            <button class="close-modal-btn">&times;</button>
          </div>
          <div class="garage-layout">
            <div class="vehicle-picker-col">
              <h3>MODELOS DE CARROS</h3>
              <div class="cars-scroller">
                ${DEFAULT_VEHICLES.map(
                  (v) => `
                  <div class="car-card-select ${v.id === selectedVehicle.id ? 'selected' : ''}" data-id="${v.id}">
                    <h4>${v.name}</h4>
                    <p>Cat: ${v.category.toUpperCase()} | Top: ${v.topSpeed} km/h</p>
                    <span class="price-tag">${v.unlocked ? 'ADQUIRIDO' : `R$ ${v.price.toLocaleString()}`}</span>
                  </div>
                `
                ).join('')}
              </div>
            </div>

            <div class="vehicle-tuning-col">
              <h3>CUSTOMIZAÇÃO: ${selectedVehicle.name}</h3>
              
              <div class="tuning-section">
                <label>Cor da Pintura:</label>
                <div class="color-swatches">
                  ${['#e63946', '#00f0ff', '#ffd60a', '#9d4edd', '#2b2d42', '#ffffff', '#00ff88', '#ff0055']
                    .map(
                      (c) => `
                    <div class="color-dot ${selectedVehicle.color === c ? 'active' : ''}" style="background:${c};" data-color="${c}"></div>
                  `
                    )
                    .join('')}
                </div>
              </div>

              <div class="tuning-section">
                <label>Luz Neon Sub-carro (Underglow):</label>
                <div class="toggle-row">
                  <button class="toggle-btn ${selectedVehicle.neonEnabled ? 'active' : ''}" id="toggleNeon">
                    ${selectedVehicle.neonEnabled ? 'NEON: LIGADO' : 'NEON: DESLIGADO'}
                  </button>
                  <div class="color-swatches">
                    ${['#00f0ff', '#ff0055', '#ffd60a', '#00ff88', '#aa00ff']
                      .map(
                        (c) => `
                      <div class="neon-dot ${selectedVehicle.neonColor === c ? 'active' : ''}" style="background:${c};" data-neon="${c}"></div>
                    `
                      )
                      .join('')}
                  </div>
                </div>
              </div>

              <div class="tuning-section">
                <label>Aerofólio Traseiro (Spoiler):</label>
                <div class="spoilers-row">
                  ${['Sem Aerofólio', 'Sport Wing', 'GT Carbon Wing', 'Drag Wing']
                    .map(
                      (name, idx) => `
                    <button class="option-btn ${selectedVehicle.spoilerStyle === idx ? 'active' : ''}" data-spoiler="${idx}">${name}</button>
                  `
                    )
                    .join('')}
                </div>
              </div>

              <div class="tuning-section">
                <label>Upgrades Mecânicos (Nível Máximo 5):</label>
                <div class="upgrades-grid">
                  <div class="upgrade-item">
                    <span>Motor Turbo (Nível ${selectedVehicle.levelEngine})</span>
                    <button class="upgrade-btn" data-upgrade="engine">MELHORAR (R$ 8.000)</button>
                  </div>
                  <div class="upgrade-item">
                    <span>Suspensão & Grip (Nível ${selectedVehicle.levelHandling})</span>
                    <button class="upgrade-btn" data-upgrade="handling">MELHORAR (R$ 6.500)</button>
                  </div>
                  <div class="upgrade-item">
                    <span>Blindagem / Carroceria (Nível ${selectedVehicle.levelArmor})</span>
                    <button class="upgrade-btn" data-upgrade="armor">MELHORAR (R$ 7.000)</button>
                  </div>
                </div>
              </div>

              <div class="garage-footer-actions">
                ${
                  selectedVehicle.unlocked
                    ? `<button class="primary-btn equip-car-btn">EQUIPAR ESTE CARRO</button>`
                    : `<button class="primary-btn buy-car-btn">COMPRAR POR R$ ${selectedVehicle.price.toLocaleString()}</button>`
                }
              </div>
            </div>
          </div>
        </div>
      `;

      // Bindings
      modal.querySelector('.close-modal-btn')?.addEventListener('click', () => modal.remove());

      modal.querySelectorAll('.car-card-select').forEach((el) => {
        el.addEventListener('click', () => {
          const id = el.getAttribute('data-id');
          selectedVehicle = DEFAULT_VEHICLES.find((v) => v.id === id) || selectedVehicle;
          renderGarageContent();
        });
      });

      modal.querySelectorAll('.color-dot').forEach((el) => {
        el.addEventListener('click', () => {
          selectedVehicle.color = el.getAttribute('data-color') || selectedVehicle.color;
          this.onVehicleChanged?.(selectedVehicle);
          this.persistDurableProgress();
          renderGarageContent();
        });
      });

      modal.querySelectorAll('.neon-dot').forEach((el) => {
        el.addEventListener('click', () => {
          selectedVehicle.neonColor = el.getAttribute('data-neon') || selectedVehicle.neonColor;
          this.onVehicleChanged?.(selectedVehicle);
          this.persistDurableProgress();
          renderGarageContent();
        });
      });

      modal.querySelector('#toggleNeon')?.addEventListener('click', () => {
        selectedVehicle.neonEnabled = !selectedVehicle.neonEnabled;
        this.onVehicleChanged?.(selectedVehicle);
        this.persistDurableProgress();
        renderGarageContent();
      });

      modal.querySelectorAll('.option-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          selectedVehicle.spoilerStyle = parseInt(btn.getAttribute('data-spoiler') || '0');
          this.onVehicleChanged?.(selectedVehicle);
          this.persistDurableProgress();
          renderGarageContent();
        });
      });

      modal.querySelectorAll('.upgrade-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const type = btn.getAttribute('data-upgrade');
          if (this.profile.cash >= 7000) {
            this.profile.cash -= 7000;
            let upgradeName = 'Upgrade Mecânico';
            if (type === 'engine' && selectedVehicle.levelEngine < 5) {
              selectedVehicle.levelEngine++;
              upgradeName = `Motor Turbo Nível ${selectedVehicle.levelEngine}`;
            }
            if (type === 'handling' && selectedVehicle.levelHandling < 5) {
              selectedVehicle.levelHandling++;
              upgradeName = `Suspensão & Pneus Nível ${selectedVehicle.levelHandling}`;
            }
            if (type === 'armor' && selectedVehicle.levelArmor < 5) {
              selectedVehicle.levelArmor++;
              upgradeName = `Blindagem Nível ${selectedVehicle.levelArmor}`;
            }
            this.onVehicleChanged?.(selectedVehicle);
            this.achievements.recordUpgradeInstalled();
            this.persistDurableProgress();
            modal.remove();
            this.onPlayCinematicScene?.('upgrade', selectedVehicle, upgradeName);
          } else {
            this.showToast('💰 Dinheiro insuficiente para realizar este upgrade!');
          }
        });
      });

      modal.querySelector('.equip-car-btn')?.addEventListener('click', () => {
        this.profile.selectedCarId = selectedVehicle.id;
        this.onVehicleChanged?.(selectedVehicle);
        this.persistDurableProgress();
        modal.remove();
        this.renderTitleScreen();
      });

      modal.querySelector('.buy-car-btn')?.addEventListener('click', () => {
        if (this.profile.cash >= selectedVehicle.price) {
          this.profile.cash -= selectedVehicle.price;
          selectedVehicle.unlocked = true;
          this.profile.selectedCarId = selectedVehicle.id;
          this.onVehicleChanged?.(selectedVehicle);
          this.achievements.recordCarUnlocked(DEFAULT_VEHICLES.filter((v) => v.unlocked).length);
          this.persistDurableProgress();
          modal.remove();
          this.onPlayCinematicScene?.('purchase', selectedVehicle, `Novo Carro Adquirido: ${selectedVehicle.name}`);
        } else {
          this.showToast('💰 Dinheiro insuficiente para comprar este veículo!');
        }
      });
    };

    this.root.appendChild(modal);
    renderGarageContent();
  }

  // --- Server Active Rooms & Online Leaderboard Modal ---
  private async showLeaderboardModal() {
    if (!networkStatus.isOnline) {
      this.showToast('🔒 Sem Wi-Fi ou Dados Móveis. Conecte-se para ver as salas online!');
      return;
    }
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h2>🌐 SALAS & PLACAR DO SERVIDOR ONLINE</h2>
          <button class="close-modal-btn">&times;</button>
        </div>
        <div class="leaderboard-tabs">
          <h3>TOP PILOTOS NO SERVIDOR</h3>
          <div class="leaderboard-table-wrap">
            <div id="serverBoardLoading" class="drive-loading-state">Carregando dados reais do servidor...</div>
            <table class="leaderboard-table" id="serverBoardTable" style="display:none;">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Piloto</th>
                  <th>Carro</th>
                  <th>Modo / Selo</th>
                  <th>Reputação</th>
                  <th>Atualizado</th>
                </tr>
              </thead>
              <tbody id="serverBoardBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    this.root.appendChild(modal);
    modal.querySelector('.close-modal-btn')?.addEventListener('click', () => modal.remove());

    const board = await MultiplayerRoomManager.fetchServerLeaderboard();
    const loadingEl = modal.querySelector('#serverBoardLoading') as HTMLElement;
    const tableEl = modal.querySelector('#serverBoardTable') as HTMLElement;
    const bodyEl = modal.querySelector('#serverBoardBody') as HTMLElement;
    if (loadingEl && tableEl && bodyEl) {
      loadingEl.style.display = 'none';
      tableEl.style.display = 'table';
      bodyEl.innerHTML =
        board.length > 0
          ? board
              .map(
                (entry) => `
              <tr>
                <td>${entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}</td>
                <td><strong>${entry.pilotName}</strong></td>
                <td>${entry.car}</td>
                <td>${entry.mode}</td>
                <td>${entry.scoreOrTime}</td>
                <td>${entry.date}</td>
              </tr>
            `
              )
              .join('')
          : `<tr><td colspan="6">Nenhum registro online encontrado ainda.</td></tr>`;
    }
  }

  // --- Google Drive Cloud Save Modal ---
  public showDriveCloudSaveModal() {
    document.getElementById('DriveCloudSaveModalOverlay')?.remove();
    const modal = document.createElement('div');
    modal.id = 'DriveCloudSaveModalOverlay';
    modal.className = 'modal-backdrop';

    const renderContent = async () => {
      if (!this.googleUser) {
        modal.innerHTML = `
          <div class="modal-card">
            <div class="modal-header">
              <h2>☁️ SALVAR NA NUVEM · GOOGLE DRIVE</h2>
              <button class="close-modal-btn">&times;</button>
            </div>
            <div class="cloud-auth-prompt">
              <div class="cloud-hero-icon">🔒</div>
              <h3>CONECTE SUA CONTA GOOGLE (1-CLIQUE)</h3>
              <p class="modal-desc">
                Substituímos o cadastro manual por autenticação segura do Google. Conecte sua conta para salvar suas moedas, carros tunados e capítulos da história diretamente no seu <strong>Google Drive</strong> e competir no ranking do <strong>Google Sheets</strong>.
              </p>
              <div class="cloud-benefits-grid">
                <div class="benefit-item">
                  <span class="benefit-icon">☁️</span>
                  <div>
                    <strong>Backup Seguro no Drive</strong>
                    <p>O jogo grava apenas seu arquivo de save <code>outlaw_velocity_cloud_save.json</code> na pasta privada do app.</p>
                  </div>
                </div>
                <div class="benefit-item">
                  <span class="benefit-icon">📱</span>
                  <div>
                    <strong>Jogue em Qualquer Lugar</strong>
                    <p>Acesse seu progresso em qualquer celular ou PC com seu login Google.</p>
                  </div>
                </div>
                <div class="benefit-item">
                  <span class="benefit-icon">📊</span>
                  <div>
                    <strong>Ranking Global em Tempo Real</strong>
                    <p>Participe do ranking mundial transmitido via Google Sheets API com selo de piloto verificado.</p>
                  </div>
                </div>
              </div>
              <div class="cloud-login-action">
                <button class="gsi-material-button large-google-btn" id="btnModalGoogleLogin" type="button">
                  <div class="gsi-material-button-state"></div>
                  <div class="gsi-material-button-content-wrapper">
                    <div class="gsi-material-button-icon">
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="display: block;">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.79l7.97-6.2z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                      </svg>
                    </div>
                    <span class="gsi-material-button-contents">Conectar com Google e Ativar Nuvem</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        `;
        modal.querySelector('.close-modal-btn')?.addEventListener('click', () => modal.remove());
        modal.querySelector('#btnModalGoogleLogin')?.addEventListener('click', async () => {
          if (!networkStatus.isOnline) {
            this.showToast('🔒 Conecte Wi-Fi ou Dados Móveis para fazer login Google.');
            return;
          }
          try {
            const { user } = await googleSignIn();
            sound.playSuccessFanfare();
            this.googleUser = getCurrentUserProfile();
            if (user.displayName) this.profile.name = user.displayName;
            const bypassed = this.handleGoogleVeteranBypass(true);
            this.persistDurableProgress(true);
            if (!bypassed) {
              this.showToast(`Conectado com sucesso como ${user.displayName || user.email}!`);
            }
            renderContent();
            this.refreshActiveMenuScreen(true);
          } catch (err) {
            this.showToast(`Falha no login Google: ${(err as Error).message || err}`);
          }
        });
        return;
      }

      // Logged in user: Show Drive Cloud Save Hub
      modal.innerHTML = `
        <div class="modal-card large-modal">
          <div class="modal-header">
            <h2>☁️ PAINEL DE SINCRONIZAÇÃO · GOOGLE DRIVE</h2>
            <button class="close-modal-btn">&times;</button>
          </div>
          
          <div class="cloud-user-header">
            <img src="${this.googleUser.photoURL || 'https://lh3.googleusercontent.com/a/default-user'}" alt="Avatar" class="cloud-user-pic" referrerpolicy="no-referrer" />
            <div class="cloud-user-details">
              <h3>${this.googleUser.displayName || 'Piloto Google'}</h3>
              <p>${this.googleUser.email || 'Conta Google'} · <span class="text-neon-cyan">Sessão Segura Google Auth</span></p>
            </div>
            <button class="small-btn-secondary" id="btnModalDisconnect">Trocar Conta</button>
          </div>

          <div class="cloud-sync-status-grid">
            <div class="sync-card">
              <h4>📱 PROGRESSO LOCAL ATUAL</h4>
              <ul class="sync-info-list">
                <li><span>Piloto:</span> <strong>${this.profile.name} (${this.profile.nickname})</strong></li>
                <li><span>Dinheiro Disponível:</span> <strong>R$ ${this.profile.cash.toLocaleString()}</strong></li>
                <li><span>Reputação:</span> <strong>Nível ${this.profile.repLevel} (${this.profile.repPoints} pts)</strong></li>
                <li><span>Capítulo da História:</span> <strong>Capítulo ${this.profile.storyChapter}</strong></li>
                <li><span>Garagem:</span> <strong>${DEFAULT_VEHICLES.filter((v) => v.unlocked).length} de ${DEFAULT_VEHICLES.length} carros desbloqueados</strong></li>
              </ul>
            </div>

            <div class="sync-card" id="driveCloudStatusCard">
              <h4>☁️ BACKUP NO GOOGLE DRIVE</h4>
              <div id="driveFileLoading" class="drive-loading-state">
                <span class="mini-spinner"></span> Consultando Google Drive...
              </div>
              <div id="driveFileDetails" style="display:none;"></div>
            </div>
          </div>

          <div class="cloud-actions-row">
            <button class="primary-btn cloud-action-btn" id="btnSaveToCloud">
              💾 SALVAR PROGRESSO NO GOOGLE DRIVE
            </button>
            <button class="secondary-btn cloud-action-btn" id="btnLoadFromCloud">
              📥 CARREGAR DO GOOGLE DRIVE
            </button>
          </div>
        </div>
      `;

      modal.querySelector('.close-modal-btn')?.addEventListener('click', () => modal.remove());
      modal.querySelector('#btnModalDisconnect')?.addEventListener('click', async () => {
        await googleSignOut();
        this.googleUser = null;
        this.refreshActiveMenuScreen(true);
        renderContent();
      });

      // Query Drive File in background
      try {
        const fileInfo = await GoogleDriveSaveService.findSaveFile();
        const loadingEl = modal.querySelector('#driveFileLoading') as HTMLElement;
        const detailsEl = modal.querySelector('#driveFileDetails') as HTMLElement;
        if (loadingEl && detailsEl) {
          loadingEl.style.display = 'none';
          detailsEl.style.display = 'block';
          if (fileInfo) {
            const dateStr = fileInfo.modifiedTime
              ? new Date(fileInfo.modifiedTime).toLocaleString('pt-BR')
              : 'Recentemente';
            detailsEl.innerHTML = `
              <div class="cloud-file-found">
                <span class="file-status-badge">✅ BACKUP ENCONTRADO</span>
                <p><strong>Arquivo:</strong> <code>${fileInfo.name}</code></p>
                <p><strong>Última Sincronização:</strong> ${dateStr}</p>
                <p><strong>ID Drive:</strong> <code>${fileInfo.id.slice(0, 12)}...</code></p>
                <span class="cloud-ready-badge">Disponível para restaurar a qualquer momento</span>
              </div>
            `;
          } else {
            detailsEl.innerHTML = `
              <div class="cloud-file-empty">
                <span class="file-status-badge badge-warning">ℹ️ NENHUM BACKUP AINDA</span>
                <p>Ainda não há save gravado no seu Google Drive.</p>
                <p>Clique em <strong>"Salvar Progresso no Google Drive"</strong> para criar sua primeira cópia segura.</p>
              </div>
            `;
          }
        }
      } catch (err) {
        const loadingEl = modal.querySelector('#driveFileLoading') as HTMLElement;
        if (loadingEl) {
          loadingEl.innerHTML = `⚠️ Não foi possível verificar o Drive: ${(err as Error).message || err}`;
        }
      }

      // Save Action with Mandatory User Confirmation
      modal.querySelector('#btnSaveToCloud')?.addEventListener('click', () => {
        this.showConfirmationModal(
          '💾 Salvar no Google Drive',
          `Deseja salvar seu progresso atual no Google Drive da conta <strong>${this.googleUser?.email || ''}</strong>?<br><br>Isso atualizará o arquivo <code>outlaw_velocity_cloud_save.json</code> com seu saldo atual de R$ ${this.profile.cash.toLocaleString()}, veículos desbloqueados e conquistas.`,
          async () => {
            try {
              const saveBtn = modal.querySelector('#btnSaveToCloud') as HTMLButtonElement;
              if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Enviando ao Drive...';
              }
              const result = await GoogleDriveSaveService.saveToDrive(
                this.profile,
                DEFAULT_VEHICLES,
                DEFAULT_TRACKS,
                DEFAULT_CHALLENGES,
                this.googleUser?.email || null,
                this.achievements.exportData()
              );
              sound.playSuccessFanfare();
              this.showToast(`✅ Progresso salvo no Google Drive! (ID: ${result.fileId.slice(0, 8)}...)`);
              renderContent();
            } catch (err) {
              this.showToast(`Erro ao salvar no Drive: ${(err as Error).message || err}`);
              renderContent();
            }
          }
        );
      });

      // Load Action with Mandatory User Confirmation
      modal.querySelector('#btnLoadFromCloud')?.addEventListener('click', () => {
        this.showConfirmationModal(
          '📥 Carregar do Google Drive',
          '<strong>Atenção:</strong> Restaurar o save do Google Drive substituirá os dados locais atuais (dinheiro, carros equipados e conquistas) pelo backup da nuvem.<br><br>Deseja continuar?',
          async () => {
            try {
              const loadBtn = modal.querySelector('#btnLoadFromCloud') as HTMLButtonElement;
              if (loadBtn) {
                loadBtn.disabled = true;
                loadBtn.textContent = 'Baixando do Drive...';
              }
              const data = await GoogleDriveSaveService.loadFromDrive();
              this.profile = data.profile;
              // Synchronize default vehicles if present in save
              if (data.vehicles && data.vehicles.length > 0) {
                data.vehicles.forEach((savedV) => {
                  const localV = DEFAULT_VEHICLES.find((v) => v.id === savedV.id);
                  if (localV) {
                    Object.assign(localV, savedV);
                  }
                });
              }
              if (data.tracks && data.tracks.length > 0) {
                data.tracks.forEach((savedT) => {
                  const localT = DEFAULT_TRACKS.find((t) => t.id === savedT.id);
                  if (localT) Object.assign(localT, savedT);
                });
              }
              if (data.challenges && data.challenges.length > 0) {
                data.challenges.forEach((savedC) => {
                  const localC = DEFAULT_CHALLENGES.find((c) => c.id === savedC.id);
                  if (localC) Object.assign(localC, savedC);
                });
              }
              if (data.achievementData) {
                this.achievements.importData(data.achievementData);
              }

              this.persistDurableProgress();
              this.onCloudSaveRestored?.(data);
              sound.playSuccessFanfare();
              modal.remove();
              this.refreshActiveMenuScreen(false);
              this.showToast('✅ Progresso restaurado do Google Drive com sucesso!');
            } catch (err) {
              this.showToast(`Erro ao carregar do Drive: ${(err as Error).message || err}`);
              renderContent();
            }
          }
        );
      });
    };

    this.root.appendChild(modal);
    renderContent();
  }

  // --- Live Google Sheets Leaderboard Modal ---
  public showLiveRankingModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';

    const renderRanking = async () => {
      const activeCar = DEFAULT_VEHICLES.find((v) => v.id === this.profile.selectedCarId) || DEFAULT_VEHICLES[0];
      modal.innerHTML = `
        <div class="modal-card extra-large-modal">
          <div class="modal-header">
            <h2>🏆 RANKING GLOBAL AO VIVO · GOOGLE SHEETS</h2>
            <button class="close-modal-btn">&times;</button>
          </div>
          
          <div class="ranking-header-bar">
            <div>
              <p class="modal-desc">
                Placar mundial sincronizado via <strong>Google Sheets API</strong> e <strong>Google Auth</strong>. Ganhe pontos de reputação vencendo perseguições e Street Racings para subir no ranking.
              </p>
              ${
                this.googleUser
                  ? `<span class="ranking-auth-badge">✅ Conectado como <strong>${this.googleUser.displayName}</strong> (${this.googleUser.email})</span>`
                  : `<span class="ranking-auth-badge badge-warning">ℹ️ Modo Convidado. Conecte com o Google para registrar seu nome e avatar oficial.</span>`
              }
            </div>
            <button class="primary-btn" id="btnRefreshRanking">🔄 Atualizar Placar</button>
          </div>

          <div class="leaderboard-table-wrap">
            <div id="rankingLoading" class="drive-loading-state">
              <span class="mini-spinner"></span> Carregando placar global ao vivo...
            </div>
            <table class="leaderboard-table" id="liveRankingTable" style="display:none;">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Piloto</th>
                  <th>País</th>
                  <th>Carro Favorito</th>
                  <th>Pontos Rep</th>
                  <th>Vel. Máx</th>
                  <th>Viaturas Destruídas</th>
                  <th>Status / Título</th>
                </tr>
              </thead>
              <tbody id="rankingTableBody"></tbody>
            </table>
          </div>

          <div class="ranking-footer-actions">
            <button class="dock-btn" id="btnOpenLocalRooms">📋 Ver Salas Privadas (4 Dígitos)</button>
            ${
              !this.googleUser
                ? `<button class="gsi-material-button" id="btnRankingGoogleLogin">
                    <div class="gsi-material-button-state"></div>
                    <div class="gsi-material-button-content-wrapper">
                      <div class="gsi-material-button-icon">
                        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="display: block;">
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.79l7.97-6.2z"></path>
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                          <path fill="none" d="M0 0h48v48H0z"></path>
                        </svg>
                      </div>
                      <span class="gsi-material-button-contents">Entrar com Google para Salvar Posição</span>
                    </div>
                  </button>`
                : ''
            }
          </div>
        </div>
      `;

      modal.querySelector('.close-modal-btn')?.addEventListener('click', () => modal.remove());
      modal.querySelector('#btnRefreshRanking')?.addEventListener('click', () => renderRanking());
      modal.querySelector('#btnOpenLocalRooms')?.addEventListener('click', () => {
        modal.remove();
        this.showLeaderboardModal();
      });
      modal.querySelector('#btnRankingGoogleLogin')?.addEventListener('click', async () => {
        if (!networkStatus.isOnline) {
          this.showToast('🔒 Login Google requer Wi-Fi ou Dados Móveis.');
          return;
        }
        try {
          const { user } = await googleSignIn();
          sound.playSuccessFanfare();
          this.googleUser = getCurrentUserProfile();
          if (user.displayName) this.profile.name = user.displayName;
          this.handleGoogleVeteranBypass(true);
          this.persistDurableProgress(true);
          this.renderTitleScreen();
          renderRanking();
        } catch (err) {
          this.showToast(`Login Google cancelado: ${(err as Error).message || err}`);
        }
      });

      try {
        const racers = await GoogleSheetsRankingService.fetchLiveRanking(
          this.profile.repPoints,
          this.profile.name,
          activeCar.name,
          activeCar.topSpeed,
          this.profile.copsDestroyed
        );

        const loadingEl = modal.querySelector('#rankingLoading') as HTMLElement;
        const tableEl = modal.querySelector('#liveRankingTable') as HTMLElement;
        const tbody = modal.querySelector('#rankingTableBody') as HTMLElement;

        if (loadingEl && tableEl && tbody) {
          loadingEl.style.display = 'none';
          tableEl.style.display = 'table';
          tbody.innerHTML = racers
            .map((r) => {
              const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `#${r.rank}`;
              const isMe = r.isCurrentUser;
              return `
                <tr class="${isMe ? 'current-user-row' : ''}">
                  <td class="rank-num">${medal}</td>
                  <td>
                    <div class="pilot-cell">
                      ${
                        r.avatarUrl
                          ? `<img src="${r.avatarUrl}" class="pilot-avatar" referrerpolicy="no-referrer" alt="" />`
                          : `<span class="pilot-avatar-placeholder">👤</span>`
                      }
                      <span class="pilot-cell-name ${isMe ? 'me-name' : ''}">${r.pilotName}</span>
                    </div>
                  </td>
                  <td><span class="country-flag">${r.country}</span></td>
                  <td>${r.carName}</td>
                  <td><strong class="text-neon-cyan">${r.repPoints.toLocaleString()}</strong></td>
                  <td>${r.topSpeedKmh} km/h</td>
                  <td>${r.copsDestroyed} 💥</td>
                  <td><span class="racer-badge-pill">${r.badge}</span></td>
                </tr>
              `;
            })
            .join('');
        }
      } catch (err) {
        const loadingEl = modal.querySelector('#rankingLoading') as HTMLElement;
        if (loadingEl) {
          loadingEl.innerHTML = `⚠️ Erro ao consultar ranking: ${(err as Error).message || err}`;
        }
      }
    };

    this.root.appendChild(modal);
    renderRanking();
  }

  // --- Confirmation Modal with Safe User Confirmation ---
  private showConfirmationModal(title: string, messageHtml: string, onConfirm: () => void) {
    const confirmModal = document.createElement('div');
    confirmModal.className = 'modal-backdrop confirm-backdrop';
    confirmModal.innerHTML = `
      <div class="modal-card confirm-modal-card">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="close-confirm-btn">&times;</button>
        </div>
        <div class="confirm-body">
          <p>${messageHtml}</p>
        </div>
        <div class="confirm-actions">
          <button class="secondary-btn" id="btnCancelConfirm">Cancelar</button>
          <button class="primary-btn" id="btnAcceptConfirm">Confirmar</button>
        </div>
      </div>
    `;

    this.root.appendChild(confirmModal);
    confirmModal.querySelector('.close-confirm-btn')?.addEventListener('click', () => confirmModal.remove());
    confirmModal.querySelector('#btnCancelConfirm')?.addEventListener('click', () => confirmModal.remove());
    confirmModal.querySelector('#btnAcceptConfirm')?.addEventListener('click', () => {
      confirmModal.remove();
      onConfirm();
    });
  }

  // --- Floating Toast Notification ---
  public showToast(message: string) {
    const toast = document.createElement('div');
    toast.className = 'game-toast-notification';
    toast.innerHTML = `<span>${message}</span>`;
    this.root.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-show');
    }, 10);
    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 400);
    }, 3800);
  }

  // --- Achievement Unlock Handler & Custom Queued Toast ---
  private handleAchievementUnlocked(ach: AchievementDefinition) {
    this.profile.cash += ach.rewardCash;
    this.profile.repPoints += ach.rewardRep;
    if (this.profile.repPoints >= this.profile.repLevel * 1000) {
      this.profile.repLevel++;
    }
    this.persistDurableProgress();
    this.achievementToastQueue.push(ach);
    if (!this.isShowingAchievementToast) {
      this.drainAchievementToastQueue();
    }
  }

  private drainAchievementToastQueue() {
    const next = this.achievementToastQueue.shift();
    if (!next) {
      this.isShowingAchievementToast = false;
      return;
    }
    this.isShowingAchievementToast = true;
    sound.playAchievementUnlockSound();

    const tierLabels: Record<AchievementDefinition['tier'], string> = {
      bronze: 'BRONZE',
      silver: 'PRATA',
      gold: 'OURO',
      platinum: 'PLATINA',
    };

    const toast = document.createElement('div');
    toast.className = `achievement-toast-banner tier-${next.tier}`;
    toast.innerHTML = `
      <div class="ach-toast-shine"></div>
      <div class="ach-toast-medal">
        <span class="ach-toast-icon">${next.icon}</span>
      </div>
      <div class="ach-toast-body">
        <div class="ach-toast-kicker">
          <span>🏆 CONQUISTA DESBLOQUEADA!</span>
          <span class="ach-tier-pill tier-${next.tier}">${tierLabels[next.tier]}</span>
        </div>
        <div class="ach-toast-title">${next.title}</div>
        <div class="ach-toast-desc">${next.description}</div>
        <div class="ach-toast-rewards">
          <span>💰 +R$ ${next.rewardCash.toLocaleString()}</span>
          <span>⭐ +${next.rewardRep} RP</span>
        </div>
      </div>
    `;
    this.root.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('ach-toast-visible');
    }, 20);

    setTimeout(() => {
      toast.classList.remove('ach-toast-visible');
      setTimeout(() => {
        toast.remove();
        this.drainAchievementToastQueue();
      }, 420);
    }, 4400);
  }

  // --- Achievements Modal ---
  public showAchievementsModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    let selectedCategory: AchievementCategory | 'all' = 'all';

    const renderContent = () => {
      const unlockedCount = this.achievements.getUnlockedCount();
      const totalCount = this.achievements.achievements.length;
      const stats = this.achievements.stats;
      const filtered =
        selectedCategory === 'all'
          ? this.achievements.achievements
          : this.achievements.achievements.filter((a) => a.category === selectedCategory);

      const categories: { id: AchievementCategory | 'all'; label: string }[] = [
        { id: 'all', label: 'Todas' },
        { id: 'distance', label: '🛣️ Distância' },
        { id: 'drift', label: '💨 Drift' },
        { id: 'pursuit', label: '🚔 Perseguição' },
        { id: 'stunt', label: '🚀 Acrobacias' },
        { id: 'garage', label: '🔧 Garagem' },
      ];

      const tierNames: Record<AchievementDefinition['tier'], string> = {
        bronze: 'Bronze',
        silver: 'Prata',
        gold: 'Ouro',
        platinum: 'Platina',
      };

      modal.innerHTML = `
        <div class="modal-card extra-large-modal">
          <div class="modal-header">
            <h2>🎖️ CONQUISTAS & MARCOS DO PILOTO (${unlockedCount}/${totalCount})</h2>
            <button class="close-modal-btn">&times;</button>
          </div>

          <div class="ach-summary-strip">
            <div class="ach-stat-box">
              <span class="ach-stat-val">${stats.totalDistanceKm.toFixed(1)} km</span>
              <span class="ach-stat-lbl">Rodados</span>
            </div>
            <div class="ach-stat-box">
              <span class="ach-stat-val">${stats.perfectDriftsCount}</span>
              <span class="ach-stat-lbl">Drifts Perfeitos</span>
            </div>
            <div class="ach-stat-box">
              <span class="ach-stat-val">${stats.maxSpeedKmh} km/h</span>
              <span class="ach-stat-lbl">Vel. Máxima</span>
            </div>
            <div class="ach-stat-box">
              <span class="ach-stat-val">${stats.copsDestroyed}</span>
              <span class="ach-stat-lbl">Viaturas Destruídas</span>
            </div>
            <div class="ach-stat-box">
              <span class="ach-stat-val">${stats.totalEscapes}</span>
              <span class="ach-stat-lbl">Fugas Limpas</span>
            </div>
          </div>

          <div class="ach-category-tabs">
            ${categories
              .map(
                (c) => `
              <button class="option-btn ach-cat-btn ${selectedCategory === c.id ? 'active' : ''}" data-cat="${c.id}">
                ${c.label}
              </button>
            `
              )
              .join('')}
          </div>

          <div class="ach-cards-grid">
            ${filtered
              .map((ach) => {
                const ratio = this.achievements.getProgressRatio(ach);
                const pct = Math.round(ratio * 100);
                const curVal = this.achievements.getCurrentStatValue(ach);
                const unlockedDate = ach.unlockedAt
                  ? new Date(ach.unlockedAt).toLocaleDateString('pt-BR')
                  : '';
                return `
                  <div class="ach-card ${ach.unlocked ? 'ach-unlocked' : 'ach-locked'} tier-${ach.tier}">
                    <div class="ach-card-top">
                      <div class="ach-card-medal">${ach.icon}</div>
                      <div class="ach-card-head-info">
                        <div class="ach-card-title-row">
                          <h3>${ach.title}</h3>
                          <span class="ach-tier-pill tier-${ach.tier}">${tierNames[ach.tier]}</span>
                        </div>
                        <p class="ach-card-desc">${ach.description}</p>
                      </div>
                    </div>
                    <div class="ach-progress-wrap">
                      <div class="ach-progress-bar">
                        <div class="ach-progress-fill" style="width: ${pct}%"></div>
                      </div>
                      <div class="ach-progress-meta">
                        <span>${Math.min(curVal, ach.targetValue)} / ${ach.targetValue} ${ach.unit} (${pct}%)</span>
                        <span class="ach-reward-text">${ach.unlocked ? `✅ Desbloqueada ${unlockedDate}` : `🎁 +R$ ${ach.rewardCash.toLocaleString()} · +${ach.rewardRep} RP`}</span>
                      </div>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      `;

      modal.querySelector('.close-modal-btn')?.addEventListener('click', () => modal.remove());
      modal.querySelectorAll('.ach-cat-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          selectedCategory = (btn.getAttribute('data-cat') as AchievementCategory | 'all') || 'all';
          renderContent();
        });
      });
    };

    this.root.appendChild(modal);
    renderContent();
  }

  // --- Settings Modal (Graphics, Weather, Time of Day, Gyro, Google Account) ---
  private showSettingsModal() {
    document.getElementById('SettingsModalOverlay')?.remove();
    const modal = document.createElement('div');
    modal.id = 'SettingsModalOverlay';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-card large-modal">
        <div class="modal-header">
          <h2>⚙️ CONFIGURAÇÕES</h2>
          <button class="close-modal-btn">&times;</button>
        </div>
        
        <div class="settings-content">
          <!-- Google Account Management Section -->
          <div class="setting-group google-settings-group">
            <div class="device-spec-box google-settings-box">
              <div class="settings-sec-header">
                <h4>👤 GERENCIAMENTO DA CONTA GOOGLE</h4>
                <span class="settings-subdesc">Acesso seguro 1-clique, backup de saves no Drive e ranking no Sheets</span>
              </div>

              ${
                this.googleUser
                  ? `
                <div class="google-settings-connected">
                  <div class="google-settings-user-info">
                    <img src="${this.googleUser.photoURL || 'https://lh3.googleusercontent.com/a/default-user'}" alt="Avatar" class="google-settings-avatar" referrerpolicy="no-referrer" />
                    <div>
                      <h3 class="google-settings-name">${this.googleUser.displayName || 'Piloto Google'}</h3>
                      <p class="google-settings-email">${this.googleUser.email || ''}</p>
                      <div class="google-settings-badge-row">
                        <span class="badge-pill-verified">✅ Google Verificado</span>
                        <span class="badge-pill-drive">☁️ Google Drive Ativo</span>
                      </div>
                    </div>
                  </div>
                  <div class="google-settings-btns">
                    <button class="primary-btn small-btn" id="btnSettingsDriveSync">
                      ☁️ Gerenciar Saves no Drive
                    </button>
                    <button class="secondary-btn small-btn" id="btnSettingsGoogleSignOut">
                      Sair da Conta Google
                    </button>
                  </div>
                </div>
              `
                  : `
                <div class="google-settings-disconnected">
                  <p class="google-login-promo">
                    Sua sessão atual está em <strong>Modo Local Offline</strong>. Conecte sua conta do Google com apenas 1 clique para manter seus carros e moedas salvos no <strong>Google Drive</strong> e competir com sua foto no placar ao vivo.
                  </p>
                  <button class="gsi-material-button large-google-btn" id="btnSettingsGoogleSignIn" type="button">
                    <div class="gsi-material-button-state"></div>
                    <div class="gsi-material-button-content-wrapper">
                      <div class="gsi-material-button-icon">
                        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="display: block;">
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.79l7.97-6.2z"></path>
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                          <path fill="none" d="M0 0h48v48H0z"></path>
                        </svg>
                      </div>
                      <span class="gsi-material-button-contents">Conectar Conta Google (1-Clique)</span>
                    </div>
                  </button>
                </div>
              `
              }
            </div>
          </div>

          <div class="setting-group">
            <div class="device-spec-box">
              <h4>📱 DIAGNÓSTICO DO SEU APARELHO</h4>
              <p><strong>Dispositivo:</strong> ${this.deviceSpecs?.isMobile ? 'Celular / Tablet Móvel' : 'Computador Desktop'}</p>
              <p><strong>Memória RAM:</strong> ${this.deviceSpecs?.deviceMemoryGb || 4} GB | <strong>CPU:</strong> ${this.deviceSpecs?.cpuCores || 4} núcleos</p>
              <p><strong>GPU Render:</strong> ${this.deviceSpecs?.gpuName || 'Padrão'}</p>
              <p><strong>Diagnóstico:</strong> ${this.deviceSpecs?.recommendationReason || 'Desempenho Otimizado'}</p>
              <button class="primary-btn auto-preset-btn" id="btnRestoreAutoPreset">
                RESTAURAR GRÁFICO PADRÃO RECOMENDADO (${(this.deviceSpecs?.recommendedQuality || 'medium').toUpperCase()})
              </button>
            </div>
          </div>

          <div class="setting-group">
            <label>Nível Gráfico Manual:</label>
            <div class="btn-group">
              ${['low', 'medium', 'high', 'ultra']
                .map(
                  (q) => `
                <button class="setting-choice ${this.quality === q ? 'active' : ''}" data-type="quality" data-val="${q}">
                  ${q === 'low' ? 'Baixo' : q === 'medium' ? 'Médio' : q === 'high' ? 'Alto' : 'Ultra (Realista)'}
                </button>
              `
                )
                .join('')}
            </div>
          </div>

          <div class="setting-group">
            <label>Clima do Mundo:</label>
            <div class="btn-group">
              ${['sunny', 'rain', 'storm', 'fog']
                .map(
                  (w) => `
                <button class="setting-choice ${this.weather === w ? 'active' : ''}" data-type="weather" data-val="${w}">
                  ${w === 'sunny' ? '☀️ Ensolarado' : w === 'rain' ? '🌧️ Chuva (Asfalto Molhado)' : w === 'storm' ? '⛈️ Tempestade com Raios' : '🌫️ Neblina Densa'}
                </button>
              `
                )
                .join('')}
            </div>
          </div>

          <div class="setting-group">
            <label>Horário do Dia:</label>
            <div class="btn-group">
              ${['day', 'sunset', 'night', 'midnight']
                .map(
                  (t) => `
                <button class="setting-choice ${this.timeOfDay === t ? 'active' : ''}" data-type="timeOfDay" data-val="${t}">
                  ${t === 'day' ? '☀️ Dia Claro' : t === 'sunset' ? '🌅 Pôr do Sol Dourado' : t === 'night' ? '🌃 Noite Neon' : '🌌 Madrugada'}
                </button>
              `
                )
                .join('')}
            </div>
          </div>

          <div class="setting-group">
            <label>Dificuldade do Jogo (Intensidade Policial & Penalidade de Pista):</label>
            <div class="btn-group difficulty-btn-group">
              ${[
                { id: 'very_easy', label: 'Muito fácil' },
                { id: 'easy', label: 'Fácil' },
                { id: 'amateur', label: 'Amador' },
                { id: 'normal', label: 'Normal (Médio)' },
                { id: 'hard', label: 'Difícil' },
                { id: 'legendary', label: 'Lendário' },
                { id: 'professional', label: 'Profissional' },
              ]
                .map(
                  (d) => `
                <button class="setting-choice difficulty-choice ${this.profile.difficulty === d.id ? 'active' : ''}" data-type="difficulty" data-val="${d.id}">
                  ${d.label}
                </button>
              `
                )
                .join('')}
            </div>
            <p class="setting-sub-info">
              ${
                this.profile.difficulty === 'very_easy'
                  ? '🛡️ Muito fácil: Polícia enormemente fácil (viaturas muito lentas, evasão em 2s e sem bloqueios), penalidade fora da pista: -20 pts/s.'
                  : this.profile.difficulty === 'easy'
                    ? '🟢 Fácil: Patrulha leve, bloqueios esparsos, penalidade fora da pista: -25 pts/s.'
                    : this.profile.difficulty === 'amateur'
                      ? '🟡 Amador: Cops atentos com manobras de cerco, penalidade fora da pista: -30 pts/s.'
                      : this.profile.difficulty === 'normal'
                        ? '🟠 Normal (Médio): Perseguição equilibrada na medida certa com barreiras ocasionais, penalidade: -35 pts/s.'
                        : this.profile.difficulty === 'hard'
                          ? '🔴 Difícil: Cops ultra-rápidos com viaturas pesadas SWAT e barreiras frequentes, penalidade: -45 pts/s.'
                          : this.profile.difficulty === 'legendary'
                            ? '🔥 Lendário: Perseguição brutal, helicóptero e barreiras com spike strip, penalidade: -55 pts/s.'
                            : '⚡ Profissional (Extremo): Perseguição implacável, sem trégua, barreiras duplas e penalidade máxima: -70 pts/s!'
              }
            </p>
          </div>

          <div class="setting-group">
            <label>Orientação / Modo do Jogo (Horizontal ou Vertical):</label>
            <div class="btn-group">
              ${[
                { id: 'auto', label: '🔄 Automático' },
                { id: 'horizontal', label: '↔️ Modo Horizontal' },
                { id: 'vertical', label: '📲 Modo Vertical' },
              ]
                .map(
                  (o) => `
                <button class="setting-choice ${this.orientationMode === o.id ? 'active' : ''}" data-type="orientation" data-val="${o.id}">
                  ${o.label}
                </button>
              `
                )
                .join('')}
            </div>
          </div>

          <div class="setting-group">
            <label>🕹️ Estilo de Controles do HUD (Touch / Mobile — NFS, Asphalt, Joystick...):</label>
            <div class="hud-control-styles-grid">
              ${GameUI.HUD_CONTROL_OPTIONS.map(
                (opt) => `
                <button type="button" class="hud-style-card ${this.getHudControlStyle() === opt.id ? 'active' : ''}" data-hud-style="${opt.id}">
                  <div class="hud-style-card-top">
                    <span class="hud-style-title">${opt.title}</span>
                    <span class="hud-style-badge">${opt.badge}</span>
                  </div>
                  <p class="hud-style-desc">${opt.desc}</p>
                </button>
              `
              ).join('')}
            </div>
          </div>

          <div class="setting-group">
            <label>Modo Giroscópio (Controle por Inclinação):</label>
            <button class="toggle-btn ${this.gyroActive ? 'active' : ''}" id="toggleGyroBtn">
              ${this.gyroActive ? 'GIROSCÓPIO ATIVADO' : 'GIROSCÓPIO DESATIVADO'}
            </button>
          </div>
        </div>
      </div>
    `;
    this.root.appendChild(modal);

    modal.querySelector('.close-modal-btn')?.addEventListener('click', () => {
      modal.remove();
      if (this.currentMode !== 'title' && this.isPaused && !document.getElementById('PauseModalOverlay')) {
        this.isPaused = false;
        sound.resumeVoiceClip();
        this.onPauseChanged?.(false);
      }
    });

    modal.querySelector('#btnSettingsGoogleSignIn')?.addEventListener('click', async () => {
      if (!networkStatus.isOnline) {
        this.showToast('🔒 Login Google indisponível offline. Ligue o Wi-Fi ou Dados Móveis.');
        return;
      }
      try {
        const { user } = await googleSignIn();
        sound.playSuccessFanfare();
        this.googleUser = getCurrentUserProfile();
        if (user.displayName) this.profile.name = user.displayName;
        const bypassed = this.handleGoogleVeteranBypass(true);
        this.persistDurableProgress(true);
        if (!bypassed) {
          this.showToast(`Conectado como ${user.displayName || user.email}!`);
        }
        this.refreshActiveMenuScreen(true);
        modal.remove();
        if (!bypassed || (this.currentMode !== 'title' && this.currentMode !== 'tutorial')) {
          this.showSettingsModal();
        }
      } catch (err) {
        this.showToast(`Falha no login Google: ${(err as Error).message || err}`);
      }
    });

    modal.querySelector('#btnSettingsGoogleSignOut')?.addEventListener('click', async () => {
      try {
        await googleSignOut();
        this.googleUser = null;
        this.showToast('Desconectado da conta Google.');
        this.refreshActiveMenuScreen(true);
        modal.remove();
        this.showSettingsModal();
      } catch (err) {
        console.error('Sign out error:', err);
      }
    });

    modal.querySelector('#btnSettingsDriveSync')?.addEventListener('click', () => {
      if (!networkStatus.isOnline) {
        this.showToast('🔒 Google Drive requer Wi-Fi ou Dados Móveis.');
        return;
      }
      modal.remove();
      this.showDriveCloudSaveModal();
    });

    modal.querySelectorAll('.setting-choice').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        const val = btn.getAttribute('data-val') as string;
        if (type === 'quality') this.quality = val as GraphicsQuality;
        if (type === 'weather') this.weather = val as WeatherType;
        if (type === 'timeOfDay') this.timeOfDay = val as TimeOfDay;
        if (type === 'orientation') {
          this.setOrientationMode(val as OrientationMode);
          const pauseOrientBtn = document.getElementById('btnPauseOrientation');
          if (pauseOrientBtn) {
            pauseOrientBtn.innerText = this.isEffectiveVertical() ? '📲 Vertical' : '↔️ Horizontal';
          }
        }
        if (type === 'difficulty') {
          this.profile.difficulty = val as GameDifficulty;
          this.onDifficultyChanged?.(this.profile.difficulty);
          this.persistDurableProgress();
          this.showToast(`Dificuldade alterada para: ${val.replace('_', ' ').toUpperCase()}`);
        }
        this.onApplySettings?.(this.quality, this.weather, this.timeOfDay);
        modal.remove();
        this.showSettingsModal();
      });
    });

    modal.querySelectorAll('[data-hud-style]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const style = btn.getAttribute('data-hud-style') as HudControlStyle | null;
        if (!style) return;
        this.setHudControlStyle(style);
        const chosen = GameUI.HUD_CONTROL_OPTIONS.find((o) => o.id === style);
        this.showToast(`🕹️ Controles HUD: ${chosen?.title || style}`);
        if (this.tutorialActive) {
          this.renderTutorialOverlay();
        }
        modal.remove();
        this.showSettingsModal();
      });
    });

    modal.querySelector('#btnRestoreAutoPreset')?.addEventListener('click', () => {
      this.quality = this.deviceSpecs?.recommendedQuality || 'medium';
      this.onApplySettings?.(this.quality, this.weather, this.timeOfDay);
      modal.remove();
      this.showSettingsModal();
    });

    modal.querySelector('#toggleGyroBtn')?.addEventListener('click', async () => {
      if (this.gyroActive) {
        this.gyroActive = false;
      } else {
        await this.enableGyroscope();
      }
      modal.remove();
      this.showSettingsModal();
    });
  }

  // --- Dialogue / 3D Film Cutscene Presentation ---
  public triggerDialogue(
    lines: DialogueLine[],
    options: {
      isFilmScene?: boolean;
      filmBadge?: string;
      onLineChange?: (line: DialogueLine, index: number) => void;
    } = {}
  ): Promise<void> {
    return new Promise((resolve) => {
      this.activeDialogueLines = lines;
      this.dialogueIndex = 0;
      this.dialogueOptions = options;
      this.dialogueResolve = resolve;
      this.renderDialogueBox();
    });
  }

  private cleanupFilmLetterbox() {
    document.getElementById('FilmLetterboxOverlay')?.remove();
  }

  private renderDialogueBox() {
    const isFilm = Boolean(this.dialogueOptions.isFilmScene);
    const currentLine = this.activeDialogueLines[this.dialogueIndex];

    if (!currentLine) {
      document.getElementById('DialogueBoxOverlay')?.remove();
      this.cleanupFilmLetterbox();
      this.dialogueResolve?.();
      return;
    }

    this.dialogueOptions.onLineChange?.(currentLine, this.dialogueIndex);

    if (isFilm) {
      let lb = document.getElementById('FilmLetterboxOverlay');
      if (!lb) {
        lb = document.createElement('div');
        lb.id = 'FilmLetterboxOverlay';
        lb.className = 'film-cutscene-letterbox';
        lb.innerHTML = `
          <div class="film-letterbox-top">
            <span class="film-scene-badge">🎬 ${this.dialogueOptions.filmBadge || 'CENA DE FILME · COCKPIT 3D'}</span>
          </div>
          <div class="film-letterbox-bottom"></div>
        `;
        this.root.appendChild(lb);
      }
    }

    let box = document.getElementById('DialogueBoxOverlay');
    if (!box) {
      box = document.createElement('div');
      box.id = 'DialogueBoxOverlay';
      box.className = isFilm ? 'dialogue-box-overlay film-dialogue-overlay' : 'dialogue-box-overlay';
      this.root.appendChild(box);
    } else {
      box.className = isFilm ? 'dialogue-box-overlay film-dialogue-overlay' : 'dialogue-box-overlay';
    }

    sound.playPoliceRadioChirp();

    const portraitEmoji =
      currentLine.portrait === 'miguel'
        ? '🕶️'
        : currentLine.portrait === 'luca' || currentLine.portrait === 'pilot'
          ? '🏎️'
          : currentLine.portrait === 'alan'
            ? '🛡️'
            : currentLine.portrait === 'andre'
              ? '🗺️'
              : currentLine.portrait === 'ana'
                ? '🎯'
                : currentLine.portrait === 'guard'
                  ? '🔦'
                  : currentLine.portrait === 'copilot'
                    ? '🎧'
                    : currentLine.portrait === 'cop'
                      ? '👮'
                      : currentLine.portrait === 'dispatch'
                        ? '📻'
                        : '🔥';

    const rolePillLabel =
      currentLine.role === 'pilot' || currentLine.portrait === 'pilot'
        ? 'PILOTO'
        : currentLine.role === 'copilot' || currentLine.portrait === 'copilot'
          ? 'COPILOTO'
          : currentLine.role === 'ally'
            ? 'EQUIPE'
            : currentLine.role === 'guard'
              ? 'GUARDA'
              : currentLine.radioEffect
                ? 'RÁDIO'
                : '';

    const isLast = this.dialogueIndex >= this.activeDialogueLines.length - 1;

    box.innerHTML = `
      <div class="dialogue-card ${isFilm ? 'film-dialogue-card' : ''}">
        <div class="speaker-avatar ${currentLine.radioEffect ? 'radio-static' : ''}">
          <span class="avatar-icon">${portraitEmoji}</span>
        </div>
        <div class="dialogue-content">
          <div class="speaker-header">
            <span class="speaker-name">${currentLine.speaker}</span>
            ${rolePillLabel ? `<span class="film-role-pill role-${currentLine.role || 'pilot'}">${rolePillLabel}</span>` : ''}
            ${currentLine.radioEffect ? '<span class="radio-tag">RÁDIO POLICIAL</span>' : ''}
            ${isFilm ? `<span class="film-take-counter">CENA ${this.dialogueIndex + 1}/${this.activeDialogueLines.length}</span>` : ''}
          </div>
          <p class="speaker-text">${currentLine.text}</p>
          <div class="dialogue-actions">
            <button class="dialogue-skip-btn" id="btnSkipDialogue">Pular Cena</button>
            <button class="dialogue-next-btn primary-btn" id="btnNextDialogue">${isLast ? 'Acelerar! ❯' : 'Próxima Fala ❯'}</button>
          </div>
        </div>
      </div>
    `;

    box.querySelector('#btnNextDialogue')?.addEventListener('click', () => {
      this.dialogueIndex++;
      this.renderDialogueBox();
    });

    box.querySelector('#btnSkipDialogue')?.addEventListener('click', () => {
      box?.remove();
      this.cleanupFilmLetterbox();
      this.dialogueResolve?.();
    });
  }

  public startInteractiveTutorial() {
    this.tutorialActive = true;
    this.tutorialCompletedBannerShown = false;
    this.tutorialStepIndex = 0;
    this.tutorialLastTransportMode = 'car';
    this.tutorialMetrics = {
      gasHoldSec: 0,
      steeredLeftSec: 0,
      steeredRightSec: 0,
      driftOrBrakeSec: 0,
      nitroHoldSec: 0,
      switchedCameraOrFoot: false,
      openedPhoneOrLocation: false,
    };
    this.renderTutorialOverlay();
    this.playAlanTutorialIntroVoice();
  }

  private updateAlanVoiceBannerUI(caption: string, speaking: boolean) {
    this.alanVoiceCaption = caption;
    this.alanVoiceSpeaking = speaking;
    const textEl = document.getElementById('alanVoiceBannerText');
    if (textEl) {
      textEl.textContent = caption;
    }
    const barEl = document.getElementById('alanVoiceBanner');
    if (barEl) {
      barEl.classList.toggle('is-speaking', speaking);
    }
    const modalTextEl = document.getElementById('alanCompleteVoiceText');
    if (modalTextEl) {
      modalTextEl.textContent = caption;
    }
    const modalBarEl = document.getElementById('alanCompleteVoiceBar');
    if (modalBarEl) {
      modalBarEl.classList.toggle('is-speaking', speaking);
    }
  }

  private playAlanTutorialIntroVoice() {
    sound.playVoiceSequence([
      {
        src: GameUI.ALAN_TUTORIAL_AUDIO.intro,
        onStart: () =>
          this.updateAlanVoiceBannerUI(
            'Fala jogador! Eu me chamo Alan, e vou te ensinar a jogar o Grand Proved It.',
            true
          ),
      },
      {
        src: GameUI.ALAN_TUTORIAL_AUDIO.followSteps,
        onStart: () =>
          this.updateAlanVoiceBannerUI('Siga os passos e vai aprender rápido.', true),
        onEnd: () =>
          this.updateAlanVoiceBannerUI('Siga os passos e vai aprender rápido.', false),
      },
    ]);
  }

  private playAlanTutorialCompleteVoice() {
    sound.playVoiceSequence([
      {
        src: GameUI.ALAN_TUTORIAL_AUDIO.finished,
        onStart: () =>
          this.updateAlanVoiceBannerUI(
            'Terminou? Agora você tem o jogo inteiro para testar e curtir.',
            true
          ),
      },
      {
        src: GameUI.ALAN_TUTORIAL_AUDIO.cloudSaveTip,
        onStart: () =>
          this.updateAlanVoiceBannerUI(
            'Se quiser salvar seu progresso, vá nas configurações e conecte sua conta Google ou Google Drive. Assim você não perde seu progresso.',
            true
          ),
        onEnd: () =>
          this.updateAlanVoiceBannerUI(
            'Se quiser salvar seu progresso, vá nas configurações e conecte sua conta Google ou Google Drive. Assim você não perde seu progresso.',
            false
          ),
      },
    ]);
  }

  public notifyTutorialAction(action: 'camera_switch' | 'transport_switch' | 'phone_open' | 'location_interact') {
    if (!this.tutorialActive || this.currentMode !== 'tutorial') return;
    if ((action === 'camera_switch' || action === 'transport_switch') && this.tutorialStepIndex === 4) {
      this.tutorialMetrics.switchedCameraOrFoot = true;
    }
    if ((action === 'phone_open' || action === 'location_interact') && this.tutorialStepIndex === 5) {
      this.tutorialMetrics.openedPhoneOrLocation = true;
    }
  }

  public trackTutorialFrame(
    dt: number,
    speedKmh: number,
    effectiveControls: PlayerControls,
    isDrifting: boolean,
    transportMode: OpenWorldTransportMode,
    smartphoneOpen: boolean
  ) {
    if (!this.tutorialActive || this.currentMode !== 'tutorial' || this.isPaused) return;

    if (transportMode !== this.tutorialLastTransportMode) {
      if (this.tutorialStepIndex === 4) {
        this.tutorialMetrics.switchedCameraOrFoot = true;
      }
      this.tutorialLastTransportMode = transportMode;
    }
    if (smartphoneOpen && this.tutorialStepIndex === 5) {
      this.tutorialMetrics.openedPhoneOrLocation = true;
    }

    let advanced = false;
    switch (this.tutorialStepIndex) {
      case 0: {
        // Step 1: Accelerate
        if (effectiveControls.throttle > 0.25 || speedKmh > 12) {
          this.tutorialMetrics.gasHoldSec += dt;
        }
        if (speedKmh >= 26 || this.tutorialMetrics.gasHoldSec >= 0.95) {
          advanced = true;
        }
        break;
      }
      case 1: {
        // Step 2: Steer Left & Right
        if (effectiveControls.steer < -0.22) {
          this.tutorialMetrics.steeredLeftSec += dt;
        }
        if (effectiveControls.steer > 0.22) {
          this.tutorialMetrics.steeredRightSec += dt;
        }
        if (this.tutorialMetrics.steeredLeftSec >= 0.3 && this.tutorialMetrics.steeredRightSec >= 0.3) {
          advanced = true;
        }
        break;
      }
      case 2: {
        // Step 3: Brake / Reverse / Drift
        if (effectiveControls.handbrake || effectiveControls.brake > 0.25 || isDrifting) {
          this.tutorialMetrics.driftOrBrakeSec += dt;
        }
        if (isDrifting || this.tutorialMetrics.driftOrBrakeSec >= 0.55) {
          advanced = true;
        }
        break;
      }
      case 3: {
        // Step 4: Activate Nitro
        if (effectiveControls.nitro) {
          this.tutorialMetrics.nitroHoldSec += dt;
        }
        if (this.tutorialMetrics.nitroHoldSec >= 0.4) {
          advanced = true;
        }
        break;
      }
      case 4: {
        // Step 5: Camera or Exit Vehicle / Transport
        if (this.tutorialMetrics.switchedCameraOrFoot) {
          advanced = true;
        }
        break;
      }
      case 5: {
        // Step 6: Smartphone / Accessible Mansion Interaction
        if (this.tutorialMetrics.openedPhoneOrLocation) {
          advanced = true;
        }
        break;
      }
    }

    if (advanced) {
      sound.playCountdownBeep(true);
      this.tutorialStepIndex++;
      if (this.tutorialStepIndex >= 6) {
        this.completeInteractiveTutorial();
      } else {
        this.renderTutorialOverlay();
      }
    } else {
      this.updateTutorialProgressDisplay();
    }
  }

  private getTutorialSteps() {
    const hudStyle = this.getHudControlStyle();
    const steerHint =
      hudStyle === 'nfs_tap'
        ? 'Toque no lado ESQUERDO e no lado DIREITO da tela (ou A / D)'
        : hudStyle === 'joystick'
          ? 'Mova o JOYSTICK ANALÓGICO para esquerda e direita (ou A / D)'
          : 'Pressione ◀ ESQUERDA e ▶ DIREITA (ou teclas A / D)';
    const gasHint =
      hudStyle === 'nfs_tap' || hudStyle === 'auto_gas'
        ? 'A aceleração automática já está ligada! Deixe o carro ganhar velocidade.'
        : 'Segure ACELERAR na direita (ou W / ↑) para ganhar velocidade.';

    return [
      {
        title: 'Passo 1/6 · Acelerar',
        desc: gasHint,
        highlightIds: ['touchGas'],
      },
      {
        title: 'Passo 2/6 · Fazer Curvas',
        desc: `${steerHint} para testar a direção para ambos os lados.`,
        highlightIds:
          hudStyle === 'joystick'
            ? ['touchJoystickPad']
            : hudStyle === 'nfs_tap'
              ? ['touchNfsLeftZone', 'touchNfsRightZone']
              : ['touchSteerLeft', 'touchSteerRight'],
      },
      {
        title: 'Passo 3/6 · Freio & Drift',
        desc: 'Segure 🛑 DRIFT (Espaço) em uma curva OU aperte FREIO / RÉ (S / ↓).',
        highlightIds: ['touchHandbrake', 'touchBrake'],
      },
      {
        title: 'Passo 4/6 · Ativar Nitro',
        desc: 'Pressione ⚡ NITRO (Shift ou N) para disparar com turbina máxima!',
        highlightIds: ['touchNitro'],
      },
      {
        title: 'Passo 5/6 · Câmera & Sair a Pé',
        desc: 'Toque em 🎥 CÂMERA (C) ou use 🚶 SAIR (F) para descer do carro na rua!',
        highlightIds: ['hudCamBtn', 'hudToggleVehicleBtn', 'touchToggleFoot'],
      },
      {
        title: 'Passo 6/6 · Celular & GPS',
        desc: 'Abra o 📱 CELULAR (T / Tab) para acessar o GPS & NetDrift ou pontos da cidade!',
        highlightIds: ['hudPhoneBtn', 'touchPhoneBtn'],
      },
    ];
  }

  private renderTutorialOverlay() {
    const container = document.getElementById('tutorialGuideOverlay');
    if (!container) return;

    if (!this.tutorialActive || this.currentMode !== 'tutorial') {
      container.style.display = 'none';
      this.clearTutorialHighlights();
      return;
    }

    const steps = this.getTutorialSteps();
    const step = steps[this.tutorialStepIndex];
    if (!step) {
      container.style.display = 'none';
      this.clearTutorialHighlights();
      return;
    }

    const isOnline = networkStatus.isOnline;
    container.style.display = 'flex';
    container.innerHTML = `
      <div class="tutorial-guide-card">
        <div class="tutorial-guide-header">
          <span class="tutorial-step-badge">🎓 TUTORIAL INTERATIVO</span>
          <span class="tutorial-step-counter">${this.tutorialStepIndex + 1} / ${steps.length}</span>
          <div class="tutorial-header-actions">
            <button class="tutorial-hud-cfg-btn" id="btnTutorialHudConfig" type="button" title="Mudar estilo de controles HUD">🎛️ Mudar HUD</button>
            <button class="tutorial-google-skip-btn ${!this.googleUser && !isOnline ? 'is-offline-disabled' : ''}" id="btnTutorialGoogleSkip" type="button" title="Conectar conta Google para pular o tutorial obrigatório">
              ${this.googleUser ? '🏅 Pular (Veterano)' : '🔓 Já jogava? Pular c/ Google'}
            </button>
          </div>
        </div>
        <h3 class="tutorial-step-title">${step.title}</h3>
        <p class="tutorial-step-desc">${step.desc}</p>
        <div class="alan-voice-banner ${this.alanVoiceSpeaking ? 'is-speaking' : ''}" id="alanVoiceBanner">
          <span class="alan-voice-speaker">🎙️ Alan</span>
          <span class="alan-voice-caption" id="alanVoiceBannerText">${this.alanVoiceCaption}</span>
          <button class="alan-voice-replay-btn" id="btnReplayAlanIntro" type="button" title="Ouvir Alan novamente">🔊</button>
        </div>
        <div class="tutorial-progress-track">
          <div class="tutorial-progress-fill" id="tutorialProgressFill" style="width: 0%;"></div>
        </div>
        <div class="tutorial-sub-checklist" id="tutorialSubChecklist"></div>
      </div>
    `;

    container.querySelector('#btnReplayAlanIntro')?.addEventListener('click', () => {
      sound.ensureRunning();
      this.playAlanTutorialIntroVoice();
    });

    container.querySelector('#btnTutorialHudConfig')?.addEventListener('click', () => {
      this.isPaused = true;
      sound.pauseVoiceClip();
      this.onPauseChanged?.(true);
      this.showSettingsModal();
    });

    container.querySelector('#btnTutorialGoogleSkip')?.addEventListener('click', async () => {
      sound.stopVoiceClips();
      if (this.googleUser) {
        this.profile.tutorialCompleted = true;
        this.googleVeteranBypassed = true;
        this.persistDurableProgress(true);
        this.tutorialActive = false;
        this.clearTutorialHighlights();
        container.style.display = 'none';
        if (this.smartphone?.isOpen) this.smartphone.close();
        sound.playSuccessFanfare();
        this.renderTitleScreen();
        this.showToast('🏅 Conta Google verificada! Tutorial pulado — todos os modos liberados.');
        return;
      }
      if (!networkStatus.isOnline) {
        this.showToast('🔒 Conecte Wi-Fi ou Dados Móveis para usar o login Google.');
        return;
      }
      try {
        const { user } = await googleSignIn();
        sound.playSuccessFanfare();
        this.googleUser = getCurrentUserProfile();
        if (user.displayName) {
          this.profile.name = user.displayName;
        }
        const bypassed = this.handleGoogleVeteranBypass(true);
        if (!bypassed) {
          this.tutorialActive = false;
          this.clearTutorialHighlights();
          container.style.display = 'none';
          this.renderTitleScreen();
          this.showToast(`🏅 Bem-vindo de volta, ${user.displayName || 'Piloto'}! Tutorial pulado.`);
        }
      } catch (err: unknown) {
        console.error('Google Sign-In tutorial skip error:', err);
        this.showToast(`Não foi possível conectar com o Google: ${(err as Error).message || err}`);
      }
    });

    this.updateTutorialHighlight();
    this.updateTutorialProgressDisplay();
  }

  private updateTutorialProgressDisplay() {
    const fill = document.getElementById('tutorialProgressFill');
    const checklist = document.getElementById('tutorialSubChecklist');
    if (!fill) return;

    let pct = 0;
    if (this.tutorialStepIndex === 0) {
      pct = Math.min(100, (this.tutorialMetrics.gasHoldSec / 0.95) * 100);
    } else if (this.tutorialStepIndex === 1) {
      const leftDone = this.tutorialMetrics.steeredLeftSec >= 0.3;
      const rightDone = this.tutorialMetrics.steeredRightSec >= 0.3;
      pct = ((leftDone ? 0.5 : Math.min(0.5, (this.tutorialMetrics.steeredLeftSec / 0.3) * 0.5)) +
        (rightDone ? 0.5 : Math.min(0.5, (this.tutorialMetrics.steeredRightSec / 0.3) * 0.5))) * 100;
      if (checklist) {
        checklist.innerHTML = `
          <span class="${leftDone ? 'done' : ''}">${leftDone ? '✅' : '⬜'} Virar Esquerda</span>
          <span class="${rightDone ? 'done' : ''}">${rightDone ? '✅' : '⬜'} Virar Direita</span>
        `;
      }
    } else if (this.tutorialStepIndex === 2) {
      pct = Math.min(100, (this.tutorialMetrics.driftOrBrakeSec / 0.55) * 100);
    } else if (this.tutorialStepIndex === 3) {
      pct = Math.min(100, (this.tutorialMetrics.nitroHoldSec / 0.4) * 100);
    } else if (this.tutorialStepIndex === 4) {
      pct = this.tutorialMetrics.switchedCameraOrFoot ? 100 : 12;
    } else if (this.tutorialStepIndex === 5) {
      pct = this.tutorialMetrics.openedPhoneOrLocation ? 100 : 12;
    }

    if (this.tutorialStepIndex !== 1 && checklist) {
      checklist.innerHTML = '';
    }
    fill.style.width = `${Math.round(pct)}%`;
  }

  private clearTutorialHighlights() {
    this.root.querySelectorAll('.tutorial-target-highlight').forEach((el) => {
      el.classList.remove('tutorial-target-highlight');
    });
  }

  private updateTutorialHighlight() {
    this.clearTutorialHighlights();
    if (!this.tutorialActive || this.currentMode !== 'tutorial') return;
    const step = this.getTutorialSteps()[this.tutorialStepIndex];
    if (!step) return;
    for (const id of step.highlightIds) {
      document.getElementById(id)?.classList.add('tutorial-target-highlight');
    }
  }

  private completeInteractiveTutorial() {
    this.tutorialActive = false;
    this.clearTutorialHighlights();
    const container = document.getElementById('tutorialGuideOverlay');
    if (container) container.style.display = 'none';

    const firstCompletion = !this.profile.tutorialCompleted;
    this.profile.tutorialCompleted = true;
    if (firstCompletion) {
      this.profile.cash += 3000;
      this.profile.repPoints += 200;
      if (this.profile.repPoints >= this.profile.repLevel * 1000) {
        this.profile.repLevel++;
      }
    }
    this.persistDurableProgress(true);
    sound.playSuccessFanfare();

    if (this.smartphone?.isOpen) {
      this.smartphone.close();
    }

    if (!this.tutorialCompletedBannerShown) {
      this.tutorialCompletedBannerShown = true;
      this.showTutorialCompleteModal(firstCompletion);
      this.playAlanTutorialCompleteVoice();
    }
  }

  private showTutorialCompleteModal(firstCompletion: boolean) {
    document.getElementById('TutorialCompleteModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'TutorialCompleteModal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-card result-modal">
        <h2 class="text-victory">🎓 TUTORIAL CONCLUÍDO!</h2>
        <p class="modal-desc">
          Você dominou aceleração, curvas, drift, nitro, câmera, modo a pé e o celular! Todos os modos de jogo agora estão desbloqueados.
        </p>
        <div class="alan-voice-banner alan-voice-modal-bar is-speaking" id="alanCompleteVoiceBar">
          <span class="alan-voice-speaker">🎙️ Alan</span>
          <span class="alan-voice-caption" id="alanCompleteVoiceText">Terminou? Agora você tem o jogo inteiro para testar e curtir.</span>
          <button class="alan-voice-replay-btn" id="btnReplayAlanComplete" type="button" title="Ouvir Alan novamente">🔊</button>
        </div>
        ${
          firstCompletion
            ? `
          <div class="result-rewards">
            <div class="reward-box">💰 Bônus: +R$ 3.000</div>
            <div class="reward-box">⭐ Reputação: +200 RP</div>
          </div>
        `
            : ''
        }
        <div class="modal-actions result-actions-row">
          <button class="secondary-btn" id="btnTutOpenSettings" type="button">⚙️ Configurações / Google</button>
          <button class="secondary-btn" id="btnTutKeepDriving" type="button">🚗 CONTINUAR NA CIDADE</button>
          <button class="primary-btn" id="btnTutGoMenu" type="button">🏠 IR PARA O MENU PRINCIPAL</button>
        </div>
      </div>
    `;
    this.root.appendChild(modal);

    modal.querySelector('#btnReplayAlanComplete')?.addEventListener('click', () => {
      sound.ensureRunning();
      this.playAlanTutorialCompleteVoice();
    });

    modal.querySelector('#btnTutOpenSettings')?.addEventListener('click', () => {
      modal.remove();
      this.isPaused = true;
      this.onPauseChanged?.(true);
      this.showSettingsModal();
    });

    modal.querySelector('#btnTutKeepDriving')?.addEventListener('click', () => {
      modal.remove();
      this.showToast('🔓 Todos os modos desbloqueados! Explore a cidade à vontade.');
    });

    modal.querySelector('#btnTutGoMenu')?.addEventListener('click', () => {
      sound.stopVoiceClips();
      modal.remove();
      if (this.smartphone?.isOpen) {
        this.smartphone.toggle();
      }
      this.renderTitleScreen();
    });
  }

  // --- In-Game HUD & Mobile Touch Controls ---
  private renderTouchControlsMarkup(): string {
    const style = this.getHudControlStyle();
    const utilityBtns = `
      <button class="touch-btn foot-toggle-touch-btn" id="touchToggleFoot" type="button" title="Sair / Montar (F)">🚶 SAIR</button>
      <button class="touch-btn phone-touch-btn" id="touchPhoneBtn" type="button" title="Celular (NetDrift & ZapDrift)">📱</button>
      <button class="touch-btn interact-touch-btn" id="touchInteractBtn" type="button" style="display:none;" title="Interagir (E)">🔑 [E]</button>
    `;

    if (style === 'nfs_tap') {
      return `
        <button class="touch-btn nfs-tap-zone nfs-tap-left" id="touchNfsLeftZone" type="button" aria-label="Toque esquerdo para virar">
          <span class="nfs-tap-chevron">‹</span>
          <span class="nfs-tap-hint">ESQUERDA</span>
        </button>
        <button class="touch-btn nfs-tap-zone nfs-tap-right" id="touchNfsRightZone" type="button" aria-label="Toque direito para virar">
          <span class="nfs-tap-chevron">›</span>
          <span class="nfs-tap-hint">DIREITA</span>
        </button>

        <div class="touch-zone-left nfs-utility-cluster">
          <div class="auto-gas-pill">⚡ AUTO-ACELERAÇÃO NFS</div>
          ${utilityBtns}
        </div>

        <div class="touch-zone-right nfs-action-cluster">
          <button class="touch-btn nitro-touch-btn nfs-nitro-btn" id="touchNitro" type="button">⚡ NITRO</button>
          <button class="touch-btn handbrake-touch-btn nfs-drift-btn" id="touchHandbrake" type="button">🛑 DRIFT</button>
          <button class="touch-btn brake-touch-btn nfs-brake-btn" id="touchBrake" type="button">FREIO / RÉ</button>
        </div>
      `;
    }

    if (style === 'nfs_pedals') {
      return `
        <div class="touch-zone-left split-left-cluster">
          <button class="touch-btn steer-btn split-steer-btn" id="touchSteerLeft" type="button" aria-label="Virar para esquerda">◀</button>
          <button class="touch-btn brake-touch-btn split-brake-btn" id="touchBrake" type="button">FREIO / RÉ</button>
          <div class="split-utils-col">${utilityBtns}</div>
        </div>

        <div class="touch-zone-right split-right-cluster">
          <div class="split-top-actions">
            <button class="touch-btn nitro-touch-btn" id="touchNitro" type="button">⚡ NITRO</button>
            <button class="touch-btn handbrake-touch-btn" id="touchHandbrake" type="button">🛑 DRIFT</button>
          </div>
          <div class="split-bottom-pedals">
            <button class="touch-btn steer-btn split-steer-btn" id="touchSteerRight" type="button" aria-label="Virar para direita">▶</button>
            <button class="touch-btn gas-touch-btn split-tall-gas" id="touchGas" type="button">ACELERAR</button>
          </div>
        </div>
      `;
    }

    if (style === 'joystick') {
      return `
        <div class="touch-zone-left joystick-zone-left">
          <div class="touch-joystick-pad" id="touchJoystickPad" aria-label="Joystick analógico de direção">
            <div class="touch-joystick-ring"></div>
            <div class="touch-joystick-knob" id="touchJoystickKnob">🏎️</div>
          </div>
          <div class="joystick-utils-col">${utilityBtns}</div>
        </div>

        <div class="touch-zone-right">
          <button class="touch-btn nitro-touch-btn" id="touchNitro" type="button">⚡ NITRO</button>
          <button class="touch-btn handbrake-touch-btn" id="touchHandbrake" type="button">🛑 DRIFT</button>
          <button class="touch-btn brake-touch-btn" id="touchBrake" type="button">FREIO / RÉ</button>
          <button class="touch-btn gas-touch-btn" id="touchGas" type="button">ACELERAR</button>
        </div>
      `;
    }

    if (style === 'auto_gas') {
      return `
        <div class="touch-zone-left">
          <button class="touch-btn steer-btn autogas-steer-btn" id="touchSteerLeft" type="button" aria-label="Virar para esquerda">◀</button>
          <button class="touch-btn steer-btn autogas-steer-btn" id="touchSteerRight" type="button" aria-label="Virar para direita">▶</button>
          ${utilityBtns}
        </div>

        <div class="touch-zone-right">
          <div class="auto-gas-pill">🚀 PILOTO AUTOMÁTICO</div>
          <button class="touch-btn nitro-touch-btn" id="touchNitro" type="button">⚡ NITRO</button>
          <button class="touch-btn handbrake-touch-btn" id="touchHandbrake" type="button">🛑 DRIFT</button>
          <button class="touch-btn brake-touch-btn" id="touchBrake" type="button">FREIO / RÉ</button>
        </div>
      `;
    }

    // Default: 'classic'
    return `
      <div class="touch-zone-left">
        <button class="touch-btn steer-btn" id="touchSteerLeft" type="button" aria-label="Virar para esquerda">◀</button>
        <button class="touch-btn steer-btn" id="touchSteerRight" type="button" aria-label="Virar para direita">▶</button>
        ${utilityBtns}
      </div>

      <div class="touch-zone-right">
        <button class="touch-btn nitro-touch-btn" id="touchNitro" type="button">⚡ NITRO</button>
        <button class="touch-btn handbrake-touch-btn" id="touchHandbrake" type="button">🛑 DRIFT</button>
        <button class="touch-btn brake-touch-btn" id="touchBrake" type="button">FREIO / RÉ</button>
        <button class="touch-btn gas-touch-btn" id="touchGas" type="button">ACELERAR</button>
      </div>
    `;
  }

  private bindTouchControls() {
    this.activeTouchCleanup?.();
    this.controls.throttle = 0;
    this.controls.brake = 0;
    this.controls.steer = 0;
    this.controls.handbrake = false;
    this.controls.nitro = false;

    const togglePhone = () => {
      this.toggleSmartphone();
    };
    document.getElementById('touchPhoneBtn')?.addEventListener('click', togglePhone);
    document.getElementById('touchInteractBtn')?.addEventListener('click', () => {
      this.notifyTutorialAction('location_interact');
      this.onInteractLocation?.();
    });
    document.getElementById('touchToggleFoot')?.addEventListener('click', () => {
      this.notifyTutorialAction('transport_switch');
      this.onToggleEnterExitVehicle?.();
    });

    // Pointer-captured multi-touch bindings so sliding thumb slightly never drops throttle/steering
    let steerLeftHeld = false;
    let steerRightHeld = false;
    const syncTouchSteer = () => {
      if (!this.gyroActive) {
        this.controls.steer = (steerRightHeld ? 1 : 0) - (steerLeftHeld ? 1 : 0);
      }
    };

    const touchResets: Array<() => void> = [];
    const bindTouch = (id: string, onDown: () => void, onUp: () => void) => {
      const el = document.getElementById(id);
      if (!el) return;
      const activePointers = new Set<number>();

      const release = (pointerId?: number) => {
        if (pointerId !== undefined) {
          activePointers.delete(pointerId);
        } else {
          activePointers.clear();
        }
        if (activePointers.size === 0) {
          el.classList.remove('is-pressed');
          onUp();
        }
      };

      touchResets.push(() => release());

      el.addEventListener(
        'pointerdown',
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            el.setPointerCapture(e.pointerId);
          } catch {}
          activePointers.add(e.pointerId);
          el.classList.add('is-pressed');
          onDown();
        },
        { passive: false }
      );

      el.addEventListener(
        'pointerup',
        (e) => {
          e.preventDefault();
          try {
            if (el.hasPointerCapture(e.pointerId)) {
              el.releasePointerCapture(e.pointerId);
            }
          } catch {}
          release(e.pointerId);
        },
        { passive: false }
      );

      el.addEventListener(
        'pointercancel',
        (e) => {
          e.preventDefault();
          release(e.pointerId);
        },
        { passive: false }
      );

      el.addEventListener('lostpointercapture', (e) => {
        release(e.pointerId);
      });
    };

    const bindSteerLeft = (id: string) =>
      bindTouch(
        id,
        () => {
          steerLeftHeld = true;
          syncTouchSteer();
        },
        () => {
          steerLeftHeld = false;
          syncTouchSteer();
        }
      );

    const bindSteerRight = (id: string) =>
      bindTouch(
        id,
        () => {
          steerRightHeld = true;
          syncTouchSteer();
        },
        () => {
          steerRightHeld = false;
          syncTouchSteer();
        }
      );

    bindSteerLeft('touchSteerLeft');
    bindSteerRight('touchSteerRight');
    bindSteerLeft('touchNfsLeftZone');
    bindSteerRight('touchNfsRightZone');

    // Analog 360 Joystick Binding
    const joystickPad = document.getElementById('touchJoystickPad');
    const joystickKnob = document.getElementById('touchJoystickKnob');
    if (joystickPad && joystickKnob) {
      let activeJoyPointer: number | null = null;
      const updateJoystickFromEvent = (clientX: number, clientY: number) => {
        const rect = joystickPad.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const maxRadius = rect.width * 0.36;
        let dx = clientX - cx;
        let dy = clientY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > maxRadius && dist > 0.001) {
          dx = (dx / dist) * maxRadius;
          dy = (dy / dist) * maxRadius;
        }
        joystickKnob.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
        if (!this.gyroActive) {
          const normX = dx / maxRadius;
          this.controls.steer = Math.abs(normX) < 0.08 ? 0 : Math.max(-1, Math.min(1, normX));
        }
      };

      const resetJoystick = () => {
        activeJoyPointer = null;
        joystickPad.classList.remove('is-pressed');
        joystickKnob.style.transform = 'translate(0px, 0px)';
        if (!this.gyroActive) {
          this.controls.steer = 0;
        }
      };

      touchResets.push(resetJoystick);

      joystickPad.addEventListener(
        'pointerdown',
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          activeJoyPointer = e.pointerId;
          try {
            joystickPad.setPointerCapture(e.pointerId);
          } catch {}
          joystickPad.classList.add('is-pressed');
          updateJoystickFromEvent(e.clientX, e.clientY);
        },
        { passive: false }
      );

      joystickPad.addEventListener(
        'pointermove',
        (e) => {
          if (activeJoyPointer !== e.pointerId) return;
          e.preventDefault();
          updateJoystickFromEvent(e.clientX, e.clientY);
        },
        { passive: false }
      );

      const endJoy = (e: PointerEvent) => {
        if (activeJoyPointer !== e.pointerId) return;
        try {
          if (joystickPad.hasPointerCapture(e.pointerId)) {
            joystickPad.releasePointerCapture(e.pointerId);
          }
        } catch {}
        resetJoystick();
      };
      joystickPad.addEventListener('pointerup', endJoy);
      joystickPad.addEventListener('pointercancel', endJoy);
      joystickPad.addEventListener('lostpointercapture', endJoy);
    }

    bindTouch(
      'touchGas',
      () => (this.controls.throttle = 1),
      () => (this.controls.throttle = 0)
    );
    bindTouch(
      'touchBrake',
      () => (this.controls.brake = 1),
      () => (this.controls.brake = 0)
    );
    bindTouch(
      'touchHandbrake',
      () => (this.controls.handbrake = true),
      () => (this.controls.handbrake = false)
    );
    bindTouch(
      'touchNitro',
      () => (this.controls.nitro = true),
      () => (this.controls.nitro = false)
    );

    const resetAllTouches = () => {
      steerLeftHeld = false;
      steerRightHeld = false;
      touchResets.forEach((fn) => fn());
    };
    window.addEventListener('blur', resetAllTouches);
    this.activeTouchCleanup = () => {
      window.removeEventListener('blur', resetAllTouches);
    };

    if (this.cachedHud) {
      this.cachedHud.touchInteractBtnEl = document.getElementById('touchInteractBtn');
    }
  }

  public renderHUD() {
    this.isPaused = false;
    this.isReplayActive = false;
    this.smartphone?.setClosedSilently();
    this.tutorialActive = this.currentMode === 'tutorial';
    document.getElementById('PauseModalOverlay')?.remove();
    document.getElementById('ReplayHudOverlay')?.remove();
    const hudStyle = this.getHudControlStyle();
    this.root.innerHTML = `
      <div class="hud-overlay">
        <!-- Weather Screen Overlay (Rain streaks, fog vignette, storm lightning flash) -->
        <div class="weather-screen-overlay" id="weatherHudOverlay">
          <div class="weather-rain-layer" id="weatherRainLayer" style="display:none;"></div>
          <div class="weather-fog-layer" id="weatherFogLayer" style="display:none;"></div>
          <div class="weather-lightning-flash" id="weatherLightningFlash" style="opacity:0;"></div>
        </div>

        <!-- Top Status Cluster -->
        <div class="hud-top-bar">
          <div class="heat-cluster" id="hudHeatCluster">
            <span class="heat-label">PROCURADO:</span>
            <span class="heat-stars" id="hudHeatStars">☆☆☆☆☆</span>
          </div>

          <div class="pursuit-status-badge" id="hudPursuitStatus">PATRULHA DA CIDADE</div>

          <div class="top-quick-actions">
            <span class="hud-net-badge ${networkStatus.isOnline ? 'is-online' : 'is-offline'}" id="hudNetBadge">${networkStatus.isOnline ? '🟢 ONLINE' : '🔴 OFFLINE (SEM SALVAMENTO)'}</span>
            <button class="hud-icon-btn hud-phone-btn" id="hudPhoneBtn" title="Celular & Internet Fictícia (Tecla T / Tab)">📱 CELULAR</button>
            <button class="hud-icon-btn hud-weather-badge" id="hudWeatherBadge" title="Alternar Clima">☀️ ENSOLARADO</button>
            <button class="hud-icon-btn hud-vehicle-toggle-btn" id="hudToggleVehicleBtn" title="Sair / Entrar no Veículo (Tecla F)">🚶 SAIR (F)</button>
            <button class="hud-icon-btn hud-pause-btn" id="hudPauseBtn" type="button" title="Pausar (ESC / P)">⏸ PAUSAR</button>
            <button class="hud-icon-btn" id="hudOrientationBtn" title="Alternar Horizontal / Vertical">${this.isEffectiveVertical() ? '📲 VERT' : '↔️ HORIZ'}</button>
            <button class="hud-icon-btn" id="hudGyroToggle" title="Alternar Giroscópio">📱 GIRO: ${this.gyroActive ? 'ON' : 'OFF'}</button>
            <button class="hud-icon-btn" id="hudCamBtn" title="Mudar Câmera">🎥 CÂMERA</button>
            <button class="hud-icon-btn" id="hudAudioBtn" title="Som">🔊</button>
            <button class="hud-icon-btn" id="hudExitBtn" title="Voltar ao Menu">✕ SAIR</button>
          </div>
        </div>

        <!-- Interactive Step-by-Step Tutorial Overlay -->
        <div class="tutorial-guide-overlay" id="tutorialGuideOverlay" style="display:none;"></div>

        <!-- Center Notification Banner -->
        <div class="hud-center-alert" id="hudCenterAlert" style="display:none;"></div>

        <!-- Accessible Location & Station Interaction Prompt -->
        <div class="hud-location-prompt" id="hudLocationPrompt" style="display:none;">
          <div class="location-prompt-badge">
            <span class="location-prompt-icon" id="hudLocationIcon">🏢</span>
            <div class="location-prompt-info">
              <span class="location-prompt-name" id="hudLocationName">Oficina Tuning</span>
              <span class="location-prompt-desc" id="hudLocationDesc">Pressione [E] ou toque para interagir</span>
            </div>
            <button class="location-prompt-btn" id="hudLocationActionBtn" type="button">INTERAGIR [E]</button>
          </div>
        </div>

        <!-- Off-road Score Penalty Indicator -->
        <div class="hud-offroad-warning" id="hudOffroadWarning" style="display:none;">
          <span class="offroad-icon">⚠️</span>
          <div class="offroad-text-block">
            <span class="offroad-title">FORA DA PISTA!</span>
            <span class="offroad-rate" id="hudOffroadRate">-20 PTS/S</span>
          </div>
        </div>

        <!-- Left Minimapa / Open World GPS / Room Ranking -->
        <div class="hud-left-panel">
          <div class="minimap-box">
            <canvas id="minimapCanvas" width="130" height="130"></canvas>
          </div>
          <div id="hudOpenWorldBox" class="openworld-hud-box" style="display:${this.currentMode === 'career_open_world' ? 'flex' : 'none'};">
            <div class="ow-district" id="hudOwDistrict">Centro Metropolitano</div>
            <div class="ow-metrics-row">
              <span id="hudOwStashes">📦 0/10</span>
              <span id="hudOwPaySpray">🔧 --m</span>
            </div>
          </div>
          <div id="roomRankingBox" class="room-ranking-hud" style="display:none;">
            <h4>SALA ONLINE (${this.mpManager.currentRoom?.code || '----'})</h4>
            <div id="roomRankingEntries"></div>
          </div>
        </div>

        <!-- Right Speedometer & Gauges -->
        <div class="hud-right-panel">
          <div class="speed-cluster">
            <div class="gear-display" id="hudGear">1</div>
            <div class="speed-digits">
              <span class="speed-number" id="hudSpeed">0</span>
              <span class="speed-unit">KM/H</span>
            </div>
            <!-- RPM Bar -->
            <div class="rpm-meter">
              <div class="rpm-fill" id="hudRpmFill" style="width: 20%;"></div>
            </div>
          </div>

          <!-- Nitro & Damage Bars -->
          <div class="meter-bars">
            <div class="meter-row">
              <span class="meter-label">NITRO:</span>
              <div class="meter-track">
                <div class="meter-fill nitro-fill" id="hudNitroFill" style="width: 100%;"></div>
              </div>
            </div>
            <div class="meter-row">
              <span class="meter-label">INTEGRIDADE:</span>
              <div class="meter-track">
                <div class="meter-fill health-fill" id="hudHealthFill" style="width: 100%;"></div>
              </div>
            </div>
          </div>

          <!-- Drift Score Badge -->
          <div class="drift-score-badge" id="hudDriftBadge" style="display:none;">
            DRIFT: <span id="hudDriftPoints">0</span> PTS
          </div>
        </div>

        <!-- Bottom Transport Selector Dock (Available in Open World and Free Roam) -->
        <div class="ow-transport-wrapper" id="owTransportWrapper">
          <div class="ow-mount-prompt" id="hudOwMountPrompt" style="display:none;"></div>
          <div class="ow-transport-dock" id="owTransportDock">
            <button type="button" class="ow-transport-chip ow-moto-chip" data-ow-mode="moto_street" title="Moto Street (Tecla 1)">🏍️ Street</button>
            <button type="button" class="ow-transport-chip ow-moto-chip" data-ow-mode="moto_super" title="Superbike (Tecla 2)">🏁 Super</button>
            <button type="button" class="ow-transport-chip ow-moto-chip" data-ow-mode="moto_cross" title="Moto Trail Cross (Tecla 3)">🏜️ Cross</button>
            <button type="button" class="ow-transport-chip active" data-ow-mode="car" title="Carro (Tecla 4)">🚗 Carro</button>
            <button type="button" class="ow-transport-chip" data-ow-mode="bicycle" title="Bicicleta (Tecla 5)">🚲 Bike</button>
            <button type="button" class="ow-transport-chip" data-ow-mode="skateboard" title="Skate (Tecla 6)">🛹 Skate</button>
            <button type="button" class="ow-transport-chip" data-ow-mode="foot" title="Andar a Pé (Tecla 7 ou F)">🚶 A Pé</button>
          </div>
        </div>

        <!-- Mobile Touch Controls Layout (Configurable in Settings) -->
        <div class="touch-controls-container hud-style-${hudStyle}" id="touchControlsContainer">
          ${this.renderTouchControlsMarkup()}
        </div>

        <!-- Functional Smartphone & Fictional In-Game Web System Viewport -->
        <div id="smartphoneContainer"></div>
      </div>
    `;

    // Event Listeners for Top HUD & Smartphone
    const togglePhone = () => {
      this.toggleSmartphone();
    };
    document.getElementById('hudPhoneBtn')?.addEventListener('click', togglePhone);
    document.getElementById('hudWeatherBadge')?.addEventListener('click', () => {
      this.onCycleWeather?.();
    });

    document.getElementById('hudToggleVehicleBtn')?.addEventListener('click', () => {
      this.notifyTutorialAction('transport_switch');
      this.onToggleEnterExitVehicle?.();
    });

    document.getElementById('hudLocationActionBtn')?.addEventListener('click', () => {
      this.notifyTutorialAction('location_interact');
      this.onInteractLocation?.();
    });

    document.getElementById('hudPauseBtn')?.addEventListener('click', () => {
      this.togglePause();
    });

    document.getElementById('hudExitBtn')?.addEventListener('click', () => {
      this.isPaused = false;
      this.tutorialActive = false;
      this.onPauseChanged?.(false);
      document.getElementById('PauseModalOverlay')?.remove();
      this.controls.throttle = 0;
      this.controls.brake = 0;
      this.controls.steer = 0;
      this.controls.handbrake = false;
      this.controls.nitro = false;
      this.mpManager.leaveRoom();
      this.renderTitleScreen();
    });

    document.getElementById('hudCamBtn')?.addEventListener('click', () => {
      this.controls.switchCamera = true;
      this.notifyTutorialAction('camera_switch');
    });

    document.getElementById('hudAudioBtn')?.addEventListener('click', () => {
      const isMuted = sound.toggleMute();
      const btn = document.getElementById('hudAudioBtn');
      if (btn) btn.innerText = isMuted ? '🔇' : '🔊';
    });

    document.getElementById('hudOrientationBtn')?.addEventListener('click', () => {
      this.toggleHorizontalVertical();
    });

    document.getElementById('hudGyroToggle')?.addEventListener('click', async () => {
      if (this.gyroActive) {
        this.gyroActive = false;
      } else {
        await this.enableGyroscope();
      }
      const btn = document.getElementById('hudGyroToggle');
      if (btn) btn.innerText = `📱 GIRO: ${this.gyroActive ? 'ON' : 'OFF'}`;
    });

    // Cache HUD DOM queries once on render to avoid 60fps getElementById calls
    const canvas = document.getElementById('minimapCanvas') as HTMLCanvasElement;
    this.cachedHud = {
      speedEl: document.getElementById('hudSpeed'),
      gearEl: document.getElementById('hudGear'),
      rpmFill: document.getElementById('hudRpmFill'),
      nitroFill: document.getElementById('hudNitroFill'),
      healthFill: document.getElementById('hudHealthFill'),
      heatStarsEl: document.getElementById('hudHeatStars'),
      statusEl: document.getElementById('hudPursuitStatus'),
      driftBadge: document.getElementById('hudDriftBadge'),
      driftPointsEl: document.getElementById('hudDriftPoints'),
      minimapCanvas: canvas,
      minimapCtx: canvas ? canvas.getContext('2d') : null,
      roomRankingBox: document.getElementById('roomRankingBox'),
      roomEntries: document.getElementById('roomRankingEntries'),
      offroadWarningEl: document.getElementById('hudOffroadWarning'),
      offroadRateEl: document.getElementById('hudOffroadRate'),
      openWorldBox: document.getElementById('hudOpenWorldBox'),
      districtEl: document.getElementById('hudOwDistrict'),
      stashCountEl: document.getElementById('hudOwStashes'),
      paySprayEl: document.getElementById('hudOwPaySpray'),
      owMountPromptEl: document.getElementById('hudOwMountPrompt'),
      weatherRainLayer: document.getElementById('weatherRainLayer'),
      weatherFogLayer: document.getElementById('weatherFogLayer'),
      weatherLightningFlash: document.getElementById('weatherLightningFlash'),
      weatherBadgeEl: document.getElementById('hudWeatherBadge'),
      toggleVehicleBtnEl: document.getElementById('hudToggleVehicleBtn'),
      locationPromptEl: document.getElementById('hudLocationPrompt'),
      locationIconEl: document.getElementById('hudLocationIcon'),
      locationNameEl: document.getElementById('hudLocationName'),
      locationDescEl: document.getElementById('hudLocationDesc'),
      locationActionBtnEl: document.getElementById('hudLocationActionBtn'),
      touchInteractBtnEl: document.getElementById('touchInteractBtn'),
    };
    this.minimapFrameSkip = 0;

    this.bindTouchControls();
    this.applyDynamicHudScale();

    // Bind Open World Transport Switcher Dock & Touch Enter/Exit button
    this.root.querySelectorAll('[data-ow-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-ow-mode') as OpenWorldTransportMode | null;
        if (mode) {
          this.notifyTutorialAction('transport_switch');
          this.onSelectOpenWorldTransport?.(mode);
        }
      });
    });

    document.getElementById('hudOwMountPrompt')?.addEventListener('click', () => {
      this.notifyTutorialAction('transport_switch');
      this.onToggleEnterExitVehicle?.();
    });

    // Mount closed smartphone shell once so opening/closing animates smoothly
    this.updateSmartphoneOverlay();
  }

  public updateWeatherHUD(
    weather: WeatherType,
    isLightningFlashing: boolean = false,
    clockInfo?: DayNightClockInfo
  ) {
    const hud = this.cachedHud;
    if (!hud) return;

    if (hud.weatherBadgeEl) {
      const labels: Record<WeatherType, string> = {
        sunny: '☀️ ENSOLARADO',
        rain: '🌧️ CHUVA (-25%)',
        storm: '⚡ TEMPESTADE (-35%)',
        fog: '🌫️ NEBLINA (-15%)',
      };
      const weatherText = labels[weather] || '☀️ CLIMA';
      hud.weatherBadgeEl.innerText = clockInfo
        ? `${clockInfo.icon} ${clockInfo.clockText} ${clockInfo.label} · ${weatherText}`
        : weatherText;
    }

    if (hud.weatherRainLayer) {
      hud.weatherRainLayer.style.display = weather === 'rain' || weather === 'storm' ? 'block' : 'none';
      if (weather === 'storm') {
        hud.weatherRainLayer.classList.add('storm-mode');
      } else {
        hud.weatherRainLayer.classList.remove('storm-mode');
      }
    }

    if (hud.weatherFogLayer) {
      hud.weatherFogLayer.style.display = weather === 'fog' ? 'block' : 'none';
    }

    if (hud.weatherLightningFlash) {
      hud.weatherLightningFlash.style.opacity = isLightningFlashing ? '0.75' : '0';
    }
  }

  public updateLocationInteractionPrompt(prompt: {
    canInteract: boolean;
    locationName?: string;
    actionName?: string;
    icon?: string;
    instruction?: string;
  } | null) {
    const hud = this.cachedHud;
    if (!hud) return;

    if (!prompt || !prompt.canInteract) {
      if (hud.locationPromptEl) hud.locationPromptEl.style.display = 'none';
      if (hud.touchInteractBtnEl) hud.touchInteractBtnEl.style.display = 'none';
      return;
    }

    if (hud.locationPromptEl) {
      hud.locationPromptEl.style.display = 'flex';
      if (hud.locationIconEl) hud.locationIconEl.innerText = prompt.icon || '📍';
      if (hud.locationNameEl) hud.locationNameEl.innerText = prompt.locationName || 'Local';
      if (hud.locationDescEl) hud.locationDescEl.innerText = prompt.instruction || 'Pressione [E] para interagir';
      if (hud.locationActionBtnEl) {
        hud.locationActionBtnEl.innerText = prompt.actionName ? `${prompt.actionName} [E]` : 'INTERAGIR [E]';
      }
    }

    if (hud.touchInteractBtnEl) {
      hud.touchInteractBtnEl.style.display = 'inline-flex';
      hud.touchInteractBtnEl.innerText = prompt.icon ? `${prompt.icon} [E]` : '🔑 [E]';
    }
  }

  public lastPlayerPos: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };

  public updateSmartphoneOverlay(playerPos?: { x: number; y: number; z: number }) {
    const container = document.getElementById('smartphoneContainer');
    if (!container) return;
    const pos = playerPos || this.lastPlayerPos;
    this.smartphone.setWeatherDisplay(this.weather);
    container.innerHTML = this.smartphone.render(pos);
    this.smartphone.bindDOMEvents(container);
  }

  public toggleSmartphone(playerPos?: { x: number; y: number; z: number }) {
    const pos = playerPos || this.lastPlayerPos;
    this.smartphone.setWeatherDisplay(this.weather);
    const container = document.getElementById('smartphoneContainer');
    if (container && !container.querySelector('#smartphoneOverlay')) {
      container.innerHTML = this.smartphone.render(pos);
      this.smartphone.bindDOMEvents(container);
    }
    this.smartphone.toggle();
  }

  public updateOpenWorldTransportUI(mode: OpenWorldTransportMode, nearMountLabel: string | null = null) {
    this.root.querySelectorAll('[data-ow-mode]').forEach((btn) => {
      const btnMode = btn.getAttribute('data-ow-mode');
      btn.classList.toggle('active', btnMode === mode);
    });

    const promptEl = this.cachedHud?.owMountPromptEl || document.getElementById('hudOwMountPrompt');
    if (promptEl) {
      if (nearMountLabel) {
        promptEl.style.display = 'inline-flex';
        promptEl.innerText = `[F] ${nearMountLabel}`;
      } else {
        promptEl.style.display = 'none';
      }
    }

    const footBtn = document.getElementById('touchToggleFoot');
    if (footBtn) {
      footBtn.innerText = mode === 'foot' ? (nearMountLabel ? '🔑 ENTRAR' : '🏍️ MOTO') : '🚶 SAIR';
    }

    const toggleBtn = this.cachedHud?.toggleVehicleBtnEl || document.getElementById('hudToggleVehicleBtn');
    if (toggleBtn) {
      toggleBtn.innerText = mode === 'foot' ? '🚗 ENTRAR (F)' : '🚶 SAIR (F)';
    }

    const gasBtn = document.getElementById('touchGas');
    const brakeBtn = document.getElementById('touchBrake');
    const handbrakeBtn = document.getElementById('touchHandbrake');
    const nitroBtn = document.getElementById('touchNitro');
    if (mode === 'foot') {
      if (gasBtn) gasBtn.innerText = 'ANDAR';
      if (brakeBtn) brakeBtn.innerText = 'TRÁS';
      if (handbrakeBtn) handbrakeBtn.innerText = '🦘 PULAR';
      if (nitroBtn) nitroBtn.innerText = '🏃 CORRER';
    } else if (mode === 'skateboard') {
      if (gasBtn) gasBtn.innerText = 'REMAR';
      if (brakeBtn) brakeBtn.innerText = 'FREAR';
      if (handbrakeBtn) handbrakeBtn.innerText = '🛹 OLLIE';
      if (nitroBtn) nitroBtn.innerText = '⚡ IMPULSO';
    } else if (mode === 'bicycle') {
      if (gasBtn) gasBtn.innerText = 'PEDALAR';
      if (brakeBtn) brakeBtn.innerText = 'FREAR';
      if (handbrakeBtn) handbrakeBtn.innerText = '🦘 SALTAR';
      if (nitroBtn) nitroBtn.innerText = '💨 SPRINT';
    } else if (mode === 'moto_street' || mode === 'moto_super' || mode === 'moto_cross') {
      if (gasBtn) gasBtn.innerText = 'ACELERAR';
      if (brakeBtn) brakeBtn.innerText = 'FREIO / RÉ';
      if (handbrakeBtn) handbrakeBtn.innerText = mode === 'moto_cross' ? '🦘 SALTAR' : '🏍️ GRAU';
      if (nitroBtn) nitroBtn.innerText = '⚡ NITRO';
    } else {
      if (gasBtn) gasBtn.innerText = 'ACELERAR';
      if (brakeBtn) brakeBtn.innerText = 'FREIO / RÉ';
      if (handbrakeBtn) handbrakeBtn.innerText = '🛑 DRIFT';
      if (nitroBtn) nitroBtn.innerText = '⚡ NITRO';
    }
  }

  public showOffroadWarning(ratePerSec: number) {
    if (this.currentMode === 'title') return;
    const warnEl = this.cachedHud?.offroadWarningEl || document.getElementById('hudOffroadWarning');
    const rateEl = this.cachedHud?.offroadRateEl || document.getElementById('hudOffroadRate');
    if (warnEl) {
      warnEl.style.display = 'flex';
    }
    if (rateEl) {
      rateEl.innerText = `-${ratePerSec} PTS/S`;
    }
  }

  public hideOffroadWarning() {
    const warnEl = this.cachedHud?.offroadWarningEl || document.getElementById('hudOffroadWarning');
    if (warnEl && warnEl.style.display !== 'none') {
      warnEl.style.display = 'none';
    }
  }

  // --- Real-Time HUD Update per Frame (Zero DOM thrashing & throttled radar) ---
  public updateHUD(
    speedKmh: number,
    gear: number | string,
    rpm: number,
    nitro: number,
    health: number,
    heatLevel: number,
    pursuitStatus: string,
    isDrifting: boolean,
    driftPoints: number,
    playerX: number,
    playerZ: number,
    copPositions: { x: number; z: number }[],
    openWorldHud?: OpenWorldHudState,
    openWorldMarkers?: { paySprays: { x: number; z: number }[]; stashes: { x: number; z: number }[] }
  ) {
    if (this.currentMode === 'title') return;
    this.lastPlayerPos.x = playerX;
    this.lastPlayerPos.z = playerZ;

    if (!this.cachedHud) {
      const canvas = document.getElementById('minimapCanvas') as HTMLCanvasElement;
      this.cachedHud = {
        speedEl: document.getElementById('hudSpeed'),
        gearEl: document.getElementById('hudGear'),
        rpmFill: document.getElementById('hudRpmFill'),
        nitroFill: document.getElementById('hudNitroFill'),
        healthFill: document.getElementById('hudHealthFill'),
        heatStarsEl: document.getElementById('hudHeatStars'),
        statusEl: document.getElementById('hudPursuitStatus'),
        driftBadge: document.getElementById('hudDriftBadge'),
        driftPointsEl: document.getElementById('hudDriftPoints'),
        minimapCanvas: canvas,
        minimapCtx: canvas ? canvas.getContext('2d') : null,
        roomRankingBox: document.getElementById('roomRankingBox'),
        roomEntries: document.getElementById('roomRankingEntries'),
        offroadWarningEl: document.getElementById('hudOffroadWarning'),
        offroadRateEl: document.getElementById('hudOffroadRate'),
        openWorldBox: document.getElementById('hudOpenWorldBox'),
        districtEl: document.getElementById('hudOwDistrict'),
        stashCountEl: document.getElementById('hudOwStashes'),
        paySprayEl: document.getElementById('hudOwPaySpray'),
        owMountPromptEl: document.getElementById('hudOwMountPrompt'),
        weatherRainLayer: document.getElementById('weatherRainLayer'),
        weatherFogLayer: document.getElementById('weatherFogLayer'),
        weatherLightningFlash: document.getElementById('weatherLightningFlash'),
        weatherBadgeEl: document.getElementById('hudWeatherBadge'),
        toggleVehicleBtnEl: document.getElementById('hudToggleVehicleBtn'),
        locationPromptEl: document.getElementById('hudLocationPrompt'),
        locationIconEl: document.getElementById('hudLocationIcon'),
        locationNameEl: document.getElementById('hudLocationName'),
        locationDescEl: document.getElementById('hudLocationDesc'),
        locationActionBtnEl: document.getElementById('hudLocationActionBtn'),
        touchInteractBtnEl: document.getElementById('touchInteractBtn'),
      };
    }

    const hud = this.cachedHud;
    if (!hud) return;

    // 1. Speed & Gauges
    if (hud.speedEl) hud.speedEl.innerText = speedKmh.toString();
    if (hud.gearEl) hud.gearEl.innerText = gear.toString();
    if (hud.rpmFill) hud.rpmFill.style.width = `${Math.min(100, Math.round(rpm * 100))}%`;
    if (hud.nitroFill) hud.nitroFill.style.width = `${Math.min(100, Math.round(nitro))}%`;
    if (hud.healthFill) hud.healthFill.style.width = `${Math.min(100, Math.round(health))}%`;

    // 2. Heat Stars (Pre-built lookup table)
    if (hud.heatStarsEl) {
      const clampedHeat = Math.max(0, Math.min(5, heatLevel));
      hud.heatStarsEl.innerText = GameUI.STAR_STRINGS[clampedHeat];
      hud.heatStarsEl.style.color = clampedHeat > 0 ? '#ff0055' : '#888888';
    }

    // 3. Pursuit Status
    if (hud.statusEl) {
      hud.statusEl.innerText = pursuitStatus;
      if (pursuitStatus.includes('EVADINDO')) {
        hud.statusEl.className = 'pursuit-status-badge evading';
      } else if (pursuitStatus.includes('PRESO')) {
        hud.statusEl.className = 'pursuit-status-badge busted';
      } else if (heatLevel > 0) {
        hud.statusEl.className = 'pursuit-status-badge active-chase';
      } else {
        hud.statusEl.className = 'pursuit-status-badge';
      }
    }

    // 4. Drift Badge
    if (hud.driftBadge && hud.driftPointsEl) {
      if (isDrifting && driftPoints > 0) {
        hud.driftBadge.style.display = 'block';
        hud.driftPointsEl.innerText = driftPoints.toLocaleString();
      } else {
        hud.driftBadge.style.display = 'none';
      }
    }

    // 4b. Open World District & POI strip
    if (hud.openWorldBox) {
      if (openWorldHud && this.currentMode === 'career_open_world') {
        hud.openWorldBox.style.display = 'flex';
        if (hud.districtEl) hud.districtEl.innerText = openWorldHud.districtName;
        if (hud.stashCountEl) {
          hud.stashCountEl.innerText = `📦 ${openWorldHud.stashesCollected}/${openWorldHud.stashesTotal}`;
        }
        if (hud.paySprayEl) {
          hud.paySprayEl.innerText =
            openWorldHud.nearestPaySprayMeters < 9000
              ? `🔧 ${openWorldHud.nearestPaySprayMeters}m`
              : '🔧 --m';
        }
      } else {
        hud.openWorldBox.style.display = 'none';
      }
    }

    // 5. Minimap Radar Drawing (Throttled to run at ~20Hz instead of 60Hz to save CPU)
    this.minimapFrameSkip = (this.minimapFrameSkip + 1) % 3;
    if (this.minimapFrameSkip === 0 && hud.minimapCtx && hud.minimapCanvas) {
      const ctx = hud.minimapCtx;
      const scaleFactor = hud.minimapCanvas.width / 130;
      ctx.save();
      ctx.setTransform(scaleFactor, 0, 0, scaleFactor, 0, 0);
      ctx.clearRect(0, 0, 130, 130);
      ctx.fillStyle = 'rgba(10, 15, 24, 0.75)';
      ctx.beginPath();
      ctx.arc(65, 65, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#223344';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Range scale: wider 190m radar in Open World so Pay & Spray + Stashes are easier to spot
      const radarRange = this.currentMode === 'career_open_world' ? 190 : 120;
      const scale = 55 / radarRange;

      // Open World POIs: Contraband Stashes (Gold) & Pay & Spray (Emerald Squares)
      if (openWorldMarkers) {
        ctx.fillStyle = '#ffd60a';
        for (let i = 0; i < openWorldMarkers.stashes.length; i++) {
          const st = openWorldMarkers.stashes[i];
          const dx = (st.x - playerX) * scale;
          const dz = (st.z - playerZ) * scale;
          if (dx * dx + dz * dz < 55 * 55) {
            ctx.beginPath();
            ctx.arc(65 + dx, 65 + dz, 3.0, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.fillStyle = '#00ff9d';
        for (let i = 0; i < openWorldMarkers.paySprays.length; i++) {
          const ps = openWorldMarkers.paySprays[i];
          const dx = (ps.x - playerX) * scale;
          const dz = (ps.z - playerZ) * scale;
          const mag = Math.hypot(dx, dz);
          const clampDist = mag > 53 ? 53 / mag : 1;
          const rx = 65 + dx * clampDist;
          const ry = 65 + dz * clampDist;
          ctx.fillRect(rx - 3.5, ry - 3.5, 7, 7);
        }
      }

      // Draw Police Dots (Red)
      ctx.fillStyle = '#ff0044';
      for (let i = 0; i < copPositions.length; i++) {
        const cop = copPositions[i];
        const dx = (cop.x - playerX) * scale;
        const dz = (cop.z - playerZ) * scale;
        if (dx * dx + dz * dz < 55 * 55) {
          ctx.beginPath();
          ctx.arc(65 + dx, 65 + dz, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw Player Dot (Cyan) in center
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(65, 65, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 6. Multiplayer Room Ranking Update if in room
    if (hud.roomRankingBox && hud.roomEntries && this.mpManager.currentRoom) {
      hud.roomRankingBox.style.display = 'block';
      hud.roomEntries.innerHTML = this.mpManager.currentRoom.players
        .slice(0, 4)
        .map(
          (p, idx) => `
        <div class="mini-rank-row ${p.isLocal ? 'is-local' : ''}">
          <span>#${idx + 1} ${p.name}</span>
          <span>${p.currentSpeed} km/h</span>
        </div>
      `
        )
        .join('');
    }
  }

  public togglePause() {
    if (this.currentMode === 'title' || this.isReplayActive) return;
    const driveModal = document.getElementById('DriveCloudSaveModalOverlay');
    if (driveModal) {
      driveModal.remove();
      return;
    }
    const settingsModal = document.getElementById('SettingsModalOverlay');
    if (settingsModal) {
      settingsModal.remove();
      if (!document.getElementById('PauseModalOverlay') && this.isPaused) {
        this.isPaused = false;
        sound.resumeVoiceClip();
        this.onPauseChanged?.(false);
      }
      return;
    }
    if (this.isPaused) {
      this.closePauseModal(true);
    } else {
      this.showPauseModal();
    }
  }

  public showPauseModal() {
    if (this.currentMode === 'title') return;
    this.isPaused = true;
    sound.pauseVoiceClip();
    this.controls.throttle = 0;
    this.controls.brake = 0;
    this.controls.steer = 0;
    this.controls.handbrake = false;
    this.controls.nitro = false;
    this.onPauseChanged?.(true);

    document.getElementById('PauseModalOverlay')?.remove();

    const isOnlineMode = this.currentMode === 'multiplayer';
    const hasReplay = Boolean(this.hasReplayAvailable?.());
    const overlay = document.createElement('div');
    overlay.id = 'PauseModalOverlay';
    overlay.className = 'modal-backdrop pause-backdrop';

    const modeLabels: Record<GameMode, string> = {
      title: 'Menu',
      story: 'Modo História',
      career: 'Modo Carreira',
      career_open_world: 'Carreira · Mundo Aberto (GTA)',
      challenge: 'Modo Desafio',
      free_roam: 'Modo Livre',
      tutorial: 'Tutorial',
      multiplayer: 'Multiplayer Online',
    };

    overlay.innerHTML = `
      <div class="modal-card pause-modal-card">
        <div class="modal-header">
          <h2>${isOnlineMode ? '⏸ PAUSADO · ONLINE AO VIVO' : '⏸ JOGO PAUSADO'}</h2>
          <button class="close-modal-btn" id="btnClosePauseModal" type="button">&times;</button>
        </div>
        <p class="pause-mode-meta">${modeLabels[this.currentMode]} · ${isOnlineMode ? 'Sala #' + (this.mpManager.currentRoom?.code || '----') : 'Partida Local'}</p>

        ${
          isOnlineMode
            ? `
          <div class="pause-online-notice">
            🌐 <strong>Modo Online sem Congelamento:</strong> A corrida continua em tempo real no servidor para não prejudicar os demais jogadores. Seus pedais e direção estão travados enquanto o menu está aberto.
          </div>
        `
            : ''
        }

        <div class="pause-actions-grid">
          <button class="primary-btn pause-main-cta" id="btnPauseResume" type="button">▶ ${isOnlineMode ? 'Voltar à Corrida' : 'Continuar'}</button>
          ${
            !isOnlineMode
              ? `<button class="secondary-btn" id="btnPauseReplay" type="button" ${!hasReplay ? 'disabled' : ''}>🎬 ${hasReplay ? 'Assistir Replay Instantâneo' : 'Replay (dirija alguns segundos)'}</button>
                 <button class="secondary-btn" id="btnPauseRestart" type="button">🔄 Reiniciar Partida</button>`
              : `<button class="secondary-btn" id="btnPauseResetCar" type="button">🔄 Reposicionar Carro na Pista</button>`
          }
          <div class="pause-quick-row">
            <button class="option-btn" id="btnPauseMute" type="button">${sound.isMuted() ? '🔇 Som: Mudo' : '🔊 Som: Ativo'}</button>
            <button class="option-btn" id="btnPauseOrientation" type="button">${this.isEffectiveVertical() ? '📲 Vertical' : '↔️ Horizontal'}</button>
            <button class="option-btn" id="btnPauseCamera" type="button">🎥 Câmera</button>
          </div>
          <button class="secondary-btn pause-settings-btn" id="btnPauseSettings" type="button">⚙️ Configurações</button>
          <button class="secondary-btn pause-exit-btn" id="btnPauseExitMenu" type="button">🚪 ${isOnlineMode ? 'Sair da Sala Online' : 'Voltar ao Menu Principal'}</button>
        </div>
      </div>
    `;
    this.root.appendChild(overlay);

    const resumeHandler = () => this.closePauseModal(true);
    overlay.querySelector('#btnClosePauseModal')?.addEventListener('click', resumeHandler);
    overlay.querySelector('#btnPauseResume')?.addEventListener('click', resumeHandler);

    overlay.querySelector('#btnPauseSettings')?.addEventListener('click', () => {
      this.showSettingsModal();
    });

    overlay.querySelector('#btnPauseReplay')?.addEventListener('click', () => {
      if (!this.hasReplayAvailable?.()) {
        this.showToast('🎬 Dirija alguns segundos antes de assistir ao Replay.');
        return;
      }
      overlay.remove();
      this.onOpenReplay?.('pause');
    });

    overlay.querySelector('#btnPauseRestart')?.addEventListener('click', () => {
      this.closePauseModal(false);
      this.onRestartMode?.();
    });

    overlay.querySelector('#btnPauseResetCar')?.addEventListener('click', () => {
      this.controls.resetVehicle = true;
      this.closePauseModal(true);
      this.showToast('🚗 Carro reposicionado na pista!');
    });

    overlay.querySelector('#btnPauseMute')?.addEventListener('click', (e) => {
      const muted = sound.toggleMute();
      (e.currentTarget as HTMLElement).innerText = muted ? '🔇 Som: Mudo' : '🔊 Som: Ativo';
      const hudAudioBtn = document.getElementById('hudAudioBtn');
      if (hudAudioBtn) hudAudioBtn.innerText = muted ? '🔇' : '🔊';
    });

    overlay.querySelector('#btnPauseOrientation')?.addEventListener('click', (e) => {
      this.toggleHorizontalVertical();
      (e.currentTarget as HTMLElement).innerText = this.isEffectiveVertical() ? '📲 Vertical' : '↔️ Horizontal';
    });

    overlay.querySelector('#btnPauseCamera')?.addEventListener('click', () => {
      this.controls.switchCamera = true;
      this.notifyTutorialAction('camera_switch');
      this.showToast('🎥 Câmera alternada!');
    });

    overlay.querySelector('#btnPauseExitMenu')?.addEventListener('click', () => {
      this.tutorialActive = false;
      this.closePauseModal(false);
      this.mpManager.leaveRoom();
      this.renderTitleScreen();
    });
  }

  public closePauseModal(resumeGame: boolean) {
    document.getElementById('DriveCloudSaveModalOverlay')?.remove();
    document.getElementById('SettingsModalOverlay')?.remove();
    document.getElementById('PauseModalOverlay')?.remove();
    this.isPaused = false;
    if (resumeGame) {
      sound.resumeVoiceClip();
      this.onPauseChanged?.(false);
    } else {
      sound.stopVoiceClips();
    }
  }

  // --- 3D Replay Theater HUD ---
  public renderReplayHUD(durationSec: number) {
    this.isReplayActive = true;
    document.getElementById('PauseModalOverlay')?.remove();
    document.getElementById('ReplayHudOverlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'ReplayHudOverlay';
    overlay.className = 'replay-hud-overlay';
    overlay.innerHTML = `
      <div class="replay-top-bar">
        <div class="replay-title-group">
          <span class="replay-badge">REPLAY INSTANTÂNEO</span>
          <span class="replay-telemetry" id="replayTelemetrySpeed">0 KM/H</span>
          <span class="replay-drift-tag" id="replayDriftTag" style="display:none;">DRIFT</span>
        </div>
        <div class="replay-top-actions">
          <span class="replay-clock" id="replayClockText">00:00 / ${this.formatReplayTime(durationSec)}</span>
          <button class="hud-icon-btn replay-close-btn" id="btnReplayClose" type="button">✕ FECHAR REPLAY</button>
        </div>
      </div>

      <div class="replay-bottom-dock">
        <div class="replay-timeline-row">
          <input type="range" id="replayScrubber" class="replay-scrubber" min="0" max="${Math.max(0.1, durationSec).toFixed(2)}" step="0.03" value="0" />
        </div>

        <div class="replay-controls-row">
          <div class="replay-transport-group">
            <button class="replay-ctrl-btn" id="btnReplayRestart" type="button" title="Início">⏮</button>
            <button class="replay-ctrl-btn" id="btnReplayBack5" type="button">-5s</button>
            <button class="replay-ctrl-btn replay-play-btn" id="btnReplayPlayPause" type="button">⏸</button>
            <button class="replay-ctrl-btn" id="btnReplayFwd5" type="button">+5s</button>
          </div>

          <div class="replay-speed-group">
            <button class="replay-chip-btn" data-speed="0.25" type="button">0.25x</button>
            <button class="replay-chip-btn" data-speed="0.5" type="button">0.5x</button>
            <button class="replay-chip-btn active" data-speed="1" type="button">1x</button>
            <button class="replay-chip-btn" data-speed="2" type="button">2x</button>
          </div>

          <div class="replay-cam-group">
            <button class="replay-chip-btn active" data-cam="tv" type="button">📺 TV</button>
            <button class="replay-chip-btn" data-cam="chase" type="button">🏎️ Chase</button>
            <button class="replay-chip-btn" data-cam="wheel" type="button">🛞 Roda</button>
            <button class="replay-chip-btn" data-cam="orbit" type="button">🔄 Órbita</button>
          </div>
        </div>
      </div>
    `;
    this.root.appendChild(overlay);

    const scrubber = overlay.querySelector('#replayScrubber') as HTMLInputElement;
    this.cachedReplayHud = {
      speedEl: overlay.querySelector('#replayTelemetrySpeed'),
      driftEl: overlay.querySelector('#replayDriftTag'),
      timeEl: overlay.querySelector('#replayClockText'),
      scrubberEl: scrubber,
      playBtn: overlay.querySelector('#btnReplayPlayPause'),
    };

    scrubber?.addEventListener('input', () => {
      this.onReplayAction?.('seek', parseFloat(scrubber.value));
    });

    overlay.querySelector('#btnReplayPlayPause')?.addEventListener('click', () => {
      this.onReplayAction?.('play_pause');
    });
    overlay.querySelector('#btnReplayRestart')?.addEventListener('click', () => {
      this.onReplayAction?.('restart');
    });
    overlay.querySelector('#btnReplayBack5')?.addEventListener('click', () => {
      this.onReplayAction?.('seek', parseFloat(scrubber?.value || '0') - 5);
    });
    overlay.querySelector('#btnReplayFwd5')?.addEventListener('click', () => {
      this.onReplayAction?.('seek', parseFloat(scrubber?.value || '0') + 5);
    });
    overlay.querySelector('#btnReplayClose')?.addEventListener('click', () => {
      this.onReplayAction?.('close');
    });

    overlay.querySelectorAll('[data-speed]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const speed = parseFloat(btn.getAttribute('data-speed') || '1');
        overlay.querySelectorAll('[data-speed]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.onReplayAction?.('speed', speed);
      });
    });

    overlay.querySelectorAll('[data-cam]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cam = btn.getAttribute('data-cam') || 'tv';
        overlay.querySelectorAll('[data-cam]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.onReplayAction?.('camera', cam);
      });
    });
  }

  private formatReplayTime(sec: number): string {
    const s = Math.max(0, Math.floor(sec));
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }

  public updateReplayHUD(
    currentTime: number,
    durationSec: number,
    speedKmh: number,
    isDrifting: boolean,
    isPlaybackPaused: boolean
  ) {
    const hud = this.cachedReplayHud;
    if (!hud) return;

    if (hud.speedEl) hud.speedEl.innerText = `${Math.round(speedKmh)} KM/H`;
    if (hud.driftEl) hud.driftEl.style.display = isDrifting ? 'inline-block' : 'none';
    if (hud.timeEl) {
      hud.timeEl.innerText = `${this.formatReplayTime(currentTime)} / ${this.formatReplayTime(durationSec)}`;
    }
    if (hud.scrubberEl) {
      hud.scrubberEl.max = Math.max(0.1, durationSec).toFixed(2);
      hud.scrubberEl.value = currentTime.toFixed(2);
    }
    if (hud.playBtn) {
      hud.playBtn.innerText = isPlaybackPaused ? '▶' : '⏸';
    }
  }

  public removeReplayHUD() {
    this.isReplayActive = false;
    this.cachedReplayHud = null;
    document.getElementById('ReplayHudOverlay')?.remove();
  }

  public showGameResultModal(
    type: 'escaped' | 'busted' | 'victory',
    title: string,
    message: string,
    rewardCash: number,
    rewardRep: number
  ) {
    const isOnline = networkStatus.isOnline;
    const hasReplay = Boolean(this.hasReplayAvailable?.());
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-card result-modal">
        <h2 class="${type === 'busted' ? 'text-busted' : 'text-victory'}">${title}</h2>
        <p class="modal-desc">${message}</p>
        <div class="result-rewards">
          <div class="reward-box">💰 Recompensa: R$ ${rewardCash.toLocaleString()}</div>
          <div class="reward-box">⭐ Reputação: +${rewardRep} RP</div>
        </div>
        ${
          !isOnline
            ? `<p class="offline-result-note">🔴 Sem Wi-Fi / Dados Móveis: esta recompensa é temporária nesta sessão e só será salva duradouramente quando a internet voltar.</p>`
            : `<p class="online-result-note">🟢 Progresso salvo com segurança.</p>`
        }
        <div class="modal-actions result-actions-row">
          ${hasReplay ? `<button class="secondary-btn" id="btnResultReplay" type="button">🎬 ASSISTIR REPLAY</button>` : ''}
          <button class="primary-btn" id="btnResultContinue" type="button">CONTINUAR</button>
        </div>
      </div>
    `;
    this.root.appendChild(modal);

    this.profile.cash += rewardCash;
    this.profile.repPoints += rewardRep;
    if (this.profile.repPoints >= this.profile.repLevel * 1000) {
      this.profile.repLevel++;
    }
    this.persistDurableProgress();

    modal.querySelector('#btnResultReplay')?.addEventListener('click', () => {
      modal.remove();
      this.onOpenReplay?.('result');
    });

    modal.querySelector('#btnResultContinue')?.addEventListener('click', () => {
      modal.remove();
      this.renderTitleScreen();
    });
  }

  public showOpenWorldBustedModal(
    reason: 'busted' | 'wrecked',
    bailFee: number,
    stats: { escapes: number; stashes: number; stashesTotal: number }
  ) {
    document.getElementById('OpenWorldBustedModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'OpenWorldBustedModal';
    modal.className = 'modal-backdrop pause-backdrop';

    const title = reason === 'busted' ? '🚔 PRESO PELA POLÍCIA!' : '💥 CARRO DESTRUÍDO!';
    const desc =
      reason === 'busted'
        ? 'O cerco policial fechou suas rotas no mundo aberto. Pague a fiança na delegacia e retome as ruas com ficha limpa!'
        : 'Seu veículo sofreu perda total! O reboque clandestino levou o carro até o pátio seguro para reparo imediato.';

    modal.innerHTML = `
      <div class="modal-card result-modal">
        <h2 class="text-busted">${title}</h2>
        <p class="modal-desc">${desc}</p>
        <div class="result-rewards">
          <div class="reward-box">⚖️ Fiança / Reboque: R$ ${bailFee.toLocaleString()}</div>
          <div class="reward-box">📦 Pacotes: ${stats.stashes}/${stats.stashesTotal} · ⭐ Fugas: ${stats.escapes}</div>
        </div>
        <div class="modal-actions result-actions-row">
          <button class="secondary-btn" id="btnOwBailMenu" type="button">🚪 VOLTAR AO MENU</button>
          <button class="primary-btn" id="btnOwBailContinue" type="button">🚗 PAGAR & CONTINUAR NO MUNDO ABERTO</button>
        </div>
      </div>
    `;
    this.root.appendChild(modal);

    modal.querySelector('#btnOwBailContinue')?.addEventListener('click', () => {
      modal.remove();
      this.onOpenWorldBailRespawn?.();
    });

    modal.querySelector('#btnOwBailMenu')?.addEventListener('click', () => {
      modal.remove();
      this.renderTitleScreen();
    });
  }

  public unlockStoryEnding(endingId: StoryEndingId) {
    const existing = this.profile.unlockedEndings || [];
    if (!existing.includes(endingId)) {
      this.profile.unlockedEndings = [...existing, endingId];
    }
    this.profile.lastStoryEnding = endingId;
    this.persistDurableProgress();
  }

  public showStoryEndingChoiceModal(): Promise<StoryEndingId> {
    return new Promise((resolve) => {
      document.getElementById('StoryEndingChoiceModal')?.remove();
      const order: StoryEndingId[] = ['true', 'good', 'false', 'bad'];
      const modal = document.createElement('div');
      modal.id = 'StoryEndingChoiceModal';
      modal.className = 'modal-backdrop pause-backdrop';
      modal.innerHTML = `
        <div class="modal-card large-modal story-choice-modal">
          <div class="modal-header">
            <h2>⚖️ CLÍMAX EM THE SAN BERNARD: ESCOLHA O DESTINO</h2>
          </div>
          <p class="modal-desc">O cerco do governo ruiu. A última decisão entre <strong>Miguel</strong>, <strong>Luca</strong>, <strong>Alan</strong>, <strong>André</strong> e <strong>Ana</strong> selará um dos 4 finais da história:</p>
          <div class="story-choice-grid">
            ${order
              .map((id) => {
                const info = STORY_ENDINGS[id];
                return `
                <button type="button" class="story-choice-card ${info.toneClass}" data-choice-ending="${id}">
                  <span class="scc-badge">${info.badge}</span>
                  <strong>${info.choiceLabel}</strong>
                  <p>${info.choiceDescription}</p>
                </button>
              `;
              })
              .join('')}
          </div>
        </div>
      `;
      this.root.appendChild(modal);

      modal.querySelectorAll('[data-choice-ending]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = (btn.getAttribute('data-choice-ending') as StoryEndingId) || 'true';
          modal.remove();
          resolve(id);
        });
      });
    });
  }

  public showStoryEndingResultModal(endingId: StoryEndingId, viewOnly: boolean = false) {
    const info = STORY_ENDINGS[endingId];
    if (!info) return;

    if (!viewOnly) {
      this.unlockStoryEnding(endingId);
      this.profile.cash += info.rewardCash;
      this.profile.repPoints += info.rewardRep;
      if (this.profile.repPoints >= this.profile.repLevel * 1000) {
        this.profile.repLevel++;
      }
      this.persistDurableProgress();
    }

    const totalUnlocked = (this.profile.unlockedEndings || []).length;
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-card result-modal story-ending-result-card ${info.toneClass}">
        <div class="ending-result-badge">${info.badge}</div>
        <h2>${info.title}</h2>
        <p class="ending-result-sub">${info.subtitle}</p>
        <p class="modal-desc ending-result-summary">${info.summary}</p>
        <div class="result-rewards">
          <div class="reward-box">🎭 Finais Descobertos: ${totalUnlocked}/4</div>
          ${
            viewOnly
              ? `<div class="reward-box">📖 Arquivo da História</div>`
              : `<div class="reward-box">💰 R$ ${info.rewardCash.toLocaleString()} · ⭐ +${info.rewardRep} RP</div>`
          }
        </div>
        <div class="modal-actions result-actions-row">
          <button class="primary-btn" id="btnEndingResultClose" type="button">${viewOnly ? 'FECHAR' : 'VOLTAR AO MENU'}</button>
        </div>
      </div>
    `;
    this.root.appendChild(modal);

    modal.querySelector('#btnEndingResultClose')?.addEventListener('click', () => {
      modal.remove();
      if (!viewOnly) {
        this.renderTitleScreen();
      }
    });
  }
}
