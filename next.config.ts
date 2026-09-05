import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray package-lock.json exists in the user profile directory; pin the
  // workspace root so Turbopack ignores it.
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      // Exercise demo GIFs (omercotkd/exercises-gifs via jsDelivr).
      // See src/lib/exercises/media.ts for provenance and the swap procedure.
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
      },
      // Progress-photo storage host is chosen in Phase 11 (Cloudflare R2,
      // Vercel Blob or similar) — add its hostname here then.
    ],
  },
};

export default nextConfig;
