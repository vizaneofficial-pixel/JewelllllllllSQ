# StallIQ Production Readiness Checklist

## Verified Locally (Code Audit, Unit Tests, Build & Local Server)
- [x] **Firestore Security Rules (`firestore.rules` + `firebase.json`)**: Passes `npx eslint firestore.rules` (`@firebase/eslint-plugin-security-rules`). Global default-deny, strict `request.auth.uid == userId` + `email_verified == true` + `hasParentUser(userId)` isolation across `/users/{uid}`, `/users/{uid}/workspaces/{workspaceId}` (categories, products, savedPlans, purchaseProgress, actualSales, conversations, marketResearch, stallSetup), and `/users/{uid}/aiMemories/{memoryId}`. `firebase.json` maps `firestore.rules` to database `ai-studio-stalliqpro-81b35967-ef4f-4aed-8171-d2b4efd03a99`.
- [x] **Zero Hardcoded Demo Data**: No `"Grand Casa"`, `10,000` footfall, `₹9,000` rent, or pre-filled stock in real user workspaces. `"Need Attention"` banner removed.
- [x] **First-Login & Multi-Project Flow**: 3-step Project Setup Wizard (`1 of 3` Type → `2 of 3` Event/Business & Project Name → `3 of 3` Optional Footfall & Stall Rent) lands on **Categories & Products**; Project Switcher supports create, switch, rename, status, and delete with complete project isolation; sign-out resets UI state and clears stored active project ID.
- [x] **Financial & Supplier Order Integrity**: Unit-tested purchase totals, event expenses, conservative/full sell-through projections, break-even math, and wholesale-only supplier orders (zero selling prices or expected profit).
- [x] **AI Coach & Serverless Voice Hardening**:
  - Client conversation cap aligned to `12` (matching `firestore.rules`).
  - Vercel serverless voice (`MediaRecorder` at 32 kbps, 55s auto-stop, 2.8 MB size guard, clean cancellation on modal close, lean request payload omitting stored transcripts, safe non-JSON error handling, live conversation preservation on server state updates).
  - `api/ai/[action].ts` preserves explicit `.js` ESM specifier (`../../src/server/aiHandlers.js`) and bundles cleanly with `esbuild`.
  - `GEMINI_API_KEY` stays strictly server-side and is absent from `dist/`.
  - Local server tests verify `/api/health`, `/api/ai/health`, `/api/ai/voice-turn` (multi-product inventory creation + valid RIFF/WAVE TTS audio + `gemini-3.5-transcribe`), `/api/ai/command-turn`, `/api/ai/cfo-audit`, and `/api/ai/market-research`.

## Requires Manual Configuration & Live Production Verification
- [ ] Set `GEMINI_API_KEY` in **Vercel → Project Settings → Environment Variables** (Production & Preview) and redeploy.
- [ ] Add your Vercel production domain (and any custom domain) in **Firebase Console → Authentication → Settings → Authorized Domains**.
- [ ] Deploy `firestore.rules` to database `ai-studio-stalliqpro-81b35967-ef4f-4aed-8171-d2b4efd03a99` using `firebase deploy --only firestore:rules`.
- [ ] Verify `GET https://<your-vercel-domain>/api/ai/health` returns `200 OK` with `hasGeminiKey: true`, `aiConfigured: true`, `supportsLiveWs: false`, `supportsServerlessVoice: true`.
- [ ] Verify real Google Sign-In, sign-out, session persistence across reload, account isolation between two Google accounts, and Firestore persistence on the deployed Vercel URL.
- [ ] Verify live microphone recording and WAV voice playback via `/api/ai/voice-turn` on the deployed Vercel URL (desktop + mobile Safari/Chrome).
