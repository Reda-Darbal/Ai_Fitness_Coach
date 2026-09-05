import {
  Dumbbell,
  History,
  Images,
  UtensilsCrossed,
  LayoutGrid,
  Library,
  MessageSquare,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { Dictionary } from "@/lib/i18n";

export interface NavItem {
  href: string;
  /** Resolved against dict.nav so labels follow the app language. */
  labelKey: keyof Dictionary["nav"];
  icon: LucideIcon;
  /** Sidebar only — the mobile bottom nav is capped at five items so each
   *  one keeps a comfortable touch target. */
  desktopOnly?: boolean;
}

// Single source of truth for primary navigation — consumed by both the
// mobile bottom nav and the desktop sidebar. Settings lives in the sidebar
// footer, not here.
export const navItems: NavItem[] = [
  { href: "/dashboard", labelKey: "home", icon: LayoutGrid },
  { href: "/workout", labelKey: "workout", icon: Dumbbell },
  { href: "/exercises", labelKey: "exercises", icon: Library },
  { href: "/progress", labelKey: "progress", icon: TrendingUp },
  { href: "/coach", labelKey: "coach", icon: MessageSquare },
  { href: "/history", labelKey: "history", icon: History, desktopOnly: true },
  { href: "/photos", labelKey: "photos", icon: Images, desktopOnly: true },
  { href: "/nutrition", labelKey: "nutrition", icon: UtensilsCrossed, desktopOnly: true },
];

/** The five primary destinations shown in the mobile bottom bar. */
export const bottomNavItems = navItems.filter((item) => !item.desktopOnly);
