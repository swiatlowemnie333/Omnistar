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
      {/* LEWY PANEL BOCZNY: Czat / Most PC / Rada / Tłumacz / Klucze */}
      <div className="w-84 md:w-[460px] lg:w-[490px] flex-shrink-0 z-20 h-full relative shadow-[0_0_30px_rgba(0,0,0,0.8)] border-r border-cyan-950">
        <ChatPanel />
        <ModelWizard />
        <ExamPanel />
      <RealCouncil />
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


// =====================================================================================
// KREATOR MODELI: „chcę dodać nowy model” -> okienko -> klucz -> test -> rejestr.
// Klucze zostają w przeglądarce (localStorage 'omnistar_custom_models'); serwer używa ich tylko do testu.
// =====================================================================================
type CustomModel = { id: string; name: string; baseUrl: string; model: string; apiKey: string; addedAt: number; lastTest?: { ok: boolean; latencyMs: number; at: number; reply?: string; error?: string } };
const MODEL_PRESETS: { name: string; baseUrl: string; model: string; hint: string }[] = [
  { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'nvidia/nemotron-3-ultra-550b-a55b:free', hint: 'Setki modeli pod jednym kluczem (openrouter.ai/keys).' },
  { name: 'Inception (Mercury)', baseUrl: 'https://api.inceptionlabs.ai/v1', model: 'mercury-3', hint: 'Szybki model dyfuzyjny Mercury 3 (platform.inceptionlabs.ai).' },
  { name: 'Hugging Face', baseUrl: 'https://router.huggingface.co/v1', model: '', hint: 'Router Hugging Face, token z huggingface.co/settings/tokens.' },
  { name: 'Google AI Studio', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', hint: 'Klucz z aistudio.google.com, tryb zgodny z OpenAI.' },
  { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: '', hint: 'Klucz z console.groq.com.' },
  { name: 'Alibaba (Qwen)', baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', hint: 'Alibaba Cloud Model Studio, klucz z modelstudio.console.alibabacloud.com. Klucze są regionalne: Singapur dashscope-intl, USA dashscope-us, Pekin dashscope. Włącz „Free quota only”, żeby po darmowej puli nic nie naliczali.' },
  { name: 'Inny (zgodny z OpenAI)', baseUrl: '', model: '', hint: 'Dowolny dostawca z endpointem /chat/completions.' }
];
const KEY_SOURCES: { match: string; name: string; url: string; free: string; steps: string[] }[] = [
  { match: 'generativelanguage', name: 'Google AI Studio (Gemini)', url: 'https://aistudio.google.com/apikey', free: 'darmowy limit dzienny na modele Flash', steps: ['Zaloguj się kontem Google.', 'Kliknij „Create API key” (Utwórz klucz API).', 'Wybierz projekt lub „Create in new project”.', 'Skopiuj klucz (zaczyna się od AIza) i wklej go poniżej.'] },
  { match: 'groq.com', name: 'Groq', url: 'https://console.groq.com/keys', free: 'darmowy plan z limitami na minutę', steps: ['Zaloguj się (Google lub e-mail).', 'Kliknij „Create API Key”, wpisz dowolną nazwę.', 'Skopiuj klucz (gsk_…). Pokazuje się tylko raz.'] },
  { match: 'openrouter', name: 'OpenRouter', url: 'https://openrouter.ai/workspaces/default/keys', free: 'modele z dopiskiem :free', steps: ['Zaloguj się.', 'Kliknij „Create Key”, nazwij go, limit kredytów zostaw pusty albo 0.', 'Skopiuj klucz (sk-or-…). Pokazuje się tylko raz.'] },
  { match: 'huggingface', name: 'Hugging Face', url: 'https://huggingface.co/settings/tokens', free: 'miesięczna darmowa pula na Inference Providers', steps: ['Zaloguj się.', 'Kliknij „Create new token”.', 'Typ: „Fine-grained”, zaznacz tylko „Make calls to Inference Providers”.', 'Kliknij „Create token” i skopiuj (hf_…).'] },
  { match: 'inceptionlabs', name: 'Inception (Mercury)', url: 'https://platform.inceptionlabs.ai/', free: 'darmowe tokeny na start', steps: ['Zaloguj się na platformie.', 'W menu otwórz „API Keys”.', 'Utwórz nowy klucz i skopiuj go.'] },
  { match: 'dashscope', name: 'Alibaba Model Studio (Qwen)', url: 'https://bailian.console.alibabacloud.com/?apiKey=1', free: 'darmowa pula tokenów na nowe modele (region Singapur)', steps: ['Zaloguj się, region w prawym górnym rogu: Singapore.', 'Najpierw włącz „Free quota only”, żeby nic nie naliczali.', 'Po lewej „API Key”, potem „Create API Key”.', 'NIE twórz AccessKey (RAM) ani klucza Coding Plan: to nie te.'] },
  { match: 'mistral', name: 'Mistral', url: 'https://console.mistral.ai/api-keys', free: 'darmowy plan eksperymentalny', steps: ['Zaloguj się, wybierz plan „Experiment” (darmowy, wymaga numeru telefonu).', 'Kliknij „Create new key”.', 'Skopiuj klucz.'] },
  { match: 'cerebras', name: 'Cerebras', url: 'https://cloud.cerebras.ai/', free: 'źródła się różnią: darmowy limit albo 5 $ kredytu po podpięciu karty. Nie podpinaj karty bez decyzji', steps: ['Zaloguj się.', 'Po lewej „API Keys”.', 'Skopiuj lub utwórz klucz (csk-…).'] },
  { match: 'integrate.api.nvidia.com', name: 'NVIDIA NIM', url: 'https://build.nvidia.com/settings/api-keys', free: '139 modeli, do 40 zapytań/min; wymaga weryfikacji telefonu', steps: ['Zarejestruj się lub zaloguj.','Kliknij „Otwórz stronę klucza” i utwórz nowy klucz (Create / New API key).','Skopiuj klucz i wklej go niżej, potem „Rozpoznaj”.'] },
  { match: 'modelscope', name: 'ModelScope', url: 'https://modelscope.cn/my/myaccesstoken', free: '61 modeli; Qwen3.5: 2000 zapytań/dzień', steps: ['Zarejestruj się lub zaloguj.','Kliknij „Otwórz stronę klucza” i utwórz nowy klucz (Create / New API key).','Skopiuj klucz i wklej go niżej, potem „Rozpoznaj”.'] },
  { match: 'cloudflare.com', name: 'Cloudflare Workers AI', url: 'https://dash.cloudflare.com/profile/api-tokens', free: '46 modeli; 10 tys. „neuronów” dziennie; adres API wymaga ID konta', steps: ['Zarejestruj się lub zaloguj.','Kliknij „Otwórz stronę klucza” i utwórz nowy klucz (Create / New API key).','Skopiuj klucz i wklej go niżej, potem „Rozpoznaj”.'] },
  { match: 'opencode.ai', name: 'OpenCode Zen', url: 'https://opencode.ai/auth', free: '34 modele; limitu nie podano', steps: ['Zarejestruj się lub zaloguj.','Kliknij „Otwórz stronę klucza” i utwórz nowy klucz (Create / New API key).','Skopiuj klucz i wklej go niżej, potem „Rozpoznaj”.'] },
  { match: 'kilo.ai', name: 'Kilo Code', url: 'https://app.kilo.ai/profile', free: '29 modeli; 200 zapytań/godz.', steps: ['Zarejestruj się lub zaloguj.','Kliknij „Otwórz stronę klucza” i utwórz nowy klucz (Create / New API key).','Skopiuj klucz i wklej go niżej, potem „Rozpoznaj”.'] },
  { match: 'llm7.io', name: 'LLM7.io', url: 'https://token.llm7.io', free: '24 modele; 60/min, 250/godz.', steps: ['Zarejestruj się lub zaloguj.','Kliknij „Otwórz stronę klucza” i utwórz nowy klucz (Create / New API key).','Skopiuj klucz i wklej go niżej, potem „Rozpoznaj”.'] },
  { match: 'ollama.com', name: 'Ollama Cloud', url: 'https://ollama.com/settings/keys', free: '17 modeli; 1 zapytanie naraz; API niezgodne z OpenAI', steps: ['Zarejestruj się lub zaloguj.','Kliknij „Otwórz stronę klucza” i utwórz nowy klucz (Create / New API key).','Skopiuj klucz i wklej go niżej, potem „Rozpoznaj”.'] },
  { match: 'ovh.net', name: 'OVHcloud AI Endpoints', url: 'https://www.ovhcloud.com/en/public-cloud/ai-endpoints/catalog/', free: '16 modeli; bez klucza 2/min', steps: ['Zarejestruj się lub zaloguj.','Kliknij „Otwórz stronę klucza” i utwórz nowy klucz (Create / New API key).','Skopiuj klucz i wklej go niżej, potem „Rozpoznaj”.'] },
  { match: 'cohere', name: 'Cohere', url: 'https://dashboard.cohere.com/api-keys', free: '12 modeli, klucz Trial; 20 zapytań/min', steps: ['Zarejestruj się lub zaloguj.','Kliknij „Otwórz stronę klucza” i utwórz nowy klucz (Create / New API key).','Skopiuj klucz i wklej go niżej, potem „Rozpoznaj”.'] },
  { match: 'aionlabs.ai', name: 'Aion Labs', url: 'https://www.aionlabs.ai/app/api-keys/', free: '11 modeli; 15/min, 20 tys. tokenów/dzień', steps: ['Zarejestruj się lub zaloguj.','Kliknij „Otwórz stronę klucza” i utwórz nowy klucz (Create / New API key).','Skopiuj klucz i wklej go niżej, potem „Rozpoznaj”.'] },
  { match: 'bigmodel.cn', name: 'Z AI (Zhipu, GLM)', url: 'https://open.bigmodel.cn/usercenter/apikeys', free: '8 modeli; 1 zapytanie naraz', steps: ['Zarejestruj się lub zaloguj.','Kliknij „Otwórz stronę klucza” i utwórz nowy klucz (Create / New API key).','Skopiuj klucz i wklej go niżej, potem „Rozpoznaj”.'] },
  { match: 'siliconflow', name: 'SiliconFlow', url: 'https://cloud.siliconflow.cn/account/ak', free: '6 modeli; limitu nie podano', steps: ['Zarejestruj się lub zaloguj.','Kliknij „Otwórz stronę klucza” i utwórz nowy klucz (Create / New API key).','Skopiuj klucz i wklej go niżej, potem „Rozpoznaj”.'] },
  { match: 'agnes-ai.com', name: 'Agnes AI', url: 'https://platform.agnes-ai.com/settings/apiKeys', free: '5 modeli; 30 zapytań/min', steps: ['Zarejestruj się lub zaloguj.','Kliknij „Otwórz stronę klucza” i utwórz nowy klucz (Create / New API key).','Skopiuj klucz i wklej go niżej, potem „Rozpoznaj”.'] },
  { match: 'gonkabroker', name: 'Gonka Broker', url: 'https://app.gonkabroker.com/signup', free: '4 modele; ok. 1 mln tokenów/mies.', steps: ['Zarejestruj się lub zaloguj.','Kliknij „Otwórz stronę klucza” i utwórz nowy klucz (Create / New API key).','Skopiuj klucz i wklej go niżej, potem „Rozpoznaj”.'] },
  { match: 'sambanova', name: 'SambaNova', url: 'https://cloud.sambanova.ai/apis', free: '4 modele; 20/min, 20/dzień, 200 tys. tokenów/dzień', steps: ['Zarejestruj się lub zaloguj.','Kliknij „Otwórz stronę klucza” i utwórz nowy klucz (Create / New API key).','Skopiuj klucz i wklej go niżej, potem „Rozpoznaj”.'] },
  { match: 'x.ai', name: 'xAI (Grok)', url: 'https://console.x.ai', free: 'źródła się różnią: kredyty albo płatne za token. Sprawdź przed użyciem', steps: ['Zarejestruj się lub zaloguj.','Kliknij „Otwórz stronę klucza” i utwórz nowy klucz (Create / New API key).','Skopiuj klucz i wklej go niżej, potem „Rozpoznaj”.'] },
  { match: 'chutes.ai', name: 'Chutes.ai', url: 'https://chutes.ai/', free: '2 modele; społecznościowe', steps: ['Zarejestruj się lub zaloguj.','Kliknij „Otwórz stronę klucza” i utwórz nowy klucz (Create / New API key).','Skopiuj klucz i wklej go niżej, potem „Rozpoznaj”.'] },
  { match: 'glhf.chat', name: 'Glhf.chat', url: 'https://glhf.chat/', free: '2 modele', steps: ['Zarejestruj się lub zaloguj.','Kliknij „Otwórz stronę klucza” i utwórz nowy klucz (Create / New API key).','Skopiuj klucz i wklej go niżej, potem „Rozpoznaj”.'] },
  { match: 'ai21.com', name: 'AI21 Labs', url: 'https://studio.ai21.com/account/api-key', free: '2 modele; 200/min', steps: ['Zarejestruj się lub zaloguj.','Kliknij „Otwórz stronę klucza” i utwórz nowy klucz (Create / New API key).','Skopiuj klucz i wklej go niżej, potem „Rozpoznaj”.'] },
  { match: 'deepseek', name: 'DeepSeek', url: 'https://platform.deepseek.com/api_keys', free: '2 modele; limity dynamiczne (inne źródła: brak stałego darmowego planu)', steps: ['Zarejestruj się lub zaloguj.','Kliknij „Otwórz stronę klucza” i utwórz nowy klucz (Create / New API key).','Skopiuj klucz i wklej go niżej, potem „Rozpoznaj”.'] },
  { match: 'nscale', name: 'Nscale', url: 'https://console.nscale.com/', free: '2 modele; „fair use”', steps: ['Zarejestruj się lub zaloguj.','Kliknij „Otwórz stronę klucza” i utwórz nowy klucz (Create / New API key).','Skopiuj klucz i wklej go niżej, potem „Rozpoznaj”.'] },
  { match: 'nebius', name: 'Nebius', url: 'https://studio.nebius.com/settings/api-keys', free: '1 model; zależnie od poziomu konta', steps: ['Zarejestruj się lub zaloguj.','Kliknij „Otwórz stronę klucza” i utwórz nowy klucz (Create / New API key).','Skopiuj klucz i wklej go niżej, potem „Rozpoznaj”.'] }
];
const loadModels = (): CustomModel[] => { try { return JSON.parse(localStorage.getItem('omnistar_custom_models') || '[]'); } catch { return []; } };
const saveModels = (m: CustomModel[]) => { try { localStorage.setItem('omnistar_custom_models', JSON.stringify(m)); } catch { /* ignore */ } };
async function testModel(baseUrl: string, model: string, apiKey: string) {
  const r = await fetch('/api/models/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl, model, apiKey }) });
  return r.json();
}

function ModelWizard() {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<CustomModel[]>(() => (typeof window !== 'undefined' ? loadModels() : []));
  const [preset, setPreset] = useState(0);
  const [baseUrl, setBaseUrl] = useState(MODEL_PRESETS[0].baseUrl);
  const [model, setModel] = useState(MODEL_PRESETS[0].model);
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [ksFilter, setKsFilter] = useState('');
  const [msg, setMsg] = useState<string>('Cześć! Wklej sam klucz API: rozpoznam dostawcę, znajdę dostępne modele i podpowiem najlepszy. Możesz też wybrać dostawcę ręcznie.');
  const [found, setFound] = useState<{ id: string; free: boolean; context: number | null }[]>([]);
  const [filter, setFilter] = useState('');
  const detect = async () => {
    setBusy(true); setMsg('Rozpoznaję klucz…'); setFound([]);
    try {
      const r = await (await fetch('/api/models/detect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: apiKey.trim() }) })).json();
      if (r.ok) {
        setBaseUrl(r.baseUrl); setFound(r.models); const best = r.models[0]?.id || ''; setModel(best);
        const i = MODEL_PRESETS.findIndex((p) => p.baseUrl === r.baseUrl); setPreset(i >= 0 ? i : MODEL_PRESETS.length - 1);
        const free = r.models.filter((m: any) => m.free).length;
        setMsg(`To klucz: ${r.provider}. Dostępnych modeli: ${r.models.length}${free ? ` (darmowych: ${free}, oznaczone 🆓)` : ''}. Zaznaczyłem: ${best}. Wybierz inny z listy albo kliknij „Testuj i dodaj”.`);
      } else setMsg(`${r.error} Sprawdzone: ${(r.tried || []).join('; ')}. Wybierz dostawcę ręcznie.`);
    } catch (e: any) { setMsg('Błąd połączenia z serwerem: ' + (e?.message || e)); }
    setBusy(false);
  };

  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener('omnistar:open-model-wizard', h);
    return () => window.removeEventListener('omnistar:open-model-wizard', h);
  }, []);
  const pick = (i: number) => { setPreset(i); setBaseUrl(MODEL_PRESETS[i].baseUrl); setModel(MODEL_PRESETS[i].model); setMsg(MODEL_PRESETS[i].hint); };

  const add = async () => {
    if (!baseUrl.startsWith('https://')) { setMsg('Adres musi zaczynać się od https://'); return; }
    if (!model.trim()) { setMsg('Podaj nazwę (id) modelu, np. mercury-3.'); return; }
    if (!apiKey.trim()) { setMsg('Wklej klucz API.'); return; }
    setBusy(true); setMsg('Testuję model…');
    try {
      let t = await testModel(baseUrl.trim(), model.trim(), apiKey.trim());
      let chosen = model.trim();
      if (!t.ok && found.length > 1) {
        const errs: string[] = [`${chosen}: ${String(t.error || '').slice(0, 80)}`];
        for (const cand of found.map((f) => f.id).filter((id) => id !== chosen).slice(0, 8)) {
          setMsg(`${chosen} nie działa na tym kluczu, próbuję ${cand}…`);
          const t2 = await testModel(baseUrl.trim(), cand, apiKey.trim());
          if (t2.ok) { t = t2; chosen = cand; setModel(cand); break; }
          errs.push(`${cand}: ${String(t2.error || '').slice(0, 60)}`);
        }
        if (!t.ok) t = { ...t, error: errs.join(' | ') };
      }
      const entry: CustomModel = { id: `${Date.now()}`, name: name.trim() || `${MODEL_PRESETS[preset].name}: ${chosen}`, baseUrl: baseUrl.trim(), model: chosen, apiKey: apiKey.trim(), addedAt: Date.now(),
        lastTest: { ok: !!t.ok, latencyMs: t.latencyMs ?? 0, at: Date.now(), reply: t.reply, error: t.error } };
      if (t.ok) {
        const next = [...models, entry]; setModels(next); saveModels(next); setApiKey('');
        setMsg(`Dodano „${entry.name}”. Odpowiedział w ${t.latencyMs} ms: „${String(t.reply || '').slice(0, 80)}”.`);
      } else setMsg(`Test nieudany, nie dodano: ${t.error || 'brak odpowiedzi'}. Sprawdź klucz, adres i nazwę modelu.`);
    } catch (e: any) { setMsg('Błąd połączenia z serwerem: ' + (e?.message || e)); }
    setBusy(false);
  };
  const retest = async (m: CustomModel) => {
    setBusy(true);
    const t = await testModel(m.baseUrl, m.model, m.apiKey).catch((e) => ({ ok: false, error: String(e) }));
    const next = models.map((x) => (x.id === m.id ? { ...x, lastTest: { ok: !!t.ok, latencyMs: t.latencyMs ?? 0, at: Date.now(), reply: t.reply, error: t.error } } : x));
    setModels(next); saveModels(next); setBusy(false);
  };
  const remove = (id: string) => { const next = models.filter((x) => x.id !== id); setModels(next); saveModels(next); };

  return (
    <>
      <button onClick={() => setOpen(true)} className="fixed bottom-4 right-4 z-50 px-3 py-2 rounded-lg bg-cyan-900/90 border border-cyan-500 text-cyan-100 text-xs font-mono hover:bg-cyan-800 shadow-lg">+ Dodaj model</button>
      {open && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-xl bg-[#071322] border border-cyan-700 rounded-xl p-5 text-sm text-gray-200 font-mono space-y-3 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center"><h2 className="text-cyan-200 font-bold text-base">Agent modeli: dodaj nowy model</h2><button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white">✕</button></div>
            <div className="bg-cyan-950/50 border border-cyan-900 rounded p-2 text-cyan-100">{msg}</div>
            <div className="border border-fuchsia-800 rounded p-2 bg-fuchsia-950/20 space-y-1">
              <div className="text-fuchsia-200 font-bold">🚀 Dział Innowacji – propozycje dnia</div>
              <div className="text-[11px] text-fuchsia-100/70">Codziennie 3 darmowe źródła, których jeszcze nie masz. Kliknij, wygeneruj klucz na stronie dostawcy, wklej niżej i „Rozpoznaj”.</div>
              {(() => { const missing = KEY_SOURCES.filter((s) => !models.some((x) => x.baseUrl.includes(s.match))); const day = Math.floor(Date.now() / 86400000); const pick = missing.length <= 3 ? missing : [0, 1, 2].map((k) => missing[(day * 3 + k) % missing.length]); return pick.length ? pick.map((s) => (
                <div key={s.name} className="flex justify-between items-center gap-2 text-xs"><span><b className="text-fuchsia-100">{s.name}</b> <span className="text-emerald-300">🆓 {s.free}</span></span><a href={s.url} target="_blank" rel="noopener noreferrer" className="px-2 py-0.5 rounded bg-fuchsia-800 hover:bg-fuchsia-700 text-white whitespace-nowrap">Wygeneruj klucz ↗</a></div>)) : <div className="text-xs text-emerald-300">Masz już wszystkie źródła z katalogu 🎉</div>; })()}
            </div>
            <details className="border border-amber-800 rounded p-2 bg-amber-950/20">
              <summary className="cursor-pointer text-amber-200 font-bold">🔑 Nie masz klucza? Pokażę, gdzie go wygenerować</summary>
              <div className="mt-2 space-y-2">
                <div className="text-amber-100/80 text-xs">Kliknij dostawcę: otworzy się strona tworzenia klucza. Klucz tworzysz i kopiujesz sam, potem wklejasz go niżej i klikasz „Rozpoznaj”. Nikomu nie podawaj klucza ani hasła; jedno konto na osobę.</div>
                <input value={ksFilter} onChange={(e) => setKsFilter(e.target.value)} placeholder={'szukaj wśród ' + KEY_SOURCES.length + ' dostawców'} className="w-full bg-black/60 border border-amber-900 rounded px-2 py-1 text-xs" />
                <div className="text-[10px] text-gray-500">Pierwsze 8: sprawdzone przez nas. Reszta: katalog freellm.net / awesome-freellm-apis, stan 2026-11-09. Limity się zmieniają, sprawdzaj na stronie dostawcy.</div>
                {KEY_SOURCES.filter((s) => (s.name + ' ' + s.free).toLowerCase().includes(ksFilter.toLowerCase())).map((s) => (
                  <div key={s.name} className="border border-amber-900/60 rounded p-2">
                    <div className="flex justify-between items-center gap-2"><span className="text-amber-100 font-bold">{s.name} {(() => { const mine = models.filter((x) => x.baseUrl.includes(s.match)); if (!mine.length) return <span className="ml-1 text-[10px] px-1 rounded bg-gray-700 text-gray-300">nie mam</span>; if (mine.some((x) => x.lastTest?.ok)) return <span className="ml-1 text-[10px] px-1 rounded bg-emerald-800 text-emerald-100">działa ✓</span>; return <span className="ml-1 text-[10px] px-1 rounded bg-red-900 text-red-100">mam, ale test nieudany</span>; })()}</span><a href={s.url} target="_blank" rel="noopener noreferrer" className="px-2 py-0.5 rounded bg-amber-800 hover:bg-amber-700 text-white text-xs whitespace-nowrap">Otwórz stronę klucza ↗</a></div>
                    <div className="text-[11px] text-emerald-300">🆓 {s.free}</div>
                    <ol className="list-decimal ml-5 text-xs text-gray-300">{s.steps.map((t, i) => <li key={i}>{t}</li>)}</ol>
                  </div>
                ))}
              </div>
            </details>
            <div className="border border-cyan-800 rounded p-2 space-y-2 bg-black/30">
              <div className="text-cyan-300 font-bold">Masz tylko klucz? Wklej go, resztę znajdę sam.</div>
              <div className="flex gap-2"><input type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="flex-1 bg-black/60 border border-cyan-900 rounded px-2 py-1" placeholder="wklej klucz API" /><button disabled={busy || !apiKey.trim()} onClick={detect} className="px-3 rounded bg-cyan-800 hover:bg-cyan-700 disabled:opacity-50 text-white">Rozpoznaj</button></div>
              {found.length > 0 && (<>
                <input value={filter} onChange={(e) => setFilter(e.target.value)} className="w-full bg-black/60 border border-cyan-900 rounded px-2 py-1 text-xs" placeholder={`szukaj wśród ${found.length} modeli…`} />
                <select size={6} value={model} onChange={(e) => setModel(e.target.value)} className="w-full bg-black/60 border border-cyan-900 rounded text-xs">
                  {found.filter((m) => !filter || m.id.toLowerCase().includes(filter.toLowerCase())).slice(0, 200).map((m) => (<option key={m.id} value={m.id}>{m.free ? '🆓 ' : ''}{m.id}{m.context ? ` · ${Math.round(m.context / 1000)}k` : ''}</option>))}
                </select>
              </>)}
            </div>
            <div className="text-xs text-gray-400">albo ręcznie:</div>
            <div className="flex flex-wrap gap-1.5">{MODEL_PRESETS.map((p, i) => (
              <button key={p.name} onClick={() => pick(i)} className={`px-2 py-1 rounded border text-xs ${i === preset ? 'border-cyan-400 bg-cyan-900 text-white' : 'border-cyan-900 text-gray-300 hover:border-cyan-600'}`}>{p.name}</button>))}</div>
            <label className="block">Adres API<input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="mt-1 w-full bg-black/60 border border-cyan-900 rounded px-2 py-1" placeholder="https://…/v1" /></label>
            <label className="block">Model (id)<input value={model} onChange={(e) => setModel(e.target.value)} className="mt-1 w-full bg-black/60 border border-cyan-900 rounded px-2 py-1" placeholder="np. mercury-3" /></label>
            <label className="block">Nazwa w rejestrze (opcjonalnie)<input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full bg-black/60 border border-cyan-900 rounded px-2 py-1" placeholder="np. Beta – recenzent" /></label>
            <button disabled={busy} onClick={add} className="w-full py-2 rounded bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white font-bold">{busy ? 'Testuję…' : 'Testuj i dodaj'}</button>
            <div className="bg-cyan-950/50 border border-cyan-900 rounded p-2 text-cyan-100 text-xs">{msg}</div>
            <div className="text-xs text-gray-400">Klucze zostają w tej przeglądarce. Serwer używa klucza tylko do testowego wywołania i niczego nie zapisuje.</div>
            <div>
              <div className="text-cyan-300 font-bold mb-1">Rejestr modeli ({models.length})</div>
              {models.length === 0 && <div className="text-gray-500 text-xs">Pusto.</div>}
              {models.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 border-b border-cyan-950 py-1.5 text-xs">
                  <div><div className="text-white">{m.lastTest?.ok ? '🟢' : '🔴'} {m.name}</div><div className="text-gray-500">{m.model} · {m.lastTest ? `${m.lastTest.latencyMs} ms · ${new Date(m.lastTest.at).toLocaleString('pl-PL')}` : 'nie testowano'}</div></div>
                  <div className="flex gap-1"><button disabled={busy} onClick={() => retest(m)} className="px-2 py-0.5 border border-cyan-800 rounded hover:border-cyan-500">test</button><button onClick={() => remove(m.id)} className="px-2 py-0.5 border border-red-900 rounded text-red-300 hover:border-red-500">usuń</button></div>
                </div>))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}


// =====================================================================================
// EGZAMIN ALFA/BETA: dwa niezależne zespoły (różne modele z rejestru), 4 przypadki z kluczem,
// runda 2 = pętla ujemnego sprzężenia (każdy widzi werdykt drugiego) -> stabilność.
// =====================================================================================
const EXAM_HEAD = 'Jesteś niezależnym recenzentem w projekcie zwijania białek SNAPLOCK (metryka: CA-RMSD do struktury z PDB, mniej = lepiej; testy na ślepo). Oceń JEDEN wynik badawczy przed wpisaniem do dziennika. Nie zakładaj z góry, że jest zły ani dobry. Odpowiedz DOKŁADNIE w formacie:\nWERDYKT: PRZYJMUJĘ albo ODRZUCAM\nPOWÓD: maksymalnie 80 słów, konkretnie co jest błędne lub poprawne w metodzie, danych albo wniosku.';
const EXAM_CASES: { title: string; level: Level; key: 'ODRZUCAM' | 'PRZYJMUJĘ'; text: string }[] = [
  { title: 'Energia z wyłączonymi MJ i H', level: 'medium', key: 'ODRZUCAM', text: 'Wygenerowano 16 prób krambiny (46 aa) z ustawieniami mjContactScale: 0, hBondScale: 0. Energię każdej próby liczono jako E = soapBubbleEnergy + vdwEnergy + clampEnergy + softSnapEnergy z tej samej symulacji (kontakty Miyazawa-Jernigan i wiązania wodorowe szkieletu są dodawane do soapBubbleEnergy tylko gdy mjScale>0 / hbScale>0). Korelacja Spearmana energia–RMSD = −0,24. Wniosek autora: funkcja energii silnika SNAPLOCK nie odróżnia dobrych struktur od złych, należy ją zastąpić.' },
  { title: 'Natywne z rekonstrukcji, ujemna waga VdW', level: 'hard', key: 'ODRZUCAM', text: 'Dane treningowe do uczenia wag energii: 47 białek z PDB. Strukturę natywną każdego białka odtworzono z jej kątów φ/ψ (NeRF, idealna geometria wiązań); RMSD rekonstrukcji do PDB 0,9–5,5 Å. Kara VdW (twarde zderzenia): natywne 138–494, próby Monte Carlo 1–11; w 43 z 47 białek natywna ma wyższą karę. Uczenie rankingowe dało wagę VdW = −0,42. Wniosek autora: w prawdziwych białkach bliskie zbliżenia są korzystne, karę za zderzenia trzeba odwrócić.' },
  { title: 'Runda 3: −38849 przy 38 Å', level: 'easy', key: 'ODRZUCAM', text: 'Wagi energii po rundzie 3 uczenia w pętli: napięcie +0,73, VdW +0,30, mostki S–S −0,08, sprężyny +0,07, MJ +0,13, wiązania H +0,19, zakopywanie −0,01, pary PDB −0,14, zwartość −0,16. Walidacja krzyżowa: korelacja +0,32. W przeszukiwaniu: krambina 38,56±0,30 Å przy energii −38849; energia natywnej krambiny +10,4. Ubikwityna 11,54 Å. Autor proponuje wdrożyć te wagi jako domyślne, bo przeszukiwanie znajduje stany o rekordowo niskiej energii.' },
  { title: 'FRAG+K na krambinie', level: 'hard', key: 'PRZYJMUJĘ', text: 'Krambina, 6 startów na wariant, ten sam budżet 6000 kroków. Zwykłe Monte Carlo: 8,60±0,53 Å. FRAG+K (fragmenty z PDB + energia wyuczona na 45 białkach; krambina i ubikwityna wykluczone z treningu i biblioteki): 7,18±1,26 Å. Energia natywnej krambiny −131,7, średnia energia prób −94,6. Na ubikwitynie ten sam wariant był gorszy (13,08 vs 11,43 Å). Autor wpisuje do dziennika: FRAG+K obiecujący na krambinie (test t Welcha p≈0,04 dla jednego białka), na ubikwitynie pogorszenie; wymaga potwierdzenia na nowych startach i białkach.' }
];
const parseVerdict = (t: string): 'ODRZUCAM' | 'PRZYJMUJĘ' | '?' => { const m = (t || '').toUpperCase().match(/WERDYKT\W*\s*(PRZYJMUJ[EĘ]|ODRZUCAM)/); if (m) return m[1].startsWith('ODR') ? 'ODRZUCAM' : 'PRZYJMUJĘ'; if (/ODRZUCAM/i.test(t)) return 'ODRZUCAM'; if (/PRZYJMUJ/i.test(t)) return 'PRZYJMUJĘ'; return '?'; };
async function askModel(m: CustomModel, user: string) {
  const r = await fetch('/api/models/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: m.baseUrl, model: m.model, apiKey: m.apiKey, max_tokens: 900, messages: [{ role: 'user', content: user }] }) });
  const d = await r.json();
  try { recordCall(m, !!d.ok, d.latencyMs || 0, d.usage?.completion_tokens || 0); } catch { /* ignore */ }
  return d.ok ? String(d.content || '') : `BŁĄD: ${d.error}`;
}

function ExamPanel() {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<CustomModel[]>([]);
  const [alfa, setAlfa] = useState<string[]>([]); const [beta, setBeta] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]); const [log, setLog] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { const ms = loadModels().filter((m) => m.lastTest?.ok); setModels(ms); if (!alfa.length && !beta.length && ms.length >= 2) { const t = autoTeams(ms, Math.min(3, Math.floor(ms.length / 2))); setAlfa(t.A.map((m) => m.id)); setBeta(t.B.map((m) => m.id)); } } }, [open]);
  const toggle = (team: 'a' | 'b', id: string) => { const [v, set] = team === 'a' ? [alfa, setAlfa] : [beta, setBeta]; set(v.includes(id) ? v.filter((x) => x !== id) : [...v, id]); };
  // kolejka per dostawca: wywołania do tego samego adresu idą po kolei (limity), różni dostawcy równolegle
  const queues: Record<string, Promise<any>> = {};
  const ask = (m: CustomModel, prompt: string) => { const k = m.baseUrl; const p = (queues[k] || Promise.resolve()).then(() => askModel(m, prompt)); queues[k] = p.catch(() => {}); return p; };
  const majority = (vs: string[]) => { const a = vs.filter((v) => v === 'ODRZUCAM').length, p = vs.filter((v) => v === 'PRZYJMUJĘ').length; return a > p ? 'ODRZUCAM' : p > a ? 'PRZYJMUJĘ' : 'SPORNY'; };
  const run = async () => {
    const A = models.filter((m) => alfa.includes(m.id)), B = models.filter((m) => beta.includes(m.id));
    if (!A.length || !B.length) { setLog('Zaznacz co najmniej jeden model w Alfie i w Becie.'); return; }
    if (A.some((m) => B.some((n) => n.baseUrl === m.baseUrl && n.model === m.model))) { setLog('Ten sam model nie może być w obu zespołach, inaczej to nie są niezależne zespoły.'); return; }
    setBusy(true); const out: any[] = [];
    for (const [i, c] of EXAM_CASES.entries()) {
      setLog(`Przypadek ${i + 1}/4, runda 1: ${A.length + B.length} modeli niezależnie…`);
      const prompt1 = `${EXAM_HEAD}\n\nWYNIK: ${c.text}`;
      const r1 = await Promise.all([...A, ...B].map((m) => ask(m, prompt1)));
      const a1 = r1.slice(0, A.length), b1 = r1.slice(A.length);
      const va1 = a1.map(parseVerdict), vb1 = b1.map(parseVerdict);
      const ta1 = majority(va1), tb1 = majority(vb1);
      const pick = (txts: string[], vs: string[], team: string) => txts.find((t, j) => vs[j] === team && !t.startsWith('BŁĄD')) || '';
      const repA = pick(a1, va1, ta1), repB = pick(b1, vb1, tb1);
      setLog(`Przypadek ${i + 1}/4, runda 2: pętla z regułą ambasadora…`);
      const p2 = (own: string, otherTeam: string, otherRep: string) => `${prompt1}\n\nTwoja wcześniejsza ocena:\n${own}\n\nDrugi, niezależny zespół (głosowanie większością) zdecydował: ${otherTeam}. Jego uzasadnienie:\n${otherRep}\n\nREGUŁA: werdykt wolno zmienić TYLKO jeśli wskażesz konkretny błąd w danych lub rozumowaniu. Jeśli zmieniasz werdykt, zacznij POWÓD od słów „BŁĄD W DANYCH:”. Jeśli nie znajdujesz takiego błędu, podtrzymaj werdykt. Ten sam format odpowiedzi.`;
      const canR2 = (repA && repB);
      const r2 = canR2 ? await Promise.all([...A.map((m, j) => ask(m, p2(a1[j], tb1, repB))), ...B.map((m, j) => ask(m, p2(b1[j], ta1, repA)))]) : r1;
      // ambasador: zmiana werdyktu bez wskazania błędu = cofnięta
      const enforce = (t1: string, t2: string) => { const v1 = parseVerdict(t1), v2 = parseVerdict(t2); if (v2 !== v1 && !/BŁĄD W DANYCH/i.test(t2)) return { v: v1, reverted: true }; return { v: v2, reverted: false }; };
      const ea = r2.slice(0, A.length).map((t, j) => enforce(a1[j], t)), eb = r2.slice(A.length).map((t, j) => enforce(b1[j], t));
      const va2 = ea.map((x) => x.v), vb2 = eb.map((x) => x.v);
      // nauka orkiestratora: każdy werdykt z rundy 1 (niezależny) porównany z kluczem
      [...A, ...B].forEach((m, j) => { const v = [...va1, ...vb1][j]; if (v !== '?') recordGrade(m, c.level, v === c.key); });
      out.push({ case: i + 1, title: c.title, key: c.key, alfa: [ta1, majority(va2)], beta: [tb1, majority(vb2)], alfaVotes: [va1.join('/'), va2.join('/')], betaVotes: [vb1.join('/'), vb2.join('/')], reverted: [...ea, ...eb].filter((x) => x.reverted).length, texts: r2.map((t) => t.slice(0, 500)) });
      setRows([...out]);
    }
    const score = (t: 'alfa' | 'beta', r: number) => out.filter((o) => o[t][r] === o.key).length;
    const agree = out.filter((o) => o.alfa[1] === o.beta[1]).length; const rev = out.reduce((s, o) => s + o.reverted, 0);
    const summary = `EGZAMIN ALFA/BETA (zespoły wielomodelowe) ${new Date().toLocaleString('pl-PL')}\nAlfa = ${A.map((m) => m.model).join(', ')}\nBeta = ${B.map((m) => m.model).join(', ')}\nTrafność zespołu r1 → r2: Alfa ${score('alfa', 0)}/4 → ${score('alfa', 1)}/4, Beta ${score('beta', 0)}/4 → ${score('beta', 1)}/4; zgodność zespołów po r2: ${agree}/4; zmian cofniętych przez ambasadora: ${rev}\n` + out.map((o) => `#${o.case} ${o.title} [klucz ${o.key}] Alfa ${o.alfa.join('→')} (głosy ${o.alfaVotes.join(' → ')}) | Beta ${o.beta.join('→')} (głosy ${o.betaVotes.join(' → ')})`).join('\n');
    setLog(summary);
    try { localStorage.setItem('omnistar_exam_last', JSON.stringify({ at: Date.now(), A: A.map((m) => m.model), B: B.map((m) => m.model), out })); } catch { /* ignore */ }
    fetch('/api/council/board/item', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'deliberation', agentName: 'Egzamin Alfa/Beta', provider: 'zespoły wielomodelowe', content: summary, thought: JSON.stringify(out.map((o) => ({ case: o.case, texts: o.texts }))) }) }).catch(() => {});
    setBusy(false);
  };
  const teamBox = (team: 'a' | 'b', sel: string[], label: string) => (
    <div className="border border-violet-900 rounded p-2"><div className="text-violet-300 font-bold mb-1">{label} ({sel.length})</div>
      {models.map((m) => { const other = team === 'a' ? beta : alfa; return (
        <label key={m.id} className={`flex items-center gap-2 text-xs py-0.5 ${other.includes(m.id) ? 'opacity-40' : ''}`}><input type="checkbox" disabled={other.includes(m.id)} checked={sel.includes(m.id)} onChange={() => toggle(team, m.id)} />{m.name}</label>); })}
    </div>);
  return (
    <>
      <button onClick={() => setOpen(true)} className="fixed bottom-4 right-36 z-50 px-3 py-2 rounded-lg bg-violet-900/90 border border-violet-500 text-violet-100 text-xs font-mono hover:bg-violet-800 shadow-lg">🧪 Egzamin Alfa/Beta</button>
      {open && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-3xl bg-[#0d0a1f] border border-violet-700 rounded-xl p-5 text-sm text-gray-200 font-mono space-y-3 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between"><h2 className="text-violet-200 font-bold text-base">Egzamin kalibracyjny: zespoły Alfa i Beta</h2><button disabled={busy} onClick={() => setOpen(false)} className="text-gray-400 hover:text-white">✕</button></div>
            <div className="text-xs text-gray-400">Każdy zespół może mieć kilka modeli; werdykt zespołu = głosowanie większością. Runda 2: zmiana werdyktu tylko ze wskazaniem błędu („BŁĄD W DANYCH:”), inaczej ambasador ją cofa. Najlepiej różne rodziny modeli w każdym zespole i nieparzysta liczba.</div>
            {models.length < 2 ? <div className="text-amber-300">Potrzebne co najmniej 2 działające modele w rejestrze (przycisk „+ Dodaj model”).</div> : (
              <><div className="flex items-center justify-between text-xs"><span className="text-violet-300">Zespoły ułożył orkiestrator (możesz poprawić ręcznie).</span><button disabled={busy} onClick={() => { const t = autoTeams(models, Math.min(3, Math.floor(models.length / 2))); setAlfa(t.A.map((m) => m.id)); setBeta(t.B.map((m) => m.id)); }} className="px-2 py-0.5 border border-violet-700 rounded hover:border-violet-400">Ułóż ponownie</button></div>
              <div className="grid grid-cols-2 gap-3">{teamBox('a', alfa, 'Alfa')}{teamBox('b', beta, 'Beta')}</div>
              <details className="text-xs"><summary className="cursor-pointer text-violet-300">Kartoteka modeli orkiestratora</summary><OrchestratorRanking models={models} /></details></>)}
            <button disabled={busy || models.length < 2} onClick={run} className="w-full py-2 rounded bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white font-bold">{busy ? 'Egzamin trwa…' : 'Start egzaminu'}</button>
            {rows.length > 0 && (
              <table className="w-full text-xs border-collapse"><thead><tr className="text-violet-300"><th className="text-left">#</th><th className="text-left">Przypadek</th><th>Klucz</th><th>Alfa r1→r2 (głosy)</th><th>Beta r1→r2 (głosy)</th></tr></thead>
                <tbody>{rows.map((o) => (<tr key={o.case} className="border-t border-violet-950"><td>{o.case}</td><td>{o.title}</td><td className="text-center">{o.key}</td>
                  <td className={`text-center ${o.alfa[1] === o.key ? 'text-green-400' : 'text-red-400'}`}>{o.alfa.join(' → ')}<div className="text-gray-500">{o.alfaVotes.join(' → ')}</div></td>
                  <td className={`text-center ${o.beta[1] === o.key ? 'text-green-400' : 'text-red-400'}`}>{o.beta.join(' → ')}<div className="text-gray-500">{o.betaVotes.join(' → ')}</div></td></tr>))}</tbody></table>)}
            {log && <pre className="whitespace-pre-wrap bg-violet-950/40 border border-violet-900 rounded p-2 text-xs text-violet-100">{log}</pre>}
          </div>
        </div>)}
    </>
  );
}


// =====================================================================================
// ORKIESTRATOR UCZĄCY SIĘ: kartoteka modeli + trudność zadania + wybór (Thompson sampling z karą kosztu)
// + automatyczne składanie zespołów. Dane w localStorage 'omnistar_model_stats'.
// =====================================================================================
type Level = 'easy' | 'medium' | 'hard';
type ModelStats = { calls: number; ok: number; fail: number; latSum: number; tokOut: number; grades: Record<Level, { s: number; f: number }> };
const ORCH_KEY = 'omnistar_model_stats';
const loadStats = (): Record<string, ModelStats> => { try { return JSON.parse(localStorage.getItem(ORCH_KEY) || '{}'); } catch { return {}; } };
const saveStats = (s: Record<string, ModelStats>) => { try { localStorage.setItem(ORCH_KEY, JSON.stringify(s)); } catch { /* ignore */ } };
const statKey = (m: CustomModel) => `${m.baseUrl}|${m.model}`;
const emptyStats = (): ModelStats => ({ calls: 0, ok: 0, fail: 0, latSum: 0, tokOut: 0, grades: { easy: { s: 0, f: 0 }, medium: { s: 0, f: 0 }, hard: { s: 0, f: 0 } } });
// rodzina modelu: dostawca + pierwszy człon nazwy (np. qwen, llama, mercury, gemini, nemotron)
const familyOf = (m: CustomModel) => (m.model.toLowerCase().match(/(qwen|qwq|llama|mercury|gemini|gemma|nemotron|mistral|mixtral|deepseek|gpt|claude|phi|glm|kimi|grok|command)/) || [m.baseUrl])[0];
// wielkość z nazwy (np. 27b, 70b, 550b) -> wstępna siła i koszt, zanim są dane
const sizeOf = (m: CustomModel) => { const x = m.model.toLowerCase().match(/(\d+(?:\.\d+)?)b\b/); return x ? Number(x[1]) : /max|pro|ultra|plus|mercury/.test(m.model.toLowerCase()) ? 100 : 30; };
const isFree = (m: CustomModel) => /:free$/.test(m.model);
const priorStrength = (m: CustomModel) => Math.min(0.85, 0.45 + 0.12 * Math.log10(1 + sizeOf(m)));
function recordCall(m: CustomModel, ok: boolean, latencyMs: number, tokOut: number) {
  const s = loadStats(); const k = statKey(m); const r = s[k] || emptyStats();
  r.calls++; if (ok) r.ok++; else r.fail++; r.latSum += latencyMs || 0; r.tokOut += tokOut || 0; s[k] = r; saveStats(s);
}
function recordGrade(m: CustomModel, level: Level, correct: boolean) {
  const s = loadStats(); const k = statKey(m); const r = s[k] || emptyStats(); const g = r.grades[level];
  if (correct) g.s++; else g.f++; s[k] = r; saveStats(s);
}
// trudność zadania z samej treści (heurystyka, do douczenia na ocenionych zadaniach)
function difficultyOf(text: string): Level {
  const t = text.toLowerCase(); let d = 0;
  if (text.length > 1500) d += 1; if (text.length > 4000) d += 1;
  if ((text.match(/\d+[,.]\d+/g) || []).length > 5) d += 1;
  if (/p\s*≈|p-?wart|test t|korelac|odchyl|istotn|statyst|walidacj|regresj|rmsd|tm-score/.test(t)) d += 1;
  if (/kod|function|class |import |sql|algorytm|dowód|udowodnij|krok po kroku|przeanalizuj|oceń metod/.test(t)) d += 1;
  return d >= 3 ? 'hard' : d >= 1 ? 'medium' : 'easy';
}
// próbka z rozkładu Beta (Jöhnk / gamma przez sumę wykładniczych dla małych całkowitych parametrów)
const gammaInt = (n: number) => { let s = 0; for (let i = 0; i < Math.max(1, Math.round(n)); i++) s -= Math.log(Math.random()); return s; };
const betaSample = (a: number, b: number) => { const x = gammaInt(a), y = gammaInt(b); return x / (x + y); };
// ocena modelu dla poziomu: Thompson sampling z priorytem z wielkości + kara kosztu (mocna przy łatwych, słaba przy trudnych)
function scoreModel(m: CustomModel, level: Level, explore = true) {
  const r = loadStats()[statKey(m)] || emptyStats(); const g = r.grades[level];
  const b0 = priorStrength(m);
  // łatwe: prawie każdy model daje radę (decyduje koszt); trudne: różnice siły się powiększają
  const p = level === 'easy' ? 0.85 + 0.1 * (b0 - 0.65) : level === 'medium' ? b0 : b0 - 0.05 * (4 - Math.log10(1 + sizeOf(m)));
  // im trudniejsze zadanie, tym mocniej ufamy wiedzy wstępnej (mniej eksperymentów na ważnych zadaniach)
  const w0 = level === 'hard' ? 16 : level === 'medium' ? 8 : 4;
  const a = 1 + w0 * p + g.s, b = 1 + w0 * (1 - p) + g.f;
  const acc = explore ? betaSample(a, b) : a / (a + b);
  const reliability = (r.ok + 2) / (r.calls + 3);
  // koszt = cena (płatne) + czas/obciążenie (także darmowe: duże modele są wolne i zużywają wspólne limity)
  const avgLat = r.calls ? r.latSum / r.calls / 1000 : 2 + Math.log10(1 + sizeOf(m)) * 3;
  const cost = (isFree(m) ? 0 : 0.15 * Math.log10(1 + sizeOf(m))) + Math.min(1, avgLat / 15);
  const lambda = level === 'easy' ? 0.6 : level === 'medium' ? 0.2 : 0.02;
  return acc * reliability - lambda * cost;
}
function routeTask(models: CustomModel[], text: string, explore = true) {
  const level = difficultyOf(text);
  const ranked = models.map((m) => ({ m, s: scoreModel(m, level, explore) })).sort((x, y) => y.s - x.s);
  return { level, model: ranked[0]?.m, ranked };
}
// automatyczne zespoły: równe siły (dobór „wężykiem”), różne rodziny w zespole, brak wspólnych modeli
function autoTeams(models: CustomModel[], size = 3, level: Level = 'hard') {
  const ranked = models.map((m) => ({ m, s: scoreModel(m, level, false) })).sort((x, y) => y.s - x.s);
  const A: CustomModel[] = [], B: CustomModel[] = []; let turn = 0;
  for (const { m } of ranked) {
    if (A.length >= size && B.length >= size) break;
    const order = turn % 4 === 0 || turn % 4 === 3 ? [A, B] : [B, A];
    let placed = false;
    for (const T of order) { if (T.length < size && !T.some((x) => familyOf(x) === familyOf(m))) { T.push(m); placed = true; break; } }
    if (!placed) for (const T of order) { if (T.length < size) { T.push(m); placed = true; break; } }
    if (placed) turn++;
  }
  return { A, B };
}
function OrchestratorRanking({ models }: { models: CustomModel[] }) {
  const st = loadStats();
  return (
    <table className="w-full text-xs border-collapse mt-2"><thead><tr className="text-violet-300"><th className="text-left">Model</th><th>Rodzina</th><th>Trafność ł/ś/t</th><th>Niezawodność</th><th>Śr. czas</th></tr></thead>
      <tbody>{models.map((m) => { const r = st[statKey(m)] || emptyStats(); const f = (l: Level) => { const g = r.grades[l]; return g.s + g.f ? `${g.s}/${g.s + g.f}` : '–'; };
        return (<tr key={m.id} className="border-t border-violet-950"><td>{m.name}</td><td className="text-center">{familyOf(m)}</td><td className="text-center">{f('easy')} · {f('medium')} · {f('hard')}</td><td className="text-center">{r.calls ? `${Math.round((100 * r.ok) / r.calls)}% (${r.calls})` : '–'}</td><td className="text-center">{r.calls ? `${Math.round(r.latSum / r.calls / 100) / 10} s` : '–'}</td></tr>); })}</tbody></table>);
}
if (typeof window !== 'undefined') (window as any).omnistarOrchestrator = { routeTask, autoTeams, difficultyOf, loadStats, recordGrade };


// ===================== PRAWDZIWA RADA – każdy głos to INNY, prawdziwy model z rejestru (zero symulacji) =====================
type DebateVoice = { label: string; model: string; ms: number; text: string; ok: boolean };
async function realDebate(topic: string, pickIds?: string[], onStep?: (s: string) => void): Promise<{ voices: DebateVoice[]; synthesis: DebateVoice | null }> {
  let all: any[] = loadModels().filter((m) => m.lastTest?.ok && (!pickIds || pickIds.includes(m.id)));
  onStep?.('Sprawdzam klucze w sekretach serwera…');
  try {
    const sc = await (await fetch('/api/models/env-scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json();
    for (const e of (sc.models || [])) if (e.ok && !all.some((m: any) => m.model === e.model)) all.push({ id: 'env:' + e.env, name: 'serwer: ' + e.provider, baseUrl: e.baseUrl, model: e.model, apiKey: '', envKey: e.env, addedAt: 0, lastTest: { ok: true, latencyMs: 0, at: 0 } });
  } catch { /* brak skanu – zostają modele z przeglądarki */ }
  if (all.length < 2) throw new Error('Potrzeba co najmniej 2 działających modeli (przeglądarka + sekrety serwera: ' + all.length + '). Dodaj klucze w „+ Dodaj model”.');
  const ask = async (m: any, content: string, max = 900): Promise<DebateVoice> => {
    const t0 = Date.now();
    try {
      const r = await fetch('/api/models/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: m.baseUrl, model: m.model, apiKey: m.apiKey, envKey: (m as any).envKey, messages: [{ role: 'user', content }], max_tokens: max }) });
      const d = await r.json();
      return { label: m.name, model: m.model, ms: Date.now() - t0, text: d.ok ? String(d.content || '') : 'BŁĄD: ' + (d.error || r.status), ok: !!d.ok };
    } catch (e: any) { return { label: m.name, model: m.model, ms: Date.now() - t0, text: 'BŁĄD: ' + (e?.message || e), ok: false }; }
  };
  const rules = 'Odpowiadasz NIEZALEŻNIE, nie widzisz innych głosów. Po polsku, max 200 słów. Podaj JEDNĄ propozycję: (1) jak wykonać, (2) przewidywany efekt bez wymyślonych liczb, (3) jak sprawdzić, (4) ryzyko. Jeśli czegoś nie wiesz – napisz to wprost.';
  const synthModel = all[all.length - 1];
  const voters = all.length > 2 ? all.slice(0, -1) : all;
  onStep?.('Głosy niezależne: ' + voters.map((v) => v.model).join(', '));
  const voices = await Promise.all(voters.map((m) => ask(m, 'TEMAT RADY:\n' + topic + '\n\n' + rules)));
  onStep?.('Synteza: ' + synthModel.model);
  const synthesis = await ask(synthModel, 'Jesteś ambasadorem zadania i przewodniczącym rady. Oto niezależne propozycje RÓŻNYCH modeli AI (każda podpisana nazwą modelu).\nTEMAT:\n' + topic + '\n\n' + voices.map((v, i) => '[' + (i + 1) + '] ' + v.model + ':\n' + v.text).join('\n\n') + '\n\nZadanie: oceń krytycznie (wyłap wymyślone liczby, wycieki danych, słabe punkty) – ale NIE oskarżaj o fałszerstwo bez dowodu, wskaż czego brakuje do weryfikacji. Ułóż ranking propozycji i kolejność testów. Po polsku, max 300 słów.', 1200);
  const rec = { at: new Date().toISOString(), topic, voices, synthesis };
  // wyniki na wspólną tablicę rady (serwer) – widoczne z każdej przeglądarki, bez kluczy
  try {
    const post = (it: any) => fetch('/api/council/board/item', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(it) });
    for (const vo of voices) await post({ type: 'real_council_voice', agentName: vo.model, provider: vo.label, content: vo.text });
    if (synthesis) await post({ type: 'real_council_synthesis', agentName: synthesis.model, provider: synthesis.label, content: synthesis.text });
  } catch { /* ignore */ }
  try { const h = JSON.parse(localStorage.getItem('omnistar_debates') || '[]'); h.unshift(rec); localStorage.setItem('omnistar_debates', JSON.stringify(h.slice(0, 30))); } catch { /* ignore */ }
  return { voices, synthesis };
}
if (typeof window !== 'undefined') (window as any).omnistarDebate = realDebate;

function RealCouncil() {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [res, setRes] = useState<{ voices: DebateVoice[]; synthesis: DebateVoice | null } | null>(null);
  const [err, setErr] = useState('');
  const models = open ? loadModels() : [];
  const working = models.filter((m) => m.lastTest?.ok);
  const run = async () => { setBusy(true); setErr(''); setRes(null); try { setRes(await realDebate(topic, undefined, setStep)); } catch (e: any) { setErr(e?.message || String(e)); } setBusy(false); setStep(''); };
  // Zlecenia rady z tablicy (np. od koordynatora Claude): ta przeglądarka wykonuje je SWOIMI kluczami i odsyła wyniki
  const runningReq = React.useRef(false);
  useEffect(() => {
    const tick = async () => {
      if (runningReq.current) return;
      try {
        const b = await (await fetch('/api/council/board')).json(); const items: any[] = b.items || [];
        const done = new Set(items.filter((x) => x.type === 'council_done').map((x) => x.thought));
        let handled: string[] = []; try { handled = JSON.parse(localStorage.getItem('omnistar_council_handled') || '[]'); } catch { /* */ }
        const req = items.find((x) => x.type === 'council_request' && !done.has(x.id) && !handled.includes(x.id));
        if (!req) return;
        runningReq.current = true; handled.push(req.id); localStorage.setItem('omnistar_council_handled', JSON.stringify(handled.slice(-50)));
        await fetch('/api/council/board/item', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'council_ack', thought: req.id, agentName: 'przeglądarka z kluczami', content: 'Podjęto zlecenie rady: ' + String(req.content).slice(0, 80) }) });
        let summary = '';
        try { const r = await realDebate(String(req.content)); summary = 'OK: ' + r.voices.map((x) => x.model).join(', ') + (r.synthesis ? ' → synteza ' + r.synthesis.model : ''); } catch (e: any) { summary = 'BŁĄD: ' + (e?.message || e); }
        await fetch('/api/council/board/item', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'council_done', thought: req.id, agentName: 'przeglądarka z kluczami', content: summary }) });
      } catch { /* serwer niedostępny */ } finally { runningReq.current = false; }
    };
    const id = setInterval(tick, 20000); tick();
    return () => clearInterval(id);
  }, []);
  return (
    <>
      <button onClick={() => setOpen(true)} className="fixed bottom-4 right-80 z-50 px-3 py-2 rounded-lg bg-emerald-900/90 border border-emerald-500 text-emerald-100 text-xs font-mono hover:bg-emerald-800 shadow-lg">🧠 Prawdziwa Rada</button>
      {open && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-3xl bg-[#06140f] border border-emerald-700 rounded-xl p-5 text-sm text-gray-200 font-mono space-y-3 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center"><h2 className="text-emerald-200 font-bold text-base">🧠 Prawdziwa Rada – każdy głos to inny model</h2><button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white">✕</button></div>
            <div className="text-xs text-emerald-100/80">Działające modele w rejestrze tej przeglądarki: {working.length ? working.map((m) => m.model).join(', ') : 'brak'}. Każdy odpowiada niezależnie, ostatni robi syntezę. Bez symulacji: przy każdej odpowiedzi widać, który model ją napisał i ile trwało.</div>
            <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={5} className="w-full bg-black/60 border border-emerald-900 rounded p-2" placeholder="Temat / problem dla rady…" />
            <button disabled={busy || !topic.trim() || working.length < 2} onClick={run} className="px-4 py-2 rounded bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white">{busy ? 'Rada obraduje…' : 'Zwołaj radę'}</button>
            {step && <div className="text-xs text-emerald-300">{step}</div>}
            {err && <div className="text-red-300">{err}</div>}
            {res && (<div className="space-y-2">
              {res.voices.map((v, i) => (<div key={i} className="border border-emerald-900 rounded p-2"><div className="text-emerald-300 text-xs font-bold">[{i + 1}] {v.model} · {v.ms} ms {v.ok ? '' : '⚠️'}</div><div className="whitespace-pre-wrap text-xs">{v.text}</div></div>))}
              {res.synthesis && (<div className="border border-amber-700 rounded p-2 bg-amber-950/20"><div className="text-amber-300 text-xs font-bold">SYNTEZA – {res.synthesis.model} · {res.synthesis.ms} ms</div><div className="whitespace-pre-wrap text-xs">{res.synthesis.text}</div></div>)}
            </div>)}
          </div>
        </div>
      )}
    </>
  );
}
