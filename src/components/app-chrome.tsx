"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Mic } from "lucide-react";
import { APP_NAV } from "@/config/nav";
import { AuravoMark, VocaBadge } from "@/components/brand";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {APP_NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/15 text-foreground shadow-sm ring-1 ring-primary/25"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="flex min-h-dvh w-full bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-border/80 bg-card/40 backdrop-blur-xl lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-border/80 px-5">
          <AuravoMark className="h-10 max-w-[min(220px,85%)]" />
          <div className="flex min-w-0 flex-col justify-center">
            <VocaBadge className="w-fit scale-90 origin-left" />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-3">
            <p className="text-xs font-medium text-muted-foreground">Voice session</p>
            <p className="mt-1 font-display text-sm text-foreground">Ready when you are</p>
            <Button className="mt-3 w-full gap-2" variant="glow" size="sm" asChild>
              <Link href="/dashboard">
                <Mic className="size-4" />
                Open mic console
              </Link>
            </Button>
          </div>
          <NavLinks />
        </div>
        <div className="mt-auto border-t border-border/80 p-4">
          <div className="flex items-center gap-3 rounded-2xl bg-muted/50 px-3 py-2">
            <div className="size-9 rounded-full bg-gradient-to-br from-primary to-accent" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">Demo learner</p>
              <p className="truncate text-xs text-muted-foreground">Voice coaching profile</p>
            </div>
            <ModeToggle />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border/80 bg-background/80 px-4 backdrop-blur-md lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0" aria-label="Open menu">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent className="flex flex-col">
              <SheetHeader>
                <SheetTitle className="flex items-center">
                  <AuravoMark className="h-9 max-w-[200px]" />
                </SheetTitle>
              </SheetHeader>
              <Separator className="my-4" />
              <NavLinks onNavigate={() => setOpen(false)} />
              <div className="mt-auto flex items-center justify-between pt-6">
                <span className="text-xs text-muted-foreground">Theme</span>
                <ModeToggle />
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <AuravoMark className="h-8 max-w-[min(160px,48vw)] lg:hidden" />
            <VocaBadge className="ml-auto hidden sm:inline-flex md:hidden" />
          </div>
          <Button size="sm" className="gap-1.5 shadow-primary/20" variant="glow" asChild>
            <Link href="/dashboard">
              <Mic className="size-4" />
              <span className="hidden sm:inline">Mic</span>
            </Link>
          </Button>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
