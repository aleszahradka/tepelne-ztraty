import React, { useState, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useHeatLossStore, generateUUID, DEFAULT_VIEWER_3D_THEME, type Viewer3DTheme } from '../store';
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
  Maximize2, MousePointer, ShieldAlert, Sliders, LayoutGrid, Palette, RotateCcw
} from 'lucide-react';

function getThermalColor(uValue: number, isOpening: boolean = false, theme: Viewer3DTheme = DEFAULT_VIEWER_3D_THEME): string {
  if (isOpening) return theme.heatmap_high;
  if (uValue <= 0) return '#94a3b8';
  if (uValue <= 0.18) return theme.heatmap_low;
  if (uValue <= 0.50) return theme.heatmap_mid;
  return theme.heatmap_high;
}

export function createTriangularPrismGeometry(width: number, height: number, length: number) {
  const geom = new THREE.BufferGeometry();
  const halfW = width / 2;
  const halfH = height / 2;
  const halfL = length / 2;

  const vertices = new Float32Array([
    -halfW, -halfH, halfL,
     halfW, -halfH, halfL,
     0,      halfH, halfL,

     halfW, -halfH, -halfL,
    -halfW, -halfH, -halfL,
     0,      halfH, -halfL,

    -halfW, -halfH, halfL,
     0,      halfH, halfL,
     0,      halfH, -halfL,
    -halfW, -halfH, -halfL,

     0,      halfH, halfL,
     halfW, -halfH, halfL,
     halfW, -halfH, -halfL,
     0,      halfH, -halfL,

    -halfW, -halfH, -halfL,
     halfW, -halfH, -halfL,
     halfW, -halfH, halfL,
    -halfW, -halfH, halfL
  ]);

  const indices = [
    0, 1, 2,
    3, 4, 5,
    6, 7, 8,  6, 8, 9,
    10, 11, 12, 10, 12, 13,
    14, 15, 16, 14, 16, 17
  ];

  geom.setIndex(indices);
  geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

interface StoreyPlaneProps {
  storey: Storey;
  theme: Viewer3DTheme;
  isSelected: boolean;
  onSelectStorey: (id: string) => void;
  updateStorey: (id: string, updated: Partial<Storey>) => void;
}

const StoreyLevelPlaneMesh: React.FC<StoreyPlaneProps> = ({ storey, theme, isSelected, onSelectStorey, updateStorey }) => {
  const groupRef = useRef<THREE.Group>(null!);

  const handlePlaneTransform = () => {
    if (!groupRef.current) return;
    const newZ = Math.round(groupRef.current.position.y * 10) / 10;
    updateStorey(storey.id, { level_z: newZ });
  };

  return (
    <>
      <group
        ref={groupRef}
        position={[0, storey.level_z ?? 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectStorey(storey.id);
        }}
      >
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[30, 30]} />
          <meshStandardMaterial
            color={isSelected ? '#f59e0b' : theme.storey_plane_color}
            transparent
            opacity={theme.storey_plane_opacity}
            side={THREE.DoubleSide}
          />
        </mesh>
        <lineSegments rotation={[-Math.PI / 2, 0, 0]}>
          <edgesGeometry args={[new THREE.PlaneGeometry(30, 30)]} />
          <lineBasicMaterial color={isSelected ? '#f59e0b' : theme.storey_plane_color} linewidth={2} />
        </lineSegments>

        <Text
          position={[-14, 0.2, -14]}
          fontSize={0.4}
          color="#ffffff"
          anchorX="left"
          anchorY="bottom"
        >
          {`${storey.name} (Z = ${storey.level_z ?? 0}m)`}
        </Text>
      </group>

      {isSelected && groupRef.current && (
        <TransformControls
          object={groupRef.current}
          mode="translate"
          showX={false}
          showZ={false}
          onChange={handlePlaneTransform}
          onMouseUp={handlePlaneTransform}
        />
      )}
    </>
  );
};

interface RoomMeshProps {
  room: Room;
  levelZ: number;
  storeyName: string;
  elements: EnvelopeElement[];
  assemblies: Assembly[];
  materials: Material[];
  heatmapOverlay: boolean;
  wireframe: boolean;
  selectedRoomId: string | null;
  selectedElementId: string | null;
  activeFaceIndex: number | null;
  transformMode: 'translate' | 'scale' | 'view';
  gridSnap: boolean;
  snapStep: number;
  magneticSnap: boolean;
  snapDistance: number;
  preventCollision: boolean;
  rooms: Room[];
  storeys: Storey[];
  theme: Viewer3DTheme;
  onSelectRoom: (id: string) => void;
  onSelectElement: (id: string) => void;
  onFaceClick?: (roomId: string, faceIndex: number, point: THREE.Vector3) => void;
  updateRoom: (id: string, updated: Partial<Room>) => void;
}

const RoomMesh: React.FC<RoomMeshProps> = ({
  room,
  levelZ,
  storeyName,
  elements,
  assemblies,
  materials,
  heatmapOverlay,
  wireframe,
  selectedRoomId,
  selectedElementId,
  activeFaceIndex,
  transformMode,
  gridSnap,
  snapStep,
  magneticSnap,
  snapDistance,
  preventCollision,
  rooms,
  storeys,
  theme,
  onSelectRoom,
  onSelectElement,
  onFaceClick,
  updateRoom
}) => {
  const groupRef = useRef<THREE.Group>(null!);
  const [hoveredFaceIndex, setHoveredFaceIndex] = useState<number | null>(null);

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

  const roomElements = useMemo(() => {
    return elements.filter((e) => e.room_id === room.id && !e.is_virtual && e.source !== 'manual');
  }, [elements, room.id]);

  const faceUValues = useMemo(() => {
    const uVals = [0, 0, 0, 0, 0, 0];
    roomElements.forEach((el) => {
      const effU = calculateEffectiveUValue(el, assemblies, materials);
      if (el.parent_face === 'right' || (el.tilt === 90 && el.relative_angle === 90)) uVals[0] = effU;
      else if (el.parent_face === 'left' || (el.tilt === 90 && el.relative_angle === 270)) uVals[1] = effU;
      else if (el.parent_face === 'top' || (el.tilt === 0 && el.name.toLowerCase().includes('strop') || el.name.toLowerCase().includes('střecha'))) uVals[2] = effU;
      else if (el.parent_face === 'bottom' || (el.tilt === 0 && el.name.toLowerCase().includes('podlaha'))) uVals[3] = effU;
      else if (el.parent_face === 'front' || (el.tilt === 90 && el.relative_angle === 0)) uVals[4] = effU;
      else if (el.parent_face === 'back' || (el.tilt === 90 && el.relative_angle === 180)) uVals[5] = effU;
    });
    return uVals;
  }, [roomElements, assemblies, materials]);

  const childOpenings = useMemo(() => {
    const openings: {
      id: string;
      name: string;
      area: number;
      count: number;
      faceIndex: number;
      uValue: number;
      element: EnvelopeElement;
    }[] = [];

    roomElements.forEach((parent) => {
      const children = elements.filter((child) => child.parent_element_id === parent.id);
      children.forEach((child) => {
        let faceIndex = 4;

        if (child.parent_face) {
          switch (child.parent_face) {
            case 'right': faceIndex = 0; break;
            case 'left': faceIndex = 1; break;
            case 'top': faceIndex = 2; break;
            case 'bottom': faceIndex = 3; break;
            case 'front': faceIndex = 4; break;
            case 'back': faceIndex = 5; break;
          }
        } else if (parent.parent_face) {
          switch (parent.parent_face) {
            case 'right': faceIndex = 0; break;
            case 'left': faceIndex = 1; break;
            case 'top': faceIndex = 2; break;
            case 'bottom': faceIndex = 3; break;
            case 'front': faceIndex = 4; break;
            case 'back': faceIndex = 5; break;
          }
        } else if (parent.tilt === 0) {
          if (parent.name.toLowerCase().includes('podlaha') || parent.id.includes('floor')) {
            faceIndex = 3;
          } else {
            faceIndex = 2;
          }
        } else {
          const normAngle = ((parent.relative_angle % 360) + 360) % 360;
          if (normAngle >= 315 || normAngle < 45) faceIndex = 4;
          else if (normAngle >= 45 && normAngle < 135) faceIndex = 0;
          else if (normAngle >= 135 && normAngle < 225) faceIndex = 5;
          else if (normAngle >= 225 && normAngle < 315) faceIndex = 1;
        }

        openings.push({
          id: child.id,
          name: child.name,
          area: child.area,
          count: Math.max(1, child.count || 1),
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
      const defaultColor = isSelected ? '#6366f1' : theme.room_color;
      return [
        { color: defaultColor, opacity: 0.65 },
        { color: defaultColor, opacity: 0.65 },
        { color: defaultColor, opacity: 0.65 },
        { color: defaultColor, opacity: 0.65 },
        { color: defaultColor, opacity: 0.7 },
        { color: defaultColor, opacity: 0.7 }
      ];
    }
    return [
      { color: getThermalColor(faceUValues[0], false, theme), opacity: 0.85 },
      { color: getThermalColor(faceUValues[1], false, theme), opacity: 0.85 },
      { color: getThermalColor(faceUValues[2], false, theme), opacity: 0.85 },
      { color: getThermalColor(faceUValues[3], false, theme), opacity: 0.85 },
      { color: getThermalColor(faceUValues[4], false, theme), opacity: 0.85 },
      { color: getThermalColor(faceUValues[5], false, theme), opacity: 0.85 }
    ];
  }, [heatmapOverlay, faceUValues, isSelected, theme]);

  const highlightFace = activeFaceIndex !== null ? activeFaceIndex : (isSelected ? hoveredFaceIndex : null);

  const getFaceOverlayProps = (fIdx: number): { pos: [number, number, number]; rot: [number, number, number]; size: [number, number] } => {
    switch (fIdx) {
      case 0: return { pos: [width / 2 + 0.02, 0, 0], rot: [0, Math.PI / 2, 0], size: [length, height] };
      case 1: return { pos: [-width / 2 - 0.02, 0, 0], rot: [0, -Math.PI / 2, 0], size: [length, height] };
      case 2: return { pos: [0, height / 2 + 0.02, 0], rot: [-Math.PI / 2, 0, 0], size: [width, length] };
      case 3: return { pos: [0, -height / 2 - 0.02, 0], rot: [Math.PI / 2, 0, 0], size: [width, length] };
      case 4: return { pos: [0, 0, length / 2 + 0.02], rot: [0, 0, 0], size: [width, height] };
      case 5: return { pos: [0, 0, -length / 2 - 0.02], rot: [0, Math.PI, 0], size: [width, height] };
      default: return { pos: [0, 0, 0], rot: [0, 0, 0], size: [1, 1] };
    }
  };

  const lastValidPosRef = useRef<{ x: number; z: number }>({ x: centerX, z: centerZ });

  React.useEffect(() => {
    lastValidPosRef.current = { x: centerX, z: centerZ };
  }, [centerX, centerZ]);

  const handleTransformChange = () => {
    if (!groupRef.current) return;
    const currentGroup = groupRef.current;

    if (transformMode === 'translate') {
      let candidateCenterX = currentGroup.position.x;
      let candidateCenterZ = currentGroup.position.z;

      let newPosX = candidateCenterX - width / 2;
      let newPosY = candidateCenterZ - length / 2;

      if (gridSnap && snapStep > 0) {
        newPosX = Math.round(newPosX / snapStep) * snapStep;
        newPosY = Math.round(newPosY / snapStep) * snapStep;
      }

      if (magneticSnap) {
        const snapRes = applyMagneticFaceSnapping(
          room,
          newPosX,
          newPosY,
          rooms,
          storeys,
          snapDistance,
          levelZ
        );
        newPosX = snapRes.snappedX;
        newPosY = snapRes.snappedY;
      }

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
        currentGroup.position.x = lastValidPosRef.current.x;
        currentGroup.position.z = lastValidPosRef.current.z;
        return;
      }

      lastValidPosRef.current = { x: newPosX + width / 2, z: newPosY + length / 2 };

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

  const prismGeometry = useMemo(() => {
    if (shapeType === 'triangular_prism') {
      return createTriangularPrismGeometry(width, height, length);
    }
    return null;
  }, [shapeType, width, height, length]);

  React.useEffect(() => {
    return () => {
      if (prismGeometry) {
        prismGeometry.dispose();
      }
    };
  }, [prismGeometry]);

  return (
    <>
      <group ref={groupRef} position={[centerX, centerY, centerZ]}>
        {shapeType === 'triangular_prism' && prismGeometry ? (
          <mesh
            key={`prism-${room.id}-${width}-${height}-${length}`}
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
            key={`box-${room.id}-${width}-${height}-${length}`}
            onPointerMove={(e) => {
              if (e.faceIndex != null) {
                const faceMaterialIndex = Math.floor(e.faceIndex / 2);
                setHoveredFaceIndex(faceMaterialIndex);
              }
            }}
            onPointerOut={() => setHoveredFaceIndex(null)}
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

        {highlightFace !== null && shapeType === 'box' && (
          <group position={getFaceOverlayProps(highlightFace).pos} rotation={getFaceOverlayProps(highlightFace).rot}>
            <mesh>
              <planeGeometry args={getFaceOverlayProps(highlightFace).size} />
              <meshStandardMaterial
                color="#00f0ff"
                transparent
                opacity={0.45}
                side={THREE.DoubleSide}
                roughness={0.1}
                emissive="#00f0ff"
                emissiveIntensity={0.6}
              />
            </mesh>
            <lineSegments>
              <edgesGeometry args={[new THREE.PlaneGeometry(...getFaceOverlayProps(highlightFace).size)]} />
              <lineBasicMaterial color="#00f0ff" linewidth={3} />
            </lineSegments>
          </group>
        )}

        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(width, height, length)]} />
          <lineBasicMaterial color={isSelected ? '#4f46e5' : theme.wireframe_color} linewidth={isSelected ? 2 : 1} />
        </lineSegments>

        <Text
          position={[0, height / 2 + 0.35, 0]}
          fontSize={0.38}
          color="#ffffff"
          outlineColor="#000000"
          outlineWidth={0.04}
          anchorX="center"
          anchorY="bottom"
        >
          {`${room.name} (${storeyName})`}
        </Text>

        {childOpenings.map((opening) => {
          const winW = opening.element.opening_width || Math.min(1.5, Math.sqrt(opening.area));
          const winH = opening.element.opening_height || (opening.area / winW);
          const count = opening.count;

          const offX = opening.element.offset_x || 0;
          const offY = opening.element.offset_y || 0;

          let basePos: [number, number, number] = [0, 0, 0];
          let baseRot: [number, number, number] = [0, 0, 0];
          let shiftAxis: 'x' | 'z' = 'x';

          switch (opening.faceIndex) {
            case 0:
              basePos = [width / 2 + 0.015, offY, offX];
              baseRot = [0, Math.PI / 2, 0];
              shiftAxis = 'z';
              break;
            case 1:
              basePos = [-width / 2 - 0.015, offY, offX];
              baseRot = [0, -Math.PI / 2, 0];
              shiftAxis = 'z';
              break;
            case 2:
              basePos = [offX, height / 2 + 0.015, offY];
              baseRot = [-Math.PI / 2, 0, 0];
              shiftAxis = 'x';
              break;
            case 3:
              basePos = [offX, -height / 2 - 0.015, offY];
              baseRot = [Math.PI / 2, 0, 0];
              shiftAxis = 'x';
              break;
            case 4:
              basePos = [offX, offY, length / 2 + 0.015];
              baseRot = [0, 0, 0];
              shiftAxis = 'x';
              break;
            case 5:
              basePos = [offX, offY, -length / 2 - 0.015];
              baseRot = [0, Math.PI, 0];
              shiftAxis = 'x';
              break;
          }

          const isOpeningSelected = selectedElementId === opening.id;
          const openingColor = isOpeningSelected
            ? '#f59e0b'
            : heatmapOverlay
            ? getThermalColor(opening.uValue, true, theme)
            : theme.opening_color;

          const spacing = winW + 0.15;
          const instances = Array.from({ length: count }, (_, i) => {
            const shiftOffset = (i - (count - 1) / 2) * spacing;
            const instPos: [number, number, number] = [
              basePos[0] + (shiftAxis === 'x' ? shiftOffset : 0),
              basePos[1],
              basePos[2] + (shiftAxis === 'z' ? shiftOffset : 0)
            ];
            return { id: `${opening.id}-inst-${i}`, pos: instPos };
          });

          return (
            <group key={opening.id}>
              {instances.map((inst) => (
                <group key={inst.id} position={inst.pos} rotation={baseRot}>
                  <mesh
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectElement(opening.id);
                    }}
                  >
                    <planeGeometry args={[winW, winH]} />
                    <meshStandardMaterial
                      color={openingColor}
                      emissive={isOpeningSelected ? '#fbbf24' : '#000000'}
                      emissiveIntensity={isOpeningSelected ? 0.6 : 0}
                      transparent
                      opacity={0.85}
                      roughness={0.1}
                      metalness={0.8}
                    />
                  </mesh>

                  {isOpeningSelected && (
                    <lineSegments>
                      <edgesGeometry args={[new THREE.PlaneGeometry(winW, winH)]} />
                      <lineBasicMaterial color="#f59e0b" linewidth={3} />
                    </lineSegments>
                  )}
                </group>
              ))}

              {count > 1 && (
                <group position={basePos} rotation={baseRot}>
                  <Text
                    position={[0, winH / 2 + 0.25, 0.02]}
                    fontSize={0.35}
                    color="#f59e0b"
                    anchorX="center"
                    anchorY="bottom"
                  >
                    {`${count}×`}
                  </Text>
                </group>
              )}
            </group>
          );
        })}
      </group>

      {isSelected && transformMode !== 'view' && groupRef.current && (
        <TransformControls
          object={groupRef.current}
          mode={transformMode}
          translationSnap={gridSnap ? snapStep : undefined}
          scaleSnap={gridSnap ? snapStep : undefined}
          onChange={handleTransformChange}
          onMouseUp={handleTransformChange}
        />
      )}
    </>
  );
};

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
  const theme = useHeatLossStore((state) => state.viewer_3d_theme);
  const updateViewer3DTheme = useHeatLossStore((state) => state.updateViewer3DTheme);
  const resetViewer3DTheme = useHeatLossStore((state) => state.resetViewer3DTheme);

  const addRoom = useHeatLossStore((state) => state.addRoom);
  const updateRoom = useHeatLossStore((state) => state.updateRoom);
  const deleteRoom = useHeatLossStore((state) => state.deleteRoom);
  const addElement = useHeatLossStore((state) => state.addElement);
  const updateElement = useHeatLossStore((state) => state.updateElement);
  const addStorey = useHeatLossStore((state) => state.addStorey);
  const updateStorey = useHeatLossStore((state) => state.updateStorey);

  const [heatmapOverlay, setHeatmapOverlay] = useState<boolean>(true);
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedStoreyId, setSelectedStoreyId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [transformMode, setTransformMode] = useState<'translate' | 'scale' | 'view'>('translate');
  const [gridSnap, setGridSnap] = useState<boolean>(false); // Default OFF
  const [snapStep, setSnapStep] = useState<number>(0.5);
  const [magneticSnap, setMagneticSnap] = useState<boolean>(true);
  const [preventCollision, setPreventCollision] = useState<boolean>(true);
  const [showThemePanel, setShowThemePanel] = useState<boolean>(false);
  const orbitControlsRef = useRef<any>(null);

  const handleResetView = () => {
    if (orbitControlsRef.current) {
      orbitControlsRef.current.reset();
    }
  };

  const [surfaceContextMenu, setSurfaceContextMenu] = useState<{
    roomId: string;
    faceIndex: number;
  } | null>(null);
  const [showAddOpeningPanel, setShowAddOpeningPanel] = useState<boolean>(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

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
    setTimeout(() => nameInputRef.current?.focus(), 80);
  };

  const handleDeleteSelectedRoom = () => {
    if (!selectedRoomId) return;
    deleteRoom(selectedRoomId);
    setSelectedRoomId(null);
  };

  const deleteElement = useHeatLossStore((state) => state.deleteElement);

  const handleAddOpeningToSurface = (type: 'window' | 'door') => {
    if (!surfaceContextMenu) return;
    const { roomId, faceIndex } = surfaceContextMenu;

    const assembly = assemblies.find((a) => a.type === type) || assemblies[0];
    if (!assembly) return;

    let relativeAngle = 0;
    let tilt = 90;
    let targetParentFace: 'front' | 'right' | 'back' | 'left' | 'top' | 'bottom' = 'front';

    if (faceIndex === 0) { relativeAngle = 90; tilt = 90; targetParentFace = 'right'; }
    else if (faceIndex === 1) { relativeAngle = 270; tilt = 90; targetParentFace = 'left'; }
    else if (faceIndex === 2) { relativeAngle = 0; tilt = 0; targetParentFace = 'top'; }
    else if (faceIndex === 3) { relativeAngle = 0; tilt = 0; targetParentFace = 'bottom'; }
    else if (faceIndex === 4) { relativeAngle = 0; tilt = 90; targetParentFace = 'front'; }
    else if (faceIndex === 5) { relativeAngle = 180; tilt = 90; targetParentFace = 'back'; }

    const parentWall = elements.find((e) =>
      e.room_id === roomId && (
        (e.parent_face && e.parent_face === targetParentFace) ||
        (targetParentFace === 'top' && e.tilt === 0 && (e.id.includes('roof') || e.name.toLowerCase().includes('strop') || e.name.toLowerCase().includes('střecha'))) ||
        (targetParentFace === 'bottom' && e.tilt === 0 && (e.id.includes('floor') || e.name.toLowerCase().includes('podlaha'))) ||
        (e.relative_angle === relativeAngle && e.tilt === tilt)
      )
    );

    const winW = type === 'window' ? 1.5 : 0.9;
    const winH = type === 'window' ? 1.2 : 2.1;

    const newOpening: EnvelopeElement = {
      id: generateUUID(),
      name: type === 'window' ? 'Window / Okno' : 'Door / Dveře',
      area: Math.round(winW * winH * 100) / 100,
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
      offset_y: 0,
      count: 1,
      parent_face: targetParentFace
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
            onClick={() => setShowThemePanel(!showThemePanel)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              showThemePanel ? 'bg-indigo-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title="Prvky a barvy 3D / 3D Theme & Colors"
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Barvy 3D</span>
          </button>

          <button
            onClick={handleResetView}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
            title={t.viewer3d?.resetView || 'Obnovit pohled'}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating 3D Editor Toolbar */}
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

          {/* Magnetic Face Snap Toggle & Sensitivity Distance Slider (Up to 1.0m) */}
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
                  max="1.00"
                  value={magneticSnapDistance}
                  onChange={(e) => setMagneticSnapDistance(parseFloat(e.target.value) || 0.50)}
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
            onClick={() => setShowAddOpeningPanel(!showAddOpeningPanel)}
            className={`px-2.5 py-1.5 rounded-md font-semibold flex items-center gap-1 transition-colors ${
              showAddOpeningPanel
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
            title={t.viewer3d?.addOpeningToWall || 'Přidat otvor na stěnu'}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.viewer3d?.addOpeningToggle || 'Dodatečný otvor'}</span>
          </button>

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
      <div className="relative w-full h-[480px] rounded-xl overflow-hidden shadow-inner" style={{ backgroundColor: theme.bg_color }}>
        <Canvas
          camera={{ position: [14, 14, 18], fov: 45 }}
          shadows
          className="w-full h-full"
        >
          <ambientLight intensity={0.7} />
          <SunLight orientation={settings.building_orientation ?? 0} />

          <OrbitControls ref={orbitControlsRef} makeDefault enableDamping dampingFactor={0.05} />

          <gridHelper args={[40, 40, '#475569', '#334155']} position={[0, -0.01, 0]} />

          <Compass3D orientation={settings.building_orientation ?? 0} />

          {/* Render Interactive Storey Level Planes */}
          {storeys.map((storey) => (
            <StoreyLevelPlaneMesh
              key={storey.id}
              storey={storey}
              theme={theme}
              isSelected={selectedStoreyId === storey.id}
              onSelectStorey={(id) => {
                setSelectedStoreyId(selectedStoreyId === id ? null : id);
                setSelectedRoomId(null);
                setSelectedElementId(null);
              }}
              updateStorey={updateStorey}
            />
          ))}

          <ContactPartitionMeshes contacts={roomContacts} />

          {storeys.length > 0 && storeys.map((storey) => {
            const storeyRooms = rooms.filter((r) => r.storey_id === storey.id);
            return storeyRooms.map((room) => (
              <RoomMesh
                key={room.id}
                room={room}
                levelZ={storey.level_z ?? 0}
                storeyName={storey.name}
                elements={elements}
                assemblies={assemblies}
                materials={materials}
                heatmapOverlay={heatmapOverlay}
                wireframe={wireframe}
                selectedRoomId={selectedRoomId}
                selectedElementId={selectedElementId}
                activeFaceIndex={surfaceContextMenu?.roomId === room.id ? surfaceContextMenu.faceIndex : null}
                transformMode={transformMode}
                gridSnap={gridSnap}
                snapStep={snapStep}
                magneticSnap={magneticSnap}
                snapDistance={magneticSnapDistance}
                preventCollision={preventCollision}
                rooms={rooms}
                storeys={storeys}
                theme={theme}
                onSelectRoom={(id) => {
                  setSelectedRoomId(selectedRoomId === id ? null : id);
                  setSelectedStoreyId(null);
                  setSelectedElementId(null);
                  if (id) {
                    setTimeout(() => nameInputRef.current?.focus(), 50);
                  }
                }}
                onSelectElement={(id) => setSelectedElementId(id)}
                onFaceClick={(rId, fIdx) => {
                  setSurfaceContextMenu({ roomId: rId, faceIndex: fIdx });
                }}
                updateRoom={updateRoom}
              />
            ));
          })}

          {/* Unassigned rooms fallback */}
          {rooms.filter((r) => !r.storey_id || !storeys.some((s) => s.id === r.storey_id)).map((room) => (
            <RoomMesh
              key={room.id}
              room={room}
              levelZ={0}
              storeyName="Nazařazeno"
              elements={elements}
              assemblies={assemblies}
              materials={materials}
              heatmapOverlay={heatmapOverlay}
              wireframe={wireframe}
              selectedRoomId={selectedRoomId}
              selectedElementId={selectedElementId}
              activeFaceIndex={surfaceContextMenu?.roomId === room.id ? surfaceContextMenu.faceIndex : null}
              transformMode={transformMode}
              gridSnap={gridSnap}
              snapStep={snapStep}
              magneticSnap={magneticSnap}
              snapDistance={magneticSnapDistance}
              preventCollision={preventCollision}
              rooms={rooms}
              storeys={storeys}
              theme={theme}
              onSelectRoom={(id) => {
                setSelectedRoomId(selectedRoomId === id ? null : id);
                setSelectedStoreyId(null);
                setSelectedElementId(null);
                if (id) {
                  setTimeout(() => nameInputRef.current?.focus(), 50);
                }
              }}
              onSelectElement={(id) => setSelectedElementId(id)}
              onFaceClick={(rId, fIdx) => {
                setSurfaceContextMenu({ roomId: rId, faceIndex: fIdx });
              }}
              updateRoom={updateRoom}
            />
          ))}
        </Canvas>

        {/* Clean Slate Empty State Indicator */}
        {rooms.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-900/80 backdrop-blur-sm z-10 pointer-events-none">
            <div className="p-4 bg-slate-800/90 rounded-2xl border border-slate-700 shadow-2xl max-w-sm flex flex-col items-center space-y-2 pointer-events-auto">
              <Flame className="w-10 h-10 text-indigo-400 mb-1" />
              <h3 className="text-sm font-bold text-white">
                {(t.viewer3d as any)?.emptyProject || 'Bez objektů (Čistý projekt)'}
              </h3>
              <p className="text-xs text-slate-400">
                Začněte tlačítkem "+ Přidat místnost" pro vytvoření prvního 3D tělesa.
              </p>
              <button
                onClick={handleAddDefaultRoom}
                className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-md"
              >
                <Plus className="w-4 h-4" />
                {t.viewer3d?.addRoom || 'Přidat místnost'}
              </button>
            </div>
          </div>
        )}

        {/* Dodatečný otvor Panel: Strictly hidden when showAddOpeningPanel is false and no context menu */}
        {showAddOpeningPanel && (
          <div className="absolute bottom-3 left-3 bg-slate-900/95 border border-indigo-500 rounded-xl p-3 text-xs text-white shadow-2xl space-y-2 min-w-[220px] max-w-[250px] z-20 backdrop-blur-md">
            <div className="font-bold text-indigo-400 border-b border-slate-700 pb-1 flex justify-between items-center">
              <span>{t.viewer3d?.addOpeningToWall || 'Přidat otvor na stěnu'}</span>
              <button
                onClick={() => {
                  setShowAddOpeningPanel(false);
                  setSurfaceContextMenu(null);
                }}
                className="text-slate-400 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] text-slate-300">
              Vyberte typ otvoru k přidání na stěnu:
            </p>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => {
                  const targetRoomId = surfaceContextMenu?.roomId || selectedRoomId || rooms[0]?.id;
                  if (!targetRoomId) return;
                  const ctx = surfaceContextMenu || { roomId: targetRoomId, faceIndex: 0 };
                  setSurfaceContextMenu(ctx);
                  handleAddOpeningToSurface('window');
                  setShowAddOpeningPanel(false);
                }}
                className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold text-center transition-colors"
              >
                🪟 {t.viewer3d?.addWindowToSurface || 'Přidat okno'}
              </button>
              <button
                onClick={() => {
                  const targetRoomId = surfaceContextMenu?.roomId || selectedRoomId || rooms[0]?.id;
                  if (!targetRoomId) return;
                  const ctx = surfaceContextMenu || { roomId: targetRoomId, faceIndex: 0 };
                  setSurfaceContextMenu(ctx);
                  handleAddOpeningToSurface('door');
                  setShowAddOpeningPanel(false);
                }}
                className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 rounded font-semibold text-center transition-colors"
              >
                🚪 {t.viewer3d?.addDoorToSurface || 'Přidat dveře'}
              </button>
            </div>
          </div>
        )}

        {/* 3D Theme & Colors Customization Panel */}
        {showThemePanel && (
          <div className="absolute top-3 left-3 bg-slate-900/95 backdrop-blur-md border border-indigo-500 rounded-xl p-3 text-xs text-slate-200 shadow-2xl space-y-2 max-w-[280px] z-30">
            <div className="font-bold text-indigo-400 border-b border-slate-700 pb-1 flex justify-between items-center">
              <span className="flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-indigo-400" />
                <span>Prvky a barvy 3D</span>
              </span>
              <button onClick={() => setShowThemePanel(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-2 text-[11px]">
              <div className="flex items-center justify-between">
                <label>Pozadí 3D plátna</label>
                <input
                  type="color"
                  value={theme.bg_color}
                  onChange={(e) => updateViewer3DTheme({ bg_color: e.target.value })}
                  className="w-8 h-6 bg-transparent border-0 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <label>Výchozí barva místností</label>
                <input
                  type="color"
                  value={theme.room_color}
                  onChange={(e) => updateViewer3DTheme({ room_color: e.target.value })}
                  className="w-8 h-6 bg-transparent border-0 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <label>Barva hrán a drátů</label>
                <input
                  type="color"
                  value={theme.wireframe_color}
                  onChange={(e) => updateViewer3DTheme({ wireframe_color: e.target.value })}
                  className="w-8 h-6 bg-transparent border-0 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <label>Roviny podlaží</label>
                <input
                  type="color"
                  value={theme.storey_plane_color}
                  onChange={(e) => updateViewer3DTheme({ storey_plane_color: e.target.value })}
                  className="w-8 h-6 bg-transparent border-0 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <label>Barva výplní otvorů</label>
                <input
                  type="color"
                  value={theme.opening_color}
                  onChange={(e) => updateViewer3DTheme({ opening_color: e.target.value })}
                  className="w-8 h-6 bg-transparent border-0 cursor-pointer"
                />
              </div>

              <div className="pt-1 border-t border-slate-800">
                <label className="block text-[10px] text-slate-400 mb-1">Tepelná mapa (Nízká / Střední / Vysoká ztráta)</label>
                <div className="flex items-center justify-between gap-1">
                  <input
                    type="color"
                    value={theme.heatmap_low}
                    onChange={(e) => updateViewer3DTheme({ heatmap_low: e.target.value })}
                    className="w-7 h-5 bg-transparent border-0 cursor-pointer"
                    title="Nízká ztráta (Dobře izolováno)"
                  />
                  <input
                    type="color"
                    value={theme.heatmap_mid}
                    onChange={(e) => updateViewer3DTheme({ heatmap_mid: e.target.value })}
                    className="w-7 h-5 bg-transparent border-0 cursor-pointer"
                    title="Střední ztráta"
                  />
                  <input
                    type="color"
                    value={theme.heatmap_high}
                    onChange={(e) => updateViewer3DTheme({ heatmap_high: e.target.value })}
                    className="w-7 h-5 bg-transparent border-0 cursor-pointer"
                    title="Vysoká ztráta / Otvory"
                  />
                </div>
              </div>

              <button
                onClick={resetViewer3DTheme}
                className="w-full mt-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Obnovit výchozí barvy</span>
              </button>
            </div>
          </div>
        )}

        {/* Direct Numeric Dimension Input Panel for Selected Room */}
        {selectedRoom && (
          <div className="absolute top-3 right-3 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl p-3 text-xs text-slate-200 shadow-2xl space-y-2 max-w-[260px] z-10">
            <div className="font-bold text-indigo-400 text-sm border-b border-slate-700 pb-1.5 flex justify-between items-center">
              <span className="flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5" />
                {t.viewer3d?.exactDimensions || 'Číselné rozměry'}
              </span>
              <button onClick={() => setSelectedRoomId(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div>
              <label className="block text-[10px] text-indigo-300 font-semibold mb-0.5">
                {t.viewer3d?.roomName || 'Název místnosti'}
              </label>
              <input
                ref={nameInputRef}
                type="text"
                value={selectedRoom.name}
                onChange={(e) => updateRoom(selectedRoom.id, { name: e.target.value })}
                className="w-full px-2 py-1 bg-slate-800 border border-indigo-500/60 rounded text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>

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

            <button
              onClick={() => {
                const currentStorey = storeys.find((s) => s.id === selectedRoom.storey_id);
                const currentLevelZ = currentStorey?.level_z ?? 0;
                const highestLevelZ = Math.max(...rooms.map((r) => {
                  const s = storeys.find((st) => st.id === r.storey_id);
                  return (s?.level_z ?? 0) + (r.height || 2.7);
                }));

                const targetLevel = highestLevelZ > currentLevelZ ? highestLevelZ : currentLevelZ + (selectedRoom.height || 2.7);

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
              <label className="block text-[10px] text-slate-400">{(t.viewer3d as any)?.openingQuantity || 'Počet otvorů / Quantity'}</label>
              <input
                type="number"
                min="1"
                max="50"
                value={selectedElement.count || 1}
                onChange={(e) => updateElement(selectedElement.id, { count: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-full px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-white text-xs font-bold text-amber-400"
              />
            </div>
            <div className="text-[11px]">
              <span className="text-slate-400">Celková plocha (A_celk):</span> <span className="font-bold text-white font-mono">{((selectedElement.area) * (selectedElement.count || 1)).toFixed(2)} m²</span>
            </div>

            <button
              onClick={() => {
                deleteElement(selectedElement.id);
                setSelectedElementId(null);
              }}
              className="w-full py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm mt-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{(t.viewer3d as any)?.deleteOpening || 'Smazat otvor'}</span>
            </button>
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
