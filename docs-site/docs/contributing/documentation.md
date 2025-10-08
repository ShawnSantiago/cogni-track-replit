---
id: documentation
title: Documentation Contribution Guide
description: Standards and workflows for contributing to the CogniTrack Docusaurus site.
---

CogniTrack documentation lives alongside the product code so engineers can propose updates via the same pull request workflow. This guide covers how to run the docs locally, structure content, and submit high-quality updates.

## Local Development

1. Install dependencies (once per machine):
   ```bash
   npm install --prefix docs-site
   ```
2. Start the Docusaurus dev server:
   ```bash
   npm run docs
   ```
   The command proxies into the `docs-site` workspace and launches a hot-reloading server at `http://localhost:3000`.
3. Stop the server with `Ctrl + C` when you are done previewing changes.

> **Tip:** Need to iterate on the Next.js app and docs simultaneously? Run `npm run dev` in one terminal and `npm run docs` in another.

## Information Architecture

- **Product**: Vision, roadmaps, and PRDs for CogniTrack initiatives.
- **Architecture**: System diagrams, schema references, and detailed implementation plans.
- **Operations**: Runbooks, on-call guides, and security/compliance procedures.
- **Contributing**: Process guidance (this section) and review checklists.

Use the existing categories in `docs-site/sidebars.ts` to decide where a new page belongs. When creating new folders, prefer kebab-case names to match import paths.

## Writing Standards

- Each page must include frontmatter with `id`, `title`, and `description` fields.
- Start the body with context (who the doc is for, why it exists) before diving into steps or reference material.
- Keep headings in sentence case (e.g., `## Data ingestion workflow`).
- Link to other docs using relative paths, for example `[schema plan](../architecture/openai-admin-migration-design.md)`.
- Use callouts (`:::note`, `:::tip`, etc.) for important warnings or context.
- Tables should include headers and align with Markdown pipe syntax supported by Docusaurus.

## Review Expectations

1. Open a PR that includes both the Markdown changes and any supporting assets (images, diagrams, etc.).
2. Add `docs` to the PR labels so the release captain knows documentation updates are included.
3. Include screenshots or GIFs when documenting UI changes.
4. Request reviews from at least one subject-matter expert and one maintainer of the docs site.
5. Verify `npm run docs:build` succeeds locally if you introduce new MDX features or change configuration.

## Glossary & Metadata

- Add shared terminology to `docs-site/src/data/glossary.json` (create the file if missing) and reference it using consistent language across pages.
- Use the `description` frontmatter to seed future SEO/search integrations (Algolia DocSearch, etc.). Keep it under 160 characters.
- Tag blog posts under `docs-site/blog/` with authorship and keywords in the frontmatter to enable future filtering.

Maintaining crisp, accurate docs is part of the Definition of Done. If you spot outdated guidance, update it or file an issue so the docs stay trusted.
