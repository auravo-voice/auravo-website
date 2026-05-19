import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PB_AUTH_COOKIE } from "@/lib/pocketbase";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/assessment",
  "/learning-path",
  "/practice",
  "/progress",
  "/settings",
  "/meeting-prep",
  "/simulations",
  "/wordle",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAuth = Boolean(request.cookies.get(PB_AUTH_COOKIE)?.value);

  if (pathname === "/auth") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isProtectedPath(pathname) && !hasAuth) {
    const login = new URL("/login", request.url);
    login.searchParams.set("redirect", pathname);
    return NextResponse.redirect(login);
  }

  if ((pathname === "/login" || pathname === "/signup") && hasAuth) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
