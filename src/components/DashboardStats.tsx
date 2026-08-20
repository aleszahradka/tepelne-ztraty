import React, { useState } from 'react';
import { useHeatLossStore } from '../store';
import {
  calculateTransmissionLoss,
  calculateEffectiveUValue,
  calculateTotalBuildingTransmissionLoss,
  calculateTotalBuildingVentilationLoss
} from '../mathEngine';
import { Flame, Layers, TrendingDown, Filter } from 'lucide-react';
import { useTranslate } from '../hooks/useTranslate';

export const DashboardStats: React.FC = () => {
  const { t } = useTranslate();
  const elements = useHeatLossStore((state) => state.envelope_elements);
  const assemblies = useHeatLossStore((state) => state.assemblies);
  const materials = useHeatLossStore((state) => state.materials);
  const settings = useHeatLossStore((state) => state.environmental_settings);
  const rooms = useHeatLossStore((state) => state.rooms);
  const storeys = useHeatLossStore((state) => state.storeys);

  // View mode for distribution panel ('elements' | 'rooms')
  const [viewMode, setViewMode] = useState<'elements' | 'rooms'>('elements');

  // Filter state for distribution chart
  const [selectedStoreyId, setSelectedStoreyId] = useState<string>('all');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('all');

  // Filter elements according to Storey and Room selection
  const filteredElements = elements.filter((el) => {
    if (selectedRoomId !== 'all') {
      if (selectedRoomId === 'unassigned' && el.room_id) return false;
      if (selectedRoomId !== 'unassigned' && el.room_id !== selectedRoomId) return false;
    }
    if (selectedStoreyId !== 'all') {
      if (!el.room_id) return false;
      const room = rooms.find((r) => r.id === el.room_id);
      if (selectedStoreyId === 'unassigned' && room?.storey_id) return false;
      if (selectedStoreyId !== 'unassigned' && room?.storey_id !== selectedStoreyId) return false;
    }
    return true;
  });

  // Compute transmission losses per filtered element
  const transmissionLosses = filteredElements.map((el) => ({
    id: el.id,
    name: el.name,
    loss: calculateTransmissionLoss(el, assemblies, materials, settings, elements, rooms, storeys),
    area: el.area,
    uEff: calculateEffectiveUValue(el, assemblies, materials)
  }));

  const totalTransmission = calculateTotalBuildingTransmissionLoss(elements, assemblies, materials, settings, rooms, storeys);
  const totalVentilation = calculateTotalBuildingVentilationLoss(rooms, settings);
  const totalLoss = totalTransmission + totalVentilation;

  // Total Envelope Area
  const totalArea = elements.reduce((sum, el) => sum + el.area, 0);

  // Average effective U-Value of the building envelope
  const sumAU = elements.reduce((sum, el) => {
    const uEff = calculateEffectiveUValue(el, assemblies, materials);
    return sum + (el.area * uEff);
  }, 0);
  const avgUValue = totalArea > 0 ? sumAU / totalArea : 0;

  // Percentages for visual bars
  const transmissionPct = totalLoss > 0 ? (totalTransmission / totalLoss) * 100 : 0;
  const ventilationPct = totalLoss > 0 ? (totalVentilation / totalLoss) * 100 : 0;

  // Sorting elements by their heat loss (highest leak first)
  const sortedLeaks = [...transmissionLosses].sort((a, b) => b.loss - a.loss);

  // Room Heat Loss Aggregation (sum of transmission losses of surfaces linked to room_id)
  const roomBreakdown = rooms.map((room) => {
    const roomElements = elements.filter((el) => el.room_id === room.id);
    const roomPhiT = roomElements.reduce((sum, el) => {
      return sum + calculateTransmissionLoss(el, assemblies, materials, settings, elements, rooms, storeys);
    }, 0);
    const roomSharePct = totalTransmission > 0 ? (roomPhiT / totalTransmission) * 100 : 0;
    const storeyName = storeys.find((s) => s.id === room.storey_id)?.name;
    return {
      room,
      storeyName,
      phiT: roomPhiT,
      sharePct: roomSharePct,
      elementCount: roomElements.length
    };
  }).sort((a, b) => b.phiT - a.phiT);

  // Unassigned elements transmission loss aggregation
  const unassignedElements = elements.filter((el) => !el.room_id);
  const unassignedPhiT = unassignedElements.reduce((sum, el) => {
    return sum + calculateTransmissionLoss(el, assemblies, materials, settings, elements, rooms, storeys);
  }, 0);
  const unassignedSharePct = totalTransmission > 0 ? (unassignedPhiT / totalTransmission) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* 1. Large High-Impact Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Total Heat Loss Summary Card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-850 text-white rounded-2xl shadow-xl p-6 relative overflow-hidden border border-slate-800">
          <div className="absolute right-[-10px] bottom-[-10px] opacity-10">
            <Flame className="w-40 h-40" />
          </div>
          <div className="flex justify-between items-start mb-3">
            <div>
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                {t.dashboard.totalLoss}
              </span>
              <h3 className="text-4xl md:text-5xl font-black mt-1 font-mono text-white">
                {(totalLoss / 1000).toFixed(2)} <span className="text-xl font-medium text-slate-200">{t.dashboard.kW}</span>
              </h3>
            </div>
            <div className="bg-red-500/20 p-2.5 rounded-xl border border-red-500/30">
              <Flame className="text-red-500 w-6 h-6 animate-pulse" />
            </div>
          </div>
          <p className="text-xs text-slate-300 font-medium">
            {t.dashboard.tempDiff} {settings.t_int - settings.t_e} K
          </p>
          <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs font-bold text-white block">
                {t.dashboard.transmission} (Φ_T):
              </span>
              <span className="text-lg font-black text-white font-mono block mt-0.5">
                {(totalTransmission / 1000).toFixed(2)} kW
              </span>
            </div>
            <div>
              <span className="text-xs font-bold text-white block">
                {t.dashboard.ventilation} (Φ_V):
              </span>
              <span className="text-lg font-black text-white font-mono block mt-0.5">
                {(totalVentilation / 1000).toFixed(2)} kW
              </span>
            </div>
          </div>
        </div>

        {/* Average Envelope U-Value */}
        <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-100 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                {t.dashboard.avgU}
              </span>
              <h3 className="text-4xl font-black mt-1 font-mono text-indigo-600 font-mono">
                {avgUValue.toFixed(3)}
              </h3>
            </div>
            <div className="bg-indigo-50 p-2.5 rounded-xl border border-indigo-100">
              <Layers className="text-indigo-600 w-6 h-6" />
            </div>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            {t.dashboard.avgUDesc}
          </p>
          <div className="mt-4 pt-3 border-t border-slate-50 text-xs text-slate-400 flex justify-between font-semibold">
            <span>{t.dashboard.totalArea}:</span>
            <span className="font-mono text-slate-700 font-bold font-mono">{totalArea.toFixed(1)} m²</span>
          </div>
        </div>

        {/* Transmission vs Ventilation Ratio */}
        <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                {t.dashboard.mechanicsRatio}
              </span>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                {totalLoss > 0 ? t.dashboard.analyzed : t.dashboard.inactive}
              </span>
            </div>

            <div className="h-4 w-full flex rounded-full overflow-hidden bg-slate-100 mb-4">
              <div
                style={{ width: `${transmissionPct}%` }}
                className="bg-red-500 h-full transition-all duration-300"
                title={`Transmission: ${transmissionPct.toFixed(1)}%`}
              ></div>
              <div
                style={{ width: `${ventilationPct}%` }}
                className="bg-blue-500 h-full transition-all duration-300"
                title={`Ventilation: ${ventilationPct.toFixed(1)}%`}
              ></div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <div className="flex items-center gap-1.5 text-red-600">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0"></span>
                <span>{t.dashboard.transmission}: {transmissionPct.toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-1.5 text-blue-600">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></span>
                <span>{t.dashboard.ventilation}: {ventilationPct.toFixed(0)}%</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
            {t.dashboard.ratioDesc}
          </p>
        </div>
      </div>

      {/* 2. Visual Ranking of Envelope Leak Points with Storey & Room Filters */}
      <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="text-amber-500 w-5 h-5" />
              <h3 className="text-lg font-bold text-slate-800">{t.dashboard.distributionTitle}</h3>
            </div>

            {/* View Switcher: By Elements vs Heat Loss by Room */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('elements')}
                className={`px-3 py-1 font-bold rounded transition-colors ${
                  viewMode === 'elements'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.dashboard.byElements}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('rooms')}
                className={`px-3 py-1 font-bold rounded transition-colors ${
                  viewMode === 'rooms'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.dashboard.heatLossByRoom}
              </button>
            </div>
          </div>

          {/* Storey & Room Filter Bar (visible in 'elements' view mode) */}
          {viewMode === 'elements' && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                <Filter className="w-3.5 h-3.5 text-indigo-600" />
                <select
                  value={selectedStoreyId}
                  onChange={(e) => setSelectedStoreyId(e.target.value)}
                  className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">Všechna podlaží</option>
                  {storeys.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                <Filter className="w-3.5 h-3.5 text-indigo-600" />
                <select
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">Všechny místnosti</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                  <option value="unassigned">Nezařazené</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <p className="text-slate-500 text-sm mb-6">
          {t.dashboard.distributionDesc}
        </p>

        {viewMode === 'elements' ? (
          <div className="space-y-4">
            {sortedLeaks.map((item, idx) => {
              const itemPct = totalLoss > 0 ? (item.loss / totalLoss) * 100 : 0;
              return (
                <div key={item.id} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-mono font-bold w-5">#{idx + 1}</span>
                      <span className="font-bold text-slate-700">{item.name}</span>
                      <span className="text-slate-400 text-[10px]">
                        ({item.area} m² @ U={item.uEff.toFixed(2)})
                      </span>
                    </div>
                    <div className="font-mono font-black text-slate-800 font-mono">
                      {item.loss.toFixed(0)} W <span className="text-slate-400 font-normal text-[10px]">({itemPct.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${itemPct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}

            {totalVentilation > 0 && selectedRoomId === 'all' && selectedStoreyId === 'all' && (
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-mono font-bold w-5">#V</span>
                    <span className="font-bold text-slate-700">{t.dashboard.ventilationAirflow}</span>
                  </div>
                  <div className="font-mono font-black text-slate-800 font-mono">
                    {totalVentilation.toFixed(0)} W <span className="text-slate-400 font-normal text-[10px]">({(totalVentilation/totalLoss * 100).toFixed(1)}%)</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${totalVentilation/totalLoss * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            {filteredElements.length === 0 && (
              <div className="text-center p-6 text-slate-400 text-sm">
                Žádné prvky neodpovídají zvolenému filtru podlaží / místnosti.
              </div>
            )}
          </div>
        ) : (
          /* Room Heat Loss View Mode */
          <div className="space-y-4">
            {roomBreakdown.map((item, idx) => (
              <div key={item.room.id} className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-500 font-mono font-bold w-5">#{idx + 1}</span>
                    <span className="font-bold text-slate-800">{item.room.name}</span>
                    {item.storeyName && (
                      <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-100">
                        {item.storeyName}
                      </span>
                    )}
                  </div>
                  <div className="font-mono font-black text-slate-800">
                    {item.phiT.toFixed(0)} W <span className="text-slate-500 font-bold text-[11px]">({(item.phiT / 1000).toFixed(2)} kW)</span> <span className="text-indigo-600 font-extrabold text-[11px]">({item.sharePct.toFixed(1)}%)</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${item.sharePct}%` }}
                  ></div>
                </div>
              </div>
            ))}

            {unassignedElements.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-mono font-bold w-5">#?</span>
                    <span className="font-bold text-slate-600 italic">{t.dashboard.unassignedElements}</span>
                  </div>
                  <div className="font-mono font-black text-slate-700">
                    {unassignedPhiT.toFixed(0)} W <span className="text-slate-500 font-normal text-[10px]">({(unassignedPhiT / 1000).toFixed(2)} kW)</span> <span className="text-slate-500 font-bold text-[10px]">({unassignedSharePct.toFixed(1)}%)</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-slate-400 h-full rounded-full transition-all duration-300"
                    style={{ width: `${unassignedSharePct}%` }}
                  ></div>
                </div>
              </div>
            )}

            {rooms.length === 0 && unassignedElements.length === 0 && (
              <div className="text-center p-6 text-slate-400 text-sm">
                Zatím nebyly vytvořeny žádné místnosti ani prvky obálky.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
