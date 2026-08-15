import { create } from 'zustand';
import type { Material, Assembly, EnvelopeElement, EnvironmentalSettings, ProjectState, Layer, Storey, Room } from './types';
import { BUILT_IN_MATERIALS } from './data/materials';
import { generateRoomBoundarySurfaces } from './spatialEngine';

export { BUILT_IN_MATERIALS };

export interface Viewer3DTheme {
  bg_color: string;
  room_color: string;
  wireframe_color: string;
  storey_plane_color: string;
  storey_plane_opacity: number;
  opening_color: string;
  heatmap_low: string;
  heatmap_mid: string;
  heatmap_high: string;
}

export const DEFAULT_VIEWER_3D_THEME: Viewer3DTheme = {
  bg_color: '#0f172a',
  room_color: '#38bdf8',
  wireframe_color: '#1e293b',
  storey_plane_color: '#6366f1',
  storey_plane_opacity: 0.10,
  opening_color: '#0284c7',
  heatmap_low: '#22c55e',
  heatmap_mid: '#f59e0b',
  heatmap_high: '#ef4444'
};

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

// Initial storeys and rooms (Clean Slate: 0 rooms, 0 surfaces, 0 openings)
const INITIAL_STOREYS: Storey[] = [];
const INITIAL_ROOMS: Room[] = [];

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

// Initial envelope elements (Clean Slate Start)
const INITIAL_ENVELOPE_ELEMENTS: EnvelopeElement[] = [];

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
  viewer_3d_theme: Viewer3DTheme;

  // Actions
  setLanguage: (lang: 'cs' | 'en') => void;
  setMagneticSnapDistance: (dist: number) => void;
  updateViewer3DTheme: (theme: Partial<Viewer3DTheme>) => void;
  resetViewer3DTheme: () => void;

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
  magnetic_snap_distance: 0.50, // Default 0.5m
  viewer_3d_theme: DEFAULT_VIEWER_3D_THEME,

  setMagneticSnapDistance: (dist) => set(() => ({
    magnetic_snap_distance: Math.min(1.0, Math.max(0.02, dist))
  })),

  updateViewer3DTheme: (updated) => set((state) => ({
    viewer_3d_theme: { ...state.viewer_3d_theme, ...updated }
  })),

  resetViewer3DTheme: () => set(() => ({
    viewer_3d_theme: DEFAULT_VIEWER_3D_THEME
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
    materials: state.materials.filter((m) => m.id !== id || !m.is_custom)
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
  addElement: (element) => set((state) => {
    const formatted: EnvelopeElement = {
      ...element,
      is_virtual: element.is_virtual ?? (!element.room_id && !element.parent_element_id),
      source: element.source ?? (element.room_id ? 'volume' : 'manual')
    };
    return {
      envelope_elements: [...state.envelope_elements, formatted]
    };
  }),

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
    const previousRoom = state.rooms.find((r) => r.id === id);
    const updatedRooms = state.rooms.map((r) => (r.id === id ? { ...r, ...updated } : r));
    const targetRoom = updatedRooms.find((r) => r.id === id);

    if (!targetRoom) return { rooms: updatedRooms };

    const defaultAssembly = state.assemblies[0]?.id || '';
    const freshSurfaces = generateRoomBoundarySurfaces(targetRoom, state.storeys, defaultAssembly);

    const isShapeTypeChanged = previousRoom && previousRoom.shape_type !== targetRoom.shape_type;

    let updatedElements: EnvelopeElement[] = [];

    if (isShapeTypeChanged) {
      const nonRoomElements = state.envelope_elements.filter((el) => el.room_id !== id);
      const roomChildOpenings = state.envelope_elements.filter(
        (el) => el.room_id === id && el.parent_element_id !== undefined
      );

      const remappedOpenings = roomChildOpenings.map((child) => {
        const matchingParent = freshSurfaces.find(
          (p) => p.parent_face === child.parent_face || p.relative_angle === child.relative_angle
        ) || freshSurfaces[0];
        return {
          ...child,
          parent_element_id: matchingParent?.id,
          parent_face: matchingParent?.parent_face
        };
      });

      updatedElements = [...nonRoomElements, ...freshSurfaces, ...remappedOpenings];
    } else {
      const existingRoomSurfaces = state.envelope_elements.filter((el) => el.room_id === id && !el.parent_element_id);
      const hasGeneratedSurfaces = existingRoomSurfaces.length > 0;

      if (!hasGeneratedSurfaces) {
        updatedElements = [...state.envelope_elements, ...freshSurfaces];
      } else {
        updatedElements = state.envelope_elements.map((el) => {
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
      }
    }

    return {
      rooms: updatedRooms,
      envelope_elements: updatedElements
    };
  }),

  deleteRoom: (id) => set((state) => {
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

    const mergedMaterials = [...BUILT_IN_MATERIALS];
    loadedMaterials.forEach((m) => {
      if (!mergedMaterials.some((bm) => bm.id === m.id)) {
        mergedMaterials.push(m);
      }
    });

    const loadedElements = (project.envelope_elements || []).map((e) => ({
      ...e,
      relative_angle: typeof e.relative_angle === 'number' ? e.relative_angle : 0,
      tilt: typeof e.tilt === 'number' ? e.tilt : 90
    }));

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
    envelope_elements: [],
    environmental_settings: DEFAULT_ENVIRONMENTAL_SETTINGS,
    storeys: [],
    rooms: []
  }))
}));
