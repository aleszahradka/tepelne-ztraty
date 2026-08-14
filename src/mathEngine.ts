import type { Material, Layer, Assembly, EnvelopeElement, EnvironmentalSettings } from './types';

/**
 * Calculates the thermal resistance of a single layer: R = d / lambda
 */
export function calculateLayerResistance(layer: Layer, materials: Material[]): number {
  const material = materials.find(m => m.id === layer.material_id);
  if (!material || material.design_thermal_conductivity <= 0 || layer.thickness <= 0) {
    return 0;
  }
  return layer.thickness / material.design_thermal_conductivity;
}

/**
 * Calculates the overall U-value for an assembly
 */
export function calculateAssemblyUValue(assembly: Assembly, materials: Material[]): number {
  if ((assembly.type === 'window' || assembly.type === 'door') && assembly.direct_u_value !== undefined) {
    return assembly.direct_u_value;
  }

  let totalR = assembly.rsi + assembly.rse;
  for (const layer of assembly.layers) {
    totalR += calculateLayerResistance(layer, materials);
  }

  if (totalR <= 0) {
    return 0;
  }
  return 1 / totalR;
}

/**
 * Calculates the effective U-value of an envelope element including thermal bridge penalty:
 * U_effective = U_assembly + delta_u_tb
 */
export function calculateEffectiveUValue(
  element: EnvelopeElement,
  assemblies: Assembly[],
  materials: Material[]
): number {
  const assembly = assemblies.find(a => a.id === element.assembly_id);
  if (!assembly) {
    return 0;
  }
  const uAssembly = calculateAssemblyUValue(assembly, materials);
  return uAssembly + (element.delta_u_tb || 0);
}

/**
 * Calculates transmission heat loss for an envelope element:
 * Phi_T = Area * U_effective * (t_int - t_e) * b
 */
export function calculateTransmissionLoss(
  element: EnvelopeElement,
  assemblies: Assembly[],
  materials: Material[],
  settings: EnvironmentalSettings
): number {
  const uEffective = calculateEffectiveUValue(element, assemblies, materials);
  const deltaT = settings.t_int - settings.t_e;
  return element.area * uEffective * deltaT * element.b_factor;
}

/**
 * Calculates ventilation heat loss based on standard formula:
 * Phi_V = V * n * 0.34 * (t_int - t_e)
 */
export function calculateVentilationLoss(settings: EnvironmentalSettings): number {
  const deltaT = settings.t_int - settings.t_e;
  const loss = settings.room_volume * settings.air_exchange_rate * 0.34 * deltaT;
  return loss > 0 ? loss : 0; // Negative loss means heat gain which we floor/handle
}
