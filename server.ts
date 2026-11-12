import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import http from 'http';
import { GoogleGenAI, Type } from '@google/genai';
import crypto from 'crypto';

// ===== BEZPIECZENSTWO: wspolny token (opcjonalny, ustaw OMNISTAR_TOKEN w .env) =====
const OMNI_TOKEN = (process.env.OMNISTAR_TOKEN || '').trim();
const IS_TOKEN_REQUIRED = OMNI_TOKEN.length >= 24;
if (IS_TOKEN_REQUIRED) {
  console.log('[BEZPIECZENSTWO] OMNISTAR_TOKEN aktywny - API i WebSocket wymagaja autoryzacji.');
} else {
  console.log('[BEZPIECZENSTWO] OMNISTAR_TOKEN nie jest ustawiony (lub < 24 znaki) - dostep otwarty dla lokalnego/chmurowego środowiska deweloperskiego.');
}

function tokenOk(given: unknown): boolean {
  if (!IS_TOKEN_REQUIRED) return true;
  if (typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(OMNI_TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function tokenFromUrl(rawUrl: string | undefined): string {
  try { return new URL(rawUrl || '/', 'http://x').searchParams.get('token') || ''; } catch { return ''; }
}

interface DesktopBridgeClient {
  ws: WebSocket;
  deviceId: string;
  screen: [number, number];
  connectedAt: number;
  lastSeen: number;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use('/api', (req, res, next) => {
    const given = (req.headers['x-omnistar-token'] as string) || (req.query.token as string) || '';
    if (!tokenOk(given)) {
      return res.status(401).json({ error: 'Brak lub zly token OMNISTAR_TOKEN' });
    }
    next();
  });

  // Connected reverse-WebSocket desktop agents (solves Cloud -> Local Windows control without localhost port-forwarding)
  const desktopAgents = new Map<string, DesktopBridgeClient>();
  const pendingDesktopRequests = new Map<
    string,
    { resolve: (val: any) => void; reject: (err: any) => void; timer: NodeJS.Timeout }
  >();

  // Global Council Board in-memory state (clean, non-repetitive startup)
  let globalCouncilBoardItems: any[] = [
    {
      id: 'init-orchestrator-ready',
      timestamp: Date.now() - 5000,
      type: 'speaker_response',
      agentId: 0,
      agentName: 'Węzeł Zero [NEXUS-ORKIESTRATOR]',
      content:
        'Silnik rozumowania Gemini 3.8 Flash (Live Reasoning) aktywny. Zablokowano statyczne szablony odpowiedzi. Jeśli uruchomisz na swoim komputerze agenta `omnistar_desktop_agent.py`, klaster przejmie fizyczną kontrolę nad myszką, klawiaturą i aplikacjami Windows przez tunel WebSocket.',
      provider: 'Gemini 3.8 Flash Live'
    }
  ];

  const server = http.createServer(app);
  const wss = new WebSocketServer({
    server,
    verifyClient: (info: any) => tokenOk(tokenFromUrl(info.req.url))
  });

  function broadcastToAll(payloadObj: any) {
    if (!wss) return;
    const msg = JSON.stringify(payloadObj);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }

  function broadcastBoardItem(item: any) {
    broadcastToAll({ type: 'council_board_item', data: item });
  }

  function broadcastDesktopStatus() {
    const activeList = Array.from(desktopAgents.values()).map((a) => ({
      deviceId: a.deviceId,
      screen: a.screen,
      connectedAt: a.connectedAt,
      lastSeen: a.lastSeen
    }));
    broadcastToAll({
      type: 'desktop_bridge_status',
      connected: activeList.length > 0,
      agents: activeList,
      timestamp: Date.now()
    });
  }

  wss.on('connection', (ws) => {
    let registeredDesktopId: string | null = null;

    ws.send(
      JSON.stringify({
        type: 'council_board_init',
        items: globalCouncilBoardItems
      })
    );

    // Immediately inform new web client about connected Windows Desktop Agents
    const activeDesktopList = Array.from(desktopAgents.values()).map((a) => ({
      deviceId: a.deviceId,
      screen: a.screen,
      connectedAt: a.connectedAt,
      lastSeen: a.lastSeen
    }));
    ws.send(
      JSON.stringify({
        type: 'desktop_bridge_status',
        connected: activeDesktopList.length > 0,
        agents: activeDesktopList,
        timestamp: Date.now()
      })
    );

    ws.on('message', (rawMessage) => {
      const str = rawMessage.toString();
      try {
        const payload = JSON.parse(str);

        // 1. Windows Desktop Agent reverse-WebSocket registration
        if (payload.type === 'desktop_agent_hello') {
          registeredDesktopId = payload.deviceId || `win-pc-${Date.now().toString().slice(-4)}`;
          const screen: [number, number] =
            Array.isArray(payload.screen) && payload.screen.length === 2
              ? [Number(payload.screen[0]) || 1920, Number(payload.screen[1]) || 1080]
              : [1920, 1080];

          desktopAgents.set(registeredDesktopId, {
            ws,
            deviceId: registeredDesktopId,
            screen,
            connectedAt: Date.now(),
            lastSeen: Date.now()
          });

          broadcastDesktopStatus();

          const sysItem = {
            id: `sys-desk-${Date.now()}`,
            timestamp: Date.now(),
            type: 'deliberation',
            agentId: 2,
            agentName: 'Agent 2 [Qwen 2.5 VL / Desktop Bridge]',
            content: `Połączono fizyczny komputer Windows (${registeredDesktopId}, ekran ${screen[0]}x${screen[1]}) przez tunel zwrotny WebSocket! Rój ma teraz realną władzę nad kursorem i klawiaturą.`,
            thought: 'Tunel WebSocket ominął blokadę chmura->localhost.',
            provider: 'Reverse WS Bridge'
          };
          globalCouncilBoardItems.push(sysItem);
          broadcastBoardItem(sysItem);
          return;
        }

        // 2. Heartbeat from Desktop Agent
        if (payload.type === 'desktop_agent_ping' && registeredDesktopId) {
          const entry = desktopAgents.get(registeredDesktopId);
          if (entry) {
            entry.lastSeen = Date.now();
          }
          ws.send(JSON.stringify({ type: 'desktop_agent_pong', timestamp: Date.now() }));
          return;
        }

        // 3. Execution result coming back from Windows Desktop Agent
        if (payload.type === 'desktop_action_result' && payload.requestId) {
          if (registeredDesktopId && desktopAgents.has(registeredDesktopId)) {
            desktopAgents.get(registeredDesktopId)!.lastSeen = Date.now();
          }
          const pending = pendingDesktopRequests.get(payload.requestId);
          if (pending) {
            clearTimeout(pending.timer);
            pendingDesktopRequests.delete(payload.requestId);
            pending.resolve(payload);
          }
          // Broadcast live log to all UI panels
          broadcastToAll({
            type: 'desktop_live_event',
            data: payload
          });
          return;
        }
        if (payload && (payload.type === 'execute_desktop_action' || payload.type === 'desktop_agent_hello')) {
          return; // nie przekazujemy rozkazow sterowania od innych klientow
        }
      } catch {
        // Non-JSON relay
      }

      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(str);
        }
      });
    });

    ws.on('close', () => {
      if (registeredDesktopId && desktopAgents.has(registeredDesktopId)) {
        desktopAgents.delete(registeredDesktopId);
        broadcastDesktopStatus();
      }
    });
  });

  // Helper to dispatch physical command to connected Windows Desktop Agent via WebSocket
  async function dispatchCommandToWindowsAgent(commandPayload: {
    action: string;
    x?: number;
    y?: number;
    app?: string;
    text?: string;
    key?: string;
    url?: string;
    vlmResponse?: string;
    instruction?: string;
  }): Promise<{ executedRemotely: boolean; result?: any; error?: string }> {
    const firstAgent = Array.from(desktopAgents.values()).find(
      (a) => a.ws.readyState === WebSocket.OPEN
    );
    if (!firstAgent) {
      return {
        executedRemotely: false,
        error: 'Brak podłączonego Agenta Pulpitu Windows (uruchom omnistar_desktop_agent.py na swoim PC).'
      };
    }

    const requestId = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pendingDesktopRequests.delete(requestId);
        resolve({
          executedRemotely: false,
          error: 'Przekroczono czas oczekiwania (45s) - brak potwierdzenia na PC na odpowiedź z komputera Windows.'
        });
      }, 45000);

      pendingDesktopRequests.set(requestId, {
        resolve: (resPayload) => {
          resolve({ executedRemotely: true, result: resPayload });
        },
        reject: (err) => {
          resolve({ executedRemotely: false, error: String(err) });
        },
        timer
      });

      firstAgent.ws.send(
        JSON.stringify({
          type: 'execute_desktop_action',
          requestId,
          ...commandPayload,
          width: firstAgent.screen[0],
          height: firstAgent.screen[1],
          timestamp: Date.now()
        })
      );
    });
  }

  let invalidGeminiKeyCache = '';

  // Initialize official server-side GoogleGenAI client using GEMINI_API_KEY
  function getAiClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === invalidGeminiKeyCache) return null;
    try {
      return new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
    } catch (e) {
      console.error('Failed to initialize GoogleGenAI:', e);
      return null;
    }
  }

  function extractStructuredCouncilJson(rawText: string, trimmedUser: string): any {
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
          return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
        } catch {
          // Fall through to prose wrapper below
        }
      }
    }

    // If a live model answered in Markdown prose instead of JSON, preserve its real answer verbatim
    return {
      speakerResponse: cleaned || 'Otrzymano pustą odpowiedź z modelu.',
      updatedVector: `Analiza zapytania: ${trimmedUser.slice(0, 60)}`,
      deliberations: [
        {
          agentId: 6,
          agentName: 'Agent 6 [Analiza Logiczna]',
          thought: 'Sformułowano odpowiedź bezpośrednią na podstawie kontekstu rozmowy.'
        }
      ],
      desktopAction: {
        shouldExecute: false,
        actionType: 'none'
      }
    };
  }

  async function callOpenRouterLiveReasoning(
    systemInstruction: string,
    userPrompt: string,
    trimmedUser: string
  ): Promise<{ parsed: any; providerLabel: string }> {
    const openRouterKey = (process.env.OPENROUTER_API_KEY || '').trim();
    if (!openRouterKey) {
      throw new Error(
        'Brak aktywnego klucza GEMINI_API_KEY (konto serwisowe nieaktywne) oraz brak OPENROUTER_API_KEY w Settings > Secrets.'
      );
    }

    const jsonSchemaHint = `
ZWRÓĆ WYŁĄCZNIE CZYSTY OBIEKT JSON (bez bloków \`\`\`json i bez żadnego tekstu przed lub po JSON) o dokładnie tej strukturze:
{
  "speakerResponse": "Pełna, logiczna, merytoryczna odpowiedź dla użytkownika po polsku (możesz używać pogrubień i list Markdown wewnątrz stringa).",
  "updatedVector": "Krótki, jednozdaniowy opis aktualnego kroku / wektora działania.",
  "deliberations": [
    { "agentId": 6, "agentName": "Agent 6 [Logika & Krytyka]", "thought": "Krótki, konkretny wniosek logiczny (1-2 zdania)" },
    { "agentId": 2, "agentName": "Agent 2 [Wizja & Pulpit UI-TARS]", "thought": "Analiza pod kątem pulpitu Windows / wykonalności" },
    { "agentId": 8, "agentName": "Agent 8 [Architekt Automatyzacji]", "thought": "Konkretny techniczny krok wykonawczy" }
  ],
  "desktopAction": {
    "shouldExecute": false,
    "actionType": "none",
    "targetApp": "",
    "url": "",
    "x": 0,
    "y": 0,
    "textToType": "",
    "keyToPress": "",
    "uiTarsFormatted": ""
  }
}
Jeśli użytkownik prosi o fizyczną akcję na komputerze (np. otwórz notatnik/kalkulator/przeglądarkę/stronę, kliknij, wpisz tekst, wciśnij klawisz, zrób screenshot), ustaw "shouldExecute": true oraz "actionType" na jedno z: "open_app", "open_url", "click", "double_click", "right_click", "type_text", "press_key", "screenshot" (np. dla notatnika: "actionType": "open_app", "targetApp": "notepad.exe", "uiTarsFormatted": "Action: open(app='notepad.exe')").`;

    const candidateModels = [
      'nvidia/nemotron-3-ultra-550b-a55b:free',
      'openrouter/free',
      'cohere/north-mini-code:free'
    ];

    let lastError = 'Nieznany błąd OpenRouter';

    for (const modelId of candidateModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);
        const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openRouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://aistudio.google.com',
            'X-Title': 'Omnistar 3D Collective'
          },
          body: JSON.stringify({
            model: modelId,
            messages: [
              { role: 'system', content: `${systemInstruction}\n\n${jsonSchemaHint}` },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.5,
            max_tokens: 1600
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data: any = await resp.json();
        if (!resp.ok) {
          lastError = data?.error?.message || `HTTP ${resp.status} dla ${modelId}`;
          continue;
        }

        const content = (data?.choices?.[0]?.message?.content || '').trim();
        if (!content) {
          lastError = `Pusta odpowiedź z modelu ${modelId}`;
          continue;
        }

        return {
          parsed: extractStructuredCouncilJson(content, trimmedUser),
          providerLabel: `Live AI (${data?.model || modelId})`
        };
      } catch (err: any) {
        lastError = err?.message || String(err);
      }
    }

    throw new Error(lastError);
  }

  app.get('/api/health', (_req, res) => {
    const activeDesktop = Array.from(desktopAgents.values()).filter(
      (a) => a.ws.readyState === WebSocket.OPEN
    );
    res.json({
      status: 'ok',
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
      model: 'gemini-3.8-flash',
      desktopConnected: activeDesktop.length > 0,
      desktopAgents: activeDesktop.map((a) => ({
        deviceId: a.deviceId,
        screen: a.screen,
        lastSeen: a.lastSeen
      }))
    });
  });

  app.get('/api/status', (_req, res) => {
    res.json({
      status: 'ok',
      activeConnections: wss ? wss.clients.size : 0,
      desktopAgentsCount: desktopAgents.size,
      timestamp: Date.now()
    });
  });

  // Desktop status & ping check (checks reverse WebSocket tunnel FIRST, then optional local HTTP)
  app.post('/api/desktop-ping', async (req, res) => {
    const start = Date.now();
    const activeWsAgents = Array.from(desktopAgents.values()).filter(
      (a) => a.ws.readyState === WebSocket.OPEN
    );

    if (activeWsAgents.length > 0) {
      const primary = activeWsAgents[0];
      return res.json({
        success: true,
        mode: 'websocket_tunnel',
        deviceId: primary.deviceId,
        screen: primary.screen,
        latencyMs: Math.max(4, Date.now() - start),
        message: `Połączono na żywo przez tunel WebSocket z komputerem ${primary.deviceId} (${primary.screen[0]}x${primary.screen[1]})`
      });
    }

    const { bridgeUrl = 'http://127.0.0.1:5000' } = req.body || {};
    const cleanUrl =
      bridgeUrl.replace(/\/api\/step\/?$/, '').replace(/\/+$/, '') || 'http://127.0.0.1:5000';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const respRoot = await fetch(cleanUrl, { method: 'GET', signal: controller.signal });
      clearTimeout(timeoutId);
      if (respRoot.ok || respRoot.status < 500) {
        return res.json({
          success: true,
          mode: 'http_local',
          latencyMs: Math.max(8, Date.now() - start),
          url: cleanUrl
        });
      }
    } catch {
      // Ignore local HTTP unreachable from cloud container
    }

    return res.json({
      success: false,
      mode: 'offline',
      error:
        'Komputer Windows nie jest jeszcze podłączony. Pobierz i uruchom skrypt omnistar_desktop_agent.py jednym kliknięciem w zakładce Most PC!',
      url: cleanUrl
    });
  });

  // Execute desktop step: prioritizes Reverse WebSocket Agent, falls back to local HTTP if running locally
  app.post('/api/desktop-step', async (req, res) => {
    const {
      bridgeUrl = 'http://127.0.0.1:5000',
      response: vlmResponse = '',
      width = 1920,
      height = 1080,
      instruction = '',
      parsedCommand
    } = req.body || {};

    let cmd: any = parsedCommand || { action: 'unknown', vlmResponse, instruction };
    const textSource = `${vlmResponse}\n${instruction}`;

    if (!parsedCommand) {
      const pointMatch =
        textSource.match(/<point>(\d+)\s+(\d+)<\/point>/i) ||
        textSource.match(/(\d{2,4})\s*,\s*(\d{2,4})/);
      const appMatch = textSource.match(/open\(app=['"]([^'"]+)['"]\)/i);
      const urlMatch = textSource.match(/https?:\/\/[^\s'"]+/i);
      const typeMatch = textSource.match(/type\(content=['"]([^'"]+)['"]\)/i);
      const keyMatch = textSource.match(/press\(key=['"]([^'"]+)['"]\)/i);

      if (appMatch) {
        cmd = { action: 'open', app: appMatch[1], vlmResponse, instruction };
      } else if (
        urlMatch &&
        (instruction.toLowerCase().includes('otwórz') ||
          instruction.toLowerCase().includes('wejdź') ||
          instruction.toLowerCase().includes('strona'))
      ) {
        cmd = { action: 'open_url', url: urlMatch[0], vlmResponse, instruction };
      } else if (typeMatch) {
        cmd = { action: 'type', text: typeMatch[1], vlmResponse, instruction };
      } else if (keyMatch) {
        cmd = { action: 'press', key: keyMatch[1], vlmResponse, instruction };
      } else if (
        textSource.toLowerCase().includes('screenshot') ||
        textSource.toLowerCase().includes('zrzut')
      ) {
        cmd = { action: 'screenshot', vlmResponse, instruction };
      } else if (pointMatch) {
        const x = Number(pointMatch[1]);
        const y = Number(pointMatch[2]);
        let act = 'click';
        if (textSource.includes('double_click')) act = 'double_click';
        else if (textSource.includes('right_click')) act = 'right_click';
        cmd = { action: act, x, y, vlmResponse, instruction };
      } else {
        cmd = { action: 'infer_from_instruction', vlmResponse, instruction };
      }
    }

    // 1. Try connected Windows Reverse-WebSocket Agent FIRST (works from Cloud Run!)
    const wsResult = await dispatchCommandToWindowsAgent(cmd);
    if (wsResult.executedRemotely && wsResult.result) {
      return res.json({
        success: true,
        mode: 'websocket_tunnel',
        data: wsResult.result
      });
    }

    // 2. Fallback: try HTTP POST to bridgeUrl (if server runs on same machine)
    const cleanUrl =
      bridgeUrl.replace(/\/api\/step\/?$/, '').replace(/\/+$/, '') || 'http://127.0.0.1:5000';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(cleanUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          response: vlmResponse || instruction,
          width: Number(width) || 1920,
          height: Number(height) || 1080
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return res.json({ success: true, mode: 'http_local', data });
      }
    } catch {
      // Both failed
    }

    return res.json({
      success: false,
      mode: 'offline',
      error:
        wsResult.error ||
        'Brak fizycznego połączenia z Twoim komputerem Windows. Pobierz i uruchom skrypt `omnistar_desktop_agent.py` z zakładki Most PC (1 komenda w cmd), aby agenci naprawdę ruszali Twoją myszką i otwierali programy!'
    });
  });

  // KREATOR MODELI: test dowolnego modelu zgodnego z OpenAI (klucz tylko do tego wywołania, nie jest zapisywany)
  app.post('/api/models/test', async (req, res) => {
    const { baseUrl = '', model = '', apiKey = '' } = req.body || {};
    if (!/^https:\/\//.test(String(baseUrl)) || !model || !apiKey) return res.json({ ok: false, error: 'Brak adresu https, modelu lub klucza.' });
    const t0 = Date.now();
    try {
      const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 45000);
      const resp = await fetch(String(baseUrl).replace(/\/+$/, '') + '/chat/completions', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Odpowiedz jednym słowem: działa' }], max_tokens: 400 })
      });
      clearTimeout(timer);
      const data: any = await resp.json().catch(() => ({}));
      if (!resp.ok) return res.json({ ok: false, latencyMs: Date.now() - t0, error: `HTTP ${resp.status}: ${String(data?.error?.message || data?.error || '').slice(0, 200)}` });
      const msg0 = data?.choices?.[0]?.message || {};
      const reply = msg0.content || msg0.reasoning_content || msg0.reasoning || '';
      // HTTP 200 z poprawną strukturą = klucz i model działają (modele rozumujące mogą zwrócić pustą treść przy krótkim limicie)
      const okStruct = Array.isArray(data?.choices);
      return res.json({ ok: okStruct, latencyMs: Date.now() - t0, reply: String(reply || '(odpowiedź pusta, ale model działa)').slice(0, 200), error: okStruct ? undefined : 'Nieoczekiwany format odpowiedzi: ' + JSON.stringify(data).slice(0, 150) });
    } catch (e: any) {
      return res.json({ ok: false, latencyMs: Date.now() - t0, error: e?.name === 'AbortError' ? 'Przekroczono 45 s' : String(e?.message || e) });
    }
  });

  // KREATOR MODELI: rozpoznanie dostawcy po samym kluczu + lista modeli dostępnych na tym kluczu
  app.post('/api/models/detect', async (req, res) => {
    const apiKey = String((req.body || {}).apiKey || '').trim();
    if (!apiKey) return res.json({ ok: false, error: 'Brak klucza.' });
    type Prov = { name: string; baseUrl: string; prefix?: RegExp; verify?: string; publicList?: boolean };
    const PROVIDERS: Prov[] = [
      { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', prefix: /^sk-or-/, verify: 'https://openrouter.ai/api/v1/key', publicList: true },
      { name: 'Google AI Studio (Gemini)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', prefix: /^AIza/ },
      { name: 'Alibaba Model Studio (Singapur)', baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', prefix: /^sk-(?!or-)/, fallbackModels: ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen3-coder-plus'] } as any,
      { name: 'Alibaba Model Studio (USA)', baseUrl: 'https://dashscope-us.aliyuncs.com/compatible-mode/v1', prefix: /^sk-(?!or-)/, fallbackModels: ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen3-coder-plus'] } as any,
      { name: 'Alibaba Model Studio (Pekin)', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', prefix: /^sk-(?!or-)/, fallbackModels: ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen3-coder-plus'] } as any,
      { name: 'Alibaba Model Studio (Hongkong)', baseUrl: 'https://cn-hongkong.dashscope.aliyuncs.com/compatible-mode/v1', prefix: /^sk-(?!or-)/, fallbackModels: ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen3-coder-plus'] } as any,
      { name: 'NVIDIA NIM', baseUrl: 'https://integrate.api.nvidia.com/v1', prefix: /^nvapi-/, publicList: true, fallbackModels: ['meta/llama-3.1-8b-instruct', 'meta/llama-3.3-70b-instruct'] } as any,
      { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', prefix: /^gsk_/ },
      { name: 'Hugging Face', baseUrl: 'https://router.huggingface.co/v1', prefix: /^hf_/, publicList: true },
      { name: 'Inception (Mercury)', baseUrl: 'https://api.inceptionlabs.ai/v1' },
      { name: 'Mistral', baseUrl: 'https://api.mistral.ai/v1' },
      { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', prefix: /^sk-/ },
      { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', prefix: /^sk-(proj-)?/ },
      { name: 'Together', baseUrl: 'https://api.together.xyz/v1' },
      { name: 'Cerebras', baseUrl: 'https://api.cerebras.ai/v1', prefix: /^csk-/ },
      { name: 'xAI (Grok)', baseUrl: 'https://api.x.ai/v1', prefix: /^xai-/ }
    ];
    const byPrefix = PROVIDERS.filter((p) => p.prefix && p.prefix.test(apiKey));
    // dostawcy z publiczną listą modeli liczą się tylko przy pasującym prefiksie (inaczej każdy klucz by „pasował”)
    const rest = PROVIDERS.filter((p) => !byPrefix.includes(p) && !p.publicList);
    const order = [...byPrefix, ...rest];
    const tried: string[] = [];
    for (const p of order) {
      try {
        const h = { Authorization: `Bearer ${apiKey}` };
        if (p.verify) { const v = await fetch(p.verify, { headers: h }); if (!v.ok) { tried.push(`${p.name}: ${v.status}`); continue; } }
        const r = await fetch(p.baseUrl + '/models', { headers: h });
        if (!r.ok && (r.status === 404 || r.status === 405) && (p as any).fallbackModels) {
          const fm: string[] = (p as any).fallbackModels;
          const c = await fetch(p.baseUrl + '/chat/completions', { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: fm[0], messages: [{ role: 'user', content: 'ok' }], max_tokens: 5 }) }).catch(() => null);
          if (c && c.ok) return res.json({ ok: true, provider: p.name, baseUrl: p.baseUrl, models: fm.map((id) => ({ id, free: false, context: null })), tried, note: 'Lista modeli niedostępna, podano typowe.' });
          tried.push(`${p.name}: brak listy, test ${c ? c.status : 'brak'}`); continue;
        }
        if (!r.ok) { tried.push(`${p.name}: ${r.status}`); continue; }
        const data: any = await r.json().catch(() => ({}));
        const list: any[] = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : [];
        if (!list.length) { tried.push(`${p.name}: pusta lista`); continue; }
        // lista publiczna (bez klucza też działa)? -> sprawdź klucz mikrowywołaniem modelu
        if (!p.verify) {
          const anon = await fetch(p.baseUrl + '/models').catch(() => null);
          if (anon && anon.ok) {
            const firstId = String(list[0]?.id || list[0]?.name || '').replace(/^models\//, '');
            const c = await fetch(p.baseUrl + '/chat/completions', { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: firstId, messages: [{ role: 'user', content: 'ok' }], max_tokens: 1 }) }).catch(() => null);
            if (!c || c.status === 401 || c.status === 403) { tried.push(`${p.name}: klucz odrzucony (${c ? c.status : 'brak'})`); continue; }
          }
        }
        const models = list.map((m: any) => {
          const id = String(m.id || m.name || '').replace(/^models\//, '');
          const free = /:free$/.test(id) || (m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0);
          return { id, free: !!free, context: m.context_length || m.context_window || null };
        }).filter((m: any) => m.id && !/embed|whisper|tts|guard|moderation|image|vision-only|audio|veo|imagen|aqa|learnlm|live|robotics|computer-use|transcrib|rerank|lyria/i.test(m.id));
        const fast = (id: string) => (/flash|mini|turbo|instant|plus|lite/i.test(id) ? 1 : 0) - (/preview|exp|pro|ultra|max/i.test(id) ? 0.5 : 0);
        models.sort((a: any, b: any) => Number(b.free) - Number(a.free) || fast(b.id) - fast(a.id) || (b.context || 0) - (a.context || 0));
        return res.json({ ok: true, provider: p.name, baseUrl: p.baseUrl, models: models.slice(0, 400), tried });
      } catch (e: any) { tried.push(`${p.name}: ${String(e?.message || e).slice(0, 60)}`); }
    }
    return res.json({ ok: false, error: 'Nie rozpoznano klucza u znanych dostawców.', tried });
  });

  // KREATOR MODELI: wywołanie modelu z rejestru (dla ról komórki agentów: Alfa/Beta, recenzenci)
  // Samo dopasowuje się do limitów: 'za duże zapytanie' -> mniejszy max_tokens; limit na minutę -> czeka; pusta odpowiedź -> ponawia.
  // Skan sekretów serwera: które zmienne z kluczami istnieją i do jakiego dostawcy/modelu pasują. Zwraca TYLKO nazwy, nigdy wartości kluczy.
  let envScanCache: any[] | null = null; let envScanAt = 0;
  app.post('/api/models/env-scan', async (req, res) => {
    if (envScanCache && Date.now() - envScanAt < 30 * 60 * 1000 && !(req.body || {}).force) return res.json({ ok: true, models: envScanCache, cached: true });
    const port = Number(process.env.PORT) || 3000; const base = 'http://127.0.0.1:' + port;
    const hdr: any = { 'Content-Type': 'application/json' }; if (OMNI_TOKEN) hdr['x-omnistar-token'] = OMNI_TOKEN;
    const names = Object.keys(process.env).filter((k) => /(API_KEY|_KEY|API_K[A-Z]*)$/.test(k) && !/OMNISTAR|^npm_/i.test(k) && String(process.env[k] || '').trim().length > 15);
    const outM: any[] = [];
    for (const env of names) {
      try {
        const d = await (await fetch(base + '/api/models/detect', { method: 'POST', headers: hdr, body: JSON.stringify({ apiKey: String(process.env[env]).trim() }) })).json();
        if (!d.ok) { outM.push({ env, ok: false, error: String(d.error || '').slice(0, 120) }); continue; }
        let picked = ''; for (const m of (d.models || []).slice(0, 6)) {
          const t = await (await fetch(base + '/api/models/test', { method: 'POST', headers: hdr, body: JSON.stringify({ baseUrl: d.baseUrl, model: m.id, apiKey: String(process.env[env]).trim() }) })).json();
          if (t.ok) { picked = m.id; break; }
        }
        outM.push({ env, ok: !!picked, provider: d.provider, baseUrl: d.baseUrl, model: picked, error: picked ? '' : 'żaden z pierwszych modeli nie odpowiedział' });
      } catch (e: any) { outM.push({ env, ok: false, error: String(e?.message || e).slice(0, 120) }); }
    }
    envScanCache = outM; envScanAt = Date.now();
    res.json({ ok: true, models: outM });
  });

  app.post('/api/models/chat', async (req, res) => {
    const { baseUrl = '', model = '', messages = [] } = req.body || {};
    let apiKey = String((req.body || {}).apiKey || '').trim();
    // Klucz z sekretów serwera (podawana jest tylko NAZWA zmiennej, nigdy wartość)
    const envKey = String((req.body || {}).envKey || '');
    if (!apiKey && /^[A-Z0-9_]+$/.test(envKey) && envKey !== 'OMNISTAR_TOKEN') apiKey = String(process.env[envKey] || '').trim();
    let maxTok = Number((req.body || {}).max_tokens) || 1500;
    if (!/^https:\/\//.test(String(baseUrl)) || !model || !apiKey) return res.json({ ok: false, error: 'Brak adresu https, modelu lub klucza.' });
    const t0 = Date.now(); let lastErr = ''; const notes: string[] = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const resp = await fetch(String(baseUrl).replace(/\/+$/, '') + '/chat/completions', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model, messages, max_tokens: maxTok })
        });
        const data: any = await resp.json().catch(() => ({}));
        const errMsg = String(data?.error?.message || data?.error || '');
        if (resp.status === 429 && /too large|reduce max_tokens|Requested \d+/i.test(errMsg)) {
          const lim = Number((errMsg.match(/Limit (\d+)/) || [])[1]) || Math.floor(maxTok / 2);
          maxTok = Math.max(150, Math.floor(lim * 0.8)); notes.push(`limit tokenów -> ${maxTok}`); lastErr = errMsg; continue;
        }
        if (resp.status === 429 || resp.status >= 500) { notes.push(`HTTP ${resp.status}, czekam`); lastErr = errMsg; await new Promise((r) => setTimeout(r, 15000 * (attempt + 1))); continue; }
        if (!resp.ok) return res.json({ ok: false, latencyMs: Date.now() - t0, error: `HTTP ${resp.status}: ${errMsg.slice(0, 300)}` });
        const content = data?.choices?.[0]?.message?.content ?? '';
        const finish = data?.choices?.[0]?.finish_reason;
        if (!String(content).trim() || (finish === 'length' && String(content).length < 40)) { maxTok = Math.floor(maxTok * 1.6); notes.push(`pusta/ucięta odpowiedź -> ${maxTok}`); lastErr = 'pusta odpowiedź'; continue; }
        return res.json({ ok: true, latencyMs: Date.now() - t0, content, finishReason: finish, usage: data?.usage, notes });
      } catch (e: any) { lastErr = String(e?.message || e); notes.push('wyjątek'); await new Promise((r) => setTimeout(r, 5000)); }
    }
    return res.json({ ok: false, latencyMs: Date.now() - t0, error: `Po 5 próbach: ${lastErr.slice(0, 250)}`, notes });
  });

  // REAL MULTI-AGENT REASONING & DESKTOP CONTROL ENDPOINT (ZERO HARDCODED TEMPLATES!)
  app.post('/api/council/deliberate', async (req, res) => {
    const {
      userText = '',
      userMessageId,
      speakerId = 1,
      speakerName = 'Agent 1 [Spiker Rady]',
      history = [],
      milestoneLedger = null
    } = req.body || {};

    const trimmedUser = String(userText).trim();
    if (!trimmedUser) {
      return res.status(400).json({ error: 'Pusta wiadomość' });
    }

    const now = Date.now();
    const assignedUserId = userMessageId || `usr-${now}`;

    const uItem = {
      id: assignedUserId,
      timestamp: now,
      type: 'user_directive',
      content: trimmedUser,
      targetGroup: 'Wspólna Grupa (Wszystkie 9 Modeli Jednocześnie)'
    };
    globalCouncilBoardItems.push(uItem);
    broadcastBoardItem(uItem);

    const activeWsAgents = Array.from(desktopAgents.values()).filter(
      (a) => a.ws.readyState === WebSocket.OPEN
    );
    const isDesktopOnline = activeWsAgents.length > 0;
    const desktopStatusDesc = isDesktopOnline
      ? `PODŁĄCZONY NA ŻYWO (${activeWsAgents[0].deviceId}, rozdzielczość ${activeWsAgents[0].screen[0]}x${activeWsAgents[0].screen[1]}). Możesz wydawać fizyczne akcje desktopAction!`
      : `NIEPODŁĄCZONY (użytkownik nie uruchomił jeszcze pliku omnistar_desktop_agent.py na swoim Windowsie). Jeśli prosi o sterowanie komputerem, wygeneruj poprawny plan akcji desktopAction ORAZ krótko wyjaśnij, żeby kliknął zakładkę "Most PC" -> "Pobierz omnistar_desktop_agent.py" i odpalił go na swoim komputerze, bo aplikacja w chmurze potrzebuje tego mostu WebSocket, by fizycznie ruszać jego myszką i otwierać programy.`;

    const recentHistory = Array.isArray(history)
      ? history
          .slice(-10)
          .map(
            (h: any) =>
              `${h.sender === 'user' ? 'UŻYTKOWNIK' : 'RADA'}: ${String(h.text || '').slice(0, 600)}`
          )
          .join('\n---\n')
      : globalCouncilBoardItems
          .slice(-10)
          .map(
            (it: any) =>
              `[${it.type}] ${it.agentName || 'Użytkownik'}: ${String(it.content || '').slice(0, 500)}`
          )
          .join('\n');

    const ledgerSummary = milestoneLedger
      ? `CEL GŁÓWNY: ${milestoneLedger.mainGoal}\nAKTUALNY WEKTOR: ${milestoneLedger.currentVector}\nZREALIZOWANE KAMIENIE: ${(milestoneLedger.milestones || [])
          .filter((m: any) => m.completed)
          .map((m: any) => m.title)
          .join('; ')}`
      : '';

    const systemInstruction = `Jesteś prawdziwym, inteligentnym mózgiem Kolektywu 9 Agentów Omnistar oraz wyznaczonym Spikerem (${speakerName}).
Rozmawiasz z użytkownikiem po polsku.

BEZWZGLĘDNE ZAKAZY (ŻELAZNE REGUŁY):
1. ZAKAZ POWTARZANIA SZABLONÓW: Nigdy nie wypisuj w kółko tej samej listy "7 sposobów na zarabianie" ani gotowych regułek powitalnych! Każda odpowiedź musi wynikać z prawdziwej logiki, dedukcji i dokładnie tego, o co użytkownik pyta TERAZ.
2. PRAWDZIWA LOGIKA I SZCZEROŚĆ: Jeśli użytkownik zauważa problem (np. że wcześniej agenci powtarzali to samo i nie sterowali komputerem), odpowiedz merytorycznie i uczciwie: statyczne reguły if/else zostały usunięte i zastąpione żywym silnikiem LLM z pamięcią kontekstową, a fizyczne sterowanie myszką i aplikacjami Windows z chmury działa przez zwrotny tunel WebSocket po uruchomieniu pliku \`omnistar_desktop_agent.py\` z zakładki "Most PC".
3. FIZYCZNE STEROWANIE KOMPUTEREM (desktopAction):
   Aktualny status fizycznego połączenia z komputerem Windows użytkownika: ${desktopStatusDesc}
   Jeśli użytkownik wydaje JAKIEKOLWIEK polecenie wykonania czegoś na komputerze (np. "otwórz notatnik", "otwórz kalkulator", "otwórz przeglądarkę / stronę ...", "kliknij w x, y", "napisz tekst ...", "zrób zrzut ekranu", "wciśnij enter"), MUSISZ wypełnić pole \`desktopAction\` z \`shouldExecute: true\` oraz właściwym \`actionType\` ('open_app', 'open_url', 'click', 'double_click', 'right_click', 'type_text', 'press_key', 'screenshot'). Serwer natychmiast wyśle ten rozkaz przez WebSocket do komputera użytkownika!
   Jeśli użytkownik tylko rozmawia lub pyta o radę/kod/strategię bez rozkazu klikania na PC, ustaw \`desktopAction.shouldExecute = false\`.
4. RÓŻNORODNE GŁOSY RADY (\`deliberations\`): Wygeneruj 3 krótkie, ostre, technicznie konkretne myśli od różnych agentów z Rady (np. Agent 6 od logiki/krytyki, Agent 2 od wizji/pulpitu, Agent 8 od kodu/automatyzacji), które NIE powtarzają słów Spikera, tylko wnoszą realną analizę problemu.`;

    const userPrompt = `${ledgerSummary ? `[KONSPEKT PAMIĘCI WĘZŁA ZERO]\n${ledgerSummary}\n\n` : ''}[OSTATNIA HISTORIA ROZMOWY]\n${recentHistory || '(Brak wcześniejszych wiadomości)'}\n\n[NOWA WIADOMOŚĆ OD UŻYTKOWNIKA]\n"${trimmedUser}"`;

    try {
      let parsed: any = null;
      let activeProviderLabel = 'Gemini 3.8 Flash Live';

      const ai = getAiClient();
      if (ai) {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: userPrompt,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  speakerResponse: {
                    type: Type.STRING,
                    description:
                      'Bezpośrednia, logiczna, merytoryczna odpowiedź dla użytkownika po polsku (Markdown dozwolony).'
                  },
                  updatedVector: {
                    type: Type.STRING,
                    description:
                      'Krótki zaktualizowany aktualny wektor działania (1 zdanie) na podstawie tej rozmowy.'
                  },
                  deliberations: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        agentId: { type: Type.INTEGER },
                        agentName: { type: Type.STRING },
                        thought: { type: Type.STRING }
                      },
                      required: ['agentId', 'agentName', 'thought']
                    }
                  },
                  desktopAction: {
                    type: Type.OBJECT,
                    properties: {
                      shouldExecute: {
                        type: Type.BOOLEAN,
                        description:
                          'True TYLKO wtedy, gdy użytkownik prosi o fizyczną akcję na komputerze.'
                      },
                      actionType: {
                        type: Type.STRING,
                        description:
                          'Jedno z: none, open_app, open_url, click, double_click, right_click, type_text, press_key, screenshot'
                      },
                      targetApp: {
                        type: Type.STRING,
                        description:
                          'Nazwa pliku wykonywalnego Windows, np. notepad.exe, calc.exe, mspaint.exe, cmd.exe, explorer.exe, chrome.exe'
                      },
                      url: { type: Type.STRING },
                      x: { type: Type.INTEGER },
                      y: { type: Type.INTEGER },
                      textToType: { type: Type.STRING },
                      keyToPress: { type: Type.STRING },
                      uiTarsFormatted: { type: Type.STRING }
                    },
                    required: ['shouldExecute', 'actionType']
                  }
                },
                required: ['speakerResponse', 'deliberations', 'desktopAction']
              }
            }
          });

          const rawJson = (response.text ?? '{}').trim();
          parsed = extractStructuredCouncilJson(rawJson, trimmedUser);
        } catch (geminiErr: any) {
          const gMsg = geminiErr?.message || String(geminiErr);
          if (gMsg.includes('ACCOUNT_STATE_INVALID') || gMsg.includes('UNAUTHENTICATED')) {
            invalidGeminiKeyCache = process.env.GEMINI_API_KEY || '';
          }
          // Failover to OpenRouter if configured in Secrets
          if (process.env.OPENROUTER_API_KEY) {
            const fallbackRes = await callOpenRouterLiveReasoning(
              systemInstruction,
              userPrompt,
              trimmedUser
            );
            parsed = fallbackRes.parsed;
            activeProviderLabel = fallbackRes.providerLabel;
          } else {
            throw geminiErr;
          }
        }
      } else {
        const fallbackRes = await callOpenRouterLiveReasoning(
          systemInstruction,
          userPrompt,
          trimmedUser
        );
        parsed = fallbackRes.parsed;
        activeProviderLabel = fallbackRes.providerLabel;
      }

      const retDelibs: any[] = [];
      if (Array.isArray(parsed.deliberations)) {
        parsed.deliberations.forEach((d: any, idx: number) => {
          const dItem = {
            id: `delib-${Date.now()}-${idx}`,
            timestamp: Date.now(),
            type: 'deliberation',
            agentId: d.agentId || 6,
            agentName: d.agentName || `Agent ${d.agentId || 6}`,
            content: d.thought,
            thought: d.thought,
            provider: activeProviderLabel
          };
          retDelibs.push(dItem);
          globalCouncilBoardItems.push(dItem);
          broadcastBoardItem(dItem);
        });
      }

      // If AI decided a physical desktop action should be executed, trigger it right now!
      let desktopExecutionReport: any = null;
      if (
        parsed.desktopAction &&
        parsed.desktopAction.shouldExecute &&
        parsed.desktopAction.actionType &&
        parsed.desktopAction.actionType !== 'none'
      ) {
        const da = parsed.desktopAction;
        const mappedCmd: any = {
          action:
            da.actionType === 'open_app'
              ? 'open'
              : da.actionType === 'type_text'
                ? 'type'
                : da.actionType === 'press_key'
                  ? 'press'
                  : da.actionType,
          app: da.targetApp,
          url: da.url,
          x: da.x,
          y: da.y,
          text: da.textToType,
          key: da.keyToPress,
          vlmResponse: da.uiTarsFormatted || `Action: ${da.actionType}`,
          instruction: trimmedUser
        };

        const execOutcome = await dispatchCommandToWindowsAgent(mappedCmd);
        desktopExecutionReport = {
          requested: da,
          executedRemotely: execOutcome.executedRemotely,
          result: execOutcome.result || null,
          error: execOutcome.error || null
        };

        const bridgeItem = {
          id: `desk-exec-${Date.now()}`,
          timestamp: Date.now(),
          type: 'deliberation',
          agentId: 2,
          agentName: 'Most Pulpitu Windows [UI-TARS Live]',
          content: execOutcome.executedRemotely
            ? `✅ WYKONANO NA FIZYCZNYM KOMPUTERZE: ${execOutcome.result?.message || da.actionType}`
            : `⚠️ ROZKAZ GOTOWY (${da.uiTarsFormatted || da.actionType}), ale Twój komputer Windows nie jest jeszcze podpięty. Pobierz i uruchom \`omnistar_desktop_agent.py\` w zakładce "Most PC", aby wykonać to fizycznie!`,
          thought: da.uiTarsFormatted || da.actionType,
          provider: 'UI-TARS Bridge'
        };
        retDelibs.push(bridgeItem);
        globalCouncilBoardItems.push(bridgeItem);
        broadcastBoardItem(bridgeItem);
      }

      let finalSpeakerText = parsed.speakerResponse || 'Przeanalizowano zapytanie.';
      if (desktopExecutionReport) {
        if (desktopExecutionReport.executedRemotely) {
          finalSpeakerText += `\n\n---\n🖥️ **[POTWIERDZENIE WYKONANIA NA PULPICIE WINDOWS]:** \`${desktopExecutionReport.result?.message || desktopExecutionReport.requested.actionType}\``;
        } else {
          finalSpeakerText += `\n\n---\n🖥️ **[WYGENEROWANO ROZKAZ STEROWANIA PC]:** \`${desktopExecutionReport.requested.uiTarsFormatted || desktopExecutionReport.requested.actionType}\`\n*(Aby kursor i aplikacje na Twoim Windowsie zadziałały fizycznie, uruchom na swoim komputerze plik **omnistar_desktop_agent.py** z zakładki **Most PC**).*`;
        }
      }

      const spkItemId = `spk-${Date.now()}`;
      const spkItem = {
        id: spkItemId,
        timestamp: Date.now(),
        type: 'speaker_response',
        agentId: speakerId,
        agentName: speakerName,
        content: finalSpeakerText,
        provider: activeProviderLabel
      };
      globalCouncilBoardItems.push(spkItem);
      broadcastBoardItem(spkItem);

      if (globalCouncilBoardItems.length > 100) {
        globalCouncilBoardItems = globalCouncilBoardItems.slice(-100);
      }

      return res.json({
        success: true,
        provider: activeProviderLabel,
        speakerId,
        speakerName,
        speakerItemId: spkItemId,
        speakerResponse: finalSpeakerText,
        updatedVector: parsed.updatedVector || null,
        deliberations: retDelibs,
        desktopExecution: desktopExecutionReport,
        timestamp: Date.now()
      });
    } catch (err: any) {
      console.error('Council deliberation error:', err);
      const errMsg = err?.message || String(err);
      return res.status(500).json({
        success: false,
        error: `Błąd wywołania silnika rozumującego: ${errMsg}`,
        speakerResponse: `⚠️ Wystąpił błąd połączenia z silnikiem AI: ${errMsg}. Sprawdź klucze GEMINI_API_KEY lub OPENROUTER_API_KEY w panelu Settings > Secrets.`,
        deliberations: []
      });
    }
  });

  // GET /api/council/board - Live Board data
  app.get('/api/council/board', (_req, res) => {
    res.json({
      success: true,
      items: globalCouncilBoardItems,
      desktopConnected: desktopAgents.size > 0,
      timestamp: Date.now()
    });
  });

  // POST /api/council/board/item - Add item manually
  app.post('/api/council/board/item', (req, res) => {
    const item = req.body;
    if (item && item.content) {
      const fullItem = {
        id: item.id || `item-${Date.now()}`,
        timestamp: item.timestamp || Date.now(),
        type: item.type || 'deliberation',
        agentId: item.agentId,
        agentName: item.agentName,
        content: item.content,
        thought: item.thought,
        provider: item.provider
      };
      globalCouncilBoardItems.push(fullItem);
      broadcastBoardItem(fullItem);
      if (globalCouncilBoardItems.length > 100) {
        globalCouncilBoardItems = globalCouncilBoardItems.slice(-100);
      }
      return res.json({ success: true, item: fullItem });
    }
    res.status(400).json({ success: false, error: 'Brak treści wpisu' });
  });

  // =========================================================================
  // MODUŁ: TŁUMACZ KSIĄŻEK (PANDOC MARKDOWN) - BACKEND EXPRSS (ZERO SYMULACJI)
  // =========================================================================

  // Helper to resolve OpenRouter keys with comma rotation
  function parseOpenRouterKeys(customKeys?: string): string[] {
    const raw = (customKeys || process.env.OPENROUTER_API_KEY || '').trim();
    return raw
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 5);
  }

  // Call OpenRouter with key rotation on 429 errors and candidate models
  async function callOpenRouterWithRotation(
    keys: string[],
    preferredModel: string,
    messages: { role: string; content: string }[],
    temperature = 0.3,
    isAsian = false
  ): Promise<{ text: string; modelUsed: string }> {
    if (keys.length === 0) {
      throw new Error(
        'Brak klucza OpenRouter. Wprowadź klucz (sk-or-...) w zakładce Klucze lub skonfiguruj OPENROUTER_API_KEY w panelu Secrets.'
      );
    }

    // List of candidate models to try in priority order
    const candidateModels = isAsian
      ? [
          preferredModel && preferredModel.includes('qwen') ? preferredModel : 'qwen/qwen-2.5-72b-instruct',
          'qwen/qwen-2.5-coder-32b-instruct',
          'nvidia/nemotron-3-ultra-550b-a55b:free',
          'openrouter/free'
        ]
      : [
          preferredModel || 'nvidia/nemotron-3-ultra-550b-a55b:free',
          'meta-llama/llama-3.3-70b-instruct',
          'google/gemini-2.5-flash',
          'nvidia/nemotron-3-ultra-550b-a55b:free',
          'openrouter/free',
          'cohere/north-mini-code:free'
        ];

    const uniqueModels = Array.from(new Set(candidateModels.filter(Boolean)));
    let lastError = '';

    for (const model of uniqueModels) {
      for (let i = 0; i < keys.length; i++) {
        const activeKey = keys[i];
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 90000);
          const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${activeKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://aistudio.google.com',
              'X-Title': 'Omnistar Book Translator'
            },
            body: JSON.stringify({
              model,
              messages,
              temperature,
              max_tokens: 4096
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          const data: any = await resp.json();
          if (resp.status === 429) {
            lastError = `Klucz #${i + 1} zwrócił błąd 429: ${data?.error?.message || 'Rate Limit'}`;
            console.warn(`[OpenRouter 429] Rotacja klucza ${i + 1}/${keys.length} -> kolejny klucz.`);
            continue; // Try next key
          }

          if (!resp.ok) {
            lastError = data?.error?.message || `HTTP ${resp.status} z OpenRouter (${model})`;
            console.warn(`[OpenRouter Model Failed: ${model}]`, lastError);
            break; // Try next model for this key
          }

          const content = data?.choices?.[0]?.message?.content;
          if (!content && content !== '') {
            lastError = `Pusta treść odpowiedzi od modelu ${model}`;
            break;
          }

          return { text: content.trim(), modelUsed: data?.model || model };
        } catch (err: any) {
          lastError = err?.message || String(err);
          if (i < keys.length - 1) {
            continue;
          }
        }
      }
    }

    throw new Error(`Wszystkie klucze i modele OpenRouter zawiodły. Ostatni błąd: ${lastError}`);
  }

  // Call Gemini or fallback to OpenRouter
  async function callTranslatorEngine(
    systemPrompt: string,
    userPrompt: string,
    targetLang: string,
    customGeminiKey?: string,
    customOpenRouterKeys?: string,
    preferredModel?: string
  ): Promise<{ text: string; providerLabel: string }> {
    const isAsian = targetLang === 'ja' || targetLang === 'zh-Hant';
    const orKeys = parseOpenRouterKeys(customOpenRouterKeys);

    // 1. Try Gemini 3.8 Flash FIRST (unless Asian and user specified Qwen preference, but user requested Gemini 3.8 Flash then OpenRouter)
    const geminiKey = (customGeminiKey || process.env.GEMINI_API_KEY || '').trim();
    if (geminiKey && geminiKey !== invalidGeminiKeyCache) {
      try {
        const client = new GoogleGenAI({
          apiKey: geminiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });
        const resp = await client.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `${systemPrompt}\n\n${userPrompt}`
        });
        const text = resp.text?.trim();
        if (text) {
          return { text, providerLabel: 'Gemini 3.8 Flash' };
        }
      } catch (geminiErr: any) {
        const gMsg = geminiErr?.message || String(geminiErr);
        console.warn('[Translator Gemini Fallback] Gemini failed, attempting OpenRouter:', gMsg);
        if (gMsg.includes('ACCOUNT_STATE_INVALID') || gMsg.includes('UNAUTHENTICATED')) {
          invalidGeminiKeyCache = geminiKey;
        }
        if (orKeys.length === 0) {
          throw new Error(`Błąd Gemini 3.8 Flash: ${gMsg}. Wprowadź klucz OpenRouter w zakładce Klucze dla fallbacku.`);
        }
      }
    }

    // 2. OpenRouter fallback or primary if Gemini unavailable
    const modelToUse = isAsian
      ? 'qwen/qwen-2.5-72b-instruct'
      : (preferredModel || 'nvidia/nemotron-3-ultra-550b-a55b:free');

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const orResult = await callOpenRouterWithRotation(orKeys, modelToUse, messages, 0.3, isAsian);
    return { text: orResult.text, providerLabel: `OpenRouter (${orResult.modelUsed})` };
  }

  // 1. SŁOWNIK SPÓJNOŚCI (GLOSSARY) PRZED TŁUMACZENIEM
  app.post('/api/translate/glossary', async (req, res) => {
    const {
      targetLang,
      sampleText = '',
      geminiKey,
      openRouterKeys,
      preferredModel
    } = req.body || {};

    if (!targetLang) {
      return res.status(400).json({ error: 'Brak docelowego języka (targetLang)' });
    }

    const languageNames: Record<string, string> = {
      de: 'niemiecki (Deutsch, bezpośredni rejestr "du")',
      es: 'hiszpański (Español, bezpośredni rejestr "tú")',
      fr: 'francuski (Français, bezpośredni rejestr "tu")',
      it: 'włoski (Italiano, bezpośredni rejestr "tu")',
      ja: 'japoński (日本語, uprzejmy bezpośredni styl "です/ます")',
      pl: 'polski (Polski, bezpośredni rejestr "ty")',
      'zh-Hant': 'chiński tradycyjny (繁體中文, bezpośredni rejestr "你")',
      ru: 'rosyjski (Русский, bezpośredni rejestr "ты")'
    };

    const targetLangName = languageNames[targetLang] || targetLang;

    const systemPrompt = `Jesteś ekspertem terminologii literackiej i redaktorem wydawniczym.
Tworzysz oficjalny Słownik Spójności Terminologicznej (Consistency Glossary) dla tłumaczenia książki samopomocowej/psychologicznej z języka angielskiego na język: ${targetLangName}.

BEZWZGLĘDNE REGUŁY:
1. Imiona postaci (Anna, Mark, Victoria, Leo, Linda, Josh, Claire, Greg, Frank) i pseudonim autora 'John Routefinder' POZOSTAJĄ BEZ ZMIAN w alfabecie łacińskim (w japońskim/chińskim/rosyjskim podaj formę w alfabecie docelowym lub zachowaj oryginał, zgodnie ze standardem rynkowym).
2. Kluczowe archetypy i terminy:
   - "The Escaper"
   - "The Planner"
   - "The Controller"
   - "Worksheet"
   - "Workbook"
   - "Protected block" / "Protected blocks"
   - "Raw Truth"
   - "Routefinder" / "The Routefinder Method"
   - "Comfort Trap"
   - "Safety Anchor"
3. Tłumaczenie zdania do stopki praw autorskich:
   Ustal dokładne brzmienie zdania w języku docelowym: "Przetłumaczono z języka angielskiego z pomocą AI" (np. de: "Aus dem Englischen mit Hilfe von KI übersetzt", fr: "Traduit de l'anglais avec l'aide de l'IA", es: "Traducido del inglés con la ayuda de IA", it: "Tradotto dall'inglese con l'aiuto dell'IA", ja: "AIの支援を受けて英語から翻訳されました", pl: "Przetłumaczono z języka angielskiego z pomocą AI", zh-Hant: "由人工智慧輔助自英文翻譯", ru: "Переведено с английского языка с помощью ИИ").

Zwróć odpowiedź w czystym formacie JSON:
{
  "copyrightNotice": "Dokładne zdanie w języku docelowym",
  "terms": {
    "The Escaper": "...",
    "The Planner": "...",
    "The Controller": "...",
    "Worksheet": "...",
    "Workbook": "...",
    "protected block": "...",
    "Raw Truth": "...",
    "Comfort Trap": "...",
    "Safety Anchor": "..."
  },
  "notes": "Krótka wytyczna stylistyczna (1 zdanie)"
}`;

    const userPrompt = `Przeanalizuj poniższy fragment rękopisu i przygotuj oficjalny słownik dla języka: ${targetLangName}.\n\nPRÓBKA RĘKOPISU:\n${String(sampleText).slice(0, 4000)}`;

    try {
      const outcome = await callTranslatorEngine(
        systemPrompt,
        userPrompt,
        targetLang,
        geminiKey,
        openRouterKeys,
        preferredModel
      );

      let parsedJson: any = null;
      try {
        const clean = outcome.text.replace(/^```json/i, '').replace(/```$/i, '').trim();
        parsedJson = JSON.parse(clean);
      } catch {
        const firstBrace = outcome.text.indexOf('{');
        const lastBrace = outcome.text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          parsedJson = JSON.parse(outcome.text.slice(firstBrace, lastBrace + 1));
        } else {
          parsedJson = { raw: outcome.text, terms: {}, copyrightNotice: 'Przetłumaczono z języka angielskiego z pomocą AI' };
        }
      }

      return res.json({
        success: true,
        targetLang,
        glossary: parsedJson,
        provider: outcome.providerLabel
      });
    } catch (err: any) {
      console.error('Błąd generowania słownika:', err);
      return res.status(500).json({
        success: false,
        error: err?.message || String(err)
      });
    }
  });

  // 2. DWUETAPOWE TŁUMACZENIE FRAGMENTU: AGENT TŁUMACZ -> AGENT REDAKTOR
  app.post('/api/translate/chunk', async (req, res) => {
    const {
      chunkIndex,
      totalChunks,
      chunkText,
      targetLang,
      glossary,
      geminiKey,
      openRouterKeys,
      preferredModel
    } = req.body || {};

    if (!chunkText || !targetLang) {
      return res.status(400).json({ error: 'Brak tekstu fragmentu (chunkText) lub języka (targetLang)' });
    }

    const languageSpecs: Record<string, { name: string; register: string; copyright: string }> = {
      de: { name: 'niemiecki (Deutsch)', register: 'bezpośredni "du" / "dein" (szczery, dynamiczny)', copyright: 'Aus dem Englischen mit Hilfe von KI übersetzt.' },
      es: { name: 'hiszpański (Español)', register: 'bezpośredni "tú" / "tu" (bezpośredni, motywujący)', copyright: 'Traducido del inglés con la ayuda de IA.' },
      fr: { name: 'francuski (Français)', register: 'bezpośredni "tu" / "ton" (bliski czytelnikowi, szczery)', copyright: 'Traduit de l\'anglais avec l\'aide de l\'IA.' },
      it: { name: 'włoski (Italiano)', register: 'bezpośredni "tu" / "tuo" (bezpośredni, żywy)', copyright: 'Tradotto dall\'inglese con l\'aiuto dell\'IA.' },
      ja: { name: 'japoński (日本語)', register: 'styl "です/ます" (uprzejmy, ale bezpośredni i osobisty dla czytelnika)', copyright: 'AIの支援を受けて英語から翻訳されました。' },
      pl: { name: 'polski (Polski)', register: 'bezpośredni "ty" / "twój" (autentyczny, szczery, konkretny)', copyright: 'Przetłumaczono z języka angielskiego z pomocą AI.' },
      'zh-Hant': { name: 'chiński tradycyjny (繁體中文)', register: 'bezpośredni "你" / "你的" (szczery, dynamiczny)', copyright: '由人工智慧輔助自英文翻譯。' },
      ru: { name: 'rosyjski (Русский)', register: 'bezpośredni "ты" / "твой" (konkretny, szczery)', copyright: 'Переведено с английского языка с помощью ИИ.' }
    };

    const spec = languageSpecs[targetLang] || { name: targetLang, register: 'bezpośredni', copyright: 'Przetłumaczono z języka angielskiego z pomocą AI.' };

    const termsListing = glossary?.terms
      ? Object.entries(glossary.terms)
          .map(([en, tr]) => `• "${en}" -> "${tr}"`)
          .join('\n')
      : '• The Escaper, The Planner, The Controller (archetypy)\n• Worksheet, Workbook, protected block, Raw Truth';

    const copyrightClause = glossary?.copyrightNotice || spec.copyright;

    // ETAP 1: AGENT TŁUMACZ
    const translatorSystem = `Jesteś profesjonalnym tłumaczem książek literatury faktu, psychologii i rozwoju osobistego.
Tłumaczysz fragment rękopisu z języka angielskiego na: ${spec.name}.

BEZWZGLĘDNE REGUŁY SKŁADNI PANDOC I FORMALNEJ INTEGRALNOŚCI:
1. ZACHOWAJ 100% BEZ ZMIAN CAŁĄ SKŁADNIĘ MARKDOWN I PANDOC:
   - Bloki klas Pandoc '::: {.nazwa_klasy}' oraz linie domykające ':::' MUSZĄ POZOSTAĆ NIENARUSZONE!
   - Atrybuty w nagłówkach np. '{.chapter data-num="1"}' lub '{#sec-intro}' MUSZĄ pozostać dokładnie w tej samej postaci za nagłówkiem!
   - Specjalne znaczniki w podwójnych nawiasach: '[[TOC]]', '[[PAGEBREAK]]', '[[LINES 5]]' itp. MUSZĄ pozostać bez żadnych modyfikacji.
   - Pogrubienia '**tekst**', kursywy '*tekst*', cytaty '> cytat', listy numerowane i punktowane, tabele i separatory '---' muszą zachować identyczny układ.
2. IMIONA I NAZWISKA:
   - Imiona postaci: Anna, Mark, Victoria, Leo, Linda, Josh, Claire, Greg, Frank oraz pseudonim autora 'John Routefinder' POZOSTAJĄ BEZ ZMIAN (w alfabecie łacińskim lub transliterowane w standardzie danego języka).
3. STYL I REJESTR:
   - Zastosuj rejestr bezpośredni: ${spec.register}.
   - Ton: szczery, surowy, konkretny, unikaj sztucznych i drewnianych sformułowań.
4. SŁOWNIK SPÓJNOŚCI (OBOWIĄZKOWE TŁUMACZENIA KLUCZOWYCH POJĘĆ):
${termsListing}
5. SEKCJA COPYRIGHT:
   - Jeśli fragment zawiera notę praw autorskich (Copyright / All rights reserved), dodaj w odpowiednim miejscu zdanie: "${copyrightClause}".

ZWRÓĆ WYŁĄCZNIE PRZETŁUMACZONY TEKST MARKDOWN (bez żadnych wstępów, komentarzy tłumacza czy bloków \`\`\`markdown).`;

    // ETAP 2: AGENT REDAKTOR
    const editorSystem = `Jesteś surowym, bezkompromisowym redaktorem wydawniczym w języku ${spec.name}.
Twoim zadaniem jest sprawdzenie i dopracowanie przetłumaczonego tekstu rękopisu.

ZADANIA REDAKTORA:
1. SPRAWDŹ SKŁADNIĘ PANDOC:
   - Upewnij się, że każda linia '::: {.klasa}' i ':::' oraz znaczniki '[[PAGEBREAK]]', '[[TOC]]', '{.chapter...}' są zachowane co do litery.
2. PŁYNNOŚĆ I IDIOMATYKA:
   - Usuń kalki z angielskiego. Nadaj tekstowi naturalne, mocne brzmienie w języku docelowym w rejestrze: ${spec.register}.
3. SPÓJNOŚĆ TERMINOLOGII:
   - Zweryfikuj, czy użyto terminów ze słownika (${termsListing}).
4. IMIONA:
   - Upewnij się, że imiona (Anna, Mark, Victoria, Leo, Linda, Josh, Claire, Greg, Frank) i autor 'John Routefinder' nie zostały zniekształcone.

ZWRÓĆ WYŁĄCZNIE OSTATECZNĄ, ZREDAGOWANĄ WERSJĘ MARKDOWN (bez żadnych własnych uwag, komentarzy ani otaczających znaczników kodu \`\`\`markdown).`;

    try {
      // 1. KROK 1: Agent Tłumacz (Gemini 3.8 Flash lub OpenRouter fallback)
      const transOutcome = await callTranslatorEngine(
        translatorSystem,
        `FRAGMENT ${chunkIndex + 1}/${totalChunks} DO PRZETŁUMACZENIA:\n\n${chunkText}`,
        targetLang,
        geminiKey,
        openRouterKeys,
        preferredModel
      );

      const rawTranslation = transOutcome.text
        .replace(/^```(?:markdown)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      // 2. KROK 2: Agent Redaktor (Drugi model dla podwójnej kontroli jakości)
      const orKeys = parseOpenRouterKeys(openRouterKeys);
      let editorModel = targetLang === 'ja' || targetLang === 'zh-Hant'
        ? 'qwen/qwen-2.5-72b-instruct'
        : (preferredModel || 'meta-llama/llama-3.3-70b-instruct');

      let finalEditedText = rawTranslation;
      let editorProvider = 'Pominięto (brak drugiego klucza)';

      if (orKeys.length > 0) {
        try {
          const editorMessages = [
            { role: 'system', content: editorSystem },
            {
              role: 'user',
              content: `ORYGINAŁ ANGIELSKI:\n${chunkText}\n\n---\nROBOCZE TŁUMACZENIE DO REDAKCJI:\n${rawTranslation}`
            }
          ];
          const editorRes = await callOpenRouterWithRotation(orKeys, editorModel, editorMessages, 0.2);
          finalEditedText = editorRes.text
            .replace(/^```(?:markdown)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
          editorProvider = `Redaktor: OpenRouter (${editorRes.modelUsed})`;
        } catch (editorErr: any) {
          console.warn('[Editor Fallback] Redaktor OpenRouter zawiódł, zachowuję tłumaczenie główne:', editorErr?.message);
          editorProvider = `Tłumacz (Redaktor pominięty: ${editorErr?.message?.slice(0, 50)})`;
        }
      } else {
        editorProvider = `Tłumacz: ${transOutcome.providerLabel}`;
      }

      return res.json({
        success: true,
        chunkIndex,
        totalChunks,
        translatedText: finalEditedText,
        translatorProvider: transOutcome.providerLabel,
        editorProvider
      });
    } catch (err: any) {
      console.error(`Błąd tłumaczenia fragmentu ${chunkIndex}:`, err);
      return res.status(500).json({
        success: false,
        chunkIndex,
        error: err?.message || String(err)
      });
    }
  });

  // GET /api/desktop-agent.py - Downloadable Reverse-WebSocket + Local HTTP Agent for real physical Windows PC control!
  app.get('/api/desktop-agent.py', (req, res) => {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
    const wsProto = proto.includes('https') ? 'wss' : 'ws';
    const hubWsUrl = `${wsProto}://${host}/?token=${encodeURIComponent(String(req.query.token || ''))}`;

    res.setHeader('Content-Disposition', 'attachment; filename="omnistar_desktop_agent.py"');
    res.setHeader('Content-Type', 'text/x-python; charset=utf-8');

    const agentPy = `# -*- coding: utf-8 -*-
"""
====================================================================
OMNISTAR FIZYCZNY AGENT PULPITU WINDOWS (Reverse-WebSocket + PyAutoGUI)
====================================================================
Ten skrypt łączy Twój fizyczny komputer Windows bezpośrednio z chmurą Omnistar!
Dzięki połączeniu zwrotnemu WebSocket omija blokady firewall/NAT/localhost.

INSTALACJA (jednorazowo w terminalu CMD / PowerShell):
    pip install pyautogui websocket-client pillow

URUCHOMIENIE:
    python omnistar_desktop_agent.py
"""

import json
import time
import socket
import subprocess
import webbrowser
import threading
import re
import sys

try:
    import pyautogui
    pyautogui.FAILSAFE = True
    pyautogui.PAUSE = 0.15
except ImportError:
    print("[!] Brak biblioteki pyautogui! Zainstaluj wpisując:")
    print("    pip install pyautogui websocket-client pillow")
    sys.exit(1)

try:
    import websocket
except ImportError:
    print("[!] Brak biblioteki websocket-client! Zainstaluj wpisując:")
    print("    pip install websocket-client pyautogui pillow")
    sys.exit(1)

HUB_WS_URL = "${hubWsUrl}"
DEVICE_ID = socket.gethostname() or "Windows-PC"

# ===== BEZPIECZENSTWO =====
# Tylko te programy wolno otwierac (nazwa -> plik). Dopisz wlasne, jesli chcesz.
DOZWOLONE_PROGRAMY = {
    "notepad": "notepad.exe", "notatnik": "notepad.exe",
    "calc": "calc.exe", "kalkulator": "calc.exe",
    "mspaint": "mspaint.exe", "paint": "mspaint.exe",
    "explorer": "explorer.exe",
}
PYTAJ_O_ZGODE = True  # okienko TAK/NIE przed kazda akcja


def zgoda(opis):
    if not PYTAJ_O_ZGODE:
        return True
    odp = pyautogui.confirm(text=f"Omnistar chce wykonac:\n\n{opis}\n\nPozwolic?",
                            title="Omnistar - potwierdzenie", buttons=["TAK", "NIE"])
    return odp == "TAK"


def program_z_listy(nazwa):
    n = str(nazwa or "").strip().lower()
    n = n[:-4] if n.endswith(".exe") else n
    return DOZWOLONE_PROGRAMY.get(n)


def execute_local_command(payload):
    action = str(payload.get("action", "")).lower()
    instruction = str(payload.get("instruction", ""))
    vlm_resp = str(payload.get("vlmResponse", ""))
    screen_w, screen_h = pyautogui.size()

    print(f"\\n[ROZKAZ Z CHMURY OMNISTAR] Akcja: {action} | Instrukcja: {instruction}")

    try:
        if action in ("open", "open_app"):
            app_name = payload.get("app") or "notepad.exe"
            exe = program_z_listy(app_name)
            if not exe:
                return {"status": "error", "action": "open", "message": f"Zablokowano: '{app_name}' nie jest na bialej liscie"}
            if not zgoda(f"Otworzyc program: {exe}"):
                return {"status": "error", "action": "open", "message": "Odmowa uzytkownika"}
            subprocess.Popen([exe])
            return {"status": "success", "action": "open", "app": exe, "message": f"Uruchomiono program: {exe}"}

        elif action == "open_url":
            url = str(payload.get("url") or "https://www.google.com")
            if not re.match(r"^https?://", url, re.I):
                return {"status": "error", "action": "open_url", "message": "Zablokowano: dozwolone tylko adresy http(s)"}
            if not zgoda(f"Otworzyc strone: {url}"):
                return {"status": "error", "action": "open_url", "message": "Odmowa uzytkownika"}
            webbrowser.open(url)
            return {"status": "success", "action": "open_url", "url": url, "message": f"Otwarto w przeglądarce: {url}"}

        elif action in ("click", "double_click", "right_click"):
            x = int(payload.get("x", screen_w // 2))
            y = int(payload.get("y", screen_h // 2))
            x = max(5, min(screen_w - 5, x))
            y = max(5, min(screen_h - 5, y))
            if not zgoda(f"{action} w punkcie ({x}, {y})"):
                return {"status": "error", "action": action, "message": "Odmowa uzytkownika"}
            pyautogui.moveTo(x, y, duration=0.25)
            if action == "double_click":
                pyautogui.doubleClick(x, y)
            elif action == "right_click":
                pyautogui.rightClick(x, y)
            else:
                pyautogui.click(x, y)
            return {"status": "success", "action": action, "x": x, "y": y, "message": f"Wykonano {action} w punkcie ({x}, {y})"}

        elif action in ("type", "type_text"):
            text = str(payload.get("text") or "")
            if text and not zgoda(f"Wpisac tekst: {text[:200]}"):
                return {"status": "error", "action": "type", "message": "Odmowa uzytkownika"}
            if text:
                pyautogui.write(text, interval=0.02)
            return {"status": "success", "action": "type", "text": text, "message": f"Wpisano na klawiaturze: '{text}'"}

        elif action in ("press", "press_key"):
            key = str(payload.get("key") or "enter").lower()
            key_map = {"return": "enter", "escape": "esc"}
            mapped = key_map.get(key, key)
            if not zgoda(f"Nacisnac klawisz: {mapped}"):
                return {"status": "error", "action": "press", "message": "Odmowa uzytkownika"}
            if "+" in mapped:
                parts = [k.strip() for k in mapped.split("+")]
                pyautogui.hotkey(*parts)
            else:
                pyautogui.press(mapped)
            return {"status": "success", "action": "press", "key": mapped, "message": f"Naciśnięto klawisz: [{mapped}]"}

        elif action == "screenshot":
            pos = pyautogui.position()
            return {
                "status": "success",
                "action": "screenshot",
                "screen": [screen_w, screen_h],
                "cursor": [pos.x, pos.y],
                "message": f"Zbadano ekran {screen_w}x{screen_h}, kursor na ({pos.x}, {pos.y})"
            }

        else:
            # Inteligentne wnioskowanie z instrukcji tekstowej
            low = (instruction + " " + vlm_resp).lower()
            if "notatnik" in low or "notepad" in low:
                subprocess.Popen(["notepad.exe"]) if zgoda("Otworzyc Notatnik") else None
                return {"status": "success", "action": "open", "app": "notepad.exe", "message": "Otwarto Notatnik (notepad.exe)"}
            if "kalkulator" in low or "calc" in low:
                subprocess.Popen(["calc.exe"]) if zgoda("Otworzyc Kalkulator") else None
                return {"status": "success", "action": "open", "app": "calc.exe", "message": "Otwarto Kalkulator (calc.exe)"}
            if "paint" in low:
                subprocess.Popen(["mspaint.exe"]) if zgoda("Otworzyc Paint") else None
                return {"status": "success", "action": "open", "app": "mspaint.exe", "message": "Otwarto Paint (mspaint.exe)"}
            if "przeglądark" in low or "chrome" in low or "google" in low:
                webbrowser.open("https://www.google.com")
                return {"status": "success", "action": "open_url", "url": "https://www.google.com", "message": "Otwarto przeglądarkę internetową"}

            m = re.search(r"(\\d{2,4})\\s*[,\\s]\\s*(\\d{2,4})", low)
            if m:
                x, y = int(m.group(1)), int(m.group(2))
                if not zgoda(f"Kliknac w punkt ({x}, {y})"):
                    return {"status": "error", "action": "click", "message": "Odmowa uzytkownika"}
                pyautogui.moveTo(x, y, duration=0.25)
                pyautogui.click(x, y)
                return {"status": "success", "action": "click", "x": x, "y": y, "message": f"Kliknięto w punkt ({x}, {y})"}

            pos = pyautogui.position()
            return {"status": "success", "action": "ping", "message": f"Agent PC aktywny (kursor: {pos.x}, {pos.y}). Podaj konkretną akcję np. 'otwórz notatnik' lub 'kliknij 500, 400'."}

    except Exception as e:
        return {"status": "error", "action": action, "message": f"Błąd PyAutoGUI: {str(e)}"}


def on_message(ws, message):
    try:
        data = json.loads(message)
        if data.get("type") == "execute_desktop_action":
            req_id = data.get("requestId")
            result = execute_local_command(data)
            reply = {
                "type": "desktop_action_result",
                "requestId": req_id,
                "deviceId": DEVICE_ID,
                "provider": f"Windows PC ({DEVICE_ID})",
                **result
            }
            ws.send(json.dumps(reply))
            print(f"[✓ WYKONANO]: {result.get('message')}")
    except Exception as e:
        print("Błąd obsługi wiadomości:", e)


def on_open(ws):
    w, h = pyautogui.size()
    print("=" * 68)
    print(f"✅ POŁĄCZONO Z CHMURĄ OMNISTAR! Komputer: {DEVICE_ID} ({w}x{h})")
    print("Teraz możesz pisać na czacie w aplikacji np.:")
    print("  -> 'Otwórz notatnik na moim komputerze'")
    print("  -> 'Otwórz kalkulator'")
    print("  -> 'Kliknij w punkt 500, 500'")
    print("  -> 'Wpisz tekst Test automatyzacji'")
    print("Awaryjne przerwanie: przesuń gwałtownie myszkę w lewy górny róg ekranu (0,0).")
    print("=" * 68)
    ws.send(json.dumps({
        "type": "desktop_agent_hello",
        "deviceId": DEVICE_ID,
        "screen": [w, h]
    }))

    def heartbeat():
        while True:
            time.sleep(15)
            try:
                ws.send(json.dumps({"type": "desktop_agent_ping", "deviceId": DEVICE_ID}))
            except Exception:
                break

    threading.Thread(target=heartbeat, daemon=True).start()


def run_forever():
    print(f"Łączenie z Hubem Omnistar: {HUB_WS_URL} ...")
    while True:
        try:
            ws = websocket.WebSocketApp(
                HUB_WS_URL,
                on_open=on_open,
                on_message=on_message
            )
            ws.run_forever(ping_interval=20, ping_timeout=10)
        except KeyboardInterrupt:
            print("Zatrzymano agenta.")
            break
        except Exception as e:
            print("Rozłączono, ponawiam za 3 sekundy...", e)
        time.sleep(3)


if __name__ == "__main__":
    run_forever()
`;
    res.send(agentPy);
  });

  // GET /api/council/desktop-widget.py - Downloadable pure-Python Windows desktop HUD overlay (auto-configured with live URL!)
  app.get('/api/council/desktop-widget.py', (req, res) => {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
    const baseHttpUrl = `${proto.split(',')[0].trim()}://${host}`;

    res.setHeader('Content-Disposition', 'attachment; filename="desktop_board.py"');
    res.setHeader('Content-Type', 'text/x-python; charset=utf-8');
    const pythonScript = `# -*- coding: utf-8 -*-
"""
Wspólna Tablica Rady 9 Modeli - Lekki Pulpitowy Widget HUD dla Windows
Uruchomienie na Twoim komputerze:
    python desktop_board.py
"""
import sys
import json
import urllib.request
import threading
import time

try:
    import tkinter as tk
    from tkinter import scrolledtext
except ImportError:
    print("Błąd: Moduł tkinter jest wymagany.")
    sys.exit(1)

HUB_URL = "${baseHttpUrl}/api/council/board?token=${encodeURIComponent(String(req.query.token || ''))}"
DELIBERATE_URL = "${baseHttpUrl}/api/council/deliberate?token=${encodeURIComponent(String(req.query.token || ''))}"

class CouncilHUD(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Wspólna Tablica Rady 9 Modeli (Live HUD)")
        self.geometry("560x680+60+60")
        self.configure(bg="#050b14")
        self.attributes("-topmost", True)
        self.attributes("-alpha", 0.95)

        header_frame = tk.Frame(self, bg="#0d1b2a", pady=6, padx=10)
        header_frame.pack(fill=tk.X)

        tk.Label(header_frame, text="WSPÓLNA TABLICA RADY 9 MODELI (GEMINI 3.8 LIVE)",
                 fg="#00f0ff", bg="#0d1b2a", font=("Consolas", 10, "bold")).pack(anchor="w")

        self.text_area = scrolledtext.ScrolledText(self, bg="#03070d", fg="#e0f2fe",
                                                   insertbackground="#00ffff", font=("Consolas", 9),
                                                   wrap=tk.WORD, borderwidth=1, relief=tk.SOLID)
        self.text_area.pack(fill=tk.BOTH, expand=True, padx=8, pady=6)
        self.text_area.tag_config("user", foreground="#38bdf8", font=("Consolas", 9, "bold"))
        self.text_area.tag_config("speaker", foreground="#fbbf24", font=("Consolas", 9, "bold"))
        self.text_area.tag_config("delib", foreground="#34d399")

        input_frame = tk.Frame(self, bg="#0d1b2a", pady=6, padx=8)
        input_frame.pack(fill=tk.X)

        self.input_entry = tk.Entry(input_frame, bg="#020617", fg="#ffffff",
                                    insertbackground="#00ffff", font=("Consolas", 10), borderwidth=1)
        self.input_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 6), ipady=4)
        self.input_entry.bind("<Return>", lambda e: self.send_directive())

        tk.Button(input_frame, text="Wyślij", bg="#0284c7", fg="#ffffff",
                  font=("Consolas", 9, "bold"), borderwidth=0, padx=12, pady=4,
                  command=self.send_directive, cursor="hand2").pack(side=tk.RIGHT)

        self.seen_ids = set()
        self.running = True
        threading.Thread(target=self.poll_loop, daemon=True).start()

    def send_directive(self):
        text = self.input_entry.get().strip()
        if not text:
            return
        self.input_entry.delete(0, tk.END)
        def _send():
            try:
                data = json.dumps({"userText": text, "speakerId": 1}).encode("utf-8")
                req = urllib.request.Request(DELIBERATE_URL, data=data, headers={"Content-Type": "application/json"})
                urllib.request.urlopen(req, timeout=25)
            except Exception as e:
                print("Błąd wysyłania:", e)
        threading.Thread(target=_send, daemon=True).start()

    def poll_loop(self):
        while self.running:
            try:
                req = urllib.request.Request(HUB_URL, headers={"Accept": "application/json"})
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode("utf-8"))
                        items = data.get("items", [])
                        new_items = [it for it in items if it.get("id") not in self.seen_ids]
                        if new_items:
                            self.after(0, self.append_items, new_items)
            except Exception:
                pass
            time.sleep(2.0)

    def append_items(self, items):
        for it in items:
            self.seen_ids.add(it.get("id"))
            itype = it.get("type")
            content = it.get("content", "")
            agent_name = it.get("agentName", "")
            if itype == "user_directive":
                self.text_area.insert(tk.END, "\\n[TY]: " + content + "\\n", "user")
            elif itype == "speaker_response":
                self.text_area.insert(tk.END, f"\\n[{agent_name or 'SPIKER'}]:\\n{content}\\n", "speaker")
            else:
                self.text_area.insert(tk.END, f"  • [{agent_name}]: {content}\\n", "delib")
            self.text_area.see(tk.END)

if __name__ == "__main__":
    app = CouncilHUD()
    app.mainloop()
`;
    res.send(pythonScript);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server (Hub) running on http://localhost:${PORT}`);
    console.log(`WebSocket server listening on ws://localhost:${PORT}`);
  });
}

startServer();
