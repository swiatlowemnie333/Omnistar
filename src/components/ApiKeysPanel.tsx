import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import {
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  ExternalLink,
  Lock,
  Layers,
  Check
} from 'lucide-react';

export const ApiKeysPanel: React.FC = () => {
  const customGeminiKey = useStore((state) => state.customGeminiKey);
  const setCustomGeminiKey = useStore((state) => state.setCustomGeminiKey);
  const customOpenRouterKeys = useStore((state) => state.customOpenRouterKeys);
  const setCustomOpenRouterKeys = useStore((state) => state.setCustomOpenRouterKeys);
  const activeOpenRouterModel = useStore((state) => state.activeOpenRouterModel);
  const setActiveOpenRouterModel = useStore((state) => state.setActiveOpenRouterModel);

  const [geminiInput, setGeminiInput] = useState(customGeminiKey);
  const [openRouterInput, setOpenRouterInput] = useState(customOpenRouterKeys);
  const [modelInput, setModelInput] = useState(activeOpenRouterModel);
  const [savedMessage, setSavedMessage] = useState(false);

  useEffect(() => {
    setGeminiInput(customGeminiKey);
  }, [customGeminiKey]);

  useEffect(() => {
    setOpenRouterInput(customOpenRouterKeys);
  }, [customOpenRouterKeys]);

  useEffect(() => {
    setModelInput(activeOpenRouterModel);
  }, [activeOpenRouterModel]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomGeminiKey(geminiInput.trim());
    setCustomOpenRouterKeys(openRouterInput.trim());
    setActiveOpenRouterModel(modelInput.trim());
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2500);
  };

  const openRouterList = openRouterInput
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3 font-mono text-xs custom-scrollbar bg-black/90">
      {/* Baner informacyjny */}
      <div className="p-3 bg-gradient-to-r from-cyan-950/70 via-black to-emerald-950/70 rounded-lg border border-cyan-500/60 space-y-1.5">
        <div className="flex items-center gap-2 text-cyan-200 font-bold">
          <Key size={15} className="text-cyan-400" />
          <span>KLUCZE API (TŁUMACZ & SILNIK RADY)</span>
        </div>
        <p className="text-[11px] text-cyan-100/90 leading-relaxed font-sans">
          Klucze są przesyłane do backendu serwera (Express) i używane do wywołań Gemini oraz OpenRouter.
          W przypadku błędu <strong>429 (Rate Limit / Quota)</strong> serwer automatycznie rotuje klucze OpenRouter oddzielone przecinkiem.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        {/* Gemini API Key */}
        <div className="p-3 bg-black/70 rounded-lg border border-cyan-800/60 space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
              <Lock size={12} className="text-cyan-400" />
              <span>Klucz Google Gemini (AIza...)</span>
            </label>
            {customGeminiKey ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-500 text-emerald-300 font-bold">
                ZAPISANY
              </span>
            ) : (
              <span className="text-[9px] text-gray-400 font-sans">
                (opcjonalnie — użyje env GEMINI_API_KEY jeśli puste)
              </span>
            )}
          </div>
          <input
            type="password"
            value={geminiInput}
            onChange={(e) => setGeminiInput(e.target.value)}
            placeholder="AIzaSy..."
            autoComplete="off"
            className="w-full bg-black/90 border border-cyan-700/80 focus:border-cyan-400 rounded px-2.5 py-1.5 text-xs text-cyan-100 placeholder:text-cyan-800 focus:outline-none"
          />
          <p className="text-[10px] text-gray-400 leading-tight font-sans">
            Używany przez <strong>Agenta Tłumacza</strong> (Gemini 3.8 Flash). Jeśli brak lub wystąpi błąd autoryzacji, backend automatycznie sięgnie po OpenRouter.
          </p>
        </div>

        {/* OpenRouter API Keys */}
        <div className="p-3 bg-black/70 rounded-lg border border-cyan-800/60 space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
              <RotateCw size={12} className="text-emerald-400" />
              <span>Klucze OpenRouter (sk-or-...)</span>
            </label>
            <span className="text-[10px] text-emerald-400 font-bold">
              {openRouterList.length > 0 ? `${openRouterList.length} kluczy (rotacja)` : 'brak'}
            </span>
          </div>
          <textarea
            value={openRouterInput}
            onChange={(e) => setOpenRouterInput(e.target.value)}
            rows={3}
            placeholder="sk-or-v1-key1..., sk-or-v1-key2..., sk-or-v1-key3..."
            autoComplete="off"
            className="w-full bg-black/90 border border-cyan-700/80 focus:border-cyan-400 rounded px-2.5 py-1.5 text-xs text-cyan-100 placeholder:text-cyan-800 focus:outline-none font-mono resize-none leading-relaxed"
          />
          <p className="text-[10px] text-gray-400 leading-tight font-sans">
            Wklej jeden lub <strong>kilka kluczy oddzielonych przecinkiem</strong>. W przypadku błędu <strong>429</strong> backend automatycznie przełącza się na kolejny klucz z listy.
          </p>
        </div>

        {/* Preferowany model OpenRouter dla Redaktora / Fallbacku */}
        <div className="p-3 bg-black/70 rounded-lg border border-cyan-800/60 space-y-1.5">
          <label className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
            <Layers size={12} className="text-cyan-400" />
            <span>Domyślny model OpenRouter (Redaktor / Tłumacz)</span>
          </label>
          <input
            type="text"
            value={modelInput}
            onChange={(e) => setModelInput(e.target.value)}
            placeholder="anthropic/claude-3.5-sonnet, openai/gpt-4o-mini lub google/gemini-2.5-flash"
            className="w-full bg-black/90 border border-cyan-700/80 focus:border-cyan-400 rounded px-2.5 py-1.5 text-xs text-cyan-100 placeholder:text-cyan-800 focus:outline-none"
          />
          <div className="flex flex-wrap gap-1 pt-1">
            <button
              type="button"
              onClick={() => setModelInput('anthropic/claude-3.5-sonnet')}
              className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-[10px] text-cyan-300 hover:border-cyan-500 cursor-pointer"
            >
              Claude 3.5 Sonnet
            </button>
            <button
              type="button"
              onClick={() => setModelInput('qwen/qwen-2.5-72b-instruct')}
              className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-[10px] text-cyan-300 hover:border-cyan-500 cursor-pointer"
            >
              Qwen 2.5 72B (ja/zh)
            </button>
            <button
              type="button"
              onClick={() => setModelInput('meta-llama/llama-3.3-70b-instruct')}
              className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-[10px] text-cyan-300 hover:border-cyan-500 cursor-pointer"
            >
              Llama 3.3 70B
            </button>
            <button
              type="button"
              onClick={() => setModelInput('google/gemini-2.5-flash')}
              className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-[10px] text-cyan-300 hover:border-cyan-500 cursor-pointer"
            >
              Gemini 2.5 Flash
            </button>
          </div>
          <p className="text-[10px] text-gray-400 leading-tight font-sans">
            Dla języków <strong>japońskiego (ja)</strong> oraz <strong>chińskiego tradycyjnego (zh-Hant)</strong> serwer automatycznie preferuje modele z rodziny <strong>Qwen</strong>.
          </p>
        </div>

        {/* Przycisk Zapisz */}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="flex-1 py-2 px-3 rounded bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all"
          >
            {savedMessage ? <Check size={14} className="text-black" /> : <ShieldCheck size={14} />}
            <span>{savedMessage ? 'ZAPISANO KLUCZE W PAMIĘCI' : 'ZAPISZ KLUCZE API'}</span>
          </button>
        </div>
      </form>

      {/* Bezpieczeństwo i zasada działania */}
      <div className="p-2.5 rounded bg-black/60 border border-cyan-900/50 text-[10px] text-cyan-400/80 space-y-1">
        <div className="text-cyan-300 font-bold flex items-center gap-1">
          <CheckCircle2 size={12} className="text-emerald-400" />
          <span>BEZPOŚREDNIE WYWOŁANIA BACKENDOWE (BEZ SYMULACJI)</span>
        </div>
        <p className="leading-relaxed font-sans text-gray-400">
          Klucze są przechowywane lokalnie w Twojej przeglądarce (localStorage) i dołączane w nagłówku do każdego żądania tłumaczenia do backendu Express. Backend nigdy nie symuluje odpowiedzi – jeśli zapytanie do API zawiedzie, w panelu Tłumacza zobaczysz dokładny kod błędu i treść odpowiedzi od dostawcy.
        </p>
      </div>
    </div>
  );
};
