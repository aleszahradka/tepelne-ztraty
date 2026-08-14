import React, { useState } from 'react';
import { useHeatLossStore, generateUUID } from '../store';
import type { EnvelopeElement, AdjacentSpaceType } from '../types';
import { calculateAssemblyUValue, calculateEffectiveUValue, calculateTransmissionLoss } from '../mathEngine';
import { ShieldAlert, Plus, Trash2, Copy, HelpCircle } from 'lucide-react';

export const EnvelopeManager: React.FC = () => {
  const elements = useHeatLossStore((state) => state.envelope_elements);
  const assemblies = useHeatLossStore((state) => state.assemblies);
  const materials = useHeatLossStore((state) => state.materials);
  const settings = useHeatLossStore((state) => state.environmental_settings);

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
      delta_u_tb: newDeltaUTb
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
    (sum, el) => sum + calculateTransmissionLoss(el, assemblies, materials, settings),
    0
  );

  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-slate-100 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="text-red-500 w-6 h-6" />
          <h2 className="text-xl font-bold text-slate-800">Building Envelope & transmission Losses</h2>
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
        Specify individual building surfaces (walls, roofs, windows) with their respective areas, construction assembly, and adjacent space reduction factors (b).
      </p>

      {/* b-factor and Delta U helper guide */}
      {showHelper && (
        <div className="mb-6 p-4 bg-red-50 text-red-900 rounded-lg text-xs leading-relaxed grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="font-bold mb-1">Temperature Reduction Factor (b):</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li><strong>Exterior (Directly adjacent to outdoor air):</strong> b = 1.00</li>
              <li><strong>Ground (Slab on ground / Basements):</strong> b = 0.45</li>
              <li><strong>Unheated attic or garage space:</strong> b = 0.60 to 0.80</li>
              <li><strong>Partially buffered or crawlspaces:</strong> Custom value (e.g. 0.50)</li>
            </ul>
          </div>
          <div>
            <p className="font-bold mb-1">Thermal Bridge Correction (ΔU_tb):</p>
            <p>
              Adds a continuous physical penalty (W/m²K) onto the U-value to account for structural thermal bridges (corners, joists, anchors):
            </p>
            <ul className="list-disc pl-4 mt-1 space-y-0.5">
              <li><strong>Negligible bridges:</strong> ΔU_tb = 0.00 – 0.02</li>
              <li><strong>Standard new builds (default):</strong> ΔU_tb = 0.05</li>
              <li><strong>Old uninsulated buildings:</strong> ΔU_tb = 0.10+</li>
            </ul>
          </div>
        </div>
      )}

      {/* Envelope Element Creator Form */}
      <form onSubmit={handleCreateElement} className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-100">
        <h3 className="text-sm font-bold text-slate-700 mb-3">Add Building Envelope Surface</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 items-end">
          {/* Surface Name */}
          <div className="sm:col-span-1 md:col-span-2 xl:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Surface / Element Name</label>
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
            <label className="block text-xs font-medium text-slate-500 mb-1">Area (m²)</label>
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
            <label className="block text-xs font-medium text-slate-500 mb-1">Construction Assembly</label>
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

          {/* Space type */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Adjacent Space</label>
            <select
              value={newAdjacentSpace}
              onChange={(e) => handleSpaceTypeChange(e.target.value as AdjacentSpaceType, true)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs focus:ring-red-500 focus:border-red-500 bg-white"
            >
              <option value="exterior">Exterior (Direct)</option>
              <option value="ground">Ground Floor</option>
              <option value="unheated">Unheated Space</option>
              <option value="custom">Custom factor</option>
            </select>
          </div>

          {/* b-factor or thermal bridges */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              b-Factor ({newAdjacentSpace})
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
              Bridge Penalty ΔU_tb
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

          {/* Blank column for spacing on large screens */}
          <div className="sm:col-span-1 xl:col-span-4"></div>

          {/* Submit button */}
          <div className="sm:col-span-1 md:col-span-2 xl:col-span-2">
            <button
              type="submit"
              disabled={assemblies.length === 0}
              className="w-full py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-colors h-[34px]"
            >
              <Plus className="w-4 h-4" />
              Add Surface to Envelope
            </button>
          </div>
        </div>
      </form>

      {/* List / Table of Surfaces */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
              <th className="px-4 py-3">Surface / Envelope Element</th>
              <th className="px-4 py-3">Area (A)</th>
              <th className="px-4 py-3">Assembly (U_asm)</th>
              <th className="px-4 py-3">Penalty ΔU_tb</th>
              <th className="px-4 py-3">Effective U</th>
              <th className="px-4 py-3">b-Factor</th>
              <th className="px-4 py-3 text-right">Heat Loss (Φ_T)</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {elements.map((element) => {
              const uEff = calculateEffectiveUValue(element, assemblies, materials);
              const loss = calculateTransmissionLoss(element, assemblies, materials, settings);

              // calculate percentage of total transmission losses
              const pctOfLoss = totalTransmissionLoss > 0 ? (loss / totalTransmissionLoss) * 100 : 0;

              return (
                <tr key={element.id} className="hover:bg-slate-50/50 transition-colors">
                  {/* Name (Inline editable) */}
                  <td className="px-4 py-3.5">
                    <input
                      type="text"
                      value={element.name}
                      onChange={(e) => updateElement(element.id, { name: e.target.value })}
                      className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-red-500 font-semibold text-slate-800 text-sm px-1 py-0.5 w-full outline-none"
                    />
                  </td>

                  {/* Area (Inline editable) */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-1 font-mono text-xs">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={element.area}
                        onChange={(e) => updateElement(element.id, { area: Math.max(0.1, parseFloat(e.target.value) || 0) })}
                        className="w-16 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded font-bold text-center text-slate-700"
                      />
                      <span className="text-slate-400">m²</span>
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
                        <option value="exterior">Exterior</option>
                        <option value="ground">Ground</option>
                        <option value="unheated">Unheated</option>
                        <option value="custom">Custom</option>
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
                    <div className="font-mono text-sm font-black text-red-600">
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
                        title="Duplicate Surface"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteElement(element.id)}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded transition-colors"
                        title="Delete Surface"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {elements.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center p-10 text-slate-400">
                  No envelope parts created yet. Create surfaces using the form above to assess transmission losses.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
