import * as THREE from 'three';
import { OpenWorldTransportMode, PlayerControls } from '../types';

export interface TransportSpec {
  id: OpenWorldTransportMode;
  label: string;
  shortLabel: string;
  icon: string;
  isMotorcycle: boolean;
  isMotorized: boolean;
  maxSpeedMs: number;
  reverseMaxMs: number;
  accelForce: number;
  brakeForce: number;
  gripLateral: number;
  turnSpeed: number;
  leanMaxRad: number;
  jumpImpulse: number;
  canWheelie: boolean;
  canJump: boolean;
  collisionRadius: number;
  camDist: number;
  camHeight: number;
  lookAhead: number;
  lookHeight: number;
  enginePitchMult: number;
  gearTag: string;
}

export const OPEN_WORLD_TRANSPORTS: Record<OpenWorldTransportMode, TransportSpec> = {
  moto_street: {
    id: 'moto_street',
    label: 'Moto Streetfighter 1000',
    shortLabel: 'Moto Street',
    icon: '🏍️',
    isMotorcycle: true,
    isMotorized: true,
    maxSpeedMs: 62, // ~223 km/h
    reverseMaxMs: 5.5,
    accelForce: 26.5,
    brakeForce: 34,
    gripLateral: 17.5,
    turnSpeed: 3.1,
    leanMaxRad: 0.46,
    jumpImpulse: 0,
    canWheelie: true,
    canJump: false,
    collisionRadius: 1.05,
    camDist: 4.5,
    camHeight: 1.95,
    lookAhead: 3.8,
    lookHeight: 1.05,
    enginePitchMult: 1.55,
    gearTag: 'M',
  },
  moto_super: {
    id: 'moto_super',
    label: 'Superbike R-1200RR',
    shortLabel: 'Superbike',
    icon: '🏁',
    isMotorcycle: true,
    isMotorized: true,
    maxSpeedMs: 81, // ~292 km/h
    reverseMaxMs: 5.0,
    accelForce: 33.0,
    brakeForce: 38,
    gripLateral: 19.0,
    turnSpeed: 2.85,
    leanMaxRad: 0.54,
    jumpImpulse: 0,
    canWheelie: true,
    canJump: false,
    collisionRadius: 1.05,
    camDist: 4.7,
    camHeight: 1.85,
    lookAhead: 4.4,
    lookHeight: 1.0,
    enginePitchMult: 1.92,
    gearTag: 'R',
  },
  moto_cross: {
    id: 'moto_cross',
    label: 'Moto Trail Cross 450',
    shortLabel: 'Moto Cross',
    icon: '🏜️',
    isMotorcycle: true,
    isMotorized: true,
    maxSpeedMs: 49, // ~176 km/h
    reverseMaxMs: 6.0,
    accelForce: 24.0,
    brakeForce: 32,
    gripLateral: 18.5,
    turnSpeed: 3.35,
    leanMaxRad: 0.42,
    jumpImpulse: 6.4,
    canWheelie: true,
    canJump: true,
    collisionRadius: 1.05,
    camDist: 4.4,
    camHeight: 2.05,
    lookAhead: 3.6,
    lookHeight: 1.1,
    enginePitchMult: 1.32,
    gearTag: 'X',
  },
  car: {
    id: 'car',
    label: 'Carro da Garagem',
    shortLabel: 'Carro',
    icon: '🚗',
    isMotorcycle: false,
    isMotorized: true,
    maxSpeedMs: 65,
    reverseMaxMs: 14,
    accelForce: 18,
    brakeForce: 28,
    gripLateral: 14,
    turnSpeed: 2.4,
    leanMaxRad: 0.08,
    jumpImpulse: 0,
    canWheelie: false,
    canJump: false,
    collisionRadius: 1.85,
    camDist: 6.2,
    camHeight: 2.4,
    lookAhead: 4.0,
    lookHeight: 1.2,
    enginePitchMult: 1.0,
    gearTag: '1',
  },
  bicycle: {
    id: 'bicycle',
    label: 'Bicicleta Urbana Pro',
    shortLabel: 'Bicicleta',
    icon: '🚲',
    isMotorcycle: false,
    isMotorized: false,
    maxSpeedMs: 15.5, // ~56 km/h sprint
    reverseMaxMs: 3.5,
    accelForce: 11.5,
    brakeForce: 22,
    gripLateral: 18.0,
    turnSpeed: 3.4,
    leanMaxRad: 0.34,
    jumpImpulse: 6.8,
    canWheelie: true,
    canJump: true,
    collisionRadius: 0.72,
    camDist: 3.7,
    camHeight: 1.85,
    lookAhead: 2.6,
    lookHeight: 1.0,
    enginePitchMult: 0,
    gearTag: 'BK',
  },
  skateboard: {
    id: 'skateboard',
    label: 'Skate Street Pro',
    shortLabel: 'Skate',
    icon: '🛹',
    isMotorcycle: false,
    isMotorized: false,
    maxSpeedMs: 13.5, // ~49 km/h
    reverseMaxMs: 4.0,
    accelForce: 10.5,
    brakeForce: 18,
    gripLateral: 15.0,
    turnSpeed: 3.7,
    leanMaxRad: 0.25,
    jumpImpulse: 7.4,
    canWheelie: false,
    canJump: true,
    collisionRadius: 0.58,
    camDist: 3.5,
    camHeight: 1.75,
    lookAhead: 2.4,
    lookHeight: 0.95,
    enginePitchMult: 0,
    gearTag: 'SK',
  },
  foot: {
    id: 'foot',
    label: 'A Pé (Exploração Livre)',
    shortLabel: 'A Pé',
    icon: '🚶',
    isMotorcycle: false,
    isMotorized: false,
    maxSpeedMs: 9.8, // ~35 km/h sprint
    reverseMaxMs: 4.2,
    accelForce: 22.0,
    brakeForce: 26.0,
    gripLateral: 22.0,
    turnSpeed: 4.2,
    leanMaxRad: 0.09,
    jumpImpulse: 7.8,
    canWheelie: false,
    canJump: true,
    collisionRadius: 0.55,
    camDist: 3.4,
    camHeight: 1.85,
    lookAhead: 2.0,
    lookHeight: 1.05,
    enginePitchMult: 0,
    gearTag: 'PÉ',
  },
};

export interface ParkedStreetVehicle {
  id: string;
  mode: OpenWorldTransportMode;
  position: THREE.Vector3;
  heading: number;
  group: THREE.Group;
}

interface RigVisualParts {
  group: THREE.Group;
  chassisPivot: THREE.Group;
  frontFork?: THREE.Group;
  frontWheel?: THREE.Group;
  rearWheel?: THREE.Group;
  skateWheels?: THREE.Mesh[];
  pedalCrank?: THREE.Group;
  leftLeg?: THREE.Group;
  rightLeg?: THREE.Group;
  leftArm?: THREE.Group;
  rightArm?: THREE.Group;
  head?: THREE.Group;
  riderTorso?: THREE.Group;
  boardDeck?: THREE.Group;
}

export class OpenWorldTraversalRig {
  public scene: THREE.Scene;
  public rootGroup: THREE.Group = new THREE.Group();
  public activeMode: OpenWorldTransportMode = 'car';

  // Physics-like state for non-car modes (synced cleanly with VehiclePhysics when switching)
  public wheelieAngle: number = 0;
  public leanAngle: number = 0;
  public isWheelieActive: boolean = false;
  public trickCooldown: number = 0;
  public wheelSpin: number = 0;
  public walkCycle: number = 0;
  public skateFlipAngle: number = 0;
  private jumpLatch: boolean = false;

  // Player's parked car tracker when walking or riding another vehicle
  public hasParkedCar: boolean = false;
  public parkedCarPos: THREE.Vector3 = new THREE.Vector3();
  public parkedCarHeading: number = 0;
  private parkedCarBeacon: THREE.Group;
  private parkedBeaconRing: THREE.Mesh;

  // Ambient parked motorcycles placed at city hotspots to hop onto GTA-style
  public parkedStreetMotos: ParkedStreetVehicle[] = [];
  private parkedMotosGroup: THREE.Group = new THREE.Group();

  private rigs: Partial<Record<OpenWorldTransportMode, RigVisualParts>> = {};
  private sharedMaterials: THREE.Material[] = [];
  private sharedGeometries: THREE.BufferGeometry[] = [];
  private animTime: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.rootGroup.visible = false;
    this.scene.add(this.rootGroup);
    this.scene.add(this.parkedMotosGroup);

    // Build parked car overhead locator marker
    this.parkedCarBeacon = new THREE.Group();
    const ringGeo = new THREE.TorusGeometry(1.35, 0.08, 10, 28);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    const arrowGeo = new THREE.ConeGeometry(0.32, 0.75, 4);
    arrowGeo.rotateX(Math.PI);
    const arrowMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.88,
    });
    this.parkedBeaconRing = new THREE.Mesh(ringGeo, ringMat);
    this.parkedBeaconRing.position.y = 0.08;
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.position.y = 2.55;
    this.parkedCarBeacon.add(this.parkedBeaconRing, arrow);
    this.parkedCarBeacon.visible = false;
    this.sharedGeometries.push(ringGeo, arrowGeo);
    this.sharedMaterials.push(ringMat, arrowMat);
    this.scene.add(this.parkedCarBeacon);

    this.buildAllRigs();
  }

  private buildAllRigs() {
    this.rigs.moto_street = this.buildMotorcycleRig('moto_street');
    this.rigs.moto_super = this.buildMotorcycleRig('moto_super');
    this.rigs.moto_cross = this.buildMotorcycleRig('moto_cross');
    this.rigs.bicycle = this.buildBicycleRig();
    this.rigs.skateboard = this.buildSkateboardRig();
    this.rigs.foot = this.buildOnFootRig();

    Object.values(this.rigs).forEach((rig) => {
      if (rig) {
        rig.group.visible = false;
        this.rootGroup.add(rig.group);
      }
    });
  }

  private createMat(params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial(params);
    this.sharedMaterials.push(m);
    return m;
  }

  private trackGeo<T extends THREE.BufferGeometry>(g: T): T {
    this.sharedGeometries.push(g);
    return g;
  }

  private createWheelGroup(radius: number, width: number, rimColor: number, knobby: boolean = false): THREE.Group {
    const wheel = new THREE.Group();
    const tireMat = this.createMat({ color: 0x15171c, roughness: knobby ? 0.92 : 0.78, metalness: 0.08 });
    const rimMat = this.createMat({ color: rimColor, roughness: 0.25, metalness: 0.85 });
    const discMat = this.createMat({ color: 0x94a3b8, roughness: 0.2, metalness: 0.92 });

    const tireGeo = this.trackGeo(new THREE.TorusGeometry(radius * 0.78, radius * 0.23, 12, 24));
    tireGeo.rotateY(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;

    const rimGeo = this.trackGeo(new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, width * 0.65, 16));
    rimGeo.rotateZ(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, rimMat);

    const discGeo = this.trackGeo(new THREE.CylinderGeometry(radius * 0.42, radius * 0.42, width * 0.82, 14));
    discGeo.rotateZ(Math.PI / 2);
    const disc = new THREE.Mesh(discGeo, discMat);

    wheel.add(tire, rim, disc);
    return wheel;
  }

  private createContactShadow(radiusX: number, radiusZ: number): THREE.Mesh {
    const geo = this.trackGeo(new THREE.CircleGeometry(1, 18));
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    this.sharedMaterials.push(mat);
    const shadow = new THREE.Mesh(geo, mat);
    shadow.scale.set(radiusX, 1, radiusZ);
    shadow.position.y = 0.025;
    return shadow;
  }

  private createRiderMesh(style: 'sport' | 'street' | 'cross' | 'casual' | 'skate', primaryColor: number): {
    riderTorso: THREE.Group;
    leftArm: THREE.Group;
    rightArm: THREE.Group;
    leftLeg: THREE.Group;
    rightLeg: THREE.Group;
    head: THREE.Group;
  } {
    const jacketMat = this.createMat({ color: primaryColor, roughness: 0.52, metalness: 0.2 });
    const leatherMat = this.createMat({ color: 0x161922, roughness: 0.62, metalness: 0.15 });
    const pantsMat = this.createMat({ color: style === 'casual' || style === 'skate' ? 0x1e293b : 0x0f172a, roughness: 0.85, metalness: 0.05 });
    const shoeMat = this.createMat({ color: 0xf8fafc, roughness: 0.65, metalness: 0.1 });
    const helmetMat = this.createMat({
      color: style === 'cross' ? 0xf97316 : style === 'sport' ? 0x00f0ff : 0xe2e8f0,
      roughness: 0.18,
      metalness: 0.72,
    });
    const visorMat = this.createMat({ color: 0x090d16, roughness: 0.08, metalness: 0.92 });
    const skinMat = this.createMat({ color: 0xd9a06c, roughness: 0.68, metalness: 0.02 });

    const riderTorso = new THREE.Group();
    const torsoMesh = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.42, 0.52, 0.24)), jacketMat);
    torsoMesh.position.y = 0.26;
    torsoMesh.castShadow = true;
    const chestStripe = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.44, 0.12, 0.25)), leatherMat);
    chestStripe.position.y = 0.34;
    riderTorso.add(torsoMesh, chestStripe);

    const head = new THREE.Group();
    head.position.set(0, 0.56, 0.02);
    if (style === 'casual' || style === 'skate') {
      const headSphere = new THREE.Mesh(this.trackGeo(new THREE.SphereGeometry(0.14, 12, 12)), skinMat);
      headSphere.position.y = 0.12;
      const cap = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.15, 0.15, 0.07, 12)), jacketMat);
      cap.position.y = 0.22;
      const brim = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.22, 0.025, 0.14)), leatherMat);
      brim.position.set(0, 0.19, style === 'skate' ? -0.11 : 0.11);
      head.add(headSphere, cap, brim);
    } else {
      const helmet = new THREE.Mesh(this.trackGeo(new THREE.SphereGeometry(0.165, 14, 12)), helmetMat);
      helmet.position.y = 0.13;
      helmet.castShadow = true;
      const visor = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.22, 0.09, 0.12)), visorMat);
      visor.position.set(0, 0.13, 0.12);
      head.add(helmet, visor);
      if (style === 'cross') {
        const peak = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.22, 0.03, 0.18)), helmetMat);
        peak.position.set(0, 0.26, 0.14);
        peak.rotation.x = 0.22;
        head.add(peak);
      }
    }
    riderTorso.add(head);

    const leftArm = new THREE.Group();
    leftArm.position.set(-0.25, 0.44, 0);
    const armGeo = this.trackGeo(new THREE.CylinderGeometry(0.055, 0.05, 0.46, 8));
    const armLMesh = new THREE.Mesh(armGeo, jacketMat);
    armLMesh.position.y = -0.2;
    const gloveL = new THREE.Mesh(this.trackGeo(new THREE.SphereGeometry(0.055, 8, 8)), leatherMat);
    gloveL.position.y = -0.44;
    leftArm.add(armLMesh, gloveL);
    riderTorso.add(leftArm);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.25, 0.44, 0);
    const armRMesh = new THREE.Mesh(armGeo, jacketMat);
    armRMesh.position.y = -0.2;
    const gloveR = new THREE.Mesh(this.trackGeo(new THREE.SphereGeometry(0.055, 8, 8)), leatherMat);
    gloveR.position.y = -0.44;
    rightArm.add(armRMesh, gloveR);
    riderTorso.add(rightArm);

    const legGeo = this.trackGeo(new THREE.CylinderGeometry(0.075, 0.06, 0.56, 8));
    const shoeGeo = this.trackGeo(new THREE.BoxGeometry(0.13, 0.09, 0.23));

    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.12, 0.02, 0);
    const legLMesh = new THREE.Mesh(legGeo, pantsMat);
    legLMesh.position.y = -0.26;
    const shoeL = new THREE.Mesh(shoeGeo, shoeMat);
    shoeL.position.set(0, -0.54, 0.04);
    leftLeg.add(legLMesh, shoeL);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.12, 0.02, 0);
    const legRMesh = new THREE.Mesh(legGeo, pantsMat);
    legRMesh.position.y = -0.26;
    const shoeR = new THREE.Mesh(shoeGeo, shoeMat);
    shoeR.position.set(0, -0.54, 0.04);
    rightLeg.add(legRMesh, shoeR);

    return { riderTorso, leftArm, rightArm, leftLeg, rightLeg, head };
  }

  private buildMotorcycleRig(type: 'moto_street' | 'moto_super' | 'moto_cross'): RigVisualParts {
    const group = new THREE.Group();
    const chassisPivot = new THREE.Group();
    group.add(this.createContactShadow(0.65, 1.35));
    group.add(chassisPivot);

    const isSuper = type === 'moto_super';
    const isCross = type === 'moto_cross';

    const mainColor = isSuper ? 0xef4444 : isCross ? 0xf97316 : 0x00d2ff;
    const rimColor = isSuper ? 0xfacc15 : isCross ? 0x94a3b8 : 0x00f0ff;
    const wheelR = isCross ? 0.37 : 0.34;
    const wheelW = isSuper ? 0.24 : isCross ? 0.15 : 0.19;

    const paintMat = this.createMat({ color: mainColor, roughness: 0.2, metalness: 0.78 });
    const frameMat = this.createMat({ color: 0x1e293b, roughness: 0.45, metalness: 0.75 });
    const chromeMat = this.createMat({ color: 0xdbeafe, roughness: 0.12, metalness: 0.94 });
    const seatMat = this.createMat({ color: 0x111318, roughness: 0.85, metalness: 0.05 });
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xe0f7ff });
    const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff1e42 });
    const windscreenMat = this.createMat({
      color: 0x0f172a,
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: 0.55,
    });
    this.sharedMaterials.push(headlightMat, taillightMat);

    // 1. Rear & Front Wheels
    const rearWheel = this.createWheelGroup(wheelR, wheelW, rimColor, isCross);
    rearWheel.position.set(0, wheelR, -0.76);
    chassisPivot.add(rearWheel);

    const frontFork = new THREE.Group();
    frontFork.position.set(0, wheelR + 0.38, 0.74);
    const frontWheel = this.createWheelGroup(wheelR, wheelW * 0.78, rimColor, isCross);
    frontWheel.position.set(0, -0.38, 0.06);
    frontFork.add(frontWheel);

    // 2. Twin Front Fork Tubes + Handlebar + Headlight
    const forkLen = isCross ? 0.82 : 0.72;
    const tubeGeo = this.trackGeo(new THREE.CylinderGeometry(0.032, 0.028, forkLen, 8));
    const tubeL = new THREE.Mesh(tubeGeo, chromeMat);
    tubeL.position.set(-0.12, -0.06, 0.02);
    tubeL.rotation.x = -0.26;
    const tubeR = new THREE.Mesh(tubeGeo, chromeMat);
    tubeR.position.set(0.12, -0.06, 0.02);
    tubeR.rotation.x = -0.26;

    const barGeo = this.trackGeo(new THREE.CylinderGeometry(0.022, 0.022, isCross ? 0.78 : 0.64, 8));
    barGeo.rotateZ(Math.PI / 2);
    const handlebar = new THREE.Mesh(barGeo, frameMat);
    handlebar.position.set(0, 0.3, -0.06);

    const headlight = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(isSuper ? 0.28 : 0.2, 0.11, 0.1)),
      headlightMat
    );
    headlight.position.set(0, 0.16, 0.14);
    frontFork.add(tubeL, tubeR, handlebar, headlight);

    if (isCross) {
      const beak = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.2, 0.06, 0.42)), paintMat);
      beak.position.set(0, 0.06, 0.18);
      beak.rotation.x = -0.18;
      frontFork.add(beak);
    }
    chassisPivot.add(frontFork);

    // 3. Engine Block + Swingarm + Exhaust
    const engine = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.38, 0.36, 0.48)), frameMat);
    engine.position.set(0, wheelR + 0.14, 0.02);
    engine.castShadow = true;

    const swingarm = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.28, 0.09, 0.76)), frameMat);
    swingarm.position.set(0, wheelR + 0.02, -0.4);

    const exhaust = new THREE.Mesh(
      this.trackGeo(new THREE.CylinderGeometry(0.055, 0.065, 0.72, 10)),
      chromeMat
    );
    exhaust.rotation.x = Math.PI / 2 - 0.16;
    exhaust.position.set(0.21, isCross ? wheelR + 0.36 : wheelR + 0.08, -0.52);

    // 4. Sculpted Fuel Tank, Seat & Tail Cowl
    const tank = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(isCross ? 0.3 : 0.38, 0.24, 0.56)),
      paintMat
    );
    tank.position.set(0, wheelR + (isCross ? 0.52 : 0.46), 0.26);
    tank.rotation.x = -0.12;
    tank.castShadow = true;

    const seat = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(isCross ? 0.24 : 0.32, 0.12, 0.62)),
      seatMat
    );
    seat.position.set(0, wheelR + (isCross ? 0.49 : 0.39), -0.25);

    const tailCowl = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(0.26, 0.11, 0.45)),
      paintMat
    );
    tailCowl.position.set(0, wheelR + 0.46, -0.7);
    tailCowl.rotation.x = 0.22;

    const taillight = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(0.18, 0.06, 0.05)),
      taillightMat
    );
    taillight.position.set(0, wheelR + 0.49, -0.92);

    chassisPivot.add(engine, swingarm, exhaust, tank, seat, tailCowl, taillight);

    if (isSuper) {
      const noseFairing = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.42, 0.34, 0.52)), paintMat);
      noseFairing.position.set(0, wheelR + 0.44, 0.65);
      noseFairing.rotation.x = 0.32;
      const sideFairingL = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.06, 0.4, 0.64)), paintMat);
      sideFairingL.position.set(-0.22, wheelR + 0.24, 0.24);
      const sideFairingR = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.06, 0.4, 0.64)), paintMat);
      sideFairingR.position.set(0.22, wheelR + 0.24, 0.24);
      const shield = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.32, 0.22, 0.04)), windscreenMat);
      shield.position.set(0, wheelR + 0.68, 0.66);
      shield.rotation.x = -0.58;
      chassisPivot.add(noseFairing, sideFairingL, sideFairingR, shield);
    }

    // 5. Mounted Rider (tucked forward for Superbike, upright for Street/Cross)
    const rider = this.createRiderMesh(
      isSuper ? 'sport' : isCross ? 'cross' : 'street',
      isSuper ? 0xdc2626 : isCross ? 0xea580c : 0x0284c7
    );
    rider.riderTorso.position.set(0, wheelR + 0.46, -0.15);
    rider.riderTorso.rotation.x = isSuper ? 0.56 : isCross ? 0.22 : 0.34;
    rider.leftArm.rotation.x = -1.05;
    rider.leftArm.rotation.z = 0.14;
    rider.rightArm.rotation.x = -1.05;
    rider.rightArm.rotation.z = -0.14;

    rider.leftLeg.position.set(-0.2, wheelR + 0.42, -0.14);
    rider.leftLeg.rotation.x = -0.55;
    rider.rightLeg.position.set(0.2, wheelR + 0.42, -0.14);
    rider.rightLeg.rotation.x = -0.55;

    chassisPivot.add(rider.riderTorso, rider.leftLeg, rider.rightLeg);

    return {
      group,
      chassisPivot,
      frontFork,
      frontWheel,
      rearWheel,
      riderTorso: rider.riderTorso,
      leftArm: rider.leftArm,
      rightArm: rider.rightArm,
      leftLeg: rider.leftLeg,
      rightLeg: rider.rightLeg,
      head: rider.head,
    };
  }

  private buildBicycleRig(): RigVisualParts {
    const group = new THREE.Group();
    const chassisPivot = new THREE.Group();
    group.add(this.createContactShadow(0.45, 1.1));
    group.add(chassisPivot);

    const frameMat = this.createMat({ color: 0x22c55e, roughness: 0.28, metalness: 0.65 });
    const metalMat = this.createMat({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.85 });
    const seatMat = this.createMat({ color: 0x0f172a, roughness: 0.85, metalness: 0.05 });

    const wheelR = 0.33;
    const rearWheel = this.createWheelGroup(wheelR, 0.07, 0x94a3b8);
    rearWheel.position.set(0, wheelR, -0.56);

    const frontFork = new THREE.Group();
    frontFork.position.set(0, wheelR + 0.45, 0.54);
    const frontWheel = this.createWheelGroup(wheelR, 0.07, 0x94a3b8);
    frontWheel.position.set(0, -0.45, 0.04);

    const forkStem = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.72, 8)), metalMat);
    forkStem.position.set(0, -0.08, 0.01);
    forkStem.rotation.x = -0.22;

    const handlebar = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.018, 0.018, 0.58, 8)), metalMat);
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position.set(0, 0.28, -0.04);

    const lamp = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(0.08, 0.06, 0.07)),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    this.sharedMaterials.push(lamp.material as THREE.Material);
    lamp.position.set(0, 0.28, 0.03);
    frontFork.add(frontWheel, forkStem, handlebar, lamp);

    // Diamond bicycle frame tubes
    const topTube = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.024, 0.024, 0.74, 8)), frameMat);
    topTube.rotation.x = Math.PI / 2 - 0.08;
    topTube.position.set(0, wheelR + 0.44, 0.14);

    const downTube = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.026, 0.026, 0.8, 8)), frameMat);
    downTube.rotation.x = Math.PI / 2 + 0.58;
    downTube.position.set(0, wheelR + 0.2, 0.16);

    const seatPost = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.024, 0.024, 0.58, 8)), frameMat);
    seatPost.rotation.x = -0.2;
    seatPost.position.set(0, wheelR + 0.26, -0.14);

    const saddle = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.14, 0.06, 0.26)), seatMat);
    saddle.position.set(0, wheelR + 0.56, -0.2);

    const pedalCrank = new THREE.Group();
    pedalCrank.position.set(0, wheelR - 0.02, -0.05);
    const crankArm = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.24, 0.04, 0.04)), metalMat);
    pedalCrank.add(crankArm);

    chassisPivot.add(rearWheel, frontFork, topTube, downTube, seatPost, saddle, pedalCrank);

    // Rider
    const rider = this.createRiderMesh('casual', 0x10b981);
    rider.riderTorso.position.set(0, wheelR + 0.62, -0.14);
    rider.riderTorso.rotation.x = 0.32;
    rider.leftArm.rotation.x = -0.95;
    rider.rightArm.rotation.x = -0.95;
    rider.leftLeg.position.set(-0.15, wheelR + 0.56, -0.14);
    rider.rightLeg.position.set(0.15, wheelR + 0.56, -0.14);
    chassisPivot.add(rider.riderTorso, rider.leftLeg, rider.rightLeg);

    return {
      group,
      chassisPivot,
      frontFork,
      frontWheel,
      rearWheel,
      pedalCrank,
      riderTorso: rider.riderTorso,
      leftLeg: rider.leftLeg,
      rightLeg: rider.rightLeg,
      head: rider.head,
    };
  }

  private buildSkateboardRig(): RigVisualParts {
    const group = new THREE.Group();
    const chassisPivot = new THREE.Group();
    group.add(this.createContactShadow(0.38, 0.68));
    group.add(chassisPivot);

    const boardDeck = new THREE.Group();
    boardDeck.position.y = 0.11;

    const gripMat = this.createMat({ color: 0x111318, roughness: 0.92, metalness: 0.04 });
    const artMat = this.createMat({ color: 0xf43f5e, roughness: 0.35, metalness: 0.25 });
    const truckMat = this.createMat({ color: 0xe2e8f0, roughness: 0.25, metalness: 0.9 });
    const wheelMat = this.createMat({ color: 0x00f0ff, roughness: 0.45, metalness: 0.15 });

    const deck = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.28, 0.032, 0.96)), gripMat);
    deck.castShadow = true;
    const graphicUnder = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.26, 0.015, 0.82)), artMat);
    graphicUnder.position.y = -0.02;

    const truckGeo = this.trackGeo(new THREE.BoxGeometry(0.28, 0.04, 0.06));
    const truckF = new THREE.Mesh(truckGeo, truckMat);
    truckF.position.set(0, -0.045, 0.3);
    const truckR = new THREE.Mesh(truckGeo, truckMat);
    truckR.position.set(0, -0.045, -0.3);

    const wheelGeo = this.trackGeo(new THREE.CylinderGeometry(0.042, 0.042, 0.035, 10));
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelOffsets: Array<[number, number]> = [
      [-0.14, 0.3],
      [0.14, 0.3],
      [-0.14, -0.3],
      [0.14, -0.3],
    ];
    const skateWheels: THREE.Mesh[] = [];
    wheelOffsets.forEach(([wx, wz]) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(wx, -0.065, wz);
      skateWheels.push(w);
      boardDeck.add(w);
    });

    boardDeck.add(deck, graphicUnder, truckF, truckR);
    chassisPivot.add(boardDeck);

    // Side-stance skater rider
    const rider = this.createRiderMesh('skate', 0xf43f5e);
    rider.riderTorso.position.set(0, 0.72, 0.0);
    rider.riderTorso.rotation.y = Math.PI * 0.35; // sideways skate stance
    rider.leftArm.rotation.z = 0.55;
    rider.rightArm.rotation.z = -0.55;
    rider.leftLeg.position.set(-0.08, 0.7, 0.18);
    rider.leftLeg.rotation.x = -0.15;
    rider.rightLeg.position.set(0.08, 0.7, -0.18);
    rider.rightLeg.rotation.x = 0.15;
    chassisPivot.add(rider.riderTorso, rider.leftLeg, rider.rightLeg);

    return {
      group,
      chassisPivot,
      boardDeck,
      skateWheels,
      riderTorso: rider.riderTorso,
      leftArm: rider.leftArm,
      rightArm: rider.rightArm,
      leftLeg: rider.leftLeg,
      rightLeg: rider.rightLeg,
      head: rider.head,
    };
  }

  private buildOnFootRig(): RigVisualParts {
    const group = new THREE.Group();
    const chassisPivot = new THREE.Group();
    group.add(this.createContactShadow(0.42, 0.42));
    group.add(chassisPivot);

    const rider = this.createRiderMesh('casual', 0x00d2ff);
    rider.riderTorso.position.set(0, 0.62, 0);
    rider.leftLeg.position.set(-0.12, 0.62, 0);
    rider.rightLeg.position.set(0.12, 0.62, 0);
    chassisPivot.add(rider.riderTorso, rider.leftLeg, rider.rightLeg);

    return {
      group,
      chassisPivot,
      riderTorso: rider.riderTorso,
      leftArm: rider.leftArm,
      rightArm: rider.rightArm,
      leftLeg: rider.leftLeg,
      rightLeg: rider.rightLeg,
      head: rider.head,
    };
  }

  public setMode(mode: OpenWorldTransportMode) {
    this.activeMode = mode;
    this.wheelieAngle = 0;
    this.leanAngle = 0;
    this.skateFlipAngle = 0;
    this.isWheelieActive = false;

    const showRig = mode !== 'car';
    this.rootGroup.visible = showRig;
    Object.entries(this.rigs).forEach(([key, rig]) => {
      if (rig) {
        rig.group.visible = showRig && key === mode;
      }
    });
  }

  public markParkedCar(pos: THREE.Vector3, heading: number) {
    this.hasParkedCar = true;
    this.parkedCarPos.copy(pos);
    this.parkedCarHeading = heading;
    this.parkedCarBeacon.position.copy(pos);
    this.parkedCarBeacon.visible = true;
  }

  public clearParkedCarMarker() {
    this.hasParkedCar = false;
    this.parkedCarBeacon.visible = false;
  }

  public populateStreetMotorcycles(
    spots: Array<{ pos: THREE.Vector3; heading: number; mode: OpenWorldTransportMode }>
  ) {
    this.clearStreetMotorcycles();
    spots.forEach((spot, idx) => {
      const meshRig = this.buildMotorcycleRig(
        spot.mode === 'moto_super'
          ? 'moto_super'
          : spot.mode === 'moto_cross'
            ? 'moto_cross'
            : 'moto_street'
      );
      // Hide rider on unattended parked street bikes
      if (meshRig.riderTorso) meshRig.riderTorso.visible = false;
      if (meshRig.leftLeg) meshRig.leftLeg.visible = false;
      if (meshRig.rightLeg) meshRig.rightLeg.visible = false;
      meshRig.chassisPivot.rotation.z = 0.14; // resting on kickstand
      meshRig.group.position.copy(spot.pos);
      meshRig.group.rotation.y = spot.heading;
      this.parkedMotosGroup.add(meshRig.group);
      this.parkedStreetMotos.push({
        id: `street_moto_${idx}`,
        mode: spot.mode,
        position: spot.pos.clone(),
        heading: spot.heading,
        group: meshRig.group,
      });
    });
  }

  public clearStreetMotorcycles() {
    while (this.parkedMotosGroup.children.length > 0) {
      this.parkedMotosGroup.remove(this.parkedMotosGroup.children[0]);
    }
    this.parkedStreetMotos = [];
  }

  public findNearestMountable(pos: THREE.Vector3, maxDist: number = 5.5): {
    type: 'car' | 'moto';
    mode: OpenWorldTransportMode;
    position: THREE.Vector3;
    heading: number;
    streetMotoIndex?: number;
  } | null {
    let bestDist = maxDist;
    let result: {
      type: 'car' | 'moto';
      mode: OpenWorldTransportMode;
      position: THREE.Vector3;
      heading: number;
      streetMotoIndex?: number;
    } | null = null;

    if (this.hasParkedCar) {
      const dCar = this.parkedCarPos.distanceTo(pos);
      if (dCar <= bestDist) {
        bestDist = dCar;
        result = {
          type: 'car',
          mode: 'car',
          position: this.parkedCarPos,
          heading: this.parkedCarHeading,
        };
      }
    }

    for (let i = 0; i < this.parkedStreetMotos.length; i++) {
      const m = this.parkedStreetMotos[i];
      const d = m.position.distanceTo(pos);
      if (d <= bestDist) {
        bestDist = d;
        result = {
          type: 'moto',
          mode: m.mode,
          position: m.position,
          heading: m.heading,
          streetMotoIndex: i,
        };
      }
    }

    return result;
  }

  /**
   * Custom responsive traversal step for Moto / Bike / Skate / Foot modes.
   */
  public stepPhysics(
    dt: number,
    controls: PlayerControls,
    groundY: number,
    physics: {
      position: THREE.Vector3;
      velocity: THREE.Vector3;
      heading: number;
      angularVelocity: number;
      speedKmh: number;
      rpm: number;
      gear: number;
      driftSlip: number;
      isDrifting: boolean;
      driftScore: number;
      nitroReserve: number;
      isAirborne: boolean;
      pitch: number;
      roll: number;
      steerAngle: number;
    }
  ): { wheelieAwarded: number; jumpTriggered: boolean } {
    dt = Math.min(dt, 0.05);
    const spec = OPEN_WORLD_TRANSPORTS[this.activeMode];
    if (this.trickCooldown > 0) this.trickCooldown = Math.max(0, this.trickCooldown - dt);

    const forwardX = Math.sin(physics.heading);
    const forwardZ = Math.cos(physics.heading);
    const rightX = Math.cos(physics.heading);
    const rightZ = -Math.sin(physics.heading);

    const forwardSpeed = physics.velocity.x * forwardX + physics.velocity.z * forwardZ;
    const lateralSpeed = physics.velocity.x * rightX + physics.velocity.z * rightZ;

    // Steering responsiveness
    const targetSteer = controls.steer * 0.65;
    physics.steerAngle = THREE.MathUtils.damp(physics.steerAngle, targetSteer, 16, dt);

    // Sprint / Nitro handling
    const boostPressed = controls.nitro && (!spec.isMotorized || physics.nitroReserve > 2);
    let currentAccel = spec.accelForce;
    let effectiveMaxSpeed = spec.maxSpeedMs;
    if (boostPressed && controls.throttle > 0) {
      if (spec.isMotorized) {
        physics.nitroReserve = Math.max(0, physics.nitroReserve - dt * 24);
        currentAccel *= 1.55;
        effectiveMaxSpeed *= 1.12;
      } else {
        currentAccel *= 1.45;
        effectiveMaxSpeed *= 1.25;
      }
    } else if (spec.isMotorized) {
      physics.nitroReserve = Math.min(100, physics.nitroReserve + dt * 8);
    }

    // Longitudinal drive
    let longitudinalForce = 0;
    if (controls.throttle > 0) {
      if (forwardSpeed >= 0) {
        const ratio = Math.max(0, 1 - forwardSpeed / effectiveMaxSpeed);
        longitudinalForce += controls.throttle * currentAccel * (0.4 + 0.6 * ratio);
      } else {
        longitudinalForce += controls.throttle * spec.brakeForce;
      }
    }
    if (controls.brake > 0) {
      if (forwardSpeed > 0.6) {
        longitudinalForce -= controls.brake * spec.brakeForce;
      } else {
        const revRatio = Math.max(0, 1 - Math.abs(forwardSpeed) / spec.reverseMaxMs);
        longitudinalForce -= controls.brake * (spec.accelForce * 0.65) * revRatio;
      }
    }

    const horizSpeed = Math.hypot(physics.velocity.x, physics.velocity.z);
    const drag = (spec.isMotorized ? 0.0018 : 0.015) * horizSpeed * horizSpeed;
    const rolling = spec.id === 'foot' ? 4.5 : 1.1;
    longitudinalForce -= (drag + rolling) * Math.sign(forwardSpeed);

    // Lateral grip (motorcycles can kick tail out slightly on handbrake)
    const handbrakeDrift = spec.isMotorcycle && controls.handbrake && horizSpeed > 9;
    const latGrip = handbrakeDrift ? spec.gripLateral * 0.38 : spec.gripLateral;
    const lateralForce = -lateralSpeed * latGrip;

    const turnFactor = spec.id === 'foot' ? 1.0 : Math.min(1.0, Math.max(0.25, Math.abs(forwardSpeed) / 3.2));
    const highSpeedStability = spec.isMotorized ? 1.0 / (1.0 + Math.max(0, horizSpeed - 28) * 0.022) : 1.0;
    const dirSign = forwardSpeed < -0.6 ? -1 : 1;
    let yawTorque = -physics.steerAngle * spec.turnSpeed * turnFactor * highSpeedStability * dirSign;
    if (handbrakeDrift) yawTorque *= 1.55;

    if (Math.abs(controls.steer) < 0.01) {
      physics.angularVelocity = 0;
      yawTorque = 0;
    } else {
      physics.angularVelocity = THREE.MathUtils.damp(physics.angularVelocity, yawTorque, 16, dt);
    }

    physics.heading += physics.angularVelocity * dt;
    physics.velocity.x += (forwardX * longitudinalForce + rightX * lateralForce) * dt;
    physics.velocity.z += (forwardZ * longitudinalForce + rightZ * lateralForce) * dt;

    if (controls.throttle === 0 && controls.brake === 0 && horizSpeed < (spec.id === 'foot' ? 0.6 : 0.3)) {
      physics.velocity.x = 0;
      physics.velocity.z = 0;
    }

    physics.position.x += physics.velocity.x * dt;
    physics.position.z += physics.velocity.z * dt;

    // Jump / Ollie / Bunny-hop (Space/Drift when non-car with jump capability)
    let jumpTriggered = false;
    const jumpPressed = spec.canJump && controls.handbrake;
    if (jumpPressed && !this.jumpLatch && !physics.isAirborne && this.trickCooldown <= 0) {
      this.jumpLatch = true;
      physics.isAirborne = true;
      physics.velocity.y = spec.jumpImpulse;
      this.trickCooldown = 0.55;
      jumpTriggered = true;
      if (this.activeMode === 'skateboard') {
        this.skateFlipAngle = 0.01;
      }
    } else if (!jumpPressed) {
      this.jumpLatch = false;
    }

    // Vertical gravity & ground tracking
    const GRAVITY = -25.0;
    if (physics.position.y > groundY + 0.03 || physics.velocity.y > 0.1) {
      physics.isAirborne = true;
      physics.velocity.y += GRAVITY * dt;
      physics.position.y += physics.velocity.y * dt;
      if (physics.position.y <= groundY) {
        physics.position.y = groundY;
        physics.velocity.y = 0;
        physics.isAirborne = false;
        this.skateFlipAngle = 0;
      }
    } else {
      physics.position.y = THREE.MathUtils.damp(physics.position.y, groundY, 22, dt);
      physics.velocity.y = 0;
      physics.isAirborne = false;
    }

    // Wheelie logic for motorcycles & bicycle (Nitro or Handbrake while moving fast)
    let wheelieAwarded = 0;
    const wantsWheelie =
      spec.canWheelie &&
      controls.throttle > 0 &&
      horizSpeed > 6 &&
      !physics.isAirborne &&
      (controls.nitro || (spec.isMotorcycle && controls.handbrake));
    this.isWheelieActive = wantsWheelie;
    const targetWheelie = wantsWheelie ? (spec.isMotorcycle ? -0.34 : -0.28) : 0;
    this.wheelieAngle = THREE.MathUtils.damp(this.wheelieAngle, targetWheelie, 8, dt);

    if (wantsWheelie) {
      wheelieAwarded = Math.round(horizSpeed * dt * 16);
      physics.driftScore += wheelieAwarded;
    }

    // Lean into turns (negative rotation.z tilts bike inward when turning right)
    const leanFactor = Math.min(1, horizSpeed / 16);
    const targetLean =
      spec.id === 'foot'
        ? 0
        : -controls.steer * spec.leanMaxRad * leanFactor;
    this.leanAngle = THREE.MathUtils.damp(this.leanAngle, targetLean, 10, dt);

    physics.roll = this.leanAngle;
    physics.pitch = this.wheelieAngle;
    physics.speedKmh = Math.round(horizSpeed * 3.6);
    physics.driftSlip = handbrakeDrift ? 0.75 : Math.min(1, Math.abs(lateralSpeed) / 10);
    physics.isDrifting = handbrakeDrift || wantsWheelie;

    // Engine RPM & Gear
    if (spec.isMotorized) {
      const speedPerGear = spec.maxSpeedMs / 5.5;
      physics.gear = Math.min(6, Math.max(1, Math.floor(horizSpeed / speedPerGear) + 1));
      const inGear = (horizSpeed % speedPerGear) / speedPerGear;
      physics.rpm = THREE.MathUtils.damp(
        physics.rpm,
        0.18 + (controls.throttle > 0 ? 0.36 + inGear * 0.46 : inGear * 0.25),
        10,
        dt
      );
    } else {
      physics.gear = 1;
      physics.rpm = Math.min(1, horizSpeed / spec.maxSpeedMs);
    }

    return { wheelieAwarded, jumpTriggered };
  }

  public updateVisuals(
    dt: number,
    pos: THREE.Vector3,
    heading: number,
    speedKmh: number,
    steerAngle: number,
    isAirborne: boolean
  ) {
    this.animTime += dt;
    if (this.parkedCarBeacon.visible) {
      this.parkedBeaconRing.rotation.z += dt * 1.5;
      this.parkedBeaconRing.scale.setScalar(1 + Math.sin(this.animTime * 3) * 0.06);
    }

    if (this.activeMode === 'car') return;
    const rig = this.rigs[this.activeMode];
    if (!rig) return;

    this.rootGroup.position.copy(pos);
    this.rootGroup.rotation.set(0, heading, 0);

    const speedMs = speedKmh / 3.6;
    this.wheelSpin += speedMs * dt * 2.8;

    rig.chassisPivot.rotation.set(this.wheelieAngle, 0, this.leanAngle);

    if (rig.frontFork) {
      rig.frontFork.rotation.y = -steerAngle * 0.55;
    }
    if (rig.frontWheel) {
      rig.frontWheel.rotation.x = this.wheelSpin;
    }
    if (rig.rearWheel) {
      rig.rearWheel.rotation.x = this.wheelSpin;
    }

    // Bicycle pedaling motion
    if (this.activeMode === 'bicycle' && rig.pedalCrank && rig.leftLeg && rig.rightLeg) {
      const crankRot = this.wheelSpin * 0.85;
      rig.pedalCrank.rotation.x = crankRot;
      rig.leftLeg.rotation.x = -0.5 + Math.sin(crankRot) * 0.42;
      rig.rightLeg.rotation.x = -0.5 - Math.sin(crankRot) * 0.42;
    }

    // Skateboard wheel spin & kickflip / ollie animation
    if (this.activeMode === 'skateboard') {
      if (rig.skateWheels) {
        for (const w of rig.skateWheels) {
          w.rotation.x = this.wheelSpin * 4;
        }
      }
      if (rig.boardDeck) {
        if (isAirborne && this.skateFlipAngle > 0) {
          this.skateFlipAngle += dt * 13;
          rig.boardDeck.rotation.z = this.skateFlipAngle;
          rig.boardDeck.rotation.x = -0.22;
        } else {
          rig.boardDeck.rotation.z = THREE.MathUtils.damp(rig.boardDeck.rotation.z, 0, 14, dt);
          rig.boardDeck.rotation.x = THREE.MathUtils.damp(rig.boardDeck.rotation.x, 0, 14, dt);
        }
      }
      // Subtle push kick when moving slowly on ground
      if (rig.rightLeg && !isAirborne && speedMs > 0.5 && speedMs < 4.5) {
        rig.rightLeg.rotation.x = 0.15 + Math.sin(this.animTime * 8) * 0.35;
      } else if (rig.rightLeg) {
        rig.rightLeg.rotation.x = 0.15;
      }
    }

    // On-foot running/walking cycle
    if (this.activeMode === 'foot' && rig.leftArm && rig.rightArm && rig.leftLeg && rig.rightLeg) {
      if (isAirborne) {
        rig.leftLeg.rotation.x = 0.45;
        rig.rightLeg.rotation.x = -0.45;
        rig.leftArm.rotation.x = -0.65;
        rig.rightArm.rotation.x = -0.65;
      } else if (speedMs > 0.35) {
        this.walkCycle += dt * (4.5 + speedMs * 1.35);
        const swing = Math.sin(this.walkCycle) * Math.min(0.82, 0.25 + speedMs * 0.08);
        rig.leftLeg.rotation.x = swing;
        rig.rightLeg.rotation.x = -swing;
        rig.leftArm.rotation.x = -swing * 0.85;
        rig.rightArm.rotation.x = swing * 0.85;
        if (rig.riderTorso) {
          rig.riderTorso.rotation.x = Math.min(0.28, speedMs * 0.025);
        }
      } else {
        rig.leftLeg.rotation.x = THREE.MathUtils.damp(rig.leftLeg.rotation.x, 0, 12, dt);
        rig.rightLeg.rotation.x = THREE.MathUtils.damp(rig.rightLeg.rotation.x, 0, 12, dt);
        rig.leftArm.rotation.x = THREE.MathUtils.damp(rig.leftArm.rotation.x, 0, 12, dt);
        rig.rightArm.rotation.x = THREE.MathUtils.damp(rig.rightArm.rotation.x, 0, 12, dt);
        if (rig.riderTorso) {
          rig.riderTorso.rotation.x = THREE.MathUtils.damp(rig.riderTorso.rotation.x, 0, 12, dt);
        }
      }
      if (rig.head) {
        rig.head.rotation.y = -steerAngle * 0.5;
      }
    }
  }

  public dispose() {
    this.clearStreetMotorcycles();
    this.scene.remove(this.rootGroup);
    this.scene.remove(this.parkedMotosGroup);
    this.scene.remove(this.parkedCarBeacon);
    for (const g of this.sharedGeometries) g.dispose();
    for (const m of this.sharedMaterials) m.dispose();
    this.sharedGeometries = [];
    this.sharedMaterials = [];
  }
}
