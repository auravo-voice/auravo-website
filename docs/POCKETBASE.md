# PocketBase setup for Auravo Web

## Storage mode (`AURAVO_STORAGE`)

| Value | Data (sessions, scores, …) | Auth (Google / email) |
|--------|---------------------------|------------------------|
| `sqlite` (default) | Local `./data/auravo.sqlite` | PocketBase when `NEXT_PUBLIC_POCKETBASE_URL` is set |
| `pocketbase` | PocketBase collections below | PocketBase (required) |

Restart the dev server after changing `AURAVO_STORAGE`.

## Environment

```bash
AURAVO_STORAGE=sqlite
NEXT_PUBLIC_POCKETBASE_URL=https://pb.auravo.ai
```

Set the same variable in **Vercel** → Project → Settings → Environment Variables.

## Auth (`users` collection)

The web app uses the **existing** PocketBase auth collection `users` (shared with mobile):

- Login: `pb.collection("users").authWithPassword(email, password)`
- Signup: `pb.collection("users").create({ email, password, passwordConfirm, name, display_name })`
- Logout: `pb.authStore.clear()` + clear `pb_auth` cookie
- Google: **Continue with Google** → `/api/auth/oauth2/start` → Google → `/api/auth/oauth2/callback` → `pb_auth` cookie

Optional fields on `users` (add in admin if missing):

| Field | Type | Notes |
|-------|------|--------|
| `display_name` | Text | Web dashboard greeting |
| `onboarding_goal_id` | Text | Settings / coach narrative |

Do **not** create a second users collection.

## Data collections (required — create in admin)

If you only had the **`users`** auth collection for mobile, the web app also needs the tables below.  
Without them you will see errors like **`Missing collection context`** / **`404`** on `/api/assessment/draft`.

**PocketBase Admin → Collections → + New collection** for each row:

| Collection | Type | Key fields |
|------------|------|------------|
| `practice_sessions` | Base | `user` (relation→users), `kind`, `title`, `audio` (file), `duration_ms`, `segments_json` |
| `session_scores` | Base | `session` (relation→practice_sessions), six score numbers, `filler_words` |
| `session_transcripts` | Base | `session`, `text`, `adapter`, `analysis_json` |
| `onboarding_baselines` | Base | `user`, `session` |
| `baseline_segments` | Base | `user`, `segment_kind`, `audio` (file), `transcript`, `session` (optional) |
| `simulation_turns` | Base | `session`, `turn_index`, `role`, `text`, `audio` (file), `duration_ms` |
| `baseline_handoffs` | Base | `session`, `user` (one-shot handoff after assessment) |

API rules: authenticated users should only read/write rows where `user = @request.auth.id` (or via relation).

## CORS & allowed origins (PocketBase Admin)

**Settings → Application** (or **Settings → API** depending on PB version):

1. **Allowed origins** — add every origin that will call the API from the browser:
   - `http://localhost:3000`
   - `http://127.0.0.1:3000`
   - `https://auravo.ai`
   - `https://www.auravo.ai` (if used)
   - `https://app.auravo.ai`
   - Your Vercel URL(s), e.g. `https://auravo-website.vercel.app` and preview URLs if needed

2. **Allowed export origins** — same list if you export files from the client.

3. **Allowed iframe origins** — only if you embed the admin or app in iframes (usually leave empty).

For **Vercel preview deployments**, either add `https://*.vercel.app` if PocketBase supports wildcards, or add each preview domain you use.

**Settings → Auth** (auth collection):

- Ensure **Auth** is enabled on `users`.
- **Auth token duration** — match how long you want sessions (web uses `pb_auth` cookie).

### Google OAuth2 (web)

1. **Google Cloud Console** → APIs & Services → Credentials → OAuth 2.0 Client:
   - **Authorized JavaScript origins:** same as CORS origins above (e.g. `http://localhost:3000`, `https://app.auravo.ai`).
   - **Authorized redirect URIs** (this app’s callback, not PocketBase’s popup URL):
     - `http://localhost:3000/api/auth/oauth2/callback`
     - `https://app.auravo.ai/api/auth/oauth2/callback`
     - `https://auravo.ai/api/auth/oauth2/callback` (if the Next app is on the apex domain)
     - Each Vercel deployment URL: `https://<project>.vercel.app/api/auth/oauth2/callback`

2. **PocketBase Admin** → Collections → **users** → Settings (gear) → **OAuth2**:
   - Enable **Google**
   - Paste Google **Client ID** and **Client Secret**
   - Save

3. **Vercel:** set `NEXT_PUBLIC_APP_URL` to your canonical app URL if OAuth redirects land on the wrong host.

## Vercel

- No SQLite or local `data/` folder required.
- Ollama / faster-whisper still need a server with those services (or env pointing to Hetzner); PocketBase only replaces DB + auth.
