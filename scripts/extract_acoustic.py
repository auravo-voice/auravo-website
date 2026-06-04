#!/usr/bin/env python3
"""Parselmouth + librosa acoustic analysis (replaces openSMILE).

Stdout: JSON object with pitch, intensity, and rhythm time-series summaries.
"""

from __future__ import annotations

import json
import sys

import librosa
import numpy as np
import parselmouth
from parselmouth.praat import call

COLLAPSE_MIN_DURATION_SEC = 0.35
COLLAPSE_MERGE_GAP_SEC = 0.12


def _normalize_collapse_segments(
    segments: list[dict[str, float]],
) -> list[dict[str, float]]:
    filtered = [
        s
        for s in segments
        if s["end"] > s["start"] and (s["end"] - s["start"]) >= COLLAPSE_MIN_DURATION_SEC
    ]
    filtered.sort(key=lambda s: s["start"])
    merged: list[dict[str, float]] = []
    for seg in filtered:
        if merged and seg["start"] - merged[-1]["end"] <= COLLAPSE_MERGE_GAP_SEC:
            merged[-1]["end"] = max(merged[-1]["end"], seg["end"])
        else:
            merged.append({"start": seg["start"], "end": seg["end"]})
    return merged


def analyze_audio(wav_path: str) -> dict:
    snd = parselmouth.Sound(wav_path)

    pitch = snd.to_pitch()
    pitch_values = pitch.selected_array["frequency"]
    pitch_times = pitch.xs()
    pitch_values_clean = pitch_values[pitch_values > 0]

    intensity = snd.to_intensity()
    intensity_values = intensity.values[0]
    intensity_times = intensity.xs()

    mean_intensity = float(np.mean(intensity_values))
    collapse_threshold = mean_intensity - 10
    collapse_segments: list[dict[str, float]] = []
    in_collapse = False
    start_t: float | None = None
    for t, v in zip(intensity_times, intensity_values):
        if v < collapse_threshold and not in_collapse:
            in_collapse = True
            start_t = float(t)
        elif v >= collapse_threshold and in_collapse and start_t is not None:
            in_collapse = False
            collapse_segments.append({"start": round(start_t, 2), "end": round(float(t), 2)})
    if in_collapse and start_t is not None and len(intensity_times) > 0:
        collapse_segments.append(
            {"start": round(start_t, 2), "end": round(float(intensity_times[-1]), 2)}
        )
    collapse_segments = _normalize_collapse_segments(collapse_segments)

    pitch_range = (
        float(np.percentile(pitch_values_clean, 90) - np.percentile(pitch_values_clean, 10))
        if len(pitch_values_clean) > 0
        else 0.0
    )
    pitch_mean = float(np.mean(pitch_values_clean)) if len(pitch_values_clean) > 0 else 0.0

    y, sr = librosa.load(wav_path, sr=None)
    rms = librosa.feature.rms(y=y)[0]
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    tempo_scalar = float(np.asarray(tempo).flat[0]) if np.size(tempo) else 0.0
    spectral_contrast = librosa.feature.spectral_contrast(y=y, sr=sr)
    clarity_score = float(np.mean(spectral_contrast))

    timeline = [
        {"t": round(float(t), 2), "hz": round(float(v), 1)}
        for t, v in zip(pitch_times, pitch_values)
        if v > 0
    ][::10]

    return {
        "ok": True,
        "pitch": {
            "mean": pitch_mean,
            "range": pitch_range,
            "is_monotone": pitch_range < 50,
            "timeline": timeline,
        },
        "intensity": {
            "mean": mean_intensity,
            "collapse_segments": collapse_segments,
        },
        "rhythm": {
            "tempo_variation": tempo_scalar,
            "clarity_score": clarity_score,
        },
    }


def main() -> None:
    if len(sys.argv) < 2:
        sys.stderr.write("usage: extract_acoustic.py <absolute_wav_path>\n")
        sys.exit(2)
    wav_path = sys.argv[1]
    try:
        payload = analyze_audio(wav_path)
        sys.stdout.write(json.dumps(payload, ensure_ascii=False))
        sys.stdout.flush()
    except Exception as e:
        sys.stderr.write(f"extract_acoustic error: {e}\n")
        sys.stdout.write(json.dumps({"ok": False, "reason": str(e)}))
        sys.stdout.flush()
        sys.exit(1)


if __name__ == "__main__":
    main()
