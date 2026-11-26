export type GameMode =
  | 'title'
  | 'story'
  | 'career'
  | 'career_open_world'
  | 'challenge'
  | 'free_roam'
  | 'tutorial'
  | 'multiplayer';

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';
export type WeatherType = 'sunny' | 'rain' | 'storm' | 'fog';
export type TimeOfDay = 'day' | 'sunset' | 'night' | 'midnight';
export type OrientationMode = 'auto' | 'horizontal' | 'vertical';

export type OpenWorldTransportMode =
  | 'car'
  | 'moto_street'
  | 'moto_super'
  | 'moto_cross'
  | 'bicycle'
  | 'skateboard'
  | 'foot';

export interface VehicleConfig {
  id: string;
  name: string;
  category: 'muscle' | 'jdm' | 'super' | 'hyper' | 'police' | 'swat';
  price: number;
  topSpeed: number; // km/h max
  acceleration: number; // 0-100 factor
  handling: number; // cornering grip factor
  braking: number;
  healthMax: number;
  unlocked: boolean;
  color: string;
  neonColor: string;
  neonEnabled: boolean;
  spoilerStyle: number; // 0: none, 1: sport, 2: GT wing, 3: carbon drag
  wheelsStyle: number; // 0: stock, 1: racing, 2: chrome, 3: neon rims
  levelEngine: number; // 1 to 5
  levelHandling: number;
  levelNitro: number;
  levelArmor: number;
}

export interface TrackConfig {
  id: string;
  name: string;
  location: string;
  difficulty: 'Fácil' | 'Médio' | 'Difícil' | 'Extremo';
  price: number;
  unlocked: boolean;
  lapLengthMeters: number;
  ambientColor: number;
  fogColor: number;
  fogDensity: number;
  description: string;
}

export type GameDifficulty =
  | 'very_easy'
  | 'easy'
  | 'amateur'
  | 'normal'
  | 'hard'
  | 'legendary'
  | 'professional';

export interface CharacterProfile {
  name: string;
  nickname: string;
  copilotName: string;
  avatarId: number;
  team: string;
  cash: number;
  repLevel: number;
  repPoints: number;
  selectedCarId: string;
  selectedTrackId: string;
  careerWins: number;
  totalEscapes: number;
  copsDestroyed: number;
  storyChapter: number;
  unlockedChallenges: number;
  controlsMode: 'touch' | 'gyro' | 'keyboard';
  gyroSensitivity: number;
  difficulty: GameDifficulty;
  openWorldEscapes?: number;
  openWorldStashes?: number;
  openWorldMaxHeatEscaped?: number;
}

export type FilmCameraShot =
  | 'front_two_shot'
  | 'pilot_closeup'
  | 'copilot_closeup'
  | 'side_window'
  | 'car_exterior_hero'
  | 'cop_radio_insert';

export interface StoryChapter {
  id: number;
  title: string;
  subtitle: string;
  briefing: string;
  trackId: string;
  initialHeat: number;
  objectiveText: string;
  targetEscapes?: number;
  timeLimitSec?: number;
  dialogueIntro: DialogueLine[];
  dialogueMidList?: { triggerSec: number; triggered?: boolean; lines: DialogueLine[] }[];
  dialogueOutro: DialogueLine[];
  rewardCash: number;
  rewardRep: number;
}

export interface DialogueLine {
  speaker: string;
  role?: 'pilot' | 'copilot' | 'cop' | 'dispatch' | 'rival';
  portrait: 'luca' | 'miguel' | 'pilot' | 'copilot' | 'cop' | 'dispatch' | 'rival';
  text: string;
  radioEffect?: boolean;
  cameraShot?: FilmCameraShot;
}

export interface ChallengeItem {
  id: number;
  title: string;
  description: string;
  reward: number;
  rewardRep: number;
  targetType: 'survive_time' | 'destroy_cops' | 'drift_score' | 'top_speed';
  targetValue: number;
  completed: boolean;
}

export interface MultiplayerPlayer {
  id: string;
  name: string;
  carId?: string;
  carName: string;
  carColor: string;
  isHost: boolean;
  isReady: boolean;
  currentSpeed: number;
  lap: number;
  progress: number;
  lapTime: number;
  isLocal: boolean;
  x?: number;
  y?: number;
  z?: number;
  heading?: number;
  driftScore?: number;
}

export interface OnlineRoomSummary {
  code: string;
  trackId: string;
  hostName: string;
  status: 'lobby' | 'racing' | 'finished';
  playerCount: number;
  maxPlayers: number;
  createdAt: number;
}

export interface MultiplayerRoom {
  code: string; // 4 digits e.g. "4829"
  trackId: string;
  hostName: string;
  status: 'lobby' | 'racing' | 'finished';
  players: MultiplayerPlayer[];
  createdAt: number;
}

export interface LeaderboardEntry {
  rank: number;
  pilotName: string;
  car: string;
  scoreOrTime: string;
  track: string;
  mode: string;
  date: string;
}

export interface PlayerControls {
  throttle: number; // 0 to 1
  brake: number; // 0 to 1
  steer: number; // -1 to 1
  handbrake: boolean;
  nitro: boolean;
  resetVehicle: boolean;
  switchCamera: boolean;
}

export type AchievementCategory = 'distance' | 'drift' | 'pursuit' | 'stunt' | 'garage';
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface AchievementStats {
  totalDistanceKm: number;
  perfectDriftsCount: number;
  maxSingleDriftPoints: number;
  totalDriftPoints: number;
  copsDestroyed: number;
  totalEscapes: number;
  maxSpeedKmh: number;
  stuntJumpsCount: number;
  carsUnlocked: number;
  upgradesInstalled: number;
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  tier: AchievementTier;
  statKey: keyof AchievementStats;
  targetValue: number;
  unit: string;
  rewardCash: number;
  rewardRep: number;
  unlocked: boolean;
  unlockedAt?: number;
}

export type NPCBehaviorMode = 'sidewalk_walk' | 'sidewalk_idle' | 'street_cross' | 'panic' | 'knocked';

export type ReplayCameraAngle = 'tv' | 'chase' | 'wheel' | 'orbit';

export interface ReplayCopSnapshot {
  id: number;
  variant: 'cruiser' | 'interceptor' | 'swat';
  x: number;
  y: number;
  z: number;
  heading: number;
  destroyed: boolean;
}

export interface ReplayFrame {
  time: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
  steerAngle: number;
  driftSlip: number;
  speedKmh: number;
  wheelRoll: number;
  missingMask: number;
  isDrifting: boolean;
  nitroActive: boolean;
  cops: ReplayCopSnapshot[];
}

