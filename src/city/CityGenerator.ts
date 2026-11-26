import * as THREE from 'three';
import { CullingManager } from '../graphics/CullingManager';
import { DestructiblePropSystem } from '../props/DestructibleProps';
import { GraphicsQuality, TimeOfDay, TrackConfig, WeatherType } from '../types';
import { AccessibleLocationManager } from './AccessibleLocations';

export interface TrackWaypoint {
  position: THREE.Vector3;
  heading: number;
}

export interface JumpRampDef {
  position: THREE.Vector3;
  heading: number;
  width: number;
  length: number;
  height: number;
}

export interface BridgeOverpassDef {
  centerX: number;
  startZ: number;
  endZ: number;
  deckWidth: number;
  deckHeight: number;
  rampLength: number;
}

export interface EnvironmentAcoustics {
  skyscraperDensity: number;
  bridgeAltitudeFactor: number;
  tunnelFactor: number;
  cityDensity: number;
}

export class CityGenerator {
  public scene: THREE.Scene;
  public culling: CullingManager;
  public trackGroup: THREE.Group = new THREE.Group();
  public buildingsGroup: THREE.Group = new THREE.Group();
  public propsGroup: THREE.Group = new THREE.Group();
  public colliders: { minX: number; maxX: number; minZ: number; maxZ: number }[] = [];
  public waypoints: TrackWaypoint[] = [];
  public jumpRamps: JumpRampDef[] = [];
  public bridges: BridgeOverpassDef[] = [];
  public tunnels: { minX: number; maxX: number; minZ: number; maxZ: number; maxY: number }[] = [];
  public destructibleProps: DestructiblePropSystem;
  public accessibleLocations: AccessibleLocationManager;
  private skyscraperZones: { x: number; z: number; halfW: number; halfL: number; height: number }[] = [];
  private activeTrackId: string = 'track_city';
  public roadHalfWidth: number = 11;

  // Weather & Environment Elements
  private rainMesh: THREE.Points | null = null;
  private rainPositions: Float32Array | null = null;
  private sunLight: THREE.DirectionalLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;
  private streetLights: THREE.PointLight[] = [];
  public roadMaterial: THREE.MeshStandardMaterial | null = null;

  // Zero-GC Preallocated Math Helpers
  private static readonly _colNormal = new THREE.Vector3();
  private static readonly _tempMatrix = new THREE.Matrix4();
  private static readonly _tempPos = new THREE.Vector3();
  private static readonly _tempQuat = new THREE.Quaternion();
  private static readonly _tempScale = new THREE.Vector3();
  private static readonly _tempColor = new THREE.Color();
  private static readonly _acousticsResult: EnvironmentAcoustics = {
    skyscraperDensity: 0,
    bridgeAltitudeFactor: 0,
    tunnelFactor: 0,
    cityDensity: 0.5,
  };

  constructor(scene: THREE.Scene, culling: CullingManager) {
    this.scene = scene;
    this.culling = culling;
    this.destructibleProps = new DestructiblePropSystem(this.scene);
    this.accessibleLocations = new AccessibleLocationManager(this.scene);
    this.scene.add(this.trackGroup);
    this.scene.add(this.buildingsGroup);
    this.scene.add(this.propsGroup);
  }

  public generateTrack(track: TrackConfig, quality: GraphicsQuality) {
    // Clear existing
    this.clear();
    this.activeTrackId = track.id;

    if (track.id === 'track_city') {
      this.buildNeonCity();
    } else if (track.id === 'track_coast') {
      this.buildCoastalHighway();
    } else if (track.id === 'track_docks') {
      this.buildIndustrialDocks();
    } else if (track.id === 'track_suburb') {
      this.buildSuburbanHills();
    } else {
      this.buildDesertCanyon();
    }

    this.setupRainParticles(quality);
  }

  private clear() {
    const disposeHierarchy = (group: THREE.Group) => {
      while (group.children.length > 0) {
        const obj = group.children[0];
        group.remove(obj);
        if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh || obj instanceof THREE.Points) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else if (obj.material) {
            obj.material.dispose();
          }
        }
      }
    };

    disposeHierarchy(this.trackGroup);
    disposeHierarchy(this.buildingsGroup);
    disposeHierarchy(this.propsGroup);

    this.colliders = [];
    this.waypoints = [];
    this.streetLights = [];
    this.jumpRamps = [];
    this.bridges = [];
    this.tunnels = [];
    this.skyscraperZones = [];
    this.destructibleProps.clear();
    this.culling.clear();
  }

  // --- Track 1: Metrópole Neon (Elevated Viaduct, Stunt Jump Ramps & Detailed Skyscrapers) ---
  private buildNeonCity() {
    this.roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x181a20,
      roughness: 0.75,
      metalness: 0.15,
    });

    // Main Ground Plane
    const groundGeo = new THREE.PlaneGeometry(1200, 1200);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0e1014, roughness: 0.95 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    this.trackGroup.add(ground);

    // Track loop waypoints in a large city grid with corners
    const pathPoints = [
      new THREE.Vector3(0, 0, -280),
      new THREE.Vector3(180, 0, -280),
      new THREE.Vector3(260, 0, -200),
      new THREE.Vector3(260, 0, 0),
      new THREE.Vector3(260, 0, 200),
      new THREE.Vector3(180, 0, 280),
      new THREE.Vector3(0, 0, 280),
      new THREE.Vector3(-180, 0, 280),
      new THREE.Vector3(-260, 0, 200),
      new THREE.Vector3(-260, 0, 0),
      new THREE.Vector3(-260, 0, -200),
      new THREE.Vector3(-180, 0, -280),
    ];

    const curve = new THREE.CatmullRomCurve3(pathPoints, true, 'centripetal');
    const sampled = curve.getPoints(120);

    // Generate waypoints with headings
    for (let i = 0; i < sampled.length; i++) {
      const p = sampled[i];
      const nextP = sampled[(i + 1) % sampled.length];
      const angle = Math.atan2(nextP.x - p.x, nextP.z - p.z);
      this.waypoints.push({ position: p.clone(), heading: angle });
    }

    // Concrete Sidewalk Border (Calçadas ao longo da avenida)
    const roadWidth = 22;
    this.roadHalfWidth = roadWidth / 2;
    const sidewalkGeo = new THREE.TubeGeometry(curve, 180, roadWidth / 2 + 4.8, 8, true);
    sidewalkGeo.scale(1, 0.008, 1);
    const sidewalkMat = new THREE.MeshStandardMaterial({
      color: 0x2b313d,
      roughness: 0.9,
      metalness: 0.05,
    });
    const sidewalkMesh = new THREE.Mesh(sidewalkGeo, sidewalkMat);
    sidewalkMesh.position.y = 0.0;
    sidewalkMesh.receiveShadow = true;
    this.trackGroup.add(sidewalkMesh);

    // Build Road Ribbon along the curve
    const roadGeo = new THREE.TubeGeometry(curve, 180, roadWidth / 2, 8, true);
    roadGeo.scale(1, 0.02, 1);
    const roadMesh = new THREE.Mesh(roadGeo, this.roadMaterial);
    roadMesh.position.y = 0.02;
    roadMesh.receiveShadow = true;
    this.trackGroup.add(roadMesh);

    // Center Yellow Dashed Line
    const centerLineGeo = new THREE.TubeGeometry(curve, 180, 0.35, 4, true);
    centerLineGeo.scale(1, 0.03, 1);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    const centerLine = new THREE.Mesh(centerLineGeo, lineMat);
    centerLine.position.y = 0.04;
    this.trackGroup.add(centerLine);

    // ================= 0.5 REDE DE RUAS & AVENIDAS CONECTADAS (CONNECTED STREET GRID) =================
    // Connects Central Avenue, West Avenue, East Avenue, and North/Center/South Crossways
    const streetMat = this.roadMaterial;
    const yellowStripeMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    const whiteStripeMat = new THREE.MeshBasicMaterial({ color: 0xf1f5f9 });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x2b313d, roughness: 0.9, metalness: 0.05 });

    const createStraightStreet = (
      startX: number,
      startZ: number,
      endX: number,
      endZ: number,
      width: number
    ) => {
      const len = Math.hypot(endX - startX, endZ - startZ);
      const midX = (startX + endX) / 2;
      const midZ = (startZ + endZ) / 2;
      const angle = Math.atan2(endX - startX, endZ - startZ);

      // Asphalt Road Slab
      const roadBoxGeo = new THREE.BoxGeometry(width, 0.04, len);
      const roadMesh = new THREE.Mesh(roadBoxGeo, streetMat);
      roadMesh.position.set(midX, 0.02, midZ);
      roadMesh.rotation.y = angle;
      roadMesh.receiveShadow = true;
      this.trackGroup.add(roadMesh);

      // Raised Concrete Sidewalk Curbs (+0.18m high, 3.5m wide)
      const curbGeo = new THREE.BoxGeometry(3.5, 0.18, len);
      const curbL = new THREE.Mesh(curbGeo, curbMat);
      curbL.position.set(midX + Math.cos(angle) * (width / 2 + 1.75), 0.09, midZ - Math.sin(angle) * (width / 2 + 1.75));
      curbL.rotation.y = angle;

      const curbR = new THREE.Mesh(curbGeo, curbMat);
      curbR.position.set(midX - Math.cos(angle) * (width / 2 + 1.75), 0.09, midZ + Math.sin(angle) * (width / 2 + 1.75));
      curbR.rotation.y = angle;
      this.trackGroup.add(curbL, curbR);

      // Center Yellow Dashed Line
      const stripeGeo = new THREE.PlaneGeometry(0.35, len);
      stripeGeo.rotateX(-Math.PI / 2);
      const stripe = new THREE.Mesh(stripeGeo, yellowStripeMat);
      stripe.position.set(midX, 0.045, midZ);
      stripe.rotation.y = angle;
      this.trackGroup.add(stripe);

      // Register Navigation & GPS Waypoints along this straight corridor
      const step = 25;
      for (let d = 15; d <= len - 15; d += step) {
        const t = d / len;
        const wx = startX + (endX - startX) * t;
        const wz = startZ + (endZ - startZ) * t;
        this.waypoints.push({
          position: new THREE.Vector3(wx, 0, wz),
          heading: angle,
        });
      }
    };

    // 1. Avenidas Principais (North-South)
    createStraightStreet(0, -280, 0, 280, 22); // Avenida Central (Boulevard Neon)
    createStraightStreet(-180, -280, -180, 280, 20); // Avenida Oeste (Alameda Residencial)
    createStraightStreet(180, -280, 180, 280, 20); // Avenida Leste (Distrito Financeiro)

    // 2. Ruas Transversais Conectadas (East-West)
    createStraightStreet(-260, -180, 260, -180, 20); // Rua Transversal Norte
    createStraightStreet(-260, 0, 260, 0, 20); // Rua Transversal Centro (Cruzamento da Sé)
    createStraightStreet(-260, 180, 260, 180, 20); // Rua Transversal Sul

    // 3. Cruzamentos com Faixas de Pedestres & Semáforos Destrutíveis
    const intersectionPoints = [
      { x: 0, z: -180 },
      { x: 0, z: 0 },
      { x: 0, z: 180 },
      { x: -180, z: -180 },
      { x: -180, z: 0 },
      { x: -180, z: 180 },
      { x: 180, z: -180 },
      { x: 180, z: 0 },
      { x: 180, z: 180 },
    ];

    intersectionPoints.forEach((pt) => {
      // 4-Way Crosswalk Zebra Stripes
      const cwGeo = new THREE.PlaneGeometry(1.6, 9.0);
      cwGeo.rotateX(-Math.PI / 2);

      const cwN = new THREE.Mesh(cwGeo, whiteStripeMat);
      cwN.position.set(pt.x, 0.046, pt.z - 12.0);
      const cwS = new THREE.Mesh(cwGeo, whiteStripeMat);
      cwS.position.set(pt.x, 0.046, pt.z + 12.0);

      const cwE = new THREE.Mesh(cwGeo, whiteStripeMat);
      cwE.rotation.y = Math.PI / 2;
      cwE.position.set(pt.x + 12.0, 0.046, pt.z);
      const cwW = new THREE.Mesh(cwGeo, whiteStripeMat);
      cwW.rotation.y = Math.PI / 2;
      cwW.position.set(pt.x - 12.0, 0.046, pt.z);

      this.trackGroup.add(cwN, cwS, cwE, cwW);

      // Destructible Cantilever Traffic Light at corner
      this.destructibleProps.createTrafficLight(new THREE.Vector3(pt.x + 11.5, 0, pt.z + 11.5), -Math.PI / 2);
      this.destructibleProps.createTrafficLight(new THREE.Vector3(pt.x - 11.5, 0, pt.z - 11.5), Math.PI / 2);
    });

    // 4. Árvores e Postes de Luz Destrutíveis ao longo das calçadas
    // Along Central Avenue
    for (let z = -260; z <= 260; z += 48) {
      if (Math.abs(z - (-180)) < 22 || Math.abs(z) < 22 || Math.abs(z - 180) < 22) continue;
      this.destructibleProps.createTree(new THREE.Vector3(13.2, 0, z), 0.95 + Math.random() * 0.25);
      this.destructibleProps.createTree(new THREE.Vector3(-13.2, 0, z), 0.95 + Math.random() * 0.25);
      this.destructibleProps.createLampPost(new THREE.Vector3(12.8, 0, z + 24), Math.PI);
      this.destructibleProps.createLampPost(new THREE.Vector3(-12.8, 0, z + 24), 0);
    }

    // Along West Avenue (Bairro Residencial)
    for (let z = -260; z <= 260; z += 44) {
      if (Math.abs(z - (-180)) < 22 || Math.abs(z) < 22 || Math.abs(z - 180) < 22) continue;
      this.destructibleProps.createTree(new THREE.Vector3(-180 + 12.5, 0, z), 1.05 + Math.random() * 0.2);
      this.destructibleProps.createTree(new THREE.Vector3(-180 - 12.5, 0, z), 1.05 + Math.random() * 0.2);
      this.destructibleProps.createLampPost(new THREE.Vector3(-180 + 12.0, 0, z + 22), Math.PI);
    }

    // Along East Avenue (Distrito Financeiro)
    for (let z = -260; z <= 260; z += 48) {
      if (Math.abs(z - (-180)) < 22 || Math.abs(z) < 22 || Math.abs(z - 180) < 22) continue;
      this.destructibleProps.createTree(new THREE.Vector3(180 + 12.5, 0, z), 0.9);
      this.destructibleProps.createLampPost(new THREE.Vector3(180 - 12.0, 0, z), 0);
      this.destructibleProps.createLampPost(new THREE.Vector3(180 + 12.0, 0, z + 24), Math.PI);
    }

    // ================= 1. AVENIDA ELEVADA / PONTE POR CIMA DE RUAS =================
    // High-speed elevated viaduct crossing above ground-level streets at Y = 10.5m!
    const bridgeWidth = 16;
    const bridgeDeckHeight = 10.5;
    const bridgeStartX = 0;
    const bridgeStartZ = -170;
    const bridgeEndZ = 170;
    const rampLength = 65;

    this.bridges.push({
      centerX: bridgeStartX,
      startZ: bridgeStartZ,
      endZ: bridgeEndZ,
      deckWidth: bridgeWidth,
      deckHeight: bridgeDeckHeight,
      rampLength,
    });

    const bridgeDeckGeo = new THREE.BoxGeometry(bridgeWidth, 1.2, bridgeEndZ - bridgeStartZ);
    const bridgeDeckMat = new THREE.MeshStandardMaterial({
      color: 0x1f232b,
      roughness: 0.65,
      metalness: 0.3,
    });
    const bridgeDeck = new THREE.Mesh(bridgeDeckGeo, bridgeDeckMat);
    bridgeDeck.position.set(bridgeStartX, bridgeDeckHeight - 0.6, (bridgeStartZ + bridgeEndZ) / 2);
    bridgeDeck.receiveShadow = true;
    bridgeDeck.castShadow = true;
    this.trackGroup.add(bridgeDeck);

    // Bridge Center Line
    const bridgeLineGeo = new THREE.PlaneGeometry(0.4, bridgeEndZ - bridgeStartZ);
    bridgeLineGeo.rotateX(-Math.PI / 2);
    const bridgeLine = new THREE.Mesh(bridgeLineGeo, new THREE.MeshBasicMaterial({ color: 0xffdd00 }));
    bridgeLine.position.set(bridgeStartX, bridgeDeckHeight + 0.03, (bridgeStartZ + bridgeEndZ) / 2);
    this.trackGroup.add(bridgeLine);

    // Concrete Pillars Supporting the Bridge (spaced so ground streets pass cleanly underneath)
    const pillarGeo = new THREE.CylinderGeometry(1.4, 1.6, bridgeDeckHeight, 16);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x3d434d, roughness: 0.9 });
    for (let zP = bridgeStartZ + 25; zP <= bridgeEndZ - 25; zP += 55) {
      // Left and Right pillars
      const pL = new THREE.Mesh(pillarGeo, pillarMat);
      pL.position.set(bridgeStartX - bridgeWidth * 0.42, bridgeDeckHeight / 2, zP);
      pL.castShadow = true;
      pL.receiveShadow = true;

      const pR = new THREE.Mesh(pillarGeo, pillarMat);
      pR.position.set(bridgeStartX + bridgeWidth * 0.42, bridgeDeckHeight / 2, zP);
      pR.castShadow = true;
      pR.receiveShadow = true;

      // Crossbeam
      const beamGeo = new THREE.BoxGeometry(bridgeWidth * 0.95, 1.2, 2.2);
      const beam = new THREE.Mesh(beamGeo, pillarMat);
      beam.position.set(bridgeStartX, bridgeDeckHeight - 1.2, zP);

      this.trackGroup.add(pL, pR, beam);

      // Collider for support pillars
      this.colliders.push(
        { minX: pL.position.x - 1.6, maxX: pL.position.x + 1.6, minZ: zP - 1.6, maxZ: zP + 1.6 },
        { minX: pR.position.x - 1.6, maxX: pR.position.x + 1.6, minZ: zP - 1.6, maxZ: zP + 1.6 }
      );
    }

    // Steel Guardrails on Elevated Bridge
    const railGeo = new THREE.BoxGeometry(0.35, 1.1, bridgeEndZ - bridgeStartZ);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, metalness: 0.85, roughness: 0.2 });
    const railL = new THREE.Mesh(railGeo, railMat);
    railL.position.set(bridgeStartX - bridgeWidth / 2 + 0.2, bridgeDeckHeight + 0.55, (bridgeStartZ + bridgeEndZ) / 2);
    const railR = new THREE.Mesh(railGeo, railMat);
    railR.position.set(bridgeStartX + bridgeWidth / 2 - 0.2, bridgeDeckHeight + 0.55, (bridgeStartZ + bridgeEndZ) / 2);
    this.trackGroup.add(railL, railR);

    // Sloped Approach Ramps for the Elevated Bridge
    // In Three.js right-handed rotation around +X: y' = y*cos(theta) - z*sin(theta).
    // For South ramp (z from bridgeStartZ - rampLength to bridgeStartZ):
    // z_local = -len/2 (ground entry) -> y = 0; z_local = +len/2 (bridge deck) -> y = +bridgeDeckHeight.
    // Since y' = -z_local * sin(theta), rising toward +Z requires theta < 0 (isSouth ? -1 : 1).
    // For North ramp (z from bridgeEndZ to bridgeEndZ + rampLength):
    // z_local = -len/2 (bridge deck) -> y = +bridgeDeckHeight; z_local = +len/2 (ground exit) -> y = 0.
    // Falling toward +Z requires theta > 0.
    const createBridgeRamp = (startZ: number, endZ: number, isSouth: boolean) => {
      const len = Math.abs(endZ - startZ);
      const hypLen = Math.hypot(len, bridgeDeckHeight);
      const rampGeo = new THREE.BoxGeometry(bridgeWidth, 0.8, hypLen);
      const rampMesh = new THREE.Mesh(rampGeo, bridgeDeckMat);
      const angle = Math.atan2(bridgeDeckHeight, len) * (isSouth ? -1 : 1);
      rampMesh.rotation.x = angle;
      rampMesh.position.set(bridgeStartX, bridgeDeckHeight / 2 - 0.38, (startZ + endZ) / 2);
      rampMesh.receiveShadow = true;
      this.trackGroup.add(rampMesh);

      // Yellow hazard edge markings flush on ground-level ramp entrance
      const edgeStrip = new THREE.Mesh(
        new THREE.BoxGeometry(bridgeWidth, 0.16, 1.8),
        new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.3 })
      );
      edgeStrip.rotation.x = angle;
      edgeStrip.position.set(bridgeStartX, 0.12, isSouth ? startZ + 1.1 : endZ - 1.1);
      this.trackGroup.add(edgeStrip);
    };
    createBridgeRamp(bridgeStartZ - rampLength, bridgeStartZ, true);
    createBridgeRamp(bridgeEndZ, bridgeEndZ + rampLength, false);

    // Overhead Cantilevered Highway Signs
    const createHighwaySign = (zPos: number, title: string) => {
      const signGroup = new THREE.Group();
      const gantryPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 6, 8), pillarMat);
      gantryPillar.position.set(bridgeStartX - bridgeWidth / 2 + 0.5, bridgeDeckHeight + 3, zPos);
      const gantryArm = new THREE.Mesh(new THREE.BoxGeometry(bridgeWidth * 0.8, 0.4, 0.4), pillarMat);
      gantryArm.position.set(bridgeStartX, bridgeDeckHeight + 5.5, zPos);

      const signBoard = new THREE.Mesh(
        new THREE.BoxGeometry(10, 2.2, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x008844, roughness: 0.3, metalness: 0.2 })
      );
      signBoard.position.set(bridgeStartX, bridgeDeckHeight + 5.2, zPos + 0.2);

      // Neon Sign Border
      const neonTrim = new THREE.Mesh(
        new THREE.BoxGeometry(10.2, 2.4, 0.1),
        new THREE.MeshBasicMaterial({ color: 0x00ff88 })
      );
      neonTrim.position.set(bridgeStartX, bridgeDeckHeight + 5.2, zPos + 0.1);

      signGroup.add(gantryPillar, gantryArm, neonTrim, signBoard);
      this.propsGroup.add(signGroup);
    };
    createHighwaySign(bridgeStartZ + 15, 'VIA EXPRESSA ELEVADA · SAÍDA 01');
    createHighwaySign(bridgeEndZ - 15, 'PONTE METRÓPOLE · LIMITE 160 KM/H');

    // ================= 2. RAMPAS DE SALTO ESPORTIVO (STUNT JUMP RAMPS) =================
    // Placed along high-speed straights for dramatic jumps over police and traffic
    const rampLocations: { pos: THREE.Vector3; heading: number }[] = [
      { pos: new THREE.Vector3(260, 0, -80), heading: 0 },
      { pos: new THREE.Vector3(0, 0, 280), heading: -Math.PI / 2 },
      { pos: new THREE.Vector3(-260, 0, 80), heading: Math.PI },
    ];

    rampLocations.forEach((loc) => {
      const rWidth = 10;
      const rLength = 16;
      const rHeight = 2.4;

      this.jumpRamps.push({
        position: loc.pos.clone(),
        heading: loc.heading,
        width: rWidth,
        length: rLength,
        height: rHeight,
      });

      const rampGroup = new THREE.Group();
      rampGroup.position.copy(loc.pos);
      rampGroup.rotation.y = loc.heading;

      // Sloped Ramp Mesh
      const rampGeo = new THREE.BoxGeometry(rWidth, 0.4, rLength);
      const rampAngle = Math.atan2(rHeight, rLength);
      const rampMat = new THREE.MeshStandardMaterial({
        color: 0x242830,
        roughness: 0.5,
        metalness: 0.3,
      });
      const rampMesh = new THREE.Mesh(rampGeo, rampMat);
      rampMesh.rotation.x = -rampAngle;
      rampMesh.position.set(0, rHeight / 2, rLength / 2);
      rampMesh.castShadow = true;
      rampMesh.receiveShadow = true;
      rampGroup.add(rampMesh);

      // Yellow/Black Hazard Stripes on Ramp Edge
      const hazardGeo = new THREE.BoxGeometry(rWidth, 0.45, 1.2);
      const hazardMat = new THREE.MeshStandardMaterial({
        color: 0xffcc00,
        emissive: 0x665500,
        roughness: 0.3,
      });
      const hazardStripe = new THREE.Mesh(hazardGeo, hazardMat);
      hazardStripe.rotation.x = -rampAngle;
      hazardStripe.position.set(0, rHeight - 0.2, rLength - 0.6);
      rampGroup.add(hazardStripe);

      // Neon Cyan Side Guardrail Lights
      const neonRailGeo = new THREE.BoxGeometry(0.35, 0.5, rLength);
      const neonRailMat = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00f0ff,
        emissiveIntensity: 2.5,
      });
      const neonRailL = new THREE.Mesh(neonRailGeo, neonRailMat);
      neonRailL.rotation.x = -rampAngle;
      neonRailL.position.set(-rWidth / 2 + 0.2, rHeight / 2 + 0.3, rLength / 2);
      const neonRailR = new THREE.Mesh(neonRailGeo, neonRailMat);
      neonRailR.rotation.x = -rampAngle;
      neonRailR.position.set(rWidth / 2 - 0.2, rHeight / 2 + 0.3, rLength / 2);
      rampGroup.add(neonRailL, neonRailR);

      this.propsGroup.add(rampGroup);
    });

    // ================= 3. PRÉDIOS E DETALHES COM SEGURANÇA TOTAL DA PISTA =================
    // Zero-overlap guarantee: verifies every building footprint against the entire road corridor
    const buildingColors = [0x151b24, 0x1f2633, 0x221c2e, 0x1a282f, 0x252a36];
    const neonColors = [0x00f0ff, 0xff0055, 0xffdd00, 0x00ff88, 0xaa00ff];

    interface BuildingDef {
      x: number;
      y: number;
      z: number;
      width: number;
      height: number;
      length: number;
      color: number;
      hasHelipad: boolean;
      hasAntenna: boolean;
      hasHVAC: boolean;
      sign?: { x: number; y: number; z: number; width: number; color: number };
    }

    const buildingList: BuildingDef[] = [];
    const gridExtent = 320;

    for (let x = -gridExtent; x <= gridExtent; x += 44) {
      for (let z = -gridExtent; z <= gridExtent; z += 44) {
        const bWidth = 24 + Math.random() * 14;
        const bLength = 24 + Math.random() * 14;
        const bHeight = 45 + Math.random() * 120;

        // Street Corridor Clearance: Ensure building does not encroach into road corridors
        let isSafe = true;
        // Central, West, and East Avenues
        if (Math.abs(x) < (bWidth / 2 + 15.5) && z >= -290 && z <= 290) isSafe = false;
        if (Math.abs(x - (-180)) < (bWidth / 2 + 14.5) && z >= -290 && z <= 290) isSafe = false;
        if (Math.abs(x - 180) < (bWidth / 2 + 14.5) && z >= -290 && z <= 290) isSafe = false;
        // North, Center, and South Crossways
        if (Math.abs(z - (-180)) < (bLength / 2 + 14.5) && x >= -270 && x <= 270) isSafe = false;
        if (Math.abs(z) < (bLength / 2 + 14.5) && x >= -270 && x <= 270) isSafe = false;
        if (Math.abs(z - 180) < (bLength / 2 + 14.5) && x >= -270 && x <= 270) isSafe = false;

        // Bridge viaduct clearance
        if (Math.abs(x - bridgeStartX) < (bWidth / 2 + bridgeWidth / 2 + 10) && z >= bridgeStartZ - rampLength - 10 && z <= bridgeEndZ + rampLength + 10) {
          isSafe = false;
        }

        // Accessible locations clearance (Tuning Garage, House, Diner, Observatory)
        const accessibleClearance = [
          { minX: -100, maxX: -55, minZ: 0, maxZ: 36 }, // Tuning Garage
          { minX: -210, maxX: -165, minZ: 90, maxZ: 130 }, // House
          { minX: 85, maxX: 125, minZ: -100, maxZ: -65 }, // Diner
          { minX: 52, maxX: 92, minZ: 90, maxZ: 130 }, // Observatory
        ];
        for (let a = 0; a < accessibleClearance.length; a++) {
          const ac = accessibleClearance[a];
          if (x + bWidth / 2 > ac.minX && x - bWidth / 2 < ac.maxX && z + bLength / 2 > ac.minZ && z - bLength / 2 < ac.maxZ) {
            isSafe = false;
            break;
          }
        }

        // Outer curve clearance
        if (isSafe) {
          for (let w = 0; w < Math.min(120, this.waypoints.length); w++) {
            const wp = this.waypoints[w].position;
            const clX = Math.max(x - bWidth / 2, Math.min(wp.x, x + bWidth / 2));
            const clZ = Math.max(z - bLength / 2, Math.min(wp.z, z + bLength / 2));
            if (Math.hypot(wp.x - clX, wp.z - clZ) < 16.5) {
              isSafe = false;
              break;
            }
          }
        }

        if (!isSafe) continue;

        const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];

        let signDef: BuildingDef['sign'];
        if (Math.random() > 0.35) {
          signDef = {
            x,
            y: bHeight * 0.82,
            z: z + bLength / 2 + 0.4,
            width: bWidth * 0.72,
            color: neonColors[Math.floor(Math.random() * neonColors.length)],
          };
        }

        const hasHelipad = bHeight > 95 && Math.random() > 0.45;
        const hasAntenna = bHeight > 75 && Math.random() > 0.35;
        const hasHVAC = Math.random() > 0.3;

        buildingList.push({
          x,
          y: bHeight / 2,
          z,
          width: bWidth,
          height: bHeight,
          length: bLength,
          color,
          hasHelipad,
          hasAntenna,
          hasHVAC,
          sign: signDef,
        });

        this.skyscraperZones.push({
          x,
          z,
          halfW: bWidth / 2,
          halfL: bLength / 2,
          height: bHeight,
        });

        // Fast Box Collider
        this.colliders.push({
          minX: x - bWidth / 2 - 1.2,
          maxX: x + bWidth / 2 + 1.2,
          minZ: z - bLength / 2 - 1.2,
          maxZ: z + bLength / 2 + 1.2,
        });
      }
    }

    // Instanced Skyscrapers Mesh
    const unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
    const buildingMat = new THREE.MeshStandardMaterial({
      roughness: 0.35,
      metalness: 0.75,
    });
    const buildingInstanced = new THREE.InstancedMesh(unitBoxGeo, buildingMat, buildingList.length);
    buildingInstanced.castShadow = true;
    buildingInstanced.receiveShadow = true;

    for (let i = 0; i < buildingList.length; i++) {
      const b = buildingList[i];
      CityGenerator._tempPos.set(b.x, b.y, b.z);
      CityGenerator._tempQuat.identity();
      CityGenerator._tempScale.set(b.width, b.height, b.length);
      CityGenerator._tempMatrix.compose(CityGenerator._tempPos, CityGenerator._tempQuat, CityGenerator._tempScale);

      buildingInstanced.setMatrixAt(i, CityGenerator._tempMatrix);
      buildingInstanced.setColorAt(i, CityGenerator._tempColor.setHex(b.color));
    }
    buildingInstanced.instanceMatrix.needsUpdate = true;
    if (buildingInstanced.instanceColor) buildingInstanced.instanceColor.needsUpdate = true;
    buildingInstanced.computeBoundingSphere();
    this.buildingsGroup.add(buildingInstanced);

    // ================= 4. DETALHES DOS PRÉDIOS: HELIPONTOS, ANTENAS, HVAC & NEONS =================
    // Rooftop Helipads
    const helipadBuildings = buildingList.filter((b) => b.hasHelipad);
    if (helipadBuildings.length > 0) {
      const helipadRingGeo = new THREE.RingGeometry(4.5, 5.2, 24);
      helipadRingGeo.rotateX(-Math.PI / 2);
      const helipadRingMat = new THREE.MeshBasicMaterial({ color: 0xffd60a, side: THREE.DoubleSide });
      const helipadInstanced = new THREE.InstancedMesh(helipadRingGeo, helipadRingMat, helipadBuildings.length);

      for (let i = 0; i < helipadBuildings.length; i++) {
        const b = helipadBuildings[i];
        CityGenerator._tempPos.set(b.x, b.height + 0.08, b.z);
        CityGenerator._tempQuat.identity();
        CityGenerator._tempScale.set(1, 1, 1);
        CityGenerator._tempMatrix.compose(CityGenerator._tempPos, CityGenerator._tempQuat, CityGenerator._tempScale);
        helipadInstanced.setMatrixAt(i, CityGenerator._tempMatrix);
      }
      helipadInstanced.instanceMatrix.needsUpdate = true;
      this.buildingsGroup.add(helipadInstanced);
    }

    // Rooftop Communications Antennas with Glowing Red Aviation Lights
    const antennaBuildings = buildingList.filter((b) => b.hasAntenna);
    if (antennaBuildings.length > 0) {
      const antennaMastGeo = new THREE.CylinderGeometry(0.12, 0.35, 16, 8);
      const antennaMastMat = new THREE.MeshStandardMaterial({ color: 0x888899, metalness: 0.9 });
      const antennaInstanced = new THREE.InstancedMesh(antennaMastGeo, antennaMastMat, antennaBuildings.length);

      const beaconSphereGeo = new THREE.SphereGeometry(0.45, 8, 8);
      const beaconSphereMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
      const beaconInstanced = new THREE.InstancedMesh(beaconSphereGeo, beaconSphereMat, antennaBuildings.length);

      for (let i = 0; i < antennaBuildings.length; i++) {
        const b = antennaBuildings[i];
        CityGenerator._tempPos.set(b.x, b.height + 8, b.z);
        CityGenerator._tempQuat.identity();
        CityGenerator._tempScale.set(1, 1, 1);
        CityGenerator._tempMatrix.compose(CityGenerator._tempPos, CityGenerator._tempQuat, CityGenerator._tempScale);
        antennaInstanced.setMatrixAt(i, CityGenerator._tempMatrix);

        CityGenerator._tempPos.set(b.x, b.height + 16, b.z);
        CityGenerator._tempMatrix.compose(CityGenerator._tempPos, CityGenerator._tempQuat, CityGenerator._tempScale);
        beaconInstanced.setMatrixAt(i, CityGenerator._tempMatrix);
      }
      antennaInstanced.instanceMatrix.needsUpdate = true;
      beaconInstanced.instanceMatrix.needsUpdate = true;
      this.buildingsGroup.add(antennaInstanced, beaconInstanced);
    }

    // Rooftop HVAC Industrial Chillers & Ducts
    const hvacBuildings = buildingList.filter((b) => b.hasHVAC);
    if (hvacBuildings.length > 0) {
      const hvacGeo = new THREE.BoxGeometry(4.5, 2.4, 3.2);
      const hvacMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6 });
      const hvacInstanced = new THREE.InstancedMesh(hvacGeo, hvacMat, hvacBuildings.length);

      for (let i = 0; i < hvacBuildings.length; i++) {
        const b = hvacBuildings[i];
        CityGenerator._tempPos.set(b.x - b.width * 0.25, b.height + 1.2, b.z - b.length * 0.25);
        CityGenerator._tempQuat.identity();
        CityGenerator._tempScale.set(1, 1, 1);
        CityGenerator._tempMatrix.compose(CityGenerator._tempPos, CityGenerator._tempQuat, CityGenerator._tempScale);
        hvacInstanced.setMatrixAt(i, CityGenerator._tempMatrix);
      }
      hvacInstanced.instanceMatrix.needsUpdate = true;
      this.buildingsGroup.add(hvacInstanced);
    }

    // Instanced Neon Billboard Signs on Facades
    const signDefs = buildingList.filter((b) => Boolean(b.sign)).map((b) => b.sign!);
    if (signDefs.length > 0) {
      const signMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.2,
        metalness: 0.1,
      });
      const signInstanced = new THREE.InstancedMesh(unitBoxGeo, signMat, signDefs.length);

      for (let i = 0; i < signDefs.length; i++) {
        const s = signDefs[i];
        CityGenerator._tempPos.set(s.x, s.y, s.z);
        CityGenerator._tempQuat.identity();
        CityGenerator._tempScale.set(s.width, 5.0, 0.4);
        CityGenerator._tempMatrix.compose(CityGenerator._tempPos, CityGenerator._tempQuat, CityGenerator._tempScale);

        signInstanced.setMatrixAt(i, CityGenerator._tempMatrix);
        signInstanced.setColorAt(i, CityGenerator._tempColor.setHex(s.color));
      }
      signInstanced.instanceMatrix.needsUpdate = true;
      if (signInstanced.instanceColor) signInstanced.instanceColor.needsUpdate = true;
      signInstanced.computeBoundingSphere();
      this.buildingsGroup.add(signInstanced);
    }

    // ================= 4.5 TÚNEL METRÓPOLE NEON (TIRE RESONANCE & REVERB ZONE) =================
    const tunnelStartX = 45;
    const tunnelEndX = 145;
    const tunnelLen = tunnelEndX - tunnelStartX;
    const tunnelCenterX = (tunnelStartX + tunnelEndX) / 2;
    const tunnelCenterZ = -280;
    const tunnelWidth = 26;
    const tunnelHeight = 8.5;

    this.tunnels.push({
      minX: tunnelStartX,
      maxX: tunnelEndX,
      minZ: tunnelCenterZ - tunnelWidth / 2,
      maxZ: tunnelCenterZ + tunnelWidth / 2,
      maxY: tunnelHeight,
    });

    const tunnelConcreteMat = new THREE.MeshStandardMaterial({
      color: 0x161a22,
      roughness: 0.85,
      metalness: 0.2,
    });
    // Left & Right concrete tunnel walls
    const tWallGeo = new THREE.BoxGeometry(tunnelLen, tunnelHeight, 1.8);
    const tWallN = new THREE.Mesh(tWallGeo, tunnelConcreteMat);
    tWallN.position.set(tunnelCenterX, tunnelHeight / 2, tunnelCenterZ - tunnelWidth / 2 - 0.9);
    const tWallS = new THREE.Mesh(tWallGeo, tunnelConcreteMat);
    tWallS.position.set(tunnelCenterX, tunnelHeight / 2, tunnelCenterZ + tunnelWidth / 2 + 0.9);

    // Tunnel roof slab
    const tRoofGeo = new THREE.BoxGeometry(tunnelLen, 1.4, tunnelWidth + 3.6);
    const tRoof = new THREE.Mesh(tRoofGeo, tunnelConcreteMat);
    tRoof.position.set(tunnelCenterX, tunnelHeight + 0.7, tunnelCenterZ);

    // Glowing overhead LED light strips inside tunnel
    const ledStripGeo = new THREE.BoxGeometry(tunnelLen - 4, 0.25, 0.6);
    const ledStripMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const ledL = new THREE.Mesh(ledStripGeo, ledStripMat);
    ledL.position.set(tunnelCenterX, tunnelHeight - 0.15, tunnelCenterZ - 5.5);
    const ledR = new THREE.Mesh(ledStripGeo, ledStripMat);
    ledR.position.set(tunnelCenterX, tunnelHeight - 0.15, tunnelCenterZ + 5.5);

    this.trackGroup.add(tWallN, tWallS, tRoof, ledL, ledR);

    // Colliders for tunnel outer walls
    this.colliders.push(
      {
        minX: tunnelStartX,
        maxX: tunnelEndX,
        minZ: tunnelCenterZ - tunnelWidth / 2 - 2.0,
        maxZ: tunnelCenterZ - tunnelWidth / 2,
      },
      {
        minX: tunnelStartX,
        maxX: tunnelEndX,
        minZ: tunnelCenterZ + tunnelWidth / 2,
        maxZ: tunnelCenterZ + tunnelWidth / 2 + 2.0,
      }
    );

    // ================= 5. POSTES DE LUZ ORGANIZADOS (STRICT SIDEWALK PLACEMENT) =================
    // Placed strictly on sidewalk (14m from centerline) with safety clearance from all track curves
    const lampPositions: { x: number; z: number }[] = [];
    for (let i = 0; i < this.waypoints.length; i += 8) {
      const wp = this.waypoints[i];
      const normalX = Math.cos(wp.heading);
      const normalZ = -Math.sin(wp.heading);
      const candidateX = wp.position.x + normalX * (roadWidth / 2 + 3.0);
      const candidateZ = wp.position.z + normalZ * (roadWidth / 2 + 3.0);

      // Skip poles inside tunnel corridor
      if (
        candidateX >= tunnelStartX - 6 &&
        candidateX <= tunnelEndX + 6 &&
        Math.abs(candidateZ - tunnelCenterZ) < tunnelWidth / 2 + 6
      ) {
        continue;
      }

      // Verify clearance from all other waypoints to avoid encroachment in curves
      let safeLamp = true;
      for (let j = 0; j < this.waypoints.length; j++) {
        if (Math.abs(i - j) <= 2) continue;
        const d = Math.hypot(candidateX - this.waypoints[j].position.x, candidateZ - this.waypoints[j].position.z);
        if (d < roadWidth / 2 + 1.5) {
          safeLamp = false;
          break;
        }
      }

      if (safeLamp) {
        lampPositions.push({ x: candidateX, z: candidateZ });
      }
    }

    if (lampPositions.length > 0) {
      const poleGeo = new THREE.CylinderGeometry(0.18, 0.22, 7, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 });
      const polesInstanced = new THREE.InstancedMesh(poleGeo, poleMat, lampPositions.length);

      const bulbGeo = new THREE.SphereGeometry(0.4, 8, 8);
      const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff0bb });
      const bulbsInstanced = new THREE.InstancedMesh(bulbGeo, bulbMat, lampPositions.length);

      for (let i = 0; i < lampPositions.length; i++) {
        const lp = lampPositions[i];

        // Pole matrix
        CityGenerator._tempPos.set(lp.x, 3.5, lp.z);
        CityGenerator._tempQuat.identity();
        CityGenerator._tempScale.set(1, 1, 1);
        CityGenerator._tempMatrix.compose(CityGenerator._tempPos, CityGenerator._tempQuat, CityGenerator._tempScale);
        polesInstanced.setMatrixAt(i, CityGenerator._tempMatrix);

        // Bulb matrix
        CityGenerator._tempPos.set(lp.x, 7.0, lp.z);
        CityGenerator._tempMatrix.compose(CityGenerator._tempPos, CityGenerator._tempQuat, CityGenerator._tempScale);
        bulbsInstanced.setMatrixAt(i, CityGenerator._tempMatrix);

        // Add PointLight for nearby illumination, culled by CullingManager
        const pLight = new THREE.PointLight(0xffeedd, 1.2, 35);
        pLight.position.set(lp.x, 6.8, lp.z);
        this.propsGroup.add(pLight);
        this.streetLights.push(pLight);
        this.culling.registerObject(pLight, true, 1.2);
      }

      polesInstanced.instanceMatrix.needsUpdate = true;
      bulbsInstanced.instanceMatrix.needsUpdate = true;
      this.propsGroup.add(polesInstanced);
      this.propsGroup.add(bulbsInstanced);
    }
  }

  // --- Track 2: Rodovia Costeira (Batched rocks with InstancedMesh) ---
  private buildCoastalHighway() {
    this.roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x22242a,
      roughness: 0.7,
      metalness: 0.2,
    });

    // Ocean on left, Mountain Cliffs on right
    const oceanGeo = new THREE.PlaneGeometry(1600, 1600);
    oceanGeo.rotateX(-Math.PI / 2);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x05233d,
      roughness: 0.15,
      metalness: 0.85,
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.position.y = -2;
    this.trackGroup.add(ocean);

    // Winding Highway Path
    const pathPoints = [
      new THREE.Vector3(0, 0, -320),
      new THREE.Vector3(120, 0, -220),
      new THREE.Vector3(240, 0, -100),
      new THREE.Vector3(320, 0, 80),
      new THREE.Vector3(240, 0, 240),
      new THREE.Vector3(80, 0, 320),
      new THREE.Vector3(-120, 0, 280),
      new THREE.Vector3(-220, 0, 150),
      new THREE.Vector3(-200, 0, -80),
      new THREE.Vector3(-120, 0, -240),
    ];

    const curve = new THREE.CatmullRomCurve3(pathPoints, true);
    const sampled = curve.getPoints(120);

    for (let i = 0; i < sampled.length; i++) {
      const p = sampled[i];
      const nextP = sampled[(i + 1) % sampled.length];
      const angle = Math.atan2(nextP.x - p.x, nextP.z - p.z);
      this.waypoints.push({ position: p.clone(), heading: angle });
    }

    this.roadHalfWidth = 10;
    const roadGeo = new THREE.TubeGeometry(curve, 160, 10, 8, true);
    roadGeo.scale(1, 0.02, 1);
    const road = new THREE.Mesh(roadGeo, this.roadMaterial);
    road.position.y = 0.05;
    this.trackGroup.add(road);

    // Mountain rock clusters - Batched InstancedMesh (1 Draw Call!)
    const rockGeo = new THREE.DodecahedronGeometry(18, 1);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x5a483e, roughness: 0.9 });
    const rockCount = 40;
    const rockInstanced = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    rockInstanced.castShadow = true;
    rockInstanced.receiveShadow = true;

    for (let i = 0; i < rockCount; i++) {
      const angle = (i / rockCount) * Math.PI * 2;
      const rx = Math.cos(angle) * (360 + Math.random() * 80);
      const rz = Math.sin(angle) * (360 + Math.random() * 80);
      const sx = 1 + Math.random() * 0.8;
      const sy = 1.8 + Math.random() * 1.5;
      const sz = 1 + Math.random() * 0.8;

      CityGenerator._tempPos.set(rx, 15, rz);
      CityGenerator._tempQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI);
      CityGenerator._tempScale.set(sx, sy, sz);
      CityGenerator._tempMatrix.compose(CityGenerator._tempPos, CityGenerator._tempQuat, CityGenerator._tempScale);
      rockInstanced.setMatrixAt(i, CityGenerator._tempMatrix);

      this.colliders.push({
        minX: rx - 20,
        maxX: rx + 20,
        minZ: rz - 20,
        maxZ: rz + 20,
      });
    }

    rockInstanced.instanceMatrix.needsUpdate = true;
    rockInstanced.computeBoundingSphere();
    this.buildingsGroup.add(rockInstanced);
  }

  // --- Track 3: Docas Industriais (Batched containers with InstancedMesh) ---
  private buildIndustrialDocks() {
    this.roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x272b30,
      roughness: 0.8,
      metalness: 0.1,
    });

    const groundGeo = new THREE.PlaneGeometry(1000, 1000);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1f2228, roughness: 0.95 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    this.trackGroup.add(ground);

    const pathPoints = [
      new THREE.Vector3(-200, 0, -200),
      new THREE.Vector3(200, 0, -200),
      new THREE.Vector3(200, 0, 0),
      new THREE.Vector3(50, 0, 0),
      new THREE.Vector3(50, 0, 180),
      new THREE.Vector3(200, 0, 180),
      new THREE.Vector3(200, 0, 260),
      new THREE.Vector3(-200, 0, 260),
      new THREE.Vector3(-200, 0, 100),
      new THREE.Vector3(-50, 0, 100),
      new THREE.Vector3(-50, 0, -80),
      new THREE.Vector3(-200, 0, -80),
    ];

    const curve = new THREE.CatmullRomCurve3(pathPoints, true);
    const sampled = curve.getPoints(120);

    for (let i = 0; i < sampled.length; i++) {
      const p = sampled[i];
      const nextP = sampled[(i + 1) % sampled.length];
      const angle = Math.atan2(nextP.x - p.x, nextP.z - p.z);
      this.waypoints.push({ position: p.clone(), heading: angle });
    }

    this.roadHalfWidth = 9.5;
    const roadGeo = new THREE.TubeGeometry(curve, 160, 9.5, 8, true);
    roadGeo.scale(1, 0.02, 1);
    const road = new THREE.Mesh(roadGeo, this.roadMaterial);
    road.position.y = 0.04;
    this.trackGroup.add(road);

    // Stacks of Shipping Containers - 1 Draw Call for all 80+ containers!
    const containerColors = [0x1565c0, 0xc62828, 0xef6c00, 0x2e7d32, 0x37474f];
    interface ContainerItem {
      x: number;
      y: number;
      z: number;
      color: number;
    }
    const containerItems: ContainerItem[] = [];

    for (let i = 0; i < 60; i++) {
      const cx = (Math.random() - 0.5) * 600;
      const cz = (Math.random() - 0.5) * 600;

      let minDst = 999;
      for (let w = 0; w < this.waypoints.length; w++) {
        const d = this.waypoints[w].position.distanceTo(new THREE.Vector3(cx, 0, cz));
        if (d < minDst) minDst = d;
      }
      if (minDst < 22) continue;

      const cColor = containerColors[Math.floor(Math.random() * containerColors.length)];
      containerItems.push({ x: cx, y: 3, z: cz, color: cColor });

      if (Math.random() > 0.4) {
        containerItems.push({ x: cx, y: 9, z: cz, color: cColor });
      }

      this.skyscraperZones.push({
        x: cx,
        z: cz,
        halfW: 3,
        halfL: 7.5,
        height: 18,
      });

      this.colliders.push({
        minX: cx - 4,
        maxX: cx + 4,
        minZ: cz - 8.5,
        maxZ: cz + 8.5,
      });
    }

    if (containerItems.length > 0) {
      const cGeo = new THREE.BoxGeometry(6, 6, 15);
      const cMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.4 });
      const containerInstanced = new THREE.InstancedMesh(cGeo, cMat, containerItems.length);
      containerInstanced.castShadow = true;
      containerInstanced.receiveShadow = true;

      for (let i = 0; i < containerItems.length; i++) {
        const item = containerItems[i];
        CityGenerator._tempPos.set(item.x, item.y, item.z);
        CityGenerator._tempQuat.identity();
        CityGenerator._tempScale.set(1, 1, 1);
        CityGenerator._tempMatrix.compose(CityGenerator._tempPos, CityGenerator._tempQuat, CityGenerator._tempScale);

        containerInstanced.setMatrixAt(i, CityGenerator._tempMatrix);
        containerInstanced.setColorAt(i, CityGenerator._tempColor.setHex(item.color));
      }

      containerInstanced.instanceMatrix.needsUpdate = true;
      if (containerInstanced.instanceColor) containerInstanced.instanceColor.needsUpdate = true;
      containerInstanced.computeBoundingSphere();
      this.buildingsGroup.add(containerInstanced);
    }
  }

  // --- Track 4: Cânion do Deserto (Batched mesas with InstancedMesh) ---
  private buildDesertCanyon() {
    this.roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a362f,
      roughness: 0.85,
    });

    const groundGeo = new THREE.PlaneGeometry(1400, 1400);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x8a623a, roughness: 0.95 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    this.trackGroup.add(ground);

    const pathPoints = [
      new THREE.Vector3(0, 0, -380),
      new THREE.Vector3(220, 0, -250),
      new THREE.Vector3(340, 0, 0),
      new THREE.Vector3(260, 0, 260),
      new THREE.Vector3(0, 0, 380),
      new THREE.Vector3(-260, 0, 260),
      new THREE.Vector3(-340, 0, 0),
      new THREE.Vector3(-220, 0, -250),
    ];

    const curve = new THREE.CatmullRomCurve3(pathPoints, true);
    const sampled = curve.getPoints(120);

    for (let i = 0; i < sampled.length; i++) {
      const p = sampled[i];
      const nextP = sampled[(i + 1) % sampled.length];
      const angle = Math.atan2(nextP.x - p.x, nextP.z - p.z);
      this.waypoints.push({ position: p.clone(), heading: angle });
    }

    this.roadHalfWidth = 12;
    const roadGeo = new THREE.TubeGeometry(curve, 160, 12, 8, true);
    roadGeo.scale(1, 0.02, 1);
    const road = new THREE.Mesh(roadGeo, this.roadMaterial);
    road.position.y = 0.04;
    this.trackGroup.add(road);

    // Canyon rock mesas - 1 Draw Call for 50 massive canyon pillars!
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x9c512d, roughness: 0.9 });
    const rockGeo = new THREE.CylinderGeometry(15, 25, 45, 7);
    const rockCount = 50;
    const canyonInstanced = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    canyonInstanced.castShadow = true;
    canyonInstanced.receiveShadow = true;

    for (let i = 0; i < rockCount; i++) {
      const angle = (i / rockCount) * Math.PI * 2;
      const dist = 420 + Math.random() * 120;
      const rx = Math.cos(angle) * dist;
      const rz = Math.sin(angle) * dist;

      CityGenerator._tempPos.set(rx, 22.5, rz);
      CityGenerator._tempQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI);
      CityGenerator._tempScale.set(1, 1, 1);
      CityGenerator._tempMatrix.compose(CityGenerator._tempPos, CityGenerator._tempQuat, CityGenerator._tempScale);

      canyonInstanced.setMatrixAt(i, CityGenerator._tempMatrix);

      this.skyscraperZones.push({
        x: rx,
        z: rz,
        halfW: 20,
        halfL: 20,
        height: 45,
      });

      this.colliders.push({
        minX: rx - 24,
        maxX: rx + 24,
        minZ: rz - 24,
        maxZ: rz + 24,
      });
    }

    canyonInstanced.instanceMatrix.needsUpdate = true;
    canyonInstanced.computeBoundingSphere();
    this.buildingsGroup.add(canyonInstanced);
  }

  // --- Track 5: Bairro das Colinas / Suburban Hills (Residential hills, villas, lush trees & curves) ---
  private buildSuburbanHills() {
    this.roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x22252c,
      roughness: 0.7,
      metalness: 0.1,
    });

    // Suburban Rolling Ground
    const groundGeo = new THREE.PlaneGeometry(1200, 1200);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1e361e, // Rich grass green
      roughness: 0.9,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    this.trackGroup.add(ground);

    // Winding Suburban Hill Loop with Elevation
    const pathPoints = [
      new THREE.Vector3(0, 0, -320),
      new THREE.Vector3(120, 2.5, -240),
      new THREE.Vector3(220, 5.0, -100),
      new THREE.Vector3(180, 4.0, 80),
      new THREE.Vector3(260, 6.5, 220),
      new THREE.Vector3(80, 3.0, 340),
      new THREE.Vector3(-100, 1.0, 310),
      new THREE.Vector3(-220, 4.5, 180),
      new THREE.Vector3(-260, 5.5, -40),
      new THREE.Vector3(-160, 2.0, -220),
    ];

    const curve = new THREE.CatmullRomCurve3(pathPoints, true);
    const sampled = curve.getPoints(140);

    for (let i = 0; i < sampled.length; i++) {
      const p = sampled[i];
      const nextP = sampled[(i + 1) % sampled.length];
      const angle = Math.atan2(nextP.x - p.x, nextP.z - p.z);
      this.waypoints.push({ position: p.clone(), heading: angle });
    }

    this.roadHalfWidth = 11;

    // Road Ribbon
    const roadGeo = new THREE.TubeGeometry(curve, 180, 11, 8, true);
    roadGeo.scale(1, 0.02, 1);
    const road = new THREE.Mesh(roadGeo, this.roadMaterial);
    road.position.y = 0.05;
    road.receiveShadow = true;
    this.trackGroup.add(road);

    // Build Suburban Houses and Villa Corridors
    const houseGeo = new THREE.BoxGeometry(16, 9, 20);
    const roofGeo = new THREE.ConeGeometry(14, 5, 4);
    roofGeo.rotateY(Math.PI / 4);

    const houseMatA = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8 });
    const houseMatB = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.85 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.6 });

    // Populate Residential Villas lining the hills
    for (let i = 0; i < sampled.length; i += 4) {
      const p = sampled[i];
      const nextP = sampled[(i + 1) % sampled.length];
      const forward = new THREE.Vector3().subVectors(nextP, p).normalize();
      const normal = new THREE.Vector3(-forward.z, 0, forward.x);

      // Houses on Left and Right of road
      [-28, 28].forEach((offsetDist, sideIdx) => {
        const housePos = p.clone().add(normal.clone().multiplyScalar(offsetDist));
        const houseGroup = new THREE.Group();
        houseGroup.position.set(housePos.x, housePos.y, housePos.z);

        const body = new THREE.Mesh(houseGeo, sideIdx === 0 ? houseMatA : houseMatB);
        body.position.y = 4.5;
        body.castShadow = true;
        body.receiveShadow = true;
        houseGroup.add(body);

        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = 11.5;
        roof.castShadow = true;
        houseGroup.add(roof);

        this.buildingsGroup.add(houseGroup);

        this.colliders.push({
          minX: housePos.x - 9,
          maxX: housePos.x + 9,
          minZ: housePos.z - 11,
          maxZ: housePos.z + 11,
        });

        // Add garden trees and street lamp in front of house
        const treePos = housePos.clone().add(normal.clone().multiplyScalar(sideIdx === 0 ? 8 : -8));
        this.destructibleProps.addTree(treePos.x, treePos.z, 0.9 + Math.random() * 0.4);

        if (i % 8 === 0) {
          const lampPos = p.clone().add(normal.clone().multiplyScalar(sideIdx === 0 ? -12.5 : 12.5));
          this.destructibleProps.addStreetLamp(lampPos.x, lampPos.z, Math.atan2(forward.x, forward.z));
        }
      });
    }

    // Add Intersection Traffic Lights
    this.destructibleProps.addTrafficLight(0, -320, 0);
    this.destructibleProps.addTrafficLight(180, 80, Math.PI / 2);
    this.destructibleProps.addTrafficLight(-100, 310, Math.PI);

    // Place Accessible Locations
    this.accessibleLocations.generateLocations(this.buildingsGroup, this.colliders);
  }


  // --- Rain Particles & Weather Setup ---
  private setupRainParticles(quality: GraphicsQuality) {
    if (this.rainMesh) {
      this.scene.remove(this.rainMesh);
      this.rainMesh.geometry.dispose();
      this.rainMesh = null;
    }

    const rainCount = quality === 'low' ? 500 : quality === 'medium' ? 1200 : 2200;
    const positions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 1] = Math.random() * 45;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    this.rainPositions = positions;

    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const rainMat = new THREE.PointsMaterial({
      color: 0x88bbff,
      size: 0.22,
      transparent: true,
      opacity: 0.65,
    });

    this.rainMesh = new THREE.Points(rainGeo, rainMat);
    this.rainMesh.visible = false;
    this.scene.add(this.rainMesh);
  }

  /**
   * Sets up lighting and sky conditions for chosen weather, time of day and graphics preset.
   */
  public applyAtmosphere(
    timeOfDay: TimeOfDay,
    weather: WeatherType,
    quality: GraphicsQuality
  ) {
    // 1. Weather Road Material Glaze
    if (this.roadMaterial) {
      const isWet = weather === 'rain' || weather === 'storm';
      this.roadMaterial.roughness = isWet ? 0.15 : 0.75;
      this.roadMaterial.metalness = isWet ? 0.7 : 0.15;
    }

    // 2. Rain Visibility
    if (this.rainMesh) {
      this.rainMesh.visible = weather === 'rain' || weather === 'storm';
    }

    // 3. Sky & Ambient Lighting
    if (!this.sunLight) {
      this.sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
      this.scene.add(this.sunLight);
    }

    // Fine-tuned shadow resolution based on hardware quality
    this.sunLight.castShadow = quality !== 'low';
    if (this.sunLight.shadow) {
      const shadowMapDim = quality === 'ultra' ? 2048 : quality === 'high' ? 1024 : 512;
      this.sunLight.shadow.mapSize.set(shadowMapDim, shadowMapDim);
      this.sunLight.shadow.bias = -0.0005;
      this.sunLight.shadow.camera.near = 0.5;
      this.sunLight.shadow.camera.far = 400;
      const d = 120;
      this.sunLight.shadow.camera.left = -d;
      this.sunLight.shadow.camera.right = d;
      this.sunLight.shadow.camera.top = d;
      this.sunLight.shadow.camera.bottom = -d;
    }

    if (!this.hemiLight) {
      this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444455, 1.8);
      this.scene.add(this.hemiLight);
    }

    let sunColor = 0xffffff;
    let sunIntensity = 2.5;
    let hemiSky = 0x88ccff;
    let hemiGround = 0x334455;
    let fogColor = 0x111622;
    let fogDensity = 0.0035;

    switch (timeOfDay) {
      case 'day':
        sunColor = 0xfffaee;
        sunIntensity = 2.4;
        hemiSky = 0x99ccff;
        hemiGround = 0x445566;
        fogColor = 0xb0cce8;
        fogDensity = 0.0025;
        break;
      case 'sunset':
        sunColor = 0xff6b35;
        sunIntensity = 2.8;
        hemiSky = 0xcc6633;
        hemiGround = 0x221122;
        fogColor = 0x5a2d22;
        fogDensity = 0.0035;
        break;
      case 'night':
        sunColor = 0x334466;
        sunIntensity = 0.5;
        hemiSky = 0x152033;
        hemiGround = 0x0a0d14;
        fogColor = 0x080c14;
        fogDensity = 0.0045;
        break;
      case 'midnight':
        sunColor = 0x112244;
        sunIntensity = 0.3;
        hemiSky = 0x0b101f;
        hemiGround = 0x05070a;
        fogColor = 0x04060b;
        fogDensity = 0.0055;
        break;
    }

    if (weather === 'storm') {
      sunIntensity *= 0.3;
      fogDensity = 0.007;
      fogColor = 0x070c14;
    } else if (weather === 'fog') {
      fogDensity = 0.012;
      sunIntensity *= 0.5;
    }

    this.sunLight.color.set(sunColor);
    this.sunLight.intensity = sunIntensity;
    this.sunLight.position.set(80, 160, 60);

    this.hemiLight.color.set(hemiSky);
    this.hemiLight.groundColor.set(hemiGround);

    this.scene.background = new THREE.Color(fogColor);
    this.scene.fog = new THREE.FogExp2(fogColor, fogDensity);

    // Street lights toggling based on dark times
    const isDark = timeOfDay === 'night' || timeOfDay === 'midnight' || weather === 'storm';
    this.streetLights.forEach((light) => {
      light.intensity = isDark ? 2.0 : 0;
    });
  }

  public update(dt: number, playerPos: THREE.Vector3, weather: WeatherType) {
    // Animate Rain
    if (this.rainMesh && this.rainPositions && (weather === 'rain' || weather === 'storm')) {
      const count = this.rainPositions.length / 3;
      const speed = weather === 'storm' ? 55 : 35;
      for (let i = 0; i < count; i++) {
        const py = i * 3 + 1;
        this.rainPositions[py] -= speed * dt;
        if (this.rainPositions[py] < 0) {
          this.rainPositions[py] = 40 + Math.random() * 10;
          this.rainPositions[i * 3] = playerPos.x + (Math.random() - 0.5) * 160;
          this.rainPositions[i * 3 + 2] = playerPos.z + (Math.random() - 0.5) * 160;
        }
      }
      this.rainMesh.geometry.attributes.position.needsUpdate = true;
      this.rainMesh.position.set(0, 0, 0);
    }

    // Update dynamic destructible props (flying, bouncing, particle sparks)
    this.destructibleProps.update(dt);

    // Update accessible locations (animated neon signs, rotary lift indicator, door sensors)
    this.accessibleLocations.update(dt);
  }

  /**
   * Collision check with destructible props (trees, traffic lights, lamp posts).
   * Launches prop into 3D ballistic tumbling physics if hit at speed.
   */
  public checkDestructiblePropCollision(
    playerPos: THREE.Vector3,
    playerVel: THREE.Vector3,
    speedKmh: number,
    radius: number = 1.3
  ) {
    return this.destructibleProps.checkCollision(playerPos, playerVel, speedKmh, radius);
  }

  /**
   * Zero-GC Collision check for bounding boxes. Returns nearest normal vector if collided.
   */
  public checkBuildingCollision(
    pos: THREE.Vector3,
    carRadius: number = 1.4
  ): THREE.Vector3 | null {
    for (let i = 0; i < this.colliders.length; i++) {
      const box = this.colliders[i];
      if (
        pos.x + carRadius > box.minX &&
        pos.x - carRadius < box.maxX &&
        pos.z + carRadius > box.minZ &&
        pos.z - carRadius < box.maxZ
      ) {
        // Find penetration depth on each axis
        const overlapLeft = pos.x + carRadius - box.minX;
        const overlapRight = box.maxX - (pos.x - carRadius);
        const overlapFront = pos.z + carRadius - box.minZ;
        const overlapBack = box.maxZ - (pos.z - carRadius);

        const minOverlap = Math.min(overlapLeft, overlapRight, overlapFront, overlapBack);

        if (minOverlap === overlapLeft) CityGenerator._colNormal.set(-1, 0, 0);
        else if (minOverlap === overlapRight) CityGenerator._colNormal.set(1, 0, 0);
        else if (minOverlap === overlapFront) CityGenerator._colNormal.set(0, 0, -1);
        else CityGenerator._colNormal.set(0, 0, 1);

        return CityGenerator._colNormal;
      }
    }
    return null;
  }

  /**
   * Calculates vertical elevation for bridges/overpasses and approach ramps.
   * Allows driving smoothly on elevated highways and passing under cross streets.
   */
  public getRoadElevation(pos: THREE.Vector3, currentY: number = 0): number {
    for (let i = 0; i < this.bridges.length; i++) {
      const b = this.bridges[i];
      const halfW = b.deckWidth / 2 + 1.5;
      if (Math.abs(pos.x - b.centerX) <= halfW) {
        const fullStartZ = b.startZ - b.rampLength;
        const fullEndZ = b.endZ + b.rampLength;

        if (pos.z >= fullStartZ && pos.z <= fullEndZ) {
          // If car is already elevated on the bridge or top of the approach ramp
          const isAtElevation = currentY > 3.2;

          // South approach ramp (rises from 0 at fullStartZ to b.deckHeight at b.startZ)
          if (pos.z < b.startZ) {
            const t = Math.max(0, Math.min(1, (pos.z - fullStartZ) / b.rampLength));
            const rampH = t * b.deckHeight;
            if (isAtElevation || currentY <= rampH + 2.2) {
              return rampH;
            }
          }
          // North approach ramp (descends from b.deckHeight at b.endZ to 0 at fullEndZ)
          else if (pos.z > b.endZ) {
            const t = Math.max(0, Math.min(1, (fullEndZ - pos.z) / b.rampLength));
            const rampH = t * b.deckHeight;
            if (isAtElevation || currentY <= rampH + 2.2) {
              return rampH;
            }
          }
          // Main elevated span
          else if (isAtElevation) {
            return b.deckHeight;
          }
        }
      }
    }
    return 0;
  }

  /**
   * Checks if car is driving on a jump ramp or crossing the launch lip.
   */
  public checkJumpRamp(
    pos: THREE.Vector3,
    speedKmh: number
  ): { hit: boolean; launch: boolean; launchSpeedY: number; pitch: number; height: number } {
    for (let i = 0; i < this.jumpRamps.length; i++) {
      const r = this.jumpRamps[i];
      const dx = pos.x - r.position.x;
      const dz = pos.z - r.position.z;

      // Transform point into ramp local space (Z is along ramp length)
      const cosH = Math.cos(-r.heading);
      const sinH = Math.sin(-r.heading);
      const localX = dx * cosH - dz * sinH;
      const localZ = dx * sinH + dz * cosH;

      const halfW = r.width / 2;
      const halfL = r.length / 2;

      if (Math.abs(localX) <= halfW && localZ >= -halfL && localZ <= halfL + 3.0) {
        // Vehicle is within ramp footprint
        const progress = Math.max(0, Math.min(1, (localZ + halfL) / r.length));
        const rampSurfaceY = progress * r.height;

        // Lip launch trigger when past the apex
        const isNearLip = localZ >= halfL - 0.8;
        if (isNearLip && speedKmh > 35) {
          const speedFactor = Math.max(0.6, speedKmh / 100);
          const launchSpeedY = Math.min(18, Math.max(7.5, (speedKmh / 3.6) * 0.42));
          return {
            hit: true,
            launch: true,
            launchSpeedY,
            pitch: -0.22,
            height: r.height,
          };
        }

        return {
          hit: true,
          launch: false,
          launchSpeedY: 0,
          pitch: -0.15,
          height: rampSurfaceY,
        };
      }
    }

    return { hit: false, launch: false, launchSpeedY: 0, pitch: 0, height: 0 };
  }

  /**
   * Checks if position is currently on the roadway/pavement, bridge deck or ramp.
   * Returns false if off-road (e.g. driving on dirt, grass, sidewalk, or plazas).
   */
  public isPositionOnRoadway(pos: THREE.Vector3, roadTolerance: number = 13.5): boolean {
    // 1. Check if player is inside or on the driveway/apron of an accessible location
    const locProximity = this.accessibleLocations.checkPlayerProximity(pos);
    if (locProximity.isInside || locProximity.canInteract) {
      return true;
    }

    // 2. Check if on elevated bridge or bridge approach ramp
    for (let i = 0; i < this.bridges.length; i++) {
      const b = this.bridges[i];
      const halfW = b.deckWidth / 2 + 1.2;
      const fullStartZ = b.startZ - b.rampLength;
      const fullEndZ = b.endZ + b.rampLength;
      if (Math.abs(pos.x - b.centerX) <= halfW && pos.z >= fullStartZ && pos.z <= fullEndZ) {
        return true;
      }
    }

    // 3. Check if on stunt jump ramps
    for (let i = 0; i < this.jumpRamps.length; i++) {
      const r = this.jumpRamps[i];
      const dx = pos.x - r.position.x;
      const dz = pos.z - r.position.z;
      if (dx * dx + dz * dz <= 18 * 18) {
        return true;
      }
    }

    // 4. Check City Grid Avenues & Cross Streets (when in track_city)
    if (this.activeTrackId === 'track_city') {
      // Central Avenue (x=0)
      if (Math.abs(pos.x) <= 12 && pos.z >= -520 && pos.z <= 520) return true;
      // West Avenue (x=-180) & East Avenue (x=180)
      if (Math.abs(pos.x - -180) <= 11 && pos.z >= -480 && pos.z <= 480) return true;
      if (Math.abs(pos.x - 180) <= 11 && pos.z >= -480 && pos.z <= 480) return true;
      // Cross Streets (z = -180, 0, 180)
      if (Math.abs(pos.z) <= 11 && pos.x >= -480 && pos.x <= 480) return true;
      if (Math.abs(pos.z - -180) <= 11 && pos.x >= -480 && pos.x <= 480) return true;
      if (Math.abs(pos.z - 180) <= 11 && pos.x >= -480 && pos.x <= 480) return true;
    }

    // 5. Check distance to nearest road centerline waypoint
    let minSqDist = 999999;
    for (let i = 0; i < this.waypoints.length; i++) {
      const wp = this.waypoints[i].position;
      const dx = pos.x - wp.x;
      const dz = pos.z - wp.z;
      const sq = dx * dx + dz * dz;
      if (sq < minSqDist) {
        minSqDist = sq;
        if (minSqDist <= roadTolerance * roadTolerance) {
          return true;
        }
      }
    }

    return minSqDist <= roadTolerance * roadTolerance;
  }

  /**
   * Computes real-time environmental acoustic factors for the dynamic city ambiance audio layer:
   * - skyscraperDensity: boosts siren echoes near tall buildings or canyon walls
   * - bridgeAltitudeFactor: boosts wind rush on elevated highways / high-altitude bridges
   * - tunnelFactor: boosts tire resonance & acoustic reflections inside tunnels and bridge underpasses
   * - cityDensity: baseline urban background hum
   */
  public getEnvironmentAcoustics(pos: THREE.Vector3): EnvironmentAcoustics {
    const res = CityGenerator._acousticsResult;

    // 1. Track-level city density
    res.cityDensity =
      this.activeTrackId === 'track_city'
        ? 0.88
        : this.activeTrackId === 'track_docks'
          ? 0.55
          : this.activeTrackId === 'track_coast'
            ? 0.25
            : 0.15;

    // 2. Skyscraper proximity & height weighting (drives siren echoes)
    let skyscraperScore = 0;
    const maxRadius = 52;
    for (let i = 0; i < this.skyscraperZones.length; i++) {
      const b = this.skyscraperZones[i];
      const clX = Math.max(b.x - b.halfW, Math.min(pos.x, b.x + b.halfW));
      const clZ = Math.max(b.z - b.halfL, Math.min(pos.z, b.z + b.halfL));
      const dist = Math.hypot(pos.x - clX, pos.z - clZ);
      if (dist < maxRadius) {
        const proximity = 1 - dist / maxRadius;
        const heightWeight = Math.min(1.4, b.height / 85);
        skyscraperScore += proximity * heightWeight * 0.45;
        if (skyscraperScore >= 1.0) {
          skyscraperScore = 1.0;
          break;
        }
      }
    }
    res.skyscraperDensity = Math.min(1.0, skyscraperScore);

    // 3. High-altitude bridge wind factor
    let altitudeFactor = Math.max(0, Math.min(1.0, pos.y / 9.5));
    if (this.activeTrackId === 'track_coast') {
      // Coastal sea breeze adds mild open-air wind factor
      altitudeFactor = Math.max(altitudeFactor, 0.35);
    }
    res.bridgeAltitudeFactor = altitudeFactor;

    // 4. Tunnel & underpass resonance factor
    let tunnelFactor = 0;
    for (let i = 0; i < this.tunnels.length; i++) {
      const t = this.tunnels[i];
      if (
        pos.x >= t.minX - 6 &&
        pos.x <= t.maxX + 6 &&
        pos.z >= t.minZ &&
        pos.z <= t.maxZ &&
        pos.y < t.maxY
      ) {
        // Smooth 6m crossfade at tunnel portals
        const fadeIn = Math.min(1, Math.max(0, (pos.x - (t.minX - 6)) / 6));
        const fadeOut = Math.min(1, Math.max(0, (t.maxX + 6 - pos.x) / 6));
        tunnelFactor = Math.max(tunnelFactor, Math.min(fadeIn, fadeOut));
      }
    }
    // Check driving underneath elevated viaducts
    if (tunnelFactor < 0.8) {
      for (let i = 0; i < this.bridges.length; i++) {
        const b = this.bridges[i];
        if (
          Math.abs(pos.x - b.centerX) <= b.deckWidth * 0.65 &&
          pos.z >= b.startZ &&
          pos.z <= b.endZ &&
          pos.y < b.deckHeight - 2.0
        ) {
          tunnelFactor = Math.max(tunnelFactor, 0.72);
        }
      }
    }
    res.tunnelFactor = tunnelFactor;

    return res;
  }
}


