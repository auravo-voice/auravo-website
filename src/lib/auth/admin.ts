import "server-only";

import { NextResponse } from "next/server";
import { PB } from "@/db/collections";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { getServerPocketBase } from "@/lib/pocketbase/server";
import { isPocketBaseAuthEnabled } from "@/lib/storage/env";

const ADMIN_ROLE_VALUE = (process.env.AURAVO_ADMIN_ROLE_VALUE ?? "admin").trim().toLowerCase();

function adminIdAllowlist(): Set<string> {
  const raw = process.env.AURAVO_ADMIN_USER_IDS ?? "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(ids);
}

function hasAdminRoleFromRecord(record: Record<string, unknown>): boolean {
  const isAdmin = record.is_admin;
  if (typeof isAdmin === "boolean") return isAdmin;

  const role = record.role;
  if (typeof role === "string" && role.trim().toLowerCase() === ADMIN_ROLE_VALUE) return true;

  const roles = record.roles;
  if (Array.isArray(roles)) {
    return roles.some((r) => typeof r === "string" && r.trim().toLowerCase() === ADMIN_ROLE_VALUE);
  }
  return false;
}

/** Admin gate: true when user id is allowlisted, or PocketBase user record has an admin role flag. */
export async function isAdminUser(userId: string): Promise<boolean> {
  if (adminIdAllowlist().has(userId)) return true;
  if (!isPocketBaseAuthEnabled()) return false;

  try {
    const pb = await getServerPocketBase();
    const authRecord = pb.authStore.record;
    if (pb.authStore.isValid && authRecord?.id === userId) {
      if (hasAdminRoleFromRecord(authRecord as unknown as Record<string, unknown>)) return true;
    }
    const user = await pb.collection(PB.users).getOne(userId);
    return hasAdminRoleFromRecord(user as unknown as Record<string, unknown>);
  } catch {
    /* treat as not-admin */
  }
  return false;
}

/** Require signed-in admin user id for API routes. */
export async function requireAdminApiUserId(): Promise<string | NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (!(await isAdminUser(userId))) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  return userId;
}
