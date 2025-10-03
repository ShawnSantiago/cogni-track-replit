# AGENTS.md

This file defines the **operational policies** for Codex/GPT-5 agents that interact with this repository.
It is designed to ensure **safe, auditable, and incremental development** while keeping context accurate and aligned across sessions.

---

## 1. Core Principles

### 1.1 Planning vs Execution

* **Agents must NOT directly execute development or build commands defined in `package.json`.**

* These include (but are not limited to):

  * `npm run dev`
  * `npm run build`
  * Any equivalent scripts (`yarn dev`, `pnpm dev`, etc.)

* Rules for these commands:

  1. The agent must **check if a development server is already running** before suggesting `npm run dev`.
  2. The agent must **explain why the command is needed** (e.g., integration testing, production build validation).
  3. The agent must **explicitly ask the user’s permission** before suggesting the command.

* Every plan must include:

  * Clear **step-by-step tasks**
  * **Risks and mitigations** for each task
  * **Confidence score** with rationale for each step

---

### 1.2 Confidence Scoring

* All plans **must include a `confidence_score`**.
* **Scale:** 0-10

  * 0 = No confidence
  * 5 = Moderate confidence
  * 10 = Very high confidence with strong evidence
* Confidence **must be conservative**, defaulting lower unless validated by clear data or precedent.

**Example:**

```json
{
  "step": "Validate API schema",
  "confidence_score": 6,
  "rationale": "Initial review passed with minor warnings; needs manual review."
}
```

---

### 1.3 Baby Steps Methodology

* Break changes into **the smallest possible steps**.
* After each step:

  1. Validate the result
  2. Document what was done
  3. Reflect and improve
* **Process is product**: documentation of each change is as valuable as the change itself.

---

### 1.4 Mode Switching

Agents can operate in different **modes**, which affect behavior, verbosity, and safety rules:

| Mode                | Purpose                                 | Rules                            |
| ------------------- | --------------------------------------- | -------------------------------- |
| **Plan Mode**       | Outline steps and risks                 | Never suggest execution          |
| **Review Mode**     | Audit work already done                 | Summarize issues and context     |
| **Validation Mode** | Run checks & simulate actions           | Suggest validations only         |
| **Escalation Mode** | Trigger when confidence < 5 or risk > 7 | Pause and alert for human review |
| **Refactor Mode**   | Improve or restructure code             | Must include rollback plan       |

**Threshold Triggers:**

* **Confidence < 5** → Switch to *Escalation Mode*
* **Risk score > 7** → Switch to *Escalation Mode*

---

## 2. Memory Bank Management

Agents must maintain context accuracy using the following files:

* `activeContext.md` – Current priorities and focus
* `progress.md` – Task state and recent actions
* `integrations.md` – External dependencies and systems
* `context_gaps_log.md` – Known conflicts or discrepancies

### 2.1 When a Discrepancy is Found

1. Create a unique Gap ID and log it in `context_gaps_log.md`.
2. Lower confidence scores for **all impacted tasks**.
3. If unresolved for 3 sessions, **escalate to human review**.

---

### 2.2 Confidence Adjustment Rules

* Any file marked `status: partial` → Cap step confidence at **6/10**.
* Any unresolved gap → Overall plan confidence cannot exceed **5/10**.

---

### 2.3 Periodic Memory Review

| Tier       | Frequency         | Action                                                     |
| ---------- | ----------------- | ---------------------------------------------------------- |
| **Tier 1** | On every update   | Append a one-line log entry to `memory_bank_review_log.md` |
| **Tier 2** | Every 25 changes  | Consistency sweep across all Memory Bank files             |
| **Tier 3** | Every 100 changes | Full structural audit and compression                      |

---

### 2.4 Context Compression

When memory grows too large:

* Summarize non-critical information into a `summary.md` file.
* Keep only high-priority details in `activeContext.md`.
* Archive old data in `context_archive/`.

---

## 3. Context Management

### Thresholds

| Threshold             | Action                                                             |
| --------------------- | ------------------------------------------------------------------ |
| **Warn (≥0.75)**      | Summarize, snapshot progress, update memory bank                   |
| **Caution (≥0.85)**   | Prioritize P0/P1 information, consider handoff                     |
| **Emergency (≥0.90)** | Force memory update, halt non-critical tasks, alert human reviewer |

---

## 4. Validation & Rollback

Every plan must include **validation steps** and **rollback procedures**.

### 4.1 Validation Pipeline

1. **Pre-check:** Read relevant files and dependencies.
2. **Simulation:** Run a dry-run or sandbox validation.
3. **Static checks:** Linting, type validation, schema checks.
4. **Integration tests:** Verify external APIs and services.
5. **Manual review:** For high-risk changes, require explicit human sign-off.

---

### 4.2 Rollback Protocol

If a step fails:

1. Identify which files or systems were affected.
2. Provide exact undo steps.
3. Validate that rollback restored the previous state.
4. Document the rollback in `rollback_log.md`.

---

## 5. Session Continuity

* When a session ends, generate a **handoff package** that includes:

  * Summary of progress
  * Open gaps and risks
  * Next recommended steps

**Standard Templates:**

* `standard`
* `development`
* `research`
* `problem_solving`
* `emergency`

---


## 6. Tool Usage Rules

### 6.1 General Rules

* **Read before modify:** Always read file contents first.
* **Exact match edits:** Prevent unintended global changes.
* **Batch related operations:** Group similar edits.
* **Validate before commit:** Run checks before proposing changes.

### 6.2 Development & Build Commands

The agent may **never execute** package.json dev/build scripts directly.

**Allowed behavior:**

1. **Detection step:**

   * Inspect `package.json` for `scripts.dev` and `scripts.build`.
   * Check if a development server is **already running** (by looking for logs, processes, or active ports, if information is available).

2. **Request step:**

   * Suggest the command only if needed.

   * Clearly explain why.

   * Ask the user:

   > “Would you like to run `npm run dev` to start the server?”
   > “Would you like to run `npm run build` to generate a production build?”

3. **Alternatives:**

   * Provide **static validation options** (linting, dry-run, type-checks) before suggesting full builds/servers.

---

## 7. Multi-Agent Handoff Protocol

When multiple agents collaborate:

| Step             | Responsibility                                          |
| ---------------- | ------------------------------------------------------- |
| Context Transfer | Export minimal needed context in `handoff_package.json` |
| Lock Mechanism   | Mark files as locked to prevent overwrites              |
| Versioning       | Include hashes for verification                         |
| Confirmation     | Receiving agent must ACK before proceeding              |

---

## 8. Metrics & Self-Monitoring

The agent must track:

* Number of failed steps per session
* Average confidence drift (planned vs final)
* Frequency of rollbacks
* Total unresolved gaps

**If metrics degrade:**

* Pause operations
* Switch to *Escalation Mode*
* Generate a diagnostic report

---

## 9. Example Plan Output

```json
{
  "steps": [
    {
      "description": "Run ESLint and Prettier across codebase",
      "confidence_score": 8,
      "rationale": "Previous run passed with minor warnings only."
    },
    {
      "description": "Deploy API changes to staging and run tests",
      "confidence_score": 6,
      "rationale": "Staging environment matches production closely but has limited test data."
    }
  ],
  "risks": [
    "Breaking changes to external APIs",
    "Schema mismatch between frontend and backend"
  ],
  "rollback": [
    "Revert to previous Git commit",
    "Run database migration rollback scripts",
    "Validate rollback success with automated test suite"
  ]
}
```

---

## 10. Security & Audit

* **Audit trail required:** All changes logged in `/audit` directory.
* **Source verification:** All code and dependencies must be verified.
* **Hashing:** Include checksums for integrity verification.
* **Rollback logs:** Every rollback must be fully documented.

---

## 11. Byterover MCP Tools Reference

### 11.1 Onboarding Workflow

1. **Check handbook:** `byterover-check-handbook-existence`
2. **Create or sync handbook:**

   * Create with `byterover-create-handbook` if missing.
   * Sync using `byterover-check-handbook-sync` + `byterover-update-handbook`.
3. **Manage modules:**

   * `byterover-list-modules`
   * `byterover-store-modules`
   * `byterover-update-modules`
4. **Store knowledge:**

   * Run `byterover-store-knowledge` to finalize onboarding.

---

### 11.2 Planning Workflow

1. Retrieve active plans → `byterover-retrieve-active-plans`
2. Save approved plans → `byterover-save-implementation-plan`
3. Regularly retrieve knowledge → `byterover-retrieve-knowledge`
4. Update modules as needed → `byterover-update-modules`
5. Mark progress → `byterover-update-plan-progress`
6. Store new insights → `byterover-store-knowledge`

[byterover-mcp]

You are given two tools from Byterover MCP server, including
## 1. `byterover-store-knowledge`
You `MUST` always use this tool when:

+ Learning new patterns, APIs, or architectural decisions from the codebase
+ Encountering error solutions or debugging techniques
+ Finding reusable code patterns or utility functions
+ Completing any significant task or plan implementation

## 2. `byterover-retrieve-knowledge`
You `MUST` always use this tool when:

+ Starting any new task or implementation to gather relevant context
+ Before making architectural decisions to understand existing patterns
+ When debugging issues to check for previous solutions
+ Working with unfamiliar parts of the codebase
Got it — I’ll make the policy more **concrete and specific**:

1. It applies **only to the scripts in `package.json`**, not arbitrary commands.
2. The AI must **check if a dev server is already running** before even suggesting `npm run dev`.
3. The AI must **ask permission** before suggesting either `npm run dev` or `npm run build`.

Here’s the refined **AGENTS.md update**:

---

# AGENTS.md

This file defines the **operational policies** for Codex/GPT-5 agents that interact with this repository.
It is designed to ensure **safe, auditable, and incremental development** while keeping context accurate and aligned across sessions.

---

