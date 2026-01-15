#!/usr/bin/env node
/**
 * Build PDF Documentation
 * Compiles all documentation into a single PDF
 *
 * Uses markdown concatenation and external tools (if available)
 * Falls back to creating a combined markdown file if PDF tools not installed
 */

import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  DOCS_ROOT,
  META_DIR,
  BUILD_DIR,
  formatTimestamp,
  logSuccess,
  logError,
  logWarning,
  logInfo,
  logHeader
} from './utils.js';

const execAsync = promisify(exec);

/**
 * Parse the PDF manifest file
 */
async function loadManifest() {
  const manifestPath = path.join(META_DIR, 'pdf-manifest.yml');

  try {
    const content = await fs.readFile(manifestPath, 'utf-8');

    // Simple YAML parsing for our specific format
    const manifest = {
      title: 'FreshTrack Pro Documentation',
      subtitle: 'Complete System Documentation',
      sections: [],
      output: {
        filename: 'FreshTrackPro-Documentation.pdf',
        directory: '_build'
      }
    };

    // Extract title
    const titleMatch = content.match(/^title:\s*"([^"]+)"/m);
    if (titleMatch) manifest.title = titleMatch[1];

    // Extract subtitle
    const subtitleMatch = content.match(/^subtitle:\s*"([^"]+)"/m);
    if (subtitleMatch) manifest.subtitle = subtitleMatch[1];

    // Parse sections block by finding lines
    const lines = content.split('\n');
    let currentSection = null;
    let inFiles = false;

    for (const line of lines) {
      // Section name
      const nameMatch = line.match(/^\s+-\s*name:\s*"([^"]+)"/);
      if (nameMatch) {
        if (currentSection) {
          manifest.sections.push(currentSection);
        }
        currentSection = { name: nameMatch[1], files: [] };
        inFiles = false;
        continue;
      }

      // Files block start
      if (line.match(/^\s+files:\s*$/)) {
        inFiles = true;
        continue;
      }

      // File entry (only valid .md files)
      if (inFiles && currentSection) {
        const fileMatch = line.match(/^\s+-\s+([a-zA-Z0-9_\-./]+\.md)\s*$/);
        if (fileMatch) {
          currentSection.files.push(fileMatch[1]);
        } else if (line.match(/^\s+-\s*name:/)) {
          // New section starting
          inFiles = false;
        }
      }
    }

    // Push last section
    if (currentSection) {
      manifest.sections.push(currentSection);
    }

    return manifest;
  } catch (error) {
    if (error.code === 'ENOENT') {
      logWarning('No pdf-manifest.yml found, using default order');
      return null;
    }
    throw error;
  }
}

/**
 * Get files in default order if no manifest
 */
async function getDefaultFileOrder() {
  const directories = [
    '',
    'executive',
    'architecture',
    'product',
    'engineering',
    'onboarding',
    'qa',
    'security',
    'operations',
    'diagrams',
    'charts'
  ];

  const files = [];

  for (const dir of directories) {
    const dirPath = dir ? path.join(DOCS_ROOT, dir) : DOCS_ROOT;

    try {
      const entries = await fs.readdir(dirPath);
      const mdFiles = entries
        .filter(f => f.endsWith('.md') && !f.startsWith('_'))
        .sort()
        .map(f => dir ? `${dir}/${f}` : f);

      files.push(...mdFiles);
    } catch {
      // Directory doesn't exist
    }
  }

  return files;
}

/**
 * Process markdown content for PDF
 * - Converts relative links to anchors
 * - Adds page breaks between sections
 * - Processes images
 */
function processMarkdownForPdf(content, relativePath) {
  let processed = content;

  // Convert relative links to the combined doc
  processed = processed.replace(
    /\[([^\]]+)\]\(\.\/([^)]+)\)/g,
    (match, text, link) => {
      // Remove .md extension and convert to anchor
      const anchor = link.replace('.md', '').replace(/\//g, '-').toLowerCase();
      return `[${text}](#${anchor})`;
    }
  );

  // Convert links with ../ to anchors
  processed = processed.replace(
    /\[([^\]]+)\]\(\.\.\/([^)]+)\)/g,
    (match, text, link) => {
      const anchor = link.replace('.md', '').replace(/\//g, '-').toLowerCase();
      return `[${text}](#${anchor})`;
    }
  );

  return processed;
}

/**
 * Generate cover page
 */
function generateCoverPage(manifest) {
  return `# ${manifest.title}

## ${manifest.subtitle}

---

**Generated:** ${formatTimestamp()}

**Version:** 1.0

---

This document contains the complete documentation for the FreshTrack Pro
temperature monitoring and food safety compliance system.

---

\\newpage

`;
}

/**
 * Check if pandoc is available
 */
async function checkPandoc() {
  try {
    await execAsync('pandoc --version');
    return true;
  } catch {
    return false;
  }
}

/**
 * Build combined markdown file
 */
async function buildCombinedMarkdown(manifest) {
  logInfo('Building combined markdown...');

  const sections = [];

  // Add cover page
  sections.push(generateCoverPage(manifest));

  // Get file order
  let fileOrder;
  if (manifest && manifest.sections.length > 0) {
    fileOrder = manifest.sections.flatMap(s => s.files);
  } else {
    fileOrder = await getDefaultFileOrder();
  }

  // Process each file
  for (const file of fileOrder) {
    const filePath = path.join(DOCS_ROOT, file);

    try {
      let content = await fs.readFile(filePath, 'utf-8');

      // Process for PDF
      content = processMarkdownForPdf(content, file);

      // Add section marker
      const sectionId = file.replace('.md', '').replace(/\//g, '-').toLowerCase();
      sections.push(`<a id="${sectionId}"></a>\n\n`);

      // Add content
      sections.push(content);

      // Add page break
      sections.push('\n\n---\n\n\\newpage\n\n');
    } catch (error) {
      logWarning(`Could not read ${file}: ${error.message}`);
    }
  }

  return sections.join('');
}

/**
 * Build PDF using pandoc
 */
async function buildPdfWithPandoc(combinedMd, outputPath) {
  const tempMdPath = path.join(BUILD_DIR, 'combined.md');

  try {
    // Write combined markdown
    await fs.writeFile(tempMdPath, combinedMd);

    // Build PDF with pandoc
    const pandocArgs = [
      tempMdPath,
      '-o', outputPath,
      '--pdf-engine=xelatex',
      '-V', 'geometry:margin=1in',
      '-V', 'fontsize=11pt',
      '--toc',
      '--toc-depth=3',
      '-V', 'colorlinks=true',
      '-V', 'linkcolor=blue',
      '-V', 'toccolor=gray'
    ].join(' ');

    await execAsync(`pandoc ${pandocArgs}`);

    // Clean up temp file
    await fs.unlink(tempMdPath);

    return true;
  } catch (error) {
    logError(`Pandoc failed: ${error.message}`);
    return false;
  }
}

/**
 * Main build function
 */
async function buildPdf() {
  logHeader('Building PDF Documentation');

  // Ensure build directory exists
  await fs.mkdir(BUILD_DIR, { recursive: true });

  // Load manifest
  const manifest = await loadManifest() || {
    title: 'FreshTrack Pro Documentation',
    subtitle: 'Complete System Documentation',
    sections: [],
    output: {
      filename: 'FreshTrackPro-Documentation.pdf',
      directory: '_build'
    }
  };

  // Build combined markdown
  const combinedMd = await buildCombinedMarkdown(manifest);

  // Save combined markdown (always useful)
  const combinedMdPath = path.join(BUILD_DIR, 'FreshTrackPro-Documentation.md');
  await fs.writeFile(combinedMdPath, combinedMd);
  logSuccess(`Created combined markdown: ${path.relative(DOCS_ROOT, combinedMdPath)}`);

  // Try to build PDF
  const hasPandoc = await checkPandoc();
  const pdfPath = path.join(BUILD_DIR, manifest.output.filename);

  if (hasPandoc) {
    logInfo('Pandoc found, building PDF...');
    const success = await buildPdfWithPandoc(combinedMd, pdfPath);

    if (success) {
      logSuccess(`Created PDF: ${path.relative(DOCS_ROOT, pdfPath)}`);
    } else {
      logWarning('PDF generation failed, combined markdown is available');
    }
  } else {
    logWarning('Pandoc not installed, skipping PDF generation');
    logInfo('To generate PDF, install pandoc: https://pandoc.org/installing.html');
    logInfo('Combined markdown file is available for manual conversion');
  }

  // Generate HTML version using simple conversion
  await buildHtmlVersion(combinedMd, manifest);

  return { combinedMdPath, pdfPath };
}

/**
 * Build a simple HTML version
 */
async function buildHtmlVersion(combinedMd, manifest) {
  logInfo('Building HTML version...');

  // Simple markdown to HTML (basic conversion)
  let html = combinedMd
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="$1">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Blockquotes
    .replace(/^>\s*(.+)$/gm, '<blockquote>$1</blockquote>')
    // Lists
    .replace(/^-\s+(.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\.\s+(.+)$/gm, '<li>$2</li>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p>')
    // Page breaks
    .replace(/\\newpage/g, '<div class="page-break"></div>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr>');

  const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${manifest.title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.6;
      color: #333;
    }
    h1, h2, h3 { color: #1a1a1a; margin-top: 2rem; }
    h1 { border-bottom: 2px solid #eee; padding-bottom: 0.5rem; }
    h2 { border-bottom: 1px solid #eee; padding-bottom: 0.3rem; }
    code { background: #f5f5f5; padding: 0.2em 0.4em; border-radius: 3px; }
    pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; border-radius: 5px; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 1rem; color: #666; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
    a { color: #0066cc; }
    hr { border: none; border-top: 1px solid #eee; margin: 2rem 0; }
    .page-break { page-break-after: always; }
    @media print {
      body { max-width: none; }
      .page-break { page-break-after: always; }
    }
  </style>
</head>
<body>
<p>${html}</p>
</body>
</html>`;

  const htmlPath = path.join(BUILD_DIR, 'FreshTrackPro-Documentation.html');
  await fs.writeFile(htmlPath, htmlDoc);
  logSuccess(`Created HTML: ${path.relative(DOCS_ROOT, htmlPath)}`);
}

// Run if called directly
if (process.argv[1].endsWith('build-pdf.js')) {
  buildPdf().catch(console.error);
}

export { buildPdf };
