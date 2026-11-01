import React, { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { CollectiveSphere } from './components/CollectiveSphere';
import { ChatPanel } from './components/ChatPanel';
import { StaticCouncilBoard } from './components/StaticCouncilBoard';
import { useStore } from './store';
import { 
  Columns, 
  LayoutTemplate, 
  Globe2, 
  Pause, 
  Play, 
  Award, 
  ExternalLink 
} from 'lucide-react';

export default function App() {
  const [isPopout, setIsPopout] = useState(false);

  const mainViewMode = useStore((state) => state.mainViewMode);
  const setMainViewMode = useStore((state) => state.setMainViewMode);
  const isSphereRotationPaused = useStore((state) => state.isSphereRotationPaused);
  const toggleSphereRotation = useStore((state) => state.toggleSphereRotation);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('popout') === 'board') {
        setIsPopout(true);
      }
    }
  }, []);

  // Jeśli otworzono jako odpięte okno pulpitu (Popout / PiP)
  if (isPopout) {
    return (
      <div className="h-screen w-full bg-[#050b14] overflow-hidden">
        <StaticCouncilBoard isPopout={true} />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-black overflow-hidden font-sans text-white">
      {/* LEWY PANEL BOCZNY: Czat / Wyznaczony Spiker / Most Pulpitu UI-TARS */}
      <div className="w-80 md:w-[420px] lg:w-[440px] flex-shrink-0 z-20 h-full relative shadow-[0_0_30px_rgba(0,0,0,0.8)] border-r border-cyan-950">
        <ChatPanel />
      </div>

      {/* GŁÓWNY OBSZAR ROBOCZY: TABLICA STATYCZNA & SFERA 3D */}
      <div className="flex-1 h-full flex flex-col overflow-hidden bg-[#02050b]">
        {/* GÓRNY PASEK WYBORU WIDOKU & KONTROLI OBROTU OMNISTAR */}
        <div className="bg-[#071322] border-b border-cyan-900/80 px-3 py-2 flex flex-wrap items-center justify-between gap-2 z-10 shrink-0">
          {/* Przełącznik widoków */}
          <div className="flex items-center gap-1.5 p-1 bg-black/60 rounded-lg border border-cyan-900/70 text-xs font-mono">
            <button
              onClick={() => setMainViewMode('split')}
              className={`px-2.5 py-1 rounded flex items-center gap-1.5 cursor-pointer font-bold transition-all ${
                mainViewMode === 'split'
                  ? 'bg-cyan-950 text-cyan-200 border border-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                  : 'text-gray-400 hover:text-cyan-300'
              }`}
            >
              <Columns size={13} />
              <span>Podgląd Dzielony (Tablica + 3D)</span>
            </button>

            <button
              onClick={() => setMainViewMode('board')}
              className={`px-2.5 py-1 rounded flex items-center gap-1.5 cursor-pointer font-bold transition-all ${
                mainViewMode === 'board'
                  ? 'bg-amber-950 text-amber-200 border border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                  : 'text-gray-400 hover:text-amber-300'
              }`}
            >
              <LayoutTemplate size={13} />
              <span>Wspólna Tablica Rady (Brak Obrotu)</span>
            </button>

            <button
              onClick={() => setMainViewMode('3d')}
              className={`px-2.5 py-1 rounded flex items-center gap-1.5 cursor-pointer font-bold transition-all ${
                mainViewMode === '3d'
                  ? 'bg-emerald-950 text-emerald-200 border border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                  : 'text-gray-400 hover:text-emerald-300'
              }`}
            >
              <Globe2 size={13} />
              <span>Sfera 3D Omnistar</span>
            </button>
          </div>

          {/* Szybka kontrola obrotu Omnistar & Status Wspólnej Grupy */}
          <div className="flex items-center gap-2">
            <div className="hidden xl:flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-800/80 px-2 py-1 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span>Wspólna Grupa: 9 Modeli odbiera pytania jednocześnie</span>
            </div>

            <button
              onClick={toggleSphereRotation}
              title={isSphereRotationPaused ? "Wznów powolną rotację Omnistar" : "Zatrzymaj obrót sfery (stabilność tekstu)"}
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                isSphereRotationPaused
                  ? 'bg-amber-950/90 text-amber-200 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                  : 'bg-cyan-950/60 text-cyan-300 border-cyan-800 hover:bg-cyan-900'
              }`}
            >
              {isSphereRotationPaused ? <Pause size={12} className="text-amber-400" /> : <Play size={12} className="text-emerald-400" />}
              <span>{isSphereRotationPaused ? 'Obrót 3D: ZATRZYMANY' : 'Obrót 3D: PŁYNNY'}</span>
            </button>
          </div>
        </div>

        {/* ZAWARTOŚĆ GŁÓWNA W ZALEŻNOŚCI OD TRYBU */}
        <div className="flex-1 h-full overflow-hidden flex flex-col">
          {/* TRYB 1: TYLKO PŁASKA WSPÓLNA TABLICA (BRAK OBROTU) */}
          {mainViewMode === 'board' && (
            <div className="flex-1 h-full overflow-hidden">
              <StaticCouncilBoard />
            </div>
          )}

          {/* TRYB 2: PODGLĄD DZIELONY (TABLICA STATYCZNA PO LEWEJ, SFERA 3D PO PRAWEJ) */}
          {mainViewMode === 'split' && (
            <div className="flex-1 h-full flex flex-col lg:flex-row overflow-hidden">
              {/* Lewa część dzielona: Płaska Tablica Rady */}
              <div className="flex-1 h-full overflow-hidden border-b lg:border-b-0 lg:border-r border-cyan-950">
                <StaticCouncilBoard />
              </div>

              {/* Prawa część dzielona: 3D Omnistar Canvas */}
              <div className="w-full lg:w-[480px] xl:w-[560px] h-64 lg:h-full relative cursor-crosshair shrink-0 bg-[#000510]">
                <div className="absolute top-3 right-3 z-10 bg-black/70 backdrop-blur px-2.5 py-1 border border-cyan-900/60 rounded text-[10px] font-mono text-cyan-400 pointer-events-none">
                  LPM: Obrót | PPM: Pan | Scroll: Zoom
                </div>
                
                <Canvas camera={{ position: [0, 0, 30], fov: 45 }}>
                  <color attach="background" args={['#000510']} />
                  <ambientLight intensity={0.2} />
                  <pointLight position={[10, 10, 10]} intensity={1} color="#00ffff" />
                  <pointLight position={[-10, -10, -10]} intensity={0.5} color="#00ff00" />
                  
                  <Suspense fallback={null}>
                    <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
                    <CollectiveSphere />
                  </Suspense>
                  
                  <OrbitControls 
                    enablePan={true}
                    enableZoom={true}
                    enableRotate={true}
                    autoRotate={false}
                    maxDistance={80}
                    minDistance={5}
                  />
                </Canvas>
              </div>
            </div>
          )}

          {/* TRYB 3: PEŁNA SFERA 3D OMNISTAR */}
          {mainViewMode === '3d' && (
            <div className="flex-1 h-full relative cursor-crosshair">
              <div className="absolute top-4 right-4 z-10 bg-black/60 backdrop-blur px-3 py-1.5 border border-cyan-900/60 rounded text-xs font-mono text-cyan-400 flex items-center gap-3">
                <span>LPM: Obrót | PPM: Przesunięcie | Scroll: Zoom</span>
                <button
                  onClick={toggleSphereRotation}
                  className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-200 border border-amber-600 font-bold hover:bg-amber-900 cursor-pointer"
                >
                  {isSphereRotationPaused ? 'Wznów obrót' : 'Zatrzymaj obrót'}
                </button>
              </div>
              
              <Canvas camera={{ position: [0, 0, 30], fov: 45 }}>
                <color attach="background" args={['#000510']} />
                <ambientLight intensity={0.2} />
                <pointLight position={[10, 10, 10]} intensity={1} color="#00ffff" />
                <pointLight position={[-10, -10, -10]} intensity={0.5} color="#00ff00" />
                
                <Suspense fallback={null}>
                  <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
                  <CollectiveSphere />
                </Suspense>
                
                <OrbitControls 
                  enablePan={true}
                  enableZoom={true}
                  enableRotate={true}
                  autoRotate={false}
                  maxDistance={80}
                  minDistance={5}
                />
              </Canvas>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
