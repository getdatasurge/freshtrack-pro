#!/usr/bin/env node
/**
 * Documentation Linter
 * Validates documentation structure, links, and content quality
 */

import { promises as fs } from 'fs';
import path from 'path';
import {
  DOCS_ROOT,
  findMarkdownFiles,
  extractLinks,
  extractTitle,
  validateMermaidSyntax,
  logSuccess,
  logError,
  logWarning,
  logInfo,
  logHeader
} from './utils.js';

const errors = [];
const warnings = [];

/**
 * Remove code blocks from content for validation
 */
function stripCodeBlocks(content) {
  // Remove fenced code blocks
  return content.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '');
}

/**
 * Check if a file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate internal links in a document
 */
async function validateLinks(filePath, content) {
  // Strip code blocks before extracting links
  const contentWithoutCode = stripCodeBlocks(content);
  const links = extractLinks(contentWithoutCode);
  const fileDir = path.dirname(filePath);
  const relativePath = path.relative(DOCS_ROOT, filePath);

  for (const linkObj of links) {
    const link = linkObj.url;

    // Skip links that are clearly not file paths (too long, contain weird chars, etc)
    if (link.length > 200 || link.includes('\n') || link.includes('|')) continue;

    // Skip external links
    if (link.startsWith('http://') || link.startsWith('https://')) continue;

    // Skip anchor-only links
    if (link.startsWith('#')) continue;

    // Skip mailto links
    if (link.startsWith('mailto:')) continue;

    // Handle links with anchors
    const [linkPath, anchor] = link.split('#');
    if (!linkPath) continue;

    // Resolve the link path
    let resolvedPath;
    if (linkPath.startsWith('/')) {
      // Absolute path from docs root
      resolvedPath = path.join(DOCS_ROOT, linkPath);
    } else {
      // Relative path from current file
      resolvedPath = path.resolve(fileDir, linkPath);
    }

    // Check if file exists
    const exists = await fileExists(resolvedPath);
    if (!exists) {
      errors.push({
        file: relativePath,
        type: 'broken-link',
        message: `Broken link: ${link} -> ${path.relative(DOCS_ROOT, resolvedPath)}`
      });
    }
  }
}

/**
 * Validate document structure
 */
async function validateStructure(filePath, content) {
  const relativePath = path.relative(DOCS_ROOT, filePath);
  const lines = content.split('\n');

  // Check for title (H1)
  const title = extractTitle(content);
  if (!title) {
    errors.push({
      file: relativePath,
      type: 'missing-title',
      message: 'Document missing H1 title'
    });
  }

  // Check for description/subtitle
  const hasDescription = content.includes('\n>') || content.includes('\n\n>');
  if (!hasDescription && !relativePath.includes('INDEX') && !relativePath.includes('GLOSSARY')) {
    warnings.push({
      file: relativePath,
      type: 'missing-description',
      message: 'Consider adding a description (> blockquote after title)'
    });
  }

  // Check for proper heading hierarchy
  let lastLevel = 0;
  let lineNumber = 0;
  for (const line of lines) {
    lineNumber++;
    const headingMatch = line.match(/^(#{1,6})\s+/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      if (level > lastLevel + 1 && lastLevel > 0) {
        warnings.push({
          file: relativePath,
          type: 'heading-skip',
          message: `Line ${lineNumber}: Heading level jumps from H${lastLevel} to H${level}`
        });
      }
      lastLevel = level;
    }
  }

  // Check for Related Documents section (recommended)
  const hasRelatedDocs = content.includes('## Related Documents') || content.includes('## Related');
  if (!hasRelatedDocs && !relativePath.includes('INDEX') && !relativePath.includes('GLOSSARY')) {
    warnings.push({
      file: relativePath,
      type: 'missing-related',
      message: 'Consider adding a "Related Documents" section'
    });
  }
}

/**
 * Validate Mermaid diagrams
 */
async function validateDiagrams(filePath, content) {
  const relativePath = path.relative(DOCS_ROOT, filePath);
  const mermaidBlocks = content.match(/```mermaid[\s\S]*?```/g) || [];

  for (let i = 0; i < mermaidBlocks.length; i++) {
    const block = mermaidBlocks[i];
    const diagramContent = block.replace(/```mermaid\n?/, '').replace(/\n?```$/, '');

    const validation = validateMermaidSyntax(diagramContent);
    if (!validation.valid) {
      errors.push({
        file: relativePath,
        type: 'invalid-mermaid',
        message: `Mermaid diagram ${i + 1}: ${validation.error}`
      });
    }
  }
}

/**
 * Check for common content issues
 */
async function validateContent(filePath, content) {
  const relativePath = path.relative(DOCS_ROOT, filePath);

  // Strip code blocks for placeholder/TODO checks
  const textContent = stripCodeBlocks(content);

  // Check for TODO/FIXME markers (not in code)
  const todoMatches = textContent.match(/\b(TODO|FIXME|XXX|HACK)\b/gi);
  if (todoMatches) {
    warnings.push({
      file: relativePath,
      type: 'todo-marker',
      message: `Contains ${todoMatches.length} TODO/FIXME marker(s)`
    });
  }

  // Check for placeholder text (not in code)
  // Skip if it's in a context that looks like documentation about placeholders
  const placeholders = textContent.match(/\[TBD\]|\[TODO\]|\[PLACEHOLDER\]|lorem ipsum/gi);
  if (placeholders && !relativePath.includes('CI_CHECKLIST')) {
    errors.push({
      file: relativePath,
      type: 'placeholder-text',
      message: `Contains placeholder text: ${placeholders.join(', ')}`
    });
  }

  // Check for very short documents (< 100 chars excluding whitespace)
  const contentLength = content.replace(/\s/g, '').length;
  if (contentLength < 100) {
    warnings.push({
      file: relativePath,
      type: 'short-document',
      message: 'Document is very short (< 100 characters)'
    });
  }

  // Check for empty code blocks
  const emptyCodeBlocks = content.match(/```\w*\n\s*\n```/g);
  if (emptyCodeBlocks) {
    warnings.push({
      file: relativePath,
      type: 'empty-code-block',
      message: `Contains ${emptyCodeBlocks.length} empty code block(s)`
    });
  }

  // Check for broken table formatting
  const tableRows = content.match(/^\|.*\|$/gm) || [];
  for (let i = 0; i < tableRows.length; i++) {
    const row = tableRows[i];
    const cellCount = (row.match(/\|/g) || []).length - 1;
    if (i > 0 && tableRows[i - 1]) {
      const prevCellCount = (tableRows[i - 1].match(/\|/g) || []).length - 1;
      if (cellCount !== prevCellCount && cellCount > 0 && prevCellCount > 0) {
        // Skip separator rows
        if (!row.match(/^\|[\s\-:|]+\|$/)) {
          warnings.push({
            file: relativePath,
            type: 'table-format',
            message: `Table row has inconsistent column count`
          });
          break;
        }
      }
    }
  }
}

/**
 * Check required files exist
 */
async function validateRequiredFiles() {
  const requiredFiles = [
    'README.md',
    'INDEX.md',
    'GLOSSARY.md',
    'architecture/ARCHITECTURE.md',
    'engineering/API.md',
    'engineering/DATA_MODEL.md'
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(DOCS_ROOT, file);
    const exists = await fileExists(filePath);
    if (!exists) {
      errors.push({
        file: file,
        type: 'missing-required',
        message: `Required file missing: ${file}`
      });
    }
  }
}

/**
 * Check for orphaned documents (not linked from INDEX)
 */
async function validateOrphanedDocs() {
  const indexPath = path.join(DOCS_ROOT, 'INDEX.md');
  const indexExists = await fileExists(indexPath);

  if (!indexExists) return;

  const indexContent = await fs.readFile(indexPath, 'utf-8');
  const indexLinks = extractLinks(indexContent);

  const allFiles = await findMarkdownFiles(DOCS_ROOT);

  for (const file of allFiles) {
    const relativePath = path.relative(DOCS_ROOT, file);

    // Skip meta files and generated files
    if (relativePath.startsWith('_')) continue;
    if (relativePath === 'INDEX.md' || relativePath === 'GLOSSARY.md') continue;
    if (relativePath === 'CI_CHECKLIST.md') continue;

    // Check if linked from index
    const isLinked = indexLinks.some(linkObj => {
      const normalizedLink = linkObj.url.replace(/^\.\//, '');
      return normalizedLink === relativePath || normalizedLink === `./${relativePath}`;
    });

    if (!isLinked) {
      warnings.push({
        file: relativePath,
        type: 'orphaned',
        message: 'Document not linked from INDEX.md'
      });
    }
  }
}

/**
 * Main lint function
 */
async function lintDocs() {
  logHeader('Linting Documentation');

  const files = await findMarkdownFiles(DOCS_ROOT);
  logInfo(`Found ${files.length} markdown files`);

  // Validate required files
  await validateRequiredFiles();

  // Validate each file
  for (const file of files) {
    // Skip meta directory
    if (file.includes('/_meta/') || file.includes('/_build/')) continue;

    const content = await fs.readFile(file, 'utf-8');

    await validateLinks(file, content);
    await validateStructure(file, content);
    await validateDiagrams(file, content);
    await validateContent(file, content);
  }

  // Check for orphaned docs
  await validateOrphanedDocs();

  // Report results
  console.log('\n');

  if (errors.length > 0) {
    logError(`Found ${errors.length} error(s):`);
    for (const error of errors) {
      console.log(`  ❌ ${error.file}: ${error.message}`);
    }
    console.log('');
  }

  if (warnings.length > 0) {
    logWarning(`Found ${warnings.length} warning(s):`);
    for (const warning of warnings) {
      console.log(`  ⚠️  ${warning.file}: ${warning.message}`);
    }
    console.log('');
  }

  if (errors.length === 0 && warnings.length === 0) {
    logSuccess('No issues found!');
  } else if (errors.length === 0) {
    logSuccess('No errors found (warnings only)');
  }

  // Return exit code
  return {
    errors: errors.length,
    warnings: warnings.length,
    success: errors.length === 0
  };
}

// Run if called directly
if (process.argv[1].endsWith('lint-docs.js')) {
  lintDocs()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export { lintDocs };
