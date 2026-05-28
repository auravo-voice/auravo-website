import "server-only";

import { isPocketBaseStorage } from "@/lib/storage/env";
import * as pocketbase from "@/db/queries/pocketbase/practice-persist";
import * as sqlite from "@/db/queries/sqlite/practice-persist";

const impl = isPocketBaseStorage() ? pocketbase : sqlite;

export type CreatePracticeSessionInput = sqlite.CreatePracticeSessionInput;

export const createPracticeSession = impl.createPracticeSession;
export const createSessionTranscript = impl.createSessionTranscript;
export const createSessionScores = impl.createSessionScores;
export const createOnboardingBaseline = impl.createOnboardingBaseline;
export const updatePracticeSession = impl.updatePracticeSession;
