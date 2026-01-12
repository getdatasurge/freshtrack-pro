/**
 * Documentation Pipeline Utilities
 * Shared functions for the FreshTrack Pro documentation system
 */

import { promises as fs } from 'fs';
import path from 'path';

export const DOCS_ROOT = path.resolve(process.cwd(), 'docs');
export const META_DIR = path.join(DOCS_ROOT, '_meta');
export const BUILD_DIR = path.join(DOCS_ROOT, '_build');

/**
 * Recursively find all markdown files in a directory
 * Returns files sorted alphabetically for deterministic ordering across environments
 */
export async function findMarkdownFiles(dir, files = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  // Sort entries alphabetically for deterministic ordering
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // Skip _meta, _build, and hidden directories
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) {
      continue;
    }

    if (entry.isDirectory()) {
      await findMarkdownFiles(fullPath, files);
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  // Sort the final results by path for consistent ordering
  if (dir === DOCS_ROOT || files.length > 0) {
    files.sort((a, b) => a.localeCompare(b));
  }

  return files;
}

/**
 * Extract the title from a markdown file (first H1)
 */
export async function extractTitle(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : path.basename(filePath, '.md');
  } catch {
    return path.basename(filePath, '.md');
  }
}

/**
 * Extract all headings from a markdown file
 */
export async function extractHeadings(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const headings = [];
    const regex = /^(#{1,6})\s+(.+)$/gm;
    let match;

    while ((match = regex.exec(content)) !== null) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        anchor: slugify(match[2].trim())
      });
    }

    return headings;
  } catch {
    return [];
  }
}

/**
 * Convert text to URL-safe slug
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Get relative path from docs root
 */
export function getRelativePath(filePath) {
  return path.relative(DOCS_ROOT, filePath);
}

/**
 * Get category from file path
 */
export function getCategory(filePath) {
  const rel = getRelativePath(filePath);
  const parts = rel.split(path.sep);

  if (parts.length === 1) {
    return 'root';
  }

  return parts[0];
}

/**
 * Category display names and order
 */
export const CATEGORY_INFO = {
  'executive': { name: 'Executive Summary', order: 1 },
  'architecture': { name: 'Architecture', order: 2 },
  'product': { name: 'Product', order: 3 },
  'engineering': { name: 'Engineering', order: 4 },
  'onboarding': { name: 'Onboarding', order: 5 },
  'qa': { name: 'Quality Assurance', order: 6 },
  'security': { name: 'Security', order: 7 },
  'operations': { name: 'Operations', order: 8 },
  'diagrams': { name: 'Diagrams', order: 9 },
  'charts': { name: 'Charts', order: 10 },
  'adr': { name: 'Architecture Decision Records', order: 11 },
  'root': { name: 'General', order: 12 }
};

/**
 * Extract all links from markdown content
 */
export function extractLinks(content) {
  const links = [];

  // Match [text](url) pattern
  const regex = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    links.push({
      text: match[1],
      url: match[2],
      full: match[0]
    });
  }

  return links;
}

/**
 * Check if a link is a local markdown link
 */
export function isLocalMarkdownLink(url) {
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('#')) {
    return false;
  }
  return url.endsWith('.md') || url.includes('.md#');
}

/**
 * Resolve a relative link from a source file
 */
export function resolveLink(sourceFile, linkUrl) {
  // Handle anchor-only links
  if (linkUrl.startsWith('#')) {
    return sourceFile;
  }

  // Split URL and anchor
  const [urlPath, anchor] = linkUrl.split('#');
  const sourceDir = path.dirname(sourceFile);
  const resolved = path.resolve(sourceDir, urlPath);

  return resolved;
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract Mermaid code blocks from content
 */
export function extractMermaidBlocks(content) {
  const blocks = [];
  const regex = /```mermaid\n([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    blocks.push({
      content: match[1].trim(),
      full: match[0]
    });
  }

  return blocks;
}

/**
 * Basic Mermaid syntax validation
 * Returns { valid: boolean, error: string | null }
 */
export function validateMermaidSyntax(content) {
  // Check for valid diagram type declarations
  const validTypes = [
    'graph', 'flowchart', 'sequenceDiagram', 'classDiagram',
    'stateDiagram', 'stateDiagram-v2', 'erDiagram', 'journey',
    'gantt', 'pie', 'quadrantChart', 'requirementDiagram',
    'gitGraph', 'mindmap', 'timeline', 'sankey', 'subgraph',
    'C4Context', 'C4Container', 'C4Component', 'C4Dynamic', 'C4Deployment'
  ];

  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length === 0) {
    return { valid: false, error: 'Empty diagram' };
  }

  const firstLine = lines[0].trim();
  const hasValidType = validTypes.some(type =>
    firstLine.startsWith(type) || firstLine.toLowerCase().startsWith(type.toLowerCase())
  );

  // Also allow comments at the start
  if (!hasValidType && !firstLine.startsWith('%%')) {
    return { valid: false, error: `Missing diagram type. First line: "${firstLine.substring(0, 30)}..."` };
  }

  // All basic checks passed
  return { valid: true, error: null };
}

/**
 * Format a timestamp for display
 * In CI mode (CI=true) or when SOURCE_DATE_EPOCH is set, returns a deterministic value
 */
export function formatTimestamp() {
  // In CI mode, omit dynamic timestamps to ensure deterministic output
  if (process.env.CI === 'true') {
    return '(auto-generated)';
  }

  // If SOURCE_DATE_EPOCH is set, use it for reproducible builds
  if (process.env.SOURCE_DATE_EPOCH) {
    const epochSeconds = parseInt(process.env.SOURCE_DATE_EPOCH, 10);
    return new Date(epochSeconds * 1000).toISOString().replace('T', ' ').split('.')[0] + ' UTC';
  }

  return new Date().toISOString().replace('T', ' ').split('.')[0] + ' UTC';
}

/**
 * Get a deterministic timestamp for JSON output
 * Returns null in CI mode (field should be omitted), or ISO string otherwise
 */
export function getGeneratedTimestamp() {
  // In CI mode, return null to signal the field should be omitted
  if (process.env.CI === 'true') {
    return null;
  }

  // If SOURCE_DATE_EPOCH is set, use it for reproducible builds
  if (process.env.SOURCE_DATE_EPOCH) {
    const epochSeconds = parseInt(process.env.SOURCE_DATE_EPOCH, 10);
    return new Date(epochSeconds * 1000).toISOString();
  }

  return new Date().toISOString();
}

/**
 * Console colors for output
 */
export const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

/**
 * Log helpers
 */
export function logSuccess(msg) {
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
}

export function logError(msg) {
  console.log(`${colors.red}✗${colors.reset} ${msg}`);
}

export function logWarning(msg) {
  console.log(`${colors.yellow}!${colors.reset} ${msg}`);
}

export function logInfo(msg) {
  console.log(`${colors.blue}ℹ${colors.reset} ${msg}`);
}

export function logHeader(msg) {
  console.log(`\n${colors.cyan}${msg}${colors.reset}`);
  console.log('─'.repeat(50));
}
