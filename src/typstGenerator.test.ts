import { generateTypstDocument } from './typstGenerator';
import type { ProjectState, Storey, Room, EnvelopeElement, Assembly, Material } from './types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function runTypstGeneratorTests() {
  console.log('--- Running Typst Generator Tests ---');

  const storeys: Storey[] = [
    { id: 's1', name: '1.NP', level_z: 0 },
    { id: 's2', name: '2.NP', level_z: 2.8 }
  ];

  const rooms: Room[] = [
    { id: 'r1', name: '1.01 Obývák', storey_id: 's1', area: 30, height: 2.7, t_int: 21, air_exchange_rate: 0.5 },
    { id: 'r2', name: '1.02 Chodba', storey_id: 's1', area: 10, height: 2.7, t_int: 18, air_exchange_rate: 0.5 },
    { id: 'r3', name: '2.01 Ložnice', storey_id: 's2', area: 25, height: 2.6, t_int: 20, air_exchange_rate: 0.5 }
  ];

  const materials: Material[] = [
    { id: 'm1', name: 'Brick', category: 'Masonry', design_thermal_conductivity: 0.5, is_custom: false }
  ];

  const assemblies: Assembly[] = [
    { id: 'a1', name: 'External Wall', type: 'wall', rsi: 0.13, rse: 0.04, layers: [{ id: 'l1', material_id: 'm1', thickness: 0.3 }] }
  ];

  const elements: EnvelopeElement[] = [
    { id: 'e1', name: 'Living Wall', area: 20, assembly_id: 'a1', adjacent_space_type: 'exterior', b_factor: 1, delta_u_tb: 0.05, room_id: 'r1', relative_angle: 0, tilt: 90 },
    { id: 'e2', name: 'Hall Wall', area: 10, assembly_id: 'a1', adjacent_space_type: 'exterior', b_factor: 1, delta_u_tb: 0.05, room_id: 'r2', relative_angle: 90, tilt: 90 },
    { id: 'e3', name: 'Bedroom Wall', area: 18, assembly_id: 'a1', adjacent_space_type: 'exterior', b_factor: 1, delta_u_tb: 0.05, room_id: 'r3', relative_angle: 180, tilt: 90 }
  ];

  const state: ProjectState = {
    materials,
    assemblies,
    storeys,
    rooms,
    envelope_elements: elements,
    environmental_settings: {
      t_int: 21,
      t_e: -15,
      t_ground: 5,
      room_volume: 175,
      air_exchange_rate: 0.5,
      building_orientation: 0
    }
  };

  const allSections = ['summary', 'environmental', 'hierarchy', 'assemblies', 'envelope', 'distribution', 'methodology'];

  // Test 1: Full Document Export
  const fullDoc = generateTypstDocument(state, {
    selectedSectionKeys: allSections,
    selectedStoreyIds: ['s1', 's2'],
    selectedRoomIds: ['r1', 'r2', 'r3'],
    lang: 'cs'
  });

  assert(fullDoc.includes('2. Teploty a větrání'), 'Full document should contain "2. Teploty a větrání"');
  assert(fullDoc.includes('1.01 Obývák'), 'Full document should contain room 1.01 Obývák');
  assert(fullDoc.includes('1.02 Chodba'), 'Full document should contain room 1.02 Chodba');
  assert(fullDoc.includes('2.01 Ložnice'), 'Full document should contain room 2.01 Ložnice');
  assert(fullDoc.includes('$ U = 1 / (R_(s i) + sum (d_i / lambda_i) + R_(s e)) + Delta U_(T B) $'), 'Should render exact U-value formula');
  assert(fullDoc.includes('$ Phi_T = A_k cdot U_k cdot (t_(i n t) - t_e) cdot b_k $'), 'Should render exact Transmission formula');
  assert(fullDoc.includes('$ Phi_V = 0.34 cdot V_(m i n) cdot (t_(i n t) - t_e) cdot (1 - eta_(h r v)) $'), 'Should render exact Ventilation formula');
  console.log('✓ Test 1 Passed: Full document generated with all chapters and formulas.');

  // Test 2: Unchecking "environmental" ("Teploty a větrání") omits chapter from output
  const docWithoutEnvironmental = generateTypstDocument(state, {
    selectedSectionKeys: ['summary', 'hierarchy', 'assemblies', 'envelope', 'distribution', 'methodology'],
    selectedStoreyIds: ['s1', 's2'],
    selectedRoomIds: ['r1', 'r2', 'r3'],
    lang: 'cs'
  });

  assert(!docWithoutEnvironmental.includes('2. Teploty a větrání'), 'Unchecking "environmental" must omit chapter header "2. Teploty a větrání"');
  console.log('✓ Test 2 Passed: Unchecking "Teploty a větrání" omitted chapter header from document.');

  // Test 3: Deselecting room "r2" (1.02 Chodba) filters room and its envelope element "e2" (Hall Wall)
  const docFilteredRoom = generateTypstDocument(state, {
    selectedSectionKeys: allSections,
    selectedStoreyIds: ['s1', 's2'],
    selectedRoomIds: ['r1', 'r3'], // r2 deselected
    lang: 'cs'
  });

  assert(!docFilteredRoom.includes('1.02 Chodba'), 'Deselecting r2 should omit "1.02 Chodba" from tables');
  assert(!docFilteredRoom.includes('Hall Wall'), 'Deselecting r2 should filter out element "Hall Wall"');
  assert(docFilteredRoom.includes('1.01 Obývák'), 'Selected room r1 must remain');
  assert(docFilteredRoom.includes('2.01 Ložnice'), 'Selected room r3 must remain');
  console.log('✓ Test 3 Passed: Deselecting room r2 removed it and its envelope elements from exported report.');

  console.log('--- ALL TYPST GENERATOR TESTS PASSED ---');
}

runTypstGeneratorTests();
