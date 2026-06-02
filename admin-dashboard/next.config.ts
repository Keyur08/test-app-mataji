import path from "node:path";
// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack workspace root setup
  outputFileTracingRoot: path.resolve(__dirname, ".."),
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },

  experimental: {
    // 🔑 FORCES NEXT.JS TO EMIT ASSET TRAILS RELATIVE TO MONOREPO ROOT
  },

  output: "standalone",

  // Tells Next.js to compile your shared directory code natively
  transpilePackages: ["../shared"],
};

module.exports = nextConfig;
