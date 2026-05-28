import "server-only";

import { isPocketBaseStorage } from "@/lib/storage/env";
import * as pocketbase from "@/db/queries/pocketbase/baseline";
import * as sqlite from "@/db/queries/sqlite/baseline";

const impl = isPocketBaseStorage() ? pocketbase : sqlite;

export type BaselineBundle = sqlite.BaselineBundle;

export const getPracticeSessionOwnerId = impl.getPracticeSessionOwnerId;
export const getUserIdForOnboardingPracticeSession = impl.getUserIdForOnboardingPracticeSession;
export const getBaselineBundleForPracticeSession = impl.getBaselineBundleForPracticeSession;
export const getOnboardingBaselineForUser = impl.getOnboardingBaselineForUser;
