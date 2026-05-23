# SpeakToHermes

Application Angular pour parler vocalement à Hermes Agent et recevoir ses réponses en texte.

## Architecture

```
[speaktohermes Angular app] ←→ [Hermes API server localhost:8642]
                                    (hermes-agent api_server platform)
       ↑
[STT Python server :8787] ←→ [faster-whisper base model]
      (flask + faster-whisper)
```

## Prérequis

- Hermes Agent démarré avec le platform adapter `api_server`
- Python avec `faster-whisper`, `flask`, `flask-cors`
- Node.js / Angular CLI

## Démarrage

### 1. Serveur STT (transcription vocale)

```bash
cd /home/hhoareau/speaktohermes
python3 stt_server.py
```

### 2. Serveur Angular dev

```bash
ng serve --host 0.0.0.0 --port 4201
```

Ou avec le script de lancement :

```bash
bash start.sh
```

### 3. Ouvrir l'app

```
http://localhost:4201
```

## API STT

```
POST /transcribe
Body: { "audio": "<base64>" }
Response: { "text": "...", "language": "fr", "language_probability": 0.98 }

GET /health
Response: { "status": "ok", "model": "base" }
```

## API Hermes (via api_server platform)

```
POST /v1/chat/completions
Headers: X-Hermes-Session-Id: <session_id>  (optionnel, pour continuité)
Body: { "model": "hermes-agent", "messages": [...], "stream": false }
```

## Fonctionnalités

- 🎤 Enregistrement vocal via microphone
- 🗣️ Transcription avec faster-whisper (français)
- 💬 Conversation avec Hermes Agent
- 🔊 Synthèse vocale (Web Speech API) pour lire les réponses
- 🆕 Bouton "New session" pour démarrer une nouvelle session Hermes
- 📊 Indicateur de santé des services

## Fichiers clés

- `src/app/app.ts` — Composant principal
- `src/app/hermes.service.ts` — Service de communication avec Hermes API
- `src/app/voice.service.ts` — Service d'enregistrement et transcription
- `stt_server.py` — Serveur Python STT (faster-whisper)
- `src/app/app.scss` — Styles de l'interface
- `src/app/app.html` — Template Angular

## Build production

```bash
ng build --configuration production
# Sortie: dist/speaktohermes/browser/
```