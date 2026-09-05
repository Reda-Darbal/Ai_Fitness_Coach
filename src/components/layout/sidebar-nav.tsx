"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Settings } from "lucide-react";
import { navItems } from "@/lib/nav";
import { Logo } from "@/components/logo";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function SidebarNav() {
  const pathname = usePathname();
  const { dict } = useI18n();

  return (
    <aside className="fixed inset-y-0 start-0 z-40 hidden w-60 flex-col border-e border-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center px-5">
        <Link
          href="/dashboard"
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
        >
          <Logo />
        </Link>
      </div>

      <nav aria-label="Primary" className="flex-1 px-3 py-2">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                    active
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  <item.icon
                    className={cn("size-4", active && "text-primary")}
                    aria-hidden="true"
                  />
                  {dict.nav[item.labelKey]}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex items-center justify-between border-t border-border px-3 py-3">
        <Link
          href="/settings"
          aria-current={pathname.startsWith("/settings") ? "page" : undefined}
          className={cn(
            "flex h-10 flex-1 items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
            pathname.startsWith("/settings")
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
          )}
        >
          <Settings className="size-4" aria-hidden="true" />
          {dict.nav.settings}
        </Link>
        <div className="px-2">
          <UserButton />
        </div>
      </div>
    </aside>
  );
}
