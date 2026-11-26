import * as THREE from 'three';
import { sound } from '../audio/SoundEffects';

export interface AccessibleLocationDef {
  id: string;
  name: string;
  category: 'garage' | 'house' | 'diner' | 'observatory' | 'dealership' | 'club' | 'convenience';
  entrancePos: THREE.Vector3;
  entranceHeading: number;
  interiorCenterPos: THREE.Vector3;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number; minY: number; maxY: number };
  interactStationPos: THREE.Vector3;
  interactPrompt: string;
  actionToast: string;
  icon: string;
  bannerColor: number;
  onInteractEffect: (playerState: { health: number; nitroReserve: number; cash: number; rep: number }) => {
    healthRestored?: boolean;
    nitroRefilled?: boolean;
    bonusCash?: number;
    bonusRep?: number;
    infiniteNitroDuration?: number;
  };
}

export class AccessibleLocationManager {
  public scene: THREE.Scene;
  public group: THREE.Group = new THREE.Group();
  public locations: AccessibleLocationDef[] = [];
  public activeInsideLocation: AccessibleLocationDef | null = null;

  // Visual Entrance Markers
  private markerRings: THREE.Mesh[] = [];
  private markerIcons: THREE.Mesh[] = [];

  // Shared Materials
  private sharedMaterials: THREE.Material[] = [];
  private sharedGeometries: THREE.BufferGeometry[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.scene.add(this.group);
    this.buildAllLocations();
  }

  public generateLocations(
    _parentGroup?: THREE.Group,
    colliders?: { minX: number; maxX: number; minZ: number; maxZ: number }[]
  ) {
    if (colliders) {
      for (let i = 0; i < this.locations.length; i++) {
        const loc = this.locations[i];
        colliders.push({
          minX: loc.bounds.minX,
          maxX: loc.bounds.maxX,
          minZ: loc.bounds.minZ,
          maxZ: loc.bounds.maxZ,
        });
      }
    }
  }

  private buildAllLocations() {
    this.locations = [
      // 1. Safehouse & Oficina Tuning de Luca & Miguel
      {
        id: 'tuning_garage',
        name: 'Oficina Tuning · Luca & Miguel',
        category: 'garage',
        entrancePos: new THREE.Vector3(-65, 0, 18),
        entranceHeading: Math.PI / 2,
        interiorCenterPos: new THREE.Vector3(-80, 0, 18),
        bounds: { minX: -95, maxX: -65, minZ: 6, maxZ: 30, minY: 0, maxY: 8 },
        interactStationPos: new THREE.Vector3(-84, 0, 18),
        interactPrompt: '[E] / Toque para REPARAR VEÍCULO & RECARREGAR NITRO',
        actionToast: '🔧 Oficina: Veículo 100% reparado e Nitro recarregado!',
        icon: '🔧',
        bannerColor: 0x00f0ff,
        onInteractEffect: (s) => {
          sound.playWrenchToolSound();
          s.health = 100;
          s.nitroReserve = 100;
          return { healthRestored: true, nitroRefilled: true };
        },
      },

      // 2. Casa Residencial de Luca & Miguel (Subúrbio Oeste)
      {
        id: 'residential_house',
        name: 'Casa de Luca & Miguel',
        category: 'house',
        entrancePos: new THREE.Vector3(-196, 0, 110),
        entranceHeading: Math.PI,
        interiorCenterPos: new THREE.Vector3(-214, 0, 110),
        bounds: { minX: -232, maxX: -196, minZ: 98, maxZ: 122, minY: 0, maxY: 7 },
        interactStationPos: new THREE.Vector3(-218, 0, 112),
        interactPrompt: '[E] / Toque para DESCANSAR & OUVIR RÁDIO (+50 REP)',
        actionToast: '🛋️ Casa: Descanso merecido! Saúde restaurada e +50 REP!',
        icon: '🏠',
        bannerColor: 0xffd60a,
        onInteractEffect: (s) => {
          sound.playDoorEnterSound();
          s.health = 100;
          s.rep += 50;
          return { healthRestored: true, bonusRep: 50 };
        },
      },

      // 3. Midnight Drift Diner 24h & Conveniência
      {
        id: 'midnight_diner',
        name: 'Midnight Drift Diner · 24 Horas',
        category: 'diner',
        entrancePos: new THREE.Vector3(92, 0, -82),
        entranceHeading: -Math.PI / 2,
        interiorCenterPos: new THREE.Vector3(106, 0, -82),
        bounds: { minX: 92, maxX: 120, minZ: -94, maxZ: -70, minY: 0, maxY: 6.5 },
        interactStationPos: new THREE.Vector3(108, 0, -82),
        interactPrompt: '[E] / Toque para TOMAR CAFÉ TURBO (Super Adrenalina 15s!)',
        actionToast: '☕ Café Turbo consumido! Adrenalina máxima e Nitro infinito por 15s!',
        icon: '☕',
        bannerColor: 0xff0055,
        onInteractEffect: (s) => {
          sound.playCountdownBeep(true);
          s.nitroReserve = 100;
          return { infiniteNitroDuration: 15 };
        },
      },

      // 4. Torre Comercial / Cobertura Observatório 360°
      {
        id: 'skyline_observatory',
        name: 'Torre Central · Elevador para Cobertura',
        category: 'observatory',
        entrancePos: new THREE.Vector3(72, 0, 110),
        entranceHeading: 0,
        interiorCenterPos: new THREE.Vector3(72, 85, 110), // Elevated rooftop observatory!
        bounds: { minX: 58, maxX: 86, minZ: 96, maxZ: 124, minY: 84, maxY: 94 },
        interactStationPos: new THREE.Vector3(72, 85, 110),
        interactPrompt: '[E] / Toque para ADMIRAR A VISTA PANORÂMICA DA CIDADE',
        actionToast: '🏙️ Cobertura: Vista panorâmica deslumbrante de Metrópole Neon!',
        icon: '🏙️',
        bannerColor: 0x9d4edd,
        onInteractEffect: (s) => {
          sound.playSuccessFanfare();
          s.rep += 100;
          return { bonusRep: 100 };
        },
      },

      // 5. Concessionária Black Market Motors · Showroom Clandestino
      {
        id: 'black_market_motors',
        name: 'Concessionária Black Market Motors',
        category: 'dealership',
        entrancePos: new THREE.Vector3(120, 0, -140),
        entranceHeading: Math.PI / 2,
        interiorCenterPos: new THREE.Vector3(135, 0, -140),
        bounds: { minX: 120, maxX: 152, minZ: -155, maxZ: -125, minY: 0, maxY: 8 },
        interactStationPos: new THREE.Vector3(138, 0, -140),
        interactPrompt: '[E] / Toque para CONSULTAR CATÁLOGO CLANDESTINO (+R$ 2.000 & +75 REP)',
        actionToast: '🏎️ Concessionária: Catálogo Clandestino de Sofia aberto! Bônus de R$ 2.000 e +75 REP!',
        icon: '🏎️',
        bannerColor: 0xff0055,
        onInteractEffect: (s) => {
          sound.playSuccessFanfare();
          s.cash += 2000;
          s.rep += 75;
          return { bonusCash: 2000, bonusRep: 75 };
        },
      },

      // 6. Clube Noturno Underground · The Line
      {
        id: 'underground_club',
        name: 'Clube Noturno Underground · The Line',
        category: 'club',
        entrancePos: new THREE.Vector3(-106, 0, -120),
        entranceHeading: -Math.PI / 2,
        interiorCenterPos: new THREE.Vector3(-120, 0, -120),
        bounds: { minX: -136, maxX: -106, minZ: -134, maxZ: -106, minY: 0, maxY: 7 },
        interactStationPos: new THREE.Vector3(-124, 0, -120),
        interactPrompt: '[E] / Toque para CURTIR A PISTA & BEBER ENERGÉTICO NITRO (+100 REP)',
        actionToast: '🪩 Clube The Line: Pista lotada e graves pesados! REP +100 e Estrelas Policiais Zeradas!',
        icon: '🪩',
        bannerColor: 0x9d4edd,
        onInteractEffect: (s) => {
          sound.playSuccessFanfare();
          s.rep += 100;
          s.nitroReserve = 100;
          return { bonusRep: 100, nitroRefilled: true };
        },
      },

      // 7. Posto SpeedWay 24/7 & Loja de Conveniência
      {
        id: 'highway_mart_247',
        name: 'Posto SpeedWay 24/7 & Conveniência',
        category: 'convenience',
        entrancePos: new THREE.Vector3(-35, 0, 120),
        entranceHeading: 0,
        interiorCenterPos: new THREE.Vector3(-35, 0, 134),
        bounds: { minX: -50, maxX: -20, minZ: 120, maxZ: 148, minY: 0, maxY: 7 },
        interactStationPos: new THREE.Vector3(-35, 0, 136),
        interactPrompt: '[E] / Toque para ABASTECER NITRO & COMPRAR KIT (+R$ 1.500)',
        actionToast: '⛽ SpeedWay 24/7: Nitro 100% abastecido e R$ 1.500 de patrocínio recebido!',
        icon: '⛽',
        bannerColor: 0x00f0ff,
        onInteractEffect: (s) => {
          sound.playWrenchToolSound();
          s.cash += 1500;
          s.nitroReserve = 100;
          s.health = 100;
          return { bonusCash: 1500, nitroRefilled: true, healthRestored: true };
        },
      },
      // 8. Mansão de Mafioso: La Casa de Hermanos (Luca & Miguel)
      {
        id: 'la_casa_de_hermanos',
        name: 'La Casa de Hermanos · Mansão de Luca & Miguel',
        category: 'house',
        entrancePos: new THREE.Vector3(96, 0, 56),
        entranceHeading: Math.PI / 2,
        interiorCenterPos: new THREE.Vector3(116, 0, 56),
        bounds: { minX: 98, maxX: 152, minZ: 34, maxZ: 78, minY: 0, maxY: 12 },
        interactStationPos: new THREE.Vector3(132, 0, 56),
        interactPrompt: '[E] / Toque para ACESSAR COFRE DA MÁFIA & RECARREGAR (+R$ 3.500 & +120 REP)',
        actionToast: '🎩 La Casa de Hermanos: Saúde 100%, Nitro cheio e +R$ 3.500 (+120 REP) do cofre!',
        icon: '🎩',
        bannerColor: 0xffd60a,
        onInteractEffect: (s) => {
          sound.playSuccessFanfare();
          s.health = 100;
          s.nitroReserve = 100;
          s.cash += 3500;
          s.rep += 120;
          return { healthRestored: true, nitroRefilled: true, bonusCash: 3500, bonusRep: 120 };
        },
      },
    ];

    // Build 3D physical structures & interiors
    this.buildGarage3D();
    this.buildHouse3D();
    this.buildDiner3D();
    this.buildObservatory3D();
    this.buildDealership3D();
    this.buildClub3D();
    this.buildConvenienceMart3D();
    this.buildMafiosoMansion3D();
  }

  // --- 1. Oficina Tuning 3D Model ---
  private buildGarage3D() {
    const loc = this.locations[0];
    const bGroup = new THREE.Group();
    bGroup.position.set(-80, 0, 18);

    // Concrete Workshop Floor
    const floorGeo = new THREE.BoxGeometry(28, 0.4, 22);
    floorGeo.translate(0, 0.2, 0);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x22262e,
      roughness: 0.5,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    bGroup.add(floor);

    // Hazard Yellow Strip at entrance threshold
    const hazardGeo = new THREE.BoxGeometry(0.8, 0.42, 10);
    hazardGeo.translate(13.8, 0.21, 0);
    const hazardMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    const hazardStrip = new THREE.Mesh(hazardGeo, hazardMat);
    bGroup.add(hazardStrip);

    // Walls (North, South, West - East has wide open entrance)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x333b47, roughness: 0.8 });
    const wallGeoN = new THREE.BoxGeometry(28, 6.5, 0.8);
    wallGeoN.translate(0, 3.25, -10.6);
    const wallN = new THREE.Mesh(wallGeoN, wallMat);

    const wallGeoS = new THREE.BoxGeometry(28, 6.5, 0.8);
    wallGeoS.translate(0, 3.25, 10.6);
    const wallS = new THREE.Mesh(wallGeoS, wallMat);

    const wallGeoW = new THREE.BoxGeometry(0.8, 6.5, 22);
    wallGeoW.translate(-13.6, 3.25, 0);
    const wallW = new THREE.Mesh(wallGeoW, wallMat);

    // East facade with wide open roller door entrance
    const wallGeoE1 = new THREE.BoxGeometry(0.8, 6.5, 6);
    wallGeoE1.translate(13.6, 3.25, -8);
    const wallE1 = new THREE.Mesh(wallGeoE1, wallMat);

    const wallGeoE2 = new THREE.BoxGeometry(0.8, 6.5, 6);
    wallGeoE2.translate(13.6, 3.25, 8);
    const wallE2 = new THREE.Mesh(wallGeoE2, wallMat);

    const wallGeoETop = new THREE.BoxGeometry(0.8, 2.0, 10);
    wallGeoETop.translate(13.6, 5.5, 0);
    const wallETop = new THREE.Mesh(wallGeoETop, wallMat);

    // Ceiling with industrial girders
    const ceilingGeo = new THREE.BoxGeometry(28, 0.5, 22);
    ceilingGeo.translate(0, 6.75, 0);
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.9 });
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);

    bGroup.add(wallN, wallS, wallW, wallE1, wallE2, wallETop, ceiling);

    // 2-Post Car Lift with Sports Car Chassis
    const liftMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.7, roughness: 0.3 });
    const postGeo = new THREE.BoxGeometry(0.4, 4.2, 0.4);
    const postL = new THREE.Mesh(postGeo, liftMat);
    postL.position.set(-2, 2.1, -2.6);
    const postR = new THREE.Mesh(postGeo, liftMat);
    postR.position.set(-2, 2.1, 2.6);

    const armGeo = new THREE.BoxGeometry(4.2, 0.25, 0.3);
    const armL = new THREE.Mesh(armGeo, liftMat);
    armL.position.set(-2, 1.8, -2.4);
    const armR = new THREE.Mesh(armGeo, liftMat);
    armR.position.set(-2, 1.8, 2.4);

    // Lifted sports car body on the lift
    const carChassis = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 1.1, 2.0),
      new THREE.MeshStandardMaterial({ color: 0xff0055, metalness: 0.9, roughness: 0.2 })
    );
    carChassis.position.set(-2, 2.4, 0);
    bGroup.add(postL, postR, armL, armR, carChassis);

    // Tool Chests, Engine Hoist & Workbench Station
    const toolMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.6, roughness: 0.4 });
    const toolBox = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 1.0), toolMat);
    toolBox.position.set(-8, 0.8, -9.5);

    const workBench = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 1.2, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.4, roughness: 0.6 })
    );
    workBench.position.set(-4, 0.6, 9.5);

    // Laptop on workbench
    const laptop = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.05, 0.45),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    laptop.position.set(-4, 1.24, 9.5);

    // Tire stack
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    for (let t = 0; t < 4; t++) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 14), tireMat);
      tire.position.set(-11, 0.18 + t * 0.36, -8.5);
      bGroup.add(tire);
    }

    // Neon Interior Lighting
    const neonMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const neonBar1 = new THREE.Mesh(new THREE.BoxGeometry(16, 0.15, 0.3), neonMat);
    neonBar1.position.set(0, 6.4, -4);
    const neonBar2 = new THREE.Mesh(new THREE.BoxGeometry(16, 0.15, 0.3), neonMat);
    neonBar2.position.set(0, 6.4, 4);

    const garageLight = new THREE.PointLight(0x00f0ff, 2.2, 28);
    garageLight.position.set(0, 5.5, 0);

    bGroup.add(toolBox, workBench, laptop, neonBar1, neonBar2, garageLight);

    // Exterior Entrance Sign
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 1.8, 9.0),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 })
    );
    signBoard.position.set(13.9, 5.5, 0);

    const signNeon = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 1.4, 8.6),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    signNeon.position.set(14.0, 5.5, 0);
    bGroup.add(signBoard, signNeon);

    this.group.add(bGroup);
    this.createEntranceMarker(loc);
  }

  // --- 2. Casa de Luca & Miguel 3D Model ---
  private buildHouse3D() {
    const loc = this.locations[1];
    const bGroup = new THREE.Group();
    bGroup.position.set(-214, 0, 110);

    // Hardwood Living Room Floor
    const floorGeo = new THREE.BoxGeometry(26, 0.35, 22);
    floorGeo.translate(0, 0.175, 0);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x78350f, // warm hardwood
      roughness: 0.45,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    bGroup.add(floor);

    // Living Room Rug
    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 6),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 })
    );
    rug.rotateX(-Math.PI / 2);
    rug.position.set(0, 0.37, 0);
    bGroup.add(rug);

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.7 });
    const wallN = new THREE.Mesh(new THREE.BoxGeometry(26, 5.5, 0.6), wallMat);
    wallN.position.set(0, 2.75, -10.7);
    const wallS = new THREE.Mesh(new THREE.BoxGeometry(26, 5.5, 0.6), wallMat);
    wallS.position.set(0, 2.75, 10.7);
    const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.5, 22), wallMat);
    wallW.position.set(-12.7, 2.75, 0);

    // East wall with front door opening (4m opening)
    const wallE1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.5, 8.5), wallMat);
    wallE1.position.set(12.7, 2.75, -6.5);
    const wallE2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.5, 8.5), wallMat);
    wallE2.position.set(12.7, 2.75, 6.5);
    const wallETop = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.5, 5), wallMat);
    wallETop.position.set(12.7, 4.25, 0);

    // Roof
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(27, 0.6, 23),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 })
    );
    roof.position.set(0, 5.8, 0);
    bGroup.add(wallN, wallS, wallW, wallE1, wallE2, wallETop, roof);

    // Furniture: Sectional Couch & Glass Coffee Table
    const couchMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.75 });
    const couchMain = new THREE.Mesh(new THREE.BoxGeometry(6.5, 1.1, 2.2), couchMat);
    couchMain.position.set(0, 0.55, -2.4);

    const couchSide = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 4.0), couchMat);
    couchSide.position.set(-3.2, 0.55, 0.6);

    const coffeeTable = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.55, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.7 })
    );
    coffeeTable.position.set(0, 0.6, 0.6);
    bGroup.add(couchMain, couchSide, coffeeTable);

    // Widescreen TV Display on Media Unit
    const mediaUnit = new THREE.Mesh(
      new THREE.BoxGeometry(7.0, 0.9, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 })
    );
    mediaUnit.position.set(0, 0.45, 9.8);

    const tvScreen = new THREE.Mesh(
      new THREE.BoxGeometry(5.8, 3.2, 0.15),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff }) // Glowing drift replay screen
    );
    tvScreen.position.set(0, 2.8, 9.7);
    bGroup.add(mediaUnit, tvScreen);

    // Drift Trophies Display Case
    const trophyCase = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 4.2, 4.0),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.8 })
    );
    trophyCase.position.set(-11.8, 2.1, -4.0);

    const trophyGold = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.18, 0.75, 10),
      new THREE.MeshStandardMaterial({ color: 0xffd60a, metalness: 0.95, roughness: 0.15 })
    );
    trophyGold.position.set(-11.8, 3.1, -4.0);
    bGroup.add(trophyCase, trophyGold);

    // Cozy Warm Ceiling Light
    const houseLight = new THREE.PointLight(0xfff5e6, 2.0, 24);
    houseLight.position.set(0, 4.8, 0);
    bGroup.add(houseLight);

    // Front Porch Welcome Lamp & Planter
    const porchLight = new THREE.PointLight(0xffd60a, 1.8, 14);
    porchLight.position.set(13.6, 3.2, 0);
    bGroup.add(porchLight);

    this.group.add(bGroup);
    this.createEntranceMarker(loc);
  }

  // --- 3. Midnight Diner 3D Model ---
  private buildDiner3D() {
    const loc = this.locations[2];
    const bGroup = new THREE.Group();
    bGroup.position.set(106, 0, -82);

    // Checkered Tile Floor
    const floorGeo = new THREE.BoxGeometry(26, 0.35, 22);
    floorGeo.translate(0, 0.175, 0);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.25,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    bGroup.add(floor);

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });
    const wallN = new THREE.Mesh(new THREE.BoxGeometry(26, 5.5, 0.6), wallMat);
    wallN.position.set(0, 2.75, -10.7);
    const wallS = new THREE.Mesh(new THREE.BoxGeometry(26, 5.5, 0.6), wallMat);
    wallS.position.set(0, 2.75, 10.7);
    const wallE = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.5, 22), wallMat);
    wallE.position.set(12.7, 2.75, 0);

    // West facade: large glass window + wide doorway opening
    const wallW1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.5, 8.0), wallMat);
    wallW1.position.set(-12.7, 2.75, -6.5);
    const wallW2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.5, 8.0), wallMat);
    wallW2.position.set(-12.7, 2.75, 6.5);
    const wallWTop = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.2, 6.0), wallMat);
    wallWTop.position.set(-12.7, 4.4, 0);

    // Panoramic glass window
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 3.2, 6.0),
      new THREE.MeshStandardMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.35, roughness: 0.1 })
    );
    glass.position.set(-12.7, 2.0, -6.5);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(27, 0.6, 23),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 })
    );
    roof.position.set(0, 5.8, 0);
    bGroup.add(wallN, wallS, wallE, wallW1, wallW2, wallWTop, glass, roof);

    // Diner Long Counter Bar & Stools
    const barMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.3 });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.25, 14), barMat);
    counter.position.set(2.0, 0.625, 0);
    bGroup.add(counter);

    // 5 Red Vinyl Counter Stools
    const stoolGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.8, 12);
    const stoolMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.4, roughness: 0.5 });
    for (let z = -5; z <= 5; z += 2.5) {
      const stool = new THREE.Mesh(stoolGeo, stoolMat);
      stool.position.set(-0.2, 0.4, z);
      bGroup.add(stool);
    }

    // Espresso Machine & Coffee Dispenser
    const coffeeMachine = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.95, 1.8),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 })
    );
    coffeeMachine.position.set(2.0, 1.7, 0);
    bGroup.add(coffeeMachine);

    // Neon Lights (Pink & Cyan)
    const neonPink = new THREE.Mesh(
      new THREE.BoxGeometry(16, 0.15, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xff007f })
    );
    neonPink.position.set(0, 5.4, 0);

    const dinerLight = new THREE.PointLight(0xff007f, 2.0, 26);
    dinerLight.position.set(0, 4.8, 0);
    bGroup.add(neonPink, dinerLight);

    // Exterior Neon Sign
    const extSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 1.8, 9.5),
      new THREE.MeshBasicMaterial({ color: 0xff007f })
    );
    extSign.position.set(-13.0, 5.5, 0);
    bGroup.add(extSign);

    this.group.add(bGroup);
    this.createEntranceMarker(loc);
  }

  // --- 4. Torre Panorâmica / Cobertura Observatório 360° ---
  private buildObservatory3D() {
    const loc = this.locations[3];
    const bGroup = new THREE.Group();
    bGroup.position.set(72, 85, 110); // High rooftop penthouse terrace!

    // Penthouse Terrace Deck
    const deckGeo = new THREE.BoxGeometry(26, 0.8, 26);
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.3,
      metalness: 0.6,
    });
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.receiveShadow = true;
    bGroup.add(deck);

    // Transparent Glass Balustrades all around for 360° panoramic view
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
      metalness: 0.2,
    });
    const railN = new THREE.Mesh(new THREE.BoxGeometry(26, 1.4, 0.2), glassMat);
    railN.position.set(0, 1.1, -12.9);
    const railS = new THREE.Mesh(new THREE.BoxGeometry(26, 1.4, 0.2), glassMat);
    railS.position.set(0, 1.1, 12.9);
    const railE = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 26), glassMat);
    railE.position.set(12.9, 1.1, 0);
    const railW = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 26), glassMat);
    railW.position.set(-12.9, 1.1, 0);
    bGroup.add(railN, railS, railE, railW);

    // Central Elevator Portal Shaft
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(6, 4.5, 6), shaftMat);
    shaft.position.set(0, 2.25, 0);

    // Glowing Elevator Door
    const eleDoor = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 3.2, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x9d4edd })
    );
    eleDoor.position.set(0, 1.6, 3.05);
    bGroup.add(shaft, eleDoor);

    // Helipad 'H' circle marking on roof deck
    const hPad = new THREE.Mesh(
      new THREE.RingGeometry(4.5, 5.2, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd60a, side: THREE.DoubleSide })
    );
    hPad.rotateX(-Math.PI / 2);
    hPad.position.set(0, 0.45, -6);
    bGroup.add(hPad);

    // Rooftop Observation Beacon Light
    const beacon = new THREE.PointLight(0x9d4edd, 2.5, 45);
    beacon.position.set(0, 6, 0);
    bGroup.add(beacon);

    this.group.add(bGroup);

    // Ground-level entrance elevator marker
    this.createEntranceMarker(loc);
  }

  // --- 5. Concessionária Black Market Motors 3D Model ---
  private buildDealership3D() {
    const loc = this.locations[4];
    const bGroup = new THREE.Group();
    bGroup.position.set(135, 0, -140);

    // Polished Showroom Floor (Luxury White / Dark Gray Marble)
    const floorGeo = new THREE.BoxGeometry(32, 0.4, 28);
    floorGeo.translate(0, 0.2, 0);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.15,
      metalness: 0.3,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    bGroup.add(floor);

    // Walls (North, South, East - West has floor-to-ceiling glass showroom windows)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7 });
    const wallN = new THREE.Mesh(new THREE.BoxGeometry(32, 7.0, 0.8), wallMat);
    wallN.position.set(0, 3.5, -13.6);
    const wallS = new THREE.Mesh(new THREE.BoxGeometry(32, 7.0, 0.8), wallMat);
    wallS.position.set(0, 3.5, 13.6);
    const wallE = new THREE.Mesh(new THREE.BoxGeometry(0.8, 7.0, 28), wallMat);
    wallE.position.set(15.6, 3.5, 0);

    // West Facade with large entrance opening and showroom glass
    const wallW1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 7.0, 8.0), wallMat);
    wallW1.position.set(-15.6, 3.5, -10.0);
    const wallW2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 7.0, 8.0), wallMat);
    wallW2.position.set(-15.6, 3.5, 10.0);
    const wallWTop = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.2, 12.0), wallMat);
    wallWTop.position.set(-15.6, 5.9, 0);

    // Showroom Glass Panels
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.3,
      roughness: 0.05,
      metalness: 0.1,
    });
    const glass1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 4.5, 7.6), glassMat);
    glass1.position.set(-15.5, 2.4, -9.8);
    const glass2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 4.5, 7.6), glassMat);
    glass2.position.set(-15.5, 2.4, 9.8);

    // Roof
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(33, 0.6, 29),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 })
    );
    roof.position.set(0, 7.3, 0);
    bGroup.add(wallN, wallS, wallE, wallW1, wallW2, wallWTop, glass1, glass2, roof);

    // Central Rotating Showroom Turntable Podium
    const turntableGeo = new THREE.CylinderGeometry(4.8, 5.0, 0.45, 32);
    const turntableMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.8,
      roughness: 0.2,
    });
    const turntable = new THREE.Mesh(turntableGeo, turntableMat);
    turntable.position.set(0, 0.45, 0);
    bGroup.add(turntable);

    // Display Sports Car on Podium (Sleek Supercar Geometry)
    const carMat = new THREE.MeshStandardMaterial({
      color: 0xff0055,
      metalness: 0.95,
      roughness: 0.1,
    });
    const carBody = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.0, 2.1), carMat);
    carBody.position.set(0, 1.25, 0);
    const carCabin = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.7, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 })
    );
    carCabin.position.set(-0.2, 1.8, 0);
    const carWing = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 2.2), carMat);
    carWing.position.set(-2.2, 1.7, 0);
    bGroup.add(carBody, carCabin, carWing);

    // Sofia's Office & Catalog Terminal Desk
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.1, 1.6), deskMat);
    desk.position.set(8.0, 0.55, -8.0);

    const monitor = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.8, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    monitor.position.set(8.0, 1.5, -8.0);
    bGroup.add(desk, monitor);

    // Showroom Spotlights & Neon Fixtures
    const dealerLight1 = new THREE.PointLight(0xff0055, 2.2, 28);
    dealerLight1.position.set(0, 6.2, 0);
    const dealerLight2 = new THREE.PointLight(0x00f0ff, 2.0, 26);
    dealerLight2.position.set(6, 6.2, -6);
    bGroup.add(dealerLight1, dealerLight2);

    // Exterior Dealership Signboard
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 1.8, 11),
      new THREE.MeshBasicMaterial({ color: 0xff0055 })
    );
    sign.position.set(-15.8, 6.2, 0);
    bGroup.add(sign);

    this.group.add(bGroup);
    this.createEntranceMarker(loc);
  }

  // --- 6. Clube Noturno Underground The Line 3D Model ---
  private buildClub3D() {
    const loc = this.locations[5];
    const bGroup = new THREE.Group();
    bGroup.position.set(-120, 0, -120);

    // Dark Club Dance Floor
    const floorGeo = new THREE.BoxGeometry(28, 0.35, 26);
    floorGeo.translate(0, 0.175, 0);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x05070a,
      roughness: 0.3,
      metalness: 0.4,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    bGroup.add(floor);

    // Dance Floor Center Illuminated Grid Tiles
    const danceTileGeo = new THREE.BoxGeometry(12, 0.38, 12);
    const danceTileMat = new THREE.MeshStandardMaterial({
      color: 0x9d4edd,
      roughness: 0.2,
      metalness: 0.6,
    });
    const danceTile = new THREE.Mesh(danceTileGeo, danceTileMat);
    danceTile.position.set(0, 0.2, 0);
    bGroup.add(danceTile);

    // Soundproof Enclosure Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
    const wallN = new THREE.Mesh(new THREE.BoxGeometry(28, 6.0, 0.8), wallMat);
    wallN.position.set(0, 3.0, -12.6);
    const wallS = new THREE.Mesh(new THREE.BoxGeometry(28, 6.0, 0.8), wallMat);
    wallS.position.set(0, 3.0, 12.6);
    const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6.0, 26), wallMat);
    wallW.position.set(-13.6, 3.0, 0);

    // East wall with entrance doorway (4m opening)
    const wallE1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6.0, 10.5), wallMat);
    wallE1.position.set(13.6, 3.0, -7.5);
    const wallE2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6.0, 10.5), wallMat);
    wallE2.position.set(13.6, 3.0, 7.5);
    const wallETop = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.5, 5.0), wallMat);
    wallETop.position.set(13.6, 4.75, 0);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(29, 0.6, 27),
      new THREE.MeshStandardMaterial({ color: 0x030712, roughness: 0.9 })
    );
    roof.position.set(0, 6.3, 0);
    bGroup.add(wallN, wallS, wallW, wallE1, wallE2, wallETop, roof);

    // Elevated DJ Stage & Turntable Console
    const stage = new THREE.Mesh(
      new THREE.BoxGeometry(10, 1.2, 4.2),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 })
    );
    stage.position.set(-8.0, 0.6, 0);

    const djMixer = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.35, 1.2),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    djMixer.position.set(-8.0, 1.35, 0);

    // Subwoofer Speaker Towers
    const speakerMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 });
    const spkL = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.8, 1.6), speakerMat);
    spkL.position.set(-8.0, 1.9, -3.2);
    const spkR = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.8, 1.6), speakerMat);
    spkR.position.set(-8.0, 1.9, 3.2);
    bGroup.add(stage, djMixer, spkL, spkR);

    // Equalizer LED Light Strips on DJ Back Wall
    const eqColors = [0x00f0ff, 0x39ff14, 0xffd60a, 0xff0055, 0x9d4edd];
    for (let c = 0; c < 5; c++) {
      const eqBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 1.5 + Math.sin(c) * 1.2, 1.0),
        new THREE.MeshBasicMaterial({ color: eqColors[c] })
      );
      eqBar.position.set(-13.0, 3.2, -2.5 + c * 1.25);
      bGroup.add(eqBar);
    }

    // VIP Lounge Leather Booths
    const boothMat = new THREE.MeshStandardMaterial({ color: 0x701a75, roughness: 0.5 });
    const booth1 = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 7.0), boothMat);
    booth1.position.set(6.0, 0.55, -8.5);
    const booth2 = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 7.0), boothMat);
    booth2.position.set(6.0, 0.55, 8.5);
    bGroup.add(booth1, booth2);

    // Club Neon Lighting (Ultraviolet & Magenta)
    const clubLight = new THREE.PointLight(0x9d4edd, 2.8, 30);
    clubLight.position.set(0, 5.2, 0);
    const clubLight2 = new THREE.PointLight(0xff0055, 2.2, 24);
    clubLight2.position.set(-6, 5.0, 0);
    bGroup.add(clubLight, clubLight2);

    // Exterior Entrance Neon Sign
    const clubSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 1.8, 8.0),
      new THREE.MeshBasicMaterial({ color: 0x9d4edd })
    );
    clubSign.position.set(13.8, 5.2, 0);
    bGroup.add(clubSign);

    this.group.add(bGroup);
    this.createEntranceMarker(loc);
  }

  // --- 7. Posto SpeedWay 24/7 & Loja de Conveniência 3D Model ---
  private buildConvenienceMart3D() {
    const loc = this.locations[6];
    const bGroup = new THREE.Group();
    bGroup.position.set(-35, 0, 134);

    // Forecourt & Store Floor
    const floorGeo = new THREE.BoxGeometry(30, 0.35, 26);
    floorGeo.translate(0, 0.175, 0);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.6,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    bGroup.add(floor);

    // Convenience Store Building Box (Back half of site)
    const storeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
    const wallN = new THREE.Mesh(new THREE.BoxGeometry(26, 5.5, 0.6), storeMat);
    wallN.position.set(0, 2.75, 11.7);
    const wallE = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.5, 12), storeMat);
    wallE.position.set(12.7, 2.75, 6.0);
    const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.5, 12), storeMat);
    wallW.position.set(-12.7, 2.75, 6.0);

    // Front store facade with sliding glass doors (facing North towards pump island)
    const wallS1 = new THREE.Mesh(new THREE.BoxGeometry(9.0, 5.5, 0.6), storeMat);
    wallS1.position.set(-8.5, 2.75, 0);
    const wallS2 = new THREE.Mesh(new THREE.BoxGeometry(9.0, 5.5, 0.6), storeMat);
    wallS2.position.set(8.5, 2.75, 0);
    const wallSTop = new THREE.Mesh(new THREE.BoxGeometry(8.0, 2.0, 0.6), storeMat);
    wallSTop.position.set(0, 4.5, 0);

    // Front Glass Window
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(7.8, 3.4, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.3, roughness: 0.1 })
    );
    glass.position.set(0, 1.8, 0);

    const storeRoof = new THREE.Mesh(
      new THREE.BoxGeometry(27, 0.6, 13),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 })
    );
    storeRoof.position.set(0, 5.8, 6.0);
    bGroup.add(wallN, wallE, wallW, wallS1, wallS2, wallSTop, glass, storeRoof);

    // Fuel Pump Canopy (Overhead Island Canopy at front)
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.5, roughness: 0.3 });
    const canopyRoof = new THREE.Mesh(new THREE.BoxGeometry(24, 0.8, 10), canopyMat);
    canopyRoof.position.set(0, 6.0, -8.0);

    // 2 Canopy Support Steel Pillars
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.2 });
    const pillarL = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 5.8, 16), pillarMat);
    pillarL.position.set(-7.5, 2.9, -8.0);
    const pillarR = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 5.8, 16), pillarMat);
    pillarR.position.set(7.5, 2.9, -8.0);

    // Dual Gas Pump Stations with glowing fuel meters
    const pumpMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });
    const pumpL = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 1.2), pumpMat);
    pumpL.position.set(-3.5, 1.2, -8.0);
    const pumpR = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 1.2), pumpMat);
    pumpR.position.set(3.5, 1.2, -8.0);

    // Fuel Price LED Screen
    const pumpScreenL = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.6, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x39ff14 })
    );
    pumpScreenL.position.set(-3.5, 1.6, -7.35);
    const pumpScreenR = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.6, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x39ff14 })
    );
    pumpScreenR.position.set(3.5, 1.6, -7.35);

    bGroup.add(canopyRoof, pillarL, pillarR, pumpL, pumpR, pumpScreenL, pumpScreenR);

    // Store Interior: Beverage Cooler Shelves & Checkout Counter
    const coolerMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.7, roughness: 0.3 });
    const cooler = new THREE.Mesh(new THREE.BoxGeometry(16, 3.2, 1.2), coolerMat);
    cooler.position.set(0, 1.6, 10.8);

    const coolerGlass = new THREE.Mesh(
      new THREE.BoxGeometry(15.6, 2.8, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    coolerGlass.position.set(0, 1.6, 10.15);

    const checkout = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 1.1, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5 })
    );
    checkout.position.set(-6.0, 0.55, 4.0);

    const register = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.5, 0.7),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    register.position.set(-6.0, 1.35, 4.0);
    bGroup.add(cooler, coolerGlass, checkout, register);

    // Bright White Clean Store Lights & Canopy Under-Lights
    const storeLight = new THREE.PointLight(0xffffff, 2.2, 22);
    storeLight.position.set(0, 4.8, 6.0);
    const canopyLight = new THREE.PointLight(0xffffff, 2.5, 25);
    canopyLight.position.set(0, 5.2, -8.0);
    bGroup.add(storeLight, canopyLight);

    // Exterior Neon Signboard "SPEEDWAY 24/7"
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(12, 1.6, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    sign.position.set(0, 6.2, 0.4);
    bGroup.add(sign);

    this.group.add(bGroup);
    this.createEntranceMarker(loc);
  }

  // --- 8. La Casa de Hermanos · Mansão de Mafioso (Luca & Miguel) ---
  private buildMafiosoMansion3D() {
    const loc = this.locations[7];
    const mGroup = new THREE.Group();
    mGroup.position.set(125, 0, 56);

    // Grand Estate Courtyard Pavement (extends West to X=72 in world space -> local -53..-27)
    const courtyardMat = new THREE.MeshStandardMaterial({
      color: 0x3b3632,
      roughness: 0.78,
      metalness: 0.08,
    });
    const courtyard = new THREE.Mesh(new THREE.BoxGeometry(28, 0.14, 44), courtyardMat);
    courtyard.position.set(-40, 0.07, 0);
    courtyard.receiveShadow = true;
    mGroup.add(courtyard);

    // Red Velvet Carpet Driveway Strip leading straight to Main Portico
    const carpetMat = new THREE.MeshStandardMaterial({ color: 0x8b001e, roughness: 0.7 });
    const drivewayCarpet = new THREE.Mesh(new THREE.BoxGeometry(26, 0.16, 4.6), carpetMat);
    drivewayCarpet.position.set(-39, 0.085, 0);
    mGroup.add(drivewayCarpet);

    // Estate Front Gate Pillars & Wrought-Iron Perimeter Walls (x_world = 72 -> local -53)
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xd8cbb8, roughness: 0.65 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x16181d, metalness: 0.8, roughness: 0.3 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd60a, metalness: 0.9, roughness: 0.2 });

    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(1.8, 5.2, 1.8), stoneMat);
    pillarL.position.set(-53, 2.6, -7.2);
    const pillarR = new THREE.Mesh(new THREE.BoxGeometry(1.8, 5.2, 1.8), stoneMat);
    pillarR.position.set(-53, 2.6, 7.2);
    const pillarCapL = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 10), goldMat);
    pillarCapL.position.set(-53, 5.65, -7.2);
    const pillarCapR = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 10), goldMat);
    pillarCapR.position.set(-53, 5.65, 7.2);

    const fenceWallN = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.6, 15.0), stoneMat);
    fenceWallN.position.set(-53, 1.3, -15.5);
    const fenceWallS = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.6, 15.0), stoneMat);
    fenceWallS.position.set(-53, 1.3, 15.5);

    const ironArch = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.65, 15.0), ironMat);
    ironArch.position.set(-53, 5.1, 0);
    mGroup.add(pillarL, pillarR, pillarCapL, pillarCapR, fenceWallN, fenceWallS, ironArch);

    // Twin Flanking Courtyard Marble Fountains + Cypress Planters (at local x=-39, z=±13.5 so driveway stays open!)
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.5 });
    [-13.5, 13.5].forEach((fz) => {
      const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 0.9, 16), stoneMat);
      basin.position.set(-39, 0.45, fz);
      const water = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.25, 16), waterMat);
      water.position.set(-39, 0.85, fz);
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.8, 2.2, 12), stoneMat);
      spire.position.set(-39, 1.6, fz);
      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), goldMat);
      finial.position.set(-39, 2.8, fz);
      mGroup.add(basin, water, spire, finial);
    });

    // Mansion Foundation & Cream Marble Interior Floor (52m x 42m)
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xede4d5, roughness: 0.22, metalness: 0.1 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(52, 0.45, 42), floorMat);
    floor.position.set(0, 0.225, 0);
    floor.receiveShadow = true;
    mGroup.add(floor);

    // Grand Marble Portico Steps & 4 Tuscan Columns (West facade at local x=-26.5)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf4ead8, roughness: 0.65 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x2b1d14, roughness: 0.5 });
    const roofTileMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.65 });

    const colGeo = new THREE.CylinderGeometry(0.55, 0.68, 7.6, 14);
    [-9.5, -4.2, 4.2, 9.5].forEach((cz) => {
      const col = new THREE.Mesh(colGeo, stoneMat);
      col.position.set(-27.2, 4.0, cz);
      col.castShadow = true;
      mGroup.add(col);
    });

    // Portico Canopy Roof & Pediment
    const porticoRoof = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.9, 22), trimMat);
    porticoRoof.position.set(-26.2, 8.2, 0);
    mGroup.add(porticoRoof);

    // Canvas Signboard: "LA CASA DE HERMANOS" facing spawn (-X)
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 1024;
    signCanvas.height = 192;
    const ctx = signCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#120d0a';
      ctx.fillRect(0, 0, signCanvas.width, signCanvas.height);
      ctx.strokeStyle = '#ffd60a';
      ctx.lineWidth = 10;
      ctx.strokeRect(8, 8, signCanvas.width - 16, signCanvas.height - 16);
      ctx.fillStyle = '#ffd60a';
      ctx.font = 'bold 58px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LA CASA DE HERMANOS', signCanvas.width / 2, 82);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 28px Arial, sans-serif';
      ctx.fillText('MANSÃO DE LUCA & MIGUEL · COSA NOSTRA', signCanvas.width / 2, 144);
    }
    const signTex = new THREE.CanvasTexture(signCanvas);
    signTex.colorSpace = THREE.SRGBColorSpace;
    const signMat = new THREE.MeshBasicMaterial({ map: signTex });
    this.sharedMaterials.push(signMat);

    const signPlaque = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.2, 12.0), signMat);
    signPlaque.position.set(-28.8, 9.5, 0);
    mGroup.add(signPlaque);

    // Main Mansion Walls (2-story Tuscan Villa)
    const wallN = new THREE.Mesh(new THREE.BoxGeometry(52, 9.2, 0.9), wallMat);
    wallN.position.set(0, 4.6, -20.5);
    const wallS = new THREE.Mesh(new THREE.BoxGeometry(52, 9.2, 0.9), wallMat);
    wallS.position.set(0, 4.6, 20.5);
    const wallE = new THREE.Mesh(new THREE.BoxGeometry(0.9, 9.2, 42), wallMat);
    wallE.position.set(25.5, 4.6, 0);

    // West Facade with wide grand double doorway opening (8m wide)
    const wallW1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 9.2, 16.5), wallMat);
    wallW1.position.set(-25.5, 4.6, -12.25);
    const wallW2 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 9.2, 16.5), wallMat);
    wallW2.position.set(-25.5, 4.6, 12.25);
    const wallWTop = new THREE.Mesh(new THREE.BoxGeometry(0.9, 4.0, 9.0), wallMat);
    wallWTop.position.set(-25.5, 7.2, 0);

    // Warm glowing upper-floor estate windows on West facade
    const windowGlowMat = new THREE.MeshBasicMaterial({ color: 0xffd584 });
    [-14, -9, 9, 14].forEach((wz) => {
      const winMesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.4, 2.6), windowGlowMat);
      winMesh.position.set(-26.0, 6.2, wz);
      mGroup.add(winMesh);
    });

    // Terracotta Villa Roof & Upper Penthouse Cap
    const mainRoof = new THREE.Mesh(new THREE.BoxGeometry(54, 1.0, 44), roofTileMat);
    mainRoof.position.set(0, 9.6, 0);
    const upperVilla = new THREE.Mesh(new THREE.BoxGeometry(28, 3.4, 24), wallMat);
    upperVilla.position.set(4, 11.4, 0);
    const upperRoof = new THREE.Mesh(new THREE.BoxGeometry(30, 0.9, 26), roofTileMat);
    upperRoof.position.set(4, 13.4, 0);

    mGroup.add(wallN, wallS, wallE, wallW1, wallW2, wallWTop, mainRoof, upperVilla, upperRoof);

    // Interior: Red Carpet Runner, Mahogany Don's Desk, Gold Bullion Vault & Velvet Lounges
    const interiorCarpet = new THREE.Mesh(new THREE.BoxGeometry(38, 0.48, 5.0), carpetMat);
    interiorCarpet.position.set(-5, 0.24, 0);
    mGroup.add(interiorCarpet);

    const mahoganyMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.35, metalness: 0.15 });
    const donDesk = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.25, 6.8), mahoganyMat);
    donDesk.position.set(7.5, 0.625, 0);

    const bankerLamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.35, 0.55, 10),
      new THREE.MeshBasicMaterial({ color: 0x22c55e })
    );
    bankerLamp.position.set(7.2, 1.5, -2.0);

    // Mafia Vault Gold Bullion Stack behind Don's Desk
    const vaultSafe = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 4.2, 5.2),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.25 })
    );
    vaultSafe.position.set(18.5, 2.1, 0);
    const goldStack = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 2.2), goldMat);
    goldStack.position.set(16.2, 0.9, 0);

    // Crimson Velvet Sofas & Poker Table in Lounge
    const sofa1 = new THREE.Mesh(new THREE.BoxGeometry(6.0, 1.15, 2.4), carpetMat);
    sofa1.position.set(-4, 0.575, -10.5);
    const sofa2 = new THREE.Mesh(new THREE.BoxGeometry(6.0, 1.15, 2.4), carpetMat);
    sofa2.position.set(-4, 0.575, 10.5);

    // Chandelier & Warm Mafioso Lighting
    const chandelierRing = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.18, 8, 20), goldMat);
    chandelierRing.rotateX(Math.PI / 2);
    chandelierRing.position.set(0, 7.6, 0);

    const interiorLight = new THREE.PointLight(0xffd68a, 2.8, 36);
    interiorLight.position.set(0, 7.0, 0);
    const porticoLight = new THREE.PointLight(0xffc966, 2.2, 26);
    porticoLight.position.set(-29, 6.5, 0);

    mGroup.add(
      donDesk,
      bankerLamp,
      vaultSafe,
      goldStack,
      sofa1,
      sofa2,
      chandelierRing,
      interiorLight,
      porticoLight
    );

    this.group.add(mGroup);
    this.createEntranceMarker(loc);
  }

  // --- Visual Entrance Marker Rings & Icons ---
  private createEntranceMarker(loc: AccessibleLocationDef) {
    const markerGroup = new THREE.Group();
    markerGroup.position.copy(loc.entrancePos);

    // Rotating Hologram Ring on Ground
    const ringGeo = new THREE.TorusGeometry(1.65, 0.09, 8, 28);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: loc.bannerColor,
      transparent: true,
      opacity: 0.8,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = 0.15;
    markerGroup.add(ringMesh);
    this.markerRings.push(ringMesh);

    // Overhead Floating Beacon Pin
    const beaconGeo = new THREE.ConeGeometry(0.4, 0.85, 4);
    beaconGeo.rotateX(Math.PI);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: loc.bannerColor,
      transparent: true,
      opacity: 0.9,
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = 2.8;
    markerGroup.add(beacon);
    this.markerIcons.push(beacon);

    this.group.add(markerGroup);
  }

  /**
   * Checks if player position is near an entrance or inside an accessible location.
   */
  public checkPlayerProximity(
    playerPos: THREE.Vector3
  ): {
    nearEntrance: boolean;
    isInside: boolean;
    location: AccessibleLocationDef | null;
    canInteract: boolean;
  } {
    // 1. Check if inside any location bounding box
    for (let i = 0; i < this.locations.length; i++) {
      const loc = this.locations[i];
      const b = loc.bounds;
      if (
        playerPos.x >= b.minX &&
        playerPos.x <= b.maxX &&
        playerPos.z >= b.minZ &&
        playerPos.z <= b.maxZ &&
        playerPos.y >= b.minY - 1.0 &&
        playerPos.y <= b.maxY + 2.0
      ) {
        this.activeInsideLocation = loc;

        // Check distance to interactive station
        const dStation = playerPos.distanceTo(loc.interactStationPos);
        return {
          nearEntrance: false,
          isInside: true,
          location: loc,
          canInteract: dStation < 4.5,
        };
      }
    }

    this.activeInsideLocation = null;

    // 2. Check if near any entrance doorway
    for (let i = 0; i < this.locations.length; i++) {
      const loc = this.locations[i];
      const dEntrance = playerPos.distanceTo(loc.entrancePos);
      if (dEntrance < 5.2) {
        return {
          nearEntrance: true,
          isInside: false,
          location: loc,
          canInteract: true,
        };
      }
    }

    return {
      nearEntrance: false,
      isInside: false,
      location: null,
      canInteract: false,
    };
  }

  /**
   * Teleports player into/out of location or uses interactive station.
   */
  public triggerLocationInteraction(
    playerPos: THREE.Vector3,
    playerState: { health: number; nitroReserve: number; cash: number; rep: number }
  ): { handled: boolean; toastText: string; teleportPos?: THREE.Vector3; teleportHeading?: number } {
    const prox = this.checkPlayerProximity(playerPos);
    if (!prox.location) {
      return { handled: false, toastText: '' };
    }

    const loc = prox.location;

    // If near entrance on the street -> step inside!
    if (prox.nearEntrance) {
      sound.playDoorEnterSound();
      return {
        handled: true,
        toastText: `🚪 Entrou em: ${loc.name}!`,
        teleportPos: loc.interiorCenterPos.clone(),
        teleportHeading: loc.entranceHeading,
      };
    }

    // If inside observatory rooftop -> take elevator back down to ground
    if (prox.isInside && loc.id === 'skyline_observatory' && playerPos.distanceTo(loc.interactStationPos) < 3.2) {
      sound.playCountdownBeep(true);
      return {
        handled: true,
        toastText: `🛗 Elevador: De volta ao térreo de Metrópole Neon!`,
        teleportPos: loc.entrancePos.clone(),
        teleportHeading: loc.entranceHeading,
      };
    }

    // If inside and near interactive station -> execute station effect!
    if (prox.isInside && prox.canInteract) {
      loc.onInteractEffect(playerState);
      return {
        handled: true,
        toastText: loc.actionToast,
      };
    }

    // Stepping back out of building to street
    if (prox.isInside) {
      sound.playDoorEnterSound();
      return {
        handled: true,
        toastText: `🚪 Saiu de: ${loc.name}!`,
        teleportPos: loc.entrancePos.clone(),
        teleportHeading: loc.entranceHeading,
      };
    }

    return { handled: false, toastText: '' };
  }

  public update(dt: number) {
    // Animate entrance markers
    const rotSpeed = dt * 1.8;
    for (let i = 0; i < this.markerRings.length; i++) {
      this.markerRings[i].rotation.z += rotSpeed;
      if (this.markerIcons[i]) {
        this.markerIcons[i].position.y = 2.8 + Math.sin(performance.now() * 0.003 + i) * 0.15;
        this.markerIcons[i].rotation.y += rotSpeed * 0.7;
      }
    }
  }

  public dispose() {
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
    for (const g of this.sharedGeometries) g.dispose();
    for (const m of this.sharedMaterials) m.dispose();
    this.sharedGeometries = [];
    this.sharedMaterials = [];
  }
}
