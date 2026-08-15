import React, { useState } from 'react';
import { useHeatLossStore, generateUUID } from '../store';
import type { EnvelopeElement, AdjacentSpaceType } from '../types';
import { calculateAssemblyUValue, calculateEffectiveUValue, calculateTransmissionLoss, calculateNetArea, isNetAreaExceeded, calculateAbsoluteAzimuth, getAzimuthCardinalLabel } from '../mathEngine';
import { Plus, Trash2, Copy, HelpCircle, CornerDownRight, Compass, Layers, Filter } from 'lucide-react';
import { useTranslate } from '../hooks/useTranslate';

export const EnvelopeManager: React.FC = () => {
  const { t } = useTranslate();
  const elements = useHeatLossStore((state) => state.envelope_elements);
  const assemblies = useHeatLossStore((state) => state.assemblies);
  const materials = useHeatLossStore((state) => state.materials);
  const settings = useHeatLossStore((state) => state.environmental_settings);
  const rooms = useHeatLossStore((state) => state.rooms);
  const storeys = useHeatLossStore((state) => state.storeys);

  const addElement = useHeatLossStore((state) => state.addElement);
  const updateElement = useHeatLossStore((state) => state.updateElement);
  const deleteElement = useHeatLossStore((state) => state.deleteElement);

  // Storey and Room filtering state
  const [selectedFilterStoreyId, setSelectedFilterStoreyId] = useState<string>('all');
  const [selectedFilterRoomId, setSelectedFilterRoomId] = useState<string>('all');

  // New element states
  const [newName, setNewName] = useState('');
  const [newArea, setNewArea] = useState<number>(15);
  const [newAssemblyId, setNewAssemblyId] = useState('');
  const [newAdjacentSpace, setNewAdjacentSpace] = useState<AdjacentSpaceType>('exterior');
  const [newBFactor, setNewBFactor] = useState<number>(1.0);
  const [newDeltaUTb, setNewDeltaUTb] = useState<number>(0.05);
  const [newParentElementId, setNewParentElementId] = useState<string>('');
  const [newRoomId, setNewRoomId] = useState<string>('');
  const [newRelativeAngle, setNewRelativeAngle] = useState<number>(0);
  const [newTilt, setNewTilt] = useState<number>(90);

  const [showHelper, setShowHelper] = useState(false);

  // Handle b-factor changing when adjacent space type changes
  const handleSpaceTypeChange = (val: AdjacentSpaceType, isNew: boolean, elementId?: string) => {
    let bVal = 1.0;
    if (val === 'ground') {
      bVal = 0.45;
    } else if (val === 'unheated') {
      bVal = 0.60;
    } else if (val === 'custom') {
      bVal = 0.80;
    }

    if (isNew) {
      setNewAdjacentSpace(val);
      setNewBFactor(bVal);
    } else if (elementId) {
      updateElement(elementId, {
        adjacent_space_type: val,
        b_factor: bVal
      });
    }
  };

  const handleCreateElement = (e: React.FormEvent) => {
    e.preventDefault();
    const assId = newAssemblyId || assemblies[0]?.id || '';
    if (!newName.trim() || !assId) return;

    const newElement: EnvelopeElement = {
      id: generateUUID(),
      name: newName.trim(),
      area: Math.max(0.1, newArea),
      assembly_id: assId,
      adjacent_space_type: newAdjacentSpace,
      b_factor: newBFactor,
      delta_u_tb: newDeltaUTb,
      parent_element_id: newParentElementId || undefined,
      room_id: newRoomId || undefined,
      relative_angle: newRelativeAngle,
      tilt: newTilt,
      count: 1
    };

    addElement(newElement);
    setNewName('');
  };

  const handleDuplicateElement = (element: EnvelopeElement) => {
    const duplicated: EnvelopeElement = {
      ...element,
      id: generateUUID(),
      name: `${element.name} (Copy)`
    };
    addElement(duplicated);
  };

  // Build ordered element list
  const validIds = new Set(elements.map(e => e.id));
  const visited = new Set<string>();
  const orderedItems: { element: EnvelopeElement; depth: number }[] = [];

  const addWithChildren = (elId: string, depth: number) => {
    if (visited.has(elId)) return;
    const el = elements.find(e => e.id === elId);
    if (!el) return;

    visited.add(elId);
    orderedItems.push({ element: el, depth });

    const children = elements.filter(c => c.parent_element_id === elId);
    children.forEach(c => addWithChildren(c.id, depth + 1));
  };

  const topCandidates = elements.filter(e => !e.parent_element_id || !validIds.has(e.parent_element_id));
  topCandidates.forEach(topEl => addWithChildren(topEl.id, 0));

  elements.forEach(el => {
    if (!visited.has(el.id)) {
      addWithChildren(el.id, 0);
    }
  });

  // Combined filtering logic by Storey and Room
  const filteredOrderedItems = orderedItems.filter(({ element }) => {
    // 1. Room filter check
    if (selectedFilterRoomId !== 'all') {
      if (selectedFilterRoomId === 'unassigned' && element.room_id) return false;
      if (selectedFilterRoomId !== 'unassigned' && element.room_id !== selectedFilterRoomId) return false;
    }

    // 2. Storey filter check
    if (selectedFilterStoreyId !== 'all') {
      if (!element.room_id) return false;
      const elementRoom = rooms.find((r) => r.id === element.room_id);
      if (selectedFilterStoreyId === 'unassigned' && elementRoom?.storey_id) return false;
      if (selectedFilterStoreyId !== 'unassigned' && elementRoom?.storey_id !== selectedFilterStoreyId) return false;
    }

    return true;
  });

  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-slate-100 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers className="text-indigo-600 w-6 h-6" />
          <h2 className="text-xl font-bold text-slate-800">
            {t.viewer3d?.roomEnvelopes || 'Obálky Místností / Room Envelopes'}
          </h2>
        </div>
        <button
          onClick={() => setShowHelper(!showHelper)}
          className="text-slate-400 hover:text-indigo-600 transition-colors"
          title="Show physical space factors guide"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      <p className="text-slate-500 text-sm mb-4">
        {t.envelope.desc}
      </p>

      {/* Filter Bar Controls (Storey & Room) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 mb-6 bg-slate-50 rounded-xl border border-slate-200">
        {/* Storey Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs font-bold text-slate-700 shrink-0">
            <Filter className="w-3.5 h-3.5 text-indigo-600" />
            <span>Filtr podlaží / Storey Filter:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => setSelectedFilterStoreyId('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                selectedFilterStoreyId === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Všechna podlaží
            </button>
            {storeys.map((storey) => (
              <button
                key={storey.id}
                onClick={() => setSelectedFilterStoreyId(storey.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  selectedFilterStoreyId === storey.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {storey.name}
              </button>
            ))}
          </div>
        </div>

        {/* Room Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs font-bold text-slate-700 shrink-0">
            <Filter className="w-3.5 h-3.5 text-indigo-600" />
            <span>Filtr místností / Room Filter:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => setSelectedFilterRoomId('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                selectedFilterRoomId === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Všechny ({elements.length})
            </button>
            {rooms.map((room) => {
              const count = elements.filter((e) => e.room_id === room.id).length;
              return (
                <button
                  key={room.id}
                  onClick={() => setSelectedFilterRoomId(room.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                    selectedFilterRoomId === room.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {room.name} ({count})
                </button>
              );
            })}
            <button
              onClick={() => setSelectedFilterRoomId('unassigned')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                selectedFilterRoomId === 'unassigned'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Nezařazené ({elements.filter((e) => !e.room_id).length})
            </button>
          </div>
        </div>
      </div>

      {/* Helper guide */}
      {showHelper && (
        <div className="mb-6 p-4 bg-red-50 text-red-900 rounded-lg text-xs leading-relaxed grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="font-bold mb-1">{t.envelope.guideSpaceTitle}</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>{t.envelope.guideSpaceExterior}</li>
              <li>{t.envelope.guideSpaceGround}</li>
              <li>{t.envelope.guideSpaceUnheated}</li>
              <li>{t.envelope.guideSpaceCustom}</li>
            </ul>
          </div>
          <div>
            <p className="font-bold mb-1">{t.envelope.guideBridgeTitle}</p>
            <p>{t.envelope.guideBridgeDesc}</p>
            <ul className="list-disc pl-4 mt-1 space-y-0.5">
              <li>{t.envelope.guideBridgeNegligible}</li>
              <li>{t.envelope.guideBridgeStandard}</li>
              <li>{t.envelope.guideBridgeOld}</li>
            </ul>
          </div>
        </div>
      )}

      {/* Creator Form */}
      <form onSubmit={handleCreateElement} className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-100">
        <h3 className="text-sm font-bold text-slate-700 mb-3">{t.envelope.addSurfaceTitle}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 items-end">
          <div className="sm:col-span-1 md:col-span-2 xl:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">{t.envelope.surfaceName}</label>
            <input
              type="text"
              required
              placeholder="e.g. External Wall North"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t.envelope.area}</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              required
              value={newArea}
              onChange={(e) => setNewArea(Math.max(0.1, parseFloat(e.target.value) || 0))}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs font-mono font-bold focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t.envelope.constAssembly}</label>
            <select
              required
              value={newAssemblyId || (assemblies[0]?.id || '')}
              onChange={(e) => setNewAssemblyId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs focus:ring-red-500 bg-white"
            >
              <option value="" disabled>-- Choose Assembly --</option>
              {assemblies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} (U={calculateAssemblyUValue(a, materials).toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t.envelope.assignedRoom}</label>
            <select
              value={newRoomId}
              onChange={(e) => setNewRoomId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs focus:ring-red-500 bg-white"
            >
              <option value="">{t.envelope.unassignedRoom}</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.t_int}°C)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t.envelope.adjacentSpace}</label>
            <select
              value={newAdjacentSpace}
              onChange={(e) => handleSpaceTypeChange(e.target.value as AdjacentSpaceType, true)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs focus:ring-red-500 bg-white"
            >
              <option value="exterior">{t.envelope.spaces.exterior}</option>
              <option value="ground">{t.envelope.spaces.ground}</option>
              <option value="unheated">{t.envelope.spaces.unheated}</option>
              <option value="custom">{t.envelope.spaces.custom}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t.envelope.bFactor}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              disabled={newAdjacentSpace === 'exterior' || newAdjacentSpace === 'ground'}
              value={newBFactor}
              onChange={(e) => setNewBFactor(Math.min(1.0, Math.max(0, parseFloat(e.target.value) || 0)))}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs font-mono disabled:bg-slate-100 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t.envelope.bridgePenalty}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="0.5"
              value={newDeltaUTb}
              onChange={(e) => setNewDeltaUTb(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs font-mono focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t.envelope.relativeAngle}</label>
            <input
              type="number"
              min="0"
              max="360"
              value={newRelativeAngle}
              onChange={(e) => setNewRelativeAngle(((parseFloat(e.target.value) || 0) % 360 + 360) % 360)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t.envelope.tilt}</label>
            <input
              type="number"
              min="0"
              max="180"
              value={newTilt}
              onChange={(e) => setNewTilt(Math.max(0, Math.min(180, parseFloat(e.target.value) || 0)))}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs font-mono"
            />
          </div>

          <div className="sm:col-span-1 md:col-span-2 xl:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">{t.envelope.parentElement}</label>
            <select
              value={newParentElementId}
              onChange={(e) => setNewParentElementId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs focus:ring-red-500 bg-white"
            >
              <option value="">{t.envelope.noneStandalone}</option>
              {elements.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-1 md:col-span-2 xl:col-span-2">
            <button
              type="submit"
              disabled={assemblies.length === 0}
              className="w-full py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 text-white rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-colors h-[34px]"
            >
              <Plus className="w-4 h-4" />
              {t.envelope.addBtn}
            </button>
          </div>
        </div>
      </form>

      {/* Unstacked High-Density Compact Horizontal Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left border-collapse min-w-[1100px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <th className="px-3 py-2 text-left">{t.envelope.tableHeaderSurface}</th>
              <th className="px-2 py-2 text-left max-w-[110px]">{t.envelope.assignedRoom}</th>
              <th className="px-2 py-2 text-left max-w-[110px]">{t.envelope.parentElement}</th>
              <th className="px-2 py-2 text-center max-w-[80px]">Rel. Azimut</th>
              <th className="px-2 py-2 text-center max-w-[80px]">Sklon</th>
              <th className="px-2 py-2 text-center max-w-[100px]">{t.envelope.computedAzimuth}</th>
              <th className="px-3 py-2 text-center">{t.envelope.tableHeaderArea} & Počet</th>
              <th className="px-3 py-2 text-left">{t.envelope.tableHeaderAssembly}</th>
              <th className="px-2 py-2 text-center">ΔU_tb</th>
              <th className="px-2 py-2 text-center">{t.envelope.tableHeaderEffectiveU}</th>
              <th className="px-2 py-2 text-center">Factor b</th>
              <th className="px-3 py-2 text-right">{t.envelope.tableHeaderHeatLoss}</th>
              <th className="px-2 py-2 text-center">{t.envelope.tableHeaderActions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filteredOrderedItems.map(({ element, depth }) => {
              const isChild = depth > 0;
              const uEff = calculateEffectiveUValue(element, assemblies, materials);
              const loss = calculateTransmissionLoss(element, assemblies, materials, settings, elements, rooms);

              const netArea = calculateNetArea(element, elements);
              const isExceeded = isNetAreaExceeded(element, elements);

              const absAzimuth = calculateAbsoluteAzimuth(settings.building_orientation ?? 0, element.relative_angle ?? 0);
              const cardinal = getAzimuthCardinalLabel(absAzimuth, useHeatLossStore.getState().language);

              return (
                <tr
                  key={element.id}
                  className={`hover:bg-slate-50/60 transition-colors ${
                    isChild ? 'bg-slate-50/30' : ''
                  } ${isExceeded ? 'bg-amber-50/50' : ''}`}
                >
                  {/* Surface Name */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-1.5" style={{ paddingLeft: `${depth * 14}px` }}>
                      {isChild && <CornerDownRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                      <input
                        type="text"
                        value={element.name}
                        onChange={(e) => updateElement(element.id, { name: e.target.value })}
                        className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-red-500 font-bold text-slate-800 text-xs px-1 py-0.5 outline-none max-w-[160px] truncate"
                      />
                      {(element.is_virtual || element.source === 'manual') && (
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1 py-0.5 rounded shrink-0">
                          Ruční
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Dedicated Column: Assigned Room */}
                  <td className="px-2 py-2 whitespace-nowrap max-w-[110px]">
                    <select
                      value={element.room_id || ''}
                      onChange={(e) => updateElement(element.id, { room_id: e.target.value || undefined })}
                      className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[11px] text-slate-700 font-medium truncate outline-none focus:ring-1 focus:ring-red-500"
                    >
                      <option value="">-- Není --</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Dedicated Column: Parent Element */}
                  <td className="px-2 py-2 whitespace-nowrap max-w-[110px]">
                    <select
                      value={element.parent_element_id || ''}
                      onChange={(e) => updateElement(element.id, { parent_element_id: e.target.value || undefined })}
                      className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[11px] text-slate-600 truncate outline-none focus:ring-1 focus:ring-red-500"
                    >
                      <option value="">-- Samostatný --</option>
                      {elements
                        .filter((e) => e.id !== element.id)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </td>

                  {/* Dedicated Column: Relative Angle */}
                  <td className="px-2 py-2 text-center whitespace-nowrap max-w-[80px]">
                    <input
                      type="number"
                      min="0"
                      max="360"
                      value={element.relative_angle ?? 0}
                      onChange={(e) => updateElement(element.id, { relative_angle: ((parseFloat(e.target.value) || 0) % 360 + 360) % 360 })}
                      className="w-12 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-center text-slate-700 font-mono text-xs font-semibold"
                    />
                  </td>

                  {/* Dedicated Column: Tilt */}
                  <td className="px-2 py-2 text-center whitespace-nowrap max-w-[80px]">
                    <input
                      type="number"
                      min="0"
                      max="180"
                      value={element.tilt ?? 90}
                      onChange={(e) => updateElement(element.id, { tilt: Math.max(0, Math.min(180, parseFloat(e.target.value) || 0)) })}
                      className="w-12 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-center text-slate-700 font-mono text-xs font-semibold"
                    />
                  </td>

                  {/* Dedicated Column: Computed Azimuth Tag */}
                  <td className="px-2 py-2 text-center whitespace-nowrap max-w-[100px]">
                    <div
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded text-indigo-700 font-mono text-[10px] font-bold"
                      title={`Azimut ${absAzimuth}° (${cardinal})`}
                    >
                      <Compass className="w-3 h-3 text-indigo-500 shrink-0" />
                      <span>{absAzimuth}° {cardinal}</span>
                    </div>
                  </td>

                  {/* Area Breakdown & Quantity Count */}
                  <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">
                    <div className="flex items-center gap-1 justify-center">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={element.area}
                        onChange={(e) => updateElement(element.id, { area: Math.max(0.1, parseFloat(e.target.value) || 0) })}
                        className="w-14 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded font-bold text-center text-slate-700"
                      />
                      <span className="text-slate-400">m²</span>
                      <div className="flex items-center gap-0.5 text-amber-800 font-bold bg-amber-50 px-1 py-0.5 rounded border border-amber-200" title="Počet / Quantity">
                        <span className="text-[10px]">×</span>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={element.count || 1}
                          onChange={(e) => updateElement(element.id, { count: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-8 px-0.5 py-0.5 bg-white border border-amber-300 rounded text-center text-xs font-bold text-amber-900"
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 font-bold ml-1">
                        (Net: {netArea.toFixed(1)}m²)
                      </span>
                    </div>
                  </td>

                  {/* Assembly Selector */}
                  <td className="px-3 py-2 whitespace-nowrap max-w-[140px]">
                    <select
                      value={element.assembly_id}
                      onChange={(e) => updateElement(element.id, { assembly_id: e.target.value })}
                      className="w-full px-1.5 py-0.5 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none truncate"
                    >
                      {assemblies.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Penalty */}
                  <td className="px-2 py-2 text-center whitespace-nowrap">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="0.5"
                      value={element.delta_u_tb}
                      onChange={(e) => updateElement(element.id, { delta_u_tb: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="w-12 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-center text-slate-600 font-mono font-medium"
                    />
                  </td>

                  {/* Effective U-Value */}
                  <td className="px-2 py-2 text-center whitespace-nowrap font-mono text-xs font-bold text-slate-700">
                    {uEff.toFixed(3)}
                  </td>

                  {/* Factor b */}
                  <td className="px-2 py-2 text-center whitespace-nowrap">
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      disabled={element.adjacent_space_type === 'exterior' || element.adjacent_space_type === 'ground'}
                      value={element.b_factor}
                      onChange={(e) => updateElement(element.id, { b_factor: Math.min(1.0, Math.max(0, parseFloat(e.target.value) || 0)) })}
                      className="w-12 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded font-mono text-center text-slate-700 disabled:text-slate-400"
                    />
                  </td>

                  {/* Heat Loss */}
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <div className="font-mono text-xs font-black text-red-600">
                      {loss.toFixed(1)} W
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-2 py-2 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleDuplicateElement(element)}
                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                        title={t.envelope.duplicateTooltip}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteElement(element.id)}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded transition-colors"
                        title={t.envelope.deleteTooltip}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredOrderedItems.length === 0 && (
              <tr>
                <td colSpan={13} className="text-center p-8 text-slate-400 text-xs">
                  {t.envelope.noSurfaces}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
