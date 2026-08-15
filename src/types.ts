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
  height: number; // Clear ceiling height or ridge height in meters (default 2.6)
  air_exchange_rate: number; // n in 1/h (default 0.5)
  width?: number; // Optional geometric width in meters
  length?: number; // Optional geometric length in meters
  pos_x?: number; // Offset X in meters on the storey plane, default 0
  pos_y?: number; // Offset Y in meters on the storey plane, default 0
  shape_type?: 'box' | 'triangular_prism' | 'trapezoidal_prism'; // 3D geometry shape
  pitch_angle?: number; // Roof slope pitch angle in degrees (e.g., 35)
  eave_height?: number; // Eave height for trapezoidal/shed roofs
}

export interface EnvelopeElement {
  id: string; // Unique ID
  name: string;
  area: number; // Gross Area (A_gross) in m² (single instance area if count > 1)
  assembly_id: string; // Links to Assembly.id
  adjacent_space_type: AdjacentSpaceType;
  b_factor: number; // Temperature reduction factor
  delta_u_tb: number; // Thermal bridge penalty (ΔU_tb), default 0.05
  parent_element_id?: string; // Optional parent element ID for nested openings (windows/doors)
  room_id?: string; // Optional room ID linking element directly to a Room
  relative_angle: number; // Relative angle (0° = Front, 90° = Right, 180° = Back, 270° = Left). Default 0
  tilt: number; // Tilt angle (90° = Vertical Wall, 0° = Horizontal Roof/Floor, 45° = Pitched Roof). Default 90
  opening_width?: number; // Opening width in meters
  opening_height?: number; // Opening height in meters
  offset_x?: number; // Offset X position on parent surface in meters
  offset_y?: number; // Offset Y position on parent surface in meters
  is_virtual?: boolean; // True if manually entered without a 3D volume reference (bypasses 3D viewport rendering)
  source?: 'volume' | 'manual'; // Origin source of envelope surface
  count?: number; // Quantity multiplier for openings/elements (default 1, minimum 1)
  parent_face?: 'front' | 'right' | 'back' | 'left' | 'top' | 'bottom'; // Explicit 3D target face binding
}

export interface EnvironmentalSettings {
  t_int: number; // Global indoor design temperature (°C)
  t_e: number; // Outdoor design temperature (°C)
  room_volume: number; // Building/room volume in m³
  air_exchange_rate: number; // n in 1/h (air changes per hour)
  building_orientation: number; // Building North Orientation "Severka" (0° to 360°, where 0° = North, 90° = East, 180° = South, 270° = West). Default 0
}

export interface ProjectState {
  materials: Material[];
  assemblies: Assembly[];
  storeys?: Storey[];
  rooms?: Room[];
  envelope_elements: EnvelopeElement[];
  environmental_settings: EnvironmentalSettings;
}
