import * as THREE from 'three';
import { TrackWaypoint } from './CityGenerator';

interface TrafficVehicle {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  driverHead: THREE.Mesh;
  driverTorso: THREE.Mesh;
  passengerGroup: THREE.Group | null;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  heading: number;
  waypointIndex: number;
  direction: 1 | -1;
  laneOffset: number;
  baseSpeedMs: number;
  currentSpeedMs: number;
  hitCooldown: number;
  knockVel: THREE.Vector3;
  knockTimer: number;
  variant: 'sedan' | 'coupe' | 'taxi' | 'suv';
}

export interface TrafficCollisionResult {
  hit: boolean;
  normal: THREE.Vector3;
  impactSpeedMs: number;
  carIndex: number;
}

export class CityTrafficSystem {
  public scene: THREE.Scene;
  public trafficGroup: THREE.Group = new THREE.Group();
  private vehicles: TrafficVehicle[] = [];

  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  // Shared Geometries
  private chassisGeo!: THREE.BoxGeometry;
  private suvChassisGeo!: THREE.BoxGeometry;
  private hoodGeo!: THREE.BoxGeometry;
  private cabinGeo!: THREE.BoxGeometry;
  private suvCabinGeo!: THREE.BoxGeometry;
  private wheelGeo!: THREE.CylinderGeometry;
  private lightGeo!: THREE.BoxGeometry;
  private taxiSignGeo!: THREE.BoxGeometry;
  private shadowGeo!: THREE.PlaneGeometry;

  // NPC Occupant Inside Vehicle Geometries
  private torsoGeo!: THREE.BoxGeometry;
  private headGeo!: THREE.SphereGeometry;
  private armGeo!: THREE.BoxGeometry;
  private steeringWheelGeo!: THREE.TorusGeometry;

  // Shared Materials
  private bodyMats: THREE.MeshStandardMaterial[] = [];
  private taxiMat!: THREE.MeshStandardMaterial;
  private trimMat!: THREE.MeshStandardMaterial;
  private glassMat!: THREE.MeshPhysicalMaterial;
  private wheelMat!: THREE.MeshStandardMaterial;
  private headlightMat!: THREE.MeshStandardMaterial;
  private taillightMat!: THREE.MeshStandardMaterial;
  private taxiSignMat!: THREE.MeshStandardMaterial;
  private shadowMat!: THREE.MeshBasicMaterial;
  private npcShirtMats: THREE.MeshStandardMaterial[] = [];
  private npcSkinMats: THREE.MeshStandardMaterial[] = [];
  private npcHairMat!: THREE.MeshStandardMaterial;

  // Zero-GC Helpers
  private static readonly _targetPos = new THREE.Vector3();
  private static readonly _moveDir = new THREE.Vector3();
  private static readonly _hitNormal = new THREE.Vector3();
  private static readonly _relVel = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.scene.add(this.trafficGroup);
    this.initSharedAssets();
  }

  private initSharedAssets() {
    this.chassisGeo = new THREE.BoxGeometry(1.88, 0.56, 4.25);
    this.suvChassisGeo = new THREE.BoxGeometry(1.98, 0.70, 4.45);
    this.hoodGeo = new THREE.BoxGeometry(1.78, 0.12, 1.25);
    this.cabinGeo = new THREE.BoxGeometry(1.62, 0.56, 2.05);
    this.suvCabinGeo = new THREE.BoxGeometry(1.74, 0.64, 2.55);
    this.wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14);
    this.wheelGeo.rotateZ(Math.PI / 2);
    this.lightGeo = new THREE.BoxGeometry(0.28, 0.09, 0.06);
    this.taxiSignGeo = new THREE.BoxGeometry(0.46, 0.14, 0.22);
    this.shadowGeo = new THREE.PlaneGeometry(2.25, 4.7);
    this.shadowGeo.rotateX(-Math.PI / 2);

    this.torsoGeo = new THREE.BoxGeometry(0.32, 0.36, 0.18);
    this.headGeo = new THREE.SphereGeometry(0.125, 10, 10);
    this.armGeo = new THREE.BoxGeometry(0.08, 0.08, 0.32);
    this.steeringWheelGeo = new THREE.TorusGeometry(0.14, 0.022, 6, 14);

    this.geometries.push(
      this.chassisGeo,
      this.suvChassisGeo,
      this.hoodGeo,
      this.cabinGeo,
      this.suvCabinGeo,
      this.wheelGeo,
      this.lightGeo,
      this.taxiSignGeo,
      this.shadowGeo,
      this.torsoGeo,
      this.headGeo,
      this.armGeo,
      this.steeringWheelGeo
    );

    const paintColors = [0x334155, 0x1d4ed8, 0xb91c1c, 0xe2e8f0, 0x0f766e, 0x475569, 0x7c3aed];
    for (const c of paintColors) {
      const m = new THREE.MeshStandardMaterial({ color: c, metalness: 0.72, roughness: 0.28 });
      this.bodyMats.push(m);
      this.materials.push(m);
    }

    this.taxiMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.55, roughness: 0.3 });
    this.trimMat = new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.65, metalness: 0.25 });
    this.glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x111a26,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      roughness: 0.1,
      metalness: 0.1,
    });
    this.wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85, metalness: 0.15 });
    this.headlightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff3d1,
      emissiveIntensity: 1.8,
      roughness: 0.15,
    });
    this.taillightMat = new THREE.MeshStandardMaterial({
      color: 0xff1122,
      emissive: 0xff0022,
      emissiveIntensity: 2.0,
      roughness: 0.2,
    });
    this.taxiSignMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfacc15,
      emissiveIntensity: 1.4,
      roughness: 0.3,
    });
    this.shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });

    const shirtCols = [0xe2e8f0, 0x0ea5e9, 0xf97316, 0x10b981, 0x64748b];
    for (const c of shirtCols) {
      const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
      this.npcShirtMats.push(m);
      this.materials.push(m);
    }
    const skinCols = [0xf1c27d, 0xd99b66, 0xb87641, 0x7c4824];
    for (const c of skinCols) {
      const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.68 });
      this.npcSkinMats.push(m);
      this.materials.push(m);
    }
    this.npcHairMat = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.6 });

    this.materials.push(
      this.taxiMat,
      this.trimMat,
      this.glassMat,
      this.wheelMat,
      this.headlightMat,
      this.taillightMat,
      this.taxiSignMat,
      this.shadowMat,
      this.npcHairMat
    );
  }

  private buildTrafficCar(seed: number, variant: TrafficVehicle['variant']) {
    const group = new THREE.Group();
    const isSuv = variant === 'suv';
    const isTaxi = variant === 'taxi';
    const isCoupe = variant === 'coupe';

    const bodyMat = isTaxi ? this.taxiMat : this.bodyMats[seed % this.bodyMats.length];

    // Shadow
    const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    shadow.position.y = 0.025;
    group.add(shadow);

    // Chassis & Bumpers
    const chassis = new THREE.Mesh(isSuv ? this.suvChassisGeo : this.chassisGeo, bodyMat);
    chassis.position.y = isSuv ? 0.62 : 0.54;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    group.add(chassis);

    const hood = new THREE.Mesh(this.hoodGeo, bodyMat);
    hood.position.set(0, chassis.position.y + (isSuv ? 0.34 : 0.27), 1.32);
    hood.rotation.x = -0.05;
    group.add(hood);

    // Interior Driver + Optional Passenger seated inside cabin (facing +Z)
    // Looking forward along +Z: +X is left (driver side), -X is right (passenger side)
    const shirtMat = this.npcShirtMats[seed % this.npcShirtMats.length];
    const skinMat = this.npcSkinMats[(seed * 3) % this.npcSkinMats.length];

    const cabinY = isSuv ? 1.24 : isCoupe ? 1.04 : 1.09;
    const driverX = 0.42;

    // Steering wheel at driver's hands
    const steerWheel = new THREE.Mesh(this.steeringWheelGeo, this.trimMat);
    steerWheel.position.set(driverX, cabinY - 0.02, 0.34);
    steerWheel.rotation.x = 0.35;
    group.add(steerWheel);

    // NPC Driver
    const driverTorso = new THREE.Mesh(this.torsoGeo, shirtMat);
    driverTorso.position.set(driverX, cabinY - 0.09, -0.04);
    const driverHead = new THREE.Mesh(this.headGeo, skinMat);
    driverHead.position.set(driverX, cabinY + 0.19, -0.04);
    const driverHair = new THREE.Mesh(this.headGeo, this.npcHairMat);
    driverHair.scale.set(1.04, 0.7, 1.04);
    driverHair.position.set(0, 0.05, -0.01);
    driverHead.add(driverHair);

    const armL = new THREE.Mesh(this.armGeo, shirtMat);
    armL.position.set(driverX + 0.13, cabinY - 0.04, 0.15);
    armL.rotation.x = -0.25;
    armL.rotation.y = 0.15;
    const armR = new THREE.Mesh(this.armGeo, shirtMat);
    armR.position.set(driverX - 0.13, cabinY - 0.04, 0.15);
    armR.rotation.x = -0.25;
    armR.rotation.y = -0.15;
    group.add(driverTorso, driverHead, armL, armR);

    // ~45% of traffic vehicles also carry a visible NPC passenger
    let passengerGroup: THREE.Group | null = null;
    if (seed % 9 < 4) {
      passengerGroup = new THREE.Group();
      const passShirt = this.npcShirtMats[(seed + 2) % this.npcShirtMats.length];
      const passSkin = this.npcSkinMats[(seed + 1) % this.npcSkinMats.length];
      const pTorso = new THREE.Mesh(this.torsoGeo, passShirt);
      pTorso.position.set(-driverX, cabinY - 0.09, -0.05);
      const pHead = new THREE.Mesh(this.headGeo, passSkin);
      pHead.position.set(-driverX, cabinY + 0.19, -0.05);
      const pHair = new THREE.Mesh(this.headGeo, this.npcHairMat);
      pHair.scale.set(1.04, 0.72, 1.04);
      pHair.position.set(0, 0.05, -0.01);
      pHead.add(pHair);
      passengerGroup.add(pTorso, pHead);
      group.add(passengerGroup);
    }

    // Translucent Glass Cabin Shell (occupants clearly visible inside!)
    const cabin = new THREE.Mesh(isSuv ? this.suvCabinGeo : this.cabinGeo, this.glassMat);
    cabin.position.set(0, cabinY, isSuv ? -0.25 : -0.1);
    if (isCoupe) cabin.scale.y = 0.88;
    group.add(cabin);

    // Painted Roof Cap above cabin glass
    const roofCap = new THREE.Mesh(
      new THREE.BoxGeometry(isSuv ? 1.66 : 1.54, 0.05, isSuv ? 2.35 : 1.8),
      bodyMat
    );
    roofCap.position.set(0, cabinY + (isSuv ? 0.33 : isCoupe ? 0.25 : 0.28), cabin.position.z);
    group.add(roofCap);

    if (isTaxi) {
      const sign = new THREE.Mesh(this.taxiSignGeo, this.taxiSignMat);
      sign.position.set(0, roofCap.position.y + 0.09, cabin.position.z + 0.15);
      group.add(sign);
    }

    // Headlights (+Z front) & Taillights (-Z rear)
    const hlL = new THREE.Mesh(this.lightGeo, this.headlightMat);
    hlL.position.set(0.64, chassis.position.y + 0.06, isSuv ? 2.22 : 2.12);
    const hlR = new THREE.Mesh(this.lightGeo, this.headlightMat);
    hlR.position.set(-0.64, chassis.position.y + 0.06, isSuv ? 2.22 : 2.12);
    const tlL = new THREE.Mesh(this.lightGeo, this.taillightMat);
    tlL.position.set(0.64, chassis.position.y + 0.08, isSuv ? -2.22 : -2.12);
    const tlR = new THREE.Mesh(this.lightGeo, this.taillightMat);
    tlR.position.set(-0.64, chassis.position.y + 0.08, isSuv ? -2.22 : -2.12);
    group.add(hlL, hlR, tlL, tlR);

    // 4 Wheels
    const wheels: THREE.Mesh[] = [];
    const wx = isSuv ? 0.96 : 0.92;
    const wz = isSuv ? 1.44 : 1.36;
    const wheelCoords = [
      [wx, 0.34, wz],
      [-wx, 0.34, wz],
      [wx, 0.34, -wz],
      [-wx, 0.34, -wz],
    ];
    for (const [x, y, z] of wheelCoords) {
      const w = new THREE.Mesh(this.wheelGeo, this.wheelMat);
      w.position.set(x, y, z);
      group.add(w);
      wheels.push(w);
    }

    return { group, wheels, driverHead, driverTorso, passengerGroup };
  }

  public clear() {
    while (this.trafficGroup.children.length > 0) {
      this.trafficGroup.remove(this.trafficGroup.children[0]);
    }
    this.vehicles = [];
  }

  public populateForTrack(
    trackId: string,
    waypoints: TrackWaypoint[],
    roadHalfWidth: number,
    getElevation?: (pos: THREE.Vector3, currentY: number) => number
  ) {
    this.clear();
    if (waypoints.length < 12) return;

    const count =
      trackId === 'track_city' || trackId === 'track_neon_tokyo'
        ? 18
        : trackId === 'track_san_bernard'
          ? 16
          : trackId === 'track_coast'
            ? 14
            : trackId === 'track_docks'
              ? 12
              : 10;

    const variants: TrafficVehicle['variant'][] = ['sedan', 'coupe', 'taxi', 'suv'];
    const laneDist = Math.max(3.6, Math.min(5.2, roadHalfWidth * 0.44));

    for (let i = 0; i < count; i++) {
      // Keep starting grid zone clear near waypoint 0
      const fraction = (i + 1) / (count + 1);
      const wpIdx = Math.floor(fraction * waypoints.length) % waypoints.length;
      const wp = waypoints[wpIdx];

      const direction: 1 | -1 = i % 2 === 0 ? 1 : -1;
      const laneOffset = direction === 1 ? -laneDist : laneDist;
      const variant = variants[i % variants.length];
      const built = this.buildTrafficCar(i, variant);

      const nx = Math.cos(wp.heading);
      const nz = -Math.sin(wp.heading);
      const pos = new THREE.Vector3(
        wp.position.x + nx * laneOffset,
        wp.position.y,
        wp.position.z + nz * laneOffset
      );
      if (getElevation) {
        pos.y = getElevation(pos, pos.y);
      }

      const heading = direction === 1 ? wp.heading : wp.heading + Math.PI;
      built.group.position.copy(pos);
      built.group.rotation.y = heading;
      this.trafficGroup.add(built.group);

      const baseSpeedMs = 11 + (i % 4) * 2.2; // ~40–63 km/h cruising city traffic
      this.vehicles.push({
        group: built.group,
        wheels: built.wheels,
        driverHead: built.driverHead,
        driverTorso: built.driverTorso,
        passengerGroup: built.passengerGroup,
        position: pos,
        velocity: new THREE.Vector3(Math.sin(heading) * baseSpeedMs, 0, Math.cos(heading) * baseSpeedMs),
        heading,
        waypointIndex: wpIdx,
        direction,
        laneOffset,
        baseSpeedMs,
        currentSpeedMs: baseSpeedMs,
        hitCooldown: 0,
        knockVel: new THREE.Vector3(),
        knockTimer: 0,
        variant,
      });
    }
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    playerVel: THREE.Vector3,
    _playerSpeedKmh: number,
    waypoints: TrackWaypoint[],
    getElevation?: (pos: THREE.Vector3, currentY: number) => number,
    checkCollisions: boolean = true
  ): TrafficCollisionResult | null {
    if (this.vehicles.length === 0 || waypoints.length < 4) return null;

    let collisionResult: TrafficCollisionResult | null = null;
    const maxVisibleSq = 185 * 185;
    const timeNow = performance.now() * 0.001;

    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      if (v.hitCooldown > 0) v.hitCooldown = Math.max(0, v.hitCooldown - dt);

      const dxP = playerPos.x - v.position.x;
      const dzP = playerPos.z - v.position.z;
      const distSqPlayer = dxP * dxP + dzP * dzP;

      v.group.visible = distSqPlayer <= maxVisibleSq;

      // Knocked physics recoil after player impact
      if (v.knockTimer > 0) {
        v.knockTimer -= dt;
        v.position.addScaledVector(v.knockVel, dt);
        v.knockVel.multiplyScalar(Math.max(0, 1 - dt * 2.4));
        v.heading += v.knockVel.x * 0.04 * dt;
        if (getElevation) {
          v.position.y = getElevation(v.position, v.position.y);
        }
        v.group.position.copy(v.position);
        v.group.rotation.y = v.heading;
        continue;
      }

      // 1. Follow track lane waypoints
      const nextIdx = (v.waypointIndex + v.direction + waypoints.length) % waypoints.length;
      const nextWp = waypoints[nextIdx];
      const nx = Math.cos(nextWp.heading);
      const nz = -Math.sin(nextWp.heading);

      CityTrafficSystem._targetPos.set(
        nextWp.position.x + nx * v.laneOffset,
        v.position.y,
        nextWp.position.z + nz * v.laneOffset
      );

      CityTrafficSystem._moveDir.subVectors(CityTrafficSystem._targetPos, v.position);
      CityTrafficSystem._moveDir.y = 0;
      const stepDist = CityTrafficSystem._moveDir.length();

      if (stepDist < 4.5) {
        v.waypointIndex = nextIdx;
      } else {
        CityTrafficSystem._moveDir.divideScalar(stepDist);
        const desiredHeading = Math.atan2(CityTrafficSystem._moveDir.x, CityTrafficSystem._moveDir.z);
        const headingDiff = Math.atan2(
          Math.sin(desiredHeading - v.heading),
          Math.cos(desiredHeading - v.heading)
        );
        v.heading += headingDiff * Math.min(1, dt * 4.5);
      }

      // 2. React to player closeness & same-lane traffic spacing
      let targetSpeed = v.baseSpeedMs;
      if (distSqPlayer < 14 * 14 && Math.abs(playerPos.y - v.position.y) < 2.5) {
        // NPC driver brakes and glances toward player
        targetSpeed = v.baseSpeedMs * 0.35;
        v.driverHead.rotation.y = Math.sin(timeNow * 8 + i) * 0.35;
      } else {
        v.driverHead.rotation.y = Math.sin(timeNow * 1.4 + i) * 0.12;
      }

      // Check car ahead in same lane
      for (let j = 0; j < this.vehicles.length; j++) {
        if (i === j) continue;
        const other = this.vehicles[j];
        if (other.direction !== v.direction) continue;
        const odx = other.position.x - v.position.x;
        const odz = other.position.z - v.position.z;
        const oDistSq = odx * odx + odz * odz;
        if (oDistSq < 11 * 11) {
          const fwdDot = odx * Math.sin(v.heading) + odz * Math.cos(v.heading);
          if (fwdDot > 0) {
            targetSpeed = Math.min(targetSpeed, other.currentSpeedMs * 0.7);
          }
        }
      }

      v.currentSpeedMs = THREE.MathUtils.damp(v.currentSpeedMs, targetSpeed, 4.0, dt);

      const fwdX = Math.sin(v.heading);
      const fwdZ = Math.cos(v.heading);
      v.velocity.set(fwdX * v.currentSpeedMs, 0, fwdZ * v.currentSpeedMs);
      v.position.addScaledVector(v.velocity, dt);

      if (getElevation) {
        const targetY = getElevation(v.position, v.position.y);
        v.position.y = THREE.MathUtils.damp(v.position.y, targetY, 12, dt);
      }

      v.group.position.copy(v.position);
      v.group.rotation.y = v.heading;

      // Spin wheels when visible
      if (v.group.visible) {
        const rollStep = v.currentSpeedMs * dt * 2.9;
        for (let w = 0; w < v.wheels.length; w++) {
          v.wheels[w].rotation.x += rollStep;
        }
      }

      // 3. Player <-> NPC Vehicle Collision Check
      if (
        checkCollisions &&
        !collisionResult &&
        v.hitCooldown <= 0 &&
        distSqPlayer < 3.1 * 3.1 &&
        Math.abs(playerPos.y - v.position.y) < 1.9
      ) {
        CityTrafficSystem._relVel.subVectors(playerVel, v.velocity);
        const impactSpeedMs = CityTrafficSystem._relVel.length();
        if (impactSpeedMs > 2.2) {
          CityTrafficSystem._hitNormal.subVectors(playerPos, v.position);
          CityTrafficSystem._hitNormal.y = 0;
          if (CityTrafficSystem._hitNormal.lengthSq() < 0.001) {
            CityTrafficSystem._hitNormal.set(1, 0, 0);
          } else {
            CityTrafficSystem._hitNormal.normalize();
          }

          // Knock traffic vehicle aside cleanly
          v.hitCooldown = 0.85;
          v.knockTimer = 1.1;
          v.knockVel
            .copy(CityTrafficSystem._hitNormal)
            .negate()
            .multiplyScalar(Math.min(18, impactSpeedMs * 0.65));
          v.position.addScaledVector(CityTrafficSystem._hitNormal, -0.45);

          collisionResult = {
            hit: true,
            normal: CityTrafficSystem._hitNormal.clone(),
            impactSpeedMs,
            carIndex: i,
          };
        }
      }
    }

    return collisionResult;
  }

  public dispose() {
    this.clear();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.geometries = [];
    this.materials = [];
  }
}
