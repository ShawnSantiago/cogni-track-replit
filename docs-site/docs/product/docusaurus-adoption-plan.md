---
id: docusaurus-adoption-plan
title: Docusaurus Adoption Plan
sidebar_label: Docusaurus Adoption Plan
description: Roadmap for rolling out the CogniTrack documentation site on Docusaurus.
---

## Objectives

- Establish a developer-friendly documentation site that centralizes onboarding, architecture, and runbook content.
- Keep documentation close to the codebase with an automated pipeline for previewing and deploying updates.
- Provide a scalable structure for future multilingual content and versioned release notes.

## Assumptions

- The project will continue to use Next.js for the application front end; Docusaurus will serve documentation only.
- CI is available through existing pipelines (e.g., GitHub Actions) and can be extended to include documentation builds.
- Documentation content will initially focus on existing files in the `docs/` directory and relevant knowledge from the README and PRDs.

## Phase 1: Foundations

1. **Scaffold Docusaurus**
   - Install Docusaurus via `npx create-docusaurus@latest docs-site classic --typescript` into a new `docs-site/` folder at the repo root.
   - Choose the Classic template with TypeScript for consistency with the rest of the codebase.
   - Configure `.gitignore` to exclude generated build artifacts (e.g., `docs-site/build`).
2. **Align package management**
   - Since the project already uses `npm` (per `package-lock.json`), ensure the Docusaurus workspace uses `npm` as well.
   - Add Docusaurus scripts (e.g., `docs`, `docs:build`, `docs:serve`) to the root `package.json` to simplify local workflows.
3. **Integrate styling and branding**
   - Update `docs-site/docusaurus.config.ts` with site metadata (title, tagline, URL, base URL) and organization details.
   - Import existing design tokens (colors, fonts) from the Next.js app where feasible to keep brand consistency.

### Status (2025-10-07)

- [x] `docs-site/` Docusaurus workspace committed with TypeScript preset and build artifacts ignored via `.gitignore`.
- [x] Root `package.json` exposes `docs`, `docs:build`, and `docs:serve` npm scripts that delegate into the documentation workspace.
- [x] Shared design tokens centralized in `src/styles/tokens.css` and consumed by both the Next.js app and Docusaurus theme for consistent branding.

> ℹ️ Run `npm install --prefix docs-site` locally to generate `docs-site/package-lock.json`; registry access is blocked in the sandboxed environment.

## Phase 2: Content Migration

1. **Define documentation information architecture**
   - Draft a navigation structure grouping concepts (e.g., Product Vision, Architecture, Operations) based on `PRD.md` and the documents under `docs/`.
   - Create top-level docs for onboarding, architecture overview, data models, and runbooks.
2. **Migrate existing Markdown**
   - Convert documents in `docs/` and key markdown files (like `README.md`, `PRD.md`) into Docusaurus pages or blog posts.
   - Use frontmatter to capture authorship, last updated metadata, and tags.
   - Ensure internal links are updated to use Docusaurus routing.
3. **Establish contribution guidelines**
   - Add a `CONTRIBUTING.md` section detailing how to run `npm run docs` locally, structure docs, and review PRs.
   - Update the root README to point to the Docusaurus site once deployed.

## Phase 3: Automation & Quality

1. **Local developer experience**
   - Document commands for starting the docs dev server alongside the main app.
   - Optionally add an npm script that concurrently runs both Next.js and Docusaurus for full-stack previews.
2. **Continuous Integration**
   - Extend CI to run `npm run docs:build` to validate Markdown formatting and catch build regressions.
   - Add linting or link-checking plugins (e.g., `@docusaurus/plugin-ideal-image`, `docusaurus-plugin-typedoc` as needed).
3. **Preview & Deployment**
   - Configure a preview pipeline (Vercel, Netlify, or GitHub Pages). For Vercel, add a new project tied to `docs-site` build output.
   - Decide on production hosting (GitHub Pages via GitHub Actions is a default option provided by Docusaurus).

## Phase 4: Enhancements

1. **Search and analytics**
   - Integrate Algolia DocSearch or a similar search provider once the documentation volume grows.
   - Add analytics (e.g., Google Analytics, PostHog) to track usage.
2. **Versioning strategy**
   - Enable Docusaurus versioning to capture major product releases.
   - Define a process for deprecating older docs and announcing updates.
3. **Internationalization (optional)**
   - If the product roadmap includes multilingual support, configure Docusaurus i18n and establish translation workflows.

## Milestones & Deliverables

- **Milestone 1:** Docusaurus scaffold committed, root scripts updated, basic theme configured.
- **Milestone 2:** Core documentation migrated, navigation finalized, contribution guide updated.
- **Milestone 3:** CI validation and hosting pipeline live, public docs URL shared with the team.
- **Milestone 4:** Search/analytics integrations and advanced features (versioning, i18n) evaluated and prioritized.

## Risks & Mitigations

- **Content divergence between README and Docusaurus:** Mitigate by keeping README concise and linking to the docs site for details.
- **Maintenance overhead:** Assign documentation ownership and review responsibilities within the team.
- **Build failures due to Markdown syntax:** Use linting and pre-commit hooks to flag issues early.

## Success Metrics

- Documentation site can be built locally and in CI without errors.
- Team onboarding time decreases, measured via feedback surveys.
- Increased PR adherence to documentation guidelines (tracked via code review checklists).
