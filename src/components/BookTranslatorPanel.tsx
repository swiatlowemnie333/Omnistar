import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { splitManuscriptIntoChunks, ManuscriptChunk } from '../utils/markdownChunker';
import JSZip from 'jszip';
import {
  BookOpen,
  Upload,
  Play,
  Pause,
  Download,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  FileText,
  Languages,
  CheckSquare,
  Square,
  Sparkles,
  RefreshCw,
  FolderArchive,
  Layers,
  ChevronDown,
  ChevronUp,
  Key
} from 'lucide-react';

export interface SupportedLanguage {
  code: string;
  name: string;
  native: string;
  pronoun: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'de', name: 'Niemiecki', native: 'Deutsch', pronoun: 'du' },
  { code: 'es', name: 'Hiszpański', native: 'Español', pronoun: 'tú' },
  { code: 'fr', name: 'Francuski', native: 'Français', pronoun: 'tu' },
  { code: 'it', name: 'Włoski', native: 'Italiano', pronoun: 'tu' },
  { code: 'ja', name: 'Japoński', native: '日本語', pronoun: 'です/ます' },
  { code: 'pl', name: 'Polski', native: 'Polski', pronoun: 'ty' },
  { code: 'zh-Hant', name: 'Chiński tradycyjny', native: '繁體中文', pronoun: '你' },
  { code: 'ru', name: 'Rosyjski', native: 'Русский', pronoun: 'ты' }
];

interface LangProgress {
  selected: boolean;
  glossary: any | null;
  glossaryLoading: boolean;
  glossaryError: string | null;
  translatedChunks: Record<number, string>; // chunk index -> translated text
  currentChunkIndex: number;
  status: 'idle' | 'translating' | 'completed' | 'error' | 'paused';
  errorMessage: string | null;
  activeChunkStatus?: string;
}

const STORAGE_KEY_RAW = 'omnistar_book_translator_raw_text';
const STORAGE_KEY_PROGRESS = 'omnistar_book_translator_progress';

export const BookTranslatorPanel: React.FC<{ onNavigateToKeys?: () => void }> = ({ onNavigateToKeys }) => {
  const customGeminiKey = useStore((state) => state.customGeminiKey);
  const customOpenRouterKeys = useStore((state) => state.customOpenRouterKeys);
  const activeOpenRouterModel = useStore((state) => state.activeOpenRouterModel);

  const [manuscriptText, setManuscriptText] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY_RAW) || '';
    }
    return '';
  });

  const [fileName, setFileName] = useState<string>('manuscript.md');
  const [chunks, setChunks] = useState<ManuscriptChunk[]>([]);
  const [activeTab, setActiveTab] = useState<'input' | 'process' | 'glossary' | 'preview'>('input');
  const [expandedLang, setExpandedLang] = useState<string>('pl');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const stopRequestedRef = useRef<boolean>(false);

  // Per language state
  const [langStates, setLangStates] = useState<Record<string, LangProgress>>(() => {
    const initial: Record<string, LangProgress> = {};
    SUPPORTED_LANGUAGES.forEach((l) => {
      initial[l.code] = {
        selected: l.code === 'pl' || l.code === 'de',
        glossary: null,
        glossaryLoading: false,
        glossaryError: null,
        translatedChunks: {},
        currentChunkIndex: 0,
        status: 'idle',
        errorMessage: null
      };
    });

    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_PROGRESS);
        if (saved) {
          const parsed = JSON.parse(saved);
          Object.keys(initial).forEach((code) => {
            if (parsed[code]) {
              initial[code] = { ...initial[code], ...parsed[code], status: parsed[code].status === 'translating' ? 'paused' : parsed[code].status };
            }
          });
        }
      } catch (e) {
        console.error('Error restoring translator progress:', e);
      }
    }
    return initial;
  });

  // Re-chunk whenever manuscriptText changes
  useEffect(() => {
    if (manuscriptText.trim()) {
      const parsedChunks = splitManuscriptIntoChunks(manuscriptText, 1400);
      setChunks(parsedChunks);
    } else {
      setChunks([]);
    }
  }, [manuscriptText]);

  // Persist raw text to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_RAW, manuscriptText);
    }
  }, [manuscriptText]);

  // Persist progress to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(langStates));
    }
  }, [langStates]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setManuscriptText(content || '');
      setActiveTab('process');
    };
    reader.readAsText(file);
  };

  const toggleLangSelected = (code: string) => {
    setLangStates((prev) => ({
      ...prev,
      [code]: {
        ...prev[code],
        selected: !prev[code]?.selected
      }
    }));
  };

  const selectAllLangs = (val: boolean) => {
    setLangStates((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((c) => {
        next[c] = { ...next[c], selected: val };
      });
      return next;
    });
  };

  // Helper to fetch glossary for a language
  const ensureGlossary = async (langCode: string): Promise<any> => {
    const currentState = langStates[langCode];
    if (currentState?.glossary) {
      return currentState.glossary;
    }

    setLangStates((prev) => ({
      ...prev,
      [langCode]: { ...prev[langCode], glossaryLoading: true, glossaryError: null }
    }));

    try {
      const sample = chunks.slice(0, 3).map((c) => c.text).join('\n\n') || manuscriptText.slice(0, 3000);
      const resp = await fetch('/api/translate/glossary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetLang: langCode,
          sampleText: sample,
          geminiKey: customGeminiKey,
          openRouterKeys: customOpenRouterKeys,
          preferredModel: activeOpenRouterModel
        })
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data?.error || `HTTP ${resp.status} z /api/translate/glossary`);
      }

      setLangStates((prev) => ({
        ...prev,
        [langCode]: {
          ...prev[langCode],
          glossary: data.glossary,
          glossaryLoading: false,
          glossaryError: null
        }
      }));
      return data.glossary;
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      setLangStates((prev) => ({
        ...prev,
        [langCode]: {
          ...prev[langCode],
          glossaryLoading: false,
          glossaryError: errMsg
        }
      }));
      throw err;
    }
  };

  // Main translation loop (resumable from localStorage)
  const startTranslation = async () => {
    if (chunks.length === 0) {
      alert('Wgraj lub wklej najpierw tekst rękopisu Pandoc Markdown.');
      return;
    }

    stopRequestedRef.current = false;
    setIsRunning(true);
    setActiveTab('process');

    const selectedCodes = Object.keys(langStates).filter((c) => langStates[c].selected);
    if (selectedCodes.length === 0) {
      alert('Wybierz co najmniej jeden język docelowy.');
      setIsRunning(false);
      return;
    }

    for (const code of selectedCodes) {
      if (stopRequestedRef.current) break;

      const langInfo = SUPPORTED_LANGUAGES.find((l) => l.code === code);
      setExpandedLang(code);

      // 1. Ensure glossary first
      let glossary = langStates[code]?.glossary;
      if (!glossary) {
        try {
          glossary = await ensureGlossary(code);
        } catch (glossaryErr: any) {
          setLangStates((prev) => ({
            ...prev,
            [code]: {
              ...prev[code],
              status: 'error',
              errorMessage: `Błąd słownika (${langInfo?.name}): ${glossaryErr.message}`
            }
          }));
          continue; // Move to next language on error
        }
      }

      setLangStates((prev) => ({
        ...prev,
        [code]: { ...prev[code], status: 'translating', errorMessage: null }
      }));

      // 2. Translate chunks sequentially
      for (let i = 0; i < chunks.length; i++) {
        if (stopRequestedRef.current) break;

        // Skip if already translated (resume capability)
        if (langStates[code]?.translatedChunks?.[i]) {
          continue;
        }

        const currentChunk = chunks[i];

        setLangStates((prev) => ({
          ...prev,
          [code]: {
            ...prev[code],
            currentChunkIndex: i,
            activeChunkStatus: `Tłumaczenie fragmentu ${i + 1}/${chunks.length}: "${currentChunk.title.slice(0, 25)}..."`
          }
        }));

        try {
          const resp = await fetch('/api/translate/chunk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chunkIndex: i,
              totalChunks: chunks.length,
              chunkText: currentChunk.text,
              targetLang: code,
              glossary,
              geminiKey: customGeminiKey,
              openRouterKeys: customOpenRouterKeys,
              preferredModel: activeOpenRouterModel
            })
          });

          const data = await resp.json();
          if (!resp.ok || !data.success) {
            throw new Error(data?.error || `HTTP ${resp.status} z /api/translate/chunk`);
          }

          // Save translated chunk
          setLangStates((prev) => ({
            ...prev,
            [code]: {
              ...prev[code],
              translatedChunks: {
                ...prev[code].translatedChunks,
                [i]: data.translatedText
              },
              activeChunkStatus: `Zredagowano (${data.translatorProvider} -> ${data.editorProvider})`
            }
          }));
        } catch (chunkErr: any) {
          const errMsg = chunkErr?.message || String(chunkErr);
          setLangStates((prev) => ({
            ...prev,
            [code]: {
              ...prev[code],
              status: 'error',
              errorMessage: `Błąd we fragmencie ${i + 1} (${currentChunk.title}): ${errMsg}`
            }
          }));
          break; // Stop this language on real failure (no simulation)
        }
      }

      // Check if all chunks completed
      setLangStates((prev) => {
        const transCount = Object.keys(prev[code]?.translatedChunks || {}).length;
        const isDone = transCount >= chunks.length && chunks.length > 0;
        return {
          ...prev,
          [code]: {
            ...prev[code],
            status: isDone ? 'completed' : prev[code].status === 'error' ? 'error' : 'paused',
            activeChunkStatus: isDone ? 'Gotowe do pobrania' : prev[code].activeChunkStatus
          }
        };
      });
    }

    setIsRunning(false);
  };

  const pauseTranslation = () => {
    stopRequestedRef.current = true;
    setIsRunning(false);
    setLangStates((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((c) => {
        if (next[c].status === 'translating') {
          next[c] = { ...next[c], status: 'paused' };
        }
      });
      return next;
    });
  };

  const resetLanguageProgress = (code: string) => {
    if (!confirm(`Czy na pewno chcesz zresetować postęp tłumaczenia dla języka ${code}?`)) return;
    setLangStates((prev) => ({
      ...prev,
      [code]: {
        ...prev[code],
        translatedChunks: {},
        currentChunkIndex: 0,
        status: 'idle',
        errorMessage: null,
        activeChunkStatus: undefined
      }
    }));
  };

  // Compile full translated markdown file
  const getFullTranslatedMarkdown = (code: string): string => {
    const chunkMap = langStates[code]?.translatedChunks || {};
    const assembled: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      if (chunkMap[i]) {
        assembled.push(chunkMap[i]);
      } else if (chunks[i]) {
        assembled.push(`<!-- [FRAGMENT ${i + 1} NIEPRZETŁUMACZONY] -->\n${chunks[i].text}`);
      }
    }
    return assembled.join('\n\n');
  };

  const downloadSingleLanguage = (code: string) => {
    const content = getFullTranslatedMarkdown(code);
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ms_${code}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAllAsZip = async () => {
    const zip = new JSZip();
    let hasFiles = false;

    Object.keys(langStates).forEach((code) => {
      const chunkMap = langStates[code]?.translatedChunks || {};
      if (Object.keys(chunkMap).length > 0) {
        const content = getFullTranslatedMarkdown(code);
        zip.file(`ms_${code}.md`, content);
        hasFiles = true;
      }
    });

    if (!hasFiles) {
      alert('Brak przetłumaczonych plików do pobrania.');
      return;
    }

    // Add consistency glossary as JSON
    const glossaries: Record<string, any> = {};
    Object.keys(langStates).forEach((code) => {
      if (langStates[code]?.glossary) {
        glossaries[code] = langStates[code].glossary;
      }
    });
    zip.file('glossaries_consistency.json', JSON.stringify(glossaries, null, 2));

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `manuscript_translations_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const totalWords = chunks.reduce((acc, c) => acc + c.wordCount, 0);

  return (
    <div className="h-full flex flex-col font-mono text-cyan-50 select-text bg-[#030712] overflow-hidden">
      {/* Pasek Górny */}
      <div className="p-3 bg-gradient-to-r from-cyan-950 via-black to-emerald-950 border-b border-cyan-800/60 shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-cyan-900/60 border border-cyan-400 flex items-center justify-center">
              <BookOpen size={16} className="text-cyan-300" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-cyan-200 tracking-wider">
                TŁUMACZ KSIĄŻEK PANDOC
              </h2>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-sans">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Dwuetapowy: Tłumacz + Redaktor • 8 Języków
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {isRunning ? (
              <button
                onClick={pauseTranslation}
                className="py-1 px-2.5 rounded bg-amber-600 hover:bg-amber-500 text-black font-bold text-[11px] flex items-center gap-1 cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.4)]"
              >
                <Pause size={12} />
                <span>Pauza</span>
              </button>
            ) : (
              <button
                onClick={startTranslation}
                disabled={chunks.length === 0}
                className="py-1 px-2.5 rounded bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-bold text-[11px] flex items-center gap-1 cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.4)]"
              >
                <Play size={12} />
                <span>{Object.values(langStates).some((l) => Object.keys(l.translatedChunks).length > 0) ? 'Kontynuuj' : 'Rozpocznij'}</span>
              </button>
            )}

            <button
              onClick={downloadAllAsZip}
              className="py-1 px-2 rounded bg-cyan-950 border border-cyan-700 hover:border-cyan-400 text-cyan-200 text-[11px] flex items-center gap-1 cursor-pointer"
              title="Pobierz wszystkie przetłumaczone pliki w formacie ZIP"
            >
              <FolderArchive size={12} />
              <span>ZIP</span>
            </button>
          </div>
        </div>

        {/* Sub-nawigacja zakładek */}
        <div className="grid grid-cols-4 gap-1 p-0.5 bg-black/70 rounded border border-cyan-900/60 text-[10px]">
          <button
            onClick={() => setActiveTab('input')}
            className={`py-1 rounded text-center font-bold cursor-pointer transition-all ${
              activeTab === 'input' ? 'bg-cyan-950 text-cyan-200 border border-cyan-500' : 'text-gray-400 hover:text-cyan-300'
            }`}
          >
            Rękopis ({chunks.length})
          </button>
          <button
            onClick={() => setActiveTab('process')}
            className={`py-1 rounded text-center font-bold cursor-pointer transition-all ${
              activeTab === 'process' ? 'bg-cyan-950 text-cyan-200 border border-cyan-500' : 'text-gray-400 hover:text-cyan-300'
            }`}
          >
            Postęp ({SUPPORTED_LANGUAGES.filter((l) => langStates[l.code]?.selected).length})
          </button>
          <button
            onClick={() => setActiveTab('glossary')}
            className={`py-1 rounded text-center font-bold cursor-pointer transition-all ${
              activeTab === 'glossary' ? 'bg-cyan-950 text-cyan-200 border border-cyan-500' : 'text-gray-400 hover:text-cyan-300'
            }`}
          >
            Słownik
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`py-1 rounded text-center font-bold cursor-pointer transition-all ${
              activeTab === 'preview' ? 'bg-cyan-950 text-cyan-200 border border-cyan-500' : 'text-gray-400 hover:text-cyan-300'
            }`}
          >
            Pobierz
          </button>
        </div>
      </div>

      {/* GŁÓWNA ZAWARTOŚĆ W ZALEŻNOŚCI OD ZAKŁADKI */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {/* ZAKŁADKA 1: WEJŚCIE RĘKOPISU & WYBÓR JĘZYKÓW */}
        {activeTab === 'input' && (
          <div className="space-y-3">
            {/* Wgranie pliku .md */}
            <div className="p-3 bg-black/60 rounded-lg border border-cyan-800/60 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-cyan-200 flex items-center gap-1.5">
                  <Upload size={13} className="text-cyan-400" />
                  <span>1. Wgraj plik .md (Pandoc Markdown)</span>
                </span>
                {chunks.length > 0 && (
                  <span className="text-[10px] text-emerald-400 font-bold">
                    {chunks.length} fragmentów • ~{totalWords} słów
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="flex-1 py-2 px-3 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-600 border-dashed text-cyan-200 text-xs flex items-center justify-center gap-2 cursor-pointer transition-all">
                  <FileText size={14} className="text-cyan-400" />
                  <span className="truncate">{fileName || 'Wybierz plik manuscript.md'}</span>
                  <input type="file" accept=".md,.markdown,.txt" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            {/* Checkboxy Języków */}
            <div className="p-3 bg-black/60 rounded-lg border border-cyan-800/60 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-cyan-200 flex items-center gap-1.5">
                  <Languages size={13} className="text-emerald-400" />
                  <span>2. Wybierz języki docelowe (rejestr bezpośredni)</span>
                </span>
                <div className="flex gap-2 text-[10px]">
                  <button onClick={() => selectAllLangs(true)} className="text-cyan-400 hover:underline cursor-pointer">
                    Wszystkie
                  </button>
                  <span className="text-gray-600">|</span>
                  <button onClick={() => selectAllLangs(false)} className="text-gray-400 hover:underline cursor-pointer">
                    Odznacz
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {SUPPORTED_LANGUAGES.map((lang) => {
                  const isSel = langStates[lang.code]?.selected;
                  const transCount = Object.keys(langStates[lang.code]?.translatedChunks || {}).length;
                  return (
                    <button
                      key={lang.code}
                      onClick={() => toggleLangSelected(lang.code)}
                      className={`p-2 rounded text-left border flex items-center justify-between cursor-pointer transition-all ${
                        isSel
                          ? 'bg-cyan-950/80 border-cyan-500 text-cyan-100 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                          : 'bg-black/50 border-cyan-950 text-gray-400 hover:border-cyan-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isSel ? (
                          <CheckSquare size={13} className="text-cyan-400 shrink-0" />
                        ) : (
                          <Square size={13} className="text-gray-600 shrink-0" />
                        )}
                        <div className="truncate">
                          <div className="text-xs font-bold truncate">
                            {lang.native} ({lang.code})
                          </div>
                          <div className="text-[10px] text-gray-400 font-sans">
                            {lang.name} • &quot;{lang.pronoun}&quot;
                          </div>
                        </div>
                      </div>
                      {transCount > 0 && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-950 border border-emerald-600 text-emerald-300 font-bold shrink-0">
                          {transCount}/{chunks.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Wklejanie lub podgląd tekstu */}
            <div className="p-3 bg-black/60 rounded-lg border border-cyan-800/60 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-cyan-200">
                  LUB wklej treść rękopisu Pandoc Markdown:
                </span>
                {manuscriptText && (
                  <button
                    onClick={() => setManuscriptText('')}
                    className="text-[10px] text-red-400 hover:underline cursor-pointer"
                  >
                    Wyczyść
                  </button>
                )}
              </div>
              <textarea
                value={manuscriptText}
                onChange={(e) => setManuscriptText(e.target.value)}
                placeholder="Wklej tutaj treść książki po angielsku (zawierającą nagłówki # i ##, bloki ::: {.chapter}, znaczniki [[TOC]] itd.)..."
                rows={8}
                className="w-full bg-black/80 border border-cyan-900 focus:border-cyan-400 rounded p-2 text-[11px] text-cyan-100 placeholder:text-gray-600 focus:outline-none font-mono resize-none leading-relaxed"
              />
            </div>

            {/* Przycisk przejścia */}
            <button
              onClick={() => {
                if (chunks.length > 0) setActiveTab('process');
                else alert('Wgraj lub wklej rękopis.');
              }}
              disabled={chunks.length === 0}
              className="w-full py-2.5 rounded bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 disabled:opacity-40 text-black font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.4)]"
            >
              <Sparkles size={14} />
              <span>Przejdź do Tłumaczenia ({chunks.length} fragmentów)</span>
            </button>
          </div>
        )}

        {/* ZAKŁADKA 2: POSTĘP TŁUMACZENIA NA ŻYWO PER JĘZYK */}
        {activeTab === 'process' && (
          <div className="space-y-3">
            {/* Informacja o braku klucza lub szybka nawigacja do Kluczy */}
            {(!customGeminiKey && !customOpenRouterKeys) && (
              <div className="p-2.5 bg-amber-950/60 rounded-lg border border-amber-600/70 text-amber-200 text-xs flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-sans leading-relaxed">
                    Nie wprowadzono własnych kluczy w zakładce <strong>Klucze</strong>. Backend spróbuje użyć kluczy systemowych ze środowiska, ale zaleca się dodanie własnego klucza Gemini lub OpenRouter.
                  </p>
                </div>
                {onNavigateToKeys && (
                  <button
                    onClick={onNavigateToKeys}
                    className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-black font-bold text-[10px] rounded cursor-pointer shrink-0 flex items-center gap-1"
                  >
                    <Key size={10} />
                    <span>Klucze</span>
                  </button>
                )}
              </div>
            )}

            {/* Lista postępu per język */}
            <div className="space-y-2">
              {SUPPORTED_LANGUAGES.filter((l) => langStates[l.code]?.selected).map((lang) => {
                const state = langStates[lang.code];
                const transCount = Object.keys(state.translatedChunks || {}).length;
                const total = chunks.length || 1;
                const percent = Math.min(100, Math.round((transCount / total) * 100));
                const isExpanded = expandedLang === lang.code;

                return (
                  <div
                    key={lang.code}
                    className="p-3 bg-black/70 rounded-lg border border-cyan-800/60 space-y-2 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-cyan-200">
                          {lang.native} ({lang.code})
                        </span>
                        <span className="text-[10px] text-gray-400 font-sans">
                          • &quot;{lang.pronoun}&quot;
                        </span>
                        {state.status === 'completed' && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-500 text-emerald-300 font-bold flex items-center gap-1">
                            <CheckCircle2 size={10} />
                            UKOŃCZONO
                          </span>
                        )}
                        {state.status === 'translating' && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-400 text-cyan-300 font-bold animate-pulse flex items-center gap-1">
                            <RefreshCw size={10} className="animate-spin" />
                            W TOKU
                          </span>
                        )}
                        {state.status === 'error' && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-950 border border-red-500 text-red-300 font-bold">
                            BŁĄD
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-400">
                          {transCount}/{total} ({percent}%)
                        </span>
                        <button
                          onClick={() => setExpandedLang(isExpanded ? '' : lang.code)}
                          className="p-1 text-gray-400 hover:text-cyan-300 cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* Pasek postępu */}
                    <div className="w-full bg-black/90 rounded-full h-2 overflow-hidden border border-cyan-950">
                      <div
                        className={`h-full transition-all duration-300 ${
                          state.status === 'error'
                            ? 'bg-red-500'
                            : state.status === 'completed'
                            ? 'bg-emerald-400'
                            : 'bg-cyan-400'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    {state.activeChunkStatus && (
                      <div className="text-[10px] text-cyan-300/80 font-sans truncate">
                        {state.activeChunkStatus}
                      </div>
                    )}

                    {/* Błąd jeśli wystąpił (Prawdziwy błąd, bez symulacji) */}
                    {state.errorMessage && (
                      <div className="p-2 bg-red-950/70 border border-red-500 rounded text-[11px] text-red-200 font-sans leading-tight">
                        <strong>Błąd API:</strong> {state.errorMessage}
                      </div>
                    )}

                    {/* Szczegóły po rozwinięciu */}
                    {isExpanded && (
                      <div className="pt-2 border-t border-cyan-900/50 space-y-2 text-[11px]">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-gray-400 font-sans">
                            Słownik spójności:{' '}
                            <strong className="text-cyan-300">
                              {state.glossary ? 'Wygenerowany (OK)' : 'Oczekuje na start'}
                            </strong>
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => downloadSingleLanguage(lang.code)}
                              disabled={transCount === 0}
                              className="text-cyan-400 hover:underline disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                            >
                              <Download size={11} />
                              <span>Pobierz ms_{lang.code}.md</span>
                            </button>
                            <button
                              onClick={() => resetLanguageProgress(lang.code)}
                              className="text-gray-500 hover:text-red-400 cursor-pointer"
                            >
                              Reset
                            </button>
                          </div>
                        </div>

                        {/* Ostatni przetłumaczony fragment */}
                        {transCount > 0 && (
                          <div className="p-2 rounded bg-black/90 border border-cyan-900/60 max-h-36 overflow-y-auto text-[10px] text-gray-300 leading-relaxed custom-scrollbar font-mono">
                            <div className="text-emerald-400 font-bold mb-1">
                              Podgląd ostatniego fragmentu (#{Object.keys(state.translatedChunks).length}):
                            </div>
                            <pre className="whitespace-pre-wrap font-mono">
                              {state.translatedChunks[Object.keys(state.translatedChunks).length - 1]?.slice(0, 500)}...
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ZAKŁADKA 3: SŁOWNIK SPÓJNOŚCI (GLOSSARY) */}
        {activeTab === 'glossary' && (
          <div className="space-y-3 font-sans">
            <div className="p-3 bg-black/60 rounded-lg border border-cyan-800/60 space-y-1.5">
              <h3 className="text-xs font-bold text-cyan-200 font-mono flex items-center gap-1.5">
                <Sparkles size={13} className="text-cyan-400" />
                <span>Oficjalny Słownik Spójności (Consistency Glossary)</span>
              </h3>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                Przed tłumaczeniem ustalamy jednoznaczne tłumaczenia kluczowych pojęć książki. Każdy fragment jest z nimi rygorystycznie weryfikowany przez Agenta Redaktora.
              </p>
            </div>

            {/* Lista pojęć */}
            <div className="space-y-2">
              {SUPPORTED_LANGUAGES.filter((l) => langStates[l.code]?.selected).map((lang) => {
                const g = langStates[lang.code]?.glossary;
                return (
                  <div key={lang.code} className="p-3 bg-black/70 rounded-lg border border-cyan-900/60 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-cyan-300 font-mono">
                        {lang.native} ({lang.code})
                      </span>
                      {!g && (
                        <button
                          onClick={() => ensureGlossary(lang.code)}
                          disabled={langStates[lang.code]?.glossaryLoading}
                          className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-cyan-200 text-[10px] font-mono cursor-pointer"
                        >
                          {langStates[lang.code]?.glossaryLoading ? 'Generowanie...' : 'Generuj Słownik'}
                        </button>
                      )}
                    </div>

                    {g ? (
                      <div className="space-y-1.5 text-xs">
                        <div className="text-[11px] text-emerald-300 bg-emerald-950/40 border border-emerald-800/60 rounded p-1.5">
                          <strong>Stopka praw autorskich:</strong> &quot;{g.copyrightNotice}&quot;
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-[11px]">
                          {g.terms &&
                            Object.entries(g.terms).map(([en, tr]: [string, any]) => (
                              <div key={en} className="p-1 rounded bg-black/60 border border-cyan-950 flex justify-between">
                                <span className="text-gray-400">{en}:</span>
                                <strong className="text-cyan-200">{String(tr)}</strong>
                              </div>
                            ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-500 italic">
                        Słownik zostanie wygenerowany automatycznie przy starcie tłumaczenia.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ZAKŁADKA 4: POBIERANIE WYPOŻYCZONYCH PLIKÓW */}
        {activeTab === 'preview' && (
          <div className="space-y-3">
            <div className="p-3 bg-black/60 rounded-lg border border-cyan-800/60 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-cyan-200">
                  Gotowe pliki Pandoc Markdown
                </span>
                <button
                  onClick={downloadAllAsZip}
                  className="py-1 px-3 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                >
                  <FolderArchive size={14} />
                  <span>Pobierz wszystkie (ZIP)</span>
                </button>
              </div>
              <p className="text-[11px] text-gray-300 font-sans leading-relaxed">
                Każdy plik zawiera pełny rękopis z nienaruszoną składnią Pandoc (<code>::: &#123;.chapter&#125;</code>, <code>[[TOC]]</code>, <code>[[PAGEBREAK]]</code>).
              </p>
            </div>

            <div className="space-y-2">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const transCount = Object.keys(langStates[lang.code]?.translatedChunks || {}).length;
                const total = chunks.length || 1;
                const isReady = transCount > 0;

                return (
                  <div
                    key={lang.code}
                    className={`p-2.5 rounded-lg border flex items-center justify-between ${
                      isReady ? 'bg-black/70 border-cyan-700/70' : 'bg-black/40 border-cyan-950 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-cyan-200">
                        ms_{lang.code}.md ({lang.native})
                      </div>
                      <div className="text-[10px] text-gray-400 font-sans">
                        Fragmenty: {transCount}/{total} {transCount === total && '• 100% gotowe'}
                      </div>
                    </div>

                    <button
                      onClick={() => downloadSingleLanguage(lang.code)}
                      disabled={!isReady}
                      className="py-1 px-2.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-600 disabled:opacity-30 text-cyan-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download size={12} />
                      <span>Pobierz ms_{lang.code}.md</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
