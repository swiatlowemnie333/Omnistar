package com.example.agentcompanion

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.util.Log
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import org.json.JSONObject

class AgentAccessibilityService : AccessibilityService() {

    private var webSocket: WebSocket? = null
    private val client = OkHttpClient()
    
    // ZMIEŃ TEN ADRES NA ADRES SWOJEJ APLIKACJI W SIECI 
    // Jeśli testujesz w tej samej sieci WiFi, użyj lokalnego IP komputera (np. 192.168.0.15:3000)
    // W produkcji to będzie adres WSS udostępniony z AI Studio (np. wss://twoj-adres.run.app)
    private val wsUrl = "ws://192.168.X.X:3000"

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d("AgentCompanion", "Accessibility Service Connected")
        connectWebSocket()
    }

    private fun connectWebSocket() {
        val request = Request.Builder().url(wsUrl).build()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: okhttp3.Response) {
                Log.d("AgentCompanion", "WebSocket Connected")
                webSocket.send("{\"type\": \"handshake\", \"device\": \"android\", \"status\": \"ready\"}")
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                Log.d("AgentCompanion", "Received command: $text")
                handleCommand(text)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: okhttp3.Response?) {
                Log.e("AgentCompanion", "WebSocket Error", t)
                // W prawdziwym środowisku dodałbyś logikę ponawiania (reconnect)
            }
        })
    }

    private fun handleCommand(jsonString: String) {
        try {
            val json = JSONObject(jsonString)
            val action = json.getString("action")

            when (action) {
                "click" -> {
                    val x = json.getDouble("x").toFloat()
                    val y = json.getDouble("y").toFloat()
                    performClick(x, y)
                }
                "scroll" -> {
                    // Implementacja scrollowania
                    // performGlobalAction(GLOBAL_ACTION_SCROLL_FORWARD)
                }
                "inspect_screen" -> {
                    val rootNode = rootInActiveWindow
                    // Agent może odczytać całe drzewo widoków i szukać portali z pracą
                    if (rootNode != null) {
                        val screenData = extractViewTree(rootNode)
                        webSocket?.send("{\"type\": \"screen_data\", \"data\": \"$screenData\"}")
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("AgentCompanion", "Command parse error", e)
        }
    }

    private fun performClick(x: Float, y: Float) {
        val path = Path()
        path.moveTo(x, y)
        
        // Zbuduj gest dotknięcia palcem
        val builder = GestureDescription.Builder()
        builder.addStroke(GestureDescription.StrokeDescription(path, 0, 100)) // 100ms dotyk
        
        dispatchGesture(builder.build(), object : GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) {
                Log.d("AgentCompanion", "Click successful at X:$x Y:$y")
            }
        }, null)
    }
    
    // Rekurencyjna funkcja czytająca tekst z ekranu do wysłania Mózgowi 3D
    private fun extractViewTree(node: AccessibilityNodeInfo): String {
        var data = ""
        if (node.text != null) data += node.text.toString() + " | "
        if (node.contentDescription != null) data += node.contentDescription.toString() + " | "
        
        for (i in 0 until node.childCount) {
            val child = node.getChild(i)
            if (child != null) {
                data += extractViewTree(child)
                child.recycle()
            }
        }
        return data
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Tu telefon automatycznie przechwytuje co się zmieniło na ekranie 
        // OPTYMALIZACJA (Delta Updates): Zamiast wysyłać cały ekran co X sekund,
        // reagujemy tylko na faktyczne zdarzenia zmiany i wysyłamy tylko to co się zmieniło.
        
        if (event?.eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
            val changedNode = event.source
            if (changedNode != null) {
                // Pobieramy tylko fragment drzewa (interfejsu UI), który uległ zmianie
                val deltaData = extractViewTree(changedNode)
                if (deltaData.isNotBlank()) {
                    // Agent 3D dostaje tylko zmienione kawałki - oszczędność danych i baterii (Zerowy Opór)
                    webSocket?.send("{\"type\": \"ui_delta_update\", \"data\": \"$deltaData\"}")
                }
                changedNode.recycle()
            }
        }
        
        /* 
         * W przypadku pełnego streamingu WIDEO (MediaProjection), architektura wygląda następująco:
         * 1. Nie wysyłamy pełnych klatek JPG w pętli.
         * 2. Używamy kodeka wideo sprzętowego (np. H.264 z MediaCodec API na Androidzie).
         * 3. Kodek H.264 natywnie oblicza RÓŻNICE między klatkami (tzw. P-frames i I-frames)
         * 4. Przesyłane są tylko zmienione piksele (Delta Pixels).
         */
    }

    override fun onInterrupt() {
        Log.d("AgentCompanion", "Accessibility Service Interrupted")
        webSocket?.close(1000, "Service Interrupted")
    }
}
