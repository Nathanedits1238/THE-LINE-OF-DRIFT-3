import { GraphicsQuality } from '../types';

export interface DeviceSpecs {
  isMobile: boolean;
  isSoftwareGl: boolean;
  gpuName: string;
  deviceMemoryGb: number;
  cpuCores: number;
  recommendedQuality: GraphicsQuality;
  recommendationReason: string;
}

export class DeviceBenchmark {
  public static detectOptimalSettings(): DeviceSpecs {
    // 1. Mobile & Touch Detection
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) ||
      navigator.maxTouchPoints > 0;

    // 2. Hardware specs probes
    const nav = navigator as unknown as { deviceMemory?: number; hardwareConcurrency?: number };
    const deviceMemoryGb = nav.deviceMemory || (isMobile ? 3 : 8);
    const cpuCores = nav.hardwareConcurrency || 4;

    // 3. WebGL GPU Probe
    let gpuName = 'Desconhecida';
    let isSoftwareGl = false;

    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (gl) {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        if (ext) {
          gpuName = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || 'WebGL Renderer';
        } else {
          gpuName = gl.getParameter(gl.RENDERER) || 'Generic WebGL';
        }
        isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpuName);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      } else {
        isSoftwareGl = true;
      }
    } catch {
      isSoftwareGl = true;
    }

    // 4. Decision Engine for Default Preset
    const recommendedQuality: GraphicsQuality = 'low';
    const recommendationReason = 'Modo Gráfico Padrão (Baixo) para máxima fluidez e 60 FPS.';

    return {
      isMobile,
      isSoftwareGl,
      gpuName,
      deviceMemoryGb,
      cpuCores,
      recommendedQuality,
      recommendationReason,
    };
  }
}
