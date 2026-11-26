import * as THREE from 'three';
import { VehicleConfig } from '../types';

export interface VehicleMeshData {
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  wheels: THREE.Group[];
  neonMesh: THREE.Mesh | null;
  headlights: THREE.Mesh[];
  taillights: THREE.Mesh[];
  policeLights?: { blue: THREE.Mesh; red: THREE.Mesh };
  updatePoliceLights?: (time: number) => void;
  updateCustomization?: (newConfig: VehicleConfig) => void;
  applyDamageDeformation?: (damageRatio: number) => void;
  applyImpactDeformation?: (localHitDir: THREE.Vector3, impactSpeedMs: number) => void;
  updateDamageEffects?: (
    dt: number,
    speedKmh: number,
    missingWheels?: [boolean, boolean, boolean, boolean]
  ) => void;
  resetDeformation?: () => void;
  updateOccupants?: (
    dt: number,
    steerAngle: number,
    driftSlip: number,
    speedKmh: number,
    speakingRole?: 'pilot' | 'copilot' | null,
    cutTime?: number
  ) => void;
  setCabinLightIntensity?: (intensity: number) => void;
}

interface DamageZones {
  frontLeft: number;
  frontRight: number;
  frontCenter: number;
  rearLeft: number;
  rearRight: number;
  rearCenter: number;
  leftSide: number;
  rightSide: number;
  overall: number;
}

export class VehicleMeshBuilder {
  private static tireTexture: THREE.CanvasTexture | null = null;
  private static crackTexture: THREE.CanvasTexture | null = null;

  public static getTireTexture(): THREE.CanvasTexture {
    if (!this.tireTexture) {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#222225';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#111113';
      for (let y = 0; y < 128; y += 16) {
        ctx.fillRect(0, y, 128, 6);
        ctx.fillRect(y, 0, 6, 128);
      }
      this.tireTexture = new THREE.CanvasTexture(canvas);
      this.tireTexture.wrapS = THREE.RepeatWrapping;
      this.tireTexture.wrapT = THREE.RepeatWrapping;
      this.tireTexture.repeat.set(2, 4);
      this.tireTexture.colorSpace = THREE.SRGBColorSpace;
    }
    return this.tireTexture;
  }

  public static getCrackTexture(): THREE.CanvasTexture {
    if (!this.crackTexture) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 256, 256);

      const centers = [
        { x: 86, y: 120, r: 95 },
        { x: 185, y: 145, r: 70 },
      ];

      ctx.strokeStyle = 'rgba(225, 240, 255, 0.92)';
      for (const c of centers) {
        ctx.lineWidth = 2.0;
        for (let a = 0; a < 12; a++) {
          const ang = (a / 12) * Math.PI * 2 + (a % 2) * 0.14;
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          const midR = c.r * 0.45;
          const endR = c.r * (0.75 + (a % 3) * 0.12);
          ctx.lineTo(
            c.x + Math.cos(ang + 0.08) * midR,
            c.y + Math.sin(ang + 0.08) * midR
          );
          ctx.lineTo(c.x + Math.cos(ang) * endR, c.y + Math.sin(ang) * endR);
          ctx.stroke();
        }
        ctx.lineWidth = 1.2;
        for (const ringR of [c.r * 0.22, c.r * 0.46, c.r * 0.7]) {
          ctx.beginPath();
          ctx.arc(c.x, c.y, ringR, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      this.crackTexture = new THREE.CanvasTexture(canvas);
      this.crackTexture.colorSpace = THREE.SRGBColorSpace;
    }
    return this.crackTexture;
  }

  /**
   * Builds a high-fidelity procedural 3D vehicle composite with multi-panel
   * speed-scaled impact deformation and missing-wheel spark/hub effects.
   */
  public static createVehicleGroup(
    config: VehicleConfig,
    isPolice: boolean = false,
    policeVariant: 'cruiser' | 'interceptor' | 'swat' = 'cruiser'
  ): VehicleMeshData {
    const root = new THREE.Group();
    root.name = `Vehicle_${config.name}`;

    // Dimensions
    const isSwat = isPolice && policeVariant === 'swat';
    const isSuper = config.category === 'super' || config.category === 'hyper';

    const length = isSwat ? 4.9 : isSuper ? 4.6 : 4.4;
    const width = isSwat ? 2.2 : isSuper ? 2.05 : 1.95;
    const height = isSwat ? 1.7 : isSuper ? 1.15 : 1.32;
    const groundClearance = isSwat ? 0.38 : isSuper ? 0.22 : 0.26;

    // Materials
    const bodyColor = isPolice
      ? isSwat
        ? 0x111622
        : 0x0c0d12
      : parseInt(config.color.replace('#', '0x'));
    const bodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor,
      metalness: isSwat ? 0.4 : 0.85,
      roughness: isSwat ? 0.6 : 0.18,
      envMapIntensity: 1.2,
    });

    const blackTrimMat = new THREE.MeshStandardMaterial({
      color: 0x141518,
      roughness: 0.6,
      metalness: 0.3,
    });

    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x262930,
      roughness: 0.45,
      metalness: 0.78,
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe8edf5,
      metalness: 0.95,
      roughness: 0.08,
    });

    const engineAccentMat = new THREE.MeshStandardMaterial({
      color: isPolice ? 0x2563eb : 0xdc2626,
      metalness: 0.65,
      roughness: 0.3,
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: isPolice ? 0x1a2230 : 0x111824,
      transparent: true,
      opacity: isPolice ? 0.62 : 0.34,
      depthWrite: isPolice,
      roughness: 0.1,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    });

    // 1. Lower Chassis Core (Subdivided 8x4x14 for progressive multi-zone crumple deformation)
    const chassisGeo = new THREE.BoxGeometry(
      width * 0.92,
      height * 0.38,
      length * 0.92,
      8,
      4,
      14
    );
    const origChassisPos = (chassisGeo.attributes.position.array as Float32Array).slice();
    const chassis = new THREE.Mesh(chassisGeo, bodyMat);
    chassis.position.y = groundClearance + height * 0.20;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    root.add(chassis);

    // Side Skirts
    const skirtGeo = new THREE.BoxGeometry(width * 0.98, 0.07, length * 0.48, 2, 1, 6);
    const sideSkirts = new THREE.Mesh(skirtGeo, blackTrimMat);
    sideSkirts.position.set(0, groundClearance + 0.04, 0);
    root.add(sideSkirts);

    // 2. Exposed Engine Bay & Radiator Core (Visible when hood crumples/pops open!)
    const engineGroup = new THREE.Group();
    engineGroup.position.set(0, chassis.position.y + 0.04, length * 0.31);

    const engineBlock = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.34, height * 0.20, length * 0.18),
      darkMetalMat
    );
    const valveCoverL = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.06, length * 0.15),
      engineAccentMat
    );
    valveCoverL.position.set(-width * 0.11, height * 0.11, 0);
    const valveCoverR = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.06, length * 0.15),
      engineAccentMat
    );
    valveCoverR.position.set(width * 0.11, height * 0.11, 0);
    const intakePlenum = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.07, length * 0.13),
      chromeMat
    );
    intakePlenum.position.set(0, height * 0.13, 0);

    const radiator = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.56, height * 0.22, 0.06),
      darkMetalMat
    );
    radiator.position.set(0, -0.02, length * 0.15);

    engineGroup.add(engineBlock, valveCoverL, valveCoverR, intakePlenum, radiator);
    root.add(engineGroup);

    // 3. Four Individual Quarter Fenders (FL, FR, RL, RR) for corner-specific crush
    const fenderGeo = new THREE.BoxGeometry(
      width * 0.13,
      height * 0.27,
      length * 0.27,
      4,
      3,
      6
    );
    const fenderConfigs = [
      { x: -width * 0.44, z: length * 0.30, isFront: true, isLeft: true },
      { x: width * 0.44, z: length * 0.30, isFront: true, isLeft: false },
      { x: -width * 0.44, z: -length * 0.30, isFront: false, isLeft: true },
      { x: width * 0.44, z: -length * 0.30, isFront: false, isLeft: false },
    ];
    const fenders: Array<{
      mesh: THREE.Mesh;
      geo: THREE.BoxGeometry;
      origPos: Float32Array;
      initPos: THREE.Vector3;
      initRot: THREE.Euler;
      isFront: boolean;
      isLeft: boolean;
    }> = [];

    for (const fc of fenderConfigs) {
      const geo = fenderGeo.clone();
      const origPos = (geo.attributes.position.array as Float32Array).slice();
      const mesh = new THREE.Mesh(geo, bodyMat);
      mesh.position.set(fc.x, chassis.position.y + 0.04, fc.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
      fenders.push({
        mesh,
        geo,
        origPos,
        initPos: mesh.position.clone(),
        initRot: mesh.rotation.clone(),
        isFront: fc.isFront,
        isLeft: fc.isLeft,
      });
    }
    fenderGeo.dispose();

    // 4. Separate Left & Right Doors + Door Handles + Side Mirrors
    const doorGeoL = new THREE.BoxGeometry(0.10, height * 0.33, length * 0.33, 2, 3, 6);
    const origDoorLPos = (doorGeoL.attributes.position.array as Float32Array).slice();
    const doorMatL = isPolice && !isSwat
      ? new THREE.MeshStandardMaterial({ color: 0xf0f3f8, roughness: 0.3, metalness: 0.2 })
      : bodyMat;
    const doorL = new THREE.Mesh(doorGeoL, doorMatL);
    doorL.position.set(-width * 0.46, chassis.position.y + 0.02, 0);
    doorL.castShadow = true;

    const handleGeo = new THREE.BoxGeometry(0.04, 0.03, 0.14);
    const handleL = new THREE.Mesh(handleGeo, chromeMat);
    handleL.position.set(-0.05, 0.06, -0.18);
    doorL.add(handleL);

    const mirrorGeo = new THREE.BoxGeometry(0.16, 0.07, 0.11);
    const mirrorL = new THREE.Mesh(mirrorGeo, blackTrimMat);
    mirrorL.position.set(-0.10, height * 0.18, length * 0.11);
    const initMirrorLRot = mirrorL.rotation.clone();
    doorL.add(mirrorL);
    root.add(doorL);

    const doorGeoR = doorGeoL.clone();
    const origDoorRPos = (doorGeoR.attributes.position.array as Float32Array).slice();
    const doorR = new THREE.Mesh(doorGeoR, doorMatL);
    doorR.position.set(width * 0.46, chassis.position.y + 0.02, 0);
    doorR.castShadow = true;

    const handleR = new THREE.Mesh(handleGeo, chromeMat);
    handleR.position.set(0.05, 0.06, -0.18);
    doorR.add(handleR);

    const mirrorR = new THREE.Mesh(mirrorGeo, blackTrimMat);
    mirrorR.position.set(0.10, height * 0.18, length * 0.11);
    const initMirrorRRot = mirrorR.rotation.clone();
    doorR.add(mirrorR);
    root.add(doorR);

    const initDoorLPos = doorL.position.clone();
    const initDoorLRot = doorL.rotation.clone();
    const initDoorRPos = doorR.position.clone();
    const initDoorRRot = doorR.rotation.clone();

    // 5. Cabin / Greenhouse + Interior Seats & Rollcage + Windshield Crack Overlay
    const cabinWidth = width * (isSwat ? 0.90 : 0.80);
    const cabinLength = length * (isSwat ? 0.62 : isSuper ? 0.48 : 0.54);
    const cabinHeight = height * (isSwat ? 0.54 : isSuper ? 0.42 : 0.48);

    const cabinGeo = new THREE.BoxGeometry(cabinWidth, cabinHeight, cabinLength, 4, 2, 4);
    const origCabinPos = (cabinGeo.attributes.position.array as Float32Array).slice();
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(
      0,
      groundClearance + height * 0.42 + cabinHeight * 0.5 - 0.02,
      isSuper ? 0.15 : -0.1
    );
    cabin.castShadow = true;
    root.add(cabin);

    // Interior Seats & Sport Rollbar visible through cabin glass
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x1e2028, roughness: 0.75 });
    const seatGeo = new THREE.BoxGeometry(cabinWidth * 0.28, cabinHeight * 0.72, 0.22);
    const seatL = new THREE.Mesh(seatGeo, seatMat);
    seatL.position.set(-cabinWidth * 0.24, cabin.position.y - cabinHeight * 0.1, cabin.position.z - 0.08);
    const seatR = new THREE.Mesh(seatGeo, seatMat);
    seatR.position.set(cabinWidth * 0.24, cabin.position.y - cabinHeight * 0.1, cabin.position.z - 0.08);
    const rollbar = new THREE.Mesh(
      new THREE.BoxGeometry(cabinWidth * 0.86, 0.05, 0.05),
      engineAccentMat
    );
    rollbar.position.set(0, cabin.position.y + cabinHeight * 0.26, cabin.position.z - cabinLength * 0.28);
    root.add(seatL, seatR, rollbar);

    // 5B. Dashboard, Steering Wheel, Cabin Dome Light & 3D Pilot + Co-Pilot (Player / Non-Police Cars)
    let updateOccupantsFn: VehicleMeshData['updateOccupants'];
    let setCabinLightFn: VehicleMeshData['setCabinLightIntensity'];

    if (!isPolice) {
      const driverX = cabinWidth * 0.24; // +X is left-hand driver side when facing +Z forward
      const copilotX = -cabinWidth * 0.24;
      const hipY = cabin.position.y - cabinHeight * 0.22;
      const occupantZ = cabin.position.z + 0.02;

      // Dashboard & Steering Column
      const dashMat = new THREE.MeshStandardMaterial({ color: 0x111319, roughness: 0.7 });
      const dash = new THREE.Mesh(
        new THREE.BoxGeometry(cabinWidth * 0.88, 0.16, 0.24),
        dashMat
      );
      dash.position.set(0, hipY + 0.14, cabin.position.z + cabinLength * 0.34);
      root.add(dash);

      const steeringGroup = new THREE.Group();
      steeringGroup.position.set(driverX, hipY + 0.24, cabin.position.z + cabinLength * 0.24);
      steeringGroup.rotation.x = 0.42;
      const wheelRim = new THREE.Mesh(
        new THREE.TorusGeometry(0.135, 0.022, 8, 18),
        blackTrimMat
      );
      const wheelCenter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12).rotateX(Math.PI / 2),
        engineAccentMat
      );
      const wheelSpoke = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.026, 0.018),
        chromeMat
      );
      steeringGroup.add(wheelRim, wheelCenter, wheelSpoke);
      root.add(steeringGroup);

      // Cabin Interior Dome Light (Activated during 3D Film Cutscenes)
      const cabinLight = new THREE.PointLight(0x67e8f9, 0, 3.8, 1.5);
      cabinLight.position.set(0, cabin.position.y + cabinHeight * 0.38, cabin.position.z + cabinLength * 0.22);
      root.add(cabinLight);
      setCabinLightFn = (intensity: number) => {
        cabinLight.intensity = intensity;
      };

      const skinMat = new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.62 });
      const pilotSuitMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.55, metalness: 0.15 });
      const copilotSuitMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.6, metalness: 0.1 });
      const helmetVisorMat = new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        emissive: 0x0284c7,
        emissiveIntensity: 0.45,
        metalness: 0.85,
        roughness: 0.1,
      });
      const tabletScreenMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

      // --- PILOTO (+X Left Seat) ---
      const pilotGroup = new THREE.Group();
      pilotGroup.position.set(driverX, hipY, occupantZ);

      const pilotTorso = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.34, 0.18),
        pilotSuitMat
      );
      pilotTorso.position.y = 0.15;
      pilotGroup.add(pilotTorso);

      const pilotHead = new THREE.Group();
      pilotHead.position.set(0, 0.40, 0.02);
      const pSkull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 12), skinMat);
      const pCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.122, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58),
        blackTrimMat
      );
      pCap.position.y = 0.015;
      const pVisor = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.045, 0.08), helmetVisorMat);
      pVisor.position.set(0, 0.02, 0.095);
      pilotHead.add(pSkull, pCap, pVisor);
      pilotGroup.add(pilotHead);

      const pArmGeo = new THREE.BoxGeometry(0.075, 0.075, 0.28);
      const pilotLeftArm = new THREE.Group();
      pilotLeftArm.position.set(0.15, 0.25, 0.05);
      const pArmLMesh = new THREE.Mesh(pArmGeo, pilotSuitMat);
      pArmLMesh.position.z = 0.13;
      pilotLeftArm.add(pArmLMesh);

      const pilotRightArm = new THREE.Group();
      pilotRightArm.position.set(-0.15, 0.25, 0.05);
      const pArmRMesh = new THREE.Mesh(pArmGeo, pilotSuitMat);
      pArmRMesh.position.z = 0.13;
      pilotRightArm.add(pArmRMesh);

      pilotGroup.add(pilotLeftArm, pilotRightArm);
      root.add(pilotGroup);

      // --- COPILOTO (-X Right Seat) ---
      const copilotGroup = new THREE.Group();
      copilotGroup.position.set(copilotX, hipY, occupantZ - 0.02);

      const copilotTorso = new THREE.Mesh(
        new THREE.BoxGeometry(0.27, 0.33, 0.17),
        copilotSuitMat
      );
      copilotTorso.position.y = 0.14;
      copilotGroup.add(copilotTorso);

      const copilotHead = new THREE.Group();
      copilotHead.position.set(0, 0.39, 0.02);
      const cSkull = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), skinMat);
      const cHair = new THREE.Mesh(
        new THREE.SphereGeometry(0.118, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62),
        new THREE.MeshStandardMaterial({ color: 0x3b1f0e, roughness: 0.6 })
      );
      cHair.position.y = 0.02;
      // Tactical Co-Pilot Radio Headset
      const headsetBand = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.014, 6, 14, Math.PI),
        chromeMat
      );
      headsetBand.rotation.y = Math.PI / 2;
      const headsetMic = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, 0.018, 0.11),
        engineAccentMat
      );
      headsetMic.position.set(0.10, -0.03, 0.07);
      copilotHead.add(cSkull, cHair, headsetBand, headsetMic);
      copilotGroup.add(copilotHead);

      const copilotLeftArm = new THREE.Group();
      copilotLeftArm.position.set(0.14, 0.24, 0.04);
      const cArmLMesh = new THREE.Mesh(pArmGeo, copilotSuitMat);
      cArmLMesh.position.z = 0.12;
      copilotLeftArm.add(cArmLMesh);

      const copilotRightArm = new THREE.Group();
      copilotRightArm.position.set(-0.14, 0.24, 0.04);
      const cArmRMesh = new THREE.Mesh(pArmGeo, copilotSuitMat);
      cArmRMesh.position.z = 0.12;
      copilotRightArm.add(cArmRMesh);

      // Glowing Tactical GPS Tablet held by Co-Pilot
      const gpsTablet = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.12, 0.016),
        tabletScreenMat
      );
      gpsTablet.position.set(0, 0.20, 0.24);
      gpsTablet.rotation.x = -0.55;
      copilotGroup.add(copilotLeftArm, copilotRightArm, gpsTablet);
      root.add(copilotGroup);

      let occClock = 0;
      updateOccupantsFn = (
        dt: number,
        steerAngle: number,
        driftSlip: number,
        speedKmh: number,
        speakingRole: 'pilot' | 'copilot' | null = null,
        cutTime: number = 0
      ) => {
        occClock += dt;
        const speedNorm = Math.min(1, speedKmh / 180);

        // Steering wheel rotation (driver turning left/right)
        steeringGroup.rotation.z = THREE.MathUtils.damp(steeringGroup.rotation.z, steerAngle * 2.4, 14, dt);

        // Lateral G-force body lean during drift/cornering
        const leanZ = THREE.MathUtils.clamp(-steerAngle * 0.22 - driftSlip * 0.12, -0.22, 0.22);
        pilotTorso.rotation.z = THREE.MathUtils.damp(pilotTorso.rotation.z, leanZ, 8, dt);
        copilotTorso.rotation.z = THREE.MathUtils.damp(copilotTorso.rotation.z, leanZ * 1.15, 8, dt);

        if (speakingRole === 'pilot') {
          // Pilot turns toward co-pilot (-X) and gestures passionately while speaking
          const talkWave = Math.sin((cutTime || occClock) * 7.5);
          pilotHead.rotation.y = THREE.MathUtils.damp(pilotHead.rotation.y, -0.45 + talkWave * 0.08, 9, dt);
          pilotHead.rotation.x = THREE.MathUtils.damp(pilotHead.rotation.x, talkWave * 0.07, 9, dt);
          pilotRightArm.rotation.x = THREE.MathUtils.damp(pilotRightArm.rotation.x, -0.45 + talkWave * 0.22, 10, dt);
          pilotRightArm.rotation.y = THREE.MathUtils.damp(pilotRightArm.rotation.y, -0.35, 10, dt);
          pilotLeftArm.rotation.x = THREE.MathUtils.damp(pilotLeftArm.rotation.x, -0.15, 10, dt);

          // Co-pilot listens attentively, glancing back at Pilot (+X)
          copilotHead.rotation.y = THREE.MathUtils.damp(copilotHead.rotation.y, 0.48, 8, dt);
          copilotHead.rotation.x = THREE.MathUtils.damp(copilotHead.rotation.x, 0.05, 8, dt);
          copilotLeftArm.rotation.x = THREE.MathUtils.damp(copilotLeftArm.rotation.x, 0.15, 8, dt);
        } else if (speakingRole === 'copilot') {
          // Co-pilot turns toward Pilot (+X) & points / gestures with tablet hand
          const talkWave = Math.sin((cutTime || occClock) * 8.2);
          copilotHead.rotation.y = THREE.MathUtils.damp(copilotHead.rotation.y, 0.56 + talkWave * 0.08, 9, dt);
          copilotHead.rotation.x = THREE.MathUtils.damp(copilotHead.rotation.x, -0.05 + talkWave * 0.08, 9, dt);
          copilotLeftArm.rotation.x = THREE.MathUtils.damp(copilotLeftArm.rotation.x, -0.55 + talkWave * 0.28, 10, dt);
          copilotLeftArm.rotation.y = THREE.MathUtils.damp(copilotLeftArm.rotation.y, 0.42, 10, dt);

          // Pilot glances quickly at Co-pilot while keeping hands near wheel
          pilotHead.rotation.y = THREE.MathUtils.damp(pilotHead.rotation.y, -0.25, 8, dt);
          pilotHead.rotation.x = THREE.MathUtils.damp(pilotHead.rotation.x, 0, 8, dt);
          pilotRightArm.rotation.x = THREE.MathUtils.damp(pilotRightArm.rotation.x, -0.15, 8, dt);
          pilotRightArm.rotation.y = THREE.MathUtils.damp(pilotRightArm.rotation.y, 0, 8, dt);
        } else {
          // Normal high-speed driving posture: Pilot looks into turn, Co-pilot checks pace notes/tablet
          pilotHead.rotation.y = THREE.MathUtils.damp(
            pilotHead.rotation.y,
            -steerAngle * 0.55 + driftSlip * 0.22,
            9,
            dt
          );
          pilotHead.rotation.x = THREE.MathUtils.damp(
            pilotHead.rotation.x,
            Math.sin(occClock * 12) * 0.02 * speedNorm,
            8,
            dt
          );
          pilotLeftArm.rotation.x = THREE.MathUtils.damp(pilotLeftArm.rotation.x, -0.15 + steerAngle * 0.18, 12, dt);
          pilotRightArm.rotation.x = THREE.MathUtils.damp(pilotRightArm.rotation.x, -0.15 - steerAngle * 0.18, 12, dt);
          pilotRightArm.rotation.y = THREE.MathUtils.damp(pilotRightArm.rotation.y, 0, 10, dt);

          copilotHead.rotation.y = THREE.MathUtils.damp(
            copilotHead.rotation.y,
            0.12 + Math.sin(occClock * 1.4) * 0.14,
            7,
            dt
          );
          copilotHead.rotation.x = THREE.MathUtils.damp(copilotHead.rotation.x, 0.18, 7, dt);
          copilotLeftArm.rotation.x = THREE.MathUtils.damp(copilotLeftArm.rotation.x, 0.22, 8, dt);
          copilotLeftArm.rotation.y = THREE.MathUtils.damp(copilotLeftArm.rotation.y, 0, 8, dt);
        }
      };
    }

    // Windshield Crack Overlay (Front Glass)
    const crackMat = new THREE.MeshBasicMaterial({
      map: this.getCrackTexture(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const windshieldCracks = new THREE.Mesh(
      new THREE.PlaneGeometry(cabinWidth * 0.92, cabinHeight * 0.88),
      crackMat
    );
    windshieldCracks.position.set(
      0,
      cabin.position.y,
      cabin.position.z + cabinLength * 0.506
    );
    windshieldCracks.visible = false;
    root.add(windshieldCracks);

    // Roof cover (subdivided 4x1x6 for rollover/impact dents)
    const roofGeo = new THREE.BoxGeometry(cabinWidth * 0.96, 0.05, cabinLength * 0.90, 4, 1, 6);
    const origRoofPos = (roofGeo.attributes.position.array as Float32Array).slice();
    const roof = new THREE.Mesh(roofGeo, bodyMat);
    roof.position.set(0, cabin.position.y + cabinHeight * 0.5, cabin.position.z);
    roof.castShadow = true;
    root.add(roof);
    const initRoofPos = roof.position.clone();

    // 6. Front Hood + Scoop (Subdivided 6x2x8 for rich buckling & popping)
    const hoodLength = length * (isSuper ? 0.36 : 0.33);
    const hoodGeo = new THREE.BoxGeometry(width * 0.84, height * 0.09, hoodLength, 6, 2, 8);
    const origHoodPos = (hoodGeo.attributes.position.array as Float32Array).slice();
    const hood = new THREE.Mesh(hoodGeo, bodyMat);
    hood.position.set(0, chassis.position.y + height * 0.16, length * 0.30);
    hood.rotation.x = -0.05;
    hood.castShadow = true;

    if (!isSwat) {
      const scoop = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.26, 0.05, hoodLength * 0.35),
        blackTrimMat
      );
      scoop.position.set(0, height * 0.05, -hoodLength * 0.1);
      hood.add(scoop);
    }
    root.add(hood);
    const initHoodPos = hood.position.clone();
    const initHoodRot = hood.rotation.clone();

    // 7. Rear Trunk Lid (Subdivided 6x2x6)
    const trunkLength = length * 0.20;
    const trunkGeo = new THREE.BoxGeometry(width * 0.82, height * 0.09, trunkLength, 6, 2, 6);
    const origTrunkPos = (trunkGeo.attributes.position.array as Float32Array).slice();
    const trunk = new THREE.Mesh(trunkGeo, bodyMat);
    trunk.position.set(0, chassis.position.y + height * 0.16, -length * 0.36);
    trunk.castShadow = true;
    root.add(trunk);
    const initTrunkPos = trunk.position.clone();
    const initTrunkRot = trunk.rotation.clone();

    // 8. Front & Rear Subdivided Bumpers + Grille + Pushbar/Splitter
    const frontBumperGeo = new THREE.BoxGeometry(width * 0.98, height * 0.20, 0.20, 8, 2, 3);
    const origFrontBumperPos = (frontBumperGeo.attributes.position.array as Float32Array).slice();
    const frontBumper = new THREE.Mesh(frontBumperGeo, isPolice ? blackTrimMat : bodyMat);
    frontBumper.position.set(0, groundClearance + height * 0.10, length * 0.49);
    frontBumper.castShadow = true;

    const grille = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.54, height * 0.12, 0.05),
      blackTrimMat
    );
    grille.position.set(0, 0.02, 0.09);
    frontBumper.add(grille);
    root.add(frontBumper);
    const initFrontBumperPos = frontBumper.position.clone();
    const initFrontBumperRot = frontBumper.rotation.clone();

    const rearBumperGeo = new THREE.BoxGeometry(width * 0.98, height * 0.22, 0.20, 8, 2, 3);
    const origRearBumperPos = (rearBumperGeo.attributes.position.array as Float32Array).slice();
    const rearBumper = new THREE.Mesh(rearBumperGeo, isPolice ? blackTrimMat : bodyMat);
    rearBumper.position.set(0, groundClearance + height * 0.11, -length * 0.49);
    rearBumper.castShadow = true;
    root.add(rearBumper);
    const initRearBumperPos = rearBumper.position.clone();
    const initRearBumperRot = rearBumper.rotation.clone();

    let pushbarMesh: THREE.Mesh | null = null;
    let splitterMesh: THREE.Mesh | null = null;

    if (isPolice) {
      const pushbarGeo = new THREE.BoxGeometry(width * 0.72, height * 0.34, 0.12);
      const pushbarMat = new THREE.MeshStandardMaterial({
        color: 0x050505,
        roughness: 0.8,
        metalness: 0.2,
      });
      const pushbar = new THREE.Mesh(pushbarGeo, pushbarMat);
      pushbar.position.set(0, groundClearance + height * 0.20, length * 0.53);
      root.add(pushbar);
      pushbarMesh = pushbar;
    } else {
      const splitterGeo = new THREE.BoxGeometry(width * 1.02, 0.045, 0.28);
      const splitter = new THREE.Mesh(splitterGeo, blackTrimMat);
      splitter.position.set(0, groundClearance + 0.04, length * 0.51);
      root.add(splitter);
      splitterMesh = splitter;
    }
    const initPushbarPos = pushbarMesh?.position.clone() ?? null;
    const initSplitterPos = splitterMesh?.position.clone() ?? null;

    // Rear Diffuser
    const diffuserGeo = new THREE.BoxGeometry(width * 0.92, 0.09, 0.22);
    const diffuser = new THREE.Mesh(diffuserGeo, blackTrimMat);
    diffuser.position.set(0, groundClearance + 0.07, -length * 0.50);
    root.add(diffuser);

    // Dual Exhaust Pipes
    const exhaustGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.22, 16);
    exhaustGeo.rotateX(Math.PI / 2);
    const exhaustL = new THREE.Mesh(exhaustGeo, chromeMat);
    exhaustL.position.set(-width * 0.32, groundClearance + 0.10, -length * 0.52);
    const exhaustR = new THREE.Mesh(exhaustGeo, chromeMat);
    exhaustR.position.set(width * 0.32, groundClearance + 0.10, -length * 0.52);
    root.add(exhaustL, exhaustR);

    // Headlights (Separate materials so each side can crack/dim independently!)
    const headlightGeo = new THREE.BoxGeometry(0.28, 0.09, 0.08);
    const headlightMatL = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xddeeff,
      emissiveIntensity: 2.2,
      roughness: 0.1,
    });
    const headlightMatR = headlightMatL.clone();
    const headlightL = new THREE.Mesh(headlightGeo, headlightMatL);
    headlightL.position.set(-width * 0.36, chassis.position.y + height * 0.08, length * 0.505);
    const headlightR = new THREE.Mesh(headlightGeo, headlightMatR);
    headlightR.position.set(width * 0.36, chassis.position.y + height * 0.08, length * 0.505);
    root.add(headlightL, headlightR);
    const initHeadlightLPos = headlightL.position.clone();
    const initHeadlightRPos = headlightR.position.clone();

    // Taillights (Independent materials for left/right damage)
    const taillightGeo = new THREE.BoxGeometry(0.36, 0.07, 0.06);
    const taillightMatL = new THREE.MeshStandardMaterial({
      color: 0xff1122,
      emissive: 0xff0022,
      emissiveIntensity: 2.5,
      roughness: 0.2,
    });
    const taillightMatR = taillightMatL.clone();
    const taillightL = new THREE.Mesh(taillightGeo, taillightMatL);
    taillightL.position.set(-width * 0.35, chassis.position.y + height * 0.12, -length * 0.505);
    const taillightR = new THREE.Mesh(taillightGeo, taillightMatR);
    taillightR.position.set(width * 0.35, chassis.position.y + height * 0.12, -length * 0.505);
    root.add(taillightL, taillightR);
    const initTaillightLPos = taillightL.position.clone();
    const initTaillightRPos = taillightR.position.clone();

    // Spoiler / Rear Wing
    let spoilerMesh: THREE.Group | null = null;
    if (config.spoilerStyle > 0 && !isPolice) {
      spoilerMesh = new THREE.Group();
      const wingMat = config.spoilerStyle === 3 ? blackTrimMat : bodyMat;
      const wingWidth = width * (config.spoilerStyle === 2 ? 1.08 : 0.95);
      const wingGeo = new THREE.BoxGeometry(wingWidth, 0.04, 0.26);
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.castShadow = true;

      const stemHeight = config.spoilerStyle === 2 ? 0.28 : 0.16;
      const stemGeo = new THREE.BoxGeometry(0.04, stemHeight, 0.1);
      const stemL = new THREE.Mesh(stemGeo, blackTrimMat);
      stemL.position.set(-wingWidth * 0.32, -stemHeight * 0.5, 0);
      const stemR = new THREE.Mesh(stemGeo, blackTrimMat);
      stemR.position.set(wingWidth * 0.32, -stemHeight * 0.5, 0);

      spoilerMesh.add(wing, stemL, stemR);
      spoilerMesh.position.set(0, chassis.position.y + height * 0.25 + stemHeight, -length * 0.44);
      root.add(spoilerMesh);
    }
    const initSpoilerPos = spoilerMesh?.position.clone() ?? null;

    // Police Emergency Lightbar on Roof
    let policeLightsObj: { blue: THREE.Mesh; red: THREE.Mesh } | undefined;
    let updatePoliceLightsFn: ((time: number) => void) | undefined;

    if (isPolice) {
      const lightbarBaseGeo = new THREE.BoxGeometry(width * 0.65, 0.05, 0.18);
      const lightbarBase = new THREE.Mesh(lightbarBaseGeo, blackTrimMat);
      lightbarBase.position.set(0, roof.position.y + 0.04, roof.position.z);

      const lightGeo = new THREE.BoxGeometry(width * 0.28, 0.08, 0.14);
      const redMat = new THREE.MeshStandardMaterial({
        color: 0xff0022,
        emissive: 0xff0022,
        emissiveIntensity: 3.5,
        roughness: 0.1,
      });
      const blueMat = new THREE.MeshStandardMaterial({
        color: 0x0066ff,
        emissive: 0x0088ff,
        emissiveIntensity: 3.5,
        roughness: 0.1,
      });

      const redLight = new THREE.Mesh(lightGeo, redMat);
      redLight.position.set(-width * 0.16, 0.05, 0);
      const blueLight = new THREE.Mesh(lightGeo, blueMat);
      blueLight.position.set(width * 0.16, 0.05, 0);

      lightbarBase.add(redLight, blueLight);
      root.add(lightbarBase);

      policeLightsObj = { blue: blueLight, red: redLight };
      updatePoliceLightsFn = (time: number) => {
        const flashPhase = Math.floor(time * 12) % 4;
        const redOn = flashPhase === 0 || flashPhase === 1;
        const blueOn = flashPhase === 2 || flashPhase === 3;
        redMat.emissiveIntensity = redOn ? 4.5 : 0.2;
        blueMat.emissiveIntensity = blueOn ? 4.5 : 0.2;
      };
    }

    // 9. 4 Detailed Wheels + Exposed Brake Spindle Hubs + Missing-Wheel Spark Emitters
    const wheelRadius = isSwat ? 0.44 : isSuper ? 0.34 : 0.36;
    const wheelWidth = isSwat ? 0.32 : isSuper ? 0.3 : 0.26;
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      map: this.getTireTexture(),
      roughness: 0.88,
      metalness: 0.05,
    });

    const rimMat = new THREE.MeshStandardMaterial({
      color: config.wheelsStyle === 2 ? 0xf0f0f5 : config.wheelsStyle === 3 ? 0x00e5ff : 0x27272a,
      metalness: 0.9,
      roughness: 0.15,
    });

    const caliperMat = new THREE.MeshStandardMaterial({
      color: 0xff1122,
      metalness: 0.7,
      roughness: 0.3,
    });

    const rotorMat = new THREE.MeshStandardMaterial({
      color: 0x9ca3af,
      metalness: 0.92,
      roughness: 0.25,
    });

    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffb703,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const sparkGeo = new THREE.BoxGeometry(0.035, 0.035, 0.26);

    const wheelOffsetX = width * 0.48;
    const wheelOffsetZ = length * 0.32;
    const wheelY = wheelRadius;

    const wheels: THREE.Group[] = [];
    const sparkGroups: THREE.Group[] = [];
    const sparkStreaks: THREE.Mesh[][] = [];

    const wheelPositions = [
      { x: -wheelOffsetX, z: wheelOffsetZ, isFront: true },   // 0: Front -X
      { x: wheelOffsetX, z: wheelOffsetZ, isFront: true },    // 1: Front +X
      { x: -wheelOffsetX, z: -wheelOffsetZ, isFront: false }, // 2: Rear -X
      { x: wheelOffsetX, z: -wheelOffsetZ, isFront: false },  // 3: Rear +X
    ];

    const spokeGeo = new THREE.BoxGeometry(wheelWidth * 1.03, wheelRadius * 1.32, 0.045);

    wheelPositions.forEach((pos) => {
      // Non-spinning exposed brake assembly fixed to corner hub (visible when wheel detaches)
      const hubGroup = new THREE.Group();
      hubGroup.position.set(pos.x, wheelY, pos.z);
      const innerSign = pos.x > 0 ? -1 : 1;

      const spindle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, wheelWidth * 0.55, 10).rotateZ(Math.PI / 2),
        darkMetalMat
      );
      spindle.position.x = innerSign * wheelWidth * 0.15;

      const rotor = new THREE.Mesh(
        new THREE.CylinderGeometry(wheelRadius * 0.54, wheelRadius * 0.54, 0.04, 16).rotateZ(Math.PI / 2),
        rotorMat
      );
      rotor.position.x = innerSign * wheelWidth * 0.1;

      const caliper = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, wheelRadius * 0.42, 0.12),
        caliperMat
      );
      caliper.position.set(innerSign * wheelWidth * 0.14, wheelRadius * 0.24, 0);

      hubGroup.add(spindle, rotor, caliper);
      root.add(hubGroup);

      // Removable spinning wheel
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(pos.x, wheelY, pos.z);

      const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 24);
      tireGeo.rotateZ(Math.PI / 2);
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.castShadow = true;

      const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.70, wheelRadius * 0.70, wheelWidth * 1.01, 16);
      rimGeo.rotateZ(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeo, rimMat);

      const spoke1 = new THREE.Mesh(spokeGeo, chromeMat);
      const spoke2 = new THREE.Mesh(spokeGeo, chromeMat);
      spoke2.rotation.x = Math.PI / 3;
      const spoke3 = new THREE.Mesh(spokeGeo, chromeMat);
      spoke3.rotation.x = (Math.PI * 2) / 3;

      wheelGroup.add(tire, rim, spoke1, spoke2, spoke3);
      root.add(wheelGroup);
      wheels.push(wheelGroup);

      // Scraping Spark Group near ground at wheel corner
      const spGroup = new THREE.Group();
      spGroup.position.set(pos.x, 0.07, pos.z - 0.12);
      spGroup.visible = false;
      const cornerStreaks: THREE.Mesh[] = [];
      for (let s = 0; s < 3; s++) {
        const streak = new THREE.Mesh(sparkGeo, sparkMat);
        streak.position.set((s - 1) * 0.07, 0.03 * s, -s * 0.18);
        streak.rotation.x = 0.22 + s * 0.08;
        streak.rotation.y = (s - 1) * 0.25;
        spGroup.add(streak);
        cornerStreaks.push(streak);
      }
      root.add(spGroup);
      sparkGroups.push(spGroup);
      sparkStreaks.push(cornerStreaks);
    });

    // Underglow Neon Glow Plane
    let neonMesh: THREE.Mesh | null = null;
    if (config.neonEnabled && !isPolice) {
      const neonGeo = new THREE.PlaneGeometry(width * 0.9, length * 0.85);
      neonGeo.rotateX(-Math.PI / 2);
      const neonMat = new THREE.MeshBasicMaterial({
        color: parseInt(config.neonColor.replace('#', '0x')),
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      });
      neonMesh = new THREE.Mesh(neonGeo, neonMat);
      neonMesh.position.set(0, 0.04, 0);
      root.add(neonMesh);
    }

    // Soft Contact Shadow Plane Grounding
    const shadowGeo = new THREE.PlaneGeometry(width * 1.25, length * 1.15);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.position.set(0, 0.015, 0);
    root.add(shadowMesh);

    // Radiator Damage Steam & Smoke Puffs
    const damageSmokeGroup = new THREE.Group();
    damageSmokeGroup.position.set(0, groundClearance + height * 0.28, length * 0.44);
    damageSmokeGroup.visible = false;
    const smokeGeo = new THREE.DodecahedronGeometry(0.18, 1);
    const smokePuffs: THREE.Mesh[] = [];
    for (let p = 0; p < 4; p++) {
      const smokeMat = new THREE.MeshBasicMaterial({
        color: 0xcccccc,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const puff = new THREE.Mesh(smokeGeo, smokeMat);
      puff.position.set((Math.random() - 0.5) * 0.35, Math.random() * 0.2, (Math.random() - 0.5) * 0.2);
      puff.scale.setScalar(0.7);
      damageSmokeGroup.add(puff);
      smokePuffs.push(puff);
    }
    root.add(damageSmokeGroup);

    // Customization update callback
    const updateCustomization = (newConfig: VehicleConfig) => {
      bodyMat.color.set(newConfig.color);
      if (neonMesh) {
        neonMesh.visible = newConfig.neonEnabled;
        (neonMesh.material as THREE.MeshBasicMaterial).color.set(newConfig.neonColor);
      }
    };

    // Multi-Zone Dynamic Damage State
    const zones: DamageZones = {
      frontLeft: 0,
      frontRight: 0,
      frontCenter: 0,
      rearLeft: 0,
      rearRight: 0,
      rearCenter: 0,
      leftSide: 0,
      rightSide: 0,
      overall: 0,
    };

    const baseRoofMetalness = isSwat ? 0.4 : 0.85;
    const baseRoofRoughness = isSwat ? 0.6 : 0.18;
    let effectClock = 0;

    // Reusable helper: deform a box mesh buffer from its original vertices
    const deformVertices = (
      geo: THREE.BoxGeometry,
      orig: Float32Array,
      halfX: number,
      halfZ: number,
      fn: (ox: number, oy: number, oz: number, nx: number, nz: number) => [number, number, number]
    ) => {
      const posAttr = geo.attributes.position;
      const arr = posAttr.array as Float32Array;
      const invX = 1 / Math.max(0.01, halfX);
      const invZ = 1 / Math.max(0.01, halfZ);
      for (let i = 0; i < arr.length; i += 3) {
        const ox = orig[i];
        const oy = orig[i + 1];
        const oz = orig[i + 2];
        const [dx, dy, dz] = fn(ox, oy, oz, ox * invX, oz * invZ);
        arr[i] = ox + dx;
        arr[i + 1] = oy + dy;
        arr[i + 2] = oz + dz;
      }
      posAttr.needsUpdate = true;
      geo.computeVertexNormals();
    };

    const rebuildDeformedMeshes = () => {
      const frontDmg = Math.max(zones.frontCenter, (zones.frontLeft + zones.frontRight) * 0.58);
      const rearDmg = Math.max(zones.rearCenter, (zones.rearLeft + zones.rearRight) * 0.58);
      const d = Math.max(zones.overall, frontDmg * 0.75, rearDmg * 0.65, zones.leftSide * 0.6, zones.rightSide * 0.6);

      // 1. Deform Main Subdivided Chassis
      deformVertices(chassisGeo, origChassisPos, width * 0.46, length * 0.46, (ox, _oy, oz, nx, nz) => {
        let dx = 0;
        let dy = 0;
        let dz = 0;

        if (nz > 0) {
          const fw = nz * nz;
          const cornerDmg = nx < 0 ? zones.frontLeft : zones.frontRight;
          const localFront = Math.max(zones.frontCenter, cornerDmg);
          dz -= localFront * 0.44 * fw;
          dy += (Math.sin(ox * 9 + oz * 4) * 0.065 - 0.025) * localFront * fw;
          dx += Math.sin(oz * 7) * 0.04 * localFront * fw * (nx < 0 ? 1 : -1);
        } else {
          const rw = nz * nz;
          const cornerDmg = nx < 0 ? zones.rearLeft : zones.rearRight;
          const localRear = Math.max(zones.rearCenter, cornerDmg);
          dz += localRear * 0.36 * rw;
          dy += (Math.cos(ox * 8 - oz * 5) * 0.055 - 0.02) * localRear * rw;
        }

        if (nx < -0.55) {
          const sideW = (-nx - 0.55) / 0.45;
          const sDmg = Math.max(zones.leftSide, nz > 0.3 ? zones.frontLeft * 0.7 : zones.rearLeft * 0.7);
          dx += sDmg * 0.16 * sideW * (0.5 + 0.5 * Math.abs(Math.sin(oz * 5)));
          dy += Math.sin(oz * 8) * 0.03 * sDmg * sideW;
        } else if (nx > 0.55) {
          const sideW = (nx - 0.55) / 0.45;
          const sDmg = Math.max(zones.rightSide, nz > 0.3 ? zones.frontRight * 0.7 : zones.rearRight * 0.7);
          dx -= sDmg * 0.16 * sideW * (0.5 + 0.5 * Math.abs(Math.sin(oz * 5)));
          dy += Math.sin(oz * 8) * 0.03 * sDmg * sideW;
        }

        return [dx, dy, dz];
      });

      // 2. Deform Corner Fenders individually
      for (const f of fenders) {
        const zDmg = f.isFront
          ? f.isLeft
            ? Math.max(zones.frontLeft, zones.frontCenter * 0.45, zones.leftSide * 0.4)
            : Math.max(zones.frontRight, zones.frontCenter * 0.45, zones.rightSide * 0.4)
          : f.isLeft
            ? Math.max(zones.rearLeft, zones.rearCenter * 0.45, zones.leftSide * 0.4)
            : Math.max(zones.rearRight, zones.rearCenter * 0.45, zones.rightSide * 0.4);

        const pushInX = f.isLeft ? 1 : -1;
        const pushZ = f.isFront ? -1 : 1;

        deformVertices(f.geo, f.origPos, width * 0.065, length * 0.135, (ox, _oy, oz, _nx, nz) => {
          const endW = f.isFront ? Math.max(0, nz) : Math.max(0, -nz);
          const dx = pushInX * zDmg * (0.07 + 0.09 * endW + Math.abs(Math.sin(oz * 12)) * 0.03);
          const dy = Math.sin(ox * 14 + oz * 9) * 0.05 * zDmg;
          const dz = pushZ * zDmg * 0.18 * endW;
          return [dx, dy, dz];
        });

        f.mesh.position.x = f.initPos.x + pushInX * zDmg * 0.06;
        f.mesh.position.y = f.initPos.y + zDmg * 0.03;
        f.mesh.position.z = f.initPos.z + pushZ * zDmg * 0.09;
        f.mesh.rotation.z = pushInX * zDmg * 0.14;
      }

      // 3. Deform Doors & Side Mirrors
      const dL = zones.leftSide;
      deformVertices(doorGeoL, origDoorLPos, 0.05, length * 0.165, (_ox, oy, oz) => {
        const centerW = Math.max(0, 1 - Math.abs(oz) / (length * 0.17));
        const dx = dL * 0.13 * (0.4 + 0.6 * centerW);
        const dy = Math.sin(oz * 10 + oy * 8) * 0.025 * dL;
        return [dx, dy, 0];
      });
      doorL.position.x = initDoorLPos.x + dL * 0.04;
      doorL.rotation.y = initDoorLRot.y - dL * 0.12; // Slightly sprung open at rear edge
      doorL.rotation.z = initDoorLRot.z - dL * 0.06;
      mirrorL.rotation.z = initMirrorLRot.z + dL * 0.55;
      mirrorL.rotation.y = initMirrorLRot.y - dL * 0.45;

      const dR = zones.rightSide;
      deformVertices(doorGeoR, origDoorRPos, 0.05, length * 0.165, (_ox, oy, oz) => {
        const centerW = Math.max(0, 1 - Math.abs(oz) / (length * 0.17));
        const dx = -dR * 0.13 * (0.4 + 0.6 * centerW);
        const dy = Math.sin(oz * 10 + oy * 8) * 0.025 * dR;
        return [dx, dy, 0];
      });
      doorR.position.x = initDoorRPos.x - dR * 0.04;
      doorR.rotation.y = initDoorRRot.y + dR * 0.12;
      doorR.rotation.z = initDoorRRot.z + dR * 0.06;
      mirrorR.rotation.z = initMirrorRRot.z - dR * 0.55;
      mirrorR.rotation.y = initMirrorRRot.y + dR * 0.45;

      // 4. Deform & Pop Hood (Exposes Engine Bay underneath on strong front hits!)
      const hHalfW = width * 0.42;
      const hHalfLen = hoodLength * 0.5;
      deformVertices(hoodGeo, origHoodPos, hHalfW, hHalfLen, (ox, _oy, oz, nx, nz) => {
        const localF = nx < -0.2 ? Math.max(zones.frontCenter, zones.frontLeft) : nx > 0.2 ? Math.max(zones.frontCenter, zones.frontRight) : zones.frontCenter;
        const centerDist = Math.max(0, 1 - Math.abs(nx));
        const buckleY = Math.sin((nz + 1) * Math.PI * 0.5) * 0.22 * frontDmg * (0.35 + 0.65 * centerDist);
        const crushZ = nz > 0 ? nz * 0.22 * localF : 0;
        const rippleX = Math.sin(oz * 9 + ox * 5) * 0.035 * localF;
        return [rippleX, buckleY, -crushZ];
      });
      hood.position.z = initHoodPos.z - frontDmg * 0.18;
      hood.position.y = initHoodPos.y + frontDmg * 0.14;
      hood.rotation.x = initHoodRot.x + frontDmg * 0.34;
      hood.rotation.z = initHoodRot.z + (zones.frontLeft - zones.frontRight) * 0.14;

      // 5. Deform & Pop Trunk
      deformVertices(trunkGeo, origTrunkPos, width * 0.41, trunkLength * 0.5, (ox, _oy, oz, nx, nz) => {
        const localR = nx < -0.2 ? Math.max(zones.rearCenter, zones.rearLeft) : nx > 0.2 ? Math.max(zones.rearCenter, zones.rearRight) : zones.rearCenter;
        const buckleY = Math.cos(nz * Math.PI * 0.5) * 0.16 * rearDmg;
        const crushZ = nz < 0 ? -nz * 0.18 * localR : 0;
        return [Math.sin(oz * 8 + ox * 4) * 0.025 * localR, buckleY, crushZ];
      });
      trunk.position.z = initTrunkPos.z + rearDmg * 0.14;
      trunk.position.y = initTrunkPos.y + rearDmg * 0.11;
      trunk.rotation.x = initTrunkRot.x - rearDmg * 0.28;
      trunk.rotation.z = initTrunkRot.z + (zones.rearLeft - zones.rearRight) * 0.12;

      // 6. Front & Rear Bumpers (bend, twist, sag)
      deformVertices(frontBumperGeo, origFrontBumperPos, width * 0.49, 0.1, (_ox, oy, _oz, nx) => {
        const z = nx < -0.25 ? zones.frontLeft : nx > 0.25 ? zones.frontRight : zones.frontCenter;
        const dz = -z * (0.20 + Math.abs(Math.sin(nx * 5)) * 0.06);
        const dy = Math.sin(nx * 7 + oy * 6) * 0.04 * z - z * 0.04;
        return [0, dy, dz];
      });
      frontBumper.position.z = initFrontBumperPos.z - frontDmg * 0.18;
      frontBumper.position.y = initFrontBumperPos.y - frontDmg * 0.08;
      frontBumper.rotation.z = initFrontBumperRot.z + (zones.frontRight - zones.frontLeft) * 0.18;
      frontBumper.rotation.x = initFrontBumperRot.x - frontDmg * 0.14;

      deformVertices(rearBumperGeo, origRearBumperPos, width * 0.49, 0.1, (_ox, oy, _oz, nx) => {
        const z = nx < -0.25 ? zones.rearLeft : nx > 0.25 ? zones.rearRight : zones.rearCenter;
        const dz = z * (0.18 + Math.abs(Math.sin(nx * 5)) * 0.05);
        const dy = Math.cos(nx * 6 + oy * 6) * 0.035 * z - z * 0.04;
        return [0, dy, dz];
      });
      rearBumper.position.z = initRearBumperPos.z + rearDmg * 0.16;
      rearBumper.position.y = initRearBumperPos.y - rearDmg * 0.09;
      rearBumper.rotation.z = initRearBumperRot.z + (zones.rearRight - zones.rearLeft) * 0.2;
      rearBumper.rotation.x = initRearBumperRot.x + rearDmg * 0.15;

      // 7. Cabin, Roof & Windshield Cracks
      deformVertices(cabinGeo, origCabinPos, cabinWidth * 0.5, cabinLength * 0.5, (_ox, oy, _oz, nx, nz) => {
        const topW = Math.max(0, oy / (cabinHeight * 0.5));
        const frontSquish = nz > 0.4 ? frontDmg * 0.06 * topW : 0;
        const sideSquish = nx < -0.5 ? zones.leftSide * 0.05 : nx > 0.5 ? -zones.rightSide * 0.05 : 0;
        return [sideSquish, -d * 0.025 * topW, -frontSquish];
      });
      deformVertices(roofGeo, origRoofPos, cabinWidth * 0.48, cabinLength * 0.45, (ox, _oy, oz) => {
        const dent = d * 0.055 * Math.sin(ox * 6 + oz * 5);
        return [0, -Math.abs(dent), 0];
      });
      roof.position.y = initRoofPos.y - d * 0.035;

      const crackStrength = Math.max(frontDmg * 0.9, d * 0.7);
      if (crackStrength > 0.22) {
        windshieldCracks.visible = true;
        crackMat.opacity = Math.min(0.92, (crackStrength - 0.22) * 1.35);
      } else {
        windshieldCracks.visible = false;
        crackMat.opacity = 0;
      }

      // 8. Pushbar / Splitter
      if (pushbarMesh && initPushbarPos) {
        pushbarMesh.position.z = initPushbarPos.z - frontDmg * 0.24;
        pushbarMesh.position.y = initPushbarPos.y - frontDmg * 0.06;
        pushbarMesh.rotation.x = -frontDmg * 0.22;
        pushbarMesh.rotation.y = (zones.frontLeft - zones.frontRight) * 0.18;
      }
      if (splitterMesh && initSplitterPos) {
        splitterMesh.position.z = initSplitterPos.z - frontDmg * 0.18;
        splitterMesh.position.y = initSplitterPos.y - frontDmg * 0.06;
        splitterMesh.rotation.z = (zones.frontRight - zones.frontLeft) * 0.16;
      }

      // 9. Independent Left/Right Headlights & Taillights
      const flDmg = Math.max(zones.frontLeft, zones.frontCenter * 0.7);
      const frDmg = Math.max(zones.frontRight, zones.frontCenter * 0.7);
      if (flDmg > 0.25) {
        headlightMatL.emissiveIntensity = Math.max(0.05, 2.2 * (1.0 - flDmg * 1.25));
        headlightL.rotation.y = -flDmg * 0.28;
        headlightL.position.z = initHeadlightLPos.z - flDmg * 0.16;
      } else {
        headlightMatL.emissiveIntensity = 2.2;
        headlightL.rotation.y = 0;
        headlightL.position.copy(initHeadlightLPos);
      }
      if (frDmg > 0.25) {
        headlightMatR.emissiveIntensity = Math.max(0.05, 2.2 * (1.0 - frDmg * 1.25));
        headlightR.rotation.y = frDmg * 0.28;
        headlightR.position.z = initHeadlightRPos.z - frDmg * 0.16;
      } else {
        headlightMatR.emissiveIntensity = 2.2;
        headlightR.rotation.y = 0;
        headlightR.position.copy(initHeadlightRPos);
      }

      const rlDmg = Math.max(zones.rearLeft, zones.rearCenter * 0.65);
      const rrDmg = Math.max(zones.rearRight, zones.rearCenter * 0.65);
      if (rlDmg > 0.25) {
        taillightMatL.emissiveIntensity = Math.max(0.08, 2.5 * (1.0 - rlDmg * 1.15));
        taillightL.rotation.z = rlDmg * 0.24;
        taillightL.position.z = initTaillightLPos.z + rlDmg * 0.12;
      } else {
        taillightMatL.emissiveIntensity = 2.5;
        taillightL.rotation.z = 0;
        taillightL.position.copy(initTaillightLPos);
      }
      if (rrDmg > 0.25) {
        taillightMatR.emissiveIntensity = Math.max(0.08, 2.5 * (1.0 - rrDmg * 1.15));
        taillightR.rotation.z = -rrDmg * 0.24;
        taillightR.position.z = initTaillightRPos.z + rrDmg * 0.12;
      } else {
        taillightMatR.emissiveIntensity = 2.5;
        taillightR.rotation.z = 0;
        taillightR.position.copy(initTaillightRPos);
      }

      // 10. Spoiler Damage
      if (spoilerMesh && initSpoilerPos) {
        spoilerMesh.rotation.z = (zones.rearRight - zones.rearLeft) * 0.35 - rearDmg * 0.18;
        spoilerMesh.rotation.x = rearDmg * 0.3;
        spoilerMesh.position.y = initSpoilerPos.y - rearDmg * 0.08;
      }

      // 11. Paint Scratches & Dullness
      bodyMat.roughness = THREE.MathUtils.lerp(baseRoofRoughness, 0.88, d);
      bodyMat.metalness = THREE.MathUtils.lerp(baseRoofMetalness, 0.22, d);
    };

    // Speed-scaled directional impact deformation
    const applyImpactDeformation = (localHitDir: THREE.Vector3, impactSpeedMs: number) => {
      // Nonlinear scaling: low-speed taps cause tiny dents; high-speed crashes cause heavy crumpling
      const speedNorm = THREE.MathUtils.clamp((impactSpeedMs - 2.5) / 34.0, 0.03, 1.0);
      const severity = Math.pow(speedNorm, 1.32) * 0.92;

      const hx = localHitDir.x;
      const hz = localHitDir.z;

      if (hz > 0.18) {
        const fWeight = Math.min(1.0, hz + 0.25);
        zones.frontCenter = Math.min(1.0, zones.frontCenter + severity * fWeight * (1 - Math.abs(hx) * 0.35));
        if (hx < -0.14) {
          zones.frontLeft = Math.min(1.0, zones.frontLeft + severity * Math.min(1, (-hx + 0.35)));
        }
        if (hx > 0.14) {
          zones.frontRight = Math.min(1.0, zones.frontRight + severity * Math.min(1, (hx + 0.35)));
        }
      } else if (hz < -0.18) {
        const rWeight = Math.min(1.0, -hz + 0.25);
        zones.rearCenter = Math.min(1.0, zones.rearCenter + severity * rWeight * (1 - Math.abs(hx) * 0.35));
        if (hx < -0.14) {
          zones.rearLeft = Math.min(1.0, zones.rearLeft + severity * Math.min(1, (-hx + 0.35)));
        }
        if (hx > 0.14) {
          zones.rearRight = Math.min(1.0, zones.rearRight + severity * Math.min(1, (hx + 0.35)));
        }
      }

      if (Math.abs(hx) > 0.32) {
        const sWeight = Math.min(1.0, Math.abs(hx) + 0.15);
        if (hx < 0) {
          zones.leftSide = Math.min(1.0, zones.leftSide + severity * sWeight);
          if (hz >= 0) zones.frontLeft = Math.min(1.0, zones.frontLeft + severity * 0.45);
          else zones.rearLeft = Math.min(1.0, zones.rearLeft + severity * 0.45);
        } else {
          zones.rightSide = Math.min(1.0, zones.rightSide + severity * sWeight);
          if (hz >= 0) zones.frontRight = Math.min(1.0, zones.frontRight + severity * 0.45);
          else zones.rearRight = Math.min(1.0, zones.rearRight + severity * 0.45);
        }
      }

      zones.overall = Math.min(1.0, zones.overall + severity * 0.55);
      rebuildDeformedMeshes();
    };

    const resetDeformation = () => {
      zones.frontLeft = 0;
      zones.frontRight = 0;
      zones.frontCenter = 0;
      zones.rearLeft = 0;
      zones.rearRight = 0;
      zones.rearCenter = 0;
      zones.leftSide = 0;
      zones.rightSide = 0;
      zones.overall = 0;
      rebuildDeformedMeshes();
      damageSmokeGroup.visible = false;
      for (let i = 0; i < 4; i++) {
        wheels[i].visible = true;
        sparkGroups[i].visible = false;
      }
    };

    // Backward-compatible health-ratio deformation (used by PoliceAI and reset fallback)
    const applyDamageDeformation = (damageRatio: number) => {
      const d = Math.max(0, Math.min(1.0, damageRatio));
      if (d <= 0.001) {
        resetDeformation();
        return;
      }
      // Raise zones up to baseline d without erasing sharper directional impacts
      zones.overall = Math.max(zones.overall, d);
      zones.frontCenter = Math.max(zones.frontCenter, d * 0.85);
      zones.frontLeft = Math.max(zones.frontLeft, d * 0.65);
      zones.frontRight = Math.max(zones.frontRight, d * 0.55);
      zones.leftSide = Math.max(zones.leftSide, d * 0.45);
      zones.rightSide = Math.max(zones.rightSide, d * 0.40);
      rebuildDeformedMeshes();
    };

    // Per-frame dynamic damage effects: high-speed wind flutter on loose panels, smoke, missing-wheel sparks
    const updateDamageEffects = (
      dt: number,
      speedKmh: number,
      missingWheels?: [boolean, boolean, boolean, boolean]
    ) => {
      effectClock += dt;
      const speedNorm = Math.min(1.0, speedKmh / 145);
      const frontDmg = Math.max(zones.frontCenter, (zones.frontLeft + zones.frontRight) * 0.55);
      const rearDmg = Math.max(zones.rearCenter, (zones.rearLeft + zones.rearRight) * 0.55);
      const maxDmg = Math.max(zones.overall, frontDmg, rearDmg, zones.leftSide, zones.rightSide);

      // Speed-reactive wind flutter on loose damaged body panels
      if (frontDmg > 0.25 && speedKmh > 12) {
        hood.rotation.x =
          initHoodRot.x +
          frontDmg * 0.34 +
          Math.sin(effectClock * 26) * 0.045 * frontDmg * speedNorm +
          speedNorm * frontDmg * 0.06;
        frontBumper.rotation.x =
          initFrontBumperRot.x -
          frontDmg * 0.14 +
          Math.sin(effectClock * 32 + 1) * 0.03 * frontDmg * speedNorm;
      }

      if (zones.leftSide > 0.35 && speedKmh > 15) {
        doorL.rotation.y =
          initDoorLRot.y -
          zones.leftSide * 0.12 -
          Math.abs(Math.sin(effectClock * 22)) * 0.04 * zones.leftSide * speedNorm;
      }
      if (zones.rightSide > 0.35 && speedKmh > 15) {
        doorR.rotation.y =
          initDoorRRot.y +
          zones.rightSide * 0.12 +
          Math.abs(Math.sin(effectClock * 22 + 0.7)) * 0.04 * zones.rightSide * speedNorm;
      }
      if (spoilerMesh && rearDmg > 0.3 && speedKmh > 15) {
        spoilerMesh.rotation.z =
          (zones.rearRight - zones.rearLeft) * 0.35 -
          rearDmg * 0.18 +
          Math.sin(effectClock * 28) * 0.04 * rearDmg * speedNorm;
      }

      // Radiator Steam & Heavy Engine Smoke
      const smokeDrive = Math.max(frontDmg, maxDmg * 0.85);
      if (smokeDrive > 0.25) {
        damageSmokeGroup.visible = true;
        const smokeIntensity = Math.min(1.0, (smokeDrive - 0.25) / 0.75);
        const t = effectClock * 3.2;
        for (let p = 0; p < smokePuffs.length; p++) {
          const puff = smokePuffs[p];
          const pMat = puff.material as THREE.MeshBasicMaterial;
          const smokeDarkness = smokeDrive > 0.65 ? Math.max(0.14, 0.88 - (smokeDrive - 0.65) * 1.9) : 0.85;
          pMat.color.setRGB(smokeDarkness, smokeDarkness, smokeDarkness);
          pMat.opacity = smokeIntensity * 0.65;
          puff.position.y = 0.15 + Math.sin(t * 2 + p) * 0.22;
          puff.position.x = Math.sin(t + p * 1.5) * 0.16;
          puff.position.z = -speedNorm * 0.35 * (p * 0.25);
          puff.scale.setScalar(0.7 + smokeIntensity * 1.1 + Math.sin(t * 1.2 + p * 2) * 0.25);
        }
      } else {
        damageSmokeGroup.visible = false;
      }

      // Missing Wheels & Road Scraping Sparks
      for (let i = 0; i < 4; i++) {
        const isMissing = Boolean(missingWheels && missingWheels[i]);
        wheels[i].visible = !isMissing;
        if (isMissing && speedKmh > 6) {
          sparkGroups[i].visible = true;
          const streaks = sparkStreaks[i];
          const flicker = 0.55 + 0.45 * Math.sin(effectClock * 48 + i * 2.1);
          sparkGroups[i].scale.set(1, flicker, 0.7 + speedNorm * 1.3);
          for (let s = 0; s < streaks.length; s++) {
            streaks[s].position.z = -((effectClock * 18 + s * 0.25) % 0.65);
          }
        } else {
          sparkGroups[i].visible = false;
        }
      }
    };

    return {
      group: root,
      bodyMesh: chassis,
      wheels,
      neonMesh,
      headlights: [headlightL, headlightR],
      taillights: [taillightL, taillightR],
      policeLights: policeLightsObj,
      updatePoliceLights: updatePoliceLightsFn,
      updateCustomization,
      applyDamageDeformation,
      applyImpactDeformation,
      updateDamageEffects,
      resetDeformation,
      updateOccupants: updateOccupantsFn,
      setCabinLightIntensity: setCabinLightFn,
    };
  }
}
