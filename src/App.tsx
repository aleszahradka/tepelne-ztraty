import { Header } from './components/Header';
import { EnvironmentalSettingsPanel } from './components/EnvironmentalSettings';
import { MaterialDatabase } from './components/MaterialDatabase';
import { AssemblyBuilder } from './components/AssemblyBuilder';
import { EnvelopeManager } from './components/EnvelopeManager';
import { DashboardStats } from './components/DashboardStats';

function App() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Dynamic Serialization and Control Header */}
      <Header />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 space-y-6">

        {/* Real-time Dashboard Summary Statistics */}
        <section id="results-dashboard">
          <DashboardStats />
        </section>

        {/* Dynamic 2-Column Physical Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Left Column: Environmental Settings & Raw Material Database */}
          <div className="lg:col-span-4 space-y-6">
            <section id="environmental-settings">
              <EnvironmentalSettingsPanel />
            </section>

            <section id="materials-database">
              <MaterialDatabase />
            </section>
          </div>

          {/* Right Column: 1D Assembly builder & Envelope configuration */}
          <div className="lg:col-span-8 space-y-6">
            <section id="assembly-builder">
              <AssemblyBuilder />
            </section>

            <section id="envelope-manager">
              <EnvelopeManager />
            </section>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-center py-6 border-t border-slate-800 text-xs mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} Tepelné ztráty budovy. Prepared for 3D color-coded WebGL heatmap overlays.</p>
          <div className="flex gap-4">
            <span className="hover:text-white transition-colors cursor-pointer">EN 12831 Calculator</span>
            <span className="text-slate-700">|</span>
            <span className="hover:text-white transition-colors cursor-pointer">Pinia / Zustand Decoupled State</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
