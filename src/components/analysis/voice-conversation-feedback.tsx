"use client";

import type { ConversationMetrics } from "@/lib/analysis/conversation";
import { warningInlineClass } from "@/lib/ui/warning-styles";
import type { VoiceDeliveryPeek } from "@/lib/analysis/finalize-scorecard-parsers";

type Props = {
  voice?: VoiceDeliveryPeek | null;
  conversation?: ConversationMetrics | null;
  conversationCoachNotes?: string[];
  degraded?: boolean;
};

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function voiceHasNumericPeek(voice: VoiceDeliveryPeek): boolean {
  return (
    voice.wpm != null ||
    voice.pauseCount != null ||
    voice.fillerRatePerMin != null ||
    voice.speakingRatio != null
  );
}

export function VoiceAndConversationFeedback({ voice, conversation, conversationCoachNotes, degraded }: Props) {
  const hasConversation = conversation != null;
  const numericVoice = voice != null && voiceHasNumericPeek(voice);
  const hasNotes = (conversationCoachNotes?.length ?? 0) > 0;

  if (!numericVoice && !hasConversation && !hasNotes && !degraded) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-xl border border-border/70 bg-muted/15 p-4">
      {degraded ? (
        <p className={`text-xs ${warningInlineClass}`}>
          Parts of this run used transcript fallback; audio-grounded WPM and pause cues are stronger when transcription
          is available.
        </p>
      ) : null}

      {numericVoice && voice ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Voice delivery</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {voice.wpm != null ? (
              <div className="rounded-md border border-border/60 bg-background/50 px-2 py-1.5">
                <p className="text-[10px] uppercase text-muted-foreground">WPM</p>
                <p className="font-medium tabular-nums">{Math.round(voice.wpm)}</p>
              </div>
            ) : null}
            {voice.fillerRatePerMin != null ? (
              <div className="rounded-md border border-border/60 bg-background/50 px-2 py-1.5">
                <p className="text-[10px] uppercase text-muted-foreground">Fillers / min</p>
                <p className="font-medium tabular-nums">{voice.fillerRatePerMin.toFixed(1)}</p>
              </div>
            ) : null}
            {voice.pauseCount != null ? (
              <div className="rounded-md border border-border/60 bg-background/50 px-2 py-1.5">
                <p className="text-[10px] uppercase text-muted-foreground">Pauses</p>
                <p className="font-medium tabular-nums">{voice.pauseCount}</p>
                {voice.longPauseCount != null ? (
                  <p className="text-[10px] text-muted-foreground">long {voice.longPauseCount}</p>
                ) : null}
              </div>
            ) : null}
            {voice.speakingRatio != null ? (
              <div className="rounded-md border border-border/60 bg-background/50 px-2 py-1.5">
                <p className="text-[10px] uppercase text-muted-foreground">Speaking time</p>
                <p className="font-medium tabular-nums">{fmtPct(voice.speakingRatio)}</p>
              </div>
            ) : null}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            acoustic {voice.acousticGrounded ? "on" : "off"} · VAD {voice.vadGrounded ? "on" : "off"}
          </p>
        </div>
      ) : null}

      {hasConversation || hasNotes ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conversation dynamics</p>
          {hasConversation ? (
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-2 rounded-md border border-border/50 bg-background/40 px-2 py-1.5">
                <dt className="text-muted-foreground">Avg. think-before-speak</dt>
                <dd className="tabular-nums font-medium">
                  {conversation!.avgResponseLatencyMs != null
                    ? `${(conversation.avgResponseLatencyMs / 1000).toFixed(1)}s`
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2 rounded-md border border-border/50 bg-background/40 px-2 py-1.5">
                <dt className="text-muted-foreground">You / partner talk balance</dt>
                <dd className="tabular-nums font-medium">
                  {conversation!.userTalkShare != null ? `${fmtPct(conversation.userTalkShare)} you` : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2 rounded-md border border-border/50 bg-background/40 px-2 py-1.5">
                <dt className="text-muted-foreground">Quick responses (&lt;1.5s)</dt>
                <dd className="tabular-nums font-medium">{conversation!.quickResponseCount}</dd>
              </div>
              <div className="flex justify-between gap-2 rounded-md border border-border/50 bg-background/40 px-2 py-1.5">
                <dt className="text-muted-foreground">Avg. user-turn length</dt>
                <dd className="tabular-nums font-medium">
                  {conversation!.avgUserTurnSec != null ? `${conversation.avgUserTurnSec.toFixed(1)}s` : "—"}
                </dd>
              </div>
            </dl>
          ) : null}
          {hasNotes ? (
            <ul className="mt-3 list-inside list-disc space-y-1 text-xs leading-relaxed text-muted-foreground">
              {conversationCoachNotes!.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
