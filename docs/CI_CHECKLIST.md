# Documentation CI Checklist

> Validation rules enforced by the documentation pipeline

---

## Overview

This document describes the automated checks run by `npm run docs:lint` and the CI workflow. All checks must pass before documentation changes can be merged.

---

## Automated Checks

### ✅ Structure Validation

| Check | Severity | Description |
|-------|----------|-------------|
| **H1 Title Required** | Error | Every document must have exactly one H1 (`#`) title |
| **Heading Hierarchy** | Warning | Heading levels should not skip (e.g., H2 → H4) |
| **Description Block** | Warning | Documents should have a description blockquote after title |
| **Related Documents** | Warning | Documents should link to related content |

### ✅ Link Validation

| Check | Severity | Description |
|-------|----------|-------------|
| **Broken Internal Links** | Error | All `[text](./path.md)` links must resolve to existing files |
| **Orphaned Documents** | Warning | All docs should be linked from INDEX.md |
| **Anchor Links** | Info | Links to specific sections are validated |

### ✅ Content Validation

| Check | Severity | Description |
|-------|----------|-------------|
| **Placeholder Text** | Error | No `[TBD]`, `[TODO]`, or `[PLACEHOLDER]` in content |
| **TODO Markers** | Warning | `TODO`, `FIXME`, `XXX` should be resolved |
| **Empty Code Blocks** | Warning | Code blocks should contain content |
| **Minimum Length** | Warning | Documents should have meaningful content (>100 chars) |
| **Table Formatting** | Warning | Table rows should have consistent column counts |

### ✅ Diagram Validation

| Check | Severity | Description |
|-------|----------|-------------|
| **Mermaid Syntax** | Error | Mermaid diagrams must have valid syntax |
| **Diagram Type** | Error | Must start with valid diagram type (graph, flowchart, etc.) |

### ✅ Required Files

| File | Required | Purpose |
|------|----------|---------|
| `README.md` | Yes | Project overview |
| `INDEX.md` | Yes | Documentation navigation |
| `GLOSSARY.md` | Yes | Term definitions |
| `architecture/ARCHITECTURE.md` | Yes | System architecture |
| `engineering/API.md` | Yes | API documentation |
| `engineering/DATA_MODEL.md` | Yes | Data model documentation |

---

## CI Workflow

### Trigger Conditions

The documentation CI runs on:
- Push to `main` or `develop` branches (docs/** changes)
- Pull requests touching `docs/**` files
- Manual workflow dispatch

### Pipeline Steps

```yaml
1. Checkout repository
2. Setup Node.js
3. Install dependencies
4. Run docs:lint
5. Run docs:generate
6. Verify no uncommitted changes
7. Upload artifacts (if build step)
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed |
| 1 | One or more errors found |

---

## Local Validation

### Before Committing

Run the full documentation pipeline locally:

```bash
# Full pipeline (generate + lint + build)
npm run docs:all

# Just validate
npm run docs:lint

# Just regenerate index/glossary
npm run docs:generate
```

### Pre-commit Hook (Recommended)

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Check if docs changed
if git diff --cached --name-only | grep -q "^docs/"; then
  npm run docs:lint || exit 1
fi
```

---

## Fixing Common Issues

### Broken Link

```markdown
# Error: Broken link: ./missing.md

# Fix: Update the link to correct path
[Text](./correct-path.md)
```

### Missing Title

```markdown
# Error: Document missing H1 title

# Fix: Add title at top of document
# My Document Title

Content here...
```

### Heading Skip

```markdown
# Warning: Heading level jumps from H2 to H4

# Bad:
## Section
#### Subsection

# Good:
## Section
### Subsection
```

### Placeholder Text

```markdown
# Error: Contains placeholder text: [TBD]

# Fix: Replace with actual content
[TBD] → The actual implementation details...
```

### Invalid Mermaid

```markdown
# Error: Mermaid diagram: Missing diagram type

# Bad:
\`\`\`mermaid
A --> B
\`\`\`

# Good:
\`\`\`mermaid
graph LR
    A --> B
\`\`\`
```

---

## Severity Levels

| Level | CI Impact | Action Required |
|-------|-----------|-----------------|
| **Error** | Fails CI | Must fix before merge |
| **Warning** | Passes CI | Should fix, not blocking |
| **Info** | Passes CI | Optional improvement |

---

## Adding New Checks

To add new validation rules:

1. Edit `scripts/docs/lint-docs.js`
2. Add validation function
3. Call from `lintDocs()` function
4. Update this checklist

Example:

```javascript
async function validateNewRule(filePath, content) {
  const relativePath = path.relative(DOCS_ROOT, filePath);

  if (/* condition */) {
    errors.push({
      file: relativePath,
      type: 'new-rule',
      message: 'Description of the issue'
    });
  }
}
```

---

## Bypassing Checks

### Emergency Merge

If you must merge with failing checks (not recommended):

1. Add `[skip docs-ci]` to commit message
2. Create follow-up issue to fix documentation
3. Fix within 24 hours

### Suppressing Warnings

Some warnings can be suppressed per-file:

```markdown
<!-- docs-lint-disable missing-related -->
# Document Without Related Section

This document intentionally has no related documents section.
```

---

## Metrics

Track documentation health over time:

| Metric | Target | Current |
|--------|--------|---------|
| Broken links | 0 | - |
| Orphaned docs | 0 | - |
| TODO markers | 0 | - |
| Coverage | 100% | - |

Run `npm run docs:lint` to see current counts.

---

## Related Documents

- [INDEX.md](./INDEX.md) — Documentation navigation
- [GLOSSARY.md](./GLOSSARY.md) — Term definitions
- [README.md](./README.md) — Project overview
