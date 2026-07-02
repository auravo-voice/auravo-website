"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, LogOut, Menu, Mic } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { APP_NAV } from "@/config/nav";
import { SidebarBrand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 px-1">
      {APP_NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-[color,background-color,box-shadow] duration-150 ease-out",
              active
                ? "nav-item-active"
                : "text-muted-foreground hover:bg-surface-secondary/90 hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "size-4 shrink-0 stroke-[1.75]",
                active ? "text-primary" : "text-muted-foreground",
              )}
              aria-hidden
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppChrome({
  children,
  userDisplayName: userDisplayNameProp = "Learner",
}: {
  children: React.ReactNode;
  userDisplayName?: string;
}) {
  const { session, signOut } = useAuth();
  const userDisplayName = session.user?.displayName ?? userDisplayNameProp;
  const [open, setOpen] = React.useState(false);

  const handleSignOut = React.useCallback(() => {
    void signOut().then(() => {
      window.location.href = "/login";
    });
  }, [signOut]);
  return (
    <div className="flex min-h-dvh w-full bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-border/80 bg-sidebar shadow-[inset_-1px_0_0_0_rgb(20_27_69/0.03)] lg:flex lg:flex-col">
        <div className="px-4 pt-3">
          <SidebarBrand />
        </div>
        <div className="flex flex-1 flex-col gap-4 px-4 pb-4 pt-4">
          <div className="surface-card rounded-xl p-3.5">
            <p className="text-xs font-medium text-muted-foreground">Voice session</p>
            <p className="mt-1 font-display text-sm font-medium text-foreground">Ready when you are</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Talk to Voca, your voice companion.</p>
            <Button className="mt-3 w-full gap-2" size="sm" asChild>
              <Link href="/dashboard">
                <Mic className="size-4" />
                Open mic console
              </Link>
            </Button>
            <Button className="mt-2 h-9 w-full justify-between px-3" variant="outline" size="sm" asChild>
              <a href="https://voca.auravo.ai" target="_blank" rel="noopener noreferrer">
                <span className="truncate">Talk to Voca</span>
                <ExternalLink className="size-4 shrink-0 opacity-80" />
              </a>
            </Button>
          </div>
          <NavLinks />
        </div>
        <div className="mt-auto space-y-2 border-t border-border/50 px-4 py-4">
          <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-xs">
            <div className="size-9 rounded-full bg-primary shadow-xs" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{userDisplayName}</p>
              <p className="truncate text-xs text-muted-foreground">Voice coaching profile</p>
            </div>
          </div>
          {session.user ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={handleSignOut}
            >
              <LogOut className="size-4" />
              Sign out
            </Button>
          ) : null}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-md lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0" aria-label="Open menu">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent className="flex flex-col">
              <SheetHeader className="pb-0">
                <SheetTitle className="flex items-center">
                  <SidebarBrand compact />
                </SheetTitle>
              </SheetHeader>
              <Separator className="my-3 bg-border/50" />
              <NavLinks onNavigate={() => setOpen(false)} />
              <div className="mt-4 surface-card rounded-xl p-3.5">
                <p className="text-xs font-medium text-muted-foreground">Voice session</p>
                <p className="mt-1 font-display text-sm font-medium text-foreground">Ready when you are</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Talk to Voca, your voice companion.</p>
                <Button className="mt-3 w-full gap-2" size="sm" asChild>
                  <Link href="/dashboard" onClick={() => setOpen(false)}>
                    <Mic className="size-4" />
                    Open mic console
                  </Link>
                </Button>
                <Button className="mt-2 h-9 w-full justify-between px-3" variant="outline" size="sm" asChild>
                  <a href="https://voca.auravo.ai" target="_blank" rel="noopener noreferrer">
                    <span className="truncate">Talk to Voca</span>
                    <ExternalLink className="size-4 shrink-0 opacity-80" />
                  </a>
                </Button>
              </div>
              <div className="mt-auto space-y-4 border-t border-border/80 pt-6">
                <div className="flex items-center gap-3">
                  <div className="size-9 shrink-0 rounded-full bg-primary shadow-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{userDisplayName}</p>
                    <p className="truncate text-xs text-muted-foreground">Voice coaching profile</p>
                  </div>
                </div>
                {session.user ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => {
                      setOpen(false);
                      handleSignOut();
                    }}
                  >
                    <LogOut className="size-4" />
                    Sign out
                  </Button>
                ) : null}
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <SidebarBrand compact className="lg:hidden" />
          </div>
          <Button size="sm" className="gap-1.5" asChild>
            <Link href="/dashboard">
              <Mic className="size-4" />
              <span className="hidden sm:inline">Mic</span>
            </Link>
          </Button>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-12">{children}</main>
      </div>
    </div>
  );
}
