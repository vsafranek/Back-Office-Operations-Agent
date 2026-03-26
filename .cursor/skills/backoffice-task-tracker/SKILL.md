---
name: backoffice-task-tracker
description: Maintains the Back Office Agent task backlog in docs/tasks/backlog.md. Use when the user asks what to do next, asks to add/remove/update tasks, asks to prioritize work, or asks to track progress on implementation items.
---

# Back Office Task Tracker

## Source of truth
- Backlog file: `docs/tasks/backlog.md`
- Keep this file as the single source of truth for delivery tasks.

## When to use
- User asks for next steps.
- User asks to add new work items.
- User asks to re-prioritize tasks.
- User asks for progress/status overview.
- User asks to mark tasks done or blocked.

## Rules
1. Always read `docs/tasks/backlog.md` before proposing priorities.
2. If a task changes, update the table row directly:
   - `status`
   - `priority`
   - `notes`
3. Use status values exactly: `todo`, `in_progress`, `blocked`, `done`.
4. Use priority values exactly: `P0`, `P1`, `P2`, `P3`.
5. For newly requested work:
   - add a new `BOA-XXX` row with next available ID,
   - keep title action-oriented,
   - add concise implementation note.
6. If a task is blocked, include blocker reason in `notes`.
7. When reporting to user:
   - show top 3 priorities first,
   - call out blockers,
   - suggest the next executable task.

## Update workflow
1. Read current backlog.
2. Apply requested changes.
3. Return a short summary:
   - tasks updated
   - tasks added
   - recommended next task

## Output format for progress updates
- `Updated`: list of changed task IDs
- `Added`: list of new task IDs (if any)
- `Next`: one recommended task ID with one-line rationale
