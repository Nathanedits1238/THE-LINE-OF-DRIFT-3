import * as THREE from 'three';
import { sound } from '../audio/SoundEffects';

export type DestructiblePropType = 'tree' | 'traffic_light' | 'lamp_post';

export interface DestructiblePropInstance {
  id: number;
  type: DestructiblePropType;
  group: THREE.Group;
  initialPos: THREE.Vector3;
  initialHeading: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  angularVelocity: THREE.Vector3;
  isBroken: boolean;
  brokenTimer: number;
  lightSource?: THREE.PointLight;
  radius: number;
  pointsReward: number;
  cashReward: number;
  label: string;
}

export interface PropImpactResult {
  hit: boolean;
  prop?: DestructiblePropInstance;
  rewardPoints: number;
  rewardCash: number;
  toastText: string;
}

export class DestructiblePropSystem {
  public scene: THREE.Scene;
  public rootGroup: THREE.Group = new THREE.Group();
  public props: DestructiblePropInstance[] = [];

  // Particle debris burst pool
  private debrisPoints: THREE.Points | null = null;
  private debrisPositions: Float32Array = new Float32Array(0);
  private debrisVelocities: Float32Array = new Float32Array(0);
  private debrisLifetimes: Float32Array = new Float32Array(0);
  private activeDebrisCount: number = 0;
  private maxDebris: number = 180;

  // Shared Geometries and Materials for high performance
  private sharedGeometries: THREE.BufferGeometry[] = [];
  private sharedMaterials: THREE.Material[] = [];

  // Materials
  private woodBarkMat!: THREE.MeshStandardMaterial;
  private foliageMat1!: THREE.MeshStandardMaterial;
  private foliageMat2!: THREE.MeshStandardMaterial;
  private foliageMat3!: THREE.MeshStandardMaterial;
  private metalPoleMat!: THREE.MeshStandardMaterial;
  private yellowMetalMat!: THREE.MeshStandardMaterial;
  private signalHousingMat!: THREE.MeshStandardMaterial;
  private redLightMat!: THREE.MeshBasicMaterial;
  private yellowLightMat!: THREE.MeshBasicMaterial;
  private greenLightMat!: THREE.MeshBasicMaterial;
  private lampHeadMat!: THREE.MeshBasicMaterial;
  private currentLightScale: number = 1.0;

  private static readonly _carToProp = new THREE.Vector3();
  private static readonly _reboundImpulse = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.scene.add(this.rootGroup);
    this.initSharedAssets();
    this.initDebrisSystem();
  }

  private initSharedAssets() {
    this.woodBarkMat = new THREE.MeshStandardMaterial({
      color: 0x4a3525,
      roughness: 0.9,
      metalness: 0.05,
    });
    this.foliageMat1 = new THREE.MeshStandardMaterial({
      color: 0x2e7d32,
      roughness: 0.8,
      metalness: 0.05,
    });
    this.foliageMat2 = new THREE.MeshStandardMaterial({
      color: 0x1b5e20,
      roughness: 0.85,
      metalness: 0.05,
    });
    this.foliageMat3 = new THREE.MeshStandardMaterial({
      color: 0x388e3c,
      roughness: 0.75,
      metalness: 0.05,
    });
    this.metalPoleMat = new THREE.MeshStandardMaterial({
      color: 0x374151,
      roughness: 0.45,
      metalness: 0.8,
    });
    this.yellowMetalMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.4,
      metalness: 0.5,
    });
    this.signalHousingMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.5,
      metalness: 0.6,
    });
    this.redLightMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    this.yellowLightMat = new THREE.MeshBasicMaterial({ color: 0xffbb00 });
    this.greenLightMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    this.lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xfffae0 });

    this.sharedMaterials.push(
      this.woodBarkMat,
      this.foliageMat1,
      this.foliageMat2,
      this.foliageMat3,
      this.metalPoleMat,
      this.yellowMetalMat,
      this.signalHousingMat,
      this.redLightMat,
      this.yellowLightMat,
      this.greenLightMat,
      this.lampHeadMat
    );
  }

  private initDebrisSystem() {
    this.debrisPositions = new Float32Array(this.maxDebris * 3);
    this.debrisVelocities = new Float32Array(this.maxDebris * 3);
    this.debrisLifetimes = new Float32Array(this.maxDebris);

    for (let i = 0; i < this.maxDebris; i++) {
      this.debrisPositions[i * 3 + 1] = -999;
      this.debrisLifetimes[i] = 0;
    }

    const debrisGeo = new THREE.BufferGeometry();
    debrisGeo.setAttribute('position', new THREE.BufferAttribute(this.debrisPositions, 3));
    this.sharedGeometries.push(debrisGeo);

    const debrisMat = new THREE.PointsMaterial({
      color: 0xffdd88,
      size: 0.35,
      transparent: true,
      opacity: 0.9,
    });
    this.sharedMaterials.push(debrisMat);

    this.debrisPoints = new THREE.Points(debrisGeo, debrisMat);
    this.debrisPoints.frustumCulled = false;
    this.rootGroup.add(this.debrisPoints);
  }

  public clear() {
    for (let i = 0; i < this.props.length; i++) {
      const p = this.props[i];
      if (p.lightSource) {
        p.lightSource.removeFromParent();
        p.lightSource.dispose();
      }
      p.group.removeFromParent();
    }
    this.props = [];
    this.activeDebrisCount = 0;
  }

  // --- 1. Procedural Tree Creation (Trunk + Branches + 3-Layered Canopy) ---
  public createTree(pos: THREE.Vector3, heightScale: number = 1.0): DestructiblePropInstance {
    const group = new THREE.Group();
    group.position.copy(pos);

    // Trunk base with flare
    const trunkH = 4.2 * heightScale;
    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.42, trunkH, 10);
    trunkGeo.translate(0, trunkH / 2, 0);
    const trunk = new THREE.Mesh(trunkGeo, this.woodBarkMat);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    // Ground Planter Curb
    const planterGeo = new THREE.CylinderGeometry(1.05, 1.15, 0.28, 12);
    planterGeo.translate(0, 0.14, 0);
    const planterMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
    const planter = new THREE.Mesh(planterGeo, planterMat);
    group.add(planter);

    // 3 Foliage Puff Lobes
    const canopyMainGeo = new THREE.DodecahedronGeometry(2.1 * heightScale, 1);
    const canopyMain = new THREE.Mesh(canopyMainGeo, this.foliageMat1);
    canopyMain.position.set(0, trunkH + 1.2, 0);
    canopyMain.castShadow = true;

    const canopyUpperGeo = new THREE.IcosahedronGeometry(1.6 * heightScale, 1);
    const canopyUpper = new THREE.Mesh(canopyUpperGeo, this.foliageMat2);
    canopyUpper.position.set(0.3, trunkH + 2.7, -0.2);
    canopyUpper.castShadow = true;

    const canopySideGeo = new THREE.DodecahedronGeometry(1.4 * heightScale, 1);
    const canopySide = new THREE.Mesh(canopySideGeo, this.foliageMat3);
    canopySide.position.set(-0.8, trunkH + 1.0, 0.5);
    canopySide.castShadow = true;

    group.add(canopyMain, canopyUpper, canopySide);
    this.rootGroup.add(group);

    const instance: DestructiblePropInstance = {
      id: this.props.length + 1,
      type: 'tree',
      group,
      initialPos: pos.clone(),
      initialHeading: 0,
      position: pos.clone(),
      velocity: new THREE.Vector3(),
      rotation: new THREE.Euler(0, Math.random() * Math.PI * 2, 0),
      angularVelocity: new THREE.Vector3(),
      isBroken: false,
      brokenTimer: 0,
      radius: 1.15,
      pointsReward: 80,
      cashReward: 120,
      label: 'ÁRVORE DE RUA',
    };
    this.props.push(instance);
    return instance;
  }

  // --- 2. Procedural Traffic Light (Semáforo com braço cantilever) ---
  public createTrafficLight(pos: THREE.Vector3, heading: number): DestructiblePropInstance {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.rotation.y = heading;

    // Vertical metal mast
    const mastH = 6.8;
    const mastGeo = new THREE.CylinderGeometry(0.18, 0.26, mastH, 10);
    mastGeo.translate(0, mastH / 2, 0);
    const mast = new THREE.Mesh(mastGeo, this.metalPoleMat);
    mast.castShadow = true;
    group.add(mast);

    // Base flange
    const baseGeo = new THREE.CylinderGeometry(0.45, 0.48, 0.35, 8);
    baseGeo.translate(0, 0.175, 0);
    const base = new THREE.Mesh(baseGeo, this.yellowMetalMat);
    group.add(base);

    // Cantilever overhead arm extending over road
    const armLen = 5.2;
    const armGeo = new THREE.CylinderGeometry(0.12, 0.14, armLen, 8);
    armGeo.rotateZ(Math.PI / 2);
    armGeo.translate(armLen / 2, mastH - 0.2, 0);
    const arm = new THREE.Mesh(armGeo, this.metalPoleMat);
    group.add(arm);

    // Main Overhead Traffic Light Box
    const boxGroup = new THREE.Group();
    boxGroup.position.set(armLen - 0.8, mastH - 0.6, 0);

    const boxGeo = new THREE.BoxGeometry(0.48, 1.5, 0.38);
    const boxMesh = new THREE.Mesh(boxGeo, this.signalHousingMat);
    boxGroup.add(boxMesh);

    // Red, Yellow, Green Signal Lenses
    const lensGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.08, 12);
    lensGeo.rotateX(Math.PI / 2);

    const redLens = new THREE.Mesh(lensGeo, this.redLightMat);
    redLens.position.set(0, 0.45, 0.18);
    const yelLens = new THREE.Mesh(lensGeo, this.yellowLightMat);
    yelLens.position.set(0, 0.0, 0.18);
    const grnLens = new THREE.Mesh(lensGeo, this.greenLightMat);
    grnLens.position.set(0, -0.45, 0.18);

    boxGroup.add(redLens, yelLens, grnLens);

    // Hood visors over lenses
    for (let y = -0.45; y <= 0.45; y += 0.45) {
      const visorGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.12, 8, 1, false, 0, Math.PI);
      visorGeo.rotateX(Math.PI / 2);
      const visor = new THREE.Mesh(visorGeo, this.signalHousingMat);
      visor.position.set(0, y + 0.09, 0.2);
      boxGroup.add(visor);
    }
    group.add(boxGroup);

    // Pedestrian signal box lower down the pole
    const pedBoxGeo = new THREE.BoxGeometry(0.36, 0.72, 0.28);
    const pedBox = new THREE.Mesh(pedBoxGeo, this.signalHousingMat);
    pedBox.position.set(0, 2.6, 0.22);
    group.add(pedBox);

    this.rootGroup.add(group);

    const instance: DestructiblePropInstance = {
      id: this.props.length + 1,
      type: 'traffic_light',
      group,
      initialPos: pos.clone(),
      initialHeading: heading,
      position: pos.clone(),
      velocity: new THREE.Vector3(),
      rotation: new THREE.Euler(0, heading, 0),
      angularVelocity: new THREE.Vector3(),
      isBroken: false,
      brokenTimer: 0,
      radius: 1.1,
      pointsReward: 150,
      cashReward: 250,
      label: 'SEMÁFORO DE CRUZAMENTO',
    };
    this.props.push(instance);
    return instance;
  }

  // --- 3. Procedural Street Lamp Post (Poste de luz com haste curva e ponto de luz) ---
  public createLampPost(pos: THREE.Vector3, heading: number = 0): DestructiblePropInstance {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.rotation.y = heading;

    // Tapered column
    const mastH = 7.5;
    const mastGeo = new THREE.CylinderGeometry(0.14, 0.22, mastH, 10);
    mastGeo.translate(0, mastH / 2, 0);
    const mast = new THREE.Mesh(mastGeo, this.metalPoleMat);
    mast.castShadow = true;
    group.add(mast);

    // Curved Goose-neck Arch
    const archCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, mastH, 0),
      new THREE.Vector3(1.2, mastH + 1.2, 0),
      new THREE.Vector3(2.4, mastH + 0.6, 0)
    );
    const archGeo = new THREE.TubeGeometry(archCurve, 12, 0.1, 8, false);
    const arch = new THREE.Mesh(archGeo, this.metalPoleMat);
    group.add(arch);

    // Lamp fixture head
    const lampHeadGeo = new THREE.BoxGeometry(0.8, 0.18, 0.42);
    const lampHead = new THREE.Mesh(lampHeadGeo, this.signalHousingMat);
    lampHead.position.set(2.4, mastH + 0.55, 0);

    const lampBulbGeo = new THREE.BoxGeometry(0.72, 0.05, 0.36);
    const lampBulb = new THREE.Mesh(lampBulbGeo, this.lampHeadMat);
    lampBulb.position.set(2.4, mastH + 0.44, 0);
    group.add(lampHead, lampBulb);

    // Warm illumination point light
    const pLight = new THREE.PointLight(0xffeedd, 1.4, 38);
    pLight.position.set(pos.x + Math.cos(heading) * 2.4, mastH + 0.3, pos.z - Math.sin(heading) * 2.4);
    this.rootGroup.add(pLight);

    this.rootGroup.add(group);

    const instance: DestructiblePropInstance = {
      id: this.props.length + 1,
      type: 'lamp_post',
      group,
      initialPos: pos.clone(),
      initialHeading: heading,
      position: pos.clone(),
      velocity: new THREE.Vector3(),
      rotation: new THREE.Euler(0, heading, 0),
      angularVelocity: new THREE.Vector3(),
      isBroken: false,
      brokenTimer: 0,
      lightSource: pLight,
      radius: 0.95,
      pointsReward: 100,
      cashReward: 160,
      label: 'POSTE DE LUZ METROPOLITANO',
    };
    this.props.push(instance);
    return instance;
  }

  public addTree(x: number, z: number, heightScale: number = 1.0) {
    return this.createTree(new THREE.Vector3(x, 0, z), heightScale);
  }

  public addTrafficLight(x: number, z: number, heading: number = 0) {
    return this.createTrafficLight(new THREE.Vector3(x, 0, z), heading);
  }

  public addStreetLamp(x: number, z: number, heading: number = 0) {
    return this.createLampPost(new THREE.Vector3(x, 0, z), heading);
  }

  public getLampHeadMaterial(): THREE.MeshBasicMaterial {
    return this.lampHeadMat;
  }

  public setStreetLightScale(scale: number) {
    this.currentLightScale = scale;
    const isLit = scale > 0.02;
    for (let i = 0; i < this.props.length; i++) {
      const p = this.props[i];
      if (!p.lightSource || p.isBroken) continue;
      p.lightSource.visible = isLit;
      p.lightSource.intensity = isLit ? 1.4 * scale : 0;
    }
  }

  public checkCollision(
    playerPos: THREE.Vector3,
    playerVel: THREE.Vector3,
    speedKmh: number,
    _radius: number = 1.3
  ) {
    const res = this.checkPlayerCollision(playerPos, playerVel, speedKmh);
    return {
      hit: res.hit,
      propType: res.prop?.type,
      score: res.rewardPoints,
      toast: res.toastText,
    };
  }

  /**
   * Collision check between player vehicle and destructible props.
   * If struck at speed, the prop snaps off its base and goes FLYING with physics!
   */
  public checkPlayerCollision(
    playerPos: THREE.Vector3,
    playerVel: THREE.Vector3,
    speedKmh: number
  ): PropImpactResult {
    const minSpeedThreshold = 14; // Must be driving at least 14 km/h to smash props
    if (speedKmh < minSpeedThreshold) {
      return { hit: false, rewardPoints: 0, rewardCash: 0, toastText: '' };
    }

    for (let i = 0; i < this.props.length; i++) {
      const p = this.props[i];
      if (p.isBroken) continue;

      const dx = playerPos.x - p.position.x;
      const dz = playerPos.z - p.position.z;
      const distSq = dx * dx + dz * dz;

      const combinedRadius = p.radius + 1.25; // car half-width
      if (distSq <= combinedRadius * combinedRadius) {
        // BREAK PROP!
        p.isBroken = true;
        p.brokenTimer = 0;

        // Turn off attached lamp light
        if (p.lightSource) {
          p.lightSource.intensity = 0;
        }

        // Calculate impact speed & momentum
        const impactSpeed = Math.max(8.0, playerVel.length());
        const forwardDir = playerVel.clone().normalize();

        // Loft impulse: forward force + high upward arc + random spin
        const loftSpeedY = 7.5 + Math.random() * 8.0 + (speedKmh / 100) * 4.5;
        p.velocity.set(
          forwardDir.x * impactSpeed * 0.8 + (Math.random() - 0.5) * 6,
          loftSpeedY,
          forwardDir.z * impactSpeed * 0.8 + (Math.random() - 0.5) * 6
        );

        // High angular velocity for cartwheeling tumble in the air
        p.angularVelocity.set(
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 14
        );

        // Play realistic procedural audio
        sound.playPropCrashSound(p.type === 'tree' ? 'wood' : 'metal');

        // Spawn flying splinter / spark debris
        this.spawnDebrisBurst(p.position, p.type);

        const toastMap: Record<DestructiblePropType, string> = {
          tree: '🌳 ÁRVORE DERRUBADA! +80 PTS',
          lamp_post: '💥 POSTE DE LUZ QUEBRADO! +100 PTS',
          traffic_light: '🚦 SEMÁFORO DESTRUÍDO! +150 PTS',
        };

        return {
          hit: true,
          prop: p,
          rewardPoints: p.pointsReward,
          rewardCash: p.cashReward,
          toastText: toastMap[p.type],
        };
      }
    }

    return { hit: false, rewardPoints: 0, rewardCash: 0, toastText: '' };
  }

  /**
   * Spawns localized particle burst (wood splinters or sparks)
   */
  private spawnDebrisBurst(pos: THREE.Vector3, type: DestructiblePropType) {
    const burstCount = 18;
    for (let i = 0; i < burstCount; i++) {
      const idx = (this.activeDebrisCount + i) % this.maxDebris;
      this.debrisPositions[idx * 3] = pos.x + (Math.random() - 0.5) * 0.8;
      this.debrisPositions[idx * 3 + 1] = pos.y + 0.8 + Math.random() * 1.5;
      this.debrisPositions[idx * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.8;

      this.debrisVelocities[idx * 3] = (Math.random() - 0.5) * 12;
      this.debrisVelocities[idx * 3 + 1] = 4 + Math.random() * 9;
      this.debrisVelocities[idx * 3 + 2] = (Math.random() - 0.5) * 12;

      this.debrisLifetimes[idx] = 1.6;
    }
    this.activeDebrisCount = (this.activeDebrisCount + burstCount) % this.maxDebris;
  }

  /**
   * Physics frame update: simulates flying broken props tumbling with gravity and ground bounce.
   */
  public update(dt: number) {
    const GRAVITY = -26.0;

    for (let i = 0; i < this.props.length; i++) {
      const p = this.props[i];
      if (!p.isBroken) continue;

      p.brokenTimer += dt;

      // Flying ballistic physics
      p.velocity.y += GRAVITY * dt;
      p.position.x += p.velocity.x * dt;
      p.position.y += p.velocity.y * dt;
      p.position.z += p.velocity.z * dt;

      // Angular rotation tumble
      p.rotation.x += p.angularVelocity.x * dt;
      p.rotation.y += p.angularVelocity.y * dt;
      p.rotation.z += p.angularVelocity.z * dt;

      // Ground collision & bouncing
      if (p.position.y <= 0.15) {
        p.position.y = 0.15;
        // Restitution bounce
        p.velocity.y = -p.velocity.y * 0.35;
        // Ground friction
        p.velocity.x *= 0.65;
        p.velocity.z *= 0.65;
        p.angularVelocity.multiplyScalar(0.6);

        if (Math.abs(p.velocity.y) < 0.8) {
          p.velocity.y = 0;
        }
      }

      // Sync 3D group transform
      p.group.position.copy(p.position);
      p.group.rotation.copy(p.rotation);

      // Auto-respawn / reset prop after 45 seconds so city stays clean & fresh
      if (p.brokenTimer > 45.0) {
        this.resetProp(p);
      }
    }

    // Update Debris Particles
    if (this.debrisPoints) {
      let needsGeoUpdate = false;
      for (let i = 0; i < this.maxDebris; i++) {
        if (this.debrisLifetimes[i] > 0) {
          this.debrisLifetimes[i] -= dt;
          this.debrisVelocities[i * 3 + 1] += GRAVITY * dt;

          this.debrisPositions[i * 3] += this.debrisVelocities[i * 3] * dt;
          this.debrisPositions[i * 3 + 1] += this.debrisVelocities[i * 3 + 1] * dt;
          this.debrisPositions[i * 3 + 2] += this.debrisVelocities[i * 3 + 2] * dt;

          if (this.debrisPositions[i * 3 + 1] <= 0.05) {
            this.debrisPositions[i * 3 + 1] = 0.05;
            this.debrisVelocities[i * 3] *= 0.4;
            this.debrisVelocities[i * 3 + 2] *= 0.4;
          }

          if (this.debrisLifetimes[i] <= 0) {
            this.debrisPositions[i * 3 + 1] = -999;
          }
          needsGeoUpdate = true;
        }
      }
      if (needsGeoUpdate) {
        this.debrisPoints.geometry.attributes.position.needsUpdate = true;
      }
    }
  }

  public resetProp(p: DestructiblePropInstance) {
    p.isBroken = false;
    p.brokenTimer = 0;
    p.position.copy(p.initialPos);
    p.velocity.set(0, 0, 0);
    p.angularVelocity.set(0, 0, 0);
    p.rotation.set(0, p.initialHeading, 0);
    p.group.position.copy(p.initialPos);
    p.group.rotation.set(0, p.initialHeading, 0);
    if (p.lightSource) {
      const isLit = this.currentLightScale > 0.02;
      p.lightSource.visible = isLit;
      p.lightSource.intensity = isLit ? 1.4 * this.currentLightScale : 0;
    }
  }

  public resetAll() {
    for (let i = 0; i < this.props.length; i++) {
      this.resetProp(this.props[i]);
    }
  }

  public dispose() {
    this.clear();
    for (const g of this.sharedGeometries) g.dispose();
    for (const m of this.sharedMaterials) m.dispose();
    this.sharedGeometries = [];
    this.sharedMaterials = [];
  }
}
