#!/usr/bin/env node
/**
 * Version Metadata Updater
 *
 * Updates /docs/_meta/version.json with release information.
 *
 * Usage:
 *   npm run docs:version -- --app-version=v1.2.3
 *   node scripts/docs/update-version.js --app-version=v1.2.3
 *   node scripts/docs/update-version.js --dev  # Sets dev version
 *
 * Environment variables (for CI):
 *   APP_VERSION - Application version (e.g., v1.2.3)
 *   GITHUB_SHA  - Git commit SHA
 *   CI          - Set to 'true' in CI environments
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VERSION_FILE = path.resolve(__dirname, '../../docs/_meta/version.json');

/**
 * Get git commit hash
 */
function getGitCommit() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return process.env.GITHUB_SHA || 'unknown';
  }
}

/**
 * Get git short commit hash
 */
function getGitShortCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    const sha = process.env.GITHUB_SHA;
    return sha ? sha.substring(0, 7) : 'unknown';
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    appVersion: null,
    isDev: false,
    help: false
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--dev') {
      result.isDev = true;
    } else if (arg.startsWith('--app-version=')) {
      result.appVersion = arg.split('=')[1];
    }
  }

  // Check environment variables
  if (!result.appVersion && process.env.APP_VERSION) {
    result.appVersion = process.env.APP_VERSION;
  }

  return result;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
Version Metadata Updater

Updates /docs/_meta/version.json with release or development information.

Usage:
  npm run docs:version -- --app-version=v1.2.3
  npm run docs:version -- --dev
  node scripts/docs/update-version.js [options]

Options:
  --app-version=VERSION   Set the application version (e.g., v1.2.3)
  --dev                   Set version to "dev" (for non-release builds)
  --help, -h              Show this help message

Environment Variables:
  APP_VERSION             Application version (alternative to --app-version)
  GITHUB_SHA              Git commit SHA (auto-detected if not set)
  CI                      Set to 'true' in CI environments

Examples:
  # Release build
  npm run docs:version -- --app-version=v1.2.3

  # Development build
  npm run docs:version -- --dev

  # In CI (using environment variables)
  APP_VERSION=v1.2.3 npm run docs:version

Output:
  Updates docs/_meta/version.json with:
  - appVersion: The application version
  - docsVersion: Same as appVersion (or "dev")
  - gitCommit: Full git commit hash
  - builtAt: ISO timestamp
  - buildSource: "ci" or "local"
`);
}

/**
 * Main function
 */
function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  // Determine version values
  let appVersion, docsVersion;

  if (args.isDev) {
    appVersion = 'dev';
    docsVersion = 'dev';
  } else if (args.appVersion) {
    // Remove 'v' prefix if present for consistency
    appVersion = args.appVersion.startsWith('v')
      ? args.appVersion
      : `v${args.appVersion}`;
    docsVersion = appVersion;
  } else {
    // Default to dev if no version specified
    appVersion = 'dev';
    docsVersion = 'dev';
  }

  // Determine build source
  const buildSource = process.env.CI === 'true' ? 'ci' : 'local';

  // Create version metadata
  const versionMeta = {
    appVersion,
    docsVersion,
    gitCommit: getGitCommit(),
    gitShortCommit: getGitShortCommit(),
    builtAt: new Date().toISOString(),
    buildSource
  };

  // Ensure directory exists
  const dir = path.dirname(VERSION_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write version file
  fs.writeFileSync(VERSION_FILE, JSON.stringify(versionMeta, null, 2) + '\n');

  console.log(`\n✅ Updated version metadata:`);
  console.log(`   File: docs/_meta/version.json`);
  console.log(`   App Version: ${versionMeta.appVersion}`);
  console.log(`   Docs Version: ${versionMeta.docsVersion}`);
  console.log(`   Git Commit: ${versionMeta.gitShortCommit}`);
  console.log(`   Built At: ${versionMeta.builtAt}`);
  console.log(`   Build Source: ${versionMeta.buildSource}`);
  console.log();
}

main();
