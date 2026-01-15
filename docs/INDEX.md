# FreshTrack Pro Documentation Index

> Complete navigation guide to all project documentation

**Last Updated:** (auto-generated)
**Total Documents:** 51

---

## Quick Links

| Document | Description |
|----------|-------------|
| [README](./README.md) | Project overview and quick start |
| [GLOSSARY](./GLOSSARY.md) | Terminology and definitions |
| [CI Checklist](./CI_CHECKLIST.md) | Documentation CI validation rules |

---
## Executive Summary

High-level overviews for stakeholders and decision-makers.

| Document | Description |
|----------|-------------|
| [FreshTrack Pro: Frequently Asked Questions](./executive/FAQ.md) | Frequently asked questions |
| [FreshTrack Pro Overview](./executive/OVERVIEW.md) | What FreshTrack Pro is and does |
| [FreshTrack Pro: System at a Glance](./executive/SYSTEM_AT_A_GLANCE.md) | High-level system overview |
| [FreshTrack Pro User Journeys](./executive/USER_JOURNEYS.md) | Day-in-the-life scenarios |
| [FreshTrack Pro Value Proposition](./executive/VALUE_PROPOSITION.md) | Business value and benefits |

## Architecture

System design, components, and technical decisions.

| Document | Description |
|----------|-------------|
| [FreshTrack Pro System Architecture](./architecture/ARCHITECTURE.md) | System architecture and design |

## Product

Pages, user flows, and product functionality.

| Document | Description |
|----------|-------------|
| [FreshTrack Pro Pages Documentation](./product/PAGES.md) | All application pages and routes |
| [FreshTrack Pro User Flows](./product/USER_FLOWS.md) | User interaction workflows |

## Engineering

API, data model, integrations, and technical details.

| Document | Description |
|----------|-------------|
| [FreshTrack Pro API Documentation](./engineering/API.md) | Edge functions and API endpoints |
| [FreshTrack Pro Data Model](./engineering/DATA_MODEL.md) | Database schema and relationships |
| [FreshTrack Pro Integrations](./engineering/INTEGRATIONS.md) | External service integrations |
| [FreshTrack Pro Observability](./engineering/OBSERVABILITY.md) | Logging and monitoring |

## Onboarding

Getting started guides for new team members.

| Document | Description |
|----------|-------------|
| [Common Development Tasks](./onboarding/COMMON_TASKS.md) | How to do common tasks |
| [Debugging Guide](./onboarding/DEBUGGING_GUIDE.md) | Troubleshooting and debugging |
| [Getting Started with FreshTrack Pro](./onboarding/GETTING_STARTED.md) | Mental model for new developers |
| [Local Development Setup](./onboarding/LOCAL_DEV.md) | Development environment setup |
| [Repository Tour](./onboarding/REPO_TOUR.md) | Codebase walkthrough |

## Quality Assurance

Testing strategy, coverage, and quality assurance.

| Document | Description |
|----------|-------------|
| [Coverage Map](./qa/COVERAGE_MAP.md) | Test coverage by feature |
| [End-to-End Test Scenarios](./qa/E2E_SCENARIOS.md) | End-to-end test scenarios |
| [Known Test Coverage Gaps](./qa/KNOWN_GAPS.md) | Coverage gaps and risks |
| [Manual Testing Guide](./qa/MANUAL_TESTING.md) | Manual QA checklists |
| [Test Strategy](./qa/TEST_STRATEGY.md) | Testing philosophy and approach |

## Security

Security model, threats, and incident response.

| Document | Description |
|----------|-------------|
| [Authentication & Authorization Model](./security/AUTH_MODEL.md) | Authentication and authorization |
| [Data Protection](./security/DATA_PROTECTION.md) | Encryption and data handling |
| [Incident Response](./security/INCIDENT_RESPONSE.md) | Security incident procedures |
| [Security Overview](./security/SECURITY_OVERVIEW.md) | Security principles and controls |
| [Threat Model](./security/THREAT_MODEL.md) | Threats and mitigations |

## Operations

Monitoring, alerting, and operational procedures.

| Document | Description |
|----------|-------------|
| [Alerting](./operations/ALERTING.md) | Alert conditions and escalation |
| [Dashboards](./operations/DASHBOARDS.md) | Monitoring dashboards |
| [Logging](./operations/LOGGING.md) | Log sources and debugging |
| [Metrics Overview](./operations/METRICS_OVERVIEW.md) | System metrics and thresholds |
| [Runbooks](./operations/RUNBOOKS.md) | Operational procedures |

## Diagrams

Visual representations and flowcharts.

| Document | Description |
|----------|-------------|
| [Container Diagram](./diagrams/CONTAINER_DIAGRAM.md) | Container architecture |
| [Page Diagrams](./diagrams/PAGE_DIAGRAMS.md) | Page component diagrams |
| [Sequence Diagrams](./diagrams/SEQUENCES.md) | Sequence diagrams |
| [State Machines](./diagrams/STATE_MACHINES.md) | State machine diagrams |
| [System Context Diagram](./diagrams/SYSTEM_CONTEXT.md) | System context diagram |

## Charts

Data models and entity relationships.

| Document | Description |
|----------|-------------|
| [Entity-Relationship Diagram](./charts/ER_DIAGRAM.md) | Entity relationship diagram |
| [Flowcharts](./charts/FLOWCHARTS.md) | Process flowcharts |

## Architecture Decision Records

Architecture Decision Records documenting key technical decisions.

| Document | Description |
|----------|-------------|
| [Architecture Decision Records (ADRs)](./adr/README.md) | How ADRs work and how to create them |
| [ADR-NNNN: [Title]](./adr/template.md) | Template for new ADRs |

## General

General documentation and guides.

| Document | Description |
|----------|-------------|
| [FrostGuard Deprecations](./deprecations.md) | Deprecated features |
| [Emulator Quick Start - TTN Integration](./EMULATOR_QUICK_START.md) | Emulator quick start |
| [Emulator TTN Integration Guide](./EMULATOR_TTN_INTEGRATION.md) | TTN emulator integration |
| [FreshTrack Pro (FrostGuard)](./README.md) | Project overview |
| [FrostGuard System Map](./system-map.md) | System component map |
| [TTN Production Secrets Setup](./TTN_PRODUCTION_SETUP.md) | Production TTN setup |
| [The Things Network (TTN) Setup Guide](./TTN_SETUP.md) | TTN configuration guide |

---

## Document Relationships

### Core Documentation Flow

```
Executive Overview     →  Architecture  →  Engineering Details
        ↓                      ↓                   ↓
   Value Prop           System Design        API & Data Model
        ↓                      ↓                   ↓
   User Journeys         Diagrams            Integrations
```

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

```bash
npm run docs:build
```

To validate documentation:

```bash
npm run docs:lint
```

To run the complete pipeline:

```bash
npm run docs:all
```

See [CI_CHECKLIST.md](./CI_CHECKLIST.md) for documentation standards and validation rules.
