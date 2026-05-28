import "server-only";

import { isPocketBaseStorage } from "@/lib/storage/env";
import * as pocketbase from "@/db/queries/pocketbase/baseline-segments";
import * as sqlite from "@/db/queries/sqlite/baseline-segments";

const impl = isPocketBaseStorage() ? pocketbase : sqlite;

export type DraftSegmentRow = sqlite.DraftSegmentRow;

export const listDraftSegments = impl.listDraftSegments;
export const replaceDraftSegment = impl.replaceDraftSegment;
export const attachDraftSegmentsToSession = impl.attachDraftSegmentsToSession;
export const clearDraftSegments = impl.clearDraftSegments;
