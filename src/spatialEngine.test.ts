import { detectRoomAdjacencies, calculateAdjustedNetArea } from './spatialEngine';
import { calculateTotalBuildingTransmissionLoss } from './mathEngine';
import type { Room, Storey, EnvelopeElement, Assembly, Material, EnvironmentalSettings } from './types';

// Helper assertion function
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function runSpatialEngineTests() {
  console.log('--- Running 3D Spatial Engine Tests ---');

  const storeys: Storey[] = [{ id: 's1', name: '1.NP', level_z: 0 }];

  const room1: Room = {
    id: 'r1',
    name: 'Room 1',
    storey_id: 's1',
    width: 5,
    length: 5,
    height: 2.7,
    area: 25,
    t_int: 20,
    air_exchange_rate: 0.5,
    pos_x: 0,
    pos_y: 0
  };

  const room2Separated: Room = {
    id: 'r2',
    name: 'Room 2 (Separated)',
    storey_id: 's1',
    width: 5,
    length: 5,
    height: 2.7,
    area: 25,
    t_int: 20,
    air_exchange_rate: 0.5,
    pos_x: 10, // Separated by 5 meters
    pos_y: 0
  };

  const room2Adjacent: Room = {
    id: 'r2',
    name: 'Room 2 (Adjacent)',
    storey_id: 's1',
    width: 5,
    length: 5,
    height: 2.7,
    area: 25,
    t_int: 20,
    air_exchange_rate: 0.5,
    pos_x: 5, // Directly touching Room 1 right face
    pos_y: 0
  };

  // Test 1: Separated rooms should have 0 contacts
  const separatedContacts = detectRoomAdjacencies([room1, room2Separated], storeys);
  assert(separatedContacts.length === 0, 'Separated rooms should have zero contacts');
  console.log('✓ Test 1 Passed: Separated rooms detected 0 contacts.');

  // Test 2: Adjacent rooms touching right wall
  const adjacentContacts = detectRoomAdjacencies([room1, room2Adjacent], storeys);
  assert(adjacentContacts.length === 1, 'Adjacent rooms should have 1 contact');
  const expectedContactArea = 5 * 2.7; // 13.5 m²
  assert(Math.abs(adjacentContacts[0].contactArea - expectedContactArea) < 0.01, `Contact area should be ${expectedContactArea}`);
  console.log(`✓ Test 2 Passed: Adjacent rooms detected contact area ${adjacentContacts[0].contactArea} m².`);

  // Test 3: Envelope net area reduction
  const rightWallElement: EnvelopeElement = {
    id: 'el1',
    name: 'Room 1 Right Wall',
    area: 13.5,
    assembly_id: 'asm1',
    adjacent_space_type: 'exterior',
    b_factor: 1.0,
    delta_u_tb: 0.0,
    room_id: 'r1',
    relative_angle: 90,
    tilt: 90
  };

  const netAreaSeparated = calculateAdjustedNetArea(rightWallElement, [rightWallElement], [room1, room2Separated], storeys);
  const netAreaAdjacent = calculateAdjustedNetArea(rightWallElement, [rightWallElement], [room1, room2Adjacent], storeys);

  assert(netAreaSeparated === 13.5, 'Separated net area should be full 13.5 m²');
  assert(netAreaAdjacent === 0, 'Adjacent net area should be reduced to 0 m² due to internal contact');
  console.log(`✓ Test 3 Passed: Net external area reduced from ${netAreaSeparated} m² to ${netAreaAdjacent} m².`);

  // Test 4: Transmission heat loss reduction
  const assemblies: Assembly[] = [
    { id: 'asm1', name: 'Wall', type: 'wall', rsi: 0.13, rse: 0.04, layers: [], direct_u_value: 0.25 }
  ];
  const materials: Material[] = [];
  const settings: EnvironmentalSettings = { t_int: 20, t_e: -15, room_volume: 100, air_exchange_rate: 0.5, building_orientation: 0 };

  const lossSeparated = calculateTotalBuildingTransmissionLoss([rightWallElement], assemblies, materials, settings, [room1, room2Separated], storeys);
  const lossAdjacent = calculateTotalBuildingTransmissionLoss([rightWallElement], assemblies, materials, settings, [room1, room2Adjacent], storeys);

  assert(lossSeparated > 0, 'Separated heat loss should be greater than 0');
  assert(lossAdjacent === 0, 'Adjacent heat loss should drop to 0 for internal contact face');
  console.log(`✓ Test 4 Passed: Building transmission loss reduced from ${lossSeparated.toFixed(1)} W to ${lossAdjacent.toFixed(1)} W.`);

  console.log('--- ALL SPATIAL ENGINE TESTS PASSED SUCCESSFULLY ---');
}

// Always run tests when imported or executed
runSpatialEngineTests();
