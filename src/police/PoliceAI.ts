import * as THREE from 'three';
import { sound } from '../audio/SoundEffects';
import { TrackWaypoint } from '../city/CityGenerator';
import { GameDifficulty, VehicleConfig } from '../types';
import { VehicleMeshBuilder } from '../vehicles/VehicleMesh';

export interface CopUnit {
  id: number;
  variant: 'cruiser' | 'interceptor' | 'swat';
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  heading: number;
  speedKmh: number;
  health: number;
  maxHealth: number;
  destroyed: boolean;
  updateLights?: (time: number) => void;
  targetOffset: THREE.Vector2; // Tactical offset (flanking left, right, or ramming behind)
  applyDamageDeformation?: (damageRatio: number) => void;
  applyImpactDeformation?: (localHitDir: THREE.Vector3, impactSpeedMs: number) => void;
  isRoadblock?: boolean;
}

export interface RoadblockUnit {
  group: THREE.Group;
  position: THREE.Vector3;
  heading: number;
  copLeft: CopUnit;
  copRight: CopUnit;
  spikeStripMesh?: THREE.Mesh;
  destroyed: boolean;
  radius: number;
}

// Module-level reusable math helpers to eliminate GC
const _toPlayer = new THREE.Vector3();
const _desiredPos = new THREE.Vector3();
const _dirToTarget = new THREE.Vector3();
const _tacticalOffset = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);

export class PolicePursuitSystem {
  public scene: THREE.Scene;
  public cops: CopUnit[] = [];
  public roadblocks: RoadblockUnit[] = [];
  public heatLevel: number = 0; // 0 to 5
  public pursuitActive: boolean = false;
  public evasionTimer: number = 0; // seconds spent evading
  public evasionThresholdSec: number = 7.0; // seconds to fully escape
  public isEvading: boolean = false;
  public bustedTimer: number = 0; // seconds pinned by cops
  public copsDestroyedCount: number = 0;
  public difficulty: GameDifficulty = 'very_easy';

  // Roadblock timer
  private roadblockTimer: number = 0;

  // Helicopter (Heat 5)
  private helicopterMesh: THREE.Group | null = null;
  private heliRotorMesh: THREE.Mesh | null = null;
  private heliSpotlight: THREE.SpotLight | null = null;

  // Standard police vehicle configs
  private cruiserConfig: VehicleConfig = {
    id: 'police_cruiser',
    name: 'Viatura Interceptora',
    category: 'police',
    price: 0,
    topSpeed: 235,
    acceleration: 85,
    handling: 78,
    braking: 85,
    healthMax: 90,
    unlocked: true,
    color: '#08080a',
    neonColor: '#000000',
    neonEnabled: false,
    spoilerStyle: 0,
    wheelsStyle: 0,
    levelEngine: 1,
    levelHandling: 1,
    levelNitro: 1,
    levelArmor: 1,
  };

  private swatConfig: VehicleConfig = {
    id: 'police_swat',
    name: 'Blindado SWAT',
    category: 'swat',
    price: 0,
    topSpeed: 200,
    acceleration: 75,
    handling: 65,
    braking: 80,
    healthMax: 220,
    unlocked: true,
    color: '#151922',
    neonColor: '#000000',
    neonEnabled: false,
    spoilerStyle: 0,
    wheelsStyle: 0,
    levelEngine: 1,
    levelHandling: 1,
    levelNitro: 1,
    levelArmor: 2,
  };

  public setDifficulty(diff: GameDifficulty) {
    this.difficulty = diff;
    const escapeTimes: Record<GameDifficulty, number> = {
      very_easy: 2.0,
      easy: 4.5,
      amateur: 6.5,
      normal: 8.5,
      hard: 12.5,
      legendary: 16.5,
      professional: 21.0,
    };
    this.evasionThresholdSec = escapeTimes[diff] || 8.5;
  }

  public getDifficultyMultiplier(): {
    speedMult: number;
    ramAggression: number;
    squadCount: number;
    evasionDist: number;
    bustedSpeed: number;
    roadblockIntervalSec: number;
    catchupMult: number;
  } {
    switch (this.difficulty) {
      case 'very_easy':
        return {
          speedMult: 0.38,
          ramAggression: 0.18,
          squadCount: 0,
          evasionDist: 36,
          bustedSpeed: 0.22,
          roadblockIntervalSec: 9999,
          catchupMult: 1.02,
        };
      case 'easy':
        return {
          speedMult: 0.64,
          ramAggression: 0.45,
          squadCount: 0,
          evasionDist: 56,
          bustedSpeed: 0.55,
          roadblockIntervalSec: 75,
          catchupMult: 1.12,
        };
      case 'amateur':
        return {
          speedMult: 0.80,
          ramAggression: 0.72,
          squadCount: 0,
          evasionDist: 76,
          bustedSpeed: 0.80,
          roadblockIntervalSec: 45,
          catchupMult: 1.22,
        };
      case 'normal':
        return {
          speedMult: 0.96,
          ramAggression: 0.98,
          squadCount: 1,
          evasionDist: 94,
          bustedSpeed: 1.0,
          roadblockIntervalSec: 30,
          catchupMult: 1.28,
        };
      case 'hard':
        return {
          speedMult: 1.18,
          ramAggression: 1.45,
          squadCount: 2,
          evasionDist: 132,
          bustedSpeed: 1.32,
          roadblockIntervalSec: 20,
          catchupMult: 1.35,
        };
      case 'legendary':
        return {
          speedMult: 1.35,
          ramAggression: 1.9,
          squadCount: 3,
          evasionDist: 165,
          bustedSpeed: 1.55,
          roadblockIntervalSec: 14,
          catchupMult: 1.40,
        };
      case 'professional':
        return {
          speedMult: 1.50,
          ramAggression: 2.35,
          squadCount: 3,
          evasionDist: 200,
          bustedSpeed: 1.85,
          roadblockIntervalSec: 10,
          catchupMult: 1.45,
        };
      default:
        return {
          speedMult: 0.96,
          ramAggression: 0.98,
          squadCount: 1,
          evasionDist: 94,
          bustedSpeed: 1.0,
          roadblockIntervalSec: 30,
          catchupMult: 1.28,
        };
    }
  }

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.setupHelicopter();
  }

  private setupHelicopter() {
    this.helicopterMesh = new THREE.Group();

    // Fuselage
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0a1018, metalness: 0.8, roughness: 0.3 });
    const bodyGeo = new THREE.BoxGeometry(2.4, 2.2, 5.5);
    const body = new THREE.Mesh(bodyGeo, bodyMat);

    // Tail boom
    const tailGeo = new THREE.BoxGeometry(0.5, 0.6, 5.0);
    const tail = new THREE.Mesh(tailGeo, bodyMat);
    tail.position.set(0, 0.4, -4.8);

    // Main rotor
    const rotorGeo = new THREE.BoxGeometry(0.25, 0.08, 9.0);
    const rotorMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9 });
    this.heliRotorMesh = new THREE.Mesh(rotorGeo, rotorMat);
    this.heliRotorMesh.position.set(0, 1.4, 0);

    // Searchlight
    this.heliSpotlight = new THREE.SpotLight(0xffffff, 4.0, 180, Math.PI / 6, 0.4);
    this.heliSpotlight.position.set(0, -1.0, 1.5);
    this.heliSpotlight.castShadow = true;

    this.helicopterMesh.add(body, tail, this.heliRotorMesh, this.heliSpotlight);
    this.helicopterMesh.visible = false;
    this.scene.add(this.helicopterMesh);
  }

  public setHeat(level: number, playerPos: THREE.Vector3, waypoints: TrackWaypoint[]) {
    this.heatLevel = Math.max(0, Math.min(5, level));
    this.pursuitActive = this.heatLevel > 0;
    this.evasionTimer = 0;
    this.isEvading = false;
    this.bustedTimer = 0;
    this.roadblockTimer = 0;

    if (this.heatLevel > 0) {
      sound.playPoliceRadioChirp();
    }

    // Helicopter visibility at Heat >= 4 (or Heat >= 3 in professional/legendary)
    if (this.helicopterMesh) {
      const minHeatForHeli = ['professional', 'legendary'].includes(this.difficulty) ? 3 : 4;
      this.helicopterMesh.visible = this.heatLevel >= minHeatForHeli;
    }

    this.synchronizeSquad(playerPos, waypoints);
  }

  public clearAll() {
    for (const cop of this.cops) {
      this.scene.remove(cop.mesh);
    }
    this.cops = [];
    this.clearRoadblocks();
    this.heatLevel = 0;
    this.pursuitActive = false;
    this.isEvading = false;
    this.evasionTimer = 0;
    this.bustedTimer = 0;
    if (this.helicopterMesh) this.helicopterMesh.visible = false;
  }

  public clearRoadblocks() {
    for (const rb of this.roadblocks) {
      this.scene.remove(rb.group);
    }
    this.roadblocks = [];
  }

  private synchronizeSquad(playerPos: THREE.Vector3, waypoints: TrackWaypoint[]) {
    const diff = this.getDifficultyMultiplier();
    // Base cops based on Heat level + Difficulty squad addition
    let baseCops =
      this.heatLevel === 1 ? 2 : this.heatLevel === 2 ? 3 : this.heatLevel === 3 ? 4 : this.heatLevel === 4 ? 6 : 7;
    if (this.difficulty === 'very_easy') {
      baseCops = this.heatLevel >= 5 ? 2 : 1;
    } else if (this.difficulty === 'easy') {
      baseCops = Math.min(3, baseCops);
    } else if (this.difficulty === 'amateur') {
      baseCops = Math.min(4, baseCops);
    } else if (this.difficulty === 'normal') {
      baseCops = Math.min(5, baseCops);
    }
    const desiredCops = Math.min(9, baseCops + diff.squadCount);

    // Filter out destroyed cops (keep roadblocks separate)
    this.cops = this.cops.filter((c) => {
      if (c.destroyed && !c.isRoadblock) {
        this.scene.remove(c.mesh);
        return false;
      }
      return true;
    });

    while (this.cops.length < desiredCops) {
      this.spawnCop(playerPos, waypoints);
    }
  }

  private spawnCop(playerPos: THREE.Vector3, waypoints: TrackWaypoint[]) {
    const allowSwat = this.difficulty !== 'very_easy' && this.difficulty !== 'easy';
    const isSwat = allowSwat && ((this.heatLevel >= 3 && Math.random() > 0.4) || this.heatLevel >= 5);
    const variant: 'cruiser' | 'interceptor' | 'swat' = isSwat
      ? 'swat'
      : this.heatLevel >= 2 && this.difficulty !== 'very_easy'
        ? 'interceptor'
        : 'cruiser';

    const cfg = isSwat ? this.swatConfig : this.cruiserConfig;
    const meshData = VehicleMeshBuilder.createVehicleGroup(cfg, true, variant);

    // Spawn 45 to 80 meters behind or ahead of player on road
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnDist = 45 + Math.random() * 30;
    const spawnPos = new THREE.Vector3(
      playerPos.x + Math.sin(spawnAngle) * spawnDist,
      0,
      playerPos.z + Math.cos(spawnAngle) * spawnDist
    );

    // Tactical offsets
    const offsets = [
      new THREE.Vector2(0, -4.5), // Aggressive ram behind
      new THREE.Vector2(-4.2, 0.5), // Flank left
      new THREE.Vector2(4.2, 0.5), // Flank right
      new THREE.Vector2(0, 4.5), // Front cut-off / roadblocker
      new THREE.Vector2(-3.5, -6.5), // Rear left enforcer
      new THREE.Vector2(3.5, -6.5), // Rear right enforcer
    ];
    const offset = offsets[this.cops.length % offsets.length];

    meshData.group.position.copy(spawnPos);
    this.scene.add(meshData.group);

    const cop: CopUnit = {
      id: Date.now() + Math.random(),
      variant,
      mesh: meshData.group,
      position: spawnPos,
      velocity: new THREE.Vector3(),
      heading: 0,
      speedKmh: 0,
      health: cfg.healthMax,
      maxHealth: cfg.healthMax,
      destroyed: false,
      updateLights: meshData.updatePoliceLights,
      targetOffset: offset,
      applyDamageDeformation: meshData.applyDamageDeformation,
      applyImpactDeformation: meshData.applyImpactDeformation,
    };

    this.cops.push(cop);
  }

  /**
   * Spawns a physical roadblock barricade with 2 police cruisers parked angled across the road ahead of player
   */
  public spawnRoadblockAhead(playerPos: THREE.Vector3, playerVelocity: THREE.Vector3, waypoints: TrackWaypoint[]) {
    if (waypoints.length === 0 || this.roadblocks.length >= 2) return;

    // Find a waypoint approx 130-180m ahead along track
    const forwardX = playerVelocity.x || 1;
    const forwardZ = playerVelocity.z || 0;
    const len = Math.hypot(forwardX, forwardZ) || 1;
    const lookAheadPos = new THREE.Vector3(
      playerPos.x + (forwardX / len) * 140,
      0,
      playerPos.z + (forwardZ / len) * 140
    );

    let bestWp = waypoints[0];
    let minD = 9999;
    for (let i = 0; i < waypoints.length; i++) {
      const d = waypoints[i].position.distanceTo(lookAheadPos);
      if (d < minD) {
        minD = d;
        bestWp = waypoints[i];
      }
    }

    if (minD > 50) return; // Too far from track

    const rbGroup = new THREE.Group();
    rbGroup.position.copy(bestWp.position);
    rbGroup.rotation.y = bestWp.heading;

    // Left cruiser angled at -35 deg
    const meshDataL = VehicleMeshBuilder.createVehicleGroup(this.cruiserConfig, true, 'cruiser');
    meshDataL.group.position.set(-4.5, 0, 0);
    meshDataL.group.rotation.y = THREE.MathUtils.degToRad(-35);

    // Right cruiser angled at +35 deg
    const isRightSwat = this.heatLevel >= 4;
    const meshDataR = VehicleMeshBuilder.createVehicleGroup(isRightSwat ? this.swatConfig : this.cruiserConfig, true, isRightSwat ? 'swat' : 'cruiser');
    meshDataR.group.position.set(4.5, 0, 0);
    meshDataR.group.rotation.y = THREE.MathUtils.degToRad(35);

    // Spike strip in the center gap
    const spikeGeo = new THREE.BoxGeometry(4.0, 0.15, 0.6);
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0xff3300, metalness: 0.8, roughness: 0.3 });
    const spikeStrip = new THREE.Mesh(spikeGeo, spikeMat);
    spikeStrip.position.set(0, 0.08, 0);

    rbGroup.add(meshDataL.group, meshDataR.group, spikeStrip);
    this.scene.add(rbGroup);

    const copL: CopUnit = {
      id: Date.now() + 1,
      variant: 'cruiser',
      mesh: meshDataL.group,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      heading: bestWp.heading - 0.6,
      speedKmh: 0,
      health: 120,
      maxHealth: 120,
      destroyed: false,
      updateLights: meshDataL.updatePoliceLights,
      targetOffset: new THREE.Vector2(-4.5, 0),
      applyDamageDeformation: meshDataL.applyDamageDeformation,
      isRoadblock: true,
    };

    const copR: CopUnit = {
      id: Date.now() + 2,
      variant: isRightSwat ? 'swat' : 'cruiser',
      mesh: meshDataR.group,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      heading: bestWp.heading + 0.6,
      speedKmh: 0,
      health: 160,
      maxHealth: 160,
      destroyed: false,
      updateLights: meshDataR.updatePoliceLights,
      targetOffset: new THREE.Vector2(4.5, 0),
      applyDamageDeformation: meshDataR.applyDamageDeformation,
      isRoadblock: true,
    };

    meshDataL.group.getWorldPosition(copL.position);
    meshDataR.group.getWorldPosition(copR.position);

    const roadblock: RoadblockUnit = {
      group: rbGroup,
      position: bestWp.position.clone(),
      heading: bestWp.heading,
      copLeft: copL,
      copRight: copR,
      spikeStripMesh: spikeStrip,
      destroyed: false,
      radius: 9.5,
    };

    this.roadblocks.push(roadblock);
    sound.playPoliceRadioChirp();
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    playerVelocity: THREE.Vector3,
    playerSpeedKmh: number,
    waypoints: TrackWaypoint[]
  ): {
    statusText: string;
    busted: boolean;
    escaped: boolean;
    closestCopDist: number;
  } {
    if (!this.pursuitActive || this.cops.length === 0) {
      return { statusText: 'LIVRE', busted: false, escaped: false, closestCopDist: 999 };
    }

    dt = Math.min(dt, 0.05);
    const nowTime = performance.now() * 0.001;
    let closestCopDist = 999;
    let anyCopClose = false;

    const diff = this.getDifficultyMultiplier();

    // Periodically spawn roadblocks ahead if Heat >= 2
    if (this.heatLevel >= 2) {
      this.roadblockTimer += dt;
      if (this.roadblockTimer >= diff.roadblockIntervalSec) {
        this.roadblockTimer = 0;
        this.spawnRoadblockAhead(playerPos, playerVelocity, waypoints);
      }
    }

    // Clean up passed roadblocks
    for (let i = this.roadblocks.length - 1; i >= 0; i--) {
      const rb = this.roadblocks[i];
      const d = rb.position.distanceTo(playerPos);
      if (d < closestCopDist) closestCopDist = d;
      // Strobe lights on roadblock cruisers
      rb.copLeft.updateLights?.(nowTime);
      rb.copRight.updateLights?.(nowTime);

      // If player passed roadblock far behind (> 200m)
      if (d > 220) {
        this.scene.remove(rb.group);
        this.roadblocks.splice(i, 1);
      }
    }

    // Helicopter update
    if (this.helicopterMesh && this.helicopterMesh.visible) {
      this.helicopterMesh.position.set(
        playerPos.x + Math.sin(nowTime * 0.8) * 12,
        35 + Math.sin(nowTime * 1.5) * 2,
        playerPos.z + Math.cos(nowTime * 0.8) * 12
      );
      if (this.heliRotorMesh) this.heliRotorMesh.rotation.y += dt * 38;
      if (this.heliSpotlight) {
        this.heliSpotlight.target.position.copy(playerPos);
        this.heliSpotlight.target.updateMatrixWorld();
      }
    }

    // Update each Cop AI
    for (const cop of this.cops) {
      if (cop.destroyed) continue;

      // Update strobe lights
      cop.updateLights?.(nowTime);

      const dist = _toPlayer.subVectors(playerPos, cop.position).length();
      if (dist < closestCopDist) closestCopDist = dist;

      if (dist < diff.evasionDist) {
        anyCopClose = true;
      }

      // Desired position with tactical flank offset without allocations
      const playerHeading = Math.atan2(playerVelocity.x, playerVelocity.z);
      _tacticalOffset.set(cop.targetOffset.x, 0, cop.targetOffset.y).applyAxisAngle(_upAxis, playerHeading);
      _desiredPos.copy(playerPos).add(_tacticalOffset);

      _dirToTarget.subVectors(_desiredPos, cop.position).normalize();
      const targetHeading = Math.atan2(_dirToTarget.x, _dirToTarget.z);

      // Smooth heading steering with higher response on higher difficulties
      const steerResponsiveness = Math.max(1.5, 6 * diff.ramAggression);
      cop.heading = THREE.MathUtils.damp(cop.heading, targetHeading, Math.min(14, steerResponsiveness), dt);

      // Speed regulation scaled by difficulty
      const baseMaxSpeed = cop.variant === 'swat' ? 56 : cop.variant === 'interceptor' ? 74 : 66;
      let targetSpeed = baseMaxSpeed * diff.speedMult;

      if (dist > 35) {
        targetSpeed *= diff.catchupMult;
      } else if (dist < 12 && this.difficulty !== 'very_easy') {
        const ramBoost = 4.5 * diff.ramAggression;
        targetSpeed = Math.max(targetSpeed, playerVelocity.length() + ramBoost);
      }

      const forwardX = Math.sin(cop.heading);
      const forwardZ = Math.cos(cop.heading);

      const accelDamp = Math.max(1.8, 4.5 * diff.ramAggression);
      cop.velocity.x = THREE.MathUtils.damp(cop.velocity.x, forwardX * targetSpeed, Math.min(10, accelDamp), dt);
      cop.velocity.z = THREE.MathUtils.damp(cop.velocity.z, forwardZ * targetSpeed, Math.min(10, accelDamp), dt);

      cop.position.x += cop.velocity.x * dt;
      cop.position.z += cop.velocity.z * dt;

      cop.mesh.position.copy(cop.position);
      cop.mesh.rotation.y = cop.heading;
      cop.speedKmh = Math.round(cop.velocity.length() * 3.6);
    }

    // Evasion Logic based on Difficulty threshold and evasion distance
    if (closestCopDist > diff.evasionDist) {
      this.isEvading = true;
      this.evasionTimer += dt;
      if (this.evasionTimer >= this.evasionThresholdSec) {
        // Escaped!
        this.clearAll();
        sound.playSuccessFanfare();
        return { statusText: 'FUGA BEM-SUCEDIDA!', busted: false, escaped: true, closestCopDist };
      }
    } else {
      this.isEvading = false;
      this.evasionTimer = Math.max(0, this.evasionTimer - dt * 1.8);
    }

    // Busted Logic (Car stopped or slowed down while cops pin player closely)
    const pinThreshold = this.difficulty === 'very_easy' ? 6.0 : this.difficulty === 'easy' ? 7.2 : 8.5;
    const minPinSpeed = this.difficulty === 'very_easy' ? 8 : 16;
    if (playerSpeedKmh < minPinSpeed && closestCopDist < pinThreshold) {
      this.bustedTimer += dt * diff.bustedSpeed;
      if (this.bustedTimer >= 3.0) {
        sound.playBustedSound();
        return { statusText: 'PRESO PELA POLÍCIA!', busted: true, escaped: false, closestCopDist };
      }
    } else {
      this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2.5);
    }

    let status = 'PERSEGUIÇÃO ATIVA';
    if (this.bustedTimer > 0.4) {
      const pct = Math.round((this.bustedTimer / 3.0) * 100);
      status = `CERCO POLICIAL - PRESO EM (${pct}%)`;
    } else if (this.isEvading) {
      const evadePct = Math.round((this.evasionTimer / this.evasionThresholdSec) * 100);
      status = `EVADINDO DO RADAR (${evadePct}%)`;
    }

    return {
      statusText: status,
      busted: false,
      escaped: false,
      closestCopDist,
    };
  }

  /**
   * Applies damage to a cop when player rams into them.
   */
  public damageCop(
    copIndex: number,
    amount: number,
    localHitDir?: THREE.Vector3,
    impactSpeedMs?: number
  ): boolean {
    const cop = this.cops[copIndex];
    if (!cop || cop.destroyed) return false;

    cop.health = Math.max(0, cop.health - amount);
    const damageRatio = Math.max(0, Math.min(1.0, 1.0 - cop.health / cop.maxHealth));
    if (localHitDir && impactSpeedMs !== undefined && cop.applyImpactDeformation) {
      cop.applyImpactDeformation(localHitDir, impactSpeedMs);
    }
    cop.applyDamageDeformation?.(damageRatio);

    if (cop.health <= 0) {
      cop.destroyed = true;
      cop.mesh.rotation.z = Math.PI / 2; // Wrecked / flipped on side
      cop.mesh.position.y = 0.5;
      cop.applyDamageDeformation?.(1.0);
      this.copsDestroyedCount++;
      sound.playCollisionSound(1.0);
      return true;
    }
    return false;
  }

  /**
   * Checks collision with physical roadblocks and spike strips.
   */
  public checkRoadblockCollision(
    playerPos: THREE.Vector3,
    carRadius: number = 1.4
  ): { hit: boolean; normal: THREE.Vector3; spikeHit: boolean; roadblockIndex: number } | null {
    for (let i = 0; i < this.roadblocks.length; i++) {
      const rb = this.roadblocks[i];
      if (rb.destroyed) continue;

      const d = playerPos.distanceTo(rb.position);
      if (d < rb.radius + carRadius) {
        // Transform playerPos into roadblock local coordinate system
        const dx = playerPos.x - rb.position.x;
        const dz = playerPos.z - rb.position.z;
        const cosH = Math.cos(-rb.heading);
        const sinH = Math.sin(-rb.heading);
        const localX = dx * cosH - dz * sinH;
        const localZ = dx * sinH + dz * cosH;

        // Check if hitting the central spike strip (localX between -2.5 and 2.5, localZ between -1.2 and 1.2)
        const isSpikeHit = Math.abs(localX) < 2.5 && Math.abs(localZ) < 1.2;

        // Collision normal pushing player back
        const norm = new THREE.Vector3(dx, 0, dz).normalize();
        if (norm.lengthSq() < 0.1) norm.set(0, 0, -1);

        return {
          hit: true,
          normal: norm,
          spikeHit: isSpikeHit,
          roadblockIndex: i,
        };
      }
    }
    return null;
  }

  /**
   * Destroys or breaches a roadblock upon high-speed impact
   */
  public smashRoadblock(index: number) {
    const rb = this.roadblocks[index];
    if (!rb || rb.destroyed) return;
    rb.destroyed = true;
    rb.copLeft.destroyed = true;
    rb.copRight.destroyed = true;
    rb.copLeft.applyDamageDeformation?.(1.0);
    rb.copRight.applyDamageDeformation?.(1.0);

    // Blast cruisers outwards
    rb.copLeft.mesh.rotation.z = Math.PI / 2.2;
    rb.copLeft.mesh.position.x -= 3.0;
    rb.copRight.mesh.rotation.z = -Math.PI / 2.2;
    rb.copRight.mesh.position.x += 3.0;
    this.copsDestroyedCount += 2;
    sound.playCollisionSound(1.0);
  }
}
