<!--
Sync Impact Report
- Version change: template -> 1.0.0
- Modified principles: placeholders replaced with five project-specific principles
- Added sections: Operational Constraints; Development Workflow & Quality Gates
- Removed sections: none
- Templates requiring updates:
  - [done] Reviewed (no content changes required): .specify/templates/plan-template.md
  - [done] Reviewed (no content changes required): .specify/templates/spec-template.md
  - [done] Reviewed (no content changes required): .specify/templates/tasks-template.md
  - [pending] Pending/Not present: .specify/templates/commands/*.md (directory not found)
- Deferred TODOs: none
-->

# Back Office Operations Agent Constitution

## Core Principles

### I. Security & Privacy by Default
All features MUST protect credentials, personal data, and business-sensitive records by
default. Secrets MUST remain server-side, sensitive fields MUST be masked in logs and
UI, and data retention MUST be explicit and minimal. Integrations with Supabase,
Google Workspace, and AI providers MUST use least-privilege credentials and scoped
access.

Rationale: The system orchestrates operational workflows and communication channels,
so a single leakage can expose internal operations and customer information.

### II. Human Approval for External Actions
Outbound communications and operationally impactful actions MUST remain
human-controllable unless a requirement explicitly authorizes automation and documents
guardrails. Email drafts, calendar changes, and workflow triggers that can affect third
parties MUST expose an approval checkpoint or auditable policy-based override.

Rationale: Back-office automation must reduce workload without removing accountability
for customer-facing decisions.

### III. Traceability and Auditability
Every meaningful agent run MUST be traceable end-to-end across prompt, tool calls,
outputs, and side effects. New features MUST emit structured audit events with stable
identifiers and preserve correlation IDs across services and scheduled jobs.

Rationale: Operational trust requires fast incident reconstruction, compliance evidence,
and explainability of AI-assisted decisions.

### IV. Test-First Delivery for Business-Critical Logic
Changes to agent orchestration, tool inference, workflow execution, and notification logic
MUST be implemented with tests that fail before implementation and pass after it.
At minimum, affected unit and integration paths MUST be covered, and regressions in
existing behavior MUST be prevented by automated checks.

Rationale: The platform coordinates multiple integrations and asynchronous flows where
silent regressions are costly and difficult to detect manually.

### V. Spec-Driven Incremental Change
Feature delivery MUST follow the Spec Kit flow: specify intent, plan implementation,
break work into tasks, then implement in small verifiable increments. Each increment MUST
produce independently testable value and maintain backward compatibility unless an
explicitly approved breaking change is documented.

Rationale: Spec-driven execution improves predictability, reduces rework, and keeps
multi-step AI-assisted development aligned with business intent.

## Operational Constraints

- Runtime stack MUST remain aligned with the current architecture: Next.js API/orchestration,
  Supabase for data/storage, and OpenAI-compatible API integration through the official
  `openai` SDK.
- Scheduled and automated workflows MUST support idempotent execution and safe retries.
- Database schema changes MUST be delivered through versioned Supabase migrations.
- Feature work MUST preserve existing authentication and authorization guarantees for all
  storage and operational endpoints.
- Observability and audit data retention windows MUST be configurable via environment
  settings.

## Development Workflow & Quality Gates

1. Start each non-trivial change with a written specification in Spec Kit format.
2. Produce an implementation plan with an explicit Constitution Check before coding.
3. Generate task breakdown aligned to user stories and complete work incrementally.
4. Run relevant automated tests before merge; failing tests block completion.
5. Update architecture or operational documentation when behavior, constraints,
   or runbooks change.
6. For changes that affect external communication or automation safety, perform
   a focused review of approval checkpoints and audit logging.

## Governance

This constitution supersedes conflicting local conventions for this repository.
Amendments require a documented rationale in version control and a review by project
maintainers responsible for operations and engineering quality.

Versioning policy:
- MAJOR: Breaking governance changes, principle removals, or materially incompatible
  reinterpretations.
- MINOR: New principle/section or materially expanded mandatory guidance.
- PATCH: Clarifications, wording improvements, and non-semantic refinements.

Compliance review expectations:
- Every implementation plan MUST include a Constitution Check gate.
- Every pull request MUST state whether constitution-impacting changes were made.
- Deviations MUST be explicitly justified in the plan complexity tracking section and
  approved before implementation.

**Version**: 1.0.0 | **Ratified**: 2026-04-13 | **Last Amended**: 2026-04-13
