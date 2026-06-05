#!/usr/bin/env python3
"""Transcribe a single audio file with faster-whisper.

Output: one JSON line on stdout with:
  {
    "text": str,
    "modelName": str,
    "durationSec": float,
    "language": str | null,
    "segments": [{ "start": float, "end": float, "text": str }],
    "words": [{ "word": str, "start": float, "end": float, "probability": float }],
    "lowConfidence": [{ "token": str, "probability": float }, ...]   # back-compat
  }

stderr is reserved for errors only. The Node adapter trims `words` length so it stays under
maxBuffer; this script keeps everything because Whisper itself caps token count.
"""

from __future__ import annotations

import json
import os
import re
import sys


def main() -> None:
    if len(sys.argv) < 2:
        sys.stderr.write("usage: transcribe_faster_whisper.py <absolute_audio_path>\n")
        sys.exit(2)
    audio_path = sys.argv[1]
    if not os.path.isfile(audio_path):
        sys.stderr.write(f"not a file: {audio_path}\n")
        sys.exit(3)
    model_size = os.environ.get("FASTER_WHISPER_MODEL", "small").strip() or "small"
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.stderr.write("faster_whisper package not installed (pip install faster-whisper)\n")
        sys.exit(4)
    try:
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        segments, info = model.transcribe(
            audio_path,
            beam_size=5,
            word_timestamps=True,
            vad_filter=True,
            language="en",
            initial_prompt=(
                "Hello. I am speaking in clear English, with proper punctuation and capitalization."
            ),
        )
        text_parts: list[str] = []
        words: list[dict[str, float | str]] = []
        seg_payload: list[dict[str, float | str]] = []
        low_conf: list[dict[str, float | str]] = []
        last_end = 0.0
        for seg in segments:
            text_parts.append(seg.text.strip())
            seg_payload.append(
                {
                    "start": round(float(seg.start or 0.0), 3),
                    "end": round(float(seg.end or 0.0), 3),
                    "text": seg.text.strip(),
                }
            )
            last_end = max(last_end, float(seg.end or 0.0))
            seg_words = getattr(seg, "words", None) or []
            for w in seg_words:
                raw = (getattr(w, "word", None) or "").strip()
                if not raw:
                    continue
                p = float(getattr(w, "probability", 0.0) or 0.0)
                ws = float(getattr(w, "start", 0.0) or 0.0)
                we = float(getattr(w, "end", 0.0) or 0.0)
                words.append(
                    {
                        "word": raw,
                        "start": round(ws, 3),
                        "end": round(we, 3),
                        "probability": round(p, 4),
                    }
                )
                core = re.sub(r"[^a-zA-Z']+", "", raw)
                if len(core) >= 3 and p < 0.42:
                    low_conf.append({"token": raw, "probability": round(p, 4)})

        # Prefer the model's duration estimate if available; else fall back to the last word/segment end.
        duration_sec = float(getattr(info, "duration", 0.0) or 0.0)
        if duration_sec <= 0.0:
            duration_sec = last_end
        language = getattr(info, "language", None)

        # Join segment texts; Whisper segments usually include closing punctuation.
        text = " ".join(p for p in text_parts if p).strip()
        # Cap low-confidence list for the Node maxBuffer (sorted: least confident first).
        low_conf = sorted(low_conf, key=lambda x: float(x["probability"]))[:40]

        payload = {
            "text": text,
            "modelName": model_size,
            "durationSec": round(duration_sec, 3),
            "language": language if isinstance(language, str) else None,
            "segments": seg_payload,
            "words": words,
            "lowConfidence": low_conf,
        }
        sys.stdout.write(json.dumps(payload, ensure_ascii=False))
        sys.stdout.flush()
    except Exception as e:
        sys.stderr.write(f"faster_whisper error: {e}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
