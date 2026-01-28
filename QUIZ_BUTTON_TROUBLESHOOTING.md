# “Begin Your Discovery” Button – Problems and Fixes

This doc lists **all possible causes** for the button not working and **everything that’s been done** to fix it.

---

## Where the button lives

| What | Where |
|------|--------|
| **Component** | `IntroScreen` |
| **File** | `src/components/quiz/IntroScreen.tsx` |
| **Button label** | “Begin Your Discovery” |
| **Page/route** | `/voice-quiz` (same page; “navigation” = switching from intro phase to quiz phase) |
| **Parent** | `VoiceArchetypeQuiz` in `src/components/quiz/VoiceArchetypeQuiz.tsx` |
| **Page file** | `src/pages/voice-quiz.astro` (mounts quiz with `client:load` on `QuizErrorBoundary`) |

---

## Possible problems (checklist)

### 1. **Form validation blocking without visible feedback**
- **What:** Form invalid (missing/invalid name, email, phone, occupation, or age group) so `validateForm()` returns false and the handler returns without calling `onStart`.
- **Effect:** Click seems to do nothing; no transition to quiz.
- **Fixes applied:** Validation errors are shown next to each field and in `errors` state; button handler runs `validateForm()` and returns early only when invalid so errors stay visible.

### 2. **Supabase/API failure and navigation**
- **What:** `saveUserDetails()` fails (network, 4xx/5xx, or Supabase not configured) and previously the code could still switch to quiz or do nothing clear.
- **Effect:** User thinks the button is broken or never sees why it failed.
- **Fixes applied:**
  - Navigate to quiz **only** when `response.success && response.data` (see `VoiceArchetypeQuiz.handleStartQuiz`).
  - On failure: set `startError`, leave user on intro, set `startStatus` to `idle` so the button is re-enabled.
  - Show `startError` in a red box above the form.
  - Added “Start quiz anyway” link when there is a `startError`, which calls `onStartDirect()` so the user can still reach the quiz.

### 3. **Form submitting and reloading the page**
- **What:** Button or Enter key triggers form submit and a full page reload.
- **Effect:** Form seems to “reset” or URL changes instead of showing quiz.
- **Fixes applied:**
  - Button is `type="button"` so it never submits the form.
  - `handleBeginDiscovery` and form `onSubmit` both call `e.preventDefault()`.
  - Form has `action="javascript:void(0)"` and `noValidate` to avoid native submit/validation.

### 4. **Clicks intercepted (overlay or parent)**
- **What:** Another element (e.g. overlay, gradient) has a higher stacking context and receives the click.
- **Effect:** Button doesn’t react.
- **Fixes applied:**
  - Quiz background gradient in `VoiceArchetypeQuiz` uses `pointer-events-none`.
  - Leave-confirmation modal is only shown when `showLeaveModal` is true (not on intro).
  - Button handler uses `e.stopPropagation()` so parent handlers don’t swallow the click.

### 5. **Button disabled and staying disabled**
- **What:** `isStarting` is true (stuck “saving”) so the button stays disabled.
- **Effect:** Button can’t be clicked or looks disabled with no way to retry.
- **Fixes applied:**
  - After save (success or failure), `setStartStatus('idle')` is always called so `isStarting` becomes false`.
  - When there’s an error, “Start quiz anyway” gives a path forward.
  - Button has `disabled:cursor-not-allowed disabled:opacity-70` so disabled state is obvious.

### 6. **Route or “navigation” mismatch**
- **What:** Expecting a full URL change (e.g. to `/voice-quiz`) or using a wrong path.
- **Reality:** The form is already on `/voice-quiz`. “Navigation” is in-app state: `phase` changes from `intro` to `quiz` on the same route.
- **Fixes applied:**
  - No router usage (Astro site); transition is `setPhase('quiz')` and `setCurrentQuestion(0)` in `VoiceArchetypeQuiz`.
  - Other links that should open the quiz (e.g. FinalCTA “Take a Voice Quiz”, Hero “Get Started”) point to `href="/voice-quiz"` (or `/voice-quiz?start=1` to skip intro) and use `window.location.href` or anchor so they reliably load the quiz page.

### 7. **Hydration / JavaScript not running**
- **What:** Quiz is not hydrated so the button has no React `onClick` (only static HTML).
- **Effect:** Click does nothing.
- **Fixes applied:**
  - Quiz is mounted under `QuizErrorBoundary` with `client:load` in `src/pages/quiz.astro`, so the tree (including IntroScreen) should hydrate.
  - If you still see no reaction, check devtools for JS errors and that the bundle loads; ensure `client:load` is on the wrapper so the whole quiz runs on the client.

### 8. **API / environment issues**
- **What:** `/api/quiz/submit-details` fails due to env or backend.
- **Effect:** `saveUserDetails` returns `success: false`; user stays on form (by design). If error wasn’t shown, it would look like the button did nothing.
- **Causes and fixes:**
  - **Supabase not configured:** Missing or invalid `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY`. API returns 503 with a message; that message is shown in `startError` and user can use “Start quiz anyway.”
  - **Missing `UPDATE_TOKEN_SECRET`:** API throws before responding; returns 500 and generic message; user sees `startError` and can use “Start quiz anyway.”
  - **Rate limit (429):** Too many submissions; API returns 429; `result.error` is shown in `startError`.
  - **Network error:** `fetch` throws; `saveUserDetails` returns `{ success: false, error: { message: 'Network error...' } }`; that message is shown and button is re-enabled.

### 9. **Client parsing of API response**
- **What:** API returns success but client expects a different shape and treats it as failure.
- **Checked:** API returns `{ success: true, data: { id, updateToken } }`. Client uses `response.ok` and `result.data` and returns `{ success: true, data: result.data }`. `handleStartQuiz` checks `response.success && response.data` and then `setSubmissionId(response.data.id)`. Shapes match; no fix needed.

### 10. **Phone validation too strict**
- **What:** Phone must be exactly 10 digits and start with 6–9 (Indian format). Other formats fail validation and block the button.
- **Effect:** “Begin Your Discovery” does nothing until phone matches.
- **Current state:** Validation is intentional; errors show under the phone field. If you need other formats, relax the regex in `IntroScreen.validateForm()` and/or backend.

---

## What was changed (summary of edits)

### `src/components/quiz/IntroScreen.tsx`
- **Button handler:** Single handler `handleBeginDiscovery`: `e.preventDefault()`, `e.stopPropagation()`, skip if `isStarting`, then `validateForm()`; only call `onStart(formData)` when valid. No longer calling `onStartDirect()` first (so we don’t navigate before save).
- **Form submit:** `handleSubmit` already prevents default and only calls `onStart(formData)` when valid.
- **Error UI:** When `startError` is set, show the message and a “Start quiz anyway” button that calls `onStartDirect?.()`.
- **Button:** `type="button"`, `disabled={isStarting}`, `onClick={handleBeginDiscovery}`, plus `cursor-pointer` and `disabled:cursor-not-allowed disabled:opacity-70`.

### `src/components/quiz/VoiceArchetypeQuiz.tsx`
- **handleStartQuiz:** After `await saveUserDetails(userInfo)`, only call `setPhase('quiz')` and `setCurrentQuestion(0)` when `response.success && response.data`. On failure set `startError` (from `response.error?.message` or a generic message) and do **not** change phase. Always call `setStartStatus('idle')` at the end so the button is re-enabled.
- **IntroScreen props:** Still passes `onStart={handleStartQuiz}`, `onStartDirect={() => { setPhase('quiz'); setCurrentQuestion(0); }}`, `isStarting={startStatus === 'saving'}`, `startError={startError}`.

### `src/components/home/FinalCTA.tsx` (earlier in conversation)
- **Quiz link:** “Take a Voice Quiz” uses `href="/quiz"` and `onClick` that does `window.location.href = '/quiz'` so navigation works even if something intercepts the anchor.
- **Hydration:** FinalCTA is used with `client:load` on the homepage so the click handler is active.

### `src/components/home/Hero.tsx` (earlier)
- **Primary CTA:** “Get Started” button links to `href="/voice-quiz"` so the main hero CTA opens the quiz.

### `src/pages/voice-quiz.astro`
- **Quiz route:** Canonical quiz page at `/voice-quiz`; mounts `<VoiceArchetypeQuiz client:load />`. `quiz.astro` and `quiz-start.astro` redirect to `/voice-quiz` and `/voice-quiz?start=1` respectively.

---

## Current flow (after fixes)

1. User fills form and clicks **“Begin Your Discovery”.**
2. **Prevent default** and stop propagation; if `isStarting`, return.
3. **Validate:** If invalid, `validateForm()` sets `errors` and returns; user sees field errors, no navigation.
4. If valid, call **`onStart(formData)`** → `handleStartQuiz` in parent.
5. Parent sets **`startStatus === 'saving'`** (button disabled, “Starting...”).
6. Parent **awaits** `saveUserDetails(userInfo)` (POST to `/api/quiz/submit-details`).
7. **On success:** Parent sets `submissionId`, then **`setPhase('quiz')`** and **`setCurrentQuestion(0)`** → user sees first question on the same `/quiz` page. Then `setStartStatus('idle')`.
8. **On failure:** Parent sets **`startError`**, does **not** change phase, then **`setStartStatus('idle')`**. User stays on form, sees the error and “Start quiz anyway”; clicking that calls **`onStartDirect()`** and switches to quiz without saving.

---

## If the button still doesn’t work, check

1. **Browser console:** Any JavaScript errors that prevent the handler from running or the quiz from hydrating?
2. **Network tab:** Does POST to `/api/quiz/submit-details` run? Status? Response body (e.g. 503, 500, 429)?
3. **Env:** Are `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, and `UPDATE_TOKEN_SECRET` set correctly where the API runs (e.g. Vercel)?
4. **Validation:** Fill every required field with valid values (name, email, 10-digit Indian phone, occupation, age group). See if the button then triggers the request and/or transition.
5. **“Start quiz anyway”:** If an error appears, use that link; it should always switch to the quiz phase regardless of save.

---

## Files touched (for your list)

- `src/components/quiz/IntroScreen.tsx` – Button handler, validation, error UI, “Start quiz anyway”.
- `src/components/quiz/VoiceArchetypeQuiz.tsx` – Navigate only on successful save; set and show error on failure; re-enable button.
- `src/components/home/FinalCTA.tsx` – Quiz link and client-side navigation to `/quiz`.
- `src/components/home/Hero.tsx` – “Get Started” → `/quiz`.
- `src/pages/voice-quiz.astro` – Quiz page at `/voice-quiz`.

**Exact route the button “navigates” to:** The user stays on **`/voice-quiz`**; the visible “navigation” is from the intro form to the first quiz question (same URL, phase change only). Links from the rest of the site that open the quiz use the path **`/voice-quiz`** (or **`/voice-quiz?start=1`** to skip intro).
