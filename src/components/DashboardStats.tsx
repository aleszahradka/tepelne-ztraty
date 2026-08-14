import React from 'react';
import { useHeatLossStore } from '../store';
import { calculateTransmissionLoss, calculateVentilationLoss, calculateEffectiveUValue } from '../mathEngine';
import { Flame, Layers, TrendingDown } from 'lucide-react';
import { useTranslate } from '../hooks/useTranslate';

export const DashboardStats: React.FC = () => {
  const { t } = useTranslate();
  const elements = useHeatLossStore((state) => state.envelope_elements);
  const assemblies = useHeatLossStore((state) => state.assemblies);
  const materials = useHeatLossStore((state) => state.materials);
  const settings = useHeatLossStore((state) => state.environmental_settings);

  // Compute transmission losses per element and total
  const transmissionLosses = elements.map((el) => ({
    id: el.id,
    name: el.name,
    loss: calculateTransmissionLoss(el, assemblies, materials, settings),
    area: el.area,
    uEff: calculateEffectiveUValue(el, assemblies, materials)
  }));

  const totalTransmission = transmissionLosses.reduce((sum, item) => sum + item.loss, 0);
  const totalVentilation = calculateVentilationLoss(settings);
  const totalLoss = totalTransmission + totalVentilation;

  // Total Envelope Area
  const totalArea = elements.reduce((sum, el) => sum + el.area, 0);

  // Average effective U-Value of the building envelope: (Sum of A * U_eff) / Sum of A
  const sumAU = elements.reduce((sum, el) => {
    const uEff = calculateEffectiveUValue(el, assemblies, materials);
    return sum + (el.area * uEff);
  }, 0);
  const avgUValue = totalArea > 0 ? sumAU / totalArea : 0;

  // Percentages for beautiful visual bars
  const transmissionPct = totalLoss > 0 ? (totalTransmission / totalLoss) * 100 : 0;
  const ventilationPct = totalLoss > 0 ? (totalVentilation / totalLoss) * 100 : 0;

  // Sorting elements by their heat loss (highest leak first)
  const sortedLeaks = [...transmissionLosses].sort((a, b) => b.loss - a.loss);

  return (
    <div className="space-y-6">
      {/* 1. Large High-Impact Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Total Heat Loss */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-850 text-white rounded-2xl shadow-xl p-6 relative overflow-hidden border border-slate-800">
          <div className="absolute right-[-10px] bottom-[-10px] opacity-10">
            <Flame className="w-40 h-40" />
          </div>
          <div className="flex justify-between items-start mb-3">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                {t.dashboard.totalLoss}
              </span>
              <h3 className="text-4xl font-black mt-1 font-mono">
                {(totalLoss / 1000).toFixed(2)} <span className="text-xl font-medium">{t.dashboard.kW}</span>
              </h3>
            </div>
            <div className="bg-red-500/20 p-2.5 rounded-xl border border-red-500/30">
              <Flame className="text-red-500 w-6 h-6 animate-pulse" />
            </div>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            {t.dashboard.tempDiff} {settings.t_int - settings.t_e} K
          </p>
          <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between text-xs text-slate-400 font-semibold">
            <span>{t.dashboard.transmission}: {(totalTransmission / 1000).toFixed(2)} kW</span>
            <span>{t.dashboard.ventilation}: {(totalVentilation / 1000).toFixed(2)} kW</span>
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

            {/* Visual ratio bar */}
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

      {/* 2. Visual Ranking of Envelope Leak Points */}
      <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="text-amber-500 w-5 h-5" />
          <h3 className="text-lg font-bold text-slate-800">{t.dashboard.distributionTitle}</h3>
        </div>

        <p className="text-slate-500 text-sm mb-6">
          {t.dashboard.distributionDesc}
        </p>

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
                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${itemPct}%` }}
                  ></div>
                </div>
              </div>
            );
          })}

          {totalVentilation > 0 && (
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

          {elements.length === 0 && (
            <div className="text-center p-6 text-slate-400 text-sm">
              Define envelope surfaces to render loss distribution rankings.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
