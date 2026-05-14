#!/usr/bin/env python3
"""Run openSMILE eGeMAPSv02 over one audio file and emit a compact JSON summary.

Input: an absolute path to a 16 kHz mono WAV file (the Node side converts with ffmpeg first).
Output: one JSON line on stdout, e.g.
  {
    "ok": true,
    "feature_set": "eGeMAPSv02",
    "durationSec": 12.34,
    "pitchMeanHz": 142.6,
    "pitchStddevHz": 28.1,
    "pitchRangeHz": 110.0,
    "loudnessMean": 0.42,
    "loudnessStddev": 0.10,
    "loudnessRange": 0.65,
    "hnrMeanDb": 8.4,
    "jitterLocalPct": 0.65,
    "shimmerLocalPct": 5.1,
    "voicedRatio": 0.71,
    "f0SemitoneStddev": 2.6
  }

If openSMILE (the Python `opensmile` PyPI package) is not installed, prints
  {"ok": false, "reason": "opensmile_missing"} and exits 0 so the Node side
can mark acoustic features as unavailable without throwing.

Other failures exit non-zero with an explanation on stderr (Node treats those as hard errors
in `faster-whisper` strict mode).
"""
from __future__ import annotations

import json
import math
import os
import sys
from typing import Any


def _summary_value(summary_row: Any, names: list[str]) -> float | None:
    """Look up the first matching column in a single-row pandas Series."""
    for name in names:
        if name in summary_row:
            try:
                v = float(summary_row[name])
            except (TypeError, ValueError):
                continue
            if math.isfinite(v):
                return v
    return None


def main() -> None:
    if len(sys.argv) < 2:
        sys.stderr.write("usage: extract_opensmile.py <absolute_wav_path>\n")
        sys.exit(2)
    audio_path = sys.argv[1]
    if not os.path.isfile(audio_path):
        sys.stderr.write(f"not a file: {audio_path}\n")
        sys.exit(3)

    try:
        import opensmile  # type: ignore
    except ImportError:
        sys.stdout.write(json.dumps({"ok": False, "reason": "opensmile_missing"}))
        sys.stdout.flush()
        return

    try:
        smile = opensmile.Smile(
            feature_set=opensmile.FeatureSet.eGeMAPSv02,
            feature_level=opensmile.FeatureLevel.Functionals,
        )
        df = smile.process_file(audio_path)
    except Exception as e:
        sys.stderr.write(f"opensmile error: {e}\n")
        sys.exit(1)

    if df is None or df.empty:
        sys.stdout.write(json.dumps({"ok": False, "reason": "empty_result"}))
        sys.stdout.flush()
        return

    row = df.iloc[0]

    # eGeMAPSv02 functional feature names. We surface a curated subset that maps cleanly onto
    # the speaking-coaching metrics we want — not the raw 88-feature dump.
    pitch_mean_hz = _summary_value(
        row,
        ["F0semitoneFrom27.5Hz_sma3nz_amean"],  # semitone version; converted to Hz below
    )
    # If only semitone mean is present (eGeMAPS shipped this way for years), convert back to Hz.
    if pitch_mean_hz is not None:
        pitch_mean_hz = 27.5 * (2 ** (pitch_mean_hz / 12.0))

    f0_semitone_std = _summary_value(row, ["F0semitoneFrom27.5Hz_sma3nz_stddevNorm"])
    f0_semitone_range = _summary_value(
        row,
        ["F0semitoneFrom27.5Hz_sma3nz_pctlrange0-2", "F0semitoneFrom27.5Hz_sma3nz_range"],
    )

    loudness_mean = _summary_value(row, ["loudness_sma3_amean"])
    loudness_std = _summary_value(row, ["loudness_sma3_stddevNorm"])
    loudness_range = _summary_value(
        row,
        ["loudness_sma3_pctlrange0-2", "loudness_sma3_range"],
    )

    hnr_mean_db = _summary_value(row, ["HNRdBACF_sma3nz_amean"])
    jitter_pct = _summary_value(row, ["jitterLocal_sma3nz_amean"])
    shimmer_pct = _summary_value(row, ["shimmerLocaldB_sma3nz_amean"])
    voiced_ratio = _summary_value(row, ["VoicedSegmentsPerSec", "loudness_sma3_pctlrange0-2"])

    payload: dict[str, Any] = {
        "ok": True,
        "feature_set": "eGeMAPSv02",
        "durationSec": None,
        "pitchMeanHz": round(pitch_mean_hz, 3) if pitch_mean_hz is not None else None,
        "pitchStddevSemitones": round(f0_semitone_std, 4) if f0_semitone_std is not None else None,
        "pitchRangeSemitones": round(f0_semitone_range, 4) if f0_semitone_range is not None else None,
        "loudnessMean": round(loudness_mean, 4) if loudness_mean is not None else None,
        "loudnessStddev": round(loudness_std, 4) if loudness_std is not None else None,
        "loudnessRange": round(loudness_range, 4) if loudness_range is not None else None,
        "hnrMeanDb": round(hnr_mean_db, 3) if hnr_mean_db is not None else None,
        "jitterLocalPct": round(jitter_pct * 100, 3) if jitter_pct is not None else None,
        "shimmerLocaldB": round(shimmer_pct, 3) if shimmer_pct is not None else None,
        "voicedRatio": round(voiced_ratio, 4) if voiced_ratio is not None else None,
    }
    sys.stdout.write(json.dumps(payload))
    sys.stdout.flush()


if __name__ == "__main__":
    main()
