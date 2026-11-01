# Agent 3D - Most Android (Companion App)

Poniżej znajduje się natywny kod dla systemu Android (napisany w Kotlinie). 
Jako agent działający w chmurze przeglądarkowej, nie mogę bezpośrednio skompilować pliku `.apk` na Twój telefon, dlatego wygenerowałem dla Ciebie gotowe pliki źródłowe. 

Aby wgrać to na swój telefon, musisz użyć komputera z zainstalowanym **Android Studio**.

## Instrukcja Krok po Kroku

### 1. Pobierz Android Studio
Pobierz darmowe oprogramowanie [Android Studio](https://developer.android.com/studio) na swój komputer (Windows/Mac/Linux) i zainstaluj.

### 2. Stwórz Nowy Projekt
1. Otwórz Android Studio i wybierz **"New Project"**.
2. Wybierz szablon **"Empty Views Activity"** lub **"No Activity"** (najlepiej "Empty Views Activity").
3. Nazwij aplikację np. `AgentCompanion`.
4. Wybierz język: **Kotlin**.
5. Minimum SDK: **API 26: Android 8.0 (Oreo)** (wymagane dla nowszych funkcji zrzutu ekranu).

### 3. Zastąp Pliki
Gdy projekt się uruchomi, musisz skopiować zawartość plików z tego folderu do odpowiednich miejsc w Twoim projekcie:

1. **`AndroidManifest.xml`**
   Otwórz plik `app/src/main/AndroidManifest.xml` w swoim projekcie i upewnij się, że masz tam uprawnienia oraz deklarację serwisu Accessibility, którą dla Ciebie przygotowałem.
2. **`AgentAccessibilityService.kt`**
   Skopiuj ten plik do folderu `app/src/main/java/com/twojanazwa/agentcompanion/`.
3. **`network_security_config.xml`**
   Często przy testach lokalnych (np. adres w stylu `ws://192.168.x.x:3000`) Android blokuje ruch bez SSL (tzw. cleartext). Należy dodać konfigurację security.

### 4. Co robi ten kod?
Przygotowany `AgentAccessibilityService.kt` to Usługa Ułatwień Dostępu. Ma uprawnienia by:
* Odczytywać drzewo widoków (to co widać na ekranie - napisy, przyciski).
* Otrzymywać komendy z serwera WebSocket (naszego Hubu 3D, w którym teraz jesteśmy).
* Automatycznie "klikać", "scrollować" (przesuwać ekran) czy "wpisywać tekst" (np. wpisać "Programista" na portalu z pracą).

Do przesyłania samego obrazu używa się `MediaProjection API`, którego implementację można później rozszerzyć w głównej Aktywności aplikacji.

### 5. Zbuduj i Zainstaluj (Uruchomienie)
1. Włącz w swoim telefonie Android **"Opcje Programisty"** (Developer Options) -> **"Debugowanie USB"** (USB Debugging).
2. Podłącz telefon do komputera kablem.
3. W Android Studio na górnym pasku pojawi się Twój telefon. Kliknij zielony przycisk **"Play (Run 'app')"**.
4. Aplikacja zainstaluje się na Twoim telefonie.
5. Na telefonie przejdź do: **Ustawienia -> Dostępność (Accessibility) -> Zainstalowane Aplikacje -> AgentCompanion** i przesuń suwak na **Włączone**.

Od tego momentu Twój telefon zacznie nawiązywać kontakt (przez WebSockets) z naszym panelem 3D.
