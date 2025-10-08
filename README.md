# CogniTrack

CogniTrack is an internal dashboard for monitoring Large Language Model (LLM) API usage and estimated spend. The repository includes both the Next.js product surface and a companion Docusaurus site that houses product, architecture, and operations documentation.

## Getting started

### Prerequisites

- [Node.js 20.18.1](https://nodejs.org/) (see [`.nvmrc`](.nvmrc) for the pinned runtime used in CI).

### Application

```bash
npm install
npm run dev
```

The development server runs on [http://localhost:3000](http://localhost:3000). Environment variables for authentication, database access, and API integrations are managed through `.env.local` (see project docs for details).

### Documentation

```bash
npm install --prefix docs-site
npm run docs
```

The docs command proxies into the `docs-site` workspace and launches Docusaurus on [http://localhost:3000](http://localhost:3000). Update content under `docs-site/docs/` and refer to the [documentation contribution guide](docs-site/docs/contributing/documentation.md) for structure and review expectations.

## Project structure

- `src/` — Next.js application code.
- `docs-site/` — Docusaurus workspace for product and engineering documentation.
- `docs/` — Legacy markdown notes migrated into the Docusaurus site during Phase 2; new docs should live under `docs-site/`.
- `drizzle/` — Database migrations and snapshots.
- `tests/` — Automated test suites and fixtures.

## Documentation

The canonical knowledge base lives in the Docusaurus site. Start with the [product requirements](docs-site/docs/product/prd.md) and [architecture overview](docs-site/docs/architecture/overview.md), then explore operations runbooks and security guidance. Contributions are welcome—see the [guide for documentation updates](docs-site/docs/contributing/documentation.md).
