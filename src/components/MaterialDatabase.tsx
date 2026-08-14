import React, { useState } from 'react';
import { useHeatLossStore, generateUUID } from '../store';
import { Database, Plus, Trash2, HelpCircle } from 'lucide-react';
import type { Material } from '../types';

export const MaterialDatabase: React.FC = () => {
  const materials = useHeatLossStore((state) => state.materials);
  const addMaterial = useHeatLossStore((state) => state.addMaterial);
  const deleteMaterial = useHeatLossStore((state) => state.deleteMaterial);

  // Form states
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Insulation');
  const [lambda, setLambda] = useState<number>(0.04);
  const [searchTerm, setSearchTerm] = useState('');
  const [showHelper, setShowHelper] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || lambda <= 0) return;

    const newMaterial: Material = {
      id: generateUUID(),
      name: name.trim(),
      category,
      design_thermal_conductivity: lambda,
      is_custom: true
    };

    addMaterial(newMaterial);
    setName('');
    // keep category and lambda as good defaults
  };

  const filteredMaterials = materials.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-slate-100 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="text-emerald-600 w-6 h-6" />
          <h2 className="text-xl font-bold text-slate-800">Materials Database</h2>
        </div>
        <button
          onClick={() => setShowHelper(!showHelper)}
          className="text-slate-400 hover:text-emerald-600 transition-colors"
          title="Show material physics guide"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      <p className="text-slate-500 text-sm mb-4">
        Browse common building materials or define your own custom insulating and construction materials.
      </p>

      {/* Physics Guide */}
      {showHelper && (
        <div className="mb-4 p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs leading-relaxed space-y-1">
          <p className="font-bold">Typical Thermal Conductivity (λ_u) values in W/(m·K):</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Insulation (EPS, XPS, Mineral Wool):</strong> 0.030 – 0.045</li>
            <li><strong>Wood & Timber:</strong> 0.12 – 0.18</li>
            <li><strong>Aerated Concrete (Ytong):</strong> 0.10 – 0.20</li>
            <li><strong>Brick Wall (Plná cihla):</strong> 0.70 – 0.85</li>
            <li><strong>Reinforced Concrete:</strong> 1.40 – 1.70</li>
            <li><strong>Steel / Metal:</strong> 50.0 – 60.0 (high thermal bridge)</li>
          </ul>
        </div>
      )}

      {/* Search Input */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search materials by name or category..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-emerald-500 focus:border-emerald-500 text-sm"
        />
      </div>

      {/* Material list */}
      <div className="max-h-56 overflow-y-auto border border-slate-100 rounded-md mb-6 divide-y divide-slate-100">
        {filteredMaterials.map((material) => (
          <div key={material.id} className="p-3 flex items-center justify-between text-sm hover:bg-slate-50 transition-colors">
            <div>
              <div className="font-semibold text-slate-800 flex items-center gap-2">
                {material.name}
                {!material.is_custom && (
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-normal">
                    Built-in
                  </span>
                )}
                {material.is_custom && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-normal">
                    Custom
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">{material.category}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono bg-slate-50 border border-slate-100 px-2 py-0.5 rounded text-xs text-slate-600 font-bold">
                {material.design_thermal_conductivity.toFixed(3)} W/mK
              </span>
              {material.is_custom ? (
                <button
                  onClick={() => deleteMaterial(material.id)}
                  className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors"
                  title="Delete Custom Material"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              ) : (
                <div className="w-6 h-4" /> // placeholder for spacing
              )}
            </div>
          </div>
        ))}
        {filteredMaterials.length === 0 && (
          <div className="p-4 text-center text-slate-400 text-sm">No materials match your search.</div>
        )}
      </div>

      {/* Add Custom Material Form */}
      <form onSubmit={handleSubmit} className="border-t border-slate-100 pt-4">
        <h3 className="text-sm font-bold text-slate-700 mb-3">Add Custom Material</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Material Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Polyurethane board"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-emerald-500 focus:border-emerald-500 bg-white"
            >
              <option value="Insulation">Insulation</option>
              <option value="Masonry">Masonry</option>
              <option value="Concrete">Concrete</option>
              <option value="Wood">Wood & Timber</option>
              <option value="Plasters">Plasters & Finishes</option>
              <option value="Others">Others</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-medium text-slate-500">
                Cond. λ_u (W/m·K)
              </label>
            </div>
            <input
              type="number"
              step="0.001"
              min="0.001"
              max="10"
              required
              value={lambda}
              onChange={(e) => setLambda(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-xs font-mono focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={!name.trim() || lambda <= 0}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-md text-xs font-semibold flex items-center gap-1 transition-colors h-[31px]"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Material
          </button>
        </div>
      </form>
    </div>
  );
};
