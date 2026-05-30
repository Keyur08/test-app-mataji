const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// Watch the whole workspace root so Metro can resolve files in ../shared/.
config.watchFolders = [workspaceRoot];

// Metro must look for node_modules inside mobile-app/ AND in the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Allow `require("…/logo.avif")` to be bundled as a static asset.
if (!config.resolver.assetExts.includes("avif")) {
  config.resolver.assetExts = [...config.resolver.assetExts, "avif"];
}

module.exports = withNativeWind(config, { input: "./global.css" });
