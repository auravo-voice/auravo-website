import "server-only";

import { isPocketBaseStorage } from "@/lib/storage/env";
import * as pocketbase from "@/db/queries/pocketbase/sessions-analytics";
import * as sqlite from "@/db/queries/sqlite/sessions-analytics";

const impl = isPocketBaseStorage() ? pocketbase : sqlite;

export type SessionListRowWithAnalysis = sqlite.SessionListRowWithAnalysis;

export const listUserSessionsWithAnalysis = impl.listUserSessionsWithAnalysis;
export const trendSessionsFromRows = sqlite.trendSessionsFromRows;
