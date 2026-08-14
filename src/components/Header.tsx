import React, { useRef } from 'react';
import { useHeatLossStore } from '../store';
import { FileDown, FileUp, RotateCcw, Flame, CheckCircle } from 'lucide-react';
import type { ProjectState } from '../types';

export const Header: React.FC = () => {
  const loadProject = useHeatLossStore((st) => st.loadProject);
  const resetProject = useHeatLossStore((st) => st.resetProject);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Serialize and download project state as a .json file
  const handleSaveProject = () => {
    // Access store snapshot on demand without subscription
    const currentStore = useHeatLossStore.getState();
    const stateToSave = {
      materials: currentStore.materials,
      assemblies: currentStore.assemblies,
      envelope_elements: currentStore.envelope_elements,
      environmental_settings: currentStore.environmental_settings,
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(stateToSave, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);

    // date-stamp filename
    const dateStamp = new Date().toISOString().slice(0, 10);
    downloadAnchor.setAttribute("download", `tepelne_ztraty_project_${dateStamp}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Upload and parse project state
  const handleLoadProject = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as ProjectState;

        // Basic schema verification
        if (!parsed.environmental_settings || !parsed.assemblies || !parsed.materials) {
          alert("Invalid project file! Missing core parameters.");
          return;
        }

        loadProject(parsed);
        alert("Project loaded successfully!");
      } catch (err) {
        alert("Failed to parse JSON file!");
        console.error(err);
      }
    };

    reader.readAsText(file);
    // Reset file input value so same file can be uploaded again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset the project to original demo defaults? This will erase custom materials and layers.")) {
      resetProject();
    }
  };

  return (
    <header className="bg-white border-b border-slate-100 py-4 px-6 md:px-8 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Logo and Titles */}
        <div className="flex items-center gap-3">
          <div className="bg-red-500 text-white p-2 rounded-xl shadow-md">
            <Flame className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight m-0 leading-none">
                Tepelné ztráty budovy
              </h1>
              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                v1.1
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Building Heat Loss Calculator • Decoupled Physics Engine (EN 12831 Compliant Method)
            </p>
          </div>
        </div>

        {/* Control Action Buttons & Status Badge */}
        <div className="flex flex-wrap items-center gap-3">
          {/* 3D-Link status indicator */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-emerald-800 text-[11px] font-bold shadow-inner" title="Architectural Decoupling active: Every element uses unique UUIDs which can map perfectly to future 3D meshes inside three.js webgl engine.">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>3D Mesh Link Ready (UUIDs Active)</span>
          </div>

          <button
            onClick={handleSaveProject}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <FileDown className="w-4 h-4" />
            Save Project (JSON)
          </button>

          <label className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm">
            <FileUp className="w-4 h-4 text-slate-500" />
            Load Project
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleLoadProject}
              className="hidden"
            />
          </label>

          <button
            onClick={handleReset}
            className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Defaults
          </button>
        </div>
      </div>
    </header>
  );
};
