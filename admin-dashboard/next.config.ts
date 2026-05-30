import path from "node:path";
// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack workspace root setup
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },

  experimental: {
    // 🔑 FORCES NEXT.JS TO EMIT ASSET TRAILS RELATIVE TO MONOREPO ROOT
    outputFileTracingRoot: path.resolve(__dirname, ".."),
  },

  output: "standalone",

  // Tells Next.js to compile your shared directory code natively
  transpilePackages: ["../shared"],
};

module.exports = nextConfig;
