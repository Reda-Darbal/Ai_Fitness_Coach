import { BottomNav } from "./bottom-nav";
import { SidebarNav } from "./sidebar-nav";
import { TopBar } from "./top-bar";

/**
 * Authenticated app chrome: fixed sidebar ≥lg; top bar + fixed bottom nav <lg.
 * Content column is capped and padded so the bottom nav never covers it.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full flex-1">
      <SidebarNav />
      <div className="flex w-full flex-1 flex-col lg:ps-60">
        <TopBar />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-28 lg:px-8 lg:pt-8 lg:pb-12">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
