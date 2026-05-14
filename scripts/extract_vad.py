#!/usr/bin/env python3
"""Local Voice Activity Detection for a single audio file.

Tries providers in priority order:
  1. silero-vad (preferred — ML-grade accuracy; bundles ONNX model + onnxruntime)
  2. webrtcvad   (lightweight fallback — pure C extension, decades-old, no ML deps)

Input: an absolute path to a 16 kHz mono WAV file (Node passes a pre-converted file).

Output: one JSON line on stdout, e.g.
  {
    "ok": true,
    "provider": "silero" | "webrtcvad",
    "sampleRateHz": 16000,
    "durationSec": 12.34,
    "speakingSec": 8.10,
    "silenceSec": 4.24,
    "speakingRatio": 0.657,
    "voicedSegments": [
      {"start": 0.32, "end": 4.20},
      {"start": 4.95, "end": 8.85}
    ]
  }

If no provider is available, prints {"ok": false, "reason": "vad_unavailable"} and exits 0
so the Node side can mark VAD as unavailable without throwing. Anything else exits non-zero.
"""

from __future__ import annotations

import json
import os
import sys
import wave
from typing import Any


def _read_wav_mono(path: str) -> tuple[bytes, int, int]:
    """Read a PCM WAV file. Returns (pcm_bytes, sample_rate, num_samples)."""
    with wave.open(path, "rb") as wf:
        if wf.getsampwidth() != 2:
            raise ValueError(f"expected 16-bit PCM, got sampwidth={wf.getsampwidth()}")
        if wf.getnchannels() != 1:
            raise ValueError(f"expected mono, got {wf.getnchannels()} channels")
        sr = wf.getframerate()
        n_frames = wf.getnframes()
        pcm = wf.readframes(n_frames)
    return pcm, sr, n_frames


def _segments_from_mask(
    voiced_frames: list[bool],
    frame_duration_sec: float,
    min_silence_sec: float = 0.20,
) -> list[dict[str, float]]:
    """Collapse a per-frame voiced/unvoiced mask into [start, end] speech segments.

    Frames within `min_silence_sec` are merged into the previous voiced segment so a single
    breath does not split a phrase into two segments. Anything longer than `min_silence_sec`
    counts as a silence boundary.
    """
    segments: list[dict[str, float]] = []
    current_start: float | None = None
    silence_run = 0.0
    for i, voiced in enumerate(voiced_frames):
        t = i * frame_duration_sec
        if voiced:
            if current_start is None:
                current_start = t
            silence_run = 0.0
        else:
            if current_start is None:
                continue
            silence_run += frame_duration_sec
            if silence_run >= min_silence_sec:
                end_time = t - silence_run + frame_duration_sec
                segments.append({"start": round(current_start, 3), "end": round(end_time, 3)})
                current_start = None
                silence_run = 0.0
    # Tail-flush: if the file ends mid-segment, close it at the last frame's end.
    if current_start is not None:
        total_dur = len(voiced_frames) * frame_duration_sec
        segments.append({"start": round(current_start, 3), "end": round(total_dur, 3)})
    return segments


def _summary(voiced_segments: list[dict[str, float]], total_sec: float, sr: int, provider: str) -> dict[str, Any]:
    speaking = sum(max(0.0, seg["end"] - seg["start"]) for seg in voiced_segments)
    speaking = min(speaking, total_sec)
    silence = max(0.0, total_sec - speaking)
    return {
        "ok": True,
        "provider": provider,
        "sampleRateHz": sr,
        "durationSec": round(total_sec, 3),
        "speakingSec": round(speaking, 3),
        "silenceSec": round(silence, 3),
        "speakingRatio": round(speaking / total_sec, 4) if total_sec > 0 else 0.0,
        "voicedSegments": voiced_segments,
    }


def _try_silero(audio_path: str) -> dict[str, Any] | None:
    """Returns a payload or None if silero-vad is not available."""
    try:
        # `silero-vad` exposes a minimal API that uses onnxruntime internally — no torch needed
        # in recent versions. If torch is installed it will still use that, but we don't require it.
        from silero_vad import load_silero_vad, read_audio, get_speech_timestamps  # type: ignore
    except Exception:
        return None
    try:
        model = load_silero_vad(onnx=True)
    except Exception:
        # Fallback: try torch path. If that fails too, surrender silero.
        try:
            model = load_silero_vad()
        except Exception:
            return None
    try:
        wav = read_audio(audio_path, sampling_rate=16000)
        ts = get_speech_timestamps(
            wav,
            model,
            sampling_rate=16000,
            min_silence_duration_ms=200,
            min_speech_duration_ms=120,
        )
        # ts entries are {start, end} sample indices.
        segments = [
            {"start": round(t["start"] / 16000, 3), "end": round(t["end"] / 16000, 3)} for t in ts
        ]
        total = len(wav) / 16000
        return _summary(segments, total, 16000, "silero")
    except Exception as e:
        sys.stderr.write(f"silero-vad runtime error: {e}\n")
        return None


def _try_webrtc(audio_path: str) -> dict[str, Any] | None:
    """Returns a payload or None if webrtcvad is not available."""
    try:
        import webrtcvad  # type: ignore
    except Exception:
        return None
    try:
        pcm, sr, n_frames = _read_wav_mono(audio_path)
    except Exception as e:
        sys.stderr.write(f"webrtcvad: cannot read WAV: {e}\n")
        return None
    # webrtcvad only supports 8000/16000/32000/48000 Hz and 10/20/30 ms frames.
    if sr not in (8000, 16000, 32000, 48000):
        sys.stderr.write(f"webrtcvad: unsupported sample rate {sr}\n")
        return None
    vad = webrtcvad.Vad(2)  # 0=loose, 3=aggressive; 2 = balanced for speaking-coach use.
    frame_ms = 30
    frame_bytes = int(sr * (frame_ms / 1000.0)) * 2  # 16-bit mono → 2 bytes/sample
    voiced: list[bool] = []
    for off in range(0, len(pcm) - frame_bytes + 1, frame_bytes):
        chunk = pcm[off : off + frame_bytes]
        try:
            voiced.append(vad.is_speech(chunk, sr))
        except Exception:
            voiced.append(False)
    segments = _segments_from_mask(voiced, frame_ms / 1000.0, min_silence_sec=0.20)
    total = n_frames / sr
    return _summary(segments, total, sr, "webrtcvad")


def main() -> None:
    if len(sys.argv) < 2:
        sys.stderr.write("usage: extract_vad.py <absolute_wav_path>\n")
        sys.exit(2)
    audio_path = sys.argv[1]
    if not os.path.isfile(audio_path):
        sys.stderr.write(f"not a file: {audio_path}\n")
        sys.exit(3)

    # Allow forcing a provider via env (useful in tests / when comparing).
    forced = (os.environ.get("AURAVO_VAD_PROVIDER") or "").strip().lower()

    payload: dict[str, Any] | None = None
    if forced == "webrtcvad":
        payload = _try_webrtc(audio_path)
    elif forced == "silero":
        payload = _try_silero(audio_path)
    else:
        payload = _try_silero(audio_path) or _try_webrtc(audio_path)

    if payload is None:
        sys.stdout.write(json.dumps({"ok": False, "reason": "vad_unavailable"}))
        sys.stdout.flush()
        return

    sys.stdout.write(json.dumps(payload))
    sys.stdout.flush()


if __name__ == "__main__":
    main()
