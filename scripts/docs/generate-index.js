#!/usr/bin/env node
/**
 * Generate Documentation Index
 * Creates /docs/INDEX.md with a complete table of contents
 */

import { promises as fs } from 'fs';
import path from 'path';
import {
  DOCS_ROOT,
  META_DIR,
  formatTimestamp,
  logSuccess,
  logInfo,
  logHeader
} from './utils.js';
import { generateDocsMap } from './generate-docs-map.js';

async function generateIndex() {
  logHeader('Generating Documentation Index');

  // First generate the docs map
  const docsMap = await generateDocsMap();

  const sections = [];

  // Header
  sections.push(`# FreshTrack Pro Documentation Index

> Complete navigation guide to all project documentation

**Last Updated:** ${formatTimestamp()}
**Total Documents:** ${docsMap.totalFiles}

---

## Quick Links

| Document | Description |
|----------|-------------|
| [README](./README.md) | Project overview and quick start |
| [GLOSSARY](./GLOSSARY.md) | Terminology and definitions |
| [CI Checklist](./CI_CHECKLIST.md) | Documentation CI validation rules |

---
`);

  // Generate sections by category
  const categoryOrder = [
    'executive',
    'architecture',
    'product',
    'engineering',
    'onboarding',
    'qa',
    'security',
    'operations',
    'diagrams',
    'charts',
    'adr',
    'root'
  ];

  for (const categoryKey of categoryOrder) {
    const category = docsMap.categories[categoryKey];
    if (!category || category.files.length === 0) continue;

    const sectionTitle = category.name;
    const files = category.files;

    let section = `## ${sectionTitle}\n\n`;

    // Add description based on category
    const descriptions = {
      'executive': 'High-level overviews for stakeholders and decision-makers.',
      'architecture': 'System design, components, and technical decisions.',
      'product': 'Pages, user flows, and product functionality.',
      'engineering': 'API, data model, integrations, and technical details.',
      'onboarding': 'Getting started guides for new team members.',
      'qa': 'Testing strategy, coverage, and quality assurance.',
      'security': 'Security model, threats, and incident response.',
      'operations': 'Monitoring, alerting, and operational procedures.',
      'diagrams': 'Visual representations and flowcharts.',
      'charts': 'Data models and entity relationships.',
      'adr': 'Architecture Decision Records documenting key technical decisions.',
      'root': 'General documentation and guides.'
    };

    if (descriptions[categoryKey]) {
      section += `${descriptions[categoryKey]}\n\n`;
    }

    section += '| Document | Description |\n';
    section += '|----------|-------------|\n';

    for (const file of files) {
      // Skip INDEX.md and GLOSSARY.md in root
      if (categoryKey === 'root' && (file.path === 'INDEX.md' || file.path === 'GLOSSARY.md' || file.path === 'CI_CHECKLIST.md')) {
        continue;
      }

      const linkPath = file.path.startsWith('./') ? file.path : `./${file.path}`;
      const description = getDocDescription(file.path, file.title);
      section += `| [${file.title}](${linkPath}) | ${description} |\n`;
    }

    section += '\n';
    sections.push(section);
  }

  // Cross-reference section
  sections.push(`---

## Document Relationships

### Core Documentation Flow

\`\`\`
Executive Overview     →  Architecture  →  Engineering Details
        ↓                      ↓                   ↓
   Value Prop           System Design        API & Data Model
        ↓                      ↓                   ↓
   User Journeys         Diagrams            Integrations
\`\`\`

### Key Cross-References

| If you need... | Start with... | Then see... |
|----------------|---------------|-------------|
| System understanding | [Architecture](./architecture/ARCHITECTURE.md) | [System Context](./diagrams/SYSTEM_CONTEXT.md) |
| User flows | [User Flows](./product/USER_FLOWS.md) | [Sequences](./diagrams/SEQUENCES.md) |
| Data structures | [Data Model](./engineering/DATA_MODEL.md) | [ER Diagram](./charts/ER_DIAGRAM.md) |
| Getting started | [Getting Started](./onboarding/GETTING_STARTED.md) | [Local Dev](./onboarding/LOCAL_DEV.md) |
| Security review | [Security Overview](./security/SECURITY_OVERVIEW.md) | [Threat Model](./security/THREAT_MODEL.md) |
| Operations | [Metrics](./operations/METRICS_OVERVIEW.md) | [Runbooks](./operations/RUNBOOKS.md) |

---

## Documentation Pipeline

This index is automatically generated. To regenerate:

\`\`\`bash
npm run docs:build
\`\`\`

To validate documentation:

\`\`\`bash
npm run docs:lint
\`\`\`

To run the complete pipeline:

\`\`\`bash
npm run docs:all
\`\`\`

See [CI_CHECKLIST.md](./CI_CHECKLIST.md) for documentation standards and validation rules.
`);

  // Write index
  const content = sections.join('');
  const outputPath = path.join(DOCS_ROOT, 'INDEX.md');
  await fs.writeFile(outputPath, content);

  logSuccess('Generated INDEX.md');
  logInfo(`Included ${docsMap.totalFiles} documents across ${Object.keys(docsMap.categories).length} categories`);

  return content;
}

/**
 * Get a brief description for a document based on its path/title
 */
function getDocDescription(filePath, title) {
  const descriptions = {
    // Executive
    'executive/OVERVIEW.md': 'What FreshTrack Pro is and does',
    'executive/VALUE_PROPOSITION.md': 'Business value and benefits',
    'executive/SYSTEM_AT_A_GLANCE.md': 'High-level system overview',
    'executive/USER_JOURNEYS.md': 'Day-in-the-life scenarios',
    'executive/FAQ.md': 'Frequently asked questions',

    // Architecture
    'architecture/ARCHITECTURE.md': 'System architecture and design',

    // Product
    'product/PAGES.md': 'All application pages and routes',
    'product/USER_FLOWS.md': 'User interaction workflows',

    // Engineering
    'engineering/API.md': 'Edge functions and API endpoints',
    'engineering/DATA_MODEL.md': 'Database schema and relationships',
    'engineering/INTEGRATIONS.md': 'External service integrations',
    'engineering/OBSERVABILITY.md': 'Logging and monitoring',

    // Onboarding
    'onboarding/GETTING_STARTED.md': 'Mental model for new developers',
    'onboarding/REPO_TOUR.md': 'Codebase walkthrough',
    'onboarding/LOCAL_DEV.md': 'Development environment setup',
    'onboarding/COMMON_TASKS.md': 'How to do common tasks',
    'onboarding/DEBUGGING_GUIDE.md': 'Troubleshooting and debugging',

    // QA
    'qa/TEST_STRATEGY.md': 'Testing philosophy and approach',
    'qa/COVERAGE_MAP.md': 'Test coverage by feature',
    'qa/MANUAL_TESTING.md': 'Manual QA checklists',
    'qa/E2E_SCENARIOS.md': 'End-to-end test scenarios',
    'qa/KNOWN_GAPS.md': 'Coverage gaps and risks',

    // Security
    'security/SECURITY_OVERVIEW.md': 'Security principles and controls',
    'security/AUTH_MODEL.md': 'Authentication and authorization',
    'security/DATA_PROTECTION.md': 'Encryption and data handling',
    'security/THREAT_MODEL.md': 'Threats and mitigations',
    'security/INCIDENT_RESPONSE.md': 'Security incident procedures',

    // Operations
    'operations/METRICS_OVERVIEW.md': 'System metrics and thresholds',
    'operations/DASHBOARDS.md': 'Monitoring dashboards',
    'operations/ALERTING.md': 'Alert conditions and escalation',
    'operations/LOGGING.md': 'Log sources and debugging',
    'operations/RUNBOOKS.md': 'Operational procedures',

    // Diagrams
    'diagrams/SYSTEM_CONTEXT.md': 'System context diagram',
    'diagrams/CONTAINER_DIAGRAM.md': 'Container architecture',
    'diagrams/PAGE_DIAGRAMS.md': 'Page component diagrams',
    'diagrams/SEQUENCES.md': 'Sequence diagrams',
    'diagrams/STATE_MACHINES.md': 'State machine diagrams',

    // Charts
    'charts/ER_DIAGRAM.md': 'Entity relationship diagram',
    'charts/FLOWCHARTS.md': 'Process flowcharts',

    // ADR
    'adr/README.md': 'How ADRs work and how to create them',
    'adr/template.md': 'Template for new ADRs',

    // Root
    'README.md': 'Project overview',
    'GLOSSARY.md': 'Terminology definitions',
    'TTN_SETUP.md': 'TTN configuration guide',
    'TTN_PRODUCTION_SETUP.md': 'Production TTN setup',
    'EMULATOR_QUICK_START.md': 'Emulator quick start',
    'EMULATOR_TTN_INTEGRATION.md': 'TTN emulator integration',
    'system-map.md': 'System component map',
    'deprecations.md': 'Deprecated features'
  };

  return descriptions[filePath] || title;
}

// Run if called directly
if (process.argv[1].endsWith('generate-index.js')) {
  generateIndex().catch(console.error);
}

export { generateIndex };
