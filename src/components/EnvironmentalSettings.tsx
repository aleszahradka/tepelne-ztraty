import React from 'react';
import { useHeatLossStore } from '../store';
import { Thermometer, Home, Wind, Info } from 'lucide-react';
import { calculateVentilationLoss } from '../mathEngine';
import { useTranslate } from '../hooks/useTranslate';

export const EnvironmentalSettingsPanel: React.FC = () => {
  const { t } = useTranslate();
  const settings = useHeatLossStore((state) => state.environmental_settings);
  const updateSettings = useHeatLossStore((state) => state.updateEnvironmentalSettings);

  const phiV = calculateVentilationLoss(settings);

  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-slate-100 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Thermometer className="text-blue-600 w-6 h-6" />
        <h2 className="text-xl font-bold text-slate-800">{t.environmental.title}</h2>
      </div>

      <p className="text-slate-500 text-sm mb-6">
        {t.environmental.desc}
      </p>

      <div className="space-y-5">
        {/* Indoor Temperature */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
              {t.environmental.indoorTemp} (<span className="italic">t_int</span>)
            </label>
            <span className="text-sm font-bold text-blue-600">{settings.t_int} °C</span>
          </div>
          <div className="flex gap-4 items-center">
            <input
              type="range"
              min="15"
              max="28"
              step="0.5"
              value={settings.t_int}
              onChange={(e) => updateSettings({ t_int: parseFloat(e.target.value) })}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <input
              type="number"
              value={settings.t_int}
              onChange={(e) => updateSettings({ t_int: parseFloat(e.target.value) || 0 })}
              className="w-20 text-right px-2 py-1 text-sm border border-slate-200 rounded bg-slate-50"
            />
          </div>
        </div>

        {/* Outdoor Temperature */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm font-medium text-slate-700">
              {t.environmental.outdoorTemp} (<span className="italic">t_e</span>)
            </label>
            <span className="text-sm font-bold text-sky-600">{settings.t_e} °C</span>
          </div>
          <div className="flex gap-4 items-center">
            <input
              type="range"
              min="-25"
              max="15"
              step="0.5"
              value={settings.t_e}
              onChange={(e) => updateSettings({ t_e: parseFloat(e.target.value) })}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
            />
            <input
              type="number"
              value={settings.t_e}
              onChange={(e) => updateSettings({ t_e: parseFloat(e.target.value) || 0 })}
              className="w-20 text-right px-2 py-1 text-sm border border-slate-200 rounded bg-slate-50"
            />
          </div>
        </div>

        {/* Room Volume */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
              <Home className="w-4 h-4 text-slate-400" />
              {t.environmental.volumeLabel}
            </label>
            <span className="text-xs text-slate-400">m³</span>
          </div>
          <div className="relative rounded-md shadow-sm">
            <input
              type="number"
              min="0"
              step="1"
              value={settings.room_volume}
              onChange={(e) => updateSettings({ room_volume: Math.max(0, parseFloat(e.target.value) || 0) })}
              className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="e.g. 150"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-slate-400 text-xs">m³</span>
            </div>
          </div>
        </div>

        {/* Air Exchange Rate */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
              <Wind className="w-4 h-4 text-slate-400" />
              {t.environmental.airExchange}
            </label>
            <span className="text-xs text-slate-400">1/h</span>
          </div>
          <div className="flex gap-4 items-center">
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.air_exchange_rate}
              onChange={(e) => updateSettings({ air_exchange_rate: parseFloat(e.target.value) })}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <input
              type="number"
              min="0"
              step="0.05"
              value={settings.air_exchange_rate}
              onChange={(e) => updateSettings({ air_exchange_rate: Math.max(0, parseFloat(e.target.value) || 0) })}
              className="w-20 text-right px-2 py-1 text-sm border border-slate-200 rounded bg-slate-50"
            />
          </div>
        </div>

        {/* Calculation Result Preview */}
        <div className="mt-6 pt-5 border-t border-slate-100 bg-slate-50 rounded-lg p-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-slate-600">{t.environmental.tempDiffShort}:</span>
            <span className="text-sm font-bold text-slate-800">
              {settings.t_int - settings.t_e} K
            </span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm font-medium text-slate-600">{t.environmental.ventilationLossShort}:</span>
            <span className="text-md font-extrabold text-blue-600">
              {phiV.toFixed(1)} W
            </span>
          </div>
          <div className="mt-2 flex items-start gap-1.5 text-xs text-slate-400">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              {t.environmental.formulaHint}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};
