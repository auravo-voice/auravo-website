"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Delay after cancel() — required on Safari/Chrome or speak() often does nothing. */
const SPEAK_AFTER_CANCEL_MS = 50;

export function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const pendingSpeakRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const load = () => window.speechSynthesis?.getVoices();
    load?.();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = load;
      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  const stop = useCallback(() => {
    if (pendingSpeakRef.current) {
      clearTimeout(pendingSpeakRef.current);
      pendingSpeakRef.current = null;
    }
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setSpeaking(false);
    setCaption(null);
  }, []);

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        onEnd?.();
        return;
      }

      if (pendingSpeakRef.current) {
        clearTimeout(pendingSpeakRef.current);
        pendingSpeakRef.current = null;
      }
      window.speechSynthesis.cancel();

      pendingSpeakRef.current = setTimeout(() => {
        pendingSpeakRef.current = null;
        const synth = window.speechSynthesis;
        if (!synth) {
          onEnd?.();
          return;
        }

        synth.resume();

        setCaption(text);
        setSpeaking(true);
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.92;
        utterance.pitch = 1.02;
        utterance.volume = 1;
        const voices = synth.getVoices();
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
        synth.speak(utterance);
      }, SPEAK_AFTER_CANCEL_MS);
    },
    [],
  );

  useEffect(() => () => stop(), [stop]);

  return { speak, stop, speaking, caption };
}
