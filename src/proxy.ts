import { clerkMiddleware } from "@clerk/nextjs/server";

// Next 16 convention: proxy.ts replaces middleware.ts. This only establishes
// the Clerk request context — route protection happens at the resource level
// (layouts, server actions, route handlers) via `await auth()`, because proxy
// matchers do not cover Server Function calls.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
