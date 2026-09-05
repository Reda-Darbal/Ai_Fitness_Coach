"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Settings } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { Logo } from "@/components/logo";

/**
 * Mobile-only top bar. The bottom nav carries the five training destinations,
 * so account + settings live here — without it, neither is reachable on a
 * phone, which is the primary platform.
 */
export function TopBar() {
  const { dict } = useI18n();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-none lg:hidden">
      <Link
        href="/dashboard"
        className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
      >
        <Logo />
      </Link>

      <div className="flex items-center gap-1">
        <Link
          href="/settings"
          aria-label={dict.nav.settings}
          className="flex size-11 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70"
        >
          <Settings className="size-5" aria-hidden="true" />
        </Link>
        <UserButton />
      </div>
    </header>
  );
}
