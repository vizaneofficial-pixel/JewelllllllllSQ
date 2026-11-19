# StallIQ Deployment Guide (GitHub + Vercel + Firebase)

## 1. Architecture Overview
- **Frontend**: React + TypeScript + Vite SPA built into `dist/`.
- **AI Serverless API (Vercel)**:
  - `api/health.ts` handles `GET /api/health`.
  - `api/ai/[action].ts` handles `GET /api/ai/health` and `POST /api/ai/{voice-turn,command-turn,cfo-audit,market-research,strategy,search-strategies,generate-image,parse-command,parse-raw-stock}`.
  - `api/ai/[action].ts` preserves the explicit ESM import specifier `../../src/server/aiHandlers.js`, and all server-reachable runtime imports inside `src/server/*` and `src/utils/aiActions.ts` use explicit `.js` specifiers.
  - `vercel.json` sets `"maxDuration": 60` for `api/**/*.ts`.
  - `GEMINI_API_KEY` stays strictly server-side — never referenced in `vite.config.ts` or any `src/` browser code.
- **Voice Mode on Vercel vs Local Express**:
  - **Vercel Serverless (Production)**: Vercel Serverless Functions do not host persistent WebSockets, so `GET /api/ai/health` returns `supportsLiveWs: false, supportsServerlessVoice: true`. `VoiceCoachModal` detects this immediately without waiting for a WebSocket timeout and runs **turn-based serverless voice** (`MediaRecorder` at 32 kbps with a 55s / 2.8 MB cap → `POST /api/ai/voice-turn` → `gemini-3.5-transcribe` → `gemini-4-hydrogen` tool turn → `gemini-3.8-flash-lite-tts` returning RIFF/WAVE audio).
  - **Local Express Server (`server.ts`)**: `GET /api/ai/health` returns `supportsLiveWs: true`, enabling the `/live` WebSocket bridge to `gemini-3.8-live` alongside `/api/ai/voice-turn`.
- **Database & Auth**: Firebase Auth (Google Sign-In) + Cloud Firestore (`users/{uid}`, `users/{uid}/workspaces/{workspaceId}`, `users/{uid}/aiMemories/{memoryId}`) with UID-private security rules in `firestore.rules` and CLI mapping in `firebase.json`.

## 2. Environment Variables (Vercel Project Settings)
Configure the following in **Vercel → Project → Settings → Environment Variables** (Production & Preview):

### Required (Server-Side Only — NEVER prefix with `VITE_`)
- `GEMINI_API_KEY` — Your Google Gemini API key for AI Coach, Serverless Voice (transcription + TTS), Plan Check, Market Research, and Concept Visuals.

### Optional Firebase Client Overrides
*(If omitted, the app falls back to the checked-in `firebase-applet-config.json`.)*
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_FIRESTORE_DATABASE_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`

## 3. Manual Firebase Console & CLI Steps
1. **Authorize your Vercel domain for Google Sign-In**:
   - In **Firebase Console → Authentication → Settings → Authorized Domains**, add your production Vercel domain (e.g., `your-app.vercel.app`) and any custom domain.
   - Without this, Google Sign-In popups will fail with `auth/unauthorized-domain`.
2. **Deploy `firestore.rules` to the provisioned Firestore database**:
   - `firebase.json` is configured for database `ai-studio-stalliqpro-81b35967-ef4f-4aed-8171-d2b4efd03a99` (matching `firebase-applet-config.json`). If you point to a different Firebase project or `(default)` database, update `"database"` in `firebase.json` first.
   - Run from an authorized Firebase CLI session:
     ```bash
     firebase use gen-lang-client-0641906722
     firebase deploy --only firestore:rules
     ```

## 4. Local Pre-Deploy Verification Commands
Run locally or in CI before pushing to GitHub:

```bash
# 1. Firestore rules security lint
npx eslint firestore.rules

# 2. Unit tests (optimizer, financial totals, supplier orders, AI tools, voice guards)
npx --yes tsx --test src/utils/*.test.ts

# 3. TypeScript check & Vite production build
npm run lint
npm run build

# 4. Vercel API ESM bundle check
npx esbuild "api/ai/[action].ts" --bundle --platform=node --format=esm --packages=external --outfile=/tmp/vercel-api-check.mjs && rm -f /tmp/vercel-api-check.mjs
```

## 5. Manual Post-Deploy Verification on Live Vercel
Run these checks directly against your deployed `https://<your-vercel-domain>` URL:
1. `GET https://<your-vercel-domain>/api/health` returns `200 OK` with `{ "ok": true, "hasGeminiKey": true, "runtime": "vercel-serverless" }`.
2. `GET https://<your-vercel-domain>/api/ai/health` returns `200 OK` with `{ "ok": true, "hasGeminiKey": true, "aiConfigured": true, "runtime": "vercel-serverless", "supportsLiveWs": false, "supportsServerlessVoice": true }`.
3. Sign in with a real verified Google account → confirm Step 1 of 3 Project Setup Wizard appears with zero demo data → create a project → add categories/products manually and via AI Coach → refresh page and verify Firestore persistence.
4. Sign in with a second Google account (or incognito) → verify complete UID account isolation (neither account can read the other's projects or AI memories).
5. Open AI Coach on the deployed Vercel site → test tap-to-record voice (`Voice` → speak → `Stop`) → verify transcript, workspace update, and WAV audio playback via `/api/ai/voice-turn`.
6. Ask AI Coach for a supplier order → verify the copied text contains ONLY wholesale unit costs, quantities, and purchase subtotals (zero selling prices or profit).
