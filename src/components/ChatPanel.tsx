import React, { useState, useRef, useEffect } from 'react';
import { useStore, determineRouting, PERMANENT_COUNCIL_MODELS } from '../store';
import { DesktopBridgePanel } from './DesktopBridgePanel';
import { v4 as uuidv4 } from 'uuid';
import {
  Send,
  Terminal,
  Cpu,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Fingerprint,
  Smartphone,
  Sparkles,
  CheckCircle2,
  Zap,
  Copy,
  Check,
  Pause,
  Play,
  ShieldCheck,
  Monitor,
  ArrowRight,
  Award,
  Download
} from 'lucide-react';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export const ChatPanel = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'desktop' | 'council' | 'config'>('chat');
  const [input, setInput] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [councilSubTab, setCouncilSubTab] = useState<'models' | 'board'>('models');
  const [isProcessing, setIsProcessing] = useState(false);

  const messages = useStore((state) => state.messages);
  const addMessage = useStore((state) => state.addMessage);
  const agents = useStore((state) => state.agents);
  const selectedAgentId = useStore((state) => state.selectedAgentId);
  const orchestratorId = useStore((state) => state.orchestratorId);
  const routingMode = useStore((state) => state.routingMode);
  const setRoutingMode = useStore((state) => state.setRoutingMode);
  const setSelectedSpecialists = useStore((state) => state.setSelectedSpecialists);

  const designatedSpeakerId = useStore((state) => state.designatedSpeakerId);
  const setDesignatedSpeakerId = useStore((state) => state.setDesignatedSpeakerId);
  const councilBoardItems = useStore((state) => state.councilBoardItems);
  const sendCouncilDeliberation = useStore((state) => state.sendCouncilDeliberation);

  const desktopConnected = useStore((state) => state.desktopConnected);
  const desktopDeviceId = useStore((state) => state.desktopDeviceId);
  const setDesktopTunnelConnected = useStore((state) => state.setDesktopTunnelConnected);
  const appendDesktopLog = useStore((state) => state.appendDesktopLog);
  const pingDesktopBridge = useStore((state) => state.pingDesktopBridge);

  const mobileConnected = useStore((state) => state.mobileConnected);
  const setMobileConnected = useStore((state) => state.setMobileConnected);
  const mobileDeviceDetails = useStore((state) => state.mobileDeviceDetails);

  const isListening = useStore((state) => state.isListening);
  const setIsListening = useStore((state) => state.setIsListening);
  const voiceMode = useStore((state) => state.voiceMode);
  const toggleVoiceMode = useStore((state) => state.toggleVoiceMode);

  const isClusterPaused = useStore((state) => state.isClusterPaused);
  const setClusterPaused = useStore((state) => state.setClusterPaused);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Live WebSocket sync for Desktop Reverse-WS Agent & Android Companion
  useEffect(() => {
    if (isClusterPaused) return;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      const ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.type === 'desktop_bridge_status') {
            const first = Array.isArray(payload.agents) && payload.agents[0];
            setDesktopTunnelConnected(
              Boolean(payload.connected),
              first?.deviceId,
              first?.screen
            );
          } else if (payload.type === 'desktop_live_event' && payload.data) {
            appendDesktopLog({
              id: `ws-ev-${Date.now()}`,
              timestamp: Date.now(),
              type: payload.data.status === 'error' ? 'error' : 'action',
              raw: payload.data,
              formatted: `✅ [FIZYCZNIE NA PC ${payload.data.deviceId || ''}]: ${payload.data.message || payload.data.action}`
            });
          } else if (payload.type === 'handshake' && payload.device === 'android') {
            setMobileConnected(true, {
              device: payload.device,
              battery: payload.battery || 88,
              latencyMs: 14
            });
            addMessage({
              id: uuidv4(),
              sender: 'system',
              text: `[Most Android] Połączono urządzenie: ${payload.deviceId || 'Android'}.`,
              timestamp: Date.now()
            });
          }
        } catch {
          // Non-JSON
        }
      };

      return () => {
        ws.close();
      };
    } catch (e) {
      console.error('WebSocket error:', e);
    }
  }, [isClusterPaused]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'pl-PL';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        handleVoiceInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const speak = (text: string) => {
    if (!voiceMode || isClusterPaused) return;
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pl-PL';
    utterance.pitch = 0.95;
    utterance.rate = 1.0;
    synth.speak(utterance);
  };

  const toggleListening = () => {
    if (isClusterPaused) {
      setClusterPaused(false);
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleVoiceInput = (text: string) => {
    addMessage({
      id: uuidv4(),
      sender: 'user',
      text,
      timestamp: Date.now()
    });
    processWithOrchestrator(text);
  };

  // Every message goes through real Gemini 3.8 Flash reasoning + automatic Desktop WebSocket dispatch
  const processWithOrchestrator = async (userText: string) => {
    setIsProcessing(true);
    const decision = determineRouting(userText, routingMode, agents, true);
    setSelectedSpecialists(decision.specialistIds);

    try {
      const councilResult = await sendCouncilDeliberation(userText);
      speak(councilResult.speakerResponse);
    } catch (e) {
      console.error('Błąd narady:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    if (isClusterPaused) {
      setClusterPaused(false);
    }

    const userText = input.trim();
    setInput('');

    addMessage({
      id: uuidv4(),
      sender: 'user',
      text: userText,
      timestamp: Date.now()
    });

    processWithOrchestrator(userText);
  };

  const copyWebSocketUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    navigator.clipboard.writeText(wsUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const downloadDesktopAgent = () => {
    const a = document.createElement('a');
    a.href = '/api/desktop-agent.py?token=' + encodeURIComponent(localStorage.getItem('omnistar_token') || '');
    a.download = 'omnistar_desktop_agent.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="w-[410px] h-full bg-black/85 backdrop-blur-xl border-r border-cyan-500/30 flex flex-col text-cyan-50 shadow-[0_0_30px_rgba(0,255,255,0.1)] z-10 select-text">
      {/* Header */}
      <div className="p-3 border-b border-cyan-500/30 flex justify-between items-center bg-gradient-to-r from-cyan-950/60 to-black shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-cyan-950 border border-cyan-400 flex items-center justify-center">
            <Cpu size={15} className="text-cyan-300 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xs font-bold tracking-wider text-cyan-200">
              TERMINAL DOWODZENIA OMNISTAR
            </h1>
            <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Gemini 3.8 Flash Live • Zero Szablonów
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold border ${
              desktopConnected
                ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                : 'bg-amber-950/70 border-amber-600/70 text-amber-300'
            }`}
          >
            {desktopConnected ? 'PC: ONLINE' : 'PC: OFFLINE'}
          </span>
        </div>
      </div>

      {/* 4-Tab Navigation: Czat | Most PC | Rada (9) | Urządzenia */}
      <div className="grid grid-cols-4 border-b border-cyan-900/60 bg-black/90 text-[11px] font-mono shrink-0">
        <button
          onClick={() => setActiveTab('chat')}
          className={`py-2 px-1 text-center font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
            activeTab === 'chat'
              ? 'bg-cyan-950/90 text-cyan-200 border-b-2 border-cyan-400'
              : 'text-cyan-600 hover:text-cyan-300'
          }`}
        >
          <Terminal size={12} />
          <span>Czat</span>
        </button>

        <button
          onClick={() => setActiveTab('desktop')}
          className={`py-2 px-1 text-center font-bold flex items-center justify-center gap-1 transition-all cursor-pointer relative ${
            activeTab === 'desktop'
              ? 'bg-cyan-950/90 text-cyan-200 border-b-2 border-emerald-400'
              : 'text-cyan-600 hover:text-cyan-300'
          }`}
        >
          <Monitor size={12} className={desktopConnected ? 'text-emerald-400' : 'text-amber-400'} />
          <span>Most PC</span>
          <span
            className={`w-2 h-2 rounded-full ${
              desktopConnected ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]' : 'bg-amber-500'
            }`}
          />
        </button>

        <button
          onClick={() => setActiveTab('council')}
          className={`py-2 px-1 text-center font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
            activeTab === 'council'
              ? 'bg-amber-950/80 text-amber-200 border-b-2 border-amber-400'
              : 'text-amber-500/80 hover:text-amber-300'
          }`}
        >
          <Award size={12} />
          <span>Rada (9)</span>
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={`py-2 px-1 text-center font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
            activeTab === 'config'
              ? 'bg-cyan-950/90 text-cyan-200 border-b-2 border-cyan-400'
              : 'text-cyan-600 hover:text-cyan-300'
          }`}
        >
          <ShieldCheck size={12} />
          <span>System</span>
        </button>
      </div>

      {/* VIEW: MOST PULPITU */}
      {activeTab === 'desktop' && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <DesktopBridgePanel />
        </div>
      )}

      {/* VIEW: STAŁA RADA 9 MODELI */}
      {activeTab === 'council' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-black/90">
          <div className="p-3 bg-gradient-to-r from-amber-950/60 via-black to-emerald-950/60 rounded-lg border border-amber-600/60">
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-1.5 font-bold text-xs text-amber-300">
                <Award size={15} className="text-amber-400" />
                <span>RADA 9 AGENTÓW (SILNIK GEMINI 3.8 LIVE)</span>
              </div>
            </div>
            <p className="text-[11px] text-amber-100/80 leading-relaxed">
              Wszystkie odpowiedzi są generowane na żywo z pełnym kontekstem rozmowy – bez sztywnych szablonów.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/60 rounded border border-cyan-900/60 text-xs font-mono">
            <button
              onClick={() => setCouncilSubTab('models')}
              className={`py-1.5 px-2 rounded text-center font-bold cursor-pointer ${
                councilSubTab === 'models'
                  ? 'bg-amber-950/80 text-amber-200 border border-amber-500/70'
                  : 'text-cyan-500 hover:text-cyan-200'
              }`}
            >
              9 Agentów Rady
            </button>
            <button
              onClick={() => setCouncilSubTab('board')}
              className={`py-1.5 px-2 rounded text-center font-bold cursor-pointer ${
                councilSubTab === 'board'
                  ? 'bg-emerald-950/80 text-emerald-200 border border-emerald-500/70'
                  : 'text-cyan-500 hover:text-cyan-200'
              }`}
            >
              Strumień ({councilBoardItems.length})
            </button>
          </div>

          {councilSubTab === 'models' && (
            <div className="space-y-2">
              {PERMANENT_COUNCIL_MODELS.map((cm) => {
                const isSpeaker = cm.id === designatedSpeakerId;
                return (
                  <div
                    key={cm.id}
                    className={`p-2.5 rounded border flex flex-col gap-1.5 ${
                      isSpeaker
                        ? 'bg-gradient-to-r from-amber-950/50 to-black/80 border-amber-500/90'
                        : 'bg-black/60 border-cyan-900/60'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-cyan-200">{cm.name}</span>
                      {isSpeaker ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950 border border-amber-500 text-amber-300 font-bold">
                          SPIKER
                        </span>
                      ) : (
                        <button
                          onClick={() => setDesignatedSpeakerId(cm.id)}
                          className="px-2 py-0.5 rounded bg-black hover:bg-amber-950/60 text-amber-300 border border-amber-700/60 text-[10px] cursor-pointer"
                        >
                          Ustaw Spikera
                        </button>
                      )}
                    </div>
                    <div className="text-[10px] text-cyan-400">{cm.role}</div>
                  </div>
                );
              })}
            </div>
          )}

          {councilSubTab === 'board' && (
            <div className="space-y-2 font-mono">
              {councilBoardItems.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded text-xs leading-relaxed border bg-black/60 border-cyan-900/60 text-cyan-100"
                >
                  <div className="text-[10px] text-amber-300 font-bold mb-1">
                    {item.agentName || 'DOWÓDCA'}
                  </div>
                  <div className="whitespace-pre-wrap text-[11px]">{item.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: SYSTEM & MOSTY FIZYCZNE (SERVER-SIDE AUTH + HARDWARE BRIDGES) */}
      {activeTab === 'config' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-black/90 font-mono">
          <div className="p-3 bg-gradient-to-r from-emerald-950/60 via-black to-cyan-950/60 rounded-lg border border-emerald-500/60 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
              <CheckCircle2 size={15} className="text-emerald-400" />
              <span>SILNIK AI PO STRONIE SERWERA (AKTYWNY)</span>
            </div>
            <p className="text-[11px] text-cyan-100/90 leading-relaxed">
              Autoryzacja modelu <strong>Gemini 3.8 Flash</strong> działa automatycznie po stronie serwera (panel <strong>Settings &gt; Secrets</strong>). Nie musisz ręcznie wklejać żadnych kluczy w przeglądarce.
            </p>
          </div>

          {/* KARTA PODŁĄCZENIA FIZYCZNEGO KOMPUTERA WINDOWS */}
          <div className="p-3 bg-black/70 rounded-lg border border-cyan-700/70 space-y-2.5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <Monitor size={15} className="text-cyan-400" />
                <span className="text-xs font-bold text-cyan-200">
                  Fizyczne Sterowanie Windows (PyAutoGUI)
                </span>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                  desktopConnected
                    ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                    : 'bg-amber-950 border-amber-600 text-amber-300'
                }`}
              >
                {desktopConnected ? `POŁĄCZONO (${desktopDeviceId})` : 'OCZEKUJE NA SKRYPT'}
              </span>
            </div>

            <p className="text-[11px] text-cyan-300/80 leading-relaxed">
              Aby agenci fizycznie otwierali programy i ruszali kursorem na Twoim komputerze, pobierz i uruchom lokalnego agenta tunelowego:
            </p>

            <div className="flex gap-2">
              <button
                onClick={downloadDesktopAgent}
                className="flex-1 py-1.5 px-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download size={13} />
                <span>Pobierz omnistar_desktop_agent.py</span>
              </button>
              <button
                onClick={() => pingDesktopBridge()}
                className="py-1.5 px-2.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-600 text-cyan-200 text-[11px] font-bold cursor-pointer"
              >
                Sprawdź
              </button>
            </div>
          </div>

          {/* KARTA ANDROID COMPANION */}
          <div className="p-3 bg-black/70 rounded-lg border border-cyan-800/50 space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <Smartphone size={15} className="text-cyan-400" />
                <span className="text-xs font-bold text-cyan-200">Most Android (WebSocket)</span>
              </div>
              <span className="text-[10px] text-slate-400">
                {mobileConnected ? `ONLINE (${mobileDeviceDetails.battery || 90}%)` : 'OCZEKUJE'}
              </span>
            </div>

            <div className="flex gap-1.5">
              <button
                onClick={copyWebSocketUrl}
                className="flex-1 py-1 px-2 bg-cyan-950/60 border border-cyan-800 hover:border-cyan-400 text-cyan-200 rounded text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedUrl ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copiedUrl ? 'Skopiowano adres WS!' : 'Kopiuj adres WebSocket Hubu'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: CZAT DOWODZENIA */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* PASEK SZYBKIEGO DOSTĘPU DO MOSTU KOMPUTERA */}
          {!desktopConnected ? (
            <div className="bg-amber-950/40 border-b border-amber-600/60 px-3 py-2 flex items-center justify-between gap-2 shrink-0">
              <div className="text-[10px] text-amber-200 leading-tight">
                <strong>Komputer PC niepodłączony:</strong> Uruchom most, by agenci klikali myszką.
              </div>
              <button
                onClick={() => setActiveTab('desktop')}
                className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-[10px] flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Monitor size={11} />
                <span>Podłącz PC</span>
              </button>
            </div>
          ) : (
            <div className="bg-emerald-950/40 border-b border-emerald-600/60 px-3 py-1.5 flex items-center justify-between text-[11px] shrink-0">
              <span className="text-emerald-300 font-mono font-bold flex items-center gap-1.5">
                <Zap size={12} className="text-emerald-400" />
                STEROWANIE PC AKTYWNE ({desktopDeviceId || 'Windows'})
              </span>
              <button
                onClick={() => setActiveTab('desktop')}
                className="text-[10px] text-cyan-300 underline cursor-pointer"
              >
                Logi PC
              </button>
            </div>
          )}

          {/* Tryb Routingu i Pauzy */}
          <div className="px-3 py-1.5 bg-black/70 border-b border-cyan-900/50 flex items-center justify-between gap-2 shrink-0">
            <div className="flex gap-1">
              <button
                onClick={() => setRoutingMode('trio')}
                className={`px-2 py-0.5 rounded text-[10px] font-mono border cursor-pointer ${
                  routingMode === 'trio'
                    ? 'bg-amber-900/70 border-amber-400 text-amber-200 font-bold'
                    : 'border-cyan-900 text-cyan-500'
                }`}
              >
                Trio (3)
              </button>
              <button
                onClick={() => setRoutingMode('consensus')}
                className={`px-2 py-0.5 rounded text-[10px] font-mono border cursor-pointer ${
                  routingMode === 'consensus'
                    ? 'bg-emerald-900/70 border-emerald-400 text-emerald-200 font-bold'
                    : 'border-cyan-900 text-cyan-500'
                }`}
              >
                Pełna Rada (9)
              </button>
            </div>

            <button
              onClick={() => setClusterPaused(!isClusterPaused)}
              className="px-2 py-0.5 rounded border border-cyan-800 text-[10px] text-cyan-300 hover:bg-cyan-950 flex items-center gap-1 cursor-pointer"
            >
              {isClusterPaused ? <Play size={10} /> : <Pause size={10} />}
              <span>{isClusterPaused ? 'Wznów' : 'Pauza'}</span>
            </button>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <span
                  className={`text-[9px] mb-0.5 font-mono ${
                    msg.sender === 'user'
                      ? 'text-cyan-300'
                      : msg.sender === 'system'
                        ? 'text-amber-400'
                        : 'text-emerald-400 font-bold'
                  }`}
                >
                  {msg.sender === 'agent' ? '🧠 RADA OMNISTAR (GEMINI 3.8 LIVE)' : msg.sender.toUpperCase()}
                </span>
                <div
                  className={`px-3 py-2.5 rounded max-w-[94%] text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-cyan-900/40 text-cyan-100 border border-cyan-700/50'
                      : msg.sender === 'system'
                        ? 'bg-amber-950/40 text-amber-200 border border-amber-700/50 text-[11px]'
                        : 'bg-emerald-950/30 text-emerald-100 border border-emerald-800/60'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                  {msg.text.includes('omnistar_desktop_agent.py') && (
                    <button
                      onClick={() => setActiveTab('desktop')}
                      className="mt-2.5 text-[10px] px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-black font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Monitor size={12} />
                      <span>Przejdź do zakładki Most PC (Pobierz Agenta)</span>
                      <ArrowRight size={11} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="flex items-center gap-2 p-2.5 rounded bg-cyan-950/50 border border-cyan-500/60 text-cyan-200 text-xs font-mono animate-pulse">
                <Sparkles size={14} className="text-cyan-400 animate-spin shrink-0" />
                <span>Trwa prawdziwe rozumowanie Gemini 3.8 Flash (analiza historii i akcji PC)...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input & Voice Controls */}
          <div className="p-2.5 border-t border-cyan-900/50 flex flex-col gap-2 bg-black/80 shrink-0">
            <div className="flex justify-between items-center text-xs px-1">
              <button
                type="button"
                onClick={toggleVoiceMode}
                className={`flex items-center gap-1.5 transition-colors text-[11px] cursor-pointer ${
                  voiceMode ? 'text-emerald-400 font-semibold' : 'text-gray-500'
                }`}
              >
                {voiceMode ? <Volume2 size={13} /> : <VolumeX size={13} />}
                Czytaj na głos
              </button>

              <button
                type="button"
                onClick={toggleListening}
                className={`flex items-center gap-1.5 transition-colors text-[11px] cursor-pointer ${
                  isListening ? 'text-red-400 animate-pulse font-semibold' : 'text-cyan-500 hover:text-cyan-300'
                }`}
              >
                <Fingerprint size={13} />
                {isListening ? 'Słucham...' : 'Mów do mikrofonu'}
              </button>
            </div>

            <form onSubmit={handleSend} className="relative flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Napisz cokolwiek lub wydaj rozkaz np. 'otwórz notatnik'..."
                  className="w-full bg-black/70 border border-cyan-700 focus:border-cyan-400 rounded pl-3 pr-10 py-2 text-xs text-cyan-100 placeholder:text-cyan-800 focus:outline-none font-mono"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-cyan-400 hover:text-cyan-200 cursor-pointer disabled:opacity-40"
                  disabled={!input.trim() || isProcessing}
                >
                  <Send size={14} />
                </button>
              </div>

              <button
                type="button"
                onClick={toggleListening}
                title="Mikrofon"
                className={`w-9 flex items-center justify-center rounded border transition-all cursor-pointer ${
                  isListening
                    ? 'bg-red-900/40 border-red-500 text-red-400'
                    : 'bg-cyan-900/20 border-cyan-800 text-cyan-400 hover:bg-cyan-900/40'
                }`}
              >
                {isListening ? <MicOff size={15} /> : <Mic size={15} />}
              </button>
            </form>
          </div>
        </div>
      )}

      {selectedAgentId !== null && (
        <div className="px-3.5 py-1.5 bg-cyan-950/60 border-t border-cyan-900/50 text-xs text-cyan-300 flex justify-between items-center shrink-0">
          <span>
            Węzeł 3D: <span className="font-bold text-white">Agent {selectedAgentId}</span>
          </span>
          <span className="text-[10px] text-cyan-400 font-mono truncate max-w-[200px]">
            {agents[selectedAgentId]?.role || 'Jednostka robocza'}
          </span>
        </div>
      )}
    </div>
  );
};
