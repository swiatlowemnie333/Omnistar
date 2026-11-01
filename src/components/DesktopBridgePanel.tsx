import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import {
  Monitor,
  RefreshCw,
  Send,
  Terminal as TerminalIcon,
  Copy,
  Trash2,
  Zap,
  Download,
  Check,
  Wifi,
  WifiOff
} from 'lucide-react';

export const DesktopBridgePanel: React.FC = () => {
  const desktopConnected = useStore((state) => state.desktopConnected);
  const desktopDeviceId = useStore((state) => state.desktopDeviceId);
  const desktopScreen = useStore((state) => state.desktopScreen);
  const desktopStatus = useStore((state) => state.desktopStatus);
  const desktopLatencyMs = useStore((state) => state.desktopLatencyMs);
  const desktopLogs = useStore((state) => state.desktopLogs);
  const pingDesktopBridge = useStore((state) => state.pingDesktopBridge);
  const sendDesktopStep = useStore((state) => state.sendDesktopStep);
  const clearDesktopLogs = useStore((state) => state.clearDesktopLogs);

  const [inputInstruction, setInputInstruction] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [desktopLogs]);

  const handleSendManualStep = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputInstruction.trim() || isSending) return;

    const instruction = inputInstruction.trim();
    setInputInstruction('');
    setIsSending(true);

    try {
      await sendDesktopStep(instruction);
    } finally {
      setIsSending(false);
    }
  };

  const executeQuickAction = async (instruction: string) => {
    if (isSending) return;
    setIsSending(true);
    try {
      await sendDesktopStep(instruction);
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

  const copyInstallRunCmd = () => {
    navigator.clipboard.writeText(
      'pip install pyautogui websocket-client pillow && python omnistar_desktop_agent.py'
    );
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2500);
  };

  return (
    <div className="flex flex-col h-full bg-black/95 text-cyan-100 font-mono text-xs overflow-y-auto custom-scrollbar p-3 space-y-3">
      {/* STATUS POŁĄCZENIA FIZYCZNEGO Z KOMPUTEREM WINDOWS */}
      <div
        className={`p-3 rounded-lg border flex flex-col gap-2 transition-all ${
          desktopConnected
            ? 'bg-emerald-950/40 border-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
            : 'bg-amber-950/30 border-amber-500/70 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
        }`}
      >
        <div className="flex justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            {desktopConnected ? (
              <Wifi size={18} className="text-emerald-400 animate-pulse" />
            ) : (
              <WifiOff size={18} className="text-amber-400" />
            )}
            <div>
              <h2 className="font-bold text-xs tracking-wider text-white">
                FIZYCZNY MOST PULPITU WINDOWS (TUNEL WEBSOCKET)
              </h2>
              <p className="text-[10px] text-cyan-300/90">
                {desktopConnected
                  ? `Połączono na żywo z PC: ${desktopDeviceId || 'Windows'} (${desktopScreen ? `${desktopScreen[0]}x${desktopScreen[1]}` : '1920x1080'})`
                  : 'Twój komputer nie jest jeszcze podpięty — pobierz i uruchom agenta poniżej!'}
              </p>
            </div>
          </div>

          <button
            onClick={() => pingDesktopBridge()}
            disabled={desktopStatus === 'testing'}
            className="px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/80 text-cyan-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
          >
            {desktopStatus === 'testing' ? (
              <RefreshCw size={11} className="animate-spin" />
            ) : (
              <Zap size={11} className={desktopConnected ? 'text-emerald-400' : 'text-amber-400'} />
            )}
            <span>{desktopConnected ? `ONLINE ${desktopLatencyMs ? `(${desktopLatencyMs}ms)` : ''}` : 'Sprawdź'}</span>
          </button>
        </div>

        {/* DLACZEGO WCZEŚNIEJ NIE STEROWAŁO KOMPUTEREM + 2 KROKI PODŁĄCZENIA */}
        {!desktopConnected && (
          <div className="p-2.5 bg-black/80 rounded border border-amber-600/50 space-y-2 text-[11px]">
            <p className="text-amber-200 leading-relaxed">
              <strong>Jak włączyć prawdziwe sterowanie Twoim komputerem w 30 sekund:</strong><br />
              Aplikacja w chmurze nie może sama wejść na Twój Windows bez Twojej zgody. Pobierz gotowy plik Pythona – ma już wpisany adres tego serwera i po uruchomieniu sam zestawi żywy tunel z Radą!
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={downloadDesktopAgent}
                className="w-full py-2 px-3 rounded bg-emerald-600 hover:bg-emerald-500 text-black font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all"
              >
                <Download size={15} />
                <span>KROK 1: POBIERZ omnistar_desktop_agent.py</span>
              </button>

              <div className="bg-slate-950 p-2 rounded border border-cyan-900/70 space-y-1">
                <div className="text-[10px] text-cyan-400 font-bold">
                  KROK 2: Otwórz folder Pobrane w CMD / PowerShell i wklej:
                </div>
                <div className="flex items-center gap-1.5">
                  <code className="flex-1 text-[10px] text-emerald-300 bg-black p-1.5 rounded border border-gray-800 overflow-x-auto whitespace-nowrap">
                    pip install pyautogui websocket-client pillow &amp;&amp; python omnistar_desktop_agent.py
                  </code>
                  <button
                    onClick={copyInstallRunCmd}
                    className="px-2 py-1.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-200 text-[10px] flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {copiedCmd ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copiedCmd ? 'Skopiowano' : 'Kopiuj'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PANEL TESTOWANIA FIZYCZNYCH ROZKAZÓW NA PC */}
      <div className="p-3 bg-black/60 rounded-lg border border-cyan-900/60 space-y-2">
        <label className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
          <Monitor size={13} className="text-cyan-400" />
          WYŚLIJ FIZYCZNY ROZKAZ NA SWÓJ KOMPUTER WINDOWS:
        </label>

        <form onSubmit={handleSendManualStep} className="flex gap-2">
          <input
            type="text"
            value={inputInstruction}
            onChange={(e) => setInputInstruction(e.target.value)}
            placeholder="np. otwórz notatnik, otwórz kalkulator, kliknij 500, 400..."
            className="flex-1 bg-black/80 border border-cyan-800/80 focus:border-cyan-400 rounded px-2.5 py-1.5 text-xs text-cyan-100 font-mono focus:outline-none"
          />
          <button
            type="submit"
            disabled={isSending || !inputInstruction.trim()}
            className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/80 rounded text-emerald-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-40"
          >
            {isSending ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
            <span>Wykonaj na PC</span>
          </button>
        </form>

        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <button
            onClick={() => executeQuickAction('otwórz Notatnik')}
            disabled={isSending}
            className="py-1.5 px-2 rounded bg-cyan-950/40 border border-cyan-800/70 hover:border-cyan-400 text-cyan-200 hover:text-white text-[10px] text-left cursor-pointer"
          >
            📝 Otwórz Notatnik (notepad.exe)
          </button>
          <button
            onClick={() => executeQuickAction('otwórz Kalkulator')}
            disabled={isSending}
            className="py-1.5 px-2 rounded bg-cyan-950/40 border border-cyan-800/70 hover:border-cyan-400 text-cyan-200 hover:text-white text-[10px] text-left cursor-pointer"
          >
            🧮 Otwórz Kalkulator (calc.exe)
          </button>
          <button
            onClick={() => executeQuickAction('kliknij w punkt 500, 400')}
            disabled={isSending}
            className="py-1.5 px-2 rounded bg-cyan-950/40 border border-cyan-800/70 hover:border-cyan-400 text-cyan-200 hover:text-white text-[10px] text-left cursor-pointer"
          >
            🖱️ Kliknij myszką w (500, 400)
          </button>
          <button
            onClick={() => executeQuickAction('wpisz tekst Witaj Dowódco z chmury Omnistar!')}
            disabled={isSending}
            className="py-1.5 px-2 rounded bg-cyan-950/40 border border-cyan-800/70 hover:border-cyan-400 text-cyan-200 hover:text-white text-[10px] text-left cursor-pointer"
          >
            ⌨️ Wpisz tekst z klawiatury
          </button>
        </div>
      </div>

      {/* LOGI WYKONANIA Z FIZYCZNEGO KOMPUTERA */}
      <div className="flex-1 min-h-[240px] bg-black/95 rounded-lg border border-cyan-700/60 flex flex-col overflow-hidden">
        <div className="bg-slate-950 px-3 py-1.5 border-b border-cyan-900/60 flex justify-between items-center">
          <div className="flex items-center gap-1.5 text-cyan-300 font-bold text-[11px]">
            <TerminalIcon size={13} className="text-emerald-400" />
            <span>TERMINAL FIZYCZNYCH AKCJI WINDOWS</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={downloadDesktopAgent}
              className="px-2 py-0.5 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-600 text-[9px] font-bold cursor-pointer"
            >
              Pobierz .py
            </button>
            <button
              onClick={() => setShowRawJson(!showRawJson)}
              className={`px-1.5 py-0.5 rounded text-[9px] border cursor-pointer ${
                showRawJson
                  ? 'bg-cyan-900/60 text-cyan-200 border-cyan-500'
                  : 'bg-black/60 text-cyan-600 border-cyan-900/60'
              }`}
            >
              JSON
            </button>
            <button
              onClick={clearDesktopLogs}
              title="Wyczyść logi"
              className="p-1 rounded text-cyan-600 hover:text-cyan-300 cursor-pointer"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        <div className="flex-1 p-2.5 overflow-y-auto custom-scrollbar font-mono text-[11px] space-y-1.5 bg-[#030712]">
          {desktopLogs.map((log) => {
            const timeStr = new Date(log.timestamp).toLocaleTimeString();

            if (log.type === 'action') {
              return (
                <div
                  key={log.id}
                  className="text-emerald-300 border-l-2 border-emerald-500 pl-2 py-1 bg-emerald-950/20 rounded-r"
                >
                  <span className="text-emerald-600 text-[10px] mr-1.5">[{timeStr}]</span>
                  <span className="font-bold text-emerald-200">{log.formatted}</span>
                  {showRawJson && log.raw && (
                    <pre className="mt-1 text-[10px] text-slate-400 bg-black/80 p-1.5 rounded border border-emerald-900/40 overflow-x-auto">
                      {JSON.stringify(log.raw, null, 2)}
                    </pre>
                  )}
                </div>
              );
            }

            if (log.type === 'error') {
              return (
                <div
                  key={log.id}
                  className="text-rose-300 border-l-2 border-rose-500 pl-2 py-1 bg-rose-950/30 rounded-r"
                >
                  <span className="text-rose-500 text-[10px] mr-1.5">[{timeStr}]</span>
                  <span>{log.formatted}</span>
                </div>
              );
            }

            return (
              <div key={log.id} className="text-cyan-300/90 pl-2 py-0.5">
                <span className="text-slate-500 text-[10px] mr-1.5">[{timeStr}]</span>
                <span>{log.formatted}</span>
              </div>
            );
          })}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
};
