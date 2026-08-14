import { create } from 'zustand';
import type { Material, Assembly, EnvelopeElement, EnvironmentalSettings, ProjectState, Layer } from './types';

// Standard mock materials as starting database
export const BUILT_IN_MATERIALS: Material[] = [
  {
    id: "mat-brick-solid",
    name: { cs: "Plná cihla", en: "Solid Clay Brick" },
    category: { cs: "Zdivo", en: "Masonry" },
    design_thermal_conductivity: 0.80,
    is_custom: false
  },
  {
    id: "mat-reinforced-concrete",
    name: { cs: "Železobeton", en: "Reinforced Concrete" },
    category: { cs: "Beton", en: "Concrete" },
    design_thermal_conductivity: 1.58,
    is_custom: false
  },
  {
    id: "mat-mineral-wool",
    name: { cs: "Minerální vata", en: "Mineral Wool" },
    category: { cs: "Tepelná izolace", en: "Thermal Insulation" },
    design_thermal_conductivity: 0.038,
    is_custom: false
  },
  {
    id: "mat-eps",
    name: { cs: "Pěnový polystyren EPS", en: "Expanded Polystyrene (EPS)" },
    category: { cs: "Tepelná izolace", en: "Thermal Insulation" },
    design_thermal_conductivity: 0.035,
    is_custom: false
  },
  {
    id: "mat-gypsum-board",
    name: { cs: "Sádrokartonová deska", en: "Gypsum Plasterboard" },
    category: { cs: "Deskové materiály", en: "Plasterboards" },
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
    name: "External Wall (Insulated) / Vnější stěna (Zateplená)",
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
    name: "Insulated Roof Standard / Zateplená střecha",
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
    name: "Double Glazed Window / Okno s dvojsklem",
    type: "window",
    rsi: 0.13,
    rse: 0.04,
    layers: [],
    direct_u_value: 1.2
  }
];

const northWallId = generateUUID();

// Initial demo envelope elements
const INITIAL_ENVELOPE_ELEMENTS: EnvelopeElement[] = [
  {
    id: northWallId,
    name: "North Wall (External) / Severní stěna",
    area: 45.0,
    assembly_id: demoAssemblyWallId,
    adjacent_space_type: "exterior",
    b_factor: 1.0,
    delta_u_tb: 0.05
  },
  {
    id: generateUUID(),
    name: "South Wall (External) / Jižní stěna",
    area: 45.0,
    assembly_id: demoAssemblyWallId,
    adjacent_space_type: "exterior",
    b_factor: 1.0,
    delta_u_tb: 0.05
  },
  {
    id: generateUUID(),
    name: "Main Roof / Hlavní střecha",
    area: 60.0,
    assembly_id: demoAssemblyRoofId,
    adjacent_space_type: "exterior",
    b_factor: 1.0,
    delta_u_tb: 0.05
  },
  {
    id: generateUUID(),
    name: "Living Room Window / Obývací okno",
    area: 6.0,
    assembly_id: demoAssemblyWindowId,
    adjacent_space_type: "exterior",
    b_factor: 1.0,
    delta_u_tb: 0.00,
    parent_element_id: northWallId
  },
  {
    id: generateUUID(),
    name: "Basement Floor Connection / Podlaha suterénu",
    area: 60.0,
    assembly_id: demoAssemblyWallId, // placeholder
    adjacent_space_type: "ground",
    b_factor: 0.45,
    delta_u_tb: 0.02
  }
];

// Get initial language preference from localStorage, default to 'cs' (Czech)
const getInitialLanguage = (): 'cs' | 'en' => {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('heat_loss_lang') : null;
  return (stored === 'cs' || stored === 'en') ? stored : 'cs';
};

interface HeatLossState {
  language: 'cs' | 'en';
  materials: Material[];
  assemblies: Assembly[];
  envelope_elements: EnvelopeElement[];
  environmental_settings: EnvironmentalSettings;

  // Actions
  setLanguage: (lang: 'cs' | 'en') => void;
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
  language: getInitialLanguage(),
  materials: BUILT_IN_MATERIALS,
  assemblies: INITIAL_ASSEMBLIES,
  envelope_elements: INITIAL_ENVELOPE_ELEMENTS,
  environmental_settings: DEFAULT_ENVIRONMENTAL_SETTINGS,

  // Language management
  setLanguage: (language) => set(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('heat_loss_lang', language);
    }
    return { language };
  }),

  // Materials
  addMaterial: (material) => set((state) => {
    const formatted: Material = {
      ...material,
      name: typeof material.name === 'string' ? { cs: material.name, en: material.name } : material.name,
      category: typeof material.category === 'string' ? { cs: material.category, en: material.category } : material.category
    };
    return {
      materials: [...state.materials, formatted]
    };
  }),

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
    envelope_elements: state.envelope_elements
      .filter((e) => e.id !== id)
      .map((e) => (e.parent_element_id === id ? { ...e, parent_element_id: undefined } : e))
  })),

  // Environmental Settings
  updateEnvironmentalSettings: (settings) => set((state) => ({
    environmental_settings: { ...state.environmental_settings, ...settings }
  })),

  // Project Management
  loadProject: (project) => set(() => {
    const loadedMaterials = (project.materials || []).map((m) => ({
      ...m,
      name: typeof m.name === 'string' ? { cs: m.name, en: m.name } : m.name,
      category: typeof m.category === 'string' ? { cs: m.category, en: m.category } : m.category
    }));

    // Merge loaded materials to avoid wiping out default ones if they were missing,
    // and map over the arrays to ensure safe fallback structures.
    const mergedMaterials = [...BUILT_IN_MATERIALS];
    loadedMaterials.forEach((m) => {
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
