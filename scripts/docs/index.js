#!/usr/bin/env node
/**
 * FreshTrack Pro Documentation Pipeline
 *
 * Master entry point for documentation generation, validation, and building.
 *
 * Usage:
 *   node scripts/docs/index.js [command]
 *
 * Commands:
 *   generate  - Generate INDEX.md, GLOSSARY.md, and docs-map.json
 *   lint      - Validate documentation structure and links
 *   build     - Generate all docs + build PDF
 *   all       - Run generate + lint + build (default)
 *   help      - Show this help message
 */

import { generateDocsMap } from './generate-docs-map.js';
import { generateIndex } from './generate-index.js';
import { generateGlossary } from './generate-glossary.js';
import { lintDocs } from './lint-docs.js';
import { buildPdf } from './build-pdf.js';
import { logHeader, logSuccess, logError, logInfo } from './utils.js';

const COMMANDS = {
  generate: runGenerate,
  lint: runLint,
  build: runBuild,
  all: runAll,
  help: showHelp
};

async function runGenerate() {
  logHeader('📚 Generating Documentation');

  console.log('\n1. Generating docs map...');
  await generateDocsMap();

  console.log('\n2. Generating INDEX.md...');
  await generateIndex();

  console.log('\n3. Generating GLOSSARY.md...');
  await generateGlossary();

  logSuccess('\n✓ Documentation generated successfully');
}

async function runLint() {
  logHeader('🔍 Linting Documentation');

  const result = await lintDocs();

  if (!result.success) {
    logError(`\n✗ Linting failed with ${result.errors} error(s)`);
    return false;
  }

  logSuccess('\n✓ Documentation passed all checks');
  return true;
}

async function runBuild() {
  logHeader('📦 Building Documentation');

  // First generate all docs
  await runGenerate();

  console.log('\n4. Building PDF...');
  await buildPdf();

  logSuccess('\n✓ Documentation built successfully');
}

async function runAll() {
  logHeader('🚀 Full Documentation Pipeline');
  console.log('Running: generate → lint → build\n');

  // Generate
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Step 1/3: Generate');
  console.log('═══════════════════════════════════════════════════════════');
  await runGenerate();

  // Lint
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Step 2/3: Lint');
  console.log('═══════════════════════════════════════════════════════════');
  const lintResult = await runLint();

  // Build (even if lint has warnings, continue if no errors)
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Step 3/3: Build');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('\nBuilding PDF and HTML outputs...');
  await buildPdf();

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Summary');
  console.log('═══════════════════════════════════════════════════════════');

  if (lintResult) {
    logSuccess('\n✓ Documentation pipeline completed successfully');
    console.log('\nGenerated files:');
    console.log('  • docs/INDEX.md');
    console.log('  • docs/GLOSSARY.md');
    console.log('  • docs/_meta/docs-map.json');
    console.log('  • docs/_build/FreshTrackPro-Documentation.md');
    console.log('  • docs/_build/FreshTrackPro-Documentation.html');
    console.log('  • docs/_build/FreshTrackPro-Documentation.pdf (if pandoc installed)');
  } else {
    logError('\n⚠ Documentation pipeline completed with lint errors');
    console.log('Please fix the errors above before committing.');
    return false;
  }

  return true;
}

function showHelp() {
  console.log(`
FreshTrack Pro Documentation Pipeline

Usage:
  npm run docs:<command>
  node scripts/docs/index.js <command>

Commands:
  generate  Generate INDEX.md, GLOSSARY.md, and docs-map.json
  lint      Validate documentation structure and links
  build     Generate all docs + build PDF/HTML
  all       Run full pipeline (generate → lint → build)
  help      Show this help message

Examples:
  npm run docs:generate   # Regenerate index and glossary
  npm run docs:lint       # Check for broken links and issues
  npm run docs:build      # Build PDF documentation
  npm run docs:all        # Run complete pipeline

Output:
  docs/INDEX.md                              - Table of contents
  docs/GLOSSARY.md                           - Term definitions
  docs/_meta/docs-map.json                   - Machine-readable doc index
  docs/_build/FreshTrackPro-Documentation.md - Combined markdown
  docs/_build/FreshTrackPro-Documentation.html - HTML version
  docs/_build/FreshTrackPro-Documentation.pdf  - PDF (requires pandoc)

For PDF generation, install pandoc:
  https://pandoc.org/installing.html
`);
}

// Main execution
async function main() {
  const command = process.argv[2] || 'all';

  if (!COMMANDS[command]) {
    logError(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
  }

  try {
    const startTime = Date.now();

    const result = await COMMANDS[command]();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logInfo(`\nCompleted in ${duration}s`);

    // Exit with error if lint failed
    if (result === false) {
      process.exit(1);
    }
  } catch (error) {
    logError(`\nPipeline failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
