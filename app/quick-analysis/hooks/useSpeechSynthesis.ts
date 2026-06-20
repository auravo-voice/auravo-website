"use client";

import { useCallback, useRef, useState } from "react";

import { staticTtsUrlForText } from "@/app/quick-analysis/tts-prompts";

/** Deepgram can take several seconds locally; welcome copy is long. */
const TTS_FETCH_TIMEOUT_MS = 90_000;

/** Minimal WAV — unlocks Safari/HTML autoplay when played inside a click handler. */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";

export function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const onEndRef = useRef<(() => void) | undefined>(undefined);
  const speakGenerationRef = useRef(0);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const audioUnlockedRef = useRef(false);
  const pendingAfterUnlockRef = useRef<{ text: string; onEnd?: () => void } | null>(null);
  const speakImplRef = useRef<(text: string, onEnd?: () => void) => Promise<void>>(async () => {});
  const ttsCacheRef = useRef(new Map<string, Blob>());

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const stopAudio = useCallback(() => {
    speakGenerationRef.current += 1;
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = null;
    if (audioRef.current) {
      const el = audioRef.current;
      audioRef.current = null;
      el.onended = null;
      el.onerror = null;
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    revokeObjectUrl();
    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }
    setSpeaking(false);
    setCaption(null);
  }, [revokeObjectUrl]);

  const speakWithBrowserFallback = useCallback((text: string, onEnd?: () => void) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      onEnd?.();
      return;
    }
    window.speechSynthesis.cancel();
    setCaption(text);
    setSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.92;
    utterance.pitch = 1.02;
    utterance.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const voice =
      voices.find((v) => v.lang.startsWith("en") && v.name.toLowerCase().includes("samantha")) ??
      voices.find((v) => v.lang.startsWith("en") && v.localService) ??
      voices.find((v) => v.lang.startsWith("en")) ??
      null;
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      setSpeaking(false);
      setCaption(null);
      onEnd?.();
    };
    utterance.onerror = () => {
      setSpeaking(false);
      setCaption(null);
      onEnd?.();
    };
    window.speechSynthesis.speak(utterance);
  }, []);

  const waitForAudioReady = (audio: HTMLAudioElement, generation: number): Promise<void> =>
    new Promise((resolve, reject) => {
      if (speakGenerationRef.current !== generation) {
        reject(new Error("stale"));
        return;
      }
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onFail = () => {
        cleanup();
        reject(new Error("decode"));
      };
      const cleanup = () => {
        audio.removeEventListener("canplaythrough", onReady);
        audio.removeEventListener("error", onFail);
      };
      audio.addEventListener("canplaythrough", onReady, { once: true });
      audio.addEventListener("error", onFail, { once: true });
      audio.load();
    });

  const fetchTtsBlob = useCallback(async (text: string, signal?: AbortSignal): Promise<Blob> => {
    const staticUrl = staticTtsUrlForText(text);
    if (staticUrl) {
      const res = await fetch(staticUrl, { signal, cache: "force-cache" });
      if (res.ok) {
        const contentType = res.headers.get("Content-Type")?.split(";")[0]?.trim() || "audio/mpeg";
        return new Blob([await res.arrayBuffer()], { type: contentType });
      }
    }

    const res = await fetch("/api/quick-analysis/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    });
    if (!res.ok) throw new Error("TTS API failed");
    const contentType = res.headers.get("Content-Type")?.split(";")[0]?.trim() || "audio/mpeg";
    return new Blob([await res.arrayBuffer()], { type: contentType });
  }, []);

  const prefetchTts = useCallback(
    (text: string) => {
      const key = text.trim();
      if (!key || ttsCacheRef.current.has(key)) return;
      void fetchTtsBlob(key)
        .then((blob) => {
          if (!ttsCacheRef.current.has(key)) ttsCacheRef.current.set(key, blob);
        })
        .catch(() => {});
    },
    [fetchTtsBlob],
  );

  const speak = useCallback(
    async (text: string, onEnd?: () => void) => {
      stopAudio();
      const generation = speakGenerationRef.current;
      setCaption(text);
      setSpeaking(true);
      onEndRef.current = onEnd;

      const abort = new AbortController();
      fetchAbortRef.current = abort;
      const timeoutId = setTimeout(() => abort.abort("timeout"), TTS_FETCH_TIMEOUT_MS);

      try {
        const cached = ttsCacheRef.current.get(text);
        if (cached) ttsCacheRef.current.delete(text);

        const audioBlob =
          cached ?? (await fetchTtsBlob(text, abort.signal));

        clearTimeout(timeoutId);
        if (speakGenerationRef.current !== generation) return;

        revokeObjectUrl();
        const url = URL.createObjectURL(audioBlob);
        objectUrlRef.current = url;

        const audio = new Audio();
        audioRef.current = audio;
        audio.src = url;
        audio.preload = "auto";

        await waitForAudioReady(audio, generation);
        if (speakGenerationRef.current !== generation) return;

        audio.onended = () => {
          if (speakGenerationRef.current !== generation) return;
          revokeObjectUrl();
          audioRef.current = null;
          setSpeaking(false);
          setCaption(null);
          const cb = onEndRef.current;
          onEndRef.current = undefined;
          cb?.();
        };

        audio.onerror = () => {
          if (speakGenerationRef.current !== generation) return;
          revokeObjectUrl();
          audioRef.current = null;
          console.warn("[tts] Audio playback failed, falling back to browser synthesis");
          speakWithBrowserFallback(text, onEnd);
        };

        try {
          await audio.play();
        } catch (playErr) {
          if (speakGenerationRef.current !== generation) return;
          const blocked =
            playErr instanceof DOMException &&
            (playErr.name === "NotAllowedError" || playErr.name === "AbortError");
          if (blocked && !audioUnlockedRef.current) {
            pendingAfterUnlockRef.current = { text, onEnd };
            revokeObjectUrl();
            audioRef.current = null;
            setSpeaking(false);
            setCaption(text);
            return;
          }
          console.warn("[tts] Autoplay blocked, using browser synthesis:", playErr);
          revokeObjectUrl();
          audioRef.current = null;
          speakWithBrowserFallback(text, onEnd);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        if (speakGenerationRef.current !== generation) return;
        if (err instanceof Error && err.message === "stale") return;
        if (err instanceof Error && err.name === "AbortError") return;
        console.warn("[tts] TTS failed, falling back to browser synthesis:", err);
        speakWithBrowserFallback(text, onEnd);
      } finally {
        if (fetchAbortRef.current === abort) {
          fetchAbortRef.current = null;
        }
      }
    },
    [stopAudio, speakWithBrowserFallback, revokeObjectUrl, fetchTtsBlob],
  );

  speakImplRef.current = speak;

  const unlockFromGesture = useCallback(() => {
    audioUnlockedRef.current = true;
    if (typeof window === "undefined") return;
    const silent = new Audio(SILENT_WAV);
    silent.volume = 0.01;
    void silent.play().catch(() => {});
    const pending = pendingAfterUnlockRef.current;
    if (pending) {
      pendingAfterUnlockRef.current = null;
      void speakImplRef.current(pending.text, pending.onEnd);
    }
  }, []);

  const stop = useCallback(() => {
    pendingAfterUnlockRef.current = null;
    stopAudio();
    onEndRef.current = undefined;
  }, [stopAudio]);

  return { speak, stop, speaking, caption, unlockFromGesture, prefetchTts };
}
