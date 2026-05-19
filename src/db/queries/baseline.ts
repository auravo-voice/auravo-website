import "server-only";

import { getServerPocketBase } from "@/lib/pocketbase/server";
import { PB } from "@/db/collections";
import { mapSessionScores, mapUserRecord } from "@/db/pocketbase-map";
import type { UserProfileRow, SessionScoresRow } from "@/db/types";

export type BaselineBundle = {
  user: UserProfileRow;
  scores: SessionScoresRow;
  sessionId: string;
};

export async function getPracticeSessionOwnerId(sessionId: string): Promise<string | null> {
  const pb = await getServerPocketBase();
  try {
    const row = await pb.collection(PB.practiceSessions).getOne(sessionId);
    const user = row.user;
    return typeof user === "string" ? user : null;
  } catch {
    return null;
  }
}

export async function getUserIdForOnboardingPracticeSession(sessionId: string): Promise<string | null> {
  const pb = await getServerPocketBase();
  try {
    const row = await pb.collection(PB.practiceSessions).getOne(sessionId);
    if (row.kind !== "onboarding_assessment") return null;
    return typeof row.user === "string" ? row.user : null;
  } catch {
    return null;
  }
}

export async function getBaselineBundleForPracticeSession(
  sessionId: string,
): Promise<BaselineBundle | null> {
  const pb = await getServerPocketBase();
  try {
    const ps = await pb.collection(PB.practiceSessions).getOne(sessionId);
    if (ps.kind !== "onboarding_assessment") return null;
    const userId = typeof ps.user === "string" ? ps.user : null;
    if (!userId) return null;
    const scores = await pb.collection(PB.sessionScores).getFirstListItem(
      `session = "${sessionId}"`,
    );
    const user = await pb.collection(PB.users).getOne(userId);
    return {
      user: mapUserRecord(user),
      scores: mapSessionScores(scores, sessionId),
      sessionId,
    };
  } catch {
    return null;
  }
}

export async function getOnboardingBaselineForUser(userId: string): Promise<BaselineBundle | null> {
  const pb = await getServerPocketBase();
  try {
    const base = await pb.collection(PB.onboardingBaselines).getFirstListItem(`user = "${userId}"`);
    const sessionId = typeof base.session === "string" ? base.session : null;
    if (!sessionId) return null;
    const scores = await pb.collection(PB.sessionScores).getFirstListItem(
      `session = "${sessionId}"`,
    );
    const user = await pb.collection(PB.users).getOne(userId);
    return {
      user: mapUserRecord(user),
      scores: mapSessionScores(scores, sessionId),
      sessionId,
    };
  } catch {
    return null;
  }
}
