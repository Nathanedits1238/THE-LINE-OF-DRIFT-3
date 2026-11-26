import { AchievementDefinition, AchievementStats } from '../types';
import { networkStatus } from '../services/networkStatus';

const STORAGE_KEY = 'tlod_achievements_v1';

export interface SerializedAchievements {
  stats: AchievementStats;
  unlockedIds: Record<string, number>;
}

const DEFAULT_STATS: AchievementStats = {
  totalDistanceKm: 0,
  perfectDriftsCount: 0,
  maxSingleDriftPoints: 0,
  totalDriftPoints: 0,
  copsDestroyed: 0,
  totalEscapes: 0,
  maxSpeedKmh: 0,
  stuntJumpsCount: 0,
  carsUnlocked: 1,
  upgradesInstalled: 0,
};

function createDefaultAchievements(): AchievementDefinition[] {
  return [
    {
      id: 'dist_5km',
      title: 'Primeiro Rolê',
      description: 'Dirija 5 km acumulados pelas ruas e avenidas da cidade.',
      icon: '🛣️',
      category: 'distance',
      tier: 'bronze',
      statKey: 'totalDistanceKm',
      targetValue: 5,
      unit: 'km',
      rewardCash: 2500,
      rewardRep: 80,
      unlocked: false,
    },
    {
      id: 'dist_25km',
      title: 'Viajante Noturno',
      description: 'Percorra 25 km no total em fugas e passeios pela pista.',
      icon: '🌃',
      category: 'distance',
      tier: 'silver',
      statKey: 'totalDistanceKm',
      targetValue: 25,
      unit: 'km',
      rewardCash: 8000,
      rewardRep: 220,
      unlocked: false,
    },
    {
      id: 'dist_100km',
      title: 'Rei do Asfalto (100 km)',
      description: 'Atinja a marca lendária de 100 km rodados no hodômetro.',
      icon: '👑',
      category: 'distance',
      tier: 'platinum',
      statKey: 'totalDistanceKm',
      targetValue: 100,
      unit: 'km',
      rewardCash: 35000,
      rewardRep: 800,
      unlocked: false,
    },
    {
      id: 'drift_10',
      title: 'Deslize Controlado',
      description: 'Complete 10 drifts perfeitos sem colidir durante a manobra.',
      icon: '💨',
      category: 'drift',
      tier: 'bronze',
      statKey: 'perfectDriftsCount',
      targetValue: 10,
      unit: 'drifts',
      rewardCash: 4000,
      rewardRep: 120,
      unlocked: false,
    },
    {
      id: 'drift_50',
      title: 'Mestre do Drift (50 Perfeitos)',
      description: 'Execute 50 drifts perfeitos e limpos nas curvas da cidade.',
      icon: '🔥',
      category: 'drift',
      tier: 'platinum',
      statKey: 'perfectDriftsCount',
      targetValue: 50,
      unit: 'drifts',
      rewardCash: 30000,
      rewardRep: 700,
      unlocked: false,
    },
    {
      id: 'drift_combo_1500',
      title: 'Fumaça Pura',
      description: 'Alcance 1.500 pontos em uma única sequência de drift sem bater.',
      icon: '🌀',
      category: 'drift',
      tier: 'gold',
      statKey: 'maxSingleDriftPoints',
      targetValue: 1500,
      unit: 'pts',
      rewardCash: 12000,
      rewardRep: 320,
      unlocked: false,
    },
    {
      id: 'cops_3',
      title: 'Intocável',
      description: 'Destrua 3 viaturas policiais durante perseguições.',
      icon: '🚔',
      category: 'pursuit',
      tier: 'bronze',
      statKey: 'copsDestroyed',
      targetValue: 3,
      unit: 'viaturas',
      rewardCash: 5000,
      rewardRep: 150,
      unlocked: false,
    },
    {
      id: 'cops_15',
      title: 'Destruidor da Frota',
      description: 'Tire de circulação 15 viaturas ou blindados da polícia.',
      icon: '💥',
      category: 'pursuit',
      tier: 'gold',
      statKey: 'copsDestroyed',
      targetValue: 15,
      unit: 'viaturas',
      rewardCash: 22000,
      rewardRep: 500,
      unlocked: false,
    },
    {
      id: 'escape_1',
      title: 'Fuga Limpa',
      description: 'Despiste a polícia com sucesso pela primeira vez.',
      icon: '🕶️',
      category: 'pursuit',
      tier: 'bronze',
      statKey: 'totalEscapes',
      targetValue: 1,
      unit: 'fugas',
      rewardCash: 3500,
      rewardRep: 100,
      unlocked: false,
    },
    {
      id: 'escape_10',
      title: 'Fantasma das Ruas',
      description: 'Escape de 10 perseguições policiais em qualquer dificuldade.',
      icon: '👻',
      category: 'pursuit',
      tier: 'gold',
      statKey: 'totalEscapes',
      targetValue: 10,
      unit: 'fugas',
      rewardCash: 25000,
      rewardRep: 550,
      unlocked: false,
    },
    {
      id: 'speed_220',
      title: 'Rompendo a Barreira',
      description: 'Atinja 220 km/h em pista aberta ou com nitro acionado.',
      icon: '⚡',
      category: 'stunt',
      tier: 'silver',
      statKey: 'maxSpeedKmh',
      targetValue: 220,
      unit: 'km/h',
      rewardCash: 6000,
      rewardRep: 180,
      unlocked: false,
    },
    {
      id: 'speed_290',
      title: 'Velocidade Hipersônica',
      description: 'Chegue a impressionantes 290 km/h sem capotar.',
      icon: '🚀',
      category: 'stunt',
      tier: 'gold',
      statKey: 'maxSpeedKmh',
      targetValue: 290,
      unit: 'km/h',
      rewardCash: 18000,
      rewardRep: 420,
      unlocked: false,
    },
    {
      id: 'jumps_5',
      title: 'Dublê de Ação',
      description: 'Decole em 5 saltos esportivos pelas rampas da metrópole.',
      icon: '🛫',
      category: 'stunt',
      tier: 'silver',
      statKey: 'stuntJumpsCount',
      targetValue: 5,
      unit: 'saltos',
      rewardCash: 7500,
      rewardRep: 200,
      unlocked: false,
    },
    {
      id: 'garage_2cars',
      title: 'Colecionador',
      description: 'Tenha pelo menos 2 carros desbloqueados na sua garagem.',
      icon: '🏎️',
      category: 'garage',
      tier: 'bronze',
      statKey: 'carsUnlocked',
      targetValue: 2,
      unit: 'carros',
      rewardCash: 5000,
      rewardRep: 140,
      unlocked: false,
    },
    {
      id: 'garage_5upgrades',
      title: 'Engenheiro de Rua',
      description: 'Instale 5 upgrades mecânicos de motor, suspensão ou blindagem.',
      icon: '🔧',
      category: 'garage',
      tier: 'silver',
      statKey: 'upgradesInstalled',
      targetValue: 5,
      unit: 'upgrades',
      rewardCash: 9000,
      rewardRep: 250,
      unlocked: false,
    },
  ];
}

export class AchievementSystem {
  public stats: AchievementStats = { ...DEFAULT_STATS };
  public achievements: AchievementDefinition[] = createDefaultAchievements();
  public onAchievementUnlocked?: (achievement: AchievementDefinition) => void;

  private lastPersistTime: number = 0;
  private persistenceEnabled: boolean = networkStatus.isOnline;
  public hasPendingDurableSave: boolean = false;

  constructor() {
    this.loadFromLocal();
  }

  public setPersistenceEnabled(enabled: boolean) {
    this.persistenceEnabled = enabled;
    if (enabled && this.hasPendingDurableSave) {
      this.flushDurableSave();
    }
  }

  public flushDurableSave() {
    if (!this.persistenceEnabled) return;
    this.hasPendingDurableSave = false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.exportData()));
    } catch {
      // Ignore storage quota errors in restricted iframe/private modes
    }
  }

  public syncProfileCounts(copsDestroyed: number, totalEscapes: number, carsUnlocked: number, upgradesInstalled: number) {
    this.stats.copsDestroyed = Math.max(this.stats.copsDestroyed, copsDestroyed);
    this.stats.totalEscapes = Math.max(this.stats.totalEscapes, totalEscapes);
    this.stats.carsUnlocked = Math.max(this.stats.carsUnlocked, carsUnlocked);
    this.stats.upgradesInstalled = Math.max(this.stats.upgradesInstalled, upgradesInstalled);
    this.evaluate();
  }

  public recordDistance(meters: number) {
    if (meters <= 0 || !Number.isFinite(meters)) return;
    this.stats.totalDistanceKm += meters / 1000;
    this.evaluate();

    const now = performance.now();
    if (now - this.lastPersistTime > 4500) {
      this.saveToLocal();
      this.lastPersistTime = now;
    }
  }

  public recordSpeed(speedKmh: number) {
    if (speedKmh > this.stats.maxSpeedKmh) {
      this.stats.maxSpeedKmh = Math.round(speedKmh);
      this.evaluate();
    }
  }

  public recordPerfectDrift(points: number) {
    this.stats.perfectDriftsCount++;
    this.stats.totalDriftPoints += Math.round(points);
    if (points > this.stats.maxSingleDriftPoints) {
      this.stats.maxSingleDriftPoints = Math.round(points);
    }
    this.evaluate();
    this.saveToLocal();
  }

  public recordCopDestroyed() {
    this.stats.copsDestroyed++;
    this.evaluate();
    this.saveToLocal();
  }

  public recordEscape() {
    this.stats.totalEscapes++;
    this.evaluate();
    this.saveToLocal();
  }

  public recordStuntJump() {
    this.stats.stuntJumpsCount++;
    this.evaluate();
    this.saveToLocal();
  }

  public recordCarUnlocked(totalUnlocked: number) {
    this.stats.carsUnlocked = Math.max(this.stats.carsUnlocked, totalUnlocked);
    this.evaluate();
    this.saveToLocal();
  }

  public recordUpgradeInstalled() {
    this.stats.upgradesInstalled++;
    this.evaluate();
    this.saveToLocal();
  }

  public evaluate(): AchievementDefinition[] {
    const newlyUnlocked: AchievementDefinition[] = [];
    for (let i = 0; i < this.achievements.length; i++) {
      const ach = this.achievements[i];
      if (ach.unlocked) continue;
      const currentVal = this.stats[ach.statKey];
      if (currentVal >= ach.targetValue) {
        ach.unlocked = true;
        ach.unlockedAt = Date.now();
        newlyUnlocked.push(ach);
      }
    }

    if (newlyUnlocked.length > 0) {
      this.saveToLocal();
      for (const ach of newlyUnlocked) {
        this.onAchievementUnlocked?.(ach);
      }
    }
    return newlyUnlocked;
  }

  public getProgressRatio(ach: AchievementDefinition): number {
    if (ach.unlocked) return 1;
    const val = this.stats[ach.statKey] || 0;
    return Math.min(1, Math.max(0, val / ach.targetValue));
  }

  public getCurrentStatValue(ach: AchievementDefinition): number {
    const val = this.stats[ach.statKey] || 0;
    return ach.statKey === 'totalDistanceKm' ? Number(val.toFixed(1)) : Math.floor(val);
  }

  public getUnlockedCount(): number {
    let count = 0;
    for (const a of this.achievements) {
      if (a.unlocked) count++;
    }
    return count;
  }

  public exportData(): SerializedAchievements {
    const unlockedIds: Record<string, number> = {};
    for (const a of this.achievements) {
      if (a.unlocked) {
        unlockedIds[a.id] = a.unlockedAt || Date.now();
      }
    }
    return {
      stats: { ...this.stats },
      unlockedIds,
    };
  }

  public importData(data?: SerializedAchievements | null) {
    if (!data) return;
    if (data.stats) {
      this.stats = { ...DEFAULT_STATS, ...data.stats };
    }
    if (data.unlockedIds) {
      for (const a of this.achievements) {
        if (data.unlockedIds[a.id]) {
          a.unlocked = true;
          a.unlockedAt = data.unlockedIds[a.id];
        }
      }
    }
    this.saveToLocal();
  }

  public saveToLocal() {
    if (!this.persistenceEnabled || !networkStatus.isOnline) {
      this.hasPendingDurableSave = true;
      return;
    }
    this.hasPendingDurableSave = false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.exportData()));
    } catch {
      // Ignore storage quota errors in restricted iframe/private modes
    }
  }

  private loadFromLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SerializedAchievements;
      if (parsed && typeof parsed === 'object') {
        if (parsed.stats) {
          this.stats = { ...DEFAULT_STATS, ...parsed.stats };
        }
        if (parsed.unlockedIds) {
          for (const a of this.achievements) {
            if (parsed.unlockedIds[a.id]) {
              a.unlocked = true;
              a.unlockedAt = parsed.unlockedIds[a.id];
            }
          }
        }
      }
    } catch {
      // Ignore corrupted local data
    }
  }
}
