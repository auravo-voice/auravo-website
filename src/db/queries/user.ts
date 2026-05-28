import "server-only";

import { isPocketBaseStorage } from "@/lib/storage/env";
import * as pocketbase from "@/db/queries/pocketbase/user";
import * as sqlite from "@/db/queries/sqlite/user";

const impl = isPocketBaseStorage() ? pocketbase : sqlite;

export const ensureUserProfile = impl.ensureUserProfile;
