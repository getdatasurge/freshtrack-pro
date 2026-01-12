#!/usr/bin/env node
/**
 * Generate Documentation Map
 * Creates /docs/_meta/docs-map.json with all documentation files and metadata
 */

import { promises as fs } from 'fs';
import path from 'path';
import {
  DOCS_ROOT,
  META_DIR,
  findMarkdownFiles,
  extractTitle,
  extractHeadings,
  getRelativePath,
  getCategory,
  CATEGORY_INFO,
  getGeneratedTimestamp,
  logSuccess,
  logInfo,
  logHeader
} from './utils.js';

async function generateDocsMap() {
  logHeader('Generating Documentation Map');

  const files = await findMarkdownFiles(DOCS_ROOT);

  // Build docsMap - only include 'generated' field when not in CI mode
  const generatedTimestamp = getGeneratedTimestamp();
  const docsMap = {
    ...(generatedTimestamp ? { generated: generatedTimestamp } : {}),
    totalFiles: files.length,
    categories: {},
    files: []
  };

  for (const filePath of files) {
    const relativePath = getRelativePath(filePath);
    const category = getCategory(filePath);
    const title = await extractTitle(filePath);
    const headings = await extractHeadings(filePath);

    const fileInfo = {
      path: relativePath,
      title,
      category,
      headings: headings.filter(h => h.level <= 2).map(h => ({
        text: h.text,
        anchor: h.anchor
      }))
    };

    docsMap.files.push(fileInfo);

    // Group by category
    if (!docsMap.categories[category]) {
      docsMap.categories[category] = {
        name: CATEGORY_INFO[category]?.name || category,
        order: CATEGORY_INFO[category]?.order || 99,
        files: []
      };
    }
    docsMap.categories[category].files.push({
      path: relativePath,
      title
    });
  }

  // Sort categories by order and sort files within each category
  const sortedCategories = {};
  Object.entries(docsMap.categories)
    .sort((a, b) => a[1].order - b[1].order)
    .forEach(([key, value]) => {
      // Sort files within category alphabetically by path
      value.files.sort((a, b) => a.path.localeCompare(b.path));
      sortedCategories[key] = value;
    });
  docsMap.categories = sortedCategories;

  // Sort the files array by path for deterministic output
  docsMap.files.sort((a, b) => a.path.localeCompare(b.path));

  // Ensure _meta directory exists
  await fs.mkdir(META_DIR, { recursive: true });

  // Write docs map
  const outputPath = path.join(META_DIR, 'docs-map.json');
  await fs.writeFile(outputPath, JSON.stringify(docsMap, null, 2));

  logSuccess(`Generated docs-map.json with ${files.length} files`);
  logInfo(`Categories: ${Object.keys(docsMap.categories).join(', ')}`);

  return docsMap;
}

// Run if called directly
if (process.argv[1].endsWith('generate-docs-map.js')) {
  generateDocsMap().catch(console.error);
}

export { generateDocsMap };
