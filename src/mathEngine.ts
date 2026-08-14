import type { Material, Layer, Assembly, EnvelopeElement, EnvironmentalSettings, Room } from './types';

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
 * Calculates total gross area of child openings linked to a parent element.
 */
export function calculateChildOpeningsArea(
  parentElementId: string,
  elements: EnvelopeElement[]
): number {
  return elements
    .filter(e => e.parent_element_id === parentElementId)
    .reduce((sum, child) => sum + child.area, 0);
}

/**
 * Calculates the Net Area (A_net) of an envelope element by subtracting child openings area.
 */
export function calculateNetArea(
  element: EnvelopeElement,
  elements: EnvelopeElement[] = []
): number {
  const childOpeningsArea = calculateChildOpeningsArea(element.id, elements);
  return element.area - childOpeningsArea;
}

/**
 * Checks if the net area of a parent element is negative (openings exceed parent area).
 */
export function isNetAreaExceeded(
  element: EnvelopeElement,
  elements: EnvelopeElement[] = []
): boolean {
  return calculateNetArea(element, elements) < 0;
}

/**
 * Calculates transmission heat loss for an envelope element using its Net Area (A_net).
 * If room_id is specified, uses the linked room's indoor design temperature (t_int_i),
 * otherwise falls back to global settings.t_int.
 * Phi_T = A_net * U_effective * (t_int - t_e) * b
 */
export function calculateTransmissionLoss(
  element: EnvelopeElement,
  assemblies: Assembly[],
  materials: Material[],
  settings: EnvironmentalSettings,
  allElements: EnvelopeElement[] = [],
  rooms: Room[] = []
): number {
  const uEffective = calculateEffectiveUValue(element, assemblies, materials);
  let indoorTemp = settings.t_int;
  if (element.room_id && rooms.length > 0) {
    const linkedRoom = rooms.find(r => r.id === element.room_id);
    if (linkedRoom) {
      indoorTemp = linkedRoom.t_int;
    }
  }
  const deltaT = indoorTemp - settings.t_e;
  const netArea = calculateNetArea(element, allElements);
  const loss = netArea * uEffective * deltaT * element.b_factor;
  return loss > 0 ? loss : 0;
}

/**
 * Calculates ventilation heat loss based on global settings:
 * Phi_V = V * n * 0.34 * (t_int - t_e)
 */
export function calculateVentilationLoss(settings: EnvironmentalSettings): number {
  const deltaT = settings.t_int - settings.t_e;
  const loss = settings.room_volume * settings.air_exchange_rate * 0.34 * deltaT;
  return loss > 0 ? loss : 0;
}

/**
 * Calculates ventilation heat loss for a specific room:
 * V_i = room.area * room.height
 * Phi_V,i = V_i * room.air_exchange_rate * 0.34 * (room.t_int - outdoorTemp)
 */
export function calculateRoomVentilationLoss(room: Room, outdoorTemp: number): number {
  const volume = room.area * room.height;
  const deltaT = room.t_int - outdoorTemp;
  const loss = volume * room.air_exchange_rate * 0.34 * deltaT;
  return loss > 0 ? loss : 0;
}

/**
 * Calculates transmission heat loss for all envelope elements assigned to a specific room.
 */
export function calculateRoomTransmissionLoss(
  roomId: string,
  elements: EnvelopeElement[],
  assemblies: Assembly[],
  materials: Material[],
  settings: EnvironmentalSettings,
  rooms: Room[] = []
): number {
  return elements
    .filter(e => e.room_id === roomId)
    .reduce((sum, el) => sum + calculateTransmissionLoss(el, assemblies, materials, settings, elements, rooms), 0);
}

/**
 * Calculates total heat loss breakdown for a specific room (Transmission + Ventilation).
 */
export function calculateRoomTotalLoss(
  room: Room,
  elements: EnvelopeElement[],
  assemblies: Assembly[],
  materials: Material[],
  settings: EnvironmentalSettings,
  rooms: Room[] = []
): { transmission: number; ventilation: number; total: number } {
  const transmission = calculateRoomTransmissionLoss(room.id, elements, assemblies, materials, settings, rooms);
  const ventilation = calculateRoomVentilationLoss(room, settings.t_e);
  return {
    transmission,
    ventilation,
    total: transmission + ventilation
  };
}

/**
 * Calculates aggregated heat loss for a storey (sum of room losses belonging to the storey).
 */
export function calculateStoreyHeatLoss(
  storeyId: string,
  rooms: Room[],
  elements: EnvelopeElement[],
  assemblies: Assembly[],
  materials: Material[],
  settings: EnvironmentalSettings
): { transmission: number; ventilation: number; total: number } {
  const storeyRooms = rooms.filter(r => r.storey_id === storeyId);
  let transmission = 0;
  let ventilation = 0;

  storeyRooms.forEach(room => {
    const roomLoss = calculateRoomTotalLoss(room, elements, assemblies, materials, settings, rooms);
    transmission += roomLoss.transmission;
    ventilation += roomLoss.ventilation;
  });

  return {
    transmission,
    ventilation,
    total: transmission + ventilation
  };
}

/**
 * Calculates total building ventilation heat loss.
 * Sums ventilation loss of all defined rooms if rooms exist; otherwise falls back to global settings ventilation loss.
 */
export function calculateTotalBuildingVentilationLoss(
  rooms: Room[],
  settings: EnvironmentalSettings
): number {
  if (rooms.length > 0) {
    return rooms.reduce((sum, room) => sum + calculateRoomVentilationLoss(room, settings.t_e), 0);
  }
  return calculateVentilationLoss(settings);
}

/**
 * Calculates total building transmission heat loss across all envelope elements.
 */
export function calculateTotalBuildingTransmissionLoss(
  elements: EnvelopeElement[],
  assemblies: Assembly[],
  materials: Material[],
  settings: EnvironmentalSettings,
  rooms: Room[] = []
): number {
  return elements.reduce(
    (sum, el) => sum + calculateTransmissionLoss(el, assemblies, materials, settings, elements, rooms),
    0
  );
}
