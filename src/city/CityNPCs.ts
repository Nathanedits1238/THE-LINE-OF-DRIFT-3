import * as THREE from 'three';
import { NPCBehaviorMode } from '../types';
import { BridgeOverpassDef, TrackWaypoint } from './CityGenerator';

interface NPCAgent {
  group: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  headGroup: THREE.Group;

  mode: NPCBehaviorMode;
  baseMode: 'sidewalk_walk' | 'sidewalk_idle' | 'street_cross';
  waypointIndex: number;
  sideSign: 1 | -1; // +1 or -1 lateral side of street
  lateralOffset: number; // distance from centerline (positive/negative along normal)
  crossDirection: 1 | -1;
  crossPauseTimer: number;
  walkSpeed: number;
  walkPhase: number;
  idleTimer: number;
  heading: number;

  knockedVel: THREE.Vector3;
  knockedTimer: number;
  heightScale: number;
}

export class CityNPCSystem {
  public scene: THREE.Scene;
  public npcGroup: THREE.Group = new THREE.Group();
  private agents: NPCAgent[] = [];

  // Shared geometries & materials for minimal draw overhead & clean disposal
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  private torsoGeo!: THREE.BoxGeometry;
  private headGeo!: THREE.SphereGeometry;
  private capGeo!: THREE.CylinderGeometry;
  private hairGeo!: THREE.SphereGeometry;
  private armGeo!: THREE.CylinderGeometry;
  private legGeo!: THREE.CylinderGeometry;
  private shoeGeo!: THREE.BoxGeometry;
  private packGeo!: THREE.BoxGeometry;
  private phoneGeo!: THREE.BoxGeometry;
  private shadowGeo!: THREE.CircleGeometry;

  private jacketMats: THREE.MeshStandardMaterial[] = [];
  private pantsMats: THREE.MeshStandardMaterial[] = [];
  private skinMats: THREE.MeshStandardMaterial[] = [];
  private hairMats: THREE.MeshStandardMaterial[] = [];
  private shoeMat!: THREE.MeshStandardMaterial;
  private phoneScreenMat!: THREE.MeshBasicMaterial;
  private shadowMat!: THREE.MeshBasicMaterial;

  // Zero-GC preallocated helpers
  private static readonly _nextPos = new THREE.Vector3();
  private static readonly _moveDir = new THREE.Vector3();
  private static readonly _toPlayer = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.scene.add(this.npcGroup);
    this.initSharedAssets();
  }

  private initSharedAssets() {
    this.torsoGeo = new THREE.BoxGeometry(0.42, 0.56, 0.24);
    this.headGeo = new THREE.SphereGeometry(0.15, 10, 10);
    this.capGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.08, 10);
    this.hairGeo = new THREE.SphereGeometry(0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.58);
    this.armGeo = new THREE.CylinderGeometry(0.06, 0.055, 0.48, 8);
    this.legGeo = new THREE.CylinderGeometry(0.075, 0.06, 0.62, 8);
    this.shoeGeo = new THREE.BoxGeometry(0.13, 0.09, 0.22);
    this.packGeo = new THREE.BoxGeometry(0.3, 0.38, 0.14);
    this.phoneGeo = new THREE.BoxGeometry(0.06, 0.1, 0.015);
    this.shadowGeo = new THREE.CircleGeometry(0.38, 12);
    this.shadowGeo.rotateX(-Math.PI / 2);

    this.geometries.push(
      this.torsoGeo,
      this.headGeo,
      this.capGeo,
      this.hairGeo,
      this.armGeo,
      this.legGeo,
      this.shoeGeo,
      this.packGeo,
      this.phoneGeo,
      this.shadowGeo
    );

    const jacketColors = [0x00a8e8, 0xe63946, 0xf59e0b, 0x10b981, 0x8b5cf6, 0xe2e8f0, 0x334155];
    jacketColors.forEach((col) => {
      const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.82, metalness: 0.05 });
      this.jacketMats.push(m);
      this.materials.push(m);
    });

    const pantsColors = [0x1e293b, 0x0f172a, 0x374151, 0x4b5563, 0x292524];
    pantsColors.forEach((col) => {
      const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, metalness: 0.02 });
      this.pantsMats.push(m);
      this.materials.push(m);
    });

    const skinColors = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
    skinColors.forEach((col) => {
      const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.65, metalness: 0.02 });
      this.skinMats.push(m);
      this.materials.push(m);
    });

    const hairColors = [0x111111, 0x3b2f2f, 0x713f12, 0x991b1b, 0x0284c7];
    hairColors.forEach((col) => {
      const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: 0.05 });
      this.hairMats.push(m);
      this.materials.push(m);
    });

    this.shoeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.72, metalness: 0.1 });
    this.phoneScreenMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc });
    this.shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });
    this.materials.push(this.shoeMat, this.phoneScreenMat, this.shadowMat);
  }

  private createPedestrianMesh(seed: number): {
    group: THREE.Group;
    leftArm: THREE.Group;
    rightArm: THREE.Group;
    leftLeg: THREE.Group;
    rightLeg: THREE.Group;
    headGroup: THREE.Group;
  } {
    const group = new THREE.Group();

    const jacketMat = this.jacketMats[seed % this.jacketMats.length];
    const pantsMat = this.pantsMats[(seed * 3) % this.pantsMats.length];
    const skinMat = this.skinMats[(seed * 7) % this.skinMats.length];
    const hairMat = this.hairMats[(seed * 5) % this.hairMats.length];

    // 1. Grounded contact shadow disc
    const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    shadow.position.y = 0.03;
    group.add(shadow);

    // 2. Torso
    const torso = new THREE.Mesh(this.torsoGeo, jacketMat);
    torso.position.y = 0.98;
    torso.castShadow = true;
    group.add(torso);

    // Optional backpack on ~40% of NPCs
    if (seed % 5 < 2) {
      const pack = new THREE.Mesh(this.packGeo, pantsMat);
      pack.position.set(0, 1.0, -0.17);
      group.add(pack);
    }

    // 3. Head + Hair/Cap Accent
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.42, 0);
    const headMesh = new THREE.Mesh(this.headGeo, skinMat);
    headGroup.add(headMesh);

    if (seed % 3 === 0) {
      // Sport cap
      const cap = new THREE.Mesh(this.capGeo, hairMat);
      cap.position.y = 0.11;
      headGroup.add(cap);
    } else {
      // Hair dome
      const hair = new THREE.Mesh(this.hairGeo, hairMat);
      hair.position.y = 0.03;
      headGroup.add(hair);
    }
    group.add(headGroup);

    // 4 & 5. Articulated Arms pivoted at shoulders
    const createArm = (xOffset: number, withPhone: boolean) => {
      const pivot = new THREE.Group();
      pivot.position.set(xOffset, 1.22, 0);
      const armMesh = new THREE.Mesh(this.armGeo, jacketMat);
      armMesh.position.y = -0.22;
      pivot.add(armMesh);
      if (withPhone) {
        const phone = new THREE.Mesh(this.phoneGeo, this.phoneScreenMat);
        phone.position.set(0, -0.42, 0.08);
        phone.rotation.x = -0.7;
        pivot.add(phone);
      }
      return pivot;
    };
    const leftArm = createArm(0.28, false);
    const rightArm = createArm(-0.28, seed % 4 === 1);
    group.add(leftArm, rightArm);

    // 6 & 7. Articulated Legs + Shoes pivoted at hips (bottom-center flush at y = 0)
    const createLeg = (xOffset: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(xOffset, 0.7, 0);
      const legMesh = new THREE.Mesh(this.legGeo, pantsMat);
      legMesh.position.y = -0.32;
      const shoeMesh = new THREE.Mesh(this.shoeGeo, this.shoeMat);
      shoeMesh.position.set(0, -0.65, 0.04);
      pivot.add(legMesh, shoeMesh);
      return pivot;
    };
    const leftLeg = createLeg(0.11);
    const rightLeg = createLeg(-0.11);
    group.add(leftLeg, rightLeg);

    return { group, leftArm, rightArm, leftLeg, rightLeg, headGroup };
  }

  public clear() {
    while (this.npcGroup.children.length > 0) {
      this.npcGroup.remove(this.npcGroup.children[0]);
    }
    this.agents = [];
  }

  public populateForTrack(
    trackId: string,
    waypoints: TrackWaypoint[],
    roadHalfWidth: number,
    colliders: { minX: number; maxX: number; minZ: number; maxZ: number }[],
    bridges: BridgeOverpassDef[],
    tunnels: { minX: number; maxX: number; minZ: number; maxZ: number; maxY: number }[]
  ) {
    this.clear();
    if (waypoints.length < 10) return;

    const npcCount =
      trackId === 'track_city'
        ? 44
        : trackId === 'track_docks'
          ? 24
          : trackId === 'track_coast'
            ? 20
            : 12;

    const isUnsafeSpot = (x: number, z: number): boolean => {
      for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i];
        if (x >= c.minX - 0.8 && x <= c.maxX + 0.8 && z >= c.minZ - 0.8 && z <= c.maxZ + 0.8) {
          return true;
        }
      }
      for (let i = 0; i < tunnels.length; i++) {
        const t = tunnels[i];
        if (x >= t.minX - 3 && x <= t.maxX + 3 && z >= t.minZ - 3 && z <= t.maxZ + 3) {
          return true;
        }
      }
      for (let i = 0; i < bridges.length; i++) {
        const b = bridges[i];
        if (
          Math.abs(x - b.centerX) <= b.deckWidth / 2 + 2.5 &&
          ((z >= b.startZ - b.rampLength - 2 && z <= b.startZ + 2) ||
            (z >= b.endZ - 2 && z <= b.endZ + b.rampLength + 2))
        ) {
          return true;
        }
      }
      return false;
    };

    for (let i = 0; i < npcCount; i++) {
      // Spread evenly around the track loop
      const wpIdx = Math.floor((i / npcCount) * waypoints.length) % waypoints.length;
      const wp = waypoints[wpIdx];

      const roleRoll = i % 10;
      let baseMode: NPCAgent['baseMode'] = 'sidewalk_walk';
      if (roleRoll < 3) {
        baseMode = 'street_cross'; // ~30% crossing the street / walking along road edges
      } else if (roleRoll < 6) {
        baseMode = 'sidewalk_idle'; // ~30% standing/chatting/on phone on sidewalks
      } else {
        baseMode = 'sidewalk_walk'; // ~40% walking along sidewalks
      }

      const sideSign: 1 | -1 = i % 2 === 0 ? 1 : -1;
      const normalX = Math.cos(wp.heading);
      const normalZ = -Math.sin(wp.heading);

      let lateralOffset = sideSign * (roadHalfWidth + 1.9 + (i % 3) * 0.75);
      if (baseMode === 'street_cross') {
        lateralOffset = sideSign * (roadHalfWidth - 1.2 - (i % 4) * 2.1);
      }

      const spawnX = wp.position.x + normalX * lateralOffset;
      const spawnZ = wp.position.z + normalZ * lateralOffset;

      if (isUnsafeSpot(spawnX, spawnZ)) {
        // Fallback onto opposite sidewalk
        lateralOffset = -sideSign * (roadHalfWidth + 2.4);
      }

      const finalX = wp.position.x + normalX * lateralOffset;
      const finalZ = wp.position.z + normalZ * lateralOffset;
      if (isUnsafeSpot(finalX, finalZ)) continue;

      const meshParts = this.createPedestrianMesh(i);
      const heightScale = 0.92 + (i % 5) * 0.04;
      meshParts.group.scale.setScalar(heightScale);
      meshParts.group.position.set(finalX, 0.02, finalZ);

      const initialHeading =
        baseMode === 'street_cross'
          ? wp.heading + (sideSign > 0 ? -Math.PI / 2 : Math.PI / 2)
          : wp.heading + (sideSign > 0 ? 0 : Math.PI);
      meshParts.group.rotation.y = initialHeading;

      this.npcGroup.add(meshParts.group);

      this.agents.push({
        group: meshParts.group,
        leftArm: meshParts.leftArm,
        rightArm: meshParts.rightArm,
        leftLeg: meshParts.leftLeg,
        rightLeg: meshParts.rightLeg,
        headGroup: meshParts.headGroup,
        mode: baseMode,
        baseMode,
        waypointIndex: wpIdx,
        sideSign,
        lateralOffset,
        crossDirection: sideSign > 0 ? -1 : 1,
        crossPauseTimer: (i % 4) * 0.6,
        walkSpeed: 1.35 + (i % 4) * 0.25,
        walkPhase: (i * 1.1) % (Math.PI * 2),
        idleTimer: 0,
        heading: initialHeading,
        knockedVel: new THREE.Vector3(),
        knockedTimer: 0,
        heightScale,
      });
    }
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    playerSpeedKmh: number,
    waypoints: TrackWaypoint[],
    roadHalfWidth: number
  ): { hitCount: number } {
    if (this.agents.length === 0 || waypoints.length < 2) {
      return { hitCount: 0 };
    }

    let hitCount = 0;
    const maxVisibleSq = 155 * 155;
    const animateDistSq = 110 * 110;
    const isPlayerOnGround = playerPos.y < 2.2;

    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      const dx = a.group.position.x - playerPos.x;
      const dz = a.group.position.z - playerPos.z;
      const distSq = dx * dx + dz * dz;

      a.group.visible = distSq <= maxVisibleSq;
      if (!a.group.visible) continue;
      if (distSq > animateDistSq && a.mode !== 'knocked') continue;

      // 1. Handle knocked-down / tumbling state after car bump
      if (a.mode === 'knocked') {
        a.knockedTimer -= dt;
        a.knockedVel.y -= 18 * dt;
        a.group.position.addScaledVector(a.knockedVel, dt);
        a.group.rotation.x += 5.5 * dt;
        a.group.rotation.z += 3.2 * dt;
        if (a.group.position.y < 0.2) {
          a.group.position.y = 0.2;
          a.knockedVel.y = Math.abs(a.knockedVel.y) * 0.35;
          a.knockedVel.x *= 0.84;
          a.knockedVel.z *= 0.84;
        }
        if (a.knockedTimer <= 0) {
          // Respawn cleanly onto sidewalk
          a.group.rotation.set(0, a.heading, 0);
          a.mode = a.baseMode;
          const wp = waypoints[a.waypointIndex];
          const nx = Math.cos(wp.heading);
          const nz = -Math.sin(wp.heading);
          a.lateralOffset = a.sideSign * (roadHalfWidth + 2.4);
          a.group.position.set(
            wp.position.x + nx * a.lateralOffset,
            0.02,
            wp.position.z + nz * a.lateralOffset
          );
        }
        continue;
      }

      // 2. Check collision or close danger from player car
      if (isPlayerOnGround && distSq < 2.1 * 2.1 && playerSpeedKmh > 12) {
        a.mode = 'knocked';
        a.knockedTimer = 3.2;
        CityNPCSystem._toPlayer.set(dx, 0, dz);
        if (CityNPCSystem._toPlayer.lengthSq() < 0.01) {
          CityNPCSystem._toPlayer.set(1, 0, 0);
        } else {
          CityNPCSystem._toPlayer.normalize();
        }
        const launch = Math.min(14, Math.max(5, playerSpeedKmh * 0.12));
        a.knockedVel.set(
          CityNPCSystem._toPlayer.x * launch,
          4.2 + Math.random() * 2.0,
          CityNPCSystem._toPlayer.z * launch
        );
        hitCount++;
        continue;
      }

      // Panic dodge if car speeds close by
      if (isPlayerOnGround && distSq < 12.5 * 12.5 && playerSpeedKmh > 25) {
        a.mode = 'panic';
      } else if (a.mode === 'panic' && distSq > 17 * 17) {
        a.mode = a.baseMode;
      }

      const wp = waypoints[a.waypointIndex];
      const normalX = Math.cos(wp.heading);
      const normalZ = -Math.sin(wp.heading);

      if (a.mode === 'panic') {
        // Sprint away from road centerline onto sidewalk
        const targetSideOffset =
          (a.lateralOffset >= 0 ? 1 : -1) * (roadHalfWidth + 3.6);
        const dirSign = targetSideOffset > a.lateralOffset ? 1 : -1;
        a.lateralOffset += dirSign * 4.8 * dt;

        // Also flee away from car
        CityNPCSystem._toPlayer.set(dx, 0, dz).normalize();
        const fleeX = normalX * dirSign * 3.8 + CityNPCSystem._toPlayer.x * 1.6;
        const fleeZ = normalZ * dirSign * 3.8 + CityNPCSystem._toPlayer.z * 1.6;
        a.group.position.x += fleeX * dt;
        a.group.position.z += fleeZ * dt;
        a.heading = Math.atan2(fleeX, fleeZ);
        a.group.rotation.y = a.heading;

        // Fast sprint limb swing + raised arms
        a.walkPhase += dt * 14;
        const swing = Math.sin(a.walkPhase) * 0.85;
        a.leftLeg.rotation.x = swing;
        a.rightLeg.rotation.x = -swing;
        a.leftArm.rotation.x = -2.2 + swing * 0.3;
        a.rightArm.rotation.x = -2.2 - swing * 0.3;
        a.group.position.y = 0.02 + Math.abs(Math.sin(a.walkPhase)) * 0.08;
        continue;
      }

      if (a.mode === 'sidewalk_idle') {
        a.idleTimer += dt;
        a.leftLeg.rotation.x = THREE.MathUtils.damp(a.leftLeg.rotation.x, 0, 8, dt);
        a.rightLeg.rotation.x = THREE.MathUtils.damp(a.rightLeg.rotation.x, 0, 8, dt);
        a.leftArm.rotation.x = THREE.MathUtils.damp(a.leftArm.rotation.x, 0, 8, dt);
        a.rightArm.rotation.x = THREE.MathUtils.damp(a.rightArm.rotation.x, -0.35, 8, dt);
        a.headGroup.rotation.y = Math.sin(a.idleTimer * 1.2) * 0.35;
        a.group.position.y = 0.02;
        continue;
      }

      if (a.mode === 'street_cross') {
        if (a.crossPauseTimer > 0) {
          a.crossPauseTimer -= dt;
          a.leftLeg.rotation.x = THREE.MathUtils.damp(a.leftLeg.rotation.x, 0, 8, dt);
          a.rightLeg.rotation.x = THREE.MathUtils.damp(a.rightLeg.rotation.x, 0, 8, dt);
          a.leftArm.rotation.x = THREE.MathUtils.damp(a.leftArm.rotation.x, 0, 8, dt);
          a.rightArm.rotation.x = THREE.MathUtils.damp(a.rightArm.rotation.x, 0, 8, dt);
          a.headGroup.rotation.y = Math.sin(performance.now() * 0.003) * 0.45;
          continue;
        }

        const crossLimit = roadHalfWidth + 2.4;
        a.lateralOffset += a.crossDirection * (a.walkSpeed * 1.15) * dt;
        if (a.lateralOffset >= crossLimit) {
          a.lateralOffset = crossLimit;
          a.crossDirection = -1;
          a.crossPauseTimer = 1.8;
        } else if (a.lateralOffset <= -crossLimit) {
          a.lateralOffset = -crossLimit;
          a.crossDirection = 1;
          a.crossPauseTimer = 1.8;
        }

        const targetX = wp.position.x + normalX * a.lateralOffset;
        const targetZ = wp.position.z + normalZ * a.lateralOffset;
        CityNPCSystem._moveDir.set(targetX - a.group.position.x, 0, targetZ - a.group.position.z);
        a.group.position.x = targetX;
        a.group.position.z = targetZ;

        if (CityNPCSystem._moveDir.lengthSq() > 0.0001) {
          a.heading = Math.atan2(CityNPCSystem._moveDir.x, CityNPCSystem._moveDir.z);
          a.group.rotation.y = a.heading;
        }

        this.animateWalkCycle(a, dt, 1.15);
        continue;
      }

      // Default: sidewalk_walk (walks steadily along sidewalk waypoints)
      const dirStep = a.sideSign > 0 ? 1 : -1;
      const nextIdx = (a.waypointIndex + dirStep + waypoints.length) % waypoints.length;
      const nextWp = waypoints[nextIdx];
      const nextNX = Math.cos(nextWp.heading);
      const nextNZ = -Math.sin(nextWp.heading);

      CityNPCSystem._nextPos.set(
        nextWp.position.x + nextNX * a.lateralOffset,
        0.02,
        nextWp.position.z + nextNZ * a.lateralOffset
      );

      CityNPCSystem._moveDir.subVectors(CityNPCSystem._nextPos, a.group.position);
      CityNPCSystem._moveDir.y = 0;
      const stepDist = CityNPCSystem._moveDir.length();

      if (stepDist < 1.2) {
        a.waypointIndex = nextIdx;
      } else {
        CityNPCSystem._moveDir.divideScalar(stepDist);
        a.group.position.addScaledVector(CityNPCSystem._moveDir, a.walkSpeed * dt);
        a.heading = Math.atan2(CityNPCSystem._moveDir.x, CityNPCSystem._moveDir.z);
        a.group.rotation.y = a.heading;
      }

      this.animateWalkCycle(a, dt, 1.0);
    }

    return { hitCount };
  }

  private animateWalkCycle(a: NPCAgent, dt: number, speedMult: number) {
    a.walkPhase += dt * 7.2 * speedMult;
    const swing = Math.sin(a.walkPhase) * 0.55;
    a.leftLeg.rotation.x = swing;
    a.rightLeg.rotation.x = -swing;
    a.leftArm.rotation.x = -swing * 0.75;
    a.rightArm.rotation.x = swing * 0.75;
    a.headGroup.rotation.y = 0;
    a.group.position.y = 0.02 + Math.abs(Math.sin(a.walkPhase)) * 0.035;
  }

  public dispose() {
    this.clear();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.geometries = [];
    this.materials = [];
  }
}
