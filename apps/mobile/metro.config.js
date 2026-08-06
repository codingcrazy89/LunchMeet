const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Metro must watch the whole workspace so changes in packages/* trigger reloads.
config.watchFolders = [workspaceRoot];

// Resolve from the app first, then the hoisted workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Without this, Metro walks up past workspaceRoot and can resolve duplicate
// copies of React, which surfaces as invalid-hook-call errors at runtime.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
