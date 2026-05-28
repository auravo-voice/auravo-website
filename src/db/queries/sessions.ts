import "server-only";

import { isPocketBaseStorage } from "@/lib/storage/env";
import * as pocketbase from "@/db/queries/pocketbase/sessions";
import * as sqlite from "@/db/queries/sqlite/sessions";

const impl = isPocketBaseStorage() ? pocketbase : sqlite;

export const COUNTABLE_SESSION_KINDS = sqlite.COUNTABLE_SESSION_KINDS;
export type CountableSessionKind = sqlite.CountableSessionKind;
export type SessionListRow = sqlite.SessionListRow;
export type UserSessionStats = sqlite.UserSessionStats;

export const toLocalDayKey = sqlite.toLocalDayKey;
export const getUserSessionStats = impl.getUserSessionStats;
export const listUserSessions = impl.listUserSessions;
export const getLatestSessionWithScores = impl.getLatestSessionWithScores;
export const sessionAverageScore = sqlite.sessionAverageScore;
