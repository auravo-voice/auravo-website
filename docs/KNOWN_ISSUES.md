# Auravo Web — Known Issues

Tracked limitations and gaps. For fixes see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

---

## Platform & deployment

| Issue | Impact | Workaround / status |
|-------|--------|---------------------|
| **`NEXT_PUBLIC_*` baked at build** | Changing PB URL without rebuild breaks client | Rebuild image / redeploy after URL change |
| **`npm ci` strict lockfile** | CI fails if lock not committed | Commit `package-lock.json` after `npm install` |
| **Podman/nginx network isolation** | 502 if proxy targets wrong upstream | Use `127.0.0.1:3001` on host nginx |
| **In-memory analysis concurrency cap** | Max 5 parallel jobs per container process | No cross-instance queue; user sees “servers busy” |

---

## Storage & backend

| Issue | Impact | Workaround / status |
|-------|--------|---------------------|
| **Hybrid storage on Hetzner** | Auth = PocketBase, data = SQLite | By design (`AURAVO_STORAGE=sqlite`); document for ops |
| **Quick Analysis usage tables SQLite-only** | Daily limits / subscriptions not in PocketBase mode | Use sqlite on Hetzner or extend PB adapters |
| **PocketBase data collections not auto-created** | 404 when `AURAVO_STORAGE=pocketbase` without setup | Create collections per [POCKETBASE.md](./POCKETBASE.md) |
| **No offline mode** | App requires live PocketBase for auth | None |

---

## Authentication

| Issue | Impact | Workaround / status |
|-------|--------|---------------------|
| **Apple Sign-In not implemented** | Web users cannot use Apple ID | Use email or Google |
| **OAuth redirect host sensitivity** | Wrong callback if `NEXT_PUBLIC_APP_URL` missing | Set env and rebuild |
| **Edge proxy only checks cookie presence** | Expired `pb_auth` may pass until API fails | Re-login |
| **Legacy `auravo_user_id` cookie** | Still minted in SQLite dev mode | PB auth is canonical in production |

---

## Quick Analysis

| Issue | Impact | Workaround / status |
|-------|--------|---------------------|
| **3 free assessments / day** | 4th requires Razorpay | Subscribe ₹500/mo or ₹5000/yr |
| **5-minute total recording cap** | Long answers auto-stop | By design |
| **Groq 429 under load** | Adds 5–30s retry delay | Automatic backoff in `chat-json.ts` |
| **Polish-transcript Groq schema failures** | Falls back to raw Whisper text | Non-blocking |
| **HF Hub unauthenticated warning** | Slower first Whisper model fetch on cold start | Set `HF_TOKEN` optional |
| **Contact / lead form removed** | No anonymous lead capture | Signed-in feature only |

---

## Product / UX

| Issue | Impact | Workaround / status |
|-------|--------|---------------------|
| **Settings “Delete account” disabled** | UI placeholder | Use PocketBase admin |
| **“Good evening” hardcoded on dashboard** | Wrong greeting by time of day | Cosmetic |

---

## Voice / analysis

| Issue | Impact | Workaround / status |
|-------|--------|---------------------|
| **Groq provider rate limits** | Slow Quick Analysis at peak | Retries; consider higher Groq tier |
| **Python 3.14 + Homebrew expat** | macOS transcription subprocess issues | Use 3.11–3.12 venv from `setup:transcription` |
| **Placeholder transcription** | Scores not from real audio | `TRANSCRIPTION_PROVIDER=faster-whisper` on server |

---

## Technical debt

| Issue | Notes |
|-------|--------|
| Next.js 16 uses `proxy.ts` instead of `middleware.ts` | Anonymous cookie minting for dev SQLite only |
| NFT / `next.config.ts` build warning | Turbopack trace noise; builds succeed |
| Razorpay webhook not implemented | Payment verified client-side via `/api/billing/razorpay/verify` only |
| `quick_analysis_lead` table legacy | Public demo leads; submit now requires auth |

---

## Resolved (historical)

| Issue | Resolution |
|-------|------------|
| SQLite on Vercel → dashboard crash | Hetzner uses SQLite with volume; auth via PocketBase |
| Public Quick Analysis demo | Moved behind sign-in + daily limits |
| Anonymous quick-analysis API bypass in proxy | Removed; APIs require `pb_auth` |

---

## Reporting new issues

Include:

1. URL (`www.auravo.ai` vs local)
2. Signed in? (Google vs email)
3. Quick Analysis step (segment / full / paywall)
4. Browser console + `podman logs auravo-web` snippet
5. `GROQ_API_KEY` / `RAZORPAY_*` present in production env (yes/no, not values)
