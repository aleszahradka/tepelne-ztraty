import React, { useState, useEffect } from 'react';
import { useHeatLossStore } from '../store';
import { useTranslate } from '../hooks/useTranslate';
import { generateTypstDocument } from '../typstGenerator';
import { FileText, CheckSquare, Square, ChevronDown, ChevronRight, Download, SlidersHorizontal, FileCode, Loader2 } from 'lucide-react';
import type { ProjectState } from '../types';

const SECTION_KEYS = [
  'summary',
  'environmental',
  'hierarchy',
  'assemblies',
  'envelope',
  'distribution',
  'methodology'
];

const UNASSIGNED_STOREY_KEY = '__unassigned__';

export const ExportManager: React.FC = () => {
  const { t, language } = useTranslate();
  const storeys = useHeatLossStore((st) => st.storeys || []);
  const rooms = useHeatLossStore((st) => st.rooms || []);

  const unassignedRooms = rooms.filter(
    (r) => !r.storey_id || !storeys.some((s) => s.id === r.storey_id)
  );

  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set(SECTION_KEYS));
  const [selectedStoreys, setSelectedStoreys] = useState<Set<string>>(new Set());
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [expandedStoreys, setExpandedStoreys] = useState<Set<string>>(new Set());
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // Initialize selected storeys & rooms when storeys or rooms load/change
  useEffect(() => {
    const storeyIds = new Set(storeys.map((s) => s.id));
    if (unassignedRooms.length > 0) {
      storeyIds.add(UNASSIGNED_STOREY_KEY);
    }
    setSelectedStoreys(storeyIds);
    setSelectedRooms(new Set(rooms.map((r) => r.id)));
    setExpandedStoreys(new Set(storeyIds));
  }, [storeys, rooms]);

  // Section Toggle Handler
  const toggleSection = (key: string) => {
    const next = new Set(selectedSections);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedSections(next);
  };

  // Storey Toggle Handler
  const toggleStorey = (storeyId: string) => {
    const nextStoreys = new Set(selectedStoreys);
    const nextRooms = new Set(selectedRooms);

    const storeyRooms = storeyId === UNASSIGNED_STOREY_KEY
      ? unassignedRooms
      : rooms.filter((r) => r.storey_id === storeyId);

    if (nextStoreys.has(storeyId)) {
      // Unselect storey & all its rooms
      nextStoreys.delete(storeyId);
      storeyRooms.forEach((r) => nextRooms.delete(r.id));
    } else {
      // Select storey & all its rooms
      nextStoreys.add(storeyId);
      storeyRooms.forEach((r) => nextRooms.add(r.id));
    }

    setSelectedStoreys(nextStoreys);
    setSelectedRooms(nextRooms);
  };

  // Room Toggle Handler
  const toggleRoom = (roomId: string, storeyId: string) => {
    const nextRooms = new Set(selectedRooms);
    const nextStoreys = new Set(selectedStoreys);

    if (nextRooms.has(roomId)) {
      nextRooms.delete(roomId);
    } else {
      nextRooms.add(roomId);
    }

    // Check if any room in storey remains selected
    const effectiveStoreyId = storeyId || UNASSIGNED_STOREY_KEY;
    const storeyRooms = effectiveStoreyId === UNASSIGNED_STOREY_KEY
      ? unassignedRooms
      : rooms.filter((r) => r.storey_id === effectiveStoreyId);

    const hasSelectedRoom = storeyRooms.some((r) => nextRooms.has(r.id));

    if (hasSelectedRoom) {
      nextStoreys.add(effectiveStoreyId);
    } else {
      nextStoreys.delete(effectiveStoreyId);
    }

    setSelectedRooms(nextRooms);
    setSelectedStoreys(nextStoreys);
  };

  // Expand/Collapse Storey Node
  const toggleExpand = (storeyId: string) => {
    const next = new Set(expandedStoreys);
    if (next.has(storeyId)) {
      next.delete(storeyId);
    } else {
      next.add(storeyId);
    }
    setExpandedStoreys(next);
  };

  // Select All Convenience Handler
  const handleSelectAll = () => {
    setSelectedSections(new Set(SECTION_KEYS));
    const allStoreyIds = new Set(storeys.map((s) => s.id));
    if (unassignedRooms.length > 0) {
      allStoreyIds.add(UNASSIGNED_STOREY_KEY);
    }
    setSelectedStoreys(allStoreyIds);
    setSelectedRooms(new Set(rooms.map((r) => r.id)));
  };

  // Deselect All Convenience Handler
  const handleDeselectAll = () => {
    setSelectedSections(new Set());
    setSelectedStoreys(new Set());
    setSelectedRooms(new Set());
  };

  // Helper to generate Typst code string
  const getTypstCodeSnapshot = () => {
    const currentStore = useHeatLossStore.getState();
    const stateSnapshot: ProjectState = {
      materials: currentStore.materials,
      assemblies: currentStore.assemblies,
      storeys: currentStore.storeys,
      rooms: currentStore.rooms,
      envelope_elements: currentStore.envelope_elements,
      environmental_settings: currentStore.environmental_settings
    };

    return generateTypstDocument(stateSnapshot, {
      selectedSectionKeys: Array.from(selectedSections),
      selectedStoreyIds: Array.from(selectedStoreys),
      selectedRoomIds: Array.from(selectedRooms),
      lang: language
    });
  };

  // Download Handler for .typ output
  const handleExportTypst = () => {
    const typstContent = getTypstCodeSnapshot();
    const blob = new Blob([typstContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tepelne_ztraty_export.typ';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download Handler for PDF serverless endpoint
  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const typstCode = getTypstCodeSnapshot();
      const response = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typstCode })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Server error during PDF compilation');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Tepelne_Ztraty_Vypocet.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(language === 'cs' ? `Chyba při generování PDF: ${err.message}` : `PDF generation failed: ${err.message}`);
      console.error(err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-xl border border-indigo-100">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              {t.export?.title || "Export dokumentu / Document Export"}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {t.export?.desc || "Nakonfigurujte si rozsah exportovaného protokolu v aplikaci Typst. Můžete zapínat a vypínat jednotlivé sekce i vybraná podlaží a místnosti."}
            </p>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSelectAll}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            {t.export?.selectAll || "Vybrat vše"}
          </button>
          <button
            onClick={handleDeselectAll}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Square className="w-3.5 h-3.5" />
            {t.export?.deselectAll || "Odznačit vše"}
          </button>

          <button
            onClick={handleExportTypst}
            className="px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <FileCode className="w-4 h-4 text-indigo-600" />
            {language === 'cs' ? 'Exportovat do TYPST (.typ)' : 'Export to TYPST (.typ)'}
          </button>

          <button
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isExportingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {language === 'cs' ? 'Exportovat do PDF' : 'Export to PDF'}
          </button>
        </div>
      </div>

      {/* Main Selection Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Web Section Toggles */}
        <div className="lg:col-span-6 bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
            <SlidersHorizontal className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-800">
              {t.export?.sectionsTitle || "Výběr sekcí k exportu"}
            </h3>
          </div>

          <div className="space-y-2">
            {SECTION_KEYS.map((key) => {
              const isChecked = selectedSections.has(key);
              const label = t.export?.sections?.[key as keyof typeof t.export.sections] || key;

              return (
                <label
                  key={key}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
                    isChecked
                      ? 'bg-white border-indigo-200 shadow-sm text-slate-800 font-medium'
                      : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSection(key)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="text-xs leading-tight">{label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Right Column: Hierarchical Storey & Room Selection */}
        <div className="lg:col-span-6 bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
            <SlidersHorizontal className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-800">
              {t.export?.entitiesTitle || "Výběr podlaží a místností"}
            </h3>
          </div>

          <div className="space-y-3">
            {storeys.length === 0 && unassignedRooms.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                {t.hierarchy?.noRooms || "Zatím nebyly vytvořeny žádné místnosti."}
              </p>
            ) : (
              <>
                {/* Defined Storeys */}
                {storeys.map((storey) => {
                  const isStoreyChecked = selectedStoreys.has(storey.id);
                  const isExpanded = expandedStoreys.has(storey.id);
                  const storeyRooms = rooms.filter((r) => r.storey_id === storey.id);

                  return (
                    <div key={storey.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                      {/* Storey Row */}
                      <div className="flex items-center justify-between p-3 bg-slate-100/60 border-b border-slate-200/60">
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() => toggleExpand(storey.id)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                          <input
                            type="checkbox"
                            checked={isStoreyChecked}
                            onChange={() => toggleStorey(storey.id)}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-800">
                            {storey.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            (Z = {storey.level_z}m)
                          </span>
                        </div>
                        <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded-full">
                          {storeyRooms.filter((r) => selectedRooms.has(r.id)).length} / {storeyRooms.length} {t.hierarchy?.roomsTitle || "Místnosti"}
                        </span>
                      </div>

                      {/* Room Level List */}
                      {isExpanded && (
                        <div className="p-2 space-y-1 bg-white">
                          {storeyRooms.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic pl-8 py-1">
                              {t.hierarchy?.noRooms || "Žádné místnosti."}
                            </p>
                          ) : (
                            storeyRooms.map((room) => {
                              const isRoomChecked = selectedRooms.has(room.id);
                              return (
                                <label
                                  key={room.id}
                                  className={`flex items-center justify-between pl-8 pr-3 py-1.5 rounded transition-colors cursor-pointer ${
                                    isRoomChecked
                                      ? 'bg-indigo-50/50 text-slate-800'
                                      : 'text-slate-400 hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <input
                                      type="checkbox"
                                      checked={isRoomChecked}
                                      onChange={() => toggleRoom(room.id, storey.id)}
                                      className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                    />
                                    <span className="text-xs font-medium">
                                      {room.name}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {room.area} m² • {room.t_int}°C
                                  </span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Unassigned Rooms Group */}
                {unassignedRooms.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                    <div className="flex items-center justify-between p-3 bg-slate-100/60 border-b border-slate-200/60">
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => toggleExpand(UNASSIGNED_STOREY_KEY)}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                        >
                          {expandedStoreys.has(UNASSIGNED_STOREY_KEY) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                        <input
                          type="checkbox"
                          checked={selectedStoreys.has(UNASSIGNED_STOREY_KEY)}
                          onChange={() => toggleStorey(UNASSIGNED_STOREY_KEY)}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-800">
                          {t.export?.unassignedStorey || "Bez určeného podlaží"}
                        </span>
                      </div>
                      <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded-full">
                        {unassignedRooms.filter((r) => selectedRooms.has(r.id)).length} / {unassignedRooms.length} {t.hierarchy?.roomsTitle || "Místnosti"}
                      </span>
                    </div>

                    {expandedStoreys.has(UNASSIGNED_STOREY_KEY) && (
                      <div className="p-2 space-y-1 bg-white">
                        {unassignedRooms.map((room) => {
                          const isRoomChecked = selectedRooms.has(room.id);
                          return (
                            <label
                              key={room.id}
                              className={`flex items-center justify-between pl-8 pr-3 py-1.5 rounded transition-colors cursor-pointer ${
                                isRoomChecked
                                  ? 'bg-indigo-50/50 text-slate-800'
                                  : 'text-slate-400 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={isRoomChecked}
                                  onChange={() => toggleRoom(room.id, '')}
                                  className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                />
                                <span className="text-xs font-medium">
                                  {room.name}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {room.area} m² • {room.t_int}°C
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
