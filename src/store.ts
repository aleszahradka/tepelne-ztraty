import { create } from 'zustand';
import type { Material, Assembly, EnvelopeElement, EnvironmentalSettings, ProjectState, Layer } from './types';

// Standard mock materials as starting database
export const BUILT_IN_MATERIALS: Material[] = [
  {
    id: "mat-brick-solid",
    name: "Solid Clay Brick (Plná cihla)",
    category: "Masonry",
    design_thermal_conductivity: 0.80,
    is_custom: false
  },
  {
    id: "mat-reinforced-concrete",
    name: "Reinforced Concrete (Železobeton)",
    category: "Concrete",
    design_thermal_conductivity: 1.58,
    is_custom: false
  },
  {
    id: "mat-mineral-wool",
    name: "Mineral Wool (Minerální vata)",
    category: "Insulation",
    design_thermal_conductivity: 0.038,
    is_custom: false
  },
  {
    id: "mat-eps",
    name: "Expanded Polystyrene (EPS)",
    category: "Insulation",
    design_thermal_conductivity: 0.035,
    is_custom: false
  },
  {
    id: "mat-gypsum-board",
    name: "Gypsum Plasterboard (Sádrokarton)",
    category: "Plasterboards",
    design_thermal_conductivity: 0.22,
    is_custom: false
  }
];

// Helper to generate IDs
export function generateUUID(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
}

// Sensible default project state
const DEFAULT_ENVIRONMENTAL_SETTINGS: EnvironmentalSettings = {
  t_int: 20,
  t_e: -15,
  room_volume: 150,
  air_exchange_rate: 0.5
};

// Initial demo assemblies
const demoAssemblyWallId = 'asm-wall-insulated';
const demoAssemblyRoofId = 'asm-roof-insulated';
const demoAssemblyWindowId = 'asm-window-double';

const INITIAL_ASSEMBLIES: Assembly[] = [
  {
    id: demoAssemblyWallId,
    name: "External Wall (Insulated)",
    type: "wall",
    rsi: 0.13,
    rse: 0.04,
    layers: [
      { id: generateUUID(), material_id: "mat-brick-solid", thickness: 0.30 },
      { id: generateUUID(), material_id: "mat-eps", thickness: 0.15 }
    ]
  },
  {
    id: demoAssemblyRoofId,
    name: "Insulated Roof Standard",
    type: "roof",
    rsi: 0.10,
    rse: 0.04,
    layers: [
      { id: generateUUID(), material_id: "mat-reinforced-concrete", thickness: 0.20 },
      { id: generateUUID(), material_id: "mat-mineral-wool", thickness: 0.24 }
    ]
  },
  {
    id: demoAssemblyWindowId,
    name: "Double Glazed Window",
    type: "window",
    rsi: 0.13,
    rse: 0.04,
    layers: [],
    direct_u_value: 1.2
  }
];

// Initial demo envelope elements
const INITIAL_ENVELOPE_ELEMENTS: EnvelopeElement[] = [
  {
    id: generateUUID(),
    name: "North Wall (External)",
    area: 45.0,
    assembly_id: demoAssemblyWallId,
    adjacent_space_type: "exterior",
    b_factor: 1.0,
    delta_u_tb: 0.05
  },
  {
    id: generateUUID(),
    name: "South Wall (External)",
    area: 45.0,
    assembly_id: demoAssemblyWallId,
    adjacent_space_type: "exterior",
    b_factor: 1.0,
    delta_u_tb: 0.05
  },
  {
    id: generateUUID(),
    name: "Main Roof",
    area: 60.0,
    assembly_id: demoAssemblyRoofId,
    adjacent_space_type: "exterior",
    b_factor: 1.0,
    delta_u_tb: 0.05
  },
  {
    id: generateUUID(),
    name: "Living Room Window",
    area: 6.0,
    assembly_id: demoAssemblyWindowId,
    adjacent_space_type: "exterior",
    b_factor: 1.0,
    delta_u_tb: 0.00
  },
  {
    id: generateUUID(),
    name: "Basement Floor Connection",
    area: 60.0,
    assembly_id: demoAssemblyWallId, // placeholder
    adjacent_space_type: "ground",
    b_factor: 0.45,
    delta_u_tb: 0.02
  }
];

interface HeatLossState {
  materials: Material[];
  assemblies: Assembly[];
  envelope_elements: EnvelopeElement[];
  environmental_settings: EnvironmentalSettings;

  // Actions
  addMaterial: (material: Material) => void;
  deleteMaterial: (id: string) => void;

  addAssembly: (assembly: Assembly) => void;
  updateAssembly: (id: string, updated: Partial<Assembly>) => void;
  deleteAssembly: (id: string) => void;

  addLayer: (assemblyId: string, layer: Layer) => void;
  updateLayer: (assemblyId: string, layerId: string, updated: Partial<Layer>) => void;
  deleteLayer: (assemblyId: string, layerId: string) => void;

  addElement: (element: EnvelopeElement) => void;
  updateElement: (id: string, updated: Partial<EnvelopeElement>) => void;
  deleteElement: (id: string) => void;

  updateEnvironmentalSettings: (settings: Partial<EnvironmentalSettings>) => void;

  loadProject: (project: ProjectState) => void;
  resetProject: () => void;
}

export const useHeatLossStore = create<HeatLossState>((set) => ({
  materials: BUILT_IN_MATERIALS,
  assemblies: INITIAL_ASSEMBLIES,
  envelope_elements: INITIAL_ENVELOPE_ELEMENTS,
  environmental_settings: DEFAULT_ENVIRONMENTAL_SETTINGS,

  // Materials
  addMaterial: (material) => set((state) => ({
    materials: [...state.materials, material]
  })),

  deleteMaterial: (id) => set((state) => ({
    materials: state.materials.filter((m) => m.id !== id || !m.is_custom) // Cannot delete built-in materials
  })),

  // Assemblies
  addAssembly: (assembly) => set((state) => ({
    assemblies: [...state.assemblies, assembly]
  })),

  updateAssembly: (id, updated) => set((state) => ({
    assemblies: state.assemblies.map((a) => (a.id === id ? { ...a, ...updated } : a))
  })),

  deleteAssembly: (id) => set((state) => ({
    assemblies: state.assemblies.filter((a) => a.id !== id)
  })),

  // Layers
  addLayer: (assemblyId, layer) => set((state) => ({
    assemblies: state.assemblies.map((a) => {
      if (a.id !== assemblyId) return a;
      return {
        ...a,
        layers: [...a.layers, layer]
      };
    })
  })),

  updateLayer: (assemblyId, layerId, updated) => set((state) => ({
    assemblies: state.assemblies.map((a) => {
      if (a.id !== assemblyId) return a;
      return {
        ...a,
        layers: a.layers.map((l) => (l.id === layerId ? { ...l, ...updated } : l))
      };
    })
  })),

  deleteLayer: (assemblyId, layerId) => set((state) => ({
    assemblies: state.assemblies.map((a) => {
      if (a.id !== assemblyId) return a;
      return {
        ...a,
        layers: a.layers.filter((l) => l.id !== layerId)
      };
    })
  })),

  // Envelope Elements
  addElement: (element) => set((state) => ({
    envelope_elements: [...state.envelope_elements, element]
  })),

  updateElement: (id, updated) => set((state) => ({
    envelope_elements: state.envelope_elements.map((e) => (e.id === id ? { ...e, ...updated } : e))
  })),

  deleteElement: (id) => set((state) => ({
    envelope_elements: state.envelope_elements.filter((e) => e.id !== id)
  })),

  // Environmental Settings
  updateEnvironmentalSettings: (settings) => set((state) => ({
    environmental_settings: { ...state.environmental_settings, ...settings }
  })),

  // Project Management
  loadProject: (project) => set(() => {
    // Merge loaded materials to avoid wiping out default ones if they were missing,
    // and map over the arrays to ensure safe fallback structures.
    const mergedMaterials = [...BUILT_IN_MATERIALS];
    project.materials.forEach((m) => {
      if (!mergedMaterials.some((bm) => bm.id === m.id)) {
        mergedMaterials.push(m);
      }
    });

    return {
      materials: mergedMaterials,
      assemblies: project.assemblies || [],
      envelope_elements: project.envelope_elements || [],
      environmental_settings: project.environmental_settings || DEFAULT_ENVIRONMENTAL_SETTINGS
    };
  }),

  resetProject: () => set(() => ({
    materials: BUILT_IN_MATERIALS,
    assemblies: INITIAL_ASSEMBLIES,
    envelope_elements: INITIAL_ENVELOPE_ELEMENTS,
    environmental_settings: DEFAULT_ENVIRONMENTAL_SETTINGS
  }))
}));
