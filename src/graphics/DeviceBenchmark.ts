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
    let recommendedQuality: GraphicsQuality = 'medium';
    let recommendationReason = 'Equilíbrio ideal entre fluidez e visual.';

    if (isSoftwareGl) {
      recommendedQuality = 'low';
      recommendationReason = 'WebGL por software detectado. Otimizado para máximo desempenho.';
    } else if (isMobile) {
      // Mobile decision based on RAM and CPU
      if (deviceMemoryGb <= 3 || cpuCores <= 4) {
        recommendedQuality = 'low';
        recommendationReason = 'Celular de entrada/intermediário. Otimizado para 60fps sem aquecimento.';
      } else if (deviceMemoryGb <= 4 || cpuCores <= 6) {
        recommendedQuality = 'medium';
        recommendationReason = 'Celular intermediário. Gráficos médios estáveis e sem travamentos.';
      } else if (deviceMemoryGb >= 6 && cpuCores >= 8) {
        // High-end phone (Snapdragon 8 Gen / Dimensity / iPhone Pro)
        const isHighEndGpu = /Adreno\s*(?:[678][0-9]{2}|7[0-9]{2})|Mali-G7[0-9]|Apple\s*GPU/i.test(gpuName);
        if (isHighEndGpu || deviceMemoryGb >= 8) {
          recommendedQuality = 'high';
          recommendationReason = 'Celular potente detectado. Ativando reflexos e sombras dinâmicas.';
        } else {
          recommendedQuality = 'medium';
          recommendationReason = 'Celular intermediário-avançado com gráficos equilibrados.';
        }
      }
    } else {
      // Desktop / PC decision
      if (deviceMemoryGb >= 8 && cpuCores >= 8) {
        const isDedicatedGpu = /NVIDIA|RTX|GTX|Radeon|Direct3D11|Apple M/i.test(gpuName);
        if (isDedicatedGpu) {
          recommendedQuality = 'ultra';
          recommendationReason = 'GPU dedicada detectada. Máximo realismo e reflexos em asfalto ativados.';
        } else {
          recommendedQuality = 'high';
          recommendationReason = 'Computador com excelente capacidade gráfica.';
        }
      } else {
        recommendedQuality = 'medium';
        recommendationReason = 'Configuração intermediária balanceada.';
      }
    }

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
