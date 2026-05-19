# Auravo Web — Known Issues

Tracked limitations and gaps as of the PocketBase migration. Not every item has a workaround.

---

## Platform & deployment

| Issue | Impact | Workaround / status |
|-------|--------|---------------------|
| **Vercel serverless cannot run Whisper/ffmpeg locally** | Real ASR needs self-hosted API or placeholder | Deploy API-heavy routes on Hetzner; or `TRANSCRIPTION_PROVIDER=placeholder` |
| **Ollama not on Vercel** | Coach uses fallbacks unless `OLLAMA_BASE_URL` points to external host | Run Ollama on Hetzner; set env on Vercel to private URL |
| **`NEXT_PUBLIC_*` baked at build** | Changing PB URL without rebuild breaks client | Rebuild image / redeploy Vercel after URL change |
| **`npm ci` strict lockfile** | Vercel build fails if lock not committed | Always commit `package-lock.json` after `npm install` |
| **Podman/nginx network isolation** | 502 if proxy targets wrong `127.0.0.1` | Use host-published port or container DNS name — see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) |

---

## PocketBase / backend

| Issue | Impact | Workaround / status |
|-------|--------|---------------------|
| **Data collections not auto-created** | Assessment/API 404 until admin setup | Manually create collections per [POCKETBASE.md](./POCKETBASE.md) |
| **Mobile vs web schema drift** | Field name mismatches if mobile uses different collection names | Align collection/field names with mobile team |
| **No offline mode** | App requires live PocketBase | None |
| **File size limits** | Large uploads may fail per PB settings | Adjust PocketBase max upload size in admin |

---

## Authentication

| Issue | Impact | Workaround / status |
|-------|--------|---------------------|
| **Apple Sign-In not implemented** | Web users cannot use Apple ID | Use email or Google |
| **OAuth redirect host sensitivity** | Wrong callback if `NEXT_PUBLIC_APP_URL` missing | Set env and rebuild |
| **Session = cookie only** | No server-side session store beyond PB token | By design (PocketBase JWT) |

---

## Product / UX

| Issue | Impact | Workaround / status |
|-------|--------|---------------------|
| **Settings “Delete account” disabled** | UI placeholder | Use PocketBase admin |
| **Progress copy may reference local `data/uploads`** | Misleading text in settings/progress | Cosmetic; files are in PocketBase |
| **“Good evening” hardcoded on dashboard** | Wrong greeting in morning | Cosmetic — future i18n/time-of-day |
| **Middleware only checks cookie presence** | Expired token may pass until API fails | PB refresh not wired on every route |

---

## Voice / analysis

| Issue | Impact | Workaround / status |
|-------|--------|---------------------|
| **Coach timeout on slow CPU / 7b model** | Long dashboard narrative waits | Raise `AURAVO_COACH_TIMEOUT_MS`; use `qwen2.5:3b` |
| **Python 3.14 + Homebrew expat** | macOS transcription subprocess issues | Use 3.11–3.12 venv from `setup:transcription` |
| **openSMILE / VAD optional** | Some scores transcript-only without packages | Run `npm run setup:transcription` |
| **Placeholder transcription** | Scores not from real audio | Set `TRANSCRIPTION_PROVIDER=faster-whisper` on server |

---

## Technical debt

| Issue | Notes |
|-------|--------|
| Legacy `auravo_user_id` cookie helpers still in codebase for some client handoff paths | Being phased out; PB auth is canonical |
| No Dockerfile in repo root by default | Example in [INSTALLATION.md](./INSTALLATION.md) — add to repo if desired |
| Next.js 16 middleware deprecation warning | “Use proxy instead of middleware” — monitor Next upgrades |
| NFT / `next.config.ts` build warning | Turbopack trace includes analysis imports — noisy but builds succeed |

---

## Resolved (historical)

| Issue | Resolution |
|-------|------------|
| SQLite on Vercel → dashboard crash | Migrated to PocketBase |
| Anonymous auto user cookie | Replaced with `/login` + `pb_auth` |
| “Demo learner” in sidebar | Shows PocketBase user display name |
| Sign in disabled placeholder | Working `/login` + Google OAuth |

---

## Reporting new issues

When filing a bug, include:

1. URL (e.g. `auravo-web.auravo.ai` vs Vercel)
2. Logged in? (Google vs email)
3. Browser console + server/container log snippet
4. Whether PocketBase collections exist
5. `NEXT_PUBLIC_POCKETBASE_URL` set at build time (yes/no)
