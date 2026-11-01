import React, { useState, useRef, useEffect } from 'react';
import { useStore, PERMANENT_COUNCIL_MODELS } from '../store';
import { 
  Award, 
  Send, 
  RotateCw, 
  Pause, 
  Play, 
  ExternalLink, 
  Download, 
  Trash2, 
  Eye, 
  Sparkles, 
  Terminal, 
  CheckCircle2, 
  Monitor, 
  Cpu, 
  HelpCircle,
  Copy,
  Check,
  Target,
  Layers,
  Zap,
  AlertTriangle,
  RefreshCw,
  Plus,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Edit3,
  ShieldAlert
} from 'lucide-react';

interface StaticCouncilBoardProps {
  isPopout?: boolean;
}

export const StaticCouncilBoard: React.FC<StaticCouncilBoardProps> = ({ isPopout = false }) => {
  const councilBoardItems = useStore((state) => state.councilBoardItems);
  const designatedSpeakerId = useStore((state) => state.designatedSpeakerId);
  const setDesignatedSpeakerId = useStore((state) => state.setDesignatedSpeakerId);
  const isSphereRotationPaused = useStore((state) => state.isSphereRotationPaused);
  const toggleSphereRotation = useStore((state) => state.toggleSphereRotation);
  const clearCouncilBoard = useStore((state) => state.clearCouncilBoard);
  const sendCouncilDeliberation = useStore((state) => state.sendCouncilDeliberation);
  const councilBoardFilter = useStore((state) => state.councilBoardFilter);
  const setCouncilBoardFilter = useStore((state) => state.setCouncilBoardFilter);

  // Protokół Zasprzęglania i Rejestr Kamieni Milowych (Węzeł Zero)
  const milestoneLedger = useStore((state) => state.milestoneLedger);
  const setMainGoal = useStore((state) => state.setMainGoal);
  const setCurrentVector = useStore((state) => state.setCurrentVector);
  const addMilestone = useStore((state) => state.addMilestone);
  const toggleMilestone = useStore((state) => state.toggleMilestone);
  const completeAndPurgeMilestone = useStore((state) => state.completeAndPurgeMilestone);
  const triggerRelayHandover = useStore((state) => state.triggerRelayHandover);

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showDesktopHelp, setShowDesktopHelp] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  // UI State dla Rejestru Kamieni Milowych
  const [isLedgerExpanded, setIsLedgerExpanded] = useState(true);
  const [newMilestoneText, setNewMilestoneText] = useState('');
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');
  const [isEditingVector, setIsEditingVector] = useState(false);
  const [vectorDraft, setVectorDraft] = useState('');

  const boardEndRef = useRef<HTMLDivElement>(null);
  const activeSpeaker = PERMANENT_COUNCIL_MODELS.find(m => m.id === designatedSpeakerId) || PERMANENT_COUNCIL_MODELS[0];
  useEffect(() => {
    if (autoScroll && boardEndRef.current) {
      boardEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [councilBoardItems, autoScroll]);

  // Inicjalizacja wpisów z API oraz WebSocket Live Sync
  useEffect(() => {
    // 1. Pobierz aktualny stan tablicy z serwera
    fetch('/api/council/board')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.items)) {
          data.items.forEach((item: any) => {
            useStore.getState().addCouncilBoardItem(item);
          });
        }
      })
      .catch(() => {});

    // 2. Połączenie WebSocket na żywo
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      const ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'council_board_item' && payload.data) {
            useStore.getState().addCouncilBoardItem(payload.data);
          } else if (payload.type === 'council_board_init' && Array.isArray(payload.items)) {
            payload.items.forEach((item: any) => {
              useStore.getState().addCouncilBoardItem(item);
            });
          }
        } catch {
          // Non-json
        }
      };

      return () => {
        ws.close();
      };
    } catch (e) {
      console.warn('Błąd WebSocket w Tablicy:', e);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;
    const text = input.trim();
    setInput('');
    setIsSending(true);

    try {
      await sendCouncilDeliberation(text);
    } catch (err) {
      console.error('Błąd wysyłania dyrektywy na tablicę:', err);
    } finally {
      setIsSending(false);
    }
  };

  const downloadDesktopAgent = () => {
    const a = document.createElement('a');
    a.href = '/api/desktop-agent.py';
    a.download = 'omnistar_desktop_agent.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadPythonWidget = () => {
    const a = document.createElement('a');
    a.href = '/api/council/desktop-widget.py';
    a.download = 'desktop_board.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyWidgetCommand = () => {
    navigator.clipboard.writeText('pip install pyautogui websocket-client pillow && python omnistar_desktop_agent.py');
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  // Filtrowanie wpisów
  const filteredItems = councilBoardItems.filter((item) => {
    if (councilBoardFilter === 'directives') return item.type === 'user_directive';
    if (councilBoardFilter === 'speaker') return item.type === 'speaker_response';
    if (councilBoardFilter === 'deliberations') return item.type === 'deliberation';
    return true;
  });

  return (
    <div className="flex flex-col h-full w-full bg-[#050b14] text-white font-mono overflow-hidden select-text border border-cyan-900/60 shadow-[0_0_40px_rgba(0,255,255,0.08)]">
      {/* GÓRNY PASEK STATUSU I STEROWANIA */}
      <div className="bg-gradient-to-r from-[#0a192f] via-[#050b14] to-[#0a192f] border-b border-cyan-800/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-400 flex items-center justify-center text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.4)]">
            <Award size={18} className="text-amber-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-cyan-200 tracking-wider">
                WSPÓLNA TABLICA RADY 9 MODELI & DOWÓDCY
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500 text-emerald-300 font-bold">
                100% FREE (0 ZŁ)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-600 text-cyan-300 font-bold hidden sm:inline-block">
                STATYCZNA (BRAK OBROTU)
              </span>
            </div>
            <div className="text-[11px] text-gray-400 flex items-center gap-2 mt-0.5">
              <span>🎤 Główny Spiker: <strong className="text-amber-300">{activeSpeaker.name}</strong></span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold">9/9 Modeli Zsynchronizowanych</span>
            </div>
          </div>
        </div>

        {/* PRZYCISKI AKCJI */}
        <div className="flex items-center gap-2">
          {/* Przycisk kontroli obrotu Omnistar 3D */}
          <button
            onClick={toggleSphereRotation}
            title={isSphereRotationPaused ? "Wznów powolny obrót 3D Omnistar" : "Zatrzymaj obrót Omnistar (pełna stabilność tekstu)"}
            className={`px-2.5 py-1.5 rounded text-xs flex items-center gap-1.5 border transition-all cursor-pointer font-bold ${
              isSphereRotationPaused
                ? 'bg-amber-950/80 text-amber-200 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                : 'bg-black/50 text-cyan-300 border-cyan-700/80 hover:bg-cyan-950'
            }`}
          >
            {isSphereRotationPaused ? <Pause size={13} className="text-amber-400" /> : <Play size={13} className="text-emerald-400" />}
            <span>{isSphereRotationPaused ? 'Obrót: ZATRZYMANY' : 'Obrót: AKTYWNY'}</span>
          </button>

          {/* Pobierz Fizycznego Agenta Sterowania PC */}
          {!isPopout && (
            <button
              onClick={downloadDesktopAgent}
              title="Pobierz omnistar_desktop_agent.py do fizycznego sterowania myszką i aplikacjami Windows"
              className="px-2.5 py-1.5 rounded text-xs bg-emerald-600 hover:bg-emerald-500 text-black border border-emerald-300 font-bold flex items-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.3)] transition-colors"
            >
              <Download size={13} />
              <span className="hidden md:inline">Sterowanie PC (.py)</span>
            </button>
          )}

          {/* Widget na pulpit Windows */}
          <button
            onClick={() => setShowDesktopHelp(!showDesktopHelp)}
            title="Jak mieć tę tablicę na pulpicie Windows bez wchodzenia do przeglądarki"
            className="px-2.5 py-1.5 rounded text-xs bg-emerald-950/90 hover:bg-emerald-900 text-emerald-200 border border-emerald-500/80 font-bold flex items-center gap-1.5 cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.2)] transition-colors"
          >
            <Monitor size={13} className="text-emerald-400" />
            <span>Pulpit Windows</span>
          </button>

          {/* Wyczyść tablicę */}
          <button
            onClick={clearCouncilBoard}
            title="Wyczyść wpisy na tablicy"
            className="p-1.5 rounded bg-black/40 hover:bg-red-950/60 text-gray-400 hover:text-red-300 border border-gray-800 hover:border-red-700 cursor-pointer transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* POP-DOWN INSTRUKCJA PULPITOWA DLA WINDOWS */}
      {showDesktopHelp && (
        <div className="bg-[#0b1728] border-b border-emerald-500/60 p-3 px-4 text-xs space-y-2.5 animate-fadeIn">
          <div className="flex justify-between items-center">
            <span className="font-bold text-emerald-300 flex items-center gap-1.5">
              <Monitor size={14} className="text-emerald-400" />
              Lokalny Widget Pulpitu Windows (Always on Top)
            </span>
            <button 
              onClick={() => setShowDesktopHelp(false)}
              className="text-gray-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
          <p className="text-gray-300 leading-relaxed text-[11px]">
            Możesz mieć tę Wspólną Tablicę na stałe na swoim ekranie komputera w trakcie pracy z innymi programami. Działa bez otwierania backendu ani konsoli:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
            {/* Opcja 1: Fizyczny Agent Sterowania PC (PyAutoGUI + WebSocket) */}
            <div className="p-2.5 bg-black/60 rounded border border-emerald-600/80 space-y-2">
              <div className="font-bold text-emerald-300 flex items-center justify-between">
                <span>1. Fizyczny Agent Sterowania PC (Mysz/Programy)</span>
                <button
                  onClick={downloadDesktopAgent}
                  className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-black text-[10px] flex items-center gap-1 cursor-pointer font-bold"
                >
                  <Download size={11} />
                  Pobierz Agenta
                </button>
              </div>
              <p className="text-gray-300 text-[10px]">
                Daje Radzie realną władzę nad kursorem, klawiaturą i uruchamianiem aplikacji Windows:
              </p>
              <div className="flex items-center gap-1.5 bg-black/90 p-1.5 rounded border border-gray-800 text-cyan-300 font-mono text-[10px]">
                <code className="flex-1 truncate">pip install pyautogui websocket-client pillow &amp;&amp; python omnistar_desktop_agent.py</code>
                <button
                  onClick={copyWidgetCommand}
                  className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white cursor-pointer"
                >
                  {copiedCmd ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>
            </div>

            {/* Opcja 2: Lekki Widget Tablicy HUD */}
            <div className="p-2.5 bg-black/60 rounded border border-cyan-800/60 space-y-2">
              <div className="font-bold text-cyan-300 flex items-center justify-between">
                <span>2. Okienko HUD Tablicy na Pulpit (Tkinter)</span>
                <button
                  onClick={downloadPythonWidget}
                  className="px-2 py-0.5 rounded bg-cyan-900 hover:bg-cyan-800 text-cyan-200 text-[10px] flex items-center gap-1 cursor-pointer font-bold"
                >
                  <Download size={11} />
                  Pobierz HUD
                </button>
              </div>
              <p className="text-gray-400 text-[10px]">
                Wyświetla pływające okienko czatu Always-on-Top na ekranie Windows (`python desktop_board.py`).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* KARTY 9 MODELI RADY: CO ROBIĄ W TEJ CHWILI (NAD CZYM PRACUJĄ) */}
      <div className="bg-[#030712] border-b border-cyan-900/60 px-3 py-2 shrink-0 overflow-x-auto custom-scrollbar">
        <div className="text-[10px] text-gray-400 mb-1 flex justify-between items-center px-1">
          <span className="font-bold text-cyan-300 flex items-center gap-1">
            <Cpu size={12} className="text-cyan-400" />
            STATUS I AKTUALNE ZADANIA CZŁONKÓW RADY (CO ROBI KAŻDY MODEL):
          </span>
          <span className="text-[9px] text-amber-400">
            Kliknij na model, aby wyznaczyć go jako oficjalnego Spikera
          </span>
        </div>
        <div className="flex gap-2 min-w-max pb-1">
          {PERMANENT_COUNCIL_MODELS.map((m) => {
            const isSpeaker = m.id === designatedSpeakerId;
            return (
              <div
                key={m.id}
                onClick={() => setDesignatedSpeakerId(m.id)}
                title={`Kliknij, aby uczynić Agenta ${m.id} oficjalnym Spikerem`}
                className={`p-2 rounded-lg border w-[220px] transition-all cursor-pointer flex flex-col justify-between select-none ${
                  isSpeaker
                    ? 'bg-gradient-to-b from-amber-950/70 to-black/90 border-amber-500/90 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                    : 'bg-black/50 border-cyan-950 hover:border-cyan-700/80 hover:bg-cyan-950/20'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className={`font-bold flex items-center gap-1 truncate ${isSpeaker ? 'text-amber-300' : 'text-cyan-200'}`}>
                      {isSpeaker ? '👑' : '•'} Agent {m.id}
                    </span>
                    <span className={`text-[8px] px-1 py-0.2 rounded font-bold ${
                      isSpeaker 
                        ? 'bg-amber-900/80 text-amber-200 border border-amber-500' 
                        : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    }`}>
                      {isSpeaker ? 'SPIKER' : (m.status || 'AKTYWNY')}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-300 font-semibold truncate mb-1">
                    {m.name.split('[')[1]?.replace(']', '') || m.name}
                  </div>
                  <div className="text-[9px] text-emerald-300/90 leading-tight border-t border-cyan-950/80 pt-1">
                    <strong>Zadanie:</strong> {m.task || m.role}
                  </div>
                </div>
                <div className="mt-1.5 pt-1 border-t border-cyan-950 text-[8px] text-gray-500 flex justify-between items-center">
                  <span>{m.specialty}</span>
                  <span className="text-emerald-400">0 zł / free</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 🛡️ REJESTR KAMIENI MILOWYCH & PROTOKÓŁ ZASPRZĘGLANIA 80/20 (WĘZEŁ ZERO - ORKIESTRATOR) */}
      <div className="bg-[#040a16] border-b-2 border-cyan-500/80 shrink-0 text-xs shadow-[0_4px_25px_rgba(6,182,212,0.15)]">
        {/* BELKA STANU PROTOKOŁU (ZASPRZĘGLANIE & SZTAFETA) */}
        <div className="bg-gradient-to-r from-[#09182d] via-[#050f1e] to-[#09182d] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-cyan-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-cyan-950 border border-cyan-400 flex items-center justify-center text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.4)]">
              <Target size={14} className="text-cyan-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-cyan-200 tracking-wider text-[11px] flex items-center gap-1.5">
                  <ShieldAlert size={13} className="text-amber-400" />
                  REJESTR KAMIENI MILOWYCH (DŁUGOTRWAŁA PAMIĘĆ GLOBALNA)
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-cyan-950 text-cyan-300 border border-cyan-700">
                  WĘZEŁ ZERO
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-amber-950 text-amber-300 border border-amber-600 animate-pulse">
                  SZTAFETA #{milestoneLedger.relayGeneration} • {milestoneLedger.activeSwarmSquad}
                </span>
              </div>
            </div>
          </div>

          {/* WSKAŹNIK PAMIĘCI OPERACYJNEJ 80/20 ORAZ STEROWANIE SZTAFETĄ */}
          <div className="flex items-center gap-3">
            {/* Wskaźnik zużycia bufora (0 - 100%) */}
            <div className="flex items-center gap-2 bg-black/60 px-2.5 py-1 rounded border border-cyan-900/80 text-[10px]">
              <span className="text-gray-400 font-semibold flex items-center gap-1">
                <Zap size={11} className={milestoneLedger.contextUsagePercent >= 80 ? 'text-red-400 animate-bounce' : 'text-cyan-400'} />
                Pamięć Operacyjna:
              </span>
              <progress
                value={Math.min(100, milestoneLedger.contextUsagePercent)}
                max={100}
                className="w-24 h-2 rounded-full overflow-hidden accent-cyan-400 bg-gray-900"
              />
              <span className={`font-mono font-bold ${
                milestoneLedger.contextUsagePercent >= 80 ? 'text-red-400 font-extrabold' : 'text-cyan-300'
              }`}>
                {milestoneLedger.contextUsagePercent}% / 80%
              </span>
            </div>

            {/* Przycisk Ręcznego / Natychmiastowego Zasprzęglenia 80/20 */}
            <button
              onClick={() => triggerRelayHandover()}
              title="Wykonaj natychmiastową procedurę zasprzęglania 80/20: zachowaj Pakiet Startowy (Konspekt + 20% logów), zresetuj stary bufor i powołaj świeżą grupę"
              className={`px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                milestoneLedger.contextUsagePercent >= 80
                  ? 'bg-amber-600 hover:bg-amber-500 text-black border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.5)] animate-pulse'
                  : 'bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border-cyan-600/80 hover:shadow-[0_0_8px_rgba(6,182,212,0.3)]'
              }`}
            >
              <RefreshCw size={11} />
              <span>Zasprzęglij Sztafetę (80/20)</span>
            </button>

            {/* Przycisk Zwiń / Rozwiń */}
            <button
              onClick={() => setIsLedgerExpanded(!isLedgerExpanded)}
              className="p-1 hover:bg-cyan-950 rounded text-gray-400 hover:text-white cursor-pointer"
              title={isLedgerExpanded ? "Zwiń konspekt" : "Rozwiń konspekt kamieni milowych"}
            >
              {isLedgerExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>
        </div>

        {/* ROZWINIĘTY KONSPEKT: CEL GŁÓWNY, WEKTOR I KAMIENIE MILOWE */}
        {isLedgerExpanded && (
          <div className="p-3.5 space-y-3 bg-[#030713]">
            {/* CEL GŁÓWNY */}
            <div className="bg-black/60 rounded-lg p-2.5 border border-cyan-900/70 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div className="flex-1">
                <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 mb-0.5">
                  <Target size={12} className="text-amber-400" />
                  CEL GŁÓWNY (DŁUGOTRWAŁA PAMIĘĆ GLOBALNA):
                </div>
                {isEditingGoal ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={goalDraft}
                      onChange={(e) => setGoalDraft(e.target.value)}
                      className="flex-1 bg-black border border-cyan-500 rounded px-2 py-1 text-cyan-200 text-xs focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        if (goalDraft.trim()) setMainGoal(goalDraft.trim());
                        setIsEditingGoal(false);
                      }}
                      className="px-2 py-1 rounded bg-emerald-900 text-emerald-200 text-xs font-bold"
                    >
                      Zapisz
                    </button>
                    <button
                      onClick={() => setIsEditingGoal(false)}
                      className="px-2 py-1 rounded bg-gray-800 text-gray-400 text-xs"
                    >
                      Anuluj
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-200 font-semibold leading-relaxed">
                    {milestoneLedger.mainGoal}
                  </p>
                )}
              </div>
              {!isEditingGoal && (
                <button
                  onClick={() => {
                    setGoalDraft(milestoneLedger.mainGoal);
                    setIsEditingGoal(true);
                  }}
                  title="Edytuj cel główny"
                  className="px-2 py-1 rounded bg-cyan-950/60 hover:bg-cyan-900 text-cyan-300 text-[10px] flex items-center gap-1 border border-cyan-800 cursor-pointer shrink-0 self-start md:self-center"
                >
                  <Edit3 size={11} />
                  <span>Edytuj Cel</span>
                </button>
              )}
            </div>

            {/* AKTUALNY WEKTOR (DOKŁADNIE W TEJ SEKUNDZIE) */}
            <div className="bg-gradient-to-r from-cyan-950/40 via-black to-cyan-950/40 rounded-lg p-2.5 border border-cyan-500/60 flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
              <div className="flex-1">
                <div className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5 mb-0.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                  AKTUALNY WEKTOR (CO ROBIMY DOKŁADNIE W TEJ SEKUNDZIE):
                </div>
                {isEditingVector ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={vectorDraft}
                      onChange={(e) => setVectorDraft(e.target.value)}
                      className="flex-1 bg-black border border-cyan-500 rounded px-2 py-1 text-cyan-200 text-xs focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        if (vectorDraft.trim()) setCurrentVector(vectorDraft.trim());
                        setIsEditingVector(false);
                      }}
                      className="px-2 py-1 rounded bg-emerald-900 text-emerald-200 text-xs font-bold"
                    >
                      Zapisz
                    </button>
                    <button
                      onClick={() => setIsEditingVector(false)}
                      className="px-2 py-1 rounded bg-gray-800 text-gray-400 text-xs"
                    >
                      Anuluj
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-cyan-100 font-bold leading-relaxed font-mono">
                    ⚡ {milestoneLedger.currentVector}
                  </p>
                )}
              </div>
              {!isEditingVector && (
                <button
                  onClick={() => {
                    setVectorDraft(milestoneLedger.currentVector);
                    setIsEditingVector(true);
                  }}
                  title="Edytuj bieżący wektor operacyjny"
                  className="px-2 py-1 rounded bg-cyan-950/60 hover:bg-cyan-900 text-cyan-300 text-[10px] flex items-center gap-1 border border-cyan-800 cursor-pointer shrink-0 self-start md:self-center"
                >
                  <Edit3 size={11} />
                  <span>Zmień Wektor</span>
                </button>
              )}
            </div>

            {/* KAMIENIE MILOWE (ZASADA WYKREŚLANIA - KONTROLOWANA AMNEZJA) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={12} className="text-amber-400" />
                  KAMIENIE MILOWE ({milestoneLedger.milestones.filter(m => m.completed).length}/{milestoneLedger.milestones.length} ZREALIZOWANYCH):
                </span>
                <span className="text-[9px] text-gray-400">
                  Zasada Wykreślania: Odhaczenie usuwa zbędną debatę i chroni Token Limit
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {milestoneLedger.milestones.map((m) => (
                  <div
                    key={m.id}
                    className={`p-2 rounded border transition-all text-xs flex items-center justify-between gap-2 ${
                      m.completed
                        ? 'bg-black/40 border-emerald-900/60 text-gray-400'
                        : 'bg-cyan-950/20 border-cyan-800/80 text-cyan-100 shadow-[0_0_10px_rgba(6,182,212,0.06)]'
                    }`}
                  >
                    <div className="flex items-start gap-2 flex-1">
                      <button
                        onClick={() => toggleMilestone(m.id)}
                        className="mt-0.5 text-cyan-400 hover:text-cyan-200 cursor-pointer"
                        title={m.completed ? "Cofnij odhaczenie" : "Odhacz jako wykonane"}
                      >
                        {m.completed ? (
                          <CheckSquare size={14} className="text-emerald-400" />
                        ) : (
                          <Square size={14} className="text-gray-500 hover:text-cyan-400" />
                        )}
                      </button>
                      <div>
                        <span className={`leading-tight ${m.completed ? 'line-through text-gray-500' : 'font-semibold text-gray-100'}`}>
                          {m.title}
                        </span>
                        {m.completed && (
                          <div className="text-[9px] text-emerald-400/90 font-mono mt-0.5 flex items-center gap-1">
                            <span>✓ Wykonano</span>
                            <span>•</span>
                            <span className="text-gray-500">[Kontrolowana Amnezja: detale wyczyszczone]</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {!m.completed && (
                      <button
                        onClick={() => completeAndPurgeMilestone(m.id)}
                        title="Zrealizuj kamień milowy w 100% i usuń zbyteczną debatę techniczną z kontekstu (Zasada Wykreślania)"
                        className="px-2 py-0.5 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/80 text-[10px] font-bold cursor-pointer shrink-0 transition-colors"
                      >
                        Zrealizuj & Flush
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* DODAJ NOWY KAMIEŃ MILOWY */}
              <div className="mt-2 flex items-center gap-2">
                {isAddingMilestone ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Nazwa nowego kamienia milowego..."
                      value={newMilestoneText}
                      onChange={(e) => setNewMilestoneText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newMilestoneText.trim()) {
                          addMilestone(newMilestoneText.trim());
                          setNewMilestoneText('');
                          setIsAddingMilestone(false);
                        }
                      }}
                      className="flex-1 bg-black border border-cyan-600 rounded px-2.5 py-1 text-xs text-cyan-200 focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        if (newMilestoneText.trim()) {
                          addMilestone(newMilestoneText.trim());
                          setNewMilestoneText('');
                          setIsAddingMilestone(false);
                        }
                      }}
                      className="px-2.5 py-1 rounded bg-cyan-900 hover:bg-cyan-800 text-cyan-200 text-xs font-bold cursor-pointer"
                    >
                      Dodaj
                    </button>
                    <button
                      onClick={() => {
                        setIsAddingMilestone(false);
                        setNewMilestoneText('');
                      }}
                      className="px-2 py-1 rounded bg-gray-800 text-gray-400 text-xs cursor-pointer"
                    >
                      Anuluj
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddingMilestone(true)}
                    className="text-[10px] px-2.5 py-1 rounded bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 border border-dashed border-cyan-800 flex items-center gap-1.5 cursor-pointer font-bold transition-colors"
                  >
                    <Plus size={12} />
                    <span>Dodaj Kolejny Kamień Milowy</span>
                  </button>
                )}
              </div>
            </div>

            {/* NOTKA SYSTEMOWA PROTOKOŁU */}
            <div className="text-[10px] text-gray-400 bg-black/40 p-2 rounded border border-cyan-950 flex items-center justify-between">
              <span className="flex items-center gap-1 text-cyan-400 font-semibold">
                🛡️ Protokół Sztafetowy 80/20:
                <span className="text-gray-400 font-normal ml-1">
                  Przy 80% pojemności następuje wymiana grupy agentów z zachowaniem Rejestru Kamieni Milowych i 20% logów. Pełna ciągłość bez utraty kontekstu.
                </span>
              </span>
              <span className="text-emerald-400 font-bold shrink-0 ml-2">
                Zasprzęglenia: {milestoneLedger.totalFlushes} | Zero Token Limit Error
              </span>
            </div>
          </div>
        )}
      </div>

      {/* PASEK FILTRÓW STRUMIENIA */}
      <div className="bg-[#050e1d] border-b border-cyan-900/50 px-4 py-1.5 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Filtr:</span>
          <button
            onClick={() => setCouncilBoardFilter('all')}
            className={`px-2 py-0.5 rounded text-[10px] cursor-pointer font-bold transition-all ${
              councilBoardFilter === 'all'
                ? 'bg-cyan-950 text-cyan-200 border border-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.3)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Wszystko ({councilBoardItems.length})
          </button>
          <button
            onClick={() => setCouncilBoardFilter('directives')}
            className={`px-2 py-0.5 rounded text-[10px] cursor-pointer font-bold transition-all ${
              councilBoardFilter === 'directives'
                ? 'bg-cyan-950 text-cyan-200 border border-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.3)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            📥 Dyrektywy Dowódcy
          </button>
          <button
            onClick={() => setCouncilBoardFilter('speaker')}
            className={`px-2 py-0.5 rounded text-[10px] cursor-pointer font-bold transition-all ${
              councilBoardFilter === 'speaker'
                ? 'bg-amber-950 text-amber-200 border border-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.3)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            📢 Odpowiedzi Spikera
          </button>
          <button
            onClick={() => setCouncilBoardFilter('deliberations')}
            className={`px-2 py-0.5 rounded text-[10px] cursor-pointer font-bold transition-all ${
              councilBoardFilter === 'deliberations'
                ? 'bg-emerald-950 text-emerald-200 border border-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.3)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🧠 Debata & Tok Myślenia
          </button>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="accent-cyan-500 rounded"
            />
            <span>Auto-przewijanie</span>
          </label>
        </div>
      </div>

      {/* GŁÓWNY STRUMIEŃ TABLICY (LIVE BOARD STREAM) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-[#02050b]">
        {filteredItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500 space-y-3">
            <Award size={40} className="text-gray-700 animate-pulse" />
            <div>
              <p className="text-sm font-bold text-gray-400">Brak wpisów dla wybranego filtra.</p>
              <p className="text-xs text-gray-600 mt-1">
                Wpisz wiadomość poniżej, aby przekazać dyrektywę całej Radzie 9 Modeli.
              </p>
            </div>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isDirective = item.type === 'user_directive';
            const isSpeakerResp = item.type === 'speaker_response';
            const isDeliberation = item.type === 'deliberation';

            return (
              <div
                key={item.id}
                className={`rounded-lg p-3.5 border transition-all text-xs leading-relaxed ${
                  isDirective
                    ? 'bg-gradient-to-r from-cyan-950/40 to-black/80 border-cyan-600/70 text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                    : isSpeakerResp
                      ? 'bg-gradient-to-r from-amber-950/40 to-black/80 border-amber-500/80 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                      : 'bg-black/70 border-emerald-900/60 text-emerald-200'
                }`}
              >
                {/* Nagłówek wpisu */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-cyan-950/90 text-[11px]">
                  <div className="flex items-center gap-2">
                    {isDirective && (
                      <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                        📥 [DOWÓDCA DO WSPÓLNEJ GRUPY - WSZYSTKIE 9 MODELI JEDNOCZEŚNIE]:
                      </span>
                    )}
                    {isSpeakerResp && (
                      <span className="font-bold text-amber-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                        📢 [🎤 {item.agentName || 'SPIKER RADY'} - W IMIENIU WSPÓLNEJ GRUPY]:
                      </span>
                    )}
                    {isDeliberation && (
                      <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        🧠 [{item.agentName || `Agent ${item.agentId}`}]:
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono">
                    {isDirective && (
                      <span className="text-cyan-300 text-[9px] px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-600/60 font-bold">
                        WSPÓLNA GRUPA (9 MODELI)
                      </span>
                    )}
                    {isSpeakerResp && (
                      <span className="text-amber-400/90 text-[9px] px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-600/60 font-bold">
                        WIDOCZNE DLA CAŁEJ RADY
                      </span>
                    )}
                    <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>

                {/* Treść wpisu */}
                <div className="whitespace-pre-wrap font-sans text-xs sm:text-[13px] leading-relaxed select-text">
                  {item.content}
                </div>

                {/* Notatka weryfikacyjna dla Spikera */}
                {isSpeakerResp && (
                  <div className="mt-2.5 pt-1.5 border-t border-amber-950/80 flex items-center justify-between text-[10px] text-amber-400/70 font-mono">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 size={12} className="text-emerald-400" />
                      Zsynchronizowano: wszyscy członkowie Rady widzą tę wypowiedź i mają spójny kontekst.
                    </span>
                    <span className="text-emerald-400 font-bold">0 ZŁ (FREE TIER)</span>
                  </div>
                )}
              </div>
            );
          })
        )}
        {isSending && (
          <div className="p-3 rounded bg-amber-950/30 border border-amber-500/60 text-amber-300 text-xs flex items-center gap-2 animate-pulse">
            <Sparkles size={14} className="text-amber-400 animate-spin" />
            <span>Agent 1 (Gemini Flash - Spiker) konsultuje Radę 9 Modeli i zapisuje odpowiedź na Tablicy...</span>
          </div>
        )}
        <div ref={boardEndRef} />
      </div>

      {/* POLE BEZPOŚREDNIEGO NADAWANIA DYREKTYWY NA TABLICĘ */}
      <div className="p-3 bg-[#0a192f]/90 border-t border-cyan-800/70 shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Napisz do całej Rady 9 Modeli (wyświetli się na tej tablicy i w czacie, 0 zł)..."
              disabled={isSending}
              className="w-full bg-black/80 border border-cyan-700/80 focus:border-cyan-400 focus:shadow-[0_0_12px_rgba(6,182,212,0.3)] rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-cyan-100 placeholder:text-gray-500 font-mono focus:outline-none transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            className={`px-4 py-2.5 rounded-lg font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-all ${
              !input.trim() || isSending
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]'
            }`}
          >
            <Send size={14} className={isSending ? 'animate-pulse' : ''} />
            <span className="hidden sm:inline">Wyślij do Rady</span>
          </button>
        </form>
      </div>
    </div>
  );
};
