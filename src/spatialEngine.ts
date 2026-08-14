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

      // 1. Check Vertical Wall Contact along X-axis (Right face of b1 touching Left face of b2 or vice-versa)
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

      // 2. Check Vertical Wall Contact along Z-axis (Front face of b1 touching Back face of b2 or vice-versa)
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

      // 3. Check Horizontal Floor/Ceiling Contact along Y-axis (Top of b1 touching Bottom of b2 or vice-versa)
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
 * Detects overhanging cantilever floor area for upper storey rooms.
 * If a room is elevated (Y_min > 0) and has no rooms below, the uncontacted floor area
 * is flagged as an overhanging floor exposed to exterior (b = 1.0).
 */
export function getCantileverFloorArea(
  room: Room,
  rooms: Room[],
  storeys: Storey[] = []
): { totalFloorArea: number; contactBelowArea: number; overhangArea: number } {
  const aabb = calculateRoomAABB(room, storeys);
  const totalFloorArea = aabb.width * aabb.length;

  if (aabb.minY <= EPSILON) {
    // Ground floor room
    return { totalFloorArea, contactBelowArea: totalFloorArea, overhangArea: 0 };
  }

  const contacts = detectRoomAdjacencies(rooms, storeys);
  let contactBelowArea = 0;

  contacts.forEach((c) => {
    if (c.contactType === 'floor_ceiling') {
      if (c.room2Id === room.id || c.room1Id === room.id) {
        contactBelowArea += c.contactArea;
      }
    }
  });

  const overhangArea = Math.max(0, totalFloorArea - contactBelowArea);
  return { totalFloorArea, contactBelowArea, overhangArea };
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
  // Child openings area
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
