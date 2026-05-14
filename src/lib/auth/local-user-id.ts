import "server-only";
import { cookies } from "next/headers";
import { AURAVO_USER_ID_COOKIE } from "@/lib/auth/auravo-user-cookie-constants";

export async function getLocalUserId(): Promise<string | null> {
  return (await cookies()).get(AURAVO_USER_ID_COOKIE)?.value ?? null;
}
