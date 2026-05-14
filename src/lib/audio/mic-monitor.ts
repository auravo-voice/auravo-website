/**
 * RMS-based microphone monitor. Wraps a MediaStream in an `AudioContext` + `AnalyserNode`, samples ~20×/sec,
 * and reports whether the input is below an "audible" floor. Used to satisfy the spec's mic-failure detection
 * within 5 seconds.
 */
export type MicMonitorHandle = {
  /** Stop sampling and release the AudioContext. Does NOT stop the underlying MediaStream. */
  stop: () => void;
};

export type MicMonitorOptions = {
  /** Linear RMS threshold (0–1). 0.01 ≈ very quiet room noise; lower if learners speak softly. Default 0.012. */
  silentThreshold?: number;
  /** Trigger the silent callback after this many consecutive ms below threshold. Spec: <5s. Default 4500ms. */
  silentMs?: number;
  /** Polling interval in ms. Default 50ms (20Hz). */
  intervalMs?: number;
};

export function startMicLevelMonitor(
  stream: MediaStream,
  onLowLevelDetected: () => void,
  options: MicMonitorOptions = {},
): MicMonitorHandle {
  const silentThreshold = options.silentThreshold ?? 0.012;
  const silentMs = options.silentMs ?? 4500;
  const intervalMs = options.intervalMs ?? 50;

  let ctx: AudioContext | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;
  let silentStreakStartedAt: number | null = null;
  let triggered = false;
  let buffer: Float32Array<ArrayBuffer> | null = null;

  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);
    // Use a backing ArrayBuffer (not SharedArrayBuffer) so the analyser typedef accepts it under Lib.DOM 2025.
    buffer = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));

    const sample = () => {
      if (stopped || !analyser || !buffer) return;
      analyser.getFloatTimeDomainData(buffer);
      let sumSquares = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const v = buffer[i]!;
        sumSquares += v * v;
      }
      const rms = Math.sqrt(sumSquares / buffer.length);
      const now = Date.now();
      if (rms < silentThreshold) {
        if (silentStreakStartedAt == null) silentStreakStartedAt = now;
        if (!triggered && now - silentStreakStartedAt >= silentMs) {
          triggered = true;
          try {
            onLowLevelDetected();
          } catch {
            /* user callback failure must not crash the monitor */
          }
        }
      } else {
        silentStreakStartedAt = null;
      }
    };

    timer = setInterval(sample, intervalMs);
  } catch {
    // No AudioContext (rare); the recorder still works, we just can't watch levels.
  }

  return {
    stop: () => {
      stopped = true;
      if (timer != null) clearInterval(timer);
      if (ctx) {
        try {
          void ctx.close();
        } catch {
          /* ignore */
        }
      }
    },
  };
}
