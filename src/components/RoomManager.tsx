import React, { useState } from 'react';
import { useHeatLossStore, generateUUID } from '../store';
import type { Storey, Room } from '../types';
import { calculateRoomTotalLoss, calculateStoreyHeatLoss } from '../mathEngine';
import { Layers, Home, Plus, Trash2, Building, Thermometer, Wind } from 'lucide-react';
import { useTranslate } from '../hooks/useTranslate';

export const RoomManager: React.FC = () => {
  const { t } = useTranslate();

  const storeys = useHeatLossStore((state) => state.storeys);
  const rooms = useHeatLossStore((state) => state.rooms);
  const elements = useHeatLossStore((state) => state.envelope_elements);
  const assemblies = useHeatLossStore((state) => state.assemblies);
  const materials = useHeatLossStore((state) => state.materials);
  const settings = useHeatLossStore((state) => state.environmental_settings);

  const addStorey = useHeatLossStore((state) => state.addStorey);
  const deleteStorey = useHeatLossStore((state) => state.deleteStorey);

  const addRoom = useHeatLossStore((state) => state.addRoom);
  const updateRoom = useHeatLossStore((state) => state.updateRoom);
  const deleteRoom = useHeatLossStore((state) => state.deleteRoom);

  // New Storey state
  const [newStoreyName, setNewStoreyName] = useState('');
  const [newStoreyLevel, setNewStoreyLevel] = useState<number>(0);

  // New Room state
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomStoreyId, setNewRoomStoreyId] = useState('');
  const [newRoomWidth, setNewRoomWidth] = useState<number | ''>(5);
  const [newRoomLength, setNewRoomLength] = useState<number | ''>(4);
  const [newRoomArea, setNewRoomArea] = useState<number>(20);
  const [newRoomHeight, setNewRoomHeight] = useState<number>(2.7);
  const [newRoomTInt, setNewRoomTInt] = useState<number>(20);
  const [newRoomAirExchange, setNewRoomAirExchange] = useState<number>(0.5);

  const handleWidthChange = (val: number | '') => {
    setNewRoomWidth(val);
    if (typeof val === 'number' && val > 0 && typeof newRoomLength === 'number' && newRoomLength > 0) {
      setNewRoomArea(Math.round(val * newRoomLength * 100) / 100);
    }
  };

  const handleLengthChange = (val: number | '') => {
    setNewRoomLength(val);
    if (typeof val === 'number' && val > 0 && typeof newRoomWidth === 'number' && newRoomWidth > 0) {
      setNewRoomArea(Math.round(val * newRoomWidth * 100) / 100);
    }
  };

  const handleCreateStorey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreyName.trim()) return;

    const newStorey: Storey = {
      id: generateUUID(),
      name: newStoreyName.trim(),
      level_z: newStoreyLevel
    };

    addStorey(newStorey);
    setNewStoreyName('');
    setNewStoreyLevel((prev) => prev + 3); // auto-increment level Z for next floor
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    const storeyId = newRoomStoreyId || storeys[0]?.id || '';

    const newRoom: Room = {
      id: generateUUID(),
      name: newRoomName.trim(),
      storey_id: storeyId,
      width: typeof newRoomWidth === 'number' && newRoomWidth > 0 ? newRoomWidth : undefined,
      length: typeof newRoomLength === 'number' && newRoomLength > 0 ? newRoomLength : undefined,
      area: Math.max(0.1, newRoomArea),
      height: Math.max(1, newRoomHeight),
      t_int: newRoomTInt,
      air_exchange_rate: Math.max(0, newRoomAirExchange)
    };

    addRoom(newRoom);
    setNewRoomName('');
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-slate-100 h-full space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Building className="text-indigo-600 w-6 h-6" />
          <h2 className="text-xl font-bold text-slate-800">{t.hierarchy.title}</h2>
        </div>
        <p className="text-slate-500 text-sm">
          {t.hierarchy.desc}
        </p>
      </div>

      {/* Storeys & Rooms Creation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Storeys Section */}
        <div className="lg:col-span-5 bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Layers className="text-indigo-500 w-4 h-4" />
              <h3 className="text-sm font-bold text-slate-700">{t.hierarchy.storeysTitle}</h3>
            </div>

            {/* Storey Form */}
            <form onSubmit={handleCreateStorey} className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  required
                  placeholder="e.g. 2.NP / 1st Floor"
                  value={newStoreyName}
                  onChange={(e) => setNewStoreyName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="flex gap-1">
                <input
                  type="number"
                  step="0.5"
                  value={newStoreyLevel}
                  title={t.hierarchy.elevation}
                  onChange={(e) => setNewStoreyLevel(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs font-mono focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-bold shrink-0"
                  title={t.hierarchy.addStorey}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </form>

            {/* Storeys List */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {storeys.map((st) => {
                const loss = calculateStoreyHeatLoss(st.id, rooms, elements, assemblies, materials, settings);
                return (
                  <div
                    key={st.id}
                    className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-800">{st.name}</span>
                      <span className="text-slate-400 text-[11px] ml-2">Z = {st.level_z ?? 0}m</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-indigo-600">
                        {loss.total.toFixed(0)} W
                      </span>
                      <button
                        onClick={() => deleteStorey(st.id)}
                        className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                        title="Delete storey"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {storeys.length === 0 && (
                <p className="text-center text-slate-400 text-xs py-4">{t.hierarchy.noStoreys}</p>
              )}
            </div>
          </div>
        </div>

        {/* Rooms Creator Section */}
        <div className="lg:col-span-7 bg-slate-50 rounded-xl p-4 border border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <Home className="text-indigo-500 w-4 h-4" />
            <h3 className="text-sm font-bold text-slate-700">{t.hierarchy.addRoom}</h3>
          </div>

          <form onSubmit={handleCreateRoom} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">{t.hierarchy.roomName}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1.01 Living Room"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">{t.hierarchy.selectStorey}</label>
                <select
                  value={newRoomStoreyId || (storeys[0]?.id || '')}
                  onChange={(e) => setNewRoomStoreyId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-indigo-500 bg-white"
                >
                  {storeys.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                  {storeys.length === 0 && (
                    <option value="">{t.hierarchy.unassignedStorey}</option>
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">{t.hierarchy.width}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="e.g. 5"
                  value={newRoomWidth}
                  onChange={(e) => handleWidthChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs font-mono focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">{t.hierarchy.length}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="e.g. 4"
                  value={newRoomLength}
                  onChange={(e) => handleLengthChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs font-mono focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">{t.hierarchy.area}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={newRoomArea}
                  onChange={(e) => setNewRoomArea(Math.max(0.1, parseFloat(e.target.value) || 0))}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs font-mono font-bold text-indigo-600 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">{t.hierarchy.height}</label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  value={newRoomHeight}
                  onChange={(e) => setNewRoomHeight(Math.max(1, parseFloat(e.target.value) || 0))}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs font-mono font-bold focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">{t.hierarchy.tInt}</label>
                <input
                  type="number"
                  step="1"
                  value={newRoomTInt}
                  onChange={(e) => setNewRoomTInt(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs font-mono font-bold focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">{t.hierarchy.airExchange}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={newRoomAirExchange}
                  onChange={(e) => setNewRoomAirExchange(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs font-mono font-bold focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-colors mt-2"
            >
              <Plus className="w-4 h-4" />
              {t.hierarchy.addRoom}
            </button>
          </form>
        </div>

      </div>

      {/* Room Heat Loss Breakdown Table */}
      <div>
        <h3 className="text-md font-bold text-slate-800 mb-3">{t.hierarchy.roomHeatLossTableTitle}</h3>
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                <th className="px-4 py-3">{t.hierarchy.tableHeaderRoom}</th>
                <th className="px-4 py-3">{t.hierarchy.tableHeaderStorey}</th>
                <th className="px-4 py-3 text-center">{t.hierarchy.tableHeaderVolume}</th>
                <th className="px-4 py-3 text-center">{t.hierarchy.tableHeaderTInt}</th>
                <th className="px-4 py-3 text-center">{t.hierarchy.tableHeaderAirExchange}</th>
                <th className="px-4 py-3 text-right">{t.hierarchy.tableHeaderPhiT}</th>
                <th className="px-4 py-3 text-right">{t.hierarchy.tableHeaderPhiV}</th>
                <th className="px-4 py-3 text-right">{t.hierarchy.tableHeaderTotal}</th>
                <th className="px-4 py-3 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {rooms.map((room) => {
                const roomVolume = room.area * room.height;
                const loss = calculateRoomTotalLoss(room, elements, assemblies, materials, settings, rooms);

                return (
                  <tr key={room.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Room Name */}
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      <input
                        type="text"
                        value={room.name}
                        onChange={(e) => updateRoom(room.id, { name: e.target.value })}
                        className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 font-semibold text-slate-800 text-sm px-1 py-0.5 w-full outline-none"
                      />
                      {/* Geometric dimensions width x length */}
                      <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-400 font-mono">
                        <span>W:</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          placeholder="-"
                          value={room.width ?? ''}
                          onChange={(e) => {
                            const w = e.target.value === '' ? undefined : parseFloat(e.target.value);
                            const updates: Partial<Room> = { width: w };
                            if (w && room.length) {
                              updates.area = Math.round(w * room.length * 100) / 100;
                            }
                            updateRoom(room.id, updates);
                          }}
                          className="w-12 px-1 py-0.2 bg-white border border-slate-200 rounded text-center text-slate-700 font-semibold"
                        />
                        <span>m × L:</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          placeholder="-"
                          value={room.length ?? ''}
                          onChange={(e) => {
                            const l = e.target.value === '' ? undefined : parseFloat(e.target.value);
                            const updates: Partial<Room> = { length: l };
                            if (l && room.width) {
                              updates.area = Math.round(l * room.width * 100) / 100;
                            }
                            updateRoom(room.id, updates);
                          }}
                          className="w-12 px-1 py-0.2 bg-white border border-slate-200 rounded text-center text-slate-700 font-semibold"
                        />
                        <span>m</span>
                      </div>
                    </td>

                    {/* Storey Selector */}
                    <td className="px-4 py-3">
                      <select
                        value={room.storey_id || ''}
                        onChange={(e) => updateRoom(room.id, { storey_id: e.target.value })}
                        className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        {storeys.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                        <option value="">{t.hierarchy.unassignedStorey}</option>
                      </select>
                    </td>

                    {/* Volume & Area editable */}
                    <td className="px-4 py-3 text-center font-mono text-xs text-slate-600 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1 mb-0.5">
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={room.area}
                          onChange={(e) => updateRoom(room.id, { area: Math.max(0.1, parseFloat(e.target.value) || 0) })}
                          className="w-14 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-center font-bold text-indigo-600"
                        />
                        <span className="text-slate-400 font-sans text-[11px]">m²</span>
                      </div>
                      <span className="font-bold text-slate-700">{roomVolume.toFixed(1)}</span> m³
                      <span className="text-[10px] text-slate-400 block">
                        ({room.area}m² × {room.height}m)
                      </span>
                    </td>

                    {/* Indoor Temp t_int */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 font-mono text-xs">
                        <Thermometer className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <input
                          type="number"
                          step="1"
                          value={room.t_int}
                          onChange={(e) => updateRoom(room.id, { t_int: parseFloat(e.target.value) || 0 })}
                          className="w-12 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-center font-bold text-slate-700"
                        />
                        <span className="text-slate-400">°C</span>
                      </div>
                    </td>

                    {/* Air exchange n */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 font-mono text-xs">
                        <Wind className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={room.air_exchange_rate}
                          onChange={(e) => updateRoom(room.id, { air_exchange_rate: Math.max(0, parseFloat(e.target.value) || 0) })}
                          className="w-12 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-center font-bold text-slate-700"
                        />
                        <span className="text-slate-400">1/h</span>
                      </div>
                    </td>

                    {/* Phi Transmission */}
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">
                      {loss.transmission.toFixed(1)} W
                    </td>

                    {/* Phi Ventilation */}
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-sky-700 whitespace-nowrap">
                      {loss.ventilation.toFixed(1)} W
                    </td>

                    {/* Phi Total */}
                    <td className="px-4 py-3 text-right font-mono text-sm font-black text-indigo-600 whitespace-nowrap">
                      {loss.total.toFixed(1)} W
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => deleteRoom(room.id)}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded transition-colors"
                        title="Delete Room"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {rooms.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center p-8 text-slate-400 text-xs">
                    {t.hierarchy.noRooms}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
