import * as THREE from 'three';
import { VehiclePhysics } from '../physics/VehiclePhysics';
import { CopUnit } from '../police/PoliceAI';
import {
  ReplayCameraAngle,
  ReplayCopSnapshot,
  ReplayFrame,
  VehicleConfig,
} from '../types';
import { VehicleMeshBuilder, VehicleMeshData } from '../vehicles/VehicleMesh';

export type ReplayReturnSource = 'pause' | 'result' | 'title';

export interface ReplaySampledState {
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
}

const MAX_REPLAY_FRAMES = 1800; // ~60s at 30 Hz
const RECORD_INTERVAL_SEC = 1 / 30;
const MAX_COPS_PER_FRAME = 6;

const _camTarget = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _smoothedCamPos = new THREE.Vector3();
const _smoothedLookPos = new THREE.Vector3();
const _interpPos = new THREE.Vector3();

function lerpAngle(a: number, b: number, t: number): number {
  const diff = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + diff * t;
}

export class ReplaySystem {
  public scene: THREE.Scene;
  private ringBuffer: (ReplayFrame | undefined)[] = new Array(MAX_REPLAY_FRAMES);
  private head: number = 0;
  private count: number = 0;
  private recordAccum: number = 0;
  private recordedTime: number = 0;
  private cumulativeWheelRoll: number = 0;

  // Playback State
  public active: boolean = false;
  public isPaused: boolean = false;
  public playbackSpeed: number = 1;
  public cameraAngle: ReplayCameraAngle = 'tv';
  public playbackTime: number = 0;
  public duration: number = 0;
  public returnSource: ReplayReturnSource = 'title';
  private playbackFrames: ReplayFrame[] = [];
  private orbitTimer: number = 0;
  private tvCutTimer: number = 0;
  private tvAnchorPos: THREE.Vector3 = new THREE.Vector3();
  private tvHasAnchor: boolean = false;

  // Pooled 3D Cop Meshes for faithful replay visuals
  private replayCopGroup: THREE.Group = new THREE.Group();
  private copMeshPool: Map<number, { variant: 'cruiser' | 'interceptor' | 'swat'; meshData: VehicleMeshData }> =
    new Map();

  private static readonly CRUISER_CFG: VehicleConfig = {
    id: 'replay_cruiser',
    name: 'Viatura',
    category: 'police',
    price: 0,
    topSpeed: 235,
    acceleration: 85,
    handling: 78,
    braking: 85,
    healthMax: 100,
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

  private static readonly SWAT_CFG: VehicleConfig = {
    id: 'replay_swat',
    name: 'SWAT',
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

  public readonly sampledState: ReplaySampledState = {
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    steerAngle: 0,
    driftSlip: 0,
    speedKmh: 0,
    wheelRoll: 0,
    missingMask: 0,
    isDrifting: false,
    nitroActive: false,
  };

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.replayCopGroup.visible = false;
    this.scene.add(this.replayCopGroup);
  }

  public clearRecording() {
    this.ringBuffer.fill(undefined);
    this.head = 0;
    this.count = 0;
    this.recordAccum = 0;
    this.recordedTime = 0;
    this.cumulativeWheelRoll = 0;
  }

  public hasFrames(): boolean {
    return this.count >= 6;
  }

  public recordFrame(
    dt: number,
    physics: VehiclePhysics,
    cops: CopUnit[],
    nitroActive: boolean
  ) {
    if (this.active) return;

    this.recordedTime += dt;
    this.recordAccum += dt;
    this.cumulativeWheelRoll += (physics.speedKmh / 3.6) * dt * 8;

    if (this.recordAccum < RECORD_INTERVAL_SEC) return;
    this.recordAccum = 0;

    let missingMask = 0;
    for (let i = 0; i < 4; i++) {
      if (physics.missingWheels[i]) missingMask |= 1 << i;
    }

    const copSnaps: ReplayCopSnapshot[] = [];
    for (let i = 0; i < cops.length && copSnaps.length < MAX_COPS_PER_FRAME; i++) {
      const c = cops[i];
      if (!c) continue;
      copSnaps.push({
        id: c.id,
        variant: c.variant,
        x: c.position.x,
        y: c.position.y,
        z: c.position.z,
        heading: c.heading,
        destroyed: c.destroyed,
      });
    }

    const frame: ReplayFrame = {
      time: this.recordedTime,
      x: physics.position.x,
      y: physics.position.y,
      z: physics.position.z,
      heading: physics.heading,
      pitch: physics.pitch,
      roll: physics.roll,
      steerAngle: physics.steerAngle,
      driftSlip: physics.driftSlip,
      speedKmh: physics.speedKmh,
      wheelRoll: this.cumulativeWheelRoll,
      missingMask,
      isDrifting: physics.isDrifting,
      nitroActive,
      cops: copSnaps,
    };

    const writeIdx = (this.head + this.count) % MAX_REPLAY_FRAMES;
    if (this.count < MAX_REPLAY_FRAMES) {
      this.ringBuffer[writeIdx] = frame;
      this.count++;
    } else {
      this.ringBuffer[this.head] = frame;
      this.head = (this.head + 1) % MAX_REPLAY_FRAMES;
    }
  }

  public startPlayback(returnSource: ReplayReturnSource): boolean {
    if (!this.hasFrames()) return false;

    this.playbackFrames = [];
    const baseTime = this.ringBuffer[this.head]?.time ?? 0;
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head + i) % MAX_REPLAY_FRAMES;
      const f = this.ringBuffer[idx];
      if (f) {
        this.playbackFrames.push({
          ...f,
          time: Math.max(0, f.time - baseTime),
        });
      }
    }

    if (this.playbackFrames.length < 2) return false;

    this.duration = this.playbackFrames[this.playbackFrames.length - 1].time;
    this.playbackTime = 0;
    this.playbackSpeed = 1;
    this.isPaused = false;
    this.cameraAngle = 'tv';
    this.returnSource = returnSource;
    this.orbitTimer = 0;
    this.tvCutTimer = 0;
    this.tvHasAnchor = false;
    this.active = true;

    this.replayCopGroup.visible = true;
    this.sampleAt(0);
    _interpPos.set(this.sampledState.x, this.sampledState.y, this.sampledState.z);
    this.pickTvAnchor(_interpPos, this.sampledState.heading);
    _smoothedCamPos.copy(this.tvAnchorPos);
    _smoothedLookPos.set(this.sampledState.x, this.sampledState.y + 0.9, this.sampledState.z);

    return true;
  }

  public stopPlayback() {
    this.active = false;
    this.isPaused = false;
    this.replayCopGroup.visible = false;
    this.copMeshPool.forEach((entry) => {
      entry.meshData.group.visible = false;
    });
  }

  public togglePlayPause(): boolean {
    this.isPaused = !this.isPaused;
    return this.isPaused;
  }

  public seekTo(timeSec: number) {
    this.playbackTime = Math.max(0, Math.min(this.duration, timeSec));
    this.tvHasAnchor = false;
    this.sampleAt(this.playbackTime);
  }

  public stepPlayback(deltaSec: number) {
    this.seekTo(this.playbackTime + deltaSec);
  }

  public setPlaybackSpeed(speed: number) {
    this.playbackSpeed = speed;
  }

  public setCameraAngle(angle: ReplayCameraAngle) {
    this.cameraAngle = angle;
    this.tvHasAnchor = false;
  }

  public updatePlayback(dt: number): ReplaySampledState {
    if (!this.isPaused && this.duration > 0) {
      this.playbackTime += dt * this.playbackSpeed;
      if (this.playbackTime >= this.duration) {
        this.playbackTime = 0;
        this.tvHasAnchor = false;
      }
    }
    this.sampleAt(this.playbackTime);
    this.syncReplayCops(this.playbackTime);
    return this.sampledState;
  }

  private findBracketIndices(t: number): [number, number, number] {
    const frames = this.playbackFrames;
    const len = frames.length;
    if (len === 0) return [0, 0, 0];
    if (t <= frames[0].time) return [0, 0, 0];
    if (t >= frames[len - 1].time) return [len - 1, len - 1, 0];

    let lo = 0;
    let hi = len - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (frames[mid].time <= t) lo = mid;
      else hi = mid;
    }

    const a = frames[lo];
    const b = frames[hi];
    const span = b.time - a.time;
    const alpha = span > 0.0001 ? Math.max(0, Math.min(1, (t - a.time) / span)) : 0;
    return [lo, hi, alpha];
  }

  public sampleAt(t: number) {
    const frames = this.playbackFrames;
    if (frames.length === 0) return;

    const [idxA, idxB, alpha] = this.findBracketIndices(t);
    const a = frames[idxA];
    const b = frames[idxB];

    const s = this.sampledState;
    s.x = THREE.MathUtils.lerp(a.x, b.x, alpha);
    s.y = THREE.MathUtils.lerp(a.y, b.y, alpha);
    s.z = THREE.MathUtils.lerp(a.z, b.z, alpha);
    s.heading = lerpAngle(a.heading, b.heading, alpha);
    s.pitch = lerpAngle(a.pitch, b.pitch, alpha);
    s.roll = lerpAngle(a.roll, b.roll, alpha);
    s.steerAngle = THREE.MathUtils.lerp(a.steerAngle, b.steerAngle, alpha);
    s.driftSlip = THREE.MathUtils.lerp(a.driftSlip, b.driftSlip, alpha);
    s.speedKmh = THREE.MathUtils.lerp(a.speedKmh, b.speedKmh, alpha);
    s.wheelRoll = THREE.MathUtils.lerp(a.wheelRoll, b.wheelRoll, alpha);
    s.missingMask = a.missingMask;
    s.isDrifting = alpha < 0.5 ? a.isDrifting : b.isDrifting;
    s.nitroActive = alpha < 0.5 ? a.nitroActive : b.nitroActive;
  }

  private syncReplayCops(t: number) {
    const [idxA, idxB, alpha] = this.findBracketIndices(t);
    const frameA = this.playbackFrames[idxA];
    const frameB = this.playbackFrames[idxB];
    if (!frameA) return;

    // Hide all pooled cop meshes first
    this.copMeshPool.forEach((entry) => {
      entry.meshData.group.visible = false;
    });

    const nowSec = performance.now() * 0.001;
    for (let i = 0; i < frameA.cops.length; i++) {
      const ca = frameA.cops[i];
      if (ca.destroyed) continue;

      let cb = ca;
      if (frameB) {
        for (let j = 0; j < frameB.cops.length; j++) {
          if (frameB.cops[j].id === ca.id) {
            cb = frameB.cops[j];
            break;
          }
        }
      }

      let poolEntry = this.copMeshPool.get(ca.id);
      if (!poolEntry || poolEntry.variant !== ca.variant) {
        if (poolEntry) {
          this.replayCopGroup.remove(poolEntry.meshData.group);
        }
        const cfg = ca.variant === 'swat' ? ReplaySystem.SWAT_CFG : ReplaySystem.CRUISER_CFG;
        const meshData = VehicleMeshBuilder.createVehicleGroup(cfg, true);
        this.replayCopGroup.add(meshData.group);
        poolEntry = { variant: ca.variant, meshData };
        this.copMeshPool.set(ca.id, poolEntry);
      }

      const grp = poolEntry.meshData.group;
      grp.visible = true;
      grp.position.set(
        THREE.MathUtils.lerp(ca.x, cb.x, alpha),
        THREE.MathUtils.lerp(ca.y, cb.y, alpha),
        THREE.MathUtils.lerp(ca.z, cb.z, alpha)
      );
      grp.rotation.y = lerpAngle(ca.heading, cb.heading, alpha);
      poolEntry.meshData.updatePoliceLights?.(nowSec);
    }
  }

  private pickTvAnchor(carPos: THREE.Vector3, carHeading: number) {
    const fwdX = Math.sin(carHeading);
    const fwdZ = Math.cos(carHeading);
    const rightX = Math.cos(carHeading);
    const rightZ = -Math.sin(carHeading);
    const side = Math.sin(this.playbackTime * 1.7) >= 0 ? 1 : -1;

    this.tvAnchorPos.set(
      carPos.x + fwdX * 14 + rightX * side * 8.5,
      carPos.y + 4.4,
      carPos.z + fwdZ * 14 + rightZ * side * 8.5
    );
    this.tvHasAnchor = true;
    this.tvCutTimer = 0;
  }

  public updateCamera(
    dt: number,
    camera: THREE.PerspectiveCamera,
    isVerticalMode: boolean
  ) {
    const s = this.sampledState;
    const carPos = _interpPos.set(s.x, s.y, s.z);
    const fwdX = Math.sin(s.heading);
    const fwdZ = Math.cos(s.heading);
    const rightX = Math.cos(s.heading);
    const rightZ = -Math.sin(s.heading);

    if (this.cameraAngle === 'tv') {
      this.tvCutTimer += dt;
      if (!this.tvHasAnchor || this.tvCutTimer > 4.2 || carPos.distanceTo(this.tvAnchorPos) > 42) {
        this.pickTvAnchor(carPos, s.heading);
        _smoothedCamPos.copy(this.tvAnchorPos);
      }
      _camTarget.copy(this.tvAnchorPos);
      _lookTarget.set(carPos.x, carPos.y + 0.9, carPos.z);
      _smoothedCamPos.lerp(_camTarget, Math.min(1, dt * 8));
      _smoothedLookPos.lerp(_lookTarget, Math.min(1, dt * 12));
    } else if (this.cameraAngle === 'wheel') {
      _camTarget.set(
        carPos.x + rightX * 2.1 - fwdX * 1.8,
        carPos.y + 0.72,
        carPos.z + rightZ * 2.1 - fwdZ * 1.8
      );
      _lookTarget.set(carPos.x + fwdX * 2.2, carPos.y + 0.58, carPos.z + fwdZ * 2.2);
      _smoothedCamPos.lerp(_camTarget, Math.min(1, dt * 10));
      _smoothedLookPos.lerp(_lookTarget, Math.min(1, dt * 14));
    } else if (this.cameraAngle === 'orbit') {
      this.orbitTimer += dt * 0.65;
      const radius = isVerticalMode ? 7.6 : 6.4;
      _camTarget.set(
        carPos.x + Math.sin(this.orbitTimer) * radius,
        carPos.y + 2.4 + Math.sin(this.orbitTimer * 1.6) * 0.45,
        carPos.z + Math.cos(this.orbitTimer) * radius
      );
      _lookTarget.set(carPos.x, carPos.y + 0.85, carPos.z);
      _smoothedCamPos.lerp(_camTarget, Math.min(1, dt * 8));
      _smoothedLookPos.lerp(_lookTarget, Math.min(1, dt * 12));
    } else {
      // 'chase'
      const dist = isVerticalMode ? 7.8 : 6.4;
      const height = isVerticalMode ? 2.9 : 2.35;
      _camTarget.set(carPos.x - fwdX * dist, carPos.y + height, carPos.z - fwdZ * dist);
      _lookTarget.set(carPos.x + fwdX * 4.2, carPos.y + 1.15, carPos.z + fwdZ * 4.2);
      _smoothedCamPos.lerp(_camTarget, Math.min(1, dt * 10));
      _smoothedLookPos.lerp(_lookTarget, Math.min(1, dt * 12));
    }

    camera.position.copy(_smoothedCamPos);
    camera.lookAt(_smoothedLookPos);

    const targetFov = this.cameraAngle === 'tv' ? 48 : this.cameraAngle === 'wheel' ? 68 : isVerticalMode ? 68 : 60;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 7, dt);
      camera.updateProjectionMatrix();
    }
  }

  public dispose() {
    this.stopPlayback();
    this.clearRecording();
    this.scene.remove(this.replayCopGroup);
    this.copMeshPool.clear();
  }
}
