import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dashboard imports from `../shared/*` (one level up, monorepo style).
  // Turbopack defaults its workspace root to the Next.js project folder, so we
  // explicitly point it at the repo root to allow that resolution.
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  output: "standalone",
  transpilePackages: ["../shared"],
};

export default nextConfig;
