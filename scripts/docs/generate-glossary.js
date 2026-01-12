#!/usr/bin/env node
/**
 * Generate Glossary
 * Creates /docs/GLOSSARY.md from glossary-seed.yml and extracts terms from docs
 */

import { promises as fs } from 'fs';
import path from 'path';
import {
  DOCS_ROOT,
  META_DIR,
  findMarkdownFiles,
  formatTimestamp,
  logSuccess,
  logInfo,
  logHeader
} from './utils.js';

/**
 * Parse YAML-like glossary seed file (simple key: value format)
 */
async function parseGlossarySeed() {
  const seedPath = path.join(META_DIR, 'glossary-seed.yml');

  try {
    const content = await fs.readFile(seedPath, 'utf-8');
    const terms = {};
    let currentCategory = 'General';

    for (const line of content.split('\n')) {
      // Skip empty lines
      if (!line.trim()) continue;

      // Skip comments that aren't category headers
      if (line.startsWith('#') && !line.includes('Terms')) continue;

      // Category header (e.g., "# Architecture Terms")
      if (line.startsWith('# ') && line.includes('Terms')) {
        currentCategory = line.replace('#', '').replace('Terms', '').trim();
        continue;
      }

      // Term definition (term: definition)
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (match) {
        const [, term, definition] = match;
        const cleanTerm = term.trim();
        terms[cleanTerm] = {
          definition: definition.trim(),
          category: currentCategory
        };
      }
    }

    return terms;
  } catch (error) {
    if (error.code === 'ENOENT') {
      logInfo('No glossary-seed.yml found, using extracted terms only');
      return {};
    }
    throw error;
  }
}

/**
 * Extract potential terms from documentation files
 * Looks for bold terms, code terms, and defined terms
 */
async function extractTermsFromDocs() {
  const files = await findMarkdownFiles(DOCS_ROOT);
  const extractedTerms = new Map();

  for (const file of files) {
    // Skip glossary and index
    if (file.includes('GLOSSARY.md') || file.includes('INDEX.md')) continue;

    const content = await fs.readFile(file, 'utf-8');

    // Extract bold terms that look like definitions
    // Pattern: **Term** - Definition or **Term**: Definition
    const boldPattern = /\*\*([A-Z][a-zA-Z0-9 ]+)\*\*\s*[-:–]\s*([^.\n]+)/g;
    let match;
    while ((match = boldPattern.exec(content)) !== null) {
      const term = match[1].trim();
      const definition = match[2].trim();
      if (term.length > 2 && term.length < 50 && definition.length > 10) {
        if (!extractedTerms.has(term)) {
          extractedTerms.set(term, {
            definition,
            source: path.relative(DOCS_ROOT, file)
          });
        }
      }
    }
  }

  return extractedTerms;
}

async function generateGlossary() {
  logHeader('Generating Glossary');

  // Load seed terms
  const seedTerms = await parseGlossarySeed();

  // Extract terms from docs (optional enhancement)
  const extractedTerms = await extractTermsFromDocs();

  // Merge terms (seed takes precedence)
  const allTerms = { ...Object.fromEntries(extractedTerms) };
  for (const [term, data] of Object.entries(seedTerms)) {
    allTerms[term] = data;
  }

  // Group by category
  const categories = {};
  for (const [term, data] of Object.entries(allTerms)) {
    const category = data.category || 'General';
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push({ term, ...data });
  }

  // Sort terms within each category
  for (const category of Object.keys(categories)) {
    categories[category].sort((a, b) => a.term.localeCompare(b.term));
  }

  // Generate markdown
  const sections = [];

  // Header
  sections.push(`# FreshTrack Pro Glossary

> Terminology and definitions used throughout the documentation

**Last Updated:** ${formatTimestamp()}
**Total Terms:** ${Object.keys(allTerms).length}

---

## Quick Navigation

`);

  // Category order - use canonical names for consistent output
  const categoryOrder = [
    'Architecture',
    'Product',
    'IoT Hardware',
    'Alert System',
    'Monitoring',
    'Security',
    'Data',
    'Integration',
    'Development',
    'General'
  ];

  // Normalize category names to canonical form (handles variations like IoT/Hardware -> IoT Hardware)
  const categoryNormalization = {
    'IoT/Hardware': 'IoT Hardware',
    'IoT / Hardware': 'IoT Hardware',
  };

  // Apply category normalization
  const normalizedCategories = {};
  for (const [cat, terms] of Object.entries(categories)) {
    const normalizedName = categoryNormalization[cat] || cat;
    if (!normalizedCategories[normalizedName]) {
      normalizedCategories[normalizedName] = [];
    }
    normalizedCategories[normalizedName].push(...terms);
  }

  // Re-sort terms in normalized categories
  for (const cat of Object.keys(normalizedCategories)) {
    normalizedCategories[cat].sort((a, b) => a.term.localeCompare(b.term));
  }

  // Replace categories with normalized version
  Object.keys(categories).forEach(key => delete categories[key]);
  Object.assign(categories, normalizedCategories);

  // Add navigation links
  for (const category of categoryOrder) {
    if (categories[category] && categories[category].length > 0) {
      const anchor = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      sections.push(`- [${category}](#${anchor})\n`);
    }
  }

  sections.push('\n---\n');

  // Generate each category section
  for (const category of categoryOrder) {
    const terms = categories[category];
    if (!terms || terms.length === 0) continue;

    sections.push(`\n## ${category}\n\n`);
    sections.push('| Term | Definition |\n');
    sections.push('|------|------------|\n');

    for (const { term, definition } of terms) {
      // Escape pipe characters in definition
      const escapedDef = definition.replace(/\|/g, '\\|');
      sections.push(`| **${term}** | ${escapedDef} |\n`);
    }
  }

  // Add footer
  sections.push(`
---

## Adding Terms

To add new terms to this glossary:

1. Edit \`/docs/_meta/glossary-seed.yml\`
2. Run \`npm run docs:build\`
3. Terms are automatically extracted from bold definitions in documentation

## Related Documents

- [INDEX.md](./INDEX.md) — Complete documentation index
- [GETTING_STARTED.md](./onboarding/GETTING_STARTED.md) — Onboarding guide
`);

  // Write glossary
  const content = sections.join('');
  const outputPath = path.join(DOCS_ROOT, 'GLOSSARY.md');
  await fs.writeFile(outputPath, content);

  logSuccess('Generated GLOSSARY.md');
  logInfo(`Included ${Object.keys(allTerms).length} terms across ${Object.keys(categories).length} categories`);

  return content;
}

// Run if called directly
if (process.argv[1].endsWith('generate-glossary.js')) {
  generateGlossary().catch(console.error);
}

export { generateGlossary };
