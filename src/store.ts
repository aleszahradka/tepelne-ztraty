import { create } from 'zustand';
import type { Material, Assembly, EnvelopeElement, EnvironmentalSettings, ProjectState, Layer, Storey, Room } from './types';
import { BUILT_IN_MATERIALS } from './data/materials';
import { generateRoomBoundarySurfaces } from './spatialEngine';

export { BUILT_IN_MATERIALS };

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
  air_exchange_rate: 0.5,
  building_orientation: 0
};

// Initial storeys and rooms
const defaultStoreyId = 'storey-1np';
const INITIAL_STOREYS: Storey[] = [
  {
    id: defaultStoreyId,
    name: '1.NP / Ground Floor',
    level_z: 0
  }
];

const livingRoomId = 'room-living-room';
const bathroomId = 'room-bathroom';

const INITIAL_ROOMS: Room[] = [
  {
    id: livingRoomId,
    name: '1.01 Obývací pokoj / Living Room',
    storey_id: defaultStoreyId,
    area: 30,
    height: 2.7,
    t_int: 20,
    air_exchange_rate: 0.5,
    width: 5,
    length: 6,
    pos_x: 0,
    pos_y: 0
  },
  {
    id: bathroomId,
    name: '1.02 Koupelna / Bathroom',
    storey_id: defaultStoreyId,
    area: 8,
    height: 2.7,
    t_int: 24,
    air_exchange_rate: 1.5,
    width: 2.5,
    length: 3.2,
    pos_x: 5,
    pos_y: 0
  }
];

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
      { id: generateUUID(), material_id: "mat-eps-70f", thickness: 0.15 }
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
      { id: generateUUID(), material_id: "mat-mineral-wool-roll", thickness: 0.24 }
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
    delta_u_tb: 0.05,
    room_id: livingRoomId,
    relative_angle: 0,
    tilt: 90
  },
  {
    id: generateUUID(),
    name: "South Wall (External) / Jižní stěna",
    area: 45.0,
    assembly_id: demoAssemblyWallId,
    adjacent_space_type: "exterior",
    b_factor: 1.0,
    delta_u_tb: 0.05,
    room_id: livingRoomId,
    relative_angle: 180,
    tilt: 90
  },
  {
    id: generateUUID(),
    name: "Main Roof / Hlavní střecha",
    area: 60.0,
    assembly_id: demoAssemblyRoofId,
    adjacent_space_type: "exterior",
    b_factor: 1.0,
    delta_u_tb: 0.05,
    relative_angle: 0,
    tilt: 0
  },
  {
    id: generateUUID(),
    name: "Living Room Window / Obývací okno",
    area: 6.0,
    assembly_id: demoAssemblyWindowId,
    adjacent_space_type: "exterior",
    b_factor: 1.0,
    delta_u_tb: 0.00,
    parent_element_id: northWallId,
    room_id: livingRoomId,
    relative_angle: 0,
    tilt: 90
  },
  {
    id: generateUUID(),
    name: "Basement Floor Connection / Podlaha suterénu",
    area: 60.0,
    assembly_id: demoAssemblyWallId, // placeholder
    adjacent_space_type: "ground",
    b_factor: 0.45,
    delta_u_tb: 0.02,
    relative_angle: 0,
    tilt: 0
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
  storeys: Storey[];
  rooms: Room[];
  magnetic_snap_distance: number;

  // Actions
  setLanguage: (lang: 'cs' | 'en') => void;
  setMagneticSnapDistance: (dist: number) => void;
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

  addStorey: (storey: Storey) => void;
  updateStorey: (id: string, updated: Partial<Storey>) => void;
  deleteStorey: (id: string) => void;

  addRoom: (room: Room) => void;
  updateRoom: (id: string, updated: Partial<Room>) => void;
  deleteRoom: (id: string) => void;

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
  storeys: INITIAL_STOREYS,
  rooms: INITIAL_ROOMS,
  magnetic_snap_distance: 0.15,

  setMagneticSnapDistance: (dist) => set(() => ({
    magnetic_snap_distance: Math.min(0.5, Math.max(0.02, dist))
  })),

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
    envelope_elements: state.envelope_elements.map((e) => {
      if (e.id !== id) return e;
      const newElem = { ...e, ...updated };
      if (updated.parent_element_id === '') newElem.parent_element_id = undefined;
      if (updated.room_id === '') newElem.room_id = undefined;
      if (typeof newElem.opening_width === 'number' && typeof newElem.opening_height === 'number') {
        newElem.area = Math.round(newElem.opening_width * newElem.opening_height * 100) / 100;
      }
      return newElem;
    })
  })),

  deleteElement: (id) => set((state) => ({
    envelope_elements: state.envelope_elements
      .filter((e) => e.id !== id)
      .map((e) => (e.parent_element_id === id ? { ...e, parent_element_id: undefined } : e))
  })),

  // Storeys
  addStorey: (storey) => set((state) => ({
    storeys: [...state.storeys, storey]
  })),

  updateStorey: (id, updated) => set((state) => ({
    storeys: state.storeys.map((s) => (s.id === id ? { ...s, ...updated } : s))
  })),

  deleteStorey: (id) => set((state) => {
    const updatedRooms = state.rooms.map((r) => (r.storey_id === id ? { ...r, storey_id: '' } : r));
    return {
      storeys: state.storeys.filter((s) => s.id !== id),
      rooms: updatedRooms
    };
  }),

  // Rooms with automatic boundary surface generation and dynamic gross area synchronization
  addRoom: (room) => set((state) => {
    const defaultAssembly = state.assemblies[0]?.id || '';
    const generatedSurfaces = generateRoomBoundarySurfaces(room, state.storeys, defaultAssembly);
    return {
      rooms: [...state.rooms, room],
      envelope_elements: [...state.envelope_elements, ...generatedSurfaces]
    };
  }),

  updateRoom: (id, updated) => set((state) => {
    const updatedRooms = state.rooms.map((r) => (r.id === id ? { ...r, ...updated } : r));
    const targetRoom = updatedRooms.find((r) => r.id === id);

    if (!targetRoom) return { rooms: updatedRooms };

    const defaultAssembly = state.assemblies[0]?.id || '';
    const freshSurfaces = generateRoomBoundarySurfaces(targetRoom, state.storeys, defaultAssembly);

    // Sync gross areas of existing generated boundary elements
    const updatedElements = state.envelope_elements.map((el) => {
      if (el.room_id !== id) return el;
      const matchingFresh = freshSurfaces.find((f) => f.id === el.id);
      if (matchingFresh) {
        return {
          ...el,
          area: matchingFresh.area,
          name: el.name.startsWith(targetRoom.name.split(' – ')[0])
            ? el.name
            : `${targetRoom.name} – ${el.name.split(' – ')[1] || el.name}`
        };
      }
      return el;
    });

    return {
      rooms: updatedRooms,
      envelope_elements: updatedElements
    };
  }),

  deleteRoom: (id) => set((state) => {
    // Delete generated boundary elements of the deleted room
    // Preserve child openings by clearing parent_element_id & room_id so they move safely to the unassigned elements pool
    const updatedElements = state.envelope_elements
      .filter((e) => e.room_id !== id)
      .map((e) => {
        const parentWasRoomSurface = state.envelope_elements.some(
          (p) => p.id === e.parent_element_id && p.room_id === id
        );
        if (parentWasRoomSurface) {
          return { ...e, parent_element_id: undefined, room_id: undefined };
        }
        return e;
      });

    return {
      rooms: state.rooms.filter((r) => r.id !== id),
      envelope_elements: updatedElements
    };
  }),

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

    // Merge loaded materials to avoid wiping out default ones if they were missing
    const mergedMaterials = [...BUILT_IN_MATERIALS];
    loadedMaterials.forEach((m) => {
      if (!mergedMaterials.some((bm) => bm.id === m.id)) {
        mergedMaterials.push(m);
      }
    });

    // Fallbacks for envelope elements
    const loadedElements = (project.envelope_elements || []).map((e) => ({
      ...e,
      relative_angle: typeof e.relative_angle === 'number' ? e.relative_angle : 0,
      tilt: typeof e.tilt === 'number' ? e.tilt : 90
    }));

    // Fallbacks for environmental settings
    const loadedSettings: EnvironmentalSettings = {
      ...DEFAULT_ENVIRONMENTAL_SETTINGS,
      ...(project.environmental_settings || {}),
      building_orientation: typeof project.environmental_settings?.building_orientation === 'number'
        ? project.environmental_settings.building_orientation
        : 0
    };

    return {
      materials: mergedMaterials,
      assemblies: project.assemblies || [],
      envelope_elements: loadedElements,
      environmental_settings: loadedSettings,
      storeys: project.storeys || INITIAL_STOREYS,
      rooms: project.rooms || INITIAL_ROOMS
    };
  }),

  resetProject: () => set(() => ({
    materials: BUILT_IN_MATERIALS,
    assemblies: INITIAL_ASSEMBLIES,
    envelope_elements: INITIAL_ENVELOPE_ELEMENTS,
    environmental_settings: DEFAULT_ENVIRONMENTAL_SETTINGS,
    storeys: INITIAL_STOREYS,
    rooms: INITIAL_ROOMS
  }))
}));
