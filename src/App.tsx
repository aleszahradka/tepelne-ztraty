import { Header } from './components/Header';
import { EnvironmentalSettingsPanel } from './components/EnvironmentalSettings';
import { MaterialDatabase } from './components/MaterialDatabase';
import { AssemblyBuilder } from './components/AssemblyBuilder';
import { EnvelopeManager } from './components/EnvelopeManager';
import { ExportManager } from './components/ExportManager';
import { RoomManager } from './components/RoomManager';
import { DashboardStats } from './components/DashboardStats';
import { BuildingViewer3D } from './components/BuildingViewer3D';
import { useTranslate } from './hooks/useTranslate';

function App() {
  const { t } = useTranslate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Dynamic Serialization and Control Header */}
      <Header />

      {/* Main Full-Width Container */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 md:p-6 lg:p-8 space-y-8">

        {/* Real-time Dashboard Summary Statistics */}
        <section id="results-dashboard">
          <DashboardStats />
        </section>

        {/* 3D Building WebGL Viewport & Thermal Heatmap */}
        <section id="building-viewer-3d">
          <BuildingViewer3D />
        </section>

        {/* Upper Full-Width Section: Environmental Settings & Material Database */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section id="environmental-settings" className="lg:col-span-5">
            <EnvironmentalSettingsPanel />
          </section>

          <section id="materials-database" className="lg:col-span-7">
            <MaterialDatabase />
          </section>
        </div>

        {/* Lower Full-Width Section: Building Hierarchy, Assemblies, Envelope Manager & Typst Export */}
        <div className="space-y-8">
          <section id="room-manager">
            <RoomManager />
          </section>

          <section id="assembly-builder">
            <AssemblyBuilder />
          </section>

          <section id="envelope-manager">
            <EnvelopeManager />
          </section>

          <section id="export-manager">
            <ExportManager />
          </section>
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-center py-6 border-t border-slate-800 text-xs mt-12">
        <div className="max-w-[1600px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} {t.footer.text}</p>
          <div className="flex gap-4">
            <span className="hover:text-white transition-colors cursor-pointer">{t.footer.method}</span>
            <span className="text-slate-700">|</span>
            <span className="hover:text-white transition-colors cursor-pointer">{t.footer.decoupled}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
