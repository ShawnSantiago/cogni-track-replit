---
id: prd
title: LLM API Usage Tracker PRD
sidebar_label: Product Requirements
description: Product requirements for the CogniTrack MVP that monitors LLM API usage and costs.
---

**Version:** 1.0  
**Date:** September 24, 2025  
**Status:** Draft

## Introduction & Problem Statement

Developers and teams using Large Language Models (LLMs) from various providers (like OpenAI, Anthropic, etc.) lack a simple, centralized dashboard to track their API usage and estimated costs. This fragmentation makes it difficult to monitor spending, analyze usage patterns, and manage API keys securely. This document outlines the requirements for a Minimum Viable Product (MVP) to solve this core problem.

## Objective & Goal

The primary goal is to **launch a functional MVP of the usage tracker within a single development sprint (5 days)**. This product will allow a user to connect one provider's API key and view their recent usage on a simple dashboard. Success is defined by onboarding at least 5 beta users who can successfully connect a key and see accurate, daily-updated usage data.

## Scope

### In Scope (MVP Features)

- **User Authentication:** Secure user sign-up and login via Clerk.
- **API Key Management:** Ability for a user to add, validate, and store a single provider API key (OpenAI). Keys must be encrypted at rest.
- **Automated Usage Fetching:** A daily scheduled job to pull the last 24 hours of usage data for each connected key.
- **Dashboard UI:**
  - A summary card showing total estimated spend and token count for the current cycle.
  - A 7-day line chart visualizing usage over time.
  - A table displaying the last 100 usage events.
  - A function to export the usage event table as a CSV file.
- **Basic States:** The UI must handle loading, empty, and error states.

### Out of Scope (Post-MVP)

- Support for multiple API providers (Anthropic, Gemini, etc.).
- Team/organization accounts and multi-user access.
- Hourly or real-time data refreshes.
- Advanced dashboard filtering (by model, date range, etc.).
- Row-Level Security (RLS) in the database.
- Email notifications (e.g., for invalid keys).

## User Stories

1. **Authentication:** As a developer, I want to sign up and log in securely using my email or social account so that my data is protected.
2. **Key Management:** As a user, I want to securely add my OpenAI API key on a settings page so the application can track my usage.
3. **Data Ingestion:** As a user, I want my API usage data to be automatically fetched and updated every day so I can see the latest information without manual intervention.
4. **Dashboard Visualization:** As a user, I want to view a dashboard with simple charts and totals so I can quickly understand my recent usage and estimated costs.
5. **Data Export:** As a user, I want to export my raw usage data as a CSV file so I can perform my own offline analysis.

## Recommended Technical Stack (Fastest Path)

This stack is chosen for its minimal operational overhead, excellent developer experience, and speed of implementation.

- **Authentication:** Clerk (for pre-built auth UI and Next.js integration)
- **Hosting / Frontend:** Vercel (for seamless Next.js deployment)
- **Database:** Neon Postgres (for serverless, zero-maintenance Postgres)
- **Database ORM:** Drizzle ORM (for lightweight, type-safe DB access)
- **Scheduled Jobs:** Inngest or Vercel Cron (for simple, reliable job scheduling)

## High-Level Architecture Flow

1. A user signs in through a Clerk-managed UI.
2. The Next.js application, hosted on Vercel, uses Clerk middleware to protect all `/app` and `/api` routes.
3. On the settings page, the user submits their OpenAI API key. The Next.js API route encrypts the key using a server-side-only master key (from Vercel environment variables) and stores it in the Neon Postgres database via Drizzle.
4. Once daily, an Inngest or Vercel Cron job triggers a serverless function.
5. The function queries the database for all users with valid keys, decrypts each key, fetches usage data from the provider's API, and stores the normalized data in a `usage_events` table.
6. When the user loads the dashboard, the Next.js frontend calls an API route that queries the `usage_events` table (scoped to the `userId`) to populate the charts and tables.

## MVP Implementation Plan (5-Day Sprint)

- **Day 1: Platform & Schema**
  - Set up Clerk for authentication and protect routes with middleware.
  - Provision a Neon Postgres database.
  - Define the DB schema (users, `provider_keys`, `usage_events`) with Drizzle and run initial migrations.
- **Day 2: Key Management**
  - Build the settings page UI to add one provider key (OpenAI).
  - Implement the server-side logic to encrypt and save the key upon submission. Include a basic validation check.
- **Day 3: Data Fetching**
  - Set up an Inngest/Vercel Cron job.
  - Write the core fetcher logic to pull 24 hours of usage for a single user and write it to the `usage_events` table.
- **Day 4: Dashboard Build**
  - Build the dashboard UI: summary card, 7-day chart, and event table.
  - Implement the CSV export functionality.
- **Day 5: Polish & Beta**
  - Add loading, empty, and error states to the UI.
  - Include a clear disclaimer that costs are "estimates."
  - Deploy to production and invite 5 beta users for feedback.

## Key Risks & Assumptions

- **Risk:** Provider API rate limits may disrupt usage fetchers. _Mitigation:_ Implement basic backoff logic in the job.
- **Risk:** Cost estimations may not perfectly match the provider's official invoice. _Mitigation:_ Clearly label all costs as "estimates."
- **Assumption:** Users are comfortable providing their API keys to a third-party service. _Mitigation:_ Be transparent about encryption and security practices.

## Success Metrics

- **Activation:** ≥ 5 beta users have successfully signed up and connected a valid API key.
- **Engagement:** At least 80% of beta users have usage data populated on their dashboard within 24 hours of adding a key.
- **Stability:** The daily data fetching job has a >99% success rate over the first week.
