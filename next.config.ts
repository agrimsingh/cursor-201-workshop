import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't let `next dev` write an AGENTS.md; agent guidance for this repo lives in .cursor/.
  agentRules: false,
  // The Playwright server uses its own build folder so it can run next to `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // better-sqlite3 is a native module; load it from node_modules at runtime instead of bundling it.
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
