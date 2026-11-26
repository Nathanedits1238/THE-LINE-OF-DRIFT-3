import * as THREE from 'three';
import { TrackWaypoint } from '../city/CityGenerator';

export interface PayAndSprayStation {
  id: number;
  name: string;
  position: THREE.Vector3;
  group: THREE.Group;
  holoRing: THREE.Mesh;
  cooldownSec: number;
}

export interface ContrabandStash {
  id: number;
  label: string;
  position: THREE.Vector3;
  group: THREE.Group;
  caseGroup: THREE.Group;
  collected: boolean;
}

export interface SpeedTrapGate {
  id: number;
  name: string;
  position: THREE.Vector3;
  heading: number;
  group: THREE.Group;
  beaconMesh: THREE.Mesh;
  cooldownSec: number;
}

export interface OpenWorldHudState {
  districtName: string;
  stashesCollected: number;
  stashesTotal: number;
  nearestPaySprayMeters: number;
  sessionEscapes: number;
  wantedHeat: number;
}

export interface OpenWorldUpdateEvents {
  payAndSprayTriggered?: PayAndSprayStation;
  stashCollected?: ContrabandStash;
  allStashesCompleted?: boolean;
  speedTrapHit?: { gate: SpeedTrapGate; speedKmh: number; rewardCash: number };
  escalateToHeat?: number;
  hudState: OpenWorldHudState;
}

const _tmpVec = new THREE.Vector3();

export class OpenWorldManager {
  public scene: THREE.Scene;
  public rootGroup: THREE.Group = new THREE.Group();
  public payAndSprays: PayAndSprayStation[] = [];
  public stashes: ContrabandStash[] = [];
  public speedTraps: SpeedTrapGate[] = [];

  public active: boolean = false;
  public trackId: string = 'track_city';
  public stashesCollected: number = 0;
  public sessionEscapes: number = 0;
  public chaseDurationSec: number = 0;
  public chaosPoints: number = 0;
  private animTime: number = 0;
  private sharedMaterials: THREE.Material[] = [];
  private sharedGeometries: THREE.BufferGeometry[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.rootGroup.visible = false;
    this.scene.add(this.rootGroup);
  }

  public clear() {
    this.active = false;
    this.rootGroup.visible = false;
    while (this.rootGroup.children.length > 0) {
      this.rootGroup.remove(this.rootGroup.children[0]);
    }
    for (const g of this.sharedGeometries) g.dispose();
    for (const m of this.sharedMaterials) m.dispose();
    this.sharedGeometries = [];
    this.sharedMaterials = [];
    this.payAndSprays = [];
    this.stashes = [];
    this.speedTraps = [];
    this.stashesCollected = 0;
    this.sessionEscapes = 0;
    this.chaseDurationSec = 0;
    this.chaosPoints = 0;
  }

  public populateForTrack(
    trackId: string,
    waypoints: TrackWaypoint[],
    colliders: { minX: number; maxX: number; minZ: number; maxZ: number }[],
    getRoadElevation: (pos: THREE.Vector3, currentY?: number) => number
  ) {
    this.clear();
    this.active = true;
    this.trackId = trackId;
    this.rootGroup.visible = true;

    if (waypoints.length === 0) return;

    // 1. Place 3 Pay & Spray Garages evenly around the city/map (pulled slightly to road shoulder)
    const payNames = [
      'Pay & Spray · Centro Sul',
      'Pay & Spray · Distrito Leste',
      'Pay & Spray · Zona Oeste',
    ];
    const payFractions = [0.12, 0.48, 0.82];
    for (let i = 0; i < payFractions.length; i++) {
      const wpIdx = Math.floor(waypoints.length * payFractions[i]) % waypoints.length;
      const wp = waypoints[wpIdx];
      const rightX = Math.cos(wp.heading);
      const rightZ = -Math.sin(wp.heading);

      // Offset 12.5m to the outer shoulder; fall back to centerline if blocked by building
      const candidate = new THREE.Vector3(
        wp.position.x + rightX * 12.5,
        0,
        wp.position.z + rightZ * 12.5
      );
      if (this.isInsideCollider(candidate, colliders, 5.0)) {
        candidate.copy(wp.position);
      }
      candidate.y = getRoadElevation(candidate, 0);

      const station = this.createPayAndSprayMesh(i + 1, payNames[i], candidate, wp.heading);
      this.payAndSprays.push(station);
      this.rootGroup.add(station.group);
    }

    // 2. Place 4 GTA Speed Trap Radars on high-speed straights
    const trapFractions = [0.05, 0.30, 0.62, 0.90];
    const trapNames = ['Radar Viaduto', 'Radar Avenida Leste', 'Radar Orla Sul', 'Radar Expresso Oeste'];
    for (let i = 0; i < trapFractions.length; i++) {
      const wpIdx = Math.floor(waypoints.length * trapFractions[i]) % waypoints.length;
      const wp = waypoints[wpIdx];
      const pos = wp.position.clone();
      pos.y = getRoadElevation(pos, 0);
      const trap = this.createSpeedTrapMesh(i + 1, trapNames[i], pos, wp.heading);
      this.speedTraps.push(trap);
      this.rootGroup.add(trap.group);
    }

    // 3. Place 10 Contraband Stashes across alleys, plazas, and exploration corners
    const stashSeeds: Array<{ x: number; z: number; label: string }> =
      trackId === 'track_city'
        ? [
            { x: 117, z: -117, label: 'Beco Corporativo Norte' },
            { x: -117, z: -117, label: 'Praça da Torre Oeste' },
            { x: 117, z: 117, label: 'Galeria Neon Leste' },
            { x: -117, z: 117, label: 'Pátio Subterrâneo Sul' },
            { x: 0, z: -40, label: 'Sob o Viaduto Central' },
            { x: 0, z: 95, label: 'Cruzamento da Sé' },
            { x: 195, z: 0, label: 'Alameda dos Bancos' },
            { x: -195, z: 0, label: 'Distrito Residencial Oeste' },
            { x: 295, z: -155, label: 'Mirante da Rodovia Leste' },
            { x: -295, z: 165, label: 'Terminal Sul de Drift' },
          ]
        : this.buildFallbackStashesFromWaypoints(waypoints);

    for (let i = 0; i < stashSeeds.length; i++) {
      const seed = stashSeeds[i];
      const pos = new THREE.Vector3(seed.x, 0, seed.z);
      this.nudgeOutOfColliders(pos, colliders, 4.0);
      pos.y = getRoadElevation(pos, 0);
      const stash = this.createStashMesh(i + 1, seed.label, pos);
      this.stashes.push(stash);
      this.rootGroup.add(stash.group);
    }
  }

  private buildFallbackStashesFromWaypoints(
    waypoints: TrackWaypoint[]
  ): Array<{ x: number; z: number; label: string }> {
    const res: Array<{ x: number; z: number; label: string }> = [];
    for (let i = 0; i < 10; i++) {
      const idx = Math.floor((waypoints.length * (i + 0.5)) / 10) % waypoints.length;
      const wp = waypoints[idx];
      const side = i % 2 === 0 ? 1 : -1;
      const rightX = Math.cos(wp.heading) * side;
      const rightZ = -Math.sin(wp.heading) * side;
      res.push({
        x: wp.position.x + rightX * (18 + (i % 3) * 8),
        z: wp.position.z + rightZ * (18 + (i % 3) * 8),
        label: `Setor Clandestino #${i + 1}`,
      });
    }
    return res;
  }

  private isInsideCollider(
    pos: THREE.Vector3,
    colliders: { minX: number; maxX: number; minZ: number; maxZ: number }[],
    pad: number
  ): boolean {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (
        pos.x + pad > c.minX &&
        pos.x - pad < c.maxX &&
        pos.z + pad > c.minZ &&
        pos.z - pad < c.maxZ
      ) {
        return true;
      }
    }
    return false;
  }

  private nudgeOutOfColliders(
    pos: THREE.Vector3,
    colliders: { minX: number; maxX: number; minZ: number; maxZ: number }[],
    pad: number
  ) {
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i];
        if (
          pos.x + pad > c.minX &&
          pos.x - pad < c.maxX &&
          pos.z + pad > c.minZ &&
          pos.z - pad < c.maxZ
        ) {
          const dLeft = Math.abs(pos.x + pad - c.minX);
          const dRight = Math.abs(c.maxX - (pos.x - pad));
          const dTop = Math.abs(pos.z + pad - c.minZ);
          const dBottom = Math.abs(c.maxZ - (pos.z - pad));
          const minD = Math.min(dLeft, dRight, dTop, dBottom);
          if (minD === dLeft) pos.x = c.minX - pad - 1;
          else if (minD === dRight) pos.x = c.maxX + pad + 1;
          else if (minD === dTop) pos.z = c.minZ - pad - 1;
          else pos.z = c.maxZ + pad + 1;
        }
      }
    }
  }

  private createPayAndSprayMesh(
    id: number,
    name: string,
    pos: THREE.Vector3,
    heading: number
  ): PayAndSprayStation {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.rotation.y = heading;

    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x1c2536,
      metalness: 0.78,
      roughness: 0.3,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x00ff9d,
      emissive: 0x00ff88,
      emissiveIntensity: 1.6,
      roughness: 0.2,
      metalness: 0.5,
    });
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x07261f,
      roughness: 0.85,
      metalness: 0.15,
    });
    const holoMat = new THREE.MeshBasicMaterial({
      color: 0x00ff9d,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.sharedMaterials.push(steelMat, trimMat, padMat, holoMat);

    // 1. Grounded floor pad (sits slightly above y=0 without z-fighting)
    const padGeo = new THREE.BoxGeometry(8.4, 0.14, 10.2);
    const padMesh = new THREE.Mesh(padGeo, padMat);
    padMesh.position.y = 0.07;
    padMesh.receiveShadow = true;

    // 2-3. Left & Right Arch Pillars
    const pillarGeo = new THREE.BoxGeometry(0.9, 4.8, 1.1);
    const leftPillar = new THREE.Mesh(pillarGeo, steelMat);
    leftPillar.position.set(-4.0, 2.4, 0);
    leftPillar.castShadow = true;
    const rightPillar = new THREE.Mesh(pillarGeo, steelMat);
    rightPillar.position.set(4.0, 2.4, 0);
    rightPillar.castShadow = true;

    // 4. Overhead Garage Header Beam
    const headerGeo = new THREE.BoxGeometry(9.2, 1.0, 1.4);
    const headerMesh = new THREE.Mesh(headerGeo, steelMat);
    headerMesh.position.set(0, 5.1, 0);
    headerMesh.castShadow = true;

    // 5-7. Neon Portal Strips (Top + Two Vertical Columns)
    const topNeonGeo = new THREE.BoxGeometry(8.2, 0.25, 1.5);
    const topNeon = new THREE.Mesh(topNeonGeo, trimMat);
    topNeon.position.set(0, 4.55, 0);

    const sideNeonGeo = new THREE.BoxGeometry(0.2, 4.2, 1.2);
    const leftNeon = new THREE.Mesh(sideNeonGeo, trimMat);
    leftNeon.position.set(-3.55, 2.1, 0);
    const rightNeon = new THREE.Mesh(sideNeonGeo, trimMat);
    rightNeon.position.set(3.55, 2.1, 0);

    // 8. Rotating Holographic Beacon Ring
    const ringGeo = new THREE.TorusGeometry(1.15, 0.12, 12, 28);
    const holoRing = new THREE.Mesh(ringGeo, holoMat);
    holoRing.position.set(0, 2.9, 0);

    this.sharedGeometries.push(padGeo, pillarGeo, headerGeo, topNeonGeo, sideNeonGeo, ringGeo);
    group.add(padMesh, leftPillar, rightPillar, headerMesh, topNeon, leftNeon, rightNeon, holoRing);

    return {
      id,
      name,
      position: pos.clone(),
      group,
      holoRing,
      cooldownSec: 0,
    };
  }

  private createStashMesh(id: number, label: string, pos: THREE.Vector3): ContrabandStash {
    const group = new THREE.Group();
    group.position.copy(pos);

    const baseMat = new THREE.MeshStandardMaterial({
      color: 0xffd60a,
      emissive: 0xffaa00,
      emissiveIntensity: 1.4,
      roughness: 0.25,
      metalness: 0.7,
    });
    const caseMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.25,
    });
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffd60a,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.sharedMaterials.push(baseMat, caseMat, beamMat);

    // 1. Grounded floor ring
    const ringGeo = new THREE.RingGeometry(1.5, 2.1, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, baseMat);
    ring.position.y = 0.06;

    // 2. Vertical light beacon cylinder
    const beamGeo = new THREE.CylinderGeometry(0.95, 1.35, 9.5, 16, 1, true);
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 4.75;

    // 3-5. Composite floating briefcase inside beacon
    const caseGroup = new THREE.Group();
    caseGroup.position.y = 1.15;

    const bodyGeo = new THREE.BoxGeometry(1.25, 0.78, 0.42);
    const body = new THREE.Mesh(bodyGeo, caseMat);
    const stripeGeo = new THREE.BoxGeometry(1.3, 0.16, 0.46);
    const stripe = new THREE.Mesh(stripeGeo, baseMat);
    const handleGeo = new THREE.BoxGeometry(0.45, 0.16, 0.16);
    const handle = new THREE.Mesh(handleGeo, baseMat);
    handle.position.y = 0.47;

    caseGroup.add(body, stripe, handle);
    this.sharedGeometries.push(ringGeo, beamGeo, bodyGeo, stripeGeo, handleGeo);
    group.add(ring, beam, caseGroup);

    return {
      id,
      label,
      position: pos.clone(),
      group,
      caseGroup,
      collected: false,
    };
  }

  private createSpeedTrapMesh(
    id: number,
    name: string,
    pos: THREE.Vector3,
    heading: number
  ): SpeedTrapGate {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.rotation.y = heading;

    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.8,
      roughness: 0.35,
    });
    const camMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.6,
      roughness: 0.3,
    });
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });
    this.sharedMaterials.push(poleMat, camMat, beaconMat);

    // Side pole anchored outside traffic lane (+11.8m)
    const poleGeo = new THREE.CylinderGeometry(0.22, 0.28, 6.2, 10);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(11.8, 3.1, 0);

    const armGeo = new THREE.BoxGeometry(4.2, 0.26, 0.28);
    const arm = new THREE.Mesh(armGeo, poleMat);
    arm.position.set(9.8, 6.0, 0);

    const camGeo = new THREE.BoxGeometry(0.95, 0.65, 0.85);
    const camBox = new THREE.Mesh(camGeo, camMat);
    camBox.position.set(8.0, 5.75, 0);

    const beaconGeo = new THREE.BoxGeometry(0.8, 0.24, 0.9);
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    beaconMesh.position.set(8.0, 6.2, 0);

    this.sharedGeometries.push(poleGeo, armGeo, camGeo, beaconGeo);
    group.add(pole, arm, camBox, beaconMesh);

    return {
      id,
      name,
      position: pos.clone(),
      heading,
      group,
      beaconMesh,
      cooldownSec: 0,
    };
  }

  public getDistrictName(pos: THREE.Vector3): string {
    if (this.trackId === 'track_coast') {
      if (pos.x > 100) return 'Praia · The Jounnte';
      if (pos.x < -100) return 'The Lained · Orla Sul';
      return 'Rodovia da Praia · The Jounnte';
    }
    if (this.trackId === 'track_docks') {
      if (pos.z > 0) return 'Bairro Industrial · Porto Sul';
      return 'The Jounnte · Zona Portuária';
    }
    if (this.trackId === 'track_desert') {
      if (pos.y > 4 || Math.abs(pos.x) > 170) return 'Zona de Perigo · The Laymed';
      if (pos.z < 0) return 'Bairros Pequenos · The Laymed';
      return 'Vales de Areia · The Laymed';
    }
    if (this.trackId === 'track_suburb' || this.trackId === 'track_alpine') {
      if (pos.x < -110) return 'Fronteira Principal (The Jounnte)';
      if (pos.z < -120) return 'Avenida Principal · The Chamed';
      if (pos.z > 130 && pos.x > 0) return 'Bairro Industrial · The Chamed';
      if (pos.z > 80) return 'Bairro Residencial · The Chamed';
      return 'Floresta de Árvores · The Chamed';
    }
    if (this.trackId === 'track_san_bernard') {
      if (Math.hypot(pos.x, pos.z) < 75) return 'Praça Central · The San Bernard';
      if (pos.z < -80) return 'Vila Norte · The San Bernard';
      if (pos.z > 100) return 'Distrito Sul · The San Bernard';
      return 'Cidade The San Bernard';
    }

    // The Jounnte (Cidade) — Bairro Comercial, Residencial, Industrial, Praia & The Lained
    if (Math.abs(pos.x) < 28 && Math.abs(pos.z) < 245 && pos.y > 3.5) {
      return 'Viaduto Central · The Jounnte';
    }
    if (pos.x >= 68 && pos.x <= 158 && pos.z >= 26 && pos.z <= 86) {
      return 'La Casa de Hermanos · The Lained';
    }
    if (pos.z < -110) {
      return 'Bairro Comercial · The Jounnte';
    }
    if (pos.x > 95 && pos.z >= 100) {
      return 'Praia · The Jounnte';
    }
    if (pos.x >= 70 && pos.z >= -110 && pos.z < 100) {
      return 'The Lained · The Jounnte';
    }
    if (pos.z >= 100) {
      return 'Bairro Industrial · The Jounnte';
    }
    return 'Bairro Residencial · The Jounnte';
  }

  public registerChaos(amount: number, currentHeat: number): number | undefined {
    this.chaosPoints += amount;
    if (currentHeat === 0 && this.chaosPoints >= 1) {
      return 1;
    }
    if (currentHeat === 1 && this.chaosPoints >= 3) {
      return 2;
    }
    if (currentHeat === 2 && this.chaosPoints >= 6) {
      return 3;
    }
    if (currentHeat === 3 && this.chaosPoints >= 10) {
      return 4;
    }
    if (currentHeat === 4 && this.chaosPoints >= 15) {
      return 5;
    }
    return undefined;
  }

  public onEscaped(escapedHeat: number) {
    this.sessionEscapes++;
    this.chaseDurationSec = 0;
    this.chaosPoints = Math.max(0, escapedHeat - 1);
  }

  public resetAfterBusted() {
    this.chaseDurationSec = 0;
    this.chaosPoints = 0;
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    playerSpeedKmh: number,
    currentHeat: number
  ): OpenWorldUpdateEvents {
    this.animTime += dt;

    const events: OpenWorldUpdateEvents = {
      hudState: {
        districtName: this.getDistrictName(playerPos),
        stashesCollected: this.stashesCollected,
        stashesTotal: this.stashes.length,
        nearestPaySprayMeters: 9999,
        sessionEscapes: this.sessionEscapes,
        wantedHeat: currentHeat,
      },
    };

    // 1. Animate & check Pay & Spray stations
    for (let i = 0; i < this.payAndSprays.length; i++) {
      const ps = this.payAndSprays[i];
      ps.holoRing.rotation.y += dt * 1.8;
      ps.holoRing.position.y = 2.85 + Math.sin(this.animTime * 2.5 + i) * 0.2;
      if (ps.cooldownSec > 0) {
        ps.cooldownSec = Math.max(0, ps.cooldownSec - dt);
      }

      const dist = _tmpVec.subVectors(playerPos, ps.position).length();
      if (dist < events.hudState.nearestPaySprayMeters) {
        events.hudState.nearestPaySprayMeters = Math.round(dist);
      }

      if (dist < 6.2 && ps.cooldownSec <= 0 && !events.payAndSprayTriggered) {
        ps.cooldownSec = 14;
        this.chaseDurationSec = 0;
        this.chaosPoints = 0;
        events.payAndSprayTriggered = ps;
      }
    }

    // 2. Animate & check Contraband Stashes
    for (let i = 0; i < this.stashes.length; i++) {
      const st = this.stashes[i];
      if (st.collected) continue;
      st.caseGroup.rotation.y += dt * 2.1;
      st.caseGroup.position.y = 1.15 + Math.sin(this.animTime * 3.0 + i) * 0.22;

      const dist = _tmpVec.subVectors(playerPos, st.position).length();
      if (dist < 4.5) {
        st.collected = true;
        st.group.visible = false;
        this.stashesCollected++;
        events.stashCollected = st;
        events.hudState.stashesCollected = this.stashesCollected;
        if (this.stashesCollected >= this.stashes.length) {
          events.allStashesCompleted = true;
        }
        const esc = this.registerChaos(0.5, currentHeat);
        if (esc && (!events.escalateToHeat || esc > events.escalateToHeat)) {
          events.escalateToHeat = esc;
        }
        break;
      }
    }

    // 3. Check Speed Traps
    for (let i = 0; i < this.speedTraps.length; i++) {
      const trap = this.speedTraps[i];
      if (trap.cooldownSec > 0) {
        trap.cooldownSec = Math.max(0, trap.cooldownSec - dt);
        continue;
      }
      const dist = _tmpVec.subVectors(playerPos, trap.position).length();
      if (dist < 13.5 && playerSpeedKmh >= 135) {
        trap.cooldownSec = 18;
        const rewardCash = Math.min(2400, Math.round((playerSpeedKmh - 100) * 14));
        events.speedTrapHit = {
          gate: trap,
          speedKmh: Math.round(playerSpeedKmh),
          rewardCash,
        };
        if (playerSpeedKmh >= 162) {
          const esc = this.registerChaos(1.2, currentHeat);
          if (esc && (!events.escalateToHeat || esc > events.escalateToHeat)) {
            events.escalateToHeat = esc;
          }
        }
        break;
      }
    }

    // 4. Natural GTA Wanted Level Escalation during intense chases
    if (currentHeat > 0) {
      this.chaseDurationSec += dt;
      if (currentHeat === 1 && this.chaseDurationSec > 24) {
        events.escalateToHeat = Math.max(events.escalateToHeat || 0, 2);
      } else if (currentHeat === 2 && this.chaseDurationSec > 52) {
        events.escalateToHeat = Math.max(events.escalateToHeat || 0, 3);
      } else if (currentHeat === 3 && this.chaseDurationSec > 85) {
        events.escalateToHeat = Math.max(events.escalateToHeat || 0, 4);
      } else if (currentHeat === 4 && this.chaseDurationSec > 125) {
        events.escalateToHeat = Math.max(events.escalateToHeat || 0, 5);
      }
    } else {
      this.chaseDurationSec = 0;
    }

    return events;
  }

  public dispose() {
    this.clear();
    this.scene.remove(this.rootGroup);
  }
}
