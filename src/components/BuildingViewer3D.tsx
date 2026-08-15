import React, { useState, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useHeatLossStore, generateUUID } from '../store';
import { calculateEffectiveUValue } from '../mathEngine';
import {
  detectRoomAdjacencies,
  applyMagneticFaceSnapping,
  checkRoomAABBCollision,
  type RoomContact
} from '../spatialEngine';
import type { Room, Storey, EnvelopeElement, Assembly, Material } from '../types';
import { useTranslate } from '../hooks/useTranslate';
import {
  Flame, RefreshCw, Compass, Layers, Plus, Trash2, Magnet, Move,
  Maximize2, MousePointer, ShieldAlert, Sliders, LayoutGrid
} from 'lucide-react';

// Get heatmap color based on effective U-value
function getThermalColor(uValue: number, isOpening: boolean = false): string {
  if (isOpening) return '#ef4444'; // Red for windows/doors
  if (uValue <= 0) return '#94a3b8'; // Neutral slate
  if (uValue <= 0.18) return '#22c55e'; // Green: Highly insulated
  if (uValue <= 0.50) return '#f59e0b'; // Yellow/Orange: Standard insulation
  return '#ef4444'; // Red: High heat loss
}

// Procedural Triangular Prism Geometry for Gable Roofs
function createTriangularPrismGeometry(width: number, height: number, length: number) {
  const geom = new THREE.BufferGeometry();
  const halfW = width / 2;

  // Vertices for triangular prism (gable roof along Z-axis)
  const vertices = new Float32Array([
    // Front triangle face (+Z)
    -halfW, 0, length / 2,
     halfW, 0, length / 2,
     0, height, length / 2,

    // Back triangle face (-Z)
     halfW, 0, -length / 2,
    -halfW, 0, -length / 2,
     0, height, -length / 2,

    // Left pitched roof slope
    -halfW, 0, length / 2,
     0, height, length / 2,
     0, height, -length / 2,
    -halfW, 0, -length / 2,

    // Right pitched roof slope
     0, height, length / 2,
     halfW, 0, length / 2,
     halfW, 0, -length / 2,
     0, height, -length / 2,

    // Bottom base face (-Y)
    -halfW, 0, -length / 2,
     halfW, 0, -length / 2,
     halfW, 0, length / 2,
    -halfW, 0, length / 2
  ]);

  const indices = [
    0, 1, 2,       // Front triangle
    3, 4, 5,       // Back triangle
    6, 7, 8,  6, 8, 9,   // Left slope
    10, 11, 12, 10, 12, 13, // Right slope
    14, 15, 16, 14, 16, 17  // Bottom base
  ];

  geom.setIndex(indices);
  geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geom.computeVertexNormals();
  return geom;
}

interface RoomMeshProps {
  room: Room;
  levelZ: number;
  elements: EnvelopeElement[];
  assemblies: Assembly[];
  materials: Material[];
  heatmapOverlay: boolean;
  wireframe: boolean;
  selectedRoomId: string | null;
  transformMode: 'translate' | 'scale' | 'view';
  gridSnap: boolean;
  snapStep: number;
  magneticSnap: boolean;
  snapDistance: number;
  preventCollision: boolean;
  rooms: Room[];
  storeys: Storey[];
  onSelectRoom: (id: string) => void;
  onSelectElement: (id: string) => void;
  onFaceClick?: (roomId: string, faceIndex: number, point: THREE.Vector3) => void;
  updateRoom: (id: string, updated: Partial<Room>) => void;
}

const RoomMesh: React.FC<RoomMeshProps> = ({
  room,
  levelZ,
  elements,
  assemblies,
  materials,
  heatmapOverlay,
  wireframe,
  selectedRoomId,
  transformMode,
  gridSnap,
  snapStep,
  magneticSnap,
  snapDistance,
  preventCollision,
  rooms,
  storeys,
  onSelectRoom,
  onSelectElement,
  onFaceClick,
  updateRoom
}) => {
  const groupRef = useRef<THREE.Group>(null!);
  const width = room.width || (room.area ? Math.sqrt(room.area) : 4);
  const length = room.length || (room.area ? Math.sqrt(room.area) : 4);
  const height = room.height || 2.7;
  const posX = room.pos_x ?? 0;
  const posY = room.pos_y ?? 0;
  const shapeType = room.shape_type || 'box';

  const centerX = posX + width / 2;
  const centerY = levelZ + height / 2;
  const centerZ = posY + length / 2;

  const isSelected = selectedRoomId === room.id;

  // Linked envelope elements
  const roomElements = useMemo(() => {
    return elements.filter((e) => e.room_id === room.id);
  }, [elements, room.id]);

  // Face U-values mapping
  const faceUValues = useMemo(() => {
    const uVals = [0, 0, 0, 0, 0, 0];
    roomElements.forEach((el) => {
      const effU = calculateEffectiveUValue(el, assemblies, materials);
      if (el.tilt === 0) {
        uVals[4] = effU; // Top / Roof
      } else {
        const normAngle = ((el.relative_angle % 360) + 360) % 360;
        if (normAngle >= 315 || normAngle < 45) uVals[0] = effU; // Front (+Z)
        else if (normAngle >= 45 && normAngle < 135) uVals[1] = effU; // Right (+X)
        else if (normAngle >= 135 && normAngle < 225) uVals[2] = effU; // Back (-Z)
        else if (normAngle >= 225 && normAngle < 315) uVals[3] = effU; // Left (-X)
      }
    });
    return uVals;
  }, [roomElements, assemblies, materials]);

  // Openings
  const childOpenings = useMemo(() => {
    const openings: {
      id: string;
      name: string;
      area: number;
      faceIndex: number;
      uValue: number;
      element: EnvelopeElement;
    }[] = [];

    roomElements.forEach((parent) => {
      const children = elements.filter((child) => child.parent_element_id === parent.id);
      children.forEach((child) => {
        let faceIndex = 0;
        const normAngle = ((parent.relative_angle % 360) + 360) % 360;
        if (parent.tilt === 0) {
          faceIndex = 4;
        } else {
          if (normAngle >= 315 || normAngle < 45) faceIndex = 0;
          else if (normAngle >= 45 && normAngle < 135) faceIndex = 1;
          else if (normAngle >= 135 && normAngle < 225) faceIndex = 2;
          else if (normAngle >= 225 && normAngle < 315) faceIndex = 3;
        }
        openings.push({
          id: child.id,
          name: child.name,
          area: child.area,
          faceIndex,
          uValue: calculateEffectiveUValue(child, assemblies, materials),
          element: child
        });
      });
    });

    return openings;
  }, [roomElements, elements, assemblies, materials]);

  const materialsList = useMemo(() => {
    if (!heatmapOverlay) {
      const defaultColor = isSelected ? '#6366f1' : '#38bdf8';
      return [
        { color: defaultColor, opacity: 0.65 },
        { color: defaultColor, opacity: 0.65 },
        { color: defaultColor, opacity: 0.65 },
        { color: defaultColor, opacity: 0.65 },
        { color: '#818cf8', opacity: 0.7 },
        { color: '#94a3b8', opacity: 0.7 }
      ];
    }
    return [
      { color: getThermalColor(faceUValues[1]), opacity: 0.85 }, // Right
      { color: getThermalColor(faceUValues[3]), opacity: 0.85 }, // Left
      { color: getThermalColor(faceUValues[4]), opacity: 0.85 }, // Top
      { color: '#64748b', opacity: 0.5 },                        // Bottom
      { color: getThermalColor(faceUValues[0]), opacity: 0.85 }, // Front
      { color: getThermalColor(faceUValues[2]), opacity: 0.85 }  // Back
    ];
  }, [heatmapOverlay, faceUValues, isSelected]);

  // Handle Transform Gizmo Change with Magnetic Snapping & Collision Constraints
  const handleTransformChange = () => {
    if (!groupRef.current) return;
    const currentGroup = groupRef.current;

    if (transformMode === 'translate') {
      let candidateCenterX = currentGroup.position.x;
      let candidateCenterZ = currentGroup.position.z;

      let newPosX = candidateCenterX - width / 2;
      let newPosY = candidateCenterZ - length / 2;

      // 1. Grid Snapping
      if (gridSnap && snapStep > 0) {
        newPosX = Math.round(newPosX / snapStep) * snapStep;
        newPosY = Math.round(newPosY / snapStep) * snapStep;
      }

      // 2. Magnetic Face Snapping
      if (magneticSnap) {
        const snapRes = applyMagneticFaceSnapping(
          room,
          newPosX,
          newPosY,
          rooms,
          storeys,
          snapDistance
        );
        newPosX = snapRes.snappedX;
        newPosY = snapRes.snappedY;
      }

      // 3. AABB Collision Prevention
      const candidateAABB = {
        roomId: room.id,
        minX: newPosX,
        maxX: newPosX + width,
        minY: levelZ,
        maxY: levelZ + height,
        minZ: newPosY,
        maxZ: newPosY + length,
        width,
        height,
        length
      };

      if (preventCollision && checkRoomAABBCollision(room.id, candidateAABB, rooms, storeys)) {
        // Collision detected: Revert to original position
        currentGroup.position.x = centerX;
        currentGroup.position.z = centerZ;
        return;
      }

      updateRoom(room.id, {
        pos_x: Math.round(newPosX * 100) / 100,
        pos_y: Math.round(newPosY * 100) / 100
      });
    } else if (transformMode === 'scale') {
      const sx = currentGroup.scale.x;
      const sy = currentGroup.scale.y;
      const sz = currentGroup.scale.z;

      let newW = width * sx;
      let newL = length * sz;
      let newH = height * sy;

      if (gridSnap && snapStep > 0) {
        newW = Math.max(1, Math.round(newW / snapStep) * snapStep);
        newL = Math.max(1, Math.round(newL / snapStep) * snapStep);
        newH = Math.max(1, Math.round(newH / snapStep) * snapStep);
      }

      newW = Math.round(newW * 10) / 10;
      newL = Math.round(newL * 10) / 10;
      newH = Math.round(newH * 10) / 10;

      currentGroup.scale.set(1, 1, 1);

      updateRoom(room.id, {
        width: newW,
        length: newL,
        height: newH,
        area: Math.round(newW * newL * 100) / 100
      });
    }
  };

  // Custom Prism Geometry
  const prismGeometry = useMemo(() => {
    if (shapeType === 'triangular_prism') {
      return createTriangularPrismGeometry(width, height, length);
    }
    return null;
  }, [shapeType, width, height, length]);

  return (
    <>
      <group ref={groupRef} position={[centerX, centerY, centerZ]}>
        {/* Box Geometry or Triangular Roof Prism Geometry */}
        {shapeType === 'triangular_prism' && prismGeometry ? (
          <mesh
            geometry={prismGeometry}
            onClick={(e) => {
              e.stopPropagation();
              onSelectRoom(room.id);
            }}
          >
            <meshStandardMaterial
              color={isSelected ? '#6366f1' : '#f59e0b'}
              transparent
              opacity={0.8}
              wireframe={wireframe}
            />
          </mesh>
        ) : (
          <mesh
            onClick={(e) => {
              e.stopPropagation();
              onSelectRoom(room.id);
              if (e.faceIndex != null && onFaceClick) {
                const faceMaterialIndex = Math.floor(e.faceIndex / 2);
                onFaceClick(room.id, faceMaterialIndex, e.point);
              }
            }}
          >
            <boxGeometry args={[width, height, length]} />
            {materialsList.map((m, idx) => (
              <meshStandardMaterial
                key={idx}
                attach={`material-${idx}`}
                color={m.color}
                transparent
                opacity={m.opacity}
                wireframe={wireframe}
                roughness={0.3}
                metalness={0.1}
              />
            ))}
          </mesh>
        )}

        {/* Wireframe Outline */}
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(width, height, length)]} />
          <lineBasicMaterial color={isSelected ? '#4f46e5' : '#1e293b'} linewidth={isSelected ? 2 : 1} />
        </lineSegments>

        {/* Room Label */}
        <Text
          position={[0, height / 2 + 0.3, 0]}
          fontSize={0.35}
          color="#1e293b"
          anchorX="center"
          anchorY="bottom"
        >
          {room.name}
        </Text>

        {/* Openings */}
        {childOpenings.map((opening) => {
          const winW = opening.element.opening_width || Math.min(1.5, Math.sqrt(opening.area));
          const winH = opening.element.opening_height || (opening.area / winW);

          const offX = opening.element.offset_x || 0;
          const offY = opening.element.offset_y || 0;

          let openPos: [number, number, number] = [offX, offY, 0];
          let openRot: [number, number, number] = [0, 0, 0];

          if (opening.faceIndex === 0) openPos = [offX, offY, length / 2 + 0.02];
          else if (opening.faceIndex === 1) {
            openPos = [width / 2 + 0.02, offY, offX];
            openRot = [0, Math.PI / 2, 0];
          } else if (opening.faceIndex === 2) {
            openPos = [offX, offY, -length / 2 - 0.02];
            openRot = [0, Math.PI, 0];
          } else if (opening.faceIndex === 3) {
            openPos = [-width / 2 - 0.02, offY, offX];
            openRot = [0, -Math.PI / 2, 0];
          }

          const openingColor = heatmapOverlay ? getThermalColor(opening.uValue, true) : '#0284c7';

          return (
            <mesh
              key={opening.id}
              position={openPos}
              rotation={openRot}
              onClick={(e) => {
                e.stopPropagation();
                onSelectElement(opening.id);
              }}
            >
              <planeGeometry args={[winW, winH]} />
              <meshStandardMaterial
                color={openingColor}
                transparent
                opacity={0.85}
                roughness={0.1}
                metalness={0.8}
              />
            </mesh>
          );
        })}
      </group>

      {/* Transform Controls */}
      {isSelected && transformMode !== 'view' && groupRef.current && (
        <TransformControls
          object={groupRef.current}
          mode={transformMode}
          translationSnap={gridSnap ? snapStep : undefined}
          scaleSnap={gridSnap ? snapStep : undefined}
          onMouseUp={handleTransformChange}
        />
      )}
    </>
  );
};

// Sun light
function SunLight({ orientation }: { orientation: number }) {
  const rad = (orientation * Math.PI) / 180;
  const x = 20 * Math.sin(rad);
  const z = 20 * Math.cos(rad);

  return (
    <directionalLight
      position={[x, 25, z]}
      intensity={1.2}
      castShadow
      shadow-mapSize-width={1024}
      shadow-mapSize-height={1024}
    />
  );
}

// 3D Compass
function Compass3D({ orientation }: { orientation: number }) {
  const rad = (-orientation * Math.PI) / 180;

  return (
    <group position={[-2, 0.1, -2]} rotation={[0, rad, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1.0, 32]} />
        <meshBasicMaterial color="#64748b" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 0.8]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.2, 0.8, 4]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      <mesh position={[0, 0, -0.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.2, 0.8, 4]} />
        <meshBasicMaterial color="#64748b" />
      </mesh>
      <Text position={[0, 0.3, 1.2]} fontSize={0.3} color="#ef4444" anchorX="center">
        N
      </Text>
    </group>
  );
}

// Contact Partitions
function ContactPartitionMeshes({ contacts }: { contacts: RoomContact[] }) {
  return (
    <>
      {contacts.map((c, idx) => (
        <mesh key={idx} position={[c.centerX, c.centerY, c.centerZ]}>
          <boxGeometry args={[c.overlapWidth, c.overlapHeight, c.overlapLength]} />
          <meshStandardMaterial
            color={c.isEqualTemp ? '#6366f1' : '#f97316'}
            transparent
            opacity={0.8}
            roughness={0.2}
          />
        </mesh>
      ))}
    </>
  );
}

export const BuildingViewer3D: React.FC = () => {
  const { t } = useTranslate();

  const storeys = useHeatLossStore((state) => state.storeys);
  const rooms = useHeatLossStore((state) => state.rooms);
  const elements = useHeatLossStore((state) => state.envelope_elements);
  const assemblies = useHeatLossStore((state) => state.assemblies);
  const materials = useHeatLossStore((state) => state.materials);
  const settings = useHeatLossStore((state) => state.environmental_settings);

  const magneticSnapDistance = useHeatLossStore((state) => state.magnetic_snap_distance);
  const setMagneticSnapDistance = useHeatLossStore((state) => state.setMagneticSnapDistance);

  const addRoom = useHeatLossStore((state) => state.addRoom);
  const updateRoom = useHeatLossStore((state) => state.updateRoom);
  const deleteRoom = useHeatLossStore((state) => state.deleteRoom);
  const addElement = useHeatLossStore((state) => state.addElement);
  const updateElement = useHeatLossStore((state) => state.updateElement);
  const addStorey = useHeatLossStore((state) => state.addStorey);

  const [heatmapOverlay, setHeatmapOverlay] = useState<boolean>(true);
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [transformMode, setTransformMode] = useState<'translate' | 'scale' | 'view'>('translate');
  const [gridSnap, setGridSnap] = useState<boolean>(true);
  const [snapStep, setSnapStep] = useState<number>(0.5);
  const [magneticSnap, setMagneticSnap] = useState<boolean>(true);
  const [preventCollision, setPreventCollision] = useState<boolean>(true);
  const [resetKey, setResetKey] = useState<number>(0);

  const [surfaceContextMenu, setSurfaceContextMenu] = useState<{
    roomId: string;
    faceIndex: number;
  } | null>(null);

  const roomContacts = useMemo(() => {
    return detectRoomAdjacencies(rooms, storeys);
  }, [rooms, storeys]);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const selectedElement = elements.find((e) => e.id === selectedElementId);

  const handleAddDefaultRoom = () => {
    const storeyId = storeys[0]?.id || '';
    const newRoomId = generateUUID();

    let posX = 0;
    if (rooms.length > 0) {
      const maxX = Math.max(...rooms.map((r) => (r.pos_x ?? 0) + (r.width ?? 4)));
      posX = maxX + 1.0;
    }

    const newRoom: Room = {
      id: newRoomId,
      name: `${rooms.length + 1}.01 Room`,
      storey_id: storeyId,
      width: 4,
      length: 4,
      height: 2.7,
      area: 16,
      t_int: 20,
      air_exchange_rate: 0.5,
      pos_x: posX,
      pos_y: 0,
      shape_type: 'box'
    };

    addRoom(newRoom);
    setSelectedRoomId(newRoomId);
  };

  const handleDeleteSelectedRoom = () => {
    if (!selectedRoomId) return;
    deleteRoom(selectedRoomId);
    setSelectedRoomId(null);
  };

  const handleAddOpeningToSurface = (type: 'window' | 'door') => {
    if (!surfaceContextMenu) return;
    const { roomId, faceIndex } = surfaceContextMenu;

    const assembly = assemblies.find((a) => a.type === type) || assemblies[0];
    if (!assembly) return;

    let relativeAngle = 0;
    let tilt = 90;
    if (faceIndex === 0) relativeAngle = 90;
    else if (faceIndex === 1) relativeAngle = 270;
    else if (faceIndex === 2) tilt = 0;
    else if (faceIndex === 3) tilt = 0;
    else if (faceIndex === 4) relativeAngle = 0;
    else if (faceIndex === 5) relativeAngle = 180;

    const parentWall = elements.find(
      (e) => e.room_id === roomId && e.relative_angle === relativeAngle && e.tilt === tilt
    );

    const winW = type === 'window' ? 1.5 : 0.9;
    const winH = type === 'window' ? 1.2 : 2.1;

    const newOpening: EnvelopeElement = {
      id: generateUUID(),
      name: type === 'window' ? 'Window / Okno' : 'Door / Dveře',
      area: winW * winH,
      assembly_id: assembly.id,
      adjacent_space_type: 'exterior',
      b_factor: 1.0,
      delta_u_tb: 0.0,
      room_id: roomId,
      parent_element_id: parentWall?.id,
      relative_angle: relativeAngle,
      tilt: tilt,
      opening_width: winW,
      opening_height: winH,
      offset_x: 0,
      offset_y: 0
    };

    addElement(newOpening);
    setSelectedElementId(newOpening.id);
    setSurfaceContextMenu(null);
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-slate-100 flex flex-col space-y-4 max-w-full overflow-hidden">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-800">{t.viewer3d?.title || '3D Modelování & Tepelná mapa'}</h2>
          </div>
          <p className="text-xs text-slate-500">
            {t.viewer3d?.desc || 'Interaktivní 3D editor budovy s automatickým výpočtem stykových ploch a teplotních ztrát.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setHeatmapOverlay(!heatmapOverlay)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
              heatmapOverlay
                ? 'bg-gradient-to-r from-amber-500 to-red-500 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            {t.viewer3d?.heatmapOverlay || 'Tepelná mapa'}
          </button>

          <button
            onClick={() => setWireframe(!wireframe)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              wireframe
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            {t.viewer3d?.wireframe || 'Drátový model'}
          </button>

          <button
            onClick={() => setResetKey((k) => k + 1)}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
            title={t.viewer3d?.resetView || 'Obnovit pohled'}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating 3D Editor Toolbar (Mobile Responsive) */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs overflow-x-auto max-w-full">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Transform Mode Switcher */}
          <button
            onClick={() => setTransformMode('translate')}
            className={`px-2.5 py-1.5 rounded-md font-semibold flex items-center gap-1 transition-colors ${
              transformMode === 'translate' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Move className="w-3.5 h-3.5" />
            {t.viewer3d?.modeMove || 'Posun'}
          </button>
          <button
            onClick={() => setTransformMode('scale')}
            className={`px-2.5 py-1.5 rounded-md font-semibold flex items-center gap-1 transition-colors ${
              transformMode === 'scale' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            {t.viewer3d?.modeResize || 'Velikost'}
          </button>
          <button
            onClick={() => setTransformMode('view')}
            className={`px-2.5 py-1.5 rounded-md font-semibold flex items-center gap-1 transition-colors ${
              transformMode === 'view' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <MousePointer className="w-3.5 h-3.5" />
            {t.viewer3d?.modeView || 'Prohlížení'}
          </button>

          {/* Magnetic Face Snap Toggle & Sensitivity Distance Slider */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md px-1.5 py-1">
            <button
              onClick={() => setMagneticSnap(!magneticSnap)}
              className={`px-1.5 py-0.5 rounded font-semibold flex items-center gap-1 text-xs transition-colors ${
                magneticSnap ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
              }`}
              title={t.viewer3d?.magneticSnap || 'Magnetické přichytávání'}
            >
              <Magnet className="w-3.5 h-3.5" />
              <span>{t.viewer3d?.magneticSnap || 'Magnet'}</span>
            </button>
            {magneticSnap && (
              <div className="flex items-center gap-1 text-[11px] text-slate-600 font-mono">
                <input
                  type="number"
                  step="0.05"
                  min="0.02"
                  max="0.50"
                  value={magneticSnapDistance}
                  onChange={(e) => setMagneticSnapDistance(parseFloat(e.target.value) || 0.15)}
                  className="w-12 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-center text-xs text-slate-800 font-mono"
                  title={t.viewer3d?.magnetSensitivity || 'Citlivost magnetu (m)'}
                />
                <span className="text-[10px] text-slate-400">m</span>
              </div>
            )}
          </div>

          {/* Collision Prevention Toggle */}
          <button
            onClick={() => setPreventCollision(!preventCollision)}
            className={`px-2.5 py-1.5 rounded-md font-semibold flex items-center gap-1 transition-colors ${
              preventCollision ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-500'
            }`}
            title={t.viewer3d?.preventOverlap || 'Zabránit překrývání'}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{t.viewer3d?.preventOverlap || 'Srážky'}</span>
          </button>

          {/* Grid Snap & Step */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setGridSnap(!gridSnap)}
              className={`px-2 py-1.5 rounded-md font-semibold flex items-center gap-1 transition-colors ${
                gridSnap ? 'bg-slate-700 text-white' : 'bg-white border border-slate-200 text-slate-500'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            {gridSnap && (
              <select
                value={snapStep}
                onChange={(e) => setSnapStep(parseFloat(e.target.value) || 0.5)}
                className="px-1.5 py-1 bg-white border border-slate-200 rounded text-slate-700 font-semibold focus:ring-1 focus:ring-indigo-500"
              >
                <option value={0.1}>0.1m</option>
                <option value={0.5}>0.5m</option>
                <option value={1.0}>1.0m</option>
              </select>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddDefaultRoom}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-bold flex items-center gap-1 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            {t.viewer3d?.addRoom || 'Přidat místnost'}
          </button>

          {selectedRoomId && (
            <button
              onClick={handleDeleteSelectedRoom}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md font-bold flex items-center gap-1 transition-colors shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t.viewer3d?.deleteSelected || 'Smazat'}
            </button>
          )}
        </div>
      </div>

      {/* 3D WebGL Canvas Container */}
      <div className="relative w-full h-[480px] bg-slate-900 rounded-xl overflow-hidden shadow-inner">
        <Canvas
          key={resetKey}
          camera={{ position: [14, 14, 18], fov: 45 }}
          shadows
          className="w-full h-full"
        >
          <ambientLight intensity={0.7} />
          <SunLight orientation={settings.building_orientation ?? 0} />

          <OrbitControls makeDefault enableDamping dampingFactor={0.05} />

          <gridHelper args={[40, 40, '#475569', '#334155']} position={[0, -0.01, 0]} />

          <Compass3D orientation={settings.building_orientation ?? 0} />

          <ContactPartitionMeshes contacts={roomContacts} />

          {storeys.map((storey) => {
            const storeyRooms = rooms.filter((r) => r.storey_id === storey.id);
            return storeyRooms.map((room) => (
              <RoomMesh
                key={room.id}
                room={room}
                levelZ={storey.level_z ?? 0}
                elements={elements}
                assemblies={assemblies}
                materials={materials}
                heatmapOverlay={heatmapOverlay}
                wireframe={wireframe}
                selectedRoomId={selectedRoomId}
                transformMode={transformMode}
                gridSnap={gridSnap}
                snapStep={snapStep}
                magneticSnap={magneticSnap}
                snapDistance={magneticSnapDistance}
                preventCollision={preventCollision}
                rooms={rooms}
                storeys={storeys}
                onSelectRoom={(id) => {
                  setSelectedRoomId(selectedRoomId === id ? null : id);
                  setSelectedElementId(null);
                }}
                onSelectElement={(id) => setSelectedElementId(id)}
                onFaceClick={(rId, fIdx) => setSurfaceContextMenu({ roomId: rId, faceIndex: fIdx })}
                updateRoom={updateRoom}
              />
            ));
          })}
        </Canvas>

        {/* Surface Context Menu Popup */}
        {surfaceContextMenu && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900/95 border border-indigo-500 rounded-xl p-4 text-xs text-white shadow-2xl space-y-2 min-w-[220px] z-20 backdrop-blur-md">
            <div className="font-bold text-indigo-400 border-b border-slate-700 pb-1 flex justify-between items-center">
              <span>{t.viewer3d?.addWindowToSurface || 'Přidat otvory'}</span>
              <button
                onClick={() => setSurfaceContextMenu(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] text-slate-300">
              Vyberte typ otvoru pro umístění na označenou stěnu:
            </p>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => handleAddOpeningToSurface('window')}
                className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold text-center transition-colors"
              >
                🪟 {t.viewer3d?.addWindowToSurface || 'Přidat okno'}
              </button>
              <button
                onClick={() => handleAddOpeningToSurface('door')}
                className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 rounded font-semibold text-center transition-colors"
              >
                🚪 {t.viewer3d?.addDoorToSurface || 'Přidat dveře'}
              </button>
            </div>
          </div>
        )}

        {/* Direct Numeric Dimension Input Panel for Selected Room */}
        {selectedRoom && (
          <div className="absolute top-3 right-3 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl p-3 text-xs text-slate-200 shadow-2xl space-y-2 max-w-[260px] z-10">
            <div className="font-bold text-indigo-400 text-sm border-b border-slate-700 pb-1 flex justify-between items-center">
              <span className="flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5" />
                {t.viewer3d?.exactDimensions || 'Číselné rozměry'}
              </span>
              <button onClick={() => setSelectedRoomId(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            {/* Shape Selector */}
            <div>
              <label className="block text-[10px] text-slate-400 mb-0.5">{t.viewer3d?.shapeType || 'Tvar tělesa'}</label>
              <select
                value={selectedRoom.shape_type || 'box'}
                onChange={(e) => updateRoom(selectedRoom.id, { shape_type: e.target.value as any })}
                className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white"
              >
                <option value="box">📦 {t.viewer3d?.boxShape || 'Kvádr (Místnost)'}</option>
                <option value="triangular_prism">⛺ {t.viewer3d?.triangularPrism || 'Trojboký hranol (Střecha)'}</option>
              </select>
            </div>

            {/* W, L, H Inputs */}
            <div className="grid grid-cols-3 gap-1.5">
              <div>
                <label className="block text-[10px] text-slate-400">W (Šířka)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  value={selectedRoom.width || 4}
                  onChange={(e) => {
                    const w = parseFloat(e.target.value) || 1;
                    const l = selectedRoom.length || 4;
                    updateRoom(selectedRoom.id, { width: w, area: Math.round(w * l * 100) / 100 });
                  }}
                  className="w-full px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400">L (Délka)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  value={selectedRoom.length || 4}
                  onChange={(e) => {
                    const l = parseFloat(e.target.value) || 1;
                    const w = selectedRoom.width || 4;
                    updateRoom(selectedRoom.id, { length: l, area: Math.round(w * l * 100) / 100 });
                  }}
                  className="w-full px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400">H (Výška)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  value={selectedRoom.height || 2.7}
                  onChange={(e) => updateRoom(selectedRoom.id, { height: parseFloat(e.target.value) || 2.7 })}
                  className="w-full px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-white text-xs"
                />
              </div>
            </div>

            {/* X, Y Offsets */}
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="block text-[10px] text-slate-400">Posun X (m)</label>
                <input
                  type="number"
                  step="0.5"
                  value={selectedRoom.pos_x ?? 0}
                  onChange={(e) => updateRoom(selectedRoom.id, { pos_x: parseFloat(e.target.value) || 0 })}
                  className="w-full px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400">Posun Y (m)</label>
                <input
                  type="number"
                  step="0.5"
                  value={selectedRoom.pos_y ?? 0}
                  onChange={(e) => updateRoom(selectedRoom.id, { pos_y: parseFloat(e.target.value) || 0 })}
                  className="w-full px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-white text-xs"
                />
              </div>
            </div>

            {/* Place on Top Face Helper Button */}
            <button
              onClick={() => {
                const currentStorey = storeys.find((s) => s.id === selectedRoom.storey_id);
                const currentLevelZ = currentStorey?.level_z ?? 0;
                // Find target storey at highest level
                const highestLevelZ = Math.max(...rooms.map((r) => {
                  const s = storeys.find((st) => st.id === r.storey_id);
                  return (s?.level_z ?? 0) + (r.height || 2.7);
                }));

                const targetLevel = highestLevelZ > currentLevelZ ? highestLevelZ : currentLevelZ + (selectedRoom.height || 2.7);

                // Find or create upper storey
                let targetStorey = storeys.find((s) => Math.abs(s.level_z - targetLevel) < 0.05);
                if (!targetStorey) {
                  const newStoreyId = generateUUID();
                  targetStorey = {
                    id: newStoreyId,
                    name: `Storey (${targetLevel.toFixed(1)}m)`,
                    level_z: targetLevel
                  };
                  addStorey(targetStorey);
                }

                updateRoom(selectedRoom.id, { storey_id: targetStorey.id });
              }}
              className="w-full py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold text-[11px] text-center transition-colors shadow-sm flex items-center justify-center gap-1 mt-1"
            >
              <span>⬆️ {t.viewer3d?.placeOnTop || 'Položit na horní plochu'}</span>
            </button>
          </div>
        )}

        {/* Editable Opening Dimensions Panel for Selected Opening */}
        {selectedElement && (
          <div className="absolute bottom-3 right-3 bg-slate-900/95 backdrop-blur-md border border-indigo-500 rounded-xl p-3 text-xs text-slate-200 shadow-2xl space-y-2 max-w-[260px] z-10">
            <div className="font-bold text-indigo-400 text-sm border-b border-slate-700 pb-1 flex justify-between items-center">
              <span>{selectedElement.name}</span>
              <button onClick={() => setSelectedElementId(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="block text-[10px] text-slate-400">{t.viewer3d?.openingWidth || 'Šířka (m)'}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.2"
                  value={selectedElement.opening_width || 1.2}
                  onChange={(e) => updateElement(selectedElement.id, { opening_width: parseFloat(e.target.value) || 1.2 })}
                  className="w-full px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400">{t.viewer3d?.openingHeight || 'Výška (m)'}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.2"
                  value={selectedElement.opening_height || 1.2}
                  onChange={(e) => updateElement(selectedElement.id, { opening_height: parseFloat(e.target.value) || 1.2 })}
                  className="w-full px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-white text-xs"
                />
              </div>
            </div>
            <div>
              <span className="text-slate-400">Plocha otvoru (A):</span> {(selectedElement.area).toFixed(2)} m²
            </div>
          </div>
        )}

        {/* Compass Orient Helper Badge */}
        <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm border border-slate-700 rounded-md px-2.5 py-1 text-[11px] font-mono text-slate-300 flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-red-400" />
          <span>Severka: {settings.building_orientation ?? 0}°</span>
        </div>
      </div>
    </div>
  );
};
