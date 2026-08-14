import React, { useState } from 'react';
import { useHeatLossStore, generateUUID } from '../store';
import type { EnvelopeElement, AdjacentSpaceType } from '../types';
import { calculateAssemblyUValue, calculateEffectiveUValue, calculateTransmissionLoss, calculateChildOpeningsArea, calculateNetArea, isNetAreaExceeded } from '../mathEngine';
import { ShieldAlert, Plus, Trash2, Copy, HelpCircle, CornerDownRight, AlertTriangle } from 'lucide-react';
import { useTranslate } from '../hooks/useTranslate';

export const EnvelopeManager: React.FC = () => {
  const { t } = useTranslate();
  const elements = useHeatLossStore((state) => state.envelope_elements);
  const assemblies = useHeatLossStore((state) => state.assemblies);
  const materials = useHeatLossStore((state) => state.materials);
  const settings = useHeatLossStore((state) => state.environmental_settings);
  const rooms = useHeatLossStore((state) => state.rooms);

  const addElement = useHeatLossStore((state) => state.addElement);
  const updateElement = useHeatLossStore((state) => state.updateElement);
  const deleteElement = useHeatLossStore((state) => state.deleteElement);

  // New element states
  const [newName, setNewName] = useState('');
  const [newArea, setNewArea] = useState<number>(15);
  const [newAssemblyId, setNewAssemblyId] = useState('');
  const [newAdjacentSpace, setNewAdjacentSpace] = useState<AdjacentSpaceType>('exterior');
  const [newBFactor, setNewBFactor] = useState<number>(1.0);
  const [newDeltaUTb, setNewDeltaUTb] = useState<number>(0.05);
  const [newParentElementId, setNewParentElementId] = useState<string>('');
  const [newRoomId, setNewRoomId] = useState<string>('');

  const [showHelper, setShowHelper] = useState(false);

  // Handle b-factor changing when adjacent space type changes
  const handleSpaceTypeChange = (val: AdjacentSpaceType, isNew: boolean, elementId?: string) => {
    let bVal = 1.0;
    if (val === 'ground') {
      bVal = 0.45;
    } else if (val === 'unheated') {
      bVal = 0.60; // common default ratio for unheated garage/loft
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
      room_id: newRoomId || undefined
    };

    addElement(newElement);
    setNewName('');
    // keep other fields as convenient templates
  };

  const handleDuplicateElement = (element: EnvelopeElement) => {
    const duplicated: EnvelopeElement = {
      ...element,
      id: generateUUID(),
      name: `${element.name} (Copy)`
    };
    addElement(duplicated);
  };

  // Calculate total transmission loss for scaling visual bars
  const totalTransmissionLoss = elements.reduce(
    (sum, el) => sum + calculateTransmissionLoss(el, assemblies, materials, settings, elements, rooms),
    0
  );

  // Eligible parent candidates (elements that are not children themselves)
  const topLevelElements = elements.filter(e => !e.parent_element_id);

  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-slate-100 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="text-red-500 w-6 h-6" />
          <h2 className="text-xl font-bold text-slate-800">{t.envelope.title}</h2>
        </div>
        <button
          onClick={() => setShowHelper(!showHelper)}
          className="text-slate-400 hover:text-red-500 transition-colors"
          title="Show physical space factors guide"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      <p className="text-slate-500 text-sm mb-6">
        {t.envelope.desc}
      </p>

      {/* b-factor and Delta U helper guide */}
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
            <p>
              {t.envelope.guideBridgeDesc}
            </p>
            <ul className="list-disc pl-4 mt-1 space-y-0.5">
              <li>{t.envelope.guideBridgeNegligible}</li>
              <li>{t.envelope.guideBridgeStandard}</li>
              <li>{t.envelope.guideBridgeOld}</li>
            </ul>
          </div>
        </div>
      )}

      {/* Envelope Element Creator Form */}
      <form onSubmit={handleCreateElement} className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-100">
        <h3 className="text-sm font-bold text-slate-700 mb-3">{t.envelope.addSurfaceTitle}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 items-end">
          {/* Surface Name */}
          <div className="sm:col-span-1 md:col-span-2 xl:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">{t.envelope.surfaceName}</label>
            <input
              type="text"
              required
              placeholder="e.g. External Wall North"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs focus:ring-red-500 focus:border-red-500"
            />
          </div>

          {/* Area */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t.envelope.area}</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              required
              value={newArea}
              onChange={(e) => setNewArea(Math.max(0.1, parseFloat(e.target.value) || 0))}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs font-mono font-bold focus:ring-red-500 focus:border-red-500"
            />
          </div>

          {/* Assembly Link */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t.envelope.constAssembly}</label>
            <select
              required
              value={newAssemblyId || (assemblies[0]?.id || '')}
              onChange={(e) => setNewAssemblyId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs focus:ring-red-500 focus:border-red-500 bg-white"
            >
              <option value="" disabled>-- Choose Assembly --</option>
              {assemblies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} (U={calculateAssemblyUValue(a, materials).toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          {/* Assigned Room */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t.envelope.assignedRoom}</label>
            <select
              value={newRoomId}
              onChange={(e) => setNewRoomId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs focus:ring-red-500 focus:border-red-500 bg-white"
            >
              <option value="">{t.envelope.unassignedRoom}</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.t_int}°C)
                </option>
              ))}
            </select>
          </div>

          {/* Space type */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t.envelope.adjacentSpace}</label>
            <select
              value={newAdjacentSpace}
              onChange={(e) => handleSpaceTypeChange(e.target.value as AdjacentSpaceType, true)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs focus:ring-red-500 focus:border-red-500 bg-white"
            >
              <option value="exterior">{t.envelope.spaces.exterior}</option>
              <option value="ground">{t.envelope.spaces.ground}</option>
              <option value="unheated">{t.envelope.spaces.unheated}</option>
              <option value="custom">{t.envelope.spaces.custom}</option>
            </select>
          </div>

          {/* b-factor or thermal bridges */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              {t.envelope.bFactor} ({newAdjacentSpace})
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              disabled={newAdjacentSpace === 'exterior' || newAdjacentSpace === 'ground'}
              value={newBFactor}
              onChange={(e) => setNewBFactor(Math.min(1.0, Math.max(0, parseFloat(e.target.value) || 0)))}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs font-mono disabled:bg-slate-100 disabled:text-slate-400 focus:ring-red-500"
            />
          </div>

          {/* Delta U tb */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              {t.envelope.bridgePenalty}
            </label>
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

          {/* Parent Element Selector */}
          <div className="sm:col-span-1 md:col-span-2 xl:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              {t.envelope.parentElement}
            </label>
            <select
              value={newParentElementId}
              onChange={(e) => setNewParentElementId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs focus:ring-red-500 focus:border-red-500 bg-white"
            >
              <option value="">{t.envelope.noneStandalone}</option>
              {topLevelElements.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Blank column for spacing on large screens */}
          <div className="sm:col-span-1 xl:col-span-2"></div>

          {/* Submit button */}
          <div className="sm:col-span-1 md:col-span-2 xl:col-span-2">
            <button
              type="submit"
              disabled={assemblies.length === 0}
              className="w-full py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-colors h-[34px]"
            >
              <Plus className="w-4 h-4" />
              {t.envelope.addBtn}
            </button>
          </div>
        </div>
      </form>

      {/* List / Table of Surfaces */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
              <th className="px-4 py-3">{t.envelope.tableHeaderSurface}</th>
              <th className="px-4 py-3">{t.envelope.tableHeaderArea}</th>
              <th className="px-4 py-3">{t.envelope.tableHeaderAssembly}</th>
              <th className="px-4 py-3">{t.envelope.tableHeaderPenalty}</th>
              <th className="px-4 py-3">{t.envelope.tableHeaderEffectiveU}</th>
              <th className="px-4 py-3">{t.envelope.tableHeaderBFactor}</th>
              <th className="px-4 py-3 text-right">{t.envelope.tableHeaderHeatLoss}</th>
              <th className="px-4 py-3 text-center">{t.envelope.tableHeaderActions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {(() => {
              // Get top-level elements (no parent or parent not found)
              const validIds = new Set(elements.map(e => e.id));
              const topLevel = elements.filter(e => !e.parent_element_id || !validIds.has(e.parent_element_id));

              const renderRow = (element: EnvelopeElement, isChild: boolean = false) => {
                const uEff = calculateEffectiveUValue(element, assemblies, materials);
                const loss = calculateTransmissionLoss(element, assemblies, materials, settings, elements, rooms);
                const pctOfLoss = totalTransmissionLoss > 0 ? (loss / totalTransmissionLoss) * 100 : 0;

                const openingsArea = calculateChildOpeningsArea(element.id, elements);
                const netArea = calculateNetArea(element, elements);
                const isExceeded = isNetAreaExceeded(element, elements);
                const hasChildren = openingsArea > 0;

                return (
                  <tr
                    key={element.id}
                    className={`hover:bg-slate-50/50 transition-colors ${
                      isChild ? 'bg-slate-50/40' : ''
                    } ${isExceeded ? 'bg-amber-50/50' : ''}`}
                  >
                    {/* Name (Inline editable) & Parent relation */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          {isChild && (
                            <CornerDownRight className="w-4 h-4 text-indigo-400 shrink-0 ml-3" />
                          )}
                          <input
                            type="text"
                            value={element.name}
                            onChange={(e) => updateElement(element.id, { name: e.target.value })}
                            className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-red-500 font-semibold text-slate-800 text-sm px-1 py-0.5 w-full outline-none"
                          />
                        </div>

                        {/* Inline parent & room selectors */}
                        <div className={`flex flex-wrap items-center gap-2 text-[11px] ${isChild ? 'ml-8' : ''}`}>
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 font-medium">{t.envelope.parentElement}:</span>
                            <select
                              value={element.parent_element_id || ''}
                              onChange={(e) => updateElement(element.id, { parent_element_id: e.target.value || undefined })}
                              className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[11px] text-slate-600 outline-none focus:ring-1 focus:ring-red-500"
                            >
                              <option value="">{t.envelope.noneStandalone}</option>
                              {elements
                                .filter(e => e.id !== element.id && e.parent_element_id !== element.id)
                                .map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 font-medium">{t.envelope.assignedRoom}:</span>
                            <select
                              value={element.room_id || ''}
                              onChange={(e) => updateElement(element.id, { room_id: e.target.value || undefined })}
                              className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[11px] text-slate-600 outline-none focus:ring-1 focus:ring-red-500"
                            >
                              <option value="">{t.envelope.unassignedRoom}</option>
                              {rooms.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name} ({r.t_int}°C)
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Area Breakdown */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex flex-col gap-1 font-mono text-xs">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={element.area}
                            onChange={(e) => updateElement(element.id, { area: Math.max(0.1, parseFloat(e.target.value) || 0) })}
                            className="w-16 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded font-bold text-center text-slate-700"
                          />
                          <span className="text-slate-400">m²</span>
                          {hasChildren && (
                            <span className="text-[10px] text-slate-400 font-normal">({t.envelope.grossArea})</span>
                          )}
                        </div>

                        {/* Openings & Net Area Breakdown */}
                        {hasChildren && (
                          <div className="text-[11px] space-y-0.5 pt-0.5 border-t border-slate-100">
                            <div className="text-slate-500 flex items-center justify-between gap-2">
                              <span>{t.envelope.openingsArea}:</span>
                              <span className="text-red-500 font-semibold">-{openingsArea.toFixed(1)} m²</span>
                            </div>
                            <div className="text-slate-800 font-bold flex items-center justify-between gap-2">
                              <span>{t.envelope.netArea}:</span>
                              <span className={isExceeded ? 'text-amber-600 font-black' : 'text-slate-900'}>
                                {netArea.toFixed(1)} m²
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Warning badge if net area < 0 */}
                        {isExceeded && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-100/80 px-1.5 py-0.5 rounded mt-0.5 whitespace-normal max-w-[170px]">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>{t.envelope.openingsExceedWarning}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Assembly Selector */}
                    <td className="px-4 py-3.5">
                      <select
                        value={element.assembly_id}
                        onChange={(e) => updateElement(element.id, { assembly_id: e.target.value })}
                        className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none focus:ring-1 focus:ring-red-500 w-44"
                      >
                        {assemblies.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({calculateAssemblyUValue(a, materials).toFixed(2)})
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Penalty (Inline editable) */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1 font-mono text-xs">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="0.5"
                          value={element.delta_u_tb}
                          onChange={(e) => updateElement(element.id, { delta_u_tb: Math.max(0, parseFloat(e.target.value) || 0) })}
                          className="w-14 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-center text-slate-600 font-medium"
                        />
                      </div>
                    </td>

                    {/* Effective U-Value */}
                    <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs font-bold text-slate-700">
                      {uEff.toFixed(3)} <span className="text-[9px] text-slate-400">W/m²K</span>
                    </td>

                    {/* Adjacent space factor b */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <select
                          value={element.adjacent_space_type}
                          onChange={(e) => handleSpaceTypeChange(e.target.value as AdjacentSpaceType, false, element.id)}
                          className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-600 outline-none"
                        >
                          <option value="exterior">{t.envelope.spaces.exterior}</option>
                          <option value="ground">{t.envelope.spaces.ground}</option>
                          <option value="unheated">{t.envelope.spaces.unheated}</option>
                          <option value="custom">{t.envelope.spaces.custom}</option>
                        </select>
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          max="1"
                          disabled={element.adjacent_space_type === 'exterior' || element.adjacent_space_type === 'ground'}
                          value={element.b_factor}
                          onChange={(e) => updateElement(element.id, { b_factor: Math.min(1.0, Math.max(0, parseFloat(e.target.value) || 0)) })}
                          className="w-12 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-xs font-mono text-center text-slate-700 disabled:text-slate-400"
                        />
                      </div>
                    </td>

                    {/* Computed Heat Loss */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="font-mono text-sm font-black text-red-600 font-mono">
                        {loss.toFixed(1)} W
                      </div>
                      {/* Tiny inline distribution bar */}
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                        <div
                          className="bg-red-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${pctOfLoss}%` }}
                        ></div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-center">
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
              };

              return topLevel.map((parent) => {
                const children = elements.filter((c) => c.parent_element_id === parent.id);
                return (
                  <React.Fragment key={parent.id}>
                    {renderRow(parent, false)}
                    {children.map((child) => renderRow(child, true))}
                  </React.Fragment>
                );
              });
            })()}

            {elements.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center p-10 text-slate-400">
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
