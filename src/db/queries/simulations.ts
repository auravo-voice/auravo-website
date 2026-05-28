import "server-only";

import { isPocketBaseStorage } from "@/lib/storage/env";
import * as pocketbase from "@/db/queries/pocketbase/simulations";
import * as sqlite from "@/db/queries/sqlite/simulations";

const impl = isPocketBaseStorage() ? pocketbase : sqlite;

export type SimulationTurnRow = sqlite.SimulationTurnRow;

export const listSimulationTurns = impl.listSimulationTurns;
export const getSimulationSession = impl.getSimulationSession;
export const insertSimulationTurn = impl.insertSimulationTurn;
export const insertSimulationTurnSync = impl.insertSimulationTurnSync;
export const finalizeSimulationSession = impl.finalizeSimulationSession;
export const finalizeDraftSession = impl.finalizeDraftSession;
