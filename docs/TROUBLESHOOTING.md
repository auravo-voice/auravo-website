# Auravo Web — Troubleshooting Guide

Symptoms → likely cause → fix. For architecture context see [DESIGN.md](./DESIGN.md).

---

## Deployment & proxy

### 502 Bad Gateway (Cloudflare or nginx)

**Symptom:** `auravo-web.auravo.ai` shows Cloudflare or nginx 502.

**Checks:**

```bash
# 1. Is Next responding on the host?
curl -sI http://127.0.0.1:3001/login

# 2. Container logs
podman logs auravo-web --tail 80

# 3. Env present at build (NEXT_PUBLIC_*)
podman inspect auravo-web --format '{{range .Config.Env}}{{println .}}{{end}}' | grep POCKETBASE
```

**Common fixes:**

| Cause | Fix |
|-------|-----|
| Wrong nginx upstream | Point `proxy_pass` to `127.0.0.1:3001` (host-published port) |
| nginx in container, app on host | Use `host.containers.internal:3001` (Podman) or host IP, not `127.0.0.1` inside nginx container |
| App crashed on start | Set `NEXT_PUBLIC_POCKETBASE_URL` at **image build**; rebuild image |
| Container not running | `podman ps`, restart container |

---

### Vercel: `npm ci` failed / lockfile out of sync

**Symptom:** Build fails with `EUSAGE` / missing packages in lockfile.

**Fix:**

```bash
rm -rf node_modules package-lock.json
npm install
git add package-lock.json
git commit -m "Sync package-lock.json"
git push
```

---

### Vercel: “This page couldn’t load” on `/dashboard`

**Symptom:** Generic server error after deploy (worked locally).

**Cause (historical):** SQLite on serverless — **fixed** by PocketBase migration. If still failing:

- Missing `NEXT_PUBLIC_POCKETBASE_URL` at build
- PocketBase collections missing
- Check Vercel function logs

---

## Authentication

### Sign in button disabled / old placeholder UI

**Symptom:** “Sign in (disabled)” on `/auth`.

**Fix:** Use **`/login`**, not `/auth` (redirects to login). Deploy latest code; old Vercel build may still show placeholder.

---

### White screen after Google sign-in on `auravo.ai` / `www.auravo.ai`

**Symptom:** Login with Google appears to work, then blank page on `/dashboard`.

**Cause:** DNS still routes `www.auravo.ai` (or apex → www) to **Vercel**, not Hetzner. Vercel cannot run SQLite → `/dashboard` returns **500** (`x-vercel-id` in response headers).

**Check:**

```bash
curl -sI https://www.auravo.ai/dashboard | grep -i x-vercel
curl -sI https://auravo-web.auravo.ai/dashboard | grep -i x-vercel
```

If the first shows `x-vercel-id` and the second does not, fix **Cloudflare DNS**:

| Record | Type | Value |
|--------|------|--------|
| `@` (auravo.ai) | A | `91.99.144.77` (proxied) |
| `www` | A | `91.99.144.77` (proxied) |

Remove CNAMEs pointing `@` or `www` to Vercel. Until DNS propagates, use **https://auravo-web.auravo.ai** (already on Hetzner).

Register Google OAuth redirect URIs for every app host you use, e.g. `https://www.auravo.ai/api/auth/oauth2/callback` and `https://auravo-web.auravo.ai/api/auth/oauth2/callback`.

---

### Google sign-in fails or redirects wrong

**Symptom:** Error on login page, or loop after Google.

**Checks:**

1. PocketBase → `users` → OAuth2 → Google enabled with valid client ID/secret.
2. Google Console → redirect URI exactly:
   - `https://<your-app-host>/api/auth/oauth2/callback`
3. Set `NEXT_PUBLIC_APP_URL=https://<your-app-host>` and rebuild.
4. PocketBase **allowed origins** includes your app host.

---

### “Sign in required” on API calls

**Symptom:** 401 from `/api/practice/exercise`, etc.

**Fix:** Log in at `/login`. Ensure `pb_auth` cookie is set (httpOnly). On HTTPS, `secure` cookies require HTTPS in production.

---

### CORS errors in browser console

**Symptom:** Blocked request to `pb.auravo.ai`.

**Fix:** PocketBase Admin → Settings → **Allowed origins** — add:

- `http://localhost:3000`
- `https://app.auravo.ai`
- `https://auravo-web.auravo.ai`
- Your Vercel URL

---

## PocketBase / data

### `Missing collection context` / 404 on assessment

**Symptom:** Terminal or API error referencing `baseline_segments`, `practice_sessions`, etc.

**Cause:** Collection not created in PocketBase admin.

**Fix:** Create all collections in [POCKETBASE.md](./POCKETBASE.md). App returns empty drafts where possible but cannot save without collections.

---

### Dashboard empty / “Complete your initial assessment”

**Symptom:** Logged in but no radar chart.

**Expected:** No baseline row in `onboarding_baselines` yet. Complete `/assessment`.

---

### Name shows “Learner” instead of Google name

**Fix:** Ensure `users` record has `name` or `display_name` in PocketBase. OAuth callback sets these on first login; update manually in admin if needed.

---

## Voice / coach / transcription

### Coach unavailable / timeout

**Symptom:** Yellow/red banner; fallback copy.

**Checks:**

```bash
curl http://127.0.0.1:11434/api/tags   # Ollama up?
```

**Fix:**

- Start Ollama; `ollama pull qwen2.5:3b`
- Increase `AURAVO_COACH_TIMEOUT_MS=180000` or `240000`
- From container: `OLLAMA_BASE_URL=http://host.containers.internal:11434`

---

### Transcription unavailable (503)

**Symptom:** `transcription_unavailable` on record upload.

**Fix (self-hosted):**

```bash
npm run setup:transcription
ffmpeg -version
which python3
```

Set `TRANSCRIPTION_PROVIDER=faster-whisper` and `FASTER_WHISPER_PYTHON` to venv python.

**Dev only:** `AURAVO_ALLOW_PLACEHOLDER_FALLBACK=1`

---

### Hydration / `<motionOAuthSep>` warnings

**Symptom:** React hydration mismatch on login.

**Fix:** Pull latest `oauth-buttons.tsx` (uses `OAuthEmailDivider`). Restart `npm run dev`.

---

## Container-specific

### `better-sqlite3` / `getDb` errors

**Cause:** Old code or image.

**Fix:** Rebuild from current `main` — SQLite removed.

---

### Cannot reach PocketBase from container

**Fix:** Use public URL `https://pb.auravo.ai`, not `127.0.0.1:8080`, unless PocketBase is on the same Docker network with a shared alias.

---

## Diagnostic commands (quick reference)

```bash
# App health
curl -sI http://127.0.0.1:3001/
curl -sI http://127.0.0.1:3001/login

# PocketBase
curl -s https://pb.auravo.ai/api/health

# Ollama
curl -s http://127.0.0.1:11434/api/tags

# Logs
podman logs auravo-web -f
```

---

## Still stuck?

1. Note **hostname**, **deploy type** (Vercel vs Podman), and **exact error** (browser vs server log).
2. Confirm PocketBase collections exist.
3. Confirm `NEXT_PUBLIC_POCKETBASE_URL` was set when running `npm run build`.

See [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) for intentional limitations.
