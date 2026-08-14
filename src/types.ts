export interface Material {
  id: string; // Unique ID for material
  name: string | { cs: string; en: string };
  category: string | { cs: string; en: string };
  design_thermal_conductivity: number; // λ_u in W/(m·K)
  is_custom: boolean; // True if created by user
}

export interface Layer {
  id: string; // Unique ID
  material_id: string; // Links to Material.id
  thickness: number; // d in meters (m)
}

export interface Assembly {
  id: string; // Unique ID
  name: string;
  type: 'wall' | 'roof' | 'floor' | 'window' | 'door' | 'custom';
  rsi: number; // Internal surface thermal resistance in (m²K)/W
  rse: number; // External surface thermal resistance in (m²K)/W
  layers: Layer[];
  direct_u_value?: number; // Optional direct override (for windows and doors)
}

export type AdjacentSpaceType = 'exterior' | 'ground' | 'unheated' | 'custom';

export interface Storey {
  id: string; // Unique ID (UUID)
  name: string; // e.g. "1.NP", "Podkroví"
  level_z: number; // Height level in meters (e.g. 0.0, 2.8)
}

export interface Room {
  id: string; // Unique ID (UUID)
  name: string; // e.g. "Obývací pokoj", "Koupelna"
  storey_id: string; // Links to Storey.id
  t_int: number; // Indoor design temperature in °C (e.g. 21, 24, 15)
  area: number; // Floor area in m²
  height: number; // Clear ceiling height in meters (default 2.6)
  air_exchange_rate: number; // n in 1/h (default 0.5)
}

export interface EnvelopeElement {
  id: string; // Unique ID
  name: string;
  area: number; // Gross Area (A_gross) in m²
  assembly_id: string; // Links to Assembly.id
  adjacent_space_type: AdjacentSpaceType;
  b_factor: number; // Temperature reduction factor
  delta_u_tb: number; // Thermal bridge penalty (ΔU_tb), default 0.05
  parent_element_id?: string; // Optional parent element ID for nested openings (windows/doors)
  room_id?: string; // Optional room ID linking element directly to a Room
}

export interface EnvironmentalSettings {
  t_int: number; // Global indoor design temperature (°C)
  t_e: number; // Outdoor design temperature (°C)
  room_volume: number; // Building/room volume in m³
  air_exchange_rate: number; // n in 1/h (air changes per hour)
}

export interface ProjectState {
  materials: Material[];
  assemblies: Assembly[];
  storeys?: Storey[];
  rooms?: Room[];
  envelope_elements: EnvelopeElement[];
  environmental_settings: EnvironmentalSettings;
}
