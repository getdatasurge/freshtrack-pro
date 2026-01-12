#!/usr/bin/env node
/**
 * Docs Tag Creator
 *
 * Creates a docs release tag corresponding to an app release tag.
 * For app tag v1.2.3, creates docs/v1.2.3
 *
 * Usage:
 *   npm run docs:tag -- --version=v1.2.3
 *   node scripts/docs/create-docs-tag.js --version=v1.2.3 [--push]
 *
 * Environment variables:
 *   APP_VERSION - Alternative to --version flag
 */

import { execSync } from 'child_process';

/**
 * Execute git command
 */
function git(command, options = {}) {
  try {
    return execSync(`git ${command}`, {
      encoding: 'utf-8',
      ...options
    }).trim();
  } catch (error) {
    if (options.throwOnError !== false) {
      throw error;
    }
    return null;
  }
}

/**
 * Check if a tag exists
 */
function tagExists(tagName) {
  try {
    git(`rev-parse ${tagName}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    version: null,
    push: false,
    dryRun: false,
    help: false
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--push') {
      result.push = true;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg.startsWith('--version=')) {
      result.version = arg.split('=')[1];
    }
  }

  // Check environment variable
  if (!result.version && process.env.APP_VERSION) {
    result.version = process.env.APP_VERSION;
  }

  return result;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
Docs Tag Creator

Creates a docs release tag corresponding to an app release tag.
For app tag v1.2.3, creates docs/v1.2.3.

Usage:
  npm run docs:tag -- --version=v1.2.3
  node scripts/docs/create-docs-tag.js [options]

Options:
  --version=VERSION   The app version to tag docs for (e.g., v1.2.3)
  --push              Push the tag to origin after creation
  --dry-run           Show what would be done without making changes
  --help, -h          Show this help message

Environment Variables:
  APP_VERSION         Alternative to --version flag

Examples:
  # Create local tag
  npm run docs:tag -- --version=v1.2.3

  # Create and push tag
  npm run docs:tag -- --version=v1.2.3 --push

  # Preview without changes
  npm run docs:tag -- --version=v1.2.3 --dry-run

Tag Format:
  App tag: v1.2.3
  Docs tag: docs/v1.2.3
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

  if (!args.version) {
    console.error('Error: Version is required. Use --version=vX.Y.Z');
    process.exit(1);
  }

  // Normalize version (ensure it starts with 'v')
  const version = args.version.startsWith('v')
    ? args.version
    : `v${args.version}`;

  const docsTag = `docs/${version}`;
  const currentCommit = git('rev-parse --short HEAD');

  console.log(`\n📚 Docs Tag Creator`);
  console.log(`   App Version: ${version}`);
  console.log(`   Docs Tag: ${docsTag}`);
  console.log(`   Commit: ${currentCommit}`);

  // Check if docs tag already exists
  if (tagExists(docsTag)) {
    console.log(`\n⚠️  Tag ${docsTag} already exists`);
    console.log(`   Use 'git tag -d ${docsTag}' to delete it first if needed`);
    process.exit(1);
  }

  if (args.dryRun) {
    console.log(`\n🔍 Dry run - would create:`);
    console.log(`   git tag -a ${docsTag} -m "Documentation release for ${version}"`);
    if (args.push) {
      console.log(`   git push origin ${docsTag}`);
    }
    process.exit(0);
  }

  // Create the tag
  console.log(`\n📝 Creating tag ${docsTag}...`);
  git(`tag -a ${docsTag} -m "Documentation release for ${version}"`);
  console.log(`   ✅ Tag created`);

  // Optionally push
  if (args.push) {
    console.log(`\n🚀 Pushing tag to origin...`);
    git(`push origin ${docsTag}`);
    console.log(`   ✅ Tag pushed`);
  } else {
    console.log(`\n💡 To push the tag:`);
    console.log(`   git push origin ${docsTag}`);
  }

  // List related tags
  console.log(`\n📋 Related tags:`);
  try {
    const tags = git(`tag -l "${version}" "docs/${version}"`);
    if (tags) {
      tags.split('\n').forEach(t => console.log(`   - ${t}`));
    }
  } catch {
    // Ignore errors listing tags
  }

  console.log();
}

main();
