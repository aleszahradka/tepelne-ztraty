import type { Room, Storey, EnvelopeElement } from './types';

export interface RoomAABB {
  roomId: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  width: number;
  height: number;
  length: number;
}

export interface RoomContact {
  room1Id: string;
  room2Id: string;
  contactArea: number; // m²
  contactType: 'wall_x' | 'wall_z' | 'floor_ceiling';
  room1RelativeAngle?: number; // 0, 90, 180, 270
  room1Tilt?: number; // 90 for wall, 0 for roof/floor
  deltaT: number; // t_int,1 - t_int,2
  isEqualTemp: boolean;
  // Overlap bounding box center for 3D visualization
  centerX: number;
  centerY: number;
  centerZ: number;
  overlapWidth: number;
  overlapHeight: number;
  overlapLength: number;
}

const EPSILON = 0.08; // Tolerance threshold in meters for 3D surface contact

/**
 * Computes 3D Axis-Aligned Bounding Box (AABB) for a room.
 */
export function calculateRoomAABB(room: Room, storeys: Storey[] = []): RoomAABB {
  const storey = storeys.find((s) => s.id === room.storey_id);
  const levelZ = storey?.level_z ?? 0;

  const width = room.width || (room.area ? Math.sqrt(room.area) : 4);
  const length = room.length || (room.area ? Math.sqrt(room.area) : 4);
  const height = room.height || 2.7;

  const minX = room.pos_x ?? 0;
  const maxX = minX + width;

  const minY = levelZ;
  const maxY = minY + height;

  const minZ = room.pos_y ?? 0;
  const maxZ = minZ + length;

  return {
    roomId: room.id,
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
    width,
    height,
    length
  };
}

/**
 * Magnetic Face Snapping Logic:
 * Checks if active candidate position is within snapThreshold (< 0.2m) of an adjacent room's face,
 * and snaps candidate position flush to the target face along X, Y, or Z axes.
 */
export function applyMagneticFaceSnapping(
  activeRoom: Room,
  candidateX: number,
  candidateY: number,
  rooms: Room[],
  storeys: Storey[] = [],
  snapThreshold: number = 0.2,
  candidateLevelZ?: number
): {
  snappedX: number;
  snappedY: number;
  snappedLevelZ?: number;
  isSnappedX: boolean;
  isSnappedY: boolean;
  isSnappedLevelZ?: boolean;
} {
  const width = activeRoom.width || (activeRoom.area ? Math.sqrt(activeRoom.area) : 4);
  const length = activeRoom.length || (activeRoom.area ? Math.sqrt(activeRoom.area) : 4);
  const height = activeRoom.height || 2.7;

  let snappedX = candidateX;
  let snappedY = candidateY;
  let snappedLevelZ = candidateLevelZ;

  let isSnappedX = false;
  let isSnappedY = false;
  let isSnappedLevelZ = false;

  const candidateMinX = candidateX;
  const candidateMaxX = candidateX + width;
  const candidateMinZ = candidateY;
  const candidateMaxZ = candidateY + length;

  rooms.forEach((r) => {
    if (r.id === activeRoom.id) return;
    const targetAABB = calculateRoomAABB(r, storeys);

    // X-axis alignment snapping
    // 1. Candidate Left face (minX) near Target Right face (maxX)
    if (Math.abs(candidateMinX - targetAABB.maxX) < snapThreshold) {
      snappedX = targetAABB.maxX;
      isSnappedX = true;
    }
    // 2. Candidate Right face (maxX) near Target Left face (minX)
    else if (Math.abs(candidateMaxX - targetAABB.minX) < snapThreshold) {
      snappedX = targetAABB.minX - width;
      isSnappedX = true;
    }
    // 3. Candidate Left face near Target Left face (Flush left)
    else if (Math.abs(candidateMinX - targetAABB.minX) < snapThreshold) {
      snappedX = targetAABB.minX;
      isSnappedX = true;
    }

    // Z-axis (Y offset in 2D plane) alignment snapping
    // 1. Candidate Front face (minZ) near Target Back face (maxZ)
    if (Math.abs(candidateMinZ - targetAABB.maxZ) < snapThreshold) {
      snappedY = targetAABB.maxZ;
      isSnappedY = true;
    }
    // 2. Candidate Back face (maxZ) near Target Front face (minZ)
    else if (Math.abs(candidateMaxZ - targetAABB.minZ) < snapThreshold) {
      snappedY = targetAABB.minZ - length;
      isSnappedY = true;
    }
    // 3. Candidate Front face near Target Front face (Flush front)
    else if (Math.abs(candidateMinZ - targetAABB.minZ) < snapThreshold) {
      snappedY = targetAABB.minZ;
      isSnappedY = true;
    }

    // Y-axis (Elevation Level Z) alignment snapping:
    // Support snapping candidate bottom face directly onto target top face even if candidateLevelZ is inferred
    const effectiveCandidateLevelZ = candidateLevelZ ?? calculateRoomAABB(activeRoom, storeys).minY;
    const candidateMinY = effectiveCandidateLevelZ;
    const candidateMaxY = effectiveCandidateLevelZ + height;

    // Bottom face near target top face (Stack on top face)
    if (Math.abs(candidateMinY - targetAABB.maxY) < snapThreshold) {
      snappedLevelZ = targetAABB.maxY;
      isSnappedLevelZ = true;

      // Align footprint X and Z boundaries flush with target footprint if within snap threshold
      if (Math.abs(candidateMinX - targetAABB.minX) < snapThreshold * 1.5) {
        snappedX = targetAABB.minX;
        isSnappedX = true;
      }
      if (Math.abs(candidateMinZ - targetAABB.minZ) < snapThreshold * 1.5) {
        snappedY = targetAABB.minZ;
        isSnappedY = true;
      }
    }
    // Top face near target bottom face
    else if (Math.abs(candidateMaxY - targetAABB.minY) < snapThreshold) {
      snappedLevelZ = targetAABB.minY - height;
      isSnappedLevelZ = true;
    }
    // Bottom face near target bottom face (Flush level)
    else if (Math.abs(candidateMinY - targetAABB.minY) < snapThreshold) {
      snappedLevelZ = targetAABB.minY;
      isSnappedLevelZ = true;
    }
  });

  return {
    snappedX: Math.round(snappedX * 100) / 100,
    snappedY: Math.round(snappedY * 100) / 100,
    snappedLevelZ: snappedLevelZ !== undefined ? Math.round(snappedLevelZ * 100) / 100 : undefined,
    isSnappedX,
    isSnappedY,
    isSnappedLevelZ
  };
}

/**
 * Checks if a candidate room AABB interpenetrates or collides with any other room volume.
 * Supports flush stacking tolerance along Y-axis for roof prisms and upper storey rooms.
 */
export function checkRoomAABBCollision(
  activeRoomId: string,
  candidateAABB: RoomAABB,
  rooms: Room[],
  storeys: Storey[] = []
): boolean {
  for (const r of rooms) {
    if (r.id === activeRoomId) continue;
    const b = calculateRoomAABB(r, storeys);

    // Compute 3D bounding box overlaps
    const overlapX = Math.max(0, Math.min(candidateAABB.maxX, b.maxX) - Math.max(candidateAABB.minX, b.minX));
    const overlapY = Math.max(0, Math.min(candidateAABB.maxY, b.maxY) - Math.max(candidateAABB.minY, b.minY));
    const overlapZ = Math.max(0, Math.min(candidateAABB.maxZ, b.maxZ) - Math.max(candidateAABB.minZ, b.minZ));

    // Flush surface stacking check:
    // If candidate's bottom face touches or is flush with target top face (or vice versa),
    // it represents surface contact rather than interpenetration.
    const isFlushOnTop = Math.abs(candidateAABB.minY - b.maxY) < 0.05;
    const isFlushUnder = Math.abs(candidateAABB.maxY - b.minY) < 0.05;

    if (isFlushOnTop || isFlushUnder) {
      continue; // Surface contact, not internal volume collision
    }

    // Internal volume overlap > 0.05m along all 3 axes constitutes collision
    if (overlapX > 0.05 && overlapY > 0.05 && overlapZ > 0.05) {
      return true;
    }
  }
  return false;
}

/**
 * Detects 3D spatial intersections and surface contacts between all rooms in the building.
 */
export function detectRoomAdjacencies(rooms: Room[], storeys: Storey[] = []): RoomContact[] {
  const contacts: RoomContact[] = [];
  const aabbs = rooms.map((r) => ({ room: r, aabb: calculateRoomAABB(r, storeys) }));

  for (let i = 0; i < aabbs.length; i++) {
    for (let j = i + 1; j < aabbs.length; j++) {
      const { room: r1, aabb: b1 } = aabbs[i];
      const { room: r2, aabb: b2 } = aabbs[j];

      const deltaT = r1.t_int - r2.t_int;
      const isEqualTemp = Math.abs(deltaT) < 0.01;

      // 1. Check Vertical Wall Contact along X-axis
      const b1RightTouchesB2Left = Math.abs(b1.maxX - b2.minX) < EPSILON;
      const b1LeftTouchesB2Right = Math.abs(b1.minX - b2.maxX) < EPSILON;

      if (b1RightTouchesB2Left || b1LeftTouchesB2Right) {
        const overlapY = Math.max(0, Math.min(b1.maxY, b2.maxY) - Math.max(b1.minY, b2.minY));
        const overlapZ = Math.max(0, Math.min(b1.maxZ, b2.maxZ) - Math.max(b1.minZ, b2.minZ));

        if (overlapY > 0.01 && overlapZ > 0.01) {
          const contactArea = overlapY * overlapZ;
          const contactX = b1RightTouchesB2Left ? b1.maxX : b1.minX;
          const centerY = (Math.max(b1.minY, b2.minY) + Math.min(b1.maxY, b2.maxY)) / 2;
          const centerZ = (Math.max(b1.minZ, b2.minZ) + Math.min(b1.maxZ, b2.maxZ)) / 2;

          contacts.push({
            room1Id: r1.id,
            room2Id: r2.id,
            contactArea,
            contactType: 'wall_x',
            room1RelativeAngle: b1RightTouchesB2Left ? 90 : 270,
            room1Tilt: 90,
            deltaT,
            isEqualTemp,
            centerX: contactX,
            centerY,
            centerZ,
            overlapWidth: 0.05,
            overlapHeight: overlapY,
            overlapLength: overlapZ
          });
        }
      }

      // 2. Check Vertical Wall Contact along Z-axis
      const b1FrontTouchesB2Back = Math.abs(b1.maxZ - b2.minZ) < EPSILON;
      const b1BackTouchesB2Front = Math.abs(b1.minZ - b2.maxZ) < EPSILON;

      if (b1FrontTouchesB2Back || b1BackTouchesB2Front) {
        const overlapX = Math.max(0, Math.min(b1.maxX, b2.maxX) - Math.max(b1.minX, b2.minX));
        const overlapY = Math.max(0, Math.min(b1.maxY, b2.maxY) - Math.max(b1.minY, b2.minY));

        if (overlapX > 0.01 && overlapY > 0.01) {
          const contactArea = overlapX * overlapY;
          const contactZ = b1FrontTouchesB2Back ? b1.maxZ : b1.minZ;
          const centerX = (Math.max(b1.minX, b2.minX) + Math.min(b1.maxX, b2.maxX)) / 2;
          const centerY = (Math.max(b1.minY, b2.minY) + Math.min(b1.maxY, b2.maxY)) / 2;

          contacts.push({
            room1Id: r1.id,
            room2Id: r2.id,
            contactArea,
            contactType: 'wall_z',
            room1RelativeAngle: b1FrontTouchesB2Back ? 0 : 180,
            room1Tilt: 90,
            deltaT,
            isEqualTemp,
            centerX,
            centerY,
            centerZ: contactZ,
            overlapWidth: overlapX,
            overlapHeight: overlapY,
            overlapLength: 0.05
          });
        }
      }

      // 3. Check Horizontal Floor/Ceiling Contact along Y-axis
      const b1TopTouchesB2Bottom = Math.abs(b1.maxY - b2.minY) < EPSILON;
      const b1BottomTouchesB2Top = Math.abs(b1.minY - b2.maxY) < EPSILON;

      if (b1TopTouchesB2Bottom || b1BottomTouchesB2Top) {
        const overlapX = Math.max(0, Math.min(b1.maxX, b2.maxX) - Math.max(b1.minX, b2.minX));
        const overlapZ = Math.max(0, Math.min(b1.maxZ, b2.maxZ) - Math.max(b1.minZ, b2.minZ));

        if (overlapX > 0.01 && overlapZ > 0.01) {
          const contactArea = overlapX * overlapZ;
          const contactY = b1TopTouchesB2Bottom ? b1.maxY : b1.minY;
          const centerX = (Math.max(b1.minX, b2.minX) + Math.min(b1.maxX, b2.maxX)) / 2;
          const centerZ = (Math.max(b1.minZ, b2.minZ) + Math.min(b1.maxZ, b2.maxZ)) / 2;

          contacts.push({
            room1Id: r1.id,
            room2Id: r2.id,
            contactArea,
            contactType: 'floor_ceiling',
            room1Tilt: 0,
            deltaT,
            isEqualTemp,
            centerX,
            centerY: contactY,
            centerZ,
            overlapWidth: overlapX,
            overlapHeight: 0.05,
            overlapLength: overlapZ
          });
        }
      }
    }
  }

  return contacts;
}

/**
 * Calculates total overlapping contact area on a specific face of a room.
 */
export function getRoomFaceContactArea(
  roomId: string,
  relativeAngle: number,
  tilt: number,
  rooms: Room[],
  storeys: Storey[] = []
): number {
  const contacts = detectRoomAdjacencies(rooms, storeys);
  let totalContact = 0;

  contacts.forEach((c) => {
    if (c.room1Id === roomId) {
      if (tilt === 0 && c.contactType === 'floor_ceiling') {
        totalContact += c.contactArea;
      } else if (tilt === 90 && c.room1RelativeAngle !== undefined) {
        const diff = Math.abs(((c.room1RelativeAngle - relativeAngle) % 360 + 360) % 360);
        if (diff < 45 || diff > 315) {
          totalContact += c.contactArea;
        }
      }
    } else if (c.room2Id === roomId) {
      if (tilt === 0 && c.contactType === 'floor_ceiling') {
        totalContact += c.contactArea;
      } else if (tilt === 90 && c.room1RelativeAngle !== undefined) {
        const oppositeAngle = (c.room1RelativeAngle + 180) % 360;
        const diff = Math.abs(((oppositeAngle - relativeAngle) % 360 + 360) % 360);
        if (diff < 45 || diff > 315) {
          totalContact += c.contactArea;
        }
      }
    }
  });

  return totalContact;
}

/**
 * Calculates net area adjusted for child openings AND 3D room contact face overlaps.
 */
export function calculateAdjustedNetArea(
  element: EnvelopeElement,
  allElements: EnvelopeElement[],
  rooms: Room[],
  storeys: Storey[] = []
): number {
  const childArea = allElements
    .filter((e) => e.parent_element_id === element.id)
    .reduce((sum, child) => sum + child.area, 0);

  let contactArea = 0;

  if (element.room_id && rooms.length > 0) {
    contactArea = getRoomFaceContactArea(
      element.room_id,
      element.relative_angle,
      element.tilt,
      rooms,
      storeys
    );
  }

  const netArea = element.area - childArea - contactArea;
  return Math.max(0, netArea);
}

/**
 * Non-Box Roof Geometry Area Helper:
 * Calculates roof slope areas and pitch angles for triangular (gable) and trapezoidal (shed) roof prisms.
 */
export function calculateRoofPrismGeometry(
  width: number,
  length: number,
  height: number,
  shapeType: 'triangular_prism' | 'trapezoidal_prism' = 'triangular_prism',
  eaveHeight: number = 0.5
): { roofSlopeArea: number; pitchAngle: number; gableWallArea: number } {
  if (shapeType === 'triangular_prism') {
    // Gable Roof (Sedlová střecha): Gable base width W, ridge height H
    const halfW = width / 2;
    const slopeLength = Math.sqrt(halfW * halfW + height * height);
    const roofSlopeArea = 2 * slopeLength * length; // 2 pitched roof sides
    const pitchAngle = Math.round(Math.atan2(height, halfW) * (180 / Math.PI));
    const gableWallArea = width * height; // 2 triangular ends = 1 rectangle W * H

    return { roofSlopeArea, pitchAngle, gableWallArea };
  } else {
    // Shed / Mono-pitch Roof (Pultová střecha)
    const heightDiff = Math.max(0.1, height - eaveHeight);
    const slopeLength = Math.sqrt(width * width + heightDiff * heightDiff);
    const roofSlopeArea = slopeLength * length;
    const pitchAngle = Math.round(Math.atan2(heightDiff, width) * (180 / Math.PI));
    const gableWallArea = ((height + eaveHeight) / 2) * length * 2;

    return { roofSlopeArea, pitchAngle, gableWallArea };
  }
}
