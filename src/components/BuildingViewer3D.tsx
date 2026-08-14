import React, { useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useHeatLossStore } from '../store';
import { calculateEffectiveUValue } from '../mathEngine';
import type { Room, EnvelopeElement, Assembly, Material } from '../types';
import { useTranslate } from '../hooks/useTranslate';
import { Flame, RefreshCw, Compass, Info, Layers } from 'lucide-react';

// Get heatmap color based on effective U-value
function getThermalColor(uValue: number, isOpening: boolean = false): string {
  if (isOpening) return '#ef4444'; // Red for windows/doors (high heat loss)
  if (uValue <= 0) return '#94a3b8'; // Neutral slate for unspecified face
  if (uValue <= 0.18) return '#22c55e'; // Green: Highly insulated (U <= 0.18)
  if (uValue <= 0.50) return '#f59e0b'; // Yellow/Orange: Standard insulation (0.18 < U <= 0.50)
  return '#ef4444'; // Red: Uninsulated / high loss (U > 0.50)
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
  onSelectRoom: (id: string) => void;
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
  onSelectRoom
}) => {
  const width = room.width || (room.area ? Math.sqrt(room.area) : 4);
  const length = room.length || (room.area ? Math.sqrt(room.area) : 4);
  const height = room.height || 2.7;
  const posX = room.pos_x ?? 0;
  const posY = room.pos_y ?? 0;

  // Scene center coordinates (Y is UP in Three.js)
  const centerX = posX + width / 2;
  const centerY = levelZ + height / 2;
  const centerZ = posY + length / 2;

  // Find envelope elements linked to this room
  const roomElements = useMemo(() => {
    return elements.filter((e) => e.room_id === room.id);
  }, [elements, room.id]);

  // Map room faces to effective U-values
  const faceUValues = useMemo(() => {
    // 0: Front (+Z / relative 0°), 1: Right (+X / relative 90°), 2: Back (-Z / relative 180°), 3: Left (-X / relative 270°), 4: Top (+Y / Roof), 5: Bottom (-Y / Floor)
    const uVals = [0, 0, 0, 0, 0, 0];

    roomElements.forEach((el) => {
      const effU = calculateEffectiveUValue(el, assemblies, materials);
      if (el.tilt === 0) {
        // Horizontal (Roof / Floor)
        uVals[4] = effU; // Top / Roof
      } else {
        // Vertical walls based on relative angle
        const normAngle = ((el.relative_angle % 360) + 360) % 360;
        if (normAngle >= 315 || normAngle < 45) uVals[0] = effU; // Front (+Z)
        else if (normAngle >= 45 && normAngle < 135) uVals[1] = effU; // Right (+X)
        else if (normAngle >= 135 && normAngle < 225) uVals[2] = effU; // Back (-Z)
        else if (normAngle >= 225 && normAngle < 315) uVals[3] = effU; // Left (-X)
      }
    });

    return uVals;
  }, [roomElements, assemblies, materials]);

  // Find child openings (windows/doors) linked to elements of this room
  const childOpenings = useMemo(() => {
    const openings: {
      id: string;
      name: string;
      area: number;
      faceIndex: number;
      parent: EnvelopeElement;
      uValue: number;
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
          parent,
          uValue: calculateEffectiveUValue(child, assemblies, materials)
        });
      });
    });

    return openings;
  }, [roomElements, elements, assemblies, materials]);

  const isSelected = selectedRoomId === room.id;

  // Standard room box colors when heatmap is OFF vs ON
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

    // Heatmap Mode
    return [
      { color: getThermalColor(faceUValues[1]), opacity: 0.85 }, // Right (+X)
      { color: getThermalColor(faceUValues[3]), opacity: 0.85 }, // Left (-X)
      { color: getThermalColor(faceUValues[4]), opacity: 0.85 }, // Top (+Y)
      { color: '#64748b', opacity: 0.5 },                        // Bottom (-Y)
      { color: getThermalColor(faceUValues[0]), opacity: 0.85 }, // Front (+Z)
      { color: getThermalColor(faceUValues[2]), opacity: 0.85 }  // Back (-Z)
    ];
  }, [heatmapOverlay, faceUValues, isSelected]);

  return (
    <group position={[centerX, centerY, centerZ]}>
      {/* Primary Room Box Geometry */}
      <mesh onClick={() => onSelectRoom(room.id)}>
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

      {/* Wireframe Outline */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(width, height, length)]} />
        <lineBasicMaterial color={isSelected ? '#4f46e5' : '#1e293b'} linewidth={isSelected ? 2 : 1} />
      </lineSegments>

      {/* Room Name & Info 3D Text Label */}
      <Text
        position={[0, height / 2 + 0.3, 0]}
        fontSize={0.35}
        color="#1e293b"
        anchorX="center"
        anchorY="bottom"
      >
        {room.name}
      </Text>
      <Text
        position={[0, height / 2 + 0.05, 0]}
        fontSize={0.25}
        color="#64748b"
        anchorX="center"
        anchorY="bottom"
      >
        {`${room.t_int}°C • ${room.area}m²`}
      </Text>

      {/* Child Openings Rendering (Windows/Doors) */}
      {childOpenings.map((opening) => {
        // Calculate aspect ratio / glass plane size based on opening area
        const openArea = Math.min(opening.area, width * height * 0.8);
        const winH = Math.min(1.5, Math.sqrt(openArea));
        const winW = openArea / winH;

        let openPos: [number, number, number] = [0, 0, 0];
        let openRot: [number, number, number] = [0, 0, 0];

        // Place opening on respective wall face
        if (opening.faceIndex === 0) {
          // Front (+Z)
          openPos = [0, 0, length / 2 + 0.02];
        } else if (opening.faceIndex === 1) {
          // Right (+X)
          openPos = [width / 2 + 0.02, 0, 0];
          openRot = [0, Math.PI / 2, 0];
        } else if (opening.faceIndex === 2) {
          // Back (-Z)
          openPos = [0, 0, -length / 2 - 0.02];
          openRot = [0, Math.PI, 0];
        } else if (opening.faceIndex === 3) {
          // Left (-X)
          openPos = [-width / 2 - 0.02, 0, 0];
          openRot = [0, -Math.PI / 2, 0];
        }

        const openingColor = heatmapOverlay ? getThermalColor(opening.uValue, true) : '#0284c7';

        return (
          <mesh key={opening.id} position={openPos} rotation={openRot}>
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
  );
};

// Sun light position based on building North Orientation (Severka)
function SunLight({ orientation }: { orientation: number }) {
  const rad = (orientation * Math.PI) / 180;
  // Position directional light according to orientation angle
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

// 3D North Compass Indicator Mesh
function Compass3D({ orientation }: { orientation: number }) {
  const rad = (-orientation * Math.PI) / 180;

  return (
    <group position={[-2, 0.1, -2]} rotation={[0, rad, 0]}>
      {/* Compass Dial */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1.0, 32]} />
        <meshBasicMaterial color="#64748b" side={THREE.DoubleSide} />
      </mesh>
      {/* North Arrow (Red) */}
      <mesh position={[0, 0, 0.8]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.2, 0.8, 4]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      {/* South Arrow (Slate) */}
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

export const BuildingViewer3D: React.FC = () => {
  const { t } = useTranslate();

  const storeys = useHeatLossStore((state) => state.storeys);
  const rooms = useHeatLossStore((state) => state.rooms);
  const elements = useHeatLossStore((state) => state.envelope_elements);
  const assemblies = useHeatLossStore((state) => state.assemblies);
  const materials = useHeatLossStore((state) => state.materials);
  const settings = useHeatLossStore((state) => state.environmental_settings);

  const [heatmapOverlay, setHeatmapOverlay] = useState<boolean>(true);
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState<number>(0);

  // Selected room details
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-slate-100 flex flex-col space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-800">{t.viewer3d?.title || '3D Pohled'}</h2>
          </div>
          <p className="text-xs text-slate-500">
            {t.viewer3d?.desc || 'Prostorová vizualizace budovy, místností a tepelného zatížení obálky.'}
          </p>
        </div>

        {/* View Controls Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Heatmap Toggle */}
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

          {/* Wireframe Toggle */}
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

          {/* Reset View */}
          <button
            onClick={() => setResetKey((k) => k + 1)}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
            title={t.viewer3d?.resetView || 'Obnovit pohled'}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3D WebGL Canvas Container */}
      <div className="relative w-full h-[450px] bg-slate-900 rounded-xl overflow-hidden shadow-inner">
        <Canvas
          key={resetKey}
          camera={{ position: [12, 12, 16], fov: 45 }}
          shadows
          className="w-full h-full"
        >
          {/* Lighting */}
          <ambientLight intensity={0.7} />
          <SunLight orientation={settings.building_orientation ?? 0} />

          {/* Orbit Controls */}
          <OrbitControls makeDefault enableDamping dampingFactor={0.05} />

          {/* Floor Ground Grid */}
          <gridHelper args={[40, 40, '#475569', '#334155']} position={[0, -0.01, 0]} />

          {/* 3D North Compass */}
          <Compass3D orientation={settings.building_orientation ?? 0} />

          {/* Render Rooms by Storey */}
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
                onSelectRoom={(id) => setSelectedRoomId(selectedRoomId === id ? null : id)}
              />
            ));
          })}
        </Canvas>

        {/* Heatmap Legend Overlay */}
        {heatmapOverlay && (
          <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-lg p-3 text-xs text-slate-200 space-y-1.5 shadow-lg max-w-xs">
            <div className="font-bold text-slate-100 text-[11px] uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-indigo-400" />
              {t.viewer3d?.legendTitle || 'Barevná mapa U-hodnot'}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
              <span>{t.viewer3d?.greenLabel || 'U ≤ 0,18 W/m²K (Vysoká izolace)'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
              <span>{t.viewer3d?.yellowLabel || '0,18 < U ≤ 0,50 W/m²K (Standard)'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
              <span>{t.viewer3d?.redLabel || 'U > 0,50 W/m²K / Okna (Vysoká ztráta)'}</span>
            </div>
          </div>
        )}

        {/* Selected Room Details Floating Panel */}
        {selectedRoom && (
          <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-lg p-3 text-xs text-slate-200 shadow-xl space-y-1 min-w-[200px]">
            <div className="font-bold text-indigo-400 text-sm border-b border-slate-700 pb-1 flex justify-between items-center">
              <span>{selectedRoom.name}</span>
              <button
                onClick={() => setSelectedRoomId(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div>
              <span className="text-slate-400">Plocha / Výška:</span> {selectedRoom.area} m² / {selectedRoom.height} m
            </div>
            <div>
              <span className="text-slate-400">Teplota (t_int):</span> {selectedRoom.t_int} °C
            </div>
            <div>
              <span className="text-slate-400">Pozice (X, Y):</span> {selectedRoom.pos_x ?? 0} m, {selectedRoom.pos_y ?? 0} m
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
