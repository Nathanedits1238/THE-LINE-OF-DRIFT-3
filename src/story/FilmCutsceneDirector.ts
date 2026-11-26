import * as THREE from 'three';
import { DialogueLine, FilmCameraShot } from '../types';

export class FilmCutsceneDirector {
  public active: boolean = false;
  public elapsed: number = 0;
  public currentLineIndex: number = 0;
  public lines: DialogueLine[] = [];
  public currentShot: FilmCameraShot = 'front_two_shot';
  public speakingRole: 'pilot' | 'copilot' | null = null;

  private onFinishCallback?: () => void;

  // Zero-GC math helpers
  private static readonly _camLocalOffset = new THREE.Vector3();
  private static readonly _lookLocalOffset = new THREE.Vector3();
  private static readonly _worldCamPos = new THREE.Vector3();
  private static readonly _worldLookPos = new THREE.Vector3();
  private static readonly _smoothedCamPos = new THREE.Vector3();
  private static readonly _smoothedLookPos = new THREE.Vector3();
  private static readonly _carQuat = new THREE.Quaternion();
  private static readonly _upAxis = new THREE.Vector3(0, 1, 0);

  public start(
    lines: DialogueLine[],
    carPos: THREE.Vector3,
    carHeading: number,
    onFinish?: () => void
  ) {
    this.lines = lines;
    this.currentLineIndex = 0;
    this.elapsed = 0;
    this.active = true;
    this.onFinishCallback = onFinish;
    this.syncLineState(0);

    // Snap smoothed camera immediately on scene start
    this.computeTargets(0, carPos, carHeading, FilmCutsceneDirector._worldCamPos, FilmCutsceneDirector._worldLookPos);
    FilmCutsceneDirector._smoothedCamPos.copy(FilmCutsceneDirector._worldCamPos);
    FilmCutsceneDirector._smoothedLookPos.copy(FilmCutsceneDirector._worldLookPos);
  }

  public setLineIndex(index: number) {
    this.currentLineIndex = index;
    this.syncLineState(index);
  }

  private syncLineState(index: number) {
    const line = this.lines[index];
    if (!line) {
      this.currentShot = 'car_exterior_hero';
      this.speakingRole = null;
      return;
    }

    if (line.role === 'pilot' || line.portrait === 'luca' || line.portrait === 'pilot') {
      this.speakingRole = 'pilot';
    } else if (line.role === 'copilot' || line.portrait === 'miguel' || line.portrait === 'copilot') {
      this.speakingRole = 'copilot';
    } else {
      this.speakingRole = null;
    }

    if (line.cameraShot) {
      this.currentShot = line.cameraShot;
    } else if (this.speakingRole === 'pilot') {
      this.currentShot = 'pilot_closeup';
    } else if (this.speakingRole === 'copilot') {
      this.currentShot = 'copilot_closeup';
    } else if (line.radioEffect) {
      this.currentShot = 'cop_radio_insert';
    } else {
      this.currentShot = 'front_two_shot';
    }
  }

  public stop() {
    this.active = false;
    this.speakingRole = null;
    const cb = this.onFinishCallback;
    this.onFinishCallback = undefined;
    cb?.();
  }

  private computeTargets(
    t: number,
    carPos: THREE.Vector3,
    carHeading: number,
    outCamPos: THREE.Vector3,
    outLookPos: THREE.Vector3
  ) {
    // Car local frame: +Z forward, +X left (Pilot seat), -X right (Co-pilot seat)
    const cam = FilmCutsceneDirector._camLocalOffset;
    const look = FilmCutsceneDirector._lookLocalOffset;
    const swayX = Math.sin(t * 1.15) * 0.045;
    const swayY = Math.cos(t * 0.85) * 0.025;

    switch (this.currentShot) {
      case 'front_two_shot':
        // Framing straight through front windshield onto both Pilot & Co-pilot
        cam.set(swayX * 1.8, 1.38 + swayY, 2.35);
        look.set(0, 1.06, -0.05);
        break;
      case 'pilot_closeup':
        // Cinematic over-the-shoulder / 3-quarter shot from co-pilot dash toward Pilot (+X)
        cam.set(-0.36 + swayX, 1.24 + swayY, 1.15);
        look.set(0.36, 1.12, -0.05);
        break;
      case 'copilot_closeup':
        // 3-quarter shot from pilot side looking at Co-pilot (-X) & glowing GPS tablet
        cam.set(0.36 + swayX, 1.24 + swayY, 1.15);
        look.set(-0.36, 1.10, -0.05);
        break;
      case 'side_window':
        // Dramatic driver-side window tracking shot looking in at both occupants
        cam.set(1.95 + swayX, 1.28 + swayY, 0.72);
        look.set(-0.15, 1.06, 0.0);
        break;
      case 'cop_radio_insert':
        // Low tension front-quarter push while police radio crackles
        cam.set(-2.35 + Math.sin(t * 0.9) * 0.25, 0.85 + swayY, 3.25);
        look.set(0, 0.95, 0.2);
        break;
      case 'car_exterior_hero':
      default: {
        // Hero sweeping cinema arc showing full car + city neon reflections
        const sweep = Math.sin(t * 0.55) * 0.5;
        cam.set(2.85 + sweep, 1.35 + swayY, 4.15);
        look.set(0, 0.85, 0.15);
        break;
      }
    }

    FilmCutsceneDirector._carQuat.setFromAxisAngle(FilmCutsceneDirector._upAxis, carHeading);
    outCamPos.copy(cam).applyQuaternion(FilmCutsceneDirector._carQuat).add(carPos);
    outLookPos.copy(look).applyQuaternion(FilmCutsceneDirector._carQuat).add(carPos);
  }

  public update(
    dt: number,
    camera: THREE.PerspectiveCamera,
    carPos: THREE.Vector3,
    carHeading: number,
    setCabinLightIntensity?: (intensity: number) => void
  ) {
    if (!this.active) return;
    this.elapsed += dt;

    this.computeTargets(
      this.elapsed,
      carPos,
      carHeading,
      FilmCutsceneDirector._worldCamPos,
      FilmCutsceneDirector._worldLookPos
    );

    const isInteriorFocused =
      this.currentShot === 'front_two_shot' ||
      this.currentShot === 'pilot_closeup' ||
      this.currentShot === 'copilot_closeup' ||
      this.currentShot === 'side_window';

    setCabinLightIntensity?.(isInteriorFocused ? 2.6 : 1.1);

    // Smooth camera interpolation with quick cut snap feel
    const lerpSpeed = Math.min(1, dt * 6.5);
    FilmCutsceneDirector._smoothedCamPos.lerp(FilmCutsceneDirector._worldCamPos, lerpSpeed);
    FilmCutsceneDirector._smoothedLookPos.lerp(FilmCutsceneDirector._worldLookPos, lerpSpeed);

    camera.position.copy(FilmCutsceneDirector._smoothedCamPos);
    camera.lookAt(FilmCutsceneDirector._smoothedLookPos);

    const targetFov = isInteriorFocused ? 46 : 54;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 7, dt);
      camera.updateProjectionMatrix();
    }
  }
}
