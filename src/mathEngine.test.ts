import {
  calculateTransmissionLoss,
  calculateRoomTransmissionLoss,
  calculateRoomVentilationLoss
} from './mathEngine';
import type { Room, EnvelopeElement, Assembly, Material, EnvironmentalSettings, Storey } from './types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function runMathEngineTests() {
  console.log('--- Running Math Engine & Layout Verification Tests ---');

  const storeys: Storey[] = [
    { id: 's1', name: '1.NP', level_z: 0 }
  ];

  const room1: Room = {
    id: 'r1',
    name: 'Living Room',
    storey_id: 's1',
    area: 20,
    height: 2.7,
    t_int: 20,
    air_exchange_rate: 0.5
  };

  const room2: Room = {
    id: 'r2',
    name: 'Bedroom',
    storey_id: 's1',
    area: 15,
    height: 2.7,
    t_int: 20,
    air_exchange_rate: 0.5
  };

  const materials: Material[] = [
    {
      id: 'mat-brick',
      name: { cs: 'Cihla', en: 'Brick' },
      category: { cs: 'Zdivo', en: 'Masonry' },
      design_thermal_conductivity: 0.5,
      is_custom: false
    }
  ];

  const wallAssembly: Assembly = {
    id: 'asm-wall',
    name: 'External Wall',
    type: 'wall',
    rsi: 0.13,
    rse: 0.04,
    layers: [{ id: 'l1', material_id: 'mat-brick', thickness: 0.3 }],
    direct_u_value: 0.25
  };

  const floorAssembly: Assembly = {
    id: 'asm-floor',
    name: 'Floor on Ground',
    type: 'floor',
    rsi: 0.17,
    rse: 0.0,
    layers: [{ id: 'l2', material_id: 'mat-brick', thickness: 0.2 }],
    direct_u_value: 0.35,
    t_ground: 5
  };

  const assemblies: Assembly[] = [wallAssembly, floorAssembly];

  const settings: EnvironmentalSettings = {
    t_int: 20,
    t_e: -15,
    t_ground: 5,
    room_volume: 100,
    air_exchange_rate: 0.5,
    building_orientation: 0
  };

  // Test 1: Room-level heat loss breakdown sums all surface losses correctly per room_id
  const surface1Room1: EnvelopeElement = {
    id: 'surf1',
    name: 'Room 1 Wall North',
    area: 15,
    assembly_id: 'asm-wall',
    adjacent_space_type: 'exterior',
    b_factor: 1.0,
    delta_u_tb: 0,
    room_id: 'r1',
    relative_angle: 0,
    tilt: 90
  };

  const surface2Room1: EnvelopeElement = {
    id: 'surf2',
    name: 'Room 1 Wall East',
    area: 10,
    assembly_id: 'asm-wall',
    adjacent_space_type: 'exterior',
    b_factor: 1.0,
    delta_u_tb: 0,
    room_id: 'r1',
    relative_angle: 90,
    tilt: 90
  };

  const surfaceRoom2: EnvelopeElement = {
    id: 'surf3',
    name: 'Room 2 Wall South',
    area: 12,
    assembly_id: 'asm-wall',
    adjacent_space_type: 'exterior',
    b_factor: 1.0,
    delta_u_tb: 0,
    room_id: 'r2',
    relative_angle: 180,
    tilt: 90
  };

  const elements = [surface1Room1, surface2Room1, surfaceRoom2];

  const lossSurf1 = calculateTransmissionLoss(surface1Room1, assemblies, materials, settings, elements, [room1, room2], storeys);
  const lossSurf2 = calculateTransmissionLoss(surface2Room1, assemblies, materials, settings, elements, [room1, room2], storeys);
  const expectedRoom1Loss = lossSurf1 + lossSurf2;

  const actualRoom1Loss = calculateRoomTransmissionLoss('r1', elements, assemblies, materials, settings, [room1, room2], storeys);
  assert(Math.abs(actualRoom1Loss - expectedRoom1Loss) < 0.001, `Room 1 transmission loss should equal sum of its surfaces (${expectedRoom1Loss}W), got ${actualRoom1Loss}W`);
  console.log(`✓ Test 1 Passed: Room 1 transmission loss correctly aggregated as ${actualRoom1Loss.toFixed(1)} W.`);

  // Test 2: Changing ground temperature updates ground floor heat loss calculation immediately
  const groundFloorElement: EnvelopeElement = {
    id: 'floor1',
    name: 'Room 1 Ground Floor',
    area: 20,
    assembly_id: 'asm-floor',
    adjacent_space_type: 'ground',
    b_factor: 1.0,
    delta_u_tb: 0,
    room_id: 'r1',
    relative_angle: 0,
    tilt: 0
  };

  // With ground temp = 5 °C (ΔT = 20 - 5 = 15 K)
  const lossAt5C = calculateTransmissionLoss(groundFloorElement, assemblies, materials, settings, [groundFloorElement], [room1], storeys);
  const expected5C = 20 * (1 / (0.17 + 0.2/0.5)) * 15; // ~526.32 W
  assert(Math.abs(lossAt5C - expected5C) < 0.1, `Expected floor loss at 5°C ground temp to be ~${expected5C.toFixed(1)}W, got ${lossAt5C}`);

  // Change ground temperature to 10 °C (ΔT = 20 - 10 = 10 K)
  const updatedFloorAssembly: Assembly = { ...floorAssembly, t_ground: 10 };
  const updatedAssemblies = [wallAssembly, updatedFloorAssembly];

  const lossAt10C = calculateTransmissionLoss(groundFloorElement, updatedAssemblies, materials, settings, [groundFloorElement], [room1], storeys);
  const expected10C = 20 * (1 / (0.17 + 0.2/0.5)) * 10; // ~350.88 W
  assert(Math.abs(lossAt10C - expected10C) < 0.1, `Expected floor loss at 10°C ground temp to be ~${expected10C.toFixed(1)}W, got ${lossAt10C}`);
  assert(lossAt10C < lossAt5C, 'Increasing ground temperature must decrease ground floor heat loss');
  console.log(`✓ Test 2 Passed: Changing ground temperature from 5°C to 10°C immediately updated floor heat loss from ${lossAt5C.toFixed(1)}W to ${lossAt10C.toFixed(1)}W.`);

  // Test 3: Enabling HRV with eta = 0.80 reduces room ventilation loss by 80%
  const roomWithoutHRV: Room = {
    id: 'r_no_hrv',
    name: 'Room Standard',
    storey_id: 's1',
    area: 20,
    height: 2.7,
    t_int: 20,
    air_exchange_rate: 0.5,
    has_hrv: false
  };

  const roomWithHRV: Room = {
    ...roomWithoutHRV,
    id: 'r_hrv',
    has_hrv: true,
    hrv_efficiency: 0.80
  };

  const unmitigatedVentLoss = calculateRoomVentilationLoss(roomWithoutHRV, -15);
  const hrvVentLoss = calculateRoomVentilationLoss(roomWithHRV, -15);

  const expectedHrvLoss = unmitigatedVentLoss * 0.20; // 80% reduction = 20% remaining
  assert(Math.abs(hrvVentLoss - expectedHrvLoss) < 0.001, `HRV ventilation loss should equal 20% of unmitigated loss (${expectedHrvLoss.toFixed(1)}W), got ${hrvVentLoss.toFixed(1)}W`);
  console.log(`✓ Test 3 Passed: HRV with 80% efficiency reduced room ventilation loss from ${unmitigatedVentLoss.toFixed(1)}W to ${hrvVentLoss.toFixed(1)}W (80% reduction).`);

  console.log('--- ALL MATH ENGINE & LAYOUT TESTS PASSED ---');
}

runMathEngineTests();
