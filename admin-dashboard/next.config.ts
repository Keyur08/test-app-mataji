import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// 1. Safe path resolution helper for ES Modules / Next.js configurations
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const nextConfig: NextConfig = {
  // Turbopack defaults its workspace root to the Next.js project folder, so we
  // explicitly point it at the repo root to allow that resolution.
  turbopack: {
    root: projectRoot,
  },

  experimental: {
    // 🔑 FORCES NEXT.JS TO EMIT ASSET TRAILS RELATIVE TO MONOREPO ROOT
    outputFileTracingRoot: projectRoot,
  },

  output: "standalone",

  // 🔑 FIXED: Transpile packages expects the alias package name, NOT the relative directory path
  transpilePackages: ["@shared"],
};

export default nextConfig;
