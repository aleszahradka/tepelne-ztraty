import React, { useState } from 'react';
import { useHeatLossStore, generateUUID } from '../store';
import type { Assembly, Layer } from '../types';
import { calculateAssemblyUValue, calculateLayerResistance } from '../mathEngine';
import { Layers, Plus, Trash2, Eye } from 'lucide-react';
import { useTranslate } from '../hooks/useTranslate';

export const AssemblyBuilder: React.FC = () => {
  const { t } = useTranslate();
  const assemblies = useHeatLossStore((state) => state.assemblies);
  const materials = useHeatLossStore((state) => state.materials);

  const addAssembly = useHeatLossStore((state) => state.addAssembly);
  const updateAssembly = useHeatLossStore((state) => state.updateAssembly);
  const deleteAssembly = useHeatLossStore((state) => state.deleteAssembly);

  const addLayer = useHeatLossStore((state) => state.addLayer);
  const updateLayer = useHeatLossStore((state) => state.updateLayer);
  const deleteLayer = useHeatLossStore((state) => state.deleteLayer);

  // Local Form state for creating Assembly
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<Assembly['type']>('wall');

  // Currently editing assembly ID (to show/hide details)
  const [activeAssemblyId, setActiveAssemblyId] = useState<string | null>(assemblies[0]?.id || null);

  const handleCreateAssembly = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    // Determine sensible defaults for Rsi and Rse based on type
    let rsi = 0.13;
    let rse = 0.04;
    let direct_u_value: number | undefined = undefined;

    if (newType === 'roof') {
      rsi = 0.10;
      rse = 0.04;
    } else if (newType === 'floor') {
      rsi = 0.17;
      rse = 0.00;
    } else if (newType === 'window') {
      rsi = 0.13;
      rse = 0.04;
      direct_u_value = 1.2;
    } else if (newType === 'door') {
      rsi = 0.13;
      rse = 0.04;
      direct_u_value = 1.5;
    }

    const newAssembly: Assembly = {
      id: generateUUID(),
      name: newName.trim(),
      type: newType,
      rsi,
      rse,
      layers: [],
      direct_u_value
    };

    addAssembly(newAssembly);
    setActiveAssemblyId(newAssembly.id); // auto-expand newly created assembly
    setNewName('');
  };

  const handleAddLayerToAssembly = (assemblyId: string) => {
    const defaultMaterial = materials[0]?.id || '';
    const newLayer: Layer = {
      id: generateUUID(),
      material_id: defaultMaterial,
      thickness: 0.10 // 10 cm standard default
    };
    addLayer(assemblyId, newLayer);
  };

  // Helper to color layers based on their category
  const getLayerColor = (materialId: string) => {
    const mat = materials.find(m => m.id === materialId);
    if (!mat) return 'bg-slate-300';
    switch (mat.category) {
      case 'Insulation': return 'bg-sky-200 border-sky-400 text-sky-800';
      case 'Masonry': return 'bg-amber-200 border-amber-400 text-amber-800';
      case 'Concrete': return 'bg-slate-300 border-slate-400 text-slate-800';
      case 'Wood': return 'bg-orange-200 border-orange-400 text-orange-800';
      case 'Plasters': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      default: return 'bg-emerald-100 border-emerald-300 text-emerald-800';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-slate-100 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Layers className="text-indigo-600 w-6 h-6" />
        <h2 className="text-xl font-bold text-slate-800">{t.assemblies.title}</h2>
      </div>

      <p className="text-slate-500 text-sm mb-6">
        {t.assemblies.desc}
      </p>

      {/* Assembly Creator */}
      <form onSubmit={handleCreateAssembly} className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-100">
        <h3 className="text-sm font-bold text-slate-700 mb-3">{t.assemblies.addAssemblyTitle}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t.assemblies.assemblyName}</label>
            <input
              type="text"
              required
              placeholder="e.g. Brick Wall + EPS Insulation"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t.assemblies.constType}</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as Assembly['type'])}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            >
              <option value="wall">{t.assemblies.types.wall}</option>
              <option value="roof">{t.assemblies.types.roof}</option>
              <option value="floor">{t.assemblies.types.floor}</option>
              <option value="window">{t.assemblies.types.window}</option>
              <option value="door">{t.assemblies.types.door}</option>
              <option value="custom">{t.assemblies.types.custom}</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={!newName.trim()}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors h-[34px]"
          >
            <Plus className="w-4 h-4" />
            {t.assemblies.addAssemblyBtn}
          </button>
        </div>
      </form>

      {/* Assembly List */}
      <div className="space-y-4">
        {assemblies.map((assembly) => {
          const isActive = activeAssemblyId === assembly.id;
          const calculatedU = calculateAssemblyUValue(assembly, materials);
          const isDirectUValue = assembly.type === 'window' || assembly.type === 'door';

          return (
            <div
              key={assembly.id}
              className={`border rounded-xl transition-all duration-200 ${
                isActive ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Assembly Header Accordion */}
              <div
                onClick={() => setActiveAssemblyId(isActive ? null : assembly.id)}
                className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none bg-slate-50/50 hover:bg-slate-50 rounded-t-xl"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full uppercase shrink-0 ${
                    assembly.type === 'wall' ? 'bg-amber-100 text-amber-800' :
                    assembly.type === 'roof' ? 'bg-sky-100 text-sky-800' :
                    assembly.type === 'floor' ? 'bg-emerald-100 text-emerald-800' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                    {t.assemblies.types[assembly.type] || assembly.type}
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm md:text-base">{assembly.name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isDirectUValue ? t.assemblies.directBadge : `${assembly.layers.length} ${t.assemblies.layersBadge}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block font-medium">{t.assemblies.uValue}:</span>
                    <span className="text-base font-extrabold text-indigo-600 font-mono">
                      {calculatedU.toFixed(3)} <span className="text-xs font-normal">W/(m²K)</span>
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteAssembly(assembly.id);
                      if (activeAssemblyId === assembly.id) setActiveAssemblyId(null);
                    }}
                    className="text-slate-400 hover:text-red-500 p-1.5 rounded hover:bg-slate-100 transition-colors shrink-0"
                    title={t.assemblies.deleteTooltip}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Assembly Detail Editor */}
              {isActive && (
                <div className="p-4 border-t border-slate-200 bg-white rounded-b-xl space-y-4">
                  {/* Surface Resistances Inputs */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                        {t.assemblies.rsi}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={assembly.rsi}
                        onChange={(e) => updateAssembly(assembly.id, { rsi: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1 border border-slate-200 rounded font-mono text-xs focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                        {t.assemblies.rse}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={assembly.rse}
                        onChange={(e) => updateAssembly(assembly.id, { rse: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1 border border-slate-200 rounded font-mono text-xs focus:ring-indigo-500"
                      />
                    </div>

                    {/* Direct U-Value Input (for window/door type) */}
                    {isDirectUValue && (
                      <div className="col-span-2">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1 text-indigo-600">
                          {t.assemblies.directUValLabel}
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={assembly.direct_u_value ?? 1.2}
                          onChange={(e) => updateAssembly(assembly.id, { direct_u_value: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1 border border-indigo-200 bg-indigo-50/50 text-indigo-800 rounded font-mono text-xs font-bold focus:ring-indigo-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* Layers Stack View (Hidden for direct U-value) */}
                  {!isDirectUValue && (
                    <div className="space-y-4">
                      {/* Interactive Visual Graph of layers */}
                      {assembly.layers.length > 0 && (
                        <div>
                          <span className="text-xs font-bold text-slate-600 flex items-center gap-1 mb-2">
                            <Eye className="w-4 h-4 text-slate-400" /> {t.assemblies.profilePreview}
                          </span>
                          <div className="h-10 w-full flex rounded-lg overflow-hidden border border-slate-200 shadow-inner">
                            {assembly.layers.map((layer) => {
                              const mat = materials.find(m => m.id === layer.material_id);
                              // calculate percentage width relative to total thickness
                              const totalThick = assembly.layers.reduce((sum, l) => sum + l.thickness, 0);
                              const pctWidth = totalThick > 0 ? (layer.thickness / totalThick) * 100 : 0;

                              return (
                                <div
                                  key={layer.id}
                                  style={{ width: `${pctWidth}%` }}
                                  className={`h-full border-r last:border-r-0 flex items-center justify-center text-[10px] font-bold overflow-hidden px-1 transition-all ${getLayerColor(layer.material_id)}`}
                                  title={`${mat?.name || 'Unknown'}: ${(layer.thickness * 100).toFixed(0)}cm`}
                                >
                                  <span className="truncate">
                                    {mat?.name || 'Unknown'} ({(layer.thickness * 100).toFixed(0)}cm)
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Header row for layer table */}
                      <div className="text-xs font-bold text-slate-400 grid grid-cols-12 gap-3 px-2 border-b border-slate-100 pb-2">
                        <div className="col-span-5">{t.assemblies.tableMaterial}</div>
                        <div className="col-span-3">{t.assemblies.tableThickness}</div>
                        <div className="col-span-3 text-right">{t.assemblies.tableR}</div>
                        <div className="col-span-1"></div>
                      </div>

                      {/* List of layers */}
                      <div className="space-y-2.5">
                        {assembly.layers.map((layer) => {
                          const layerR = calculateLayerResistance(layer, materials);
                          return (
                            <div key={layer.id} className="grid grid-cols-12 gap-3 items-center px-2 py-1.5 hover:bg-slate-50 rounded-lg">
                              {/* Material dropdown selection */}
                              <div className="col-span-5">
                                <select
                                  value={layer.material_id}
                                  onChange={(e) => updateLayer(assembly.id, layer.id, { material_id: e.target.value })}
                                  className="w-full px-2 py-1 border border-slate-200 rounded text-xs bg-white text-slate-700"
                                >
                                  {materials.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name} (λ={m.design_thermal_conductivity})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Thickness in cm with real-time conversion */}
                              <div className="col-span-3 flex items-center gap-1.5">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0.1"
                                  max="200"
                                  value={layer.thickness * 100} // displays in cm
                                  onChange={(e) => {
                                    const cmVal = parseFloat(e.target.value) || 0;
                                    updateLayer(assembly.id, layer.id, { thickness: cmVal / 100 }); // stores in meters
                                  }}
                                  className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-mono font-bold focus:ring-indigo-500"
                                />
                                <span className="text-slate-400 text-xs shrink-0">cm</span>
                              </div>

                              {/* Layer R resistance result */}
                              <div className="col-span-3 text-right font-mono text-xs font-bold text-slate-600 font-mono">
                                {layerR.toFixed(3)}
                              </div>

                              {/* Delete layer button */}
                              <div className="col-span-1 flex justify-end">
                                <button
                                  onClick={() => deleteLayer(assembly.id, layer.id)}
                                  className="text-slate-400 hover:text-red-500 p-1"
                                  title={t.assemblies.deleteLayer}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {assembly.layers.length === 0 && (
                          <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-xs">
                            {t.assemblies.noLayers}
                          </div>
                        )}
                      </div>

                      {/* Add Layer and calculations footer */}
                      <div className="flex flex-wrap justify-between items-center gap-3 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleAddLayerToAssembly(assembly.id)}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md text-xs font-bold flex items-center gap-1 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> {t.assemblies.addLayerBtn}
                        </button>

                        {/* Thermal summary */}
                        <div className="text-xs space-y-1 text-slate-500 text-right font-medium">
                          <div>
                            {t.assemblies.sumLayers}: <span className="font-mono text-slate-700 font-bold font-mono">
                              {assembly.layers.reduce((sum, l) => sum + calculateLayerResistance(l, materials), 0).toFixed(3)} m²K/W
                            </span>
                          </div>
                          <div>
                            {t.assemblies.totalResistance}: <span className="font-mono text-slate-700 font-bold font-mono">
                              {(assembly.rsi + assembly.rse + assembly.layers.reduce((sum, l) => sum + calculateLayerResistance(l, materials), 0)).toFixed(3)} m²K/W
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {assemblies.length === 0 && (
          <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
            No assemblies defined yet. Create a Wall, Roof, or Window assembly above to start calculating!
          </div>
        )}
      </div>
    </div>
  );
};
