"use client";

import { useCallback, useRef, useState } from "react";

type RecognitionResultList = {
  length: number;
  [index: number]: { isFinal: boolean; 0?: { transcript?: string } };
};

type RecognitionResultEvent = {
  results: RecognitionResultList;
};

type BrowserRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getRecognitionCtor(): (new () => BrowserRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => BrowserRecognition;
    webkitSpeechRecognition?: new () => BrowserRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useBrowserSpeechRecognition() {
  const [supported] = useState(() => getRecognitionCtor() != null);
  const recognitionRef = useRef<BrowserRecognition | null>(null);
  const transcriptRef = useRef("");

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    transcriptRef.current = "";
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event: RecognitionResultEvent) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        const chunk = event.results[i];
        if (chunk) text += chunk[0]?.transcript ?? "";
      }
      transcriptRef.current = text.trim();
    };
    recognition.onerror = () => {
      /* keep partial transcript; caller may fall back to server Whisper */
    };
    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      recognitionRef.current = null;
    }
  }, []);

  const stop = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const recognition = recognitionRef.current;
      if (!recognition) {
        resolve("");
        return;
      }
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        recognitionRef.current = null;
        resolve(transcriptRef.current.trim());
      };
      recognition.onend = done;
      try {
        recognition.stop();
      } catch {
        done();
      }
      window.setTimeout(done, 1500);
    });
  }, []);

  const abort = useCallback(() => {
    try {
      recognitionRef.current?.abort();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
  }, []);

  return { supported, start, stop, abort };
}
