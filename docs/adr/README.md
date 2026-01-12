# Architecture Decision Records (ADRs)

> Lightweight documentation for architecturally significant decisions

**Last Updated:** 2026-01-12

---

## What are ADRs?

Architecture Decision Records (ADRs) are short documents that capture important architectural decisions made during the project lifecycle. They provide context, rationale, and consequences for decisions that affect the system's structure, technology choices, or development practices.

## Why Use ADRs?

- **Historical Context**: Understand why past decisions were made
- **Onboarding**: Help new team members understand the codebase quickly
- **Accountability**: Document who made decisions and when
- **Reversibility**: Know when and why to revisit decisions
- **Communication**: Share architectural knowledge across the team

## ADR Lifecycle

```
┌──────────┐    ┌──────────┐    ┌───────────┐    ┌────────────┐
│ Proposed │ →  │ Accepted │ →  │ Deprecated│ →  │ Superseded │
└──────────┘    └──────────┘    └───────────┘    └────────────┘
     │               │                                  │
     └──────────────→│                                  │
         Rejected    └──────────────────────────────────┘
                              Links to new ADR
```

### Status Definitions

| Status | Description |
|--------|-------------|
| **Proposed** | Under discussion, not yet decided |
| **Accepted** | Decision has been made and is in effect |
| **Rejected** | Proposal was considered but not accepted |
| **Deprecated** | Decision is being phased out |
| **Superseded** | Replaced by a newer ADR (link included) |

## How to Create an ADR

### Automated (Recommended)

```bash
npm run adr:new -- "Your ADR Title"
```

This command will:
1. Find the next available ADR number (0001, 0002, etc.)
2. Create a new file with today's date and title slug
3. Pre-fill the template with the title

### Manual

1. Copy `template.md` to a new file
2. Name it: `NNNN-YYYY-MM-DD-title-slug.md`
3. Fill in all sections

## Naming Convention

```
NNNN-YYYY-MM-DD-title-in-kebab-case.md
│    │          │
│    │          └─ Descriptive title (lowercase, hyphens)
│    └─────────── Date decision was recorded
└──────────────── Four-digit sequence number
```

**Examples:**
- `0001-2026-01-12-use-supabase-for-backend.md`
- `0002-2026-01-15-adopt-react-query-for-data-fetching.md`
- `0003-2026-02-01-switch-to-vitest.md`

## ADR Template Structure

Each ADR should contain:

1. **Title**: Clear, descriptive name
2. **Status**: Current lifecycle state
3. **Context**: Problem or situation driving the decision
4. **Decision**: What was decided
5. **Consequences**: Positive and negative impacts
6. **Alternatives**: Options that were considered
7. **Related**: Links to related ADRs, issues, or docs

See [template.md](./template.md) for the full template.

## Best Practices

### When to Write an ADR

Write an ADR when:
- Choosing between competing technologies or approaches
- Making decisions that are expensive to reverse
- Establishing patterns the team should follow
- Deprecating existing patterns or technologies
- Introducing significant new dependencies

### Writing Tips

1. **Be Concise**: ADRs should be 1-2 pages maximum
2. **Focus on Why**: The rationale is more important than the what
3. **Include Alternatives**: Show what else was considered
4. **Accept Uncertainty**: It's OK to note unknowns
5. **Update, Don't Delete**: Mark old ADRs as superseded, don't remove them

### Reviewing ADRs

- ADRs should be reviewed like code changes
- Include ADR creation in relevant PR descriptions
- Revisit ADRs during retrospectives

## Current ADRs

| # | Date | Title | Status |
|---|------|-------|--------|
| - | - | No ADRs yet | - |

*This table is automatically updated when new ADRs are created.*

---

## References

- [ADR GitHub Organization](https://adr.github.io/)
- [Michael Nygard's Original Blog Post](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [Lightweight Architecture Decision Records](https://www.thoughtworks.com/radar/techniques/lightweight-architecture-decision-records)
