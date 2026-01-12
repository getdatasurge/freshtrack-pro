#!/usr/bin/env node
/**
 * ADR (Architecture Decision Record) Generator
 *
 * Creates a new ADR file with auto-incremented ID, current date, and title slug.
 *
 * Usage:
 *   npm run adr:new -- "Your ADR Title"
 *   node scripts/docs/adr-new.js "Your ADR Title"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_ROOT = path.resolve(__dirname, '../../docs');
const ADR_DIR = path.join(DOCS_ROOT, 'adr');
const TEMPLATE_PATH = path.join(ADR_DIR, 'template.md');

/**
 * Convert title to kebab-case slug
 */
function toSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Remove multiple hyphens
    .replace(/^-|-$/g, '');        // Remove leading/trailing hyphens
}

/**
 * Get the next ADR number by scanning existing ADRs
 */
function getNextAdrNumber() {
  const files = fs.readdirSync(ADR_DIR);

  // Filter ADR files (NNNN-YYYY-MM-DD-*.md pattern)
  const adrFiles = files.filter(f => /^\d{4}-\d{4}-\d{2}-\d{2}-.+\.md$/.test(f));

  if (adrFiles.length === 0) {
    return 1;
  }

  // Extract numbers and find max
  const numbers = adrFiles.map(f => parseInt(f.substring(0, 4), 10));
  return Math.max(...numbers) + 1;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Read and customize the ADR template
 */
function createAdrContent(number, date, title) {
  let template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

  const formattedNumber = String(number).padStart(4, '0');

  // Replace placeholders
  template = template.replace('ADR-NNNN', `ADR-${formattedNumber}`);
  template = template.replace('[Title]', title);
  template = template.replace('YYYY-MM-DD', date);
  template = template.replace('Proposed | Accepted | Rejected | Deprecated | Superseded', 'Proposed');

  return template;
}

/**
 * Update the ADR README table with new entry
 */
function updateAdrReadme(number, date, title, filename) {
  const readmePath = path.join(ADR_DIR, 'README.md');
  let readme = fs.readFileSync(readmePath, 'utf-8');

  const formattedNumber = String(number).padStart(4, '0');
  const tableRow = `| ${formattedNumber} | ${date} | [${title}](./${filename}) | Proposed |`;

  // Find and update the table
  // Look for the "No ADRs yet" line and replace it
  if (readme.includes('| - | - | No ADRs yet | - |')) {
    readme = readme.replace('| - | - | No ADRs yet | - |', tableRow);
  } else {
    // Find the table and add a new row before the closing section
    const tablePattern = /(\| # \| Date \| Title \| Status \|[\s\S]*?)(\n\n\*This table)/;
    const match = readme.match(tablePattern);

    if (match) {
      const tableSection = match[1];
      const afterTable = match[2];
      readme = readme.replace(tablePattern, `${tableSection}\n${tableRow}${afterTable}`);
    }
  }

  fs.writeFileSync(readmePath, readme);
}

/**
 * Main function
 */
function main() {
  // Get title from command line arguments
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
ADR Generator - Create new Architecture Decision Records

Usage:
  npm run adr:new -- "Your ADR Title"
  node scripts/docs/adr-new.js "Your ADR Title"

Examples:
  npm run adr:new -- "Use Supabase for Backend"
  npm run adr:new -- "Adopt React Query for Data Fetching"

The command will create a new ADR file with:
  - Auto-incremented ID (0001, 0002, etc.)
  - Today's date
  - Title slug in kebab-case
  - Pre-filled template
`);
    process.exit(args.length === 0 ? 1 : 0);
  }

  const title = args.join(' ');
  const slug = toSlug(title);
  const date = formatDate(new Date());
  const number = getNextAdrNumber();
  const formattedNumber = String(number).padStart(4, '0');

  const filename = `${formattedNumber}-${date}-${slug}.md`;
  const filepath = path.join(ADR_DIR, filename);

  // Check if file already exists
  if (fs.existsSync(filepath)) {
    console.error(`Error: ADR file already exists: ${filename}`);
    process.exit(1);
  }

  // Create ADR content
  const content = createAdrContent(number, date, title);

  // Write ADR file
  fs.writeFileSync(filepath, content);
  console.log(`\n✅ Created ADR: ${filename}`);
  console.log(`   Path: docs/adr/${filename}`);

  // Update README
  try {
    updateAdrReadme(number, date, title, filename);
    console.log(`   Updated: docs/adr/README.md`);
  } catch (error) {
    console.warn(`   Warning: Could not update README.md automatically`);
  }

  console.log(`\nNext steps:`);
  console.log(`  1. Edit the ADR to fill in context, decision, and consequences`);
  console.log(`  2. Change status from "Proposed" to "Accepted" when approved`);
  console.log(`  3. Commit and create a PR for team review`);
  console.log();
}

main();
