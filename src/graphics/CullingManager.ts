import * as THREE from 'three';
import { GraphicsQuality } from '../types';

export interface CullableObject {
  object: THREE.Object3D;
  boundingSphere: THREE.Sphere;
  boundingBox?: THREE.Box3;
  isLight?: boolean;
  baseIntensity?: number;
}

export class CullingManager {
  private frustum: THREE.Frustum = new THREE.Frustum();
  private projScreenMatrix: THREE.Matrix4 = new THREE.Matrix4();
  private cullables: CullableObject[] = [];
  public maxRenderDistance: number = 240;

  // Stats
  public totalRegistered: number = 0;
  public visibleCount: number = 0;
  public culledCount: number = 0;

  public setQuality(quality: GraphicsQuality) {
    switch (quality) {
      case 'low':
        this.maxRenderDistance = 160;
        break;
      case 'medium':
        this.maxRenderDistance = 220;
        break;
      case 'high':
        this.maxRenderDistance = 320;
        break;
      case 'ultra':
        this.maxRenderDistance = 440;
        break;
    }
  }

  public registerObject(obj: THREE.Object3D, isLight: boolean = false, baseIntensity: number = 1.0) {
    const box = new THREE.Box3().setFromObject(obj);
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);

    this.cullables.push({
      object: obj,
      boundingSphere: sphere,
      boundingBox: box,
      isLight,
      baseIntensity,
    });
    this.totalRegistered = this.cullables.length;
  }

  public clear() {
    this.cullables = [];
    this.totalRegistered = 0;
    this.visibleCount = 0;
    this.culledCount = 0;
  }

  /**
   * Executes Frustum Culling and Distance/Occlusion Culling for the current frame.
   */
  public update(camera: THREE.Camera, playerPos: THREE.Vector3) {
    // 1. Build Frustum planes from current camera matrices
    this.projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projScreenMatrix);

    let vis = 0;
    let culled = 0;
    const maxDistSq = this.maxRenderDistance * this.maxRenderDistance;
    const lightMaxDistSq = 75 * 75; // Lamps beyond 75m don't need active lights

    for (let i = 0; i < this.cullables.length; i++) {
      const item = this.cullables[i];
      const sphere = item.boundingSphere;

      // Distance test to player / camera
      const dx = sphere.center.x - playerPos.x;
      const dz = sphere.center.z - playerPos.z;
      const distSq = dx * dx + dz * dz;

      if (distSq > maxDistSq) {
        // Distance Culling (Occluded by horizon fog)
        item.object.visible = false;
        culled++;
        continue;
      }

      // Frustum Culling test (Is it in front of camera lens?)
      const inFrustum = this.frustum.intersectsSphere(sphere);

      if (!inFrustum) {
        item.object.visible = false;
        culled++;
        continue;
      }

      // Special Light Occlusion Culling
      if (item.isLight && item.object instanceof THREE.Light) {
        if (distSq > lightMaxDistSq) {
          item.object.intensity = 0;
        } else {
          item.object.intensity = item.baseIntensity || 1.0;
        }
      }

      item.object.visible = true;
      vis++;
    }

    this.visibleCount = vis;
    this.culledCount = culled;
  }
}
