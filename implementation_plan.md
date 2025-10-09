# Implementation Plan

[Overview]
Elevate the Analytics and Dashboard UX to be accessible, semantically correct, and visually consistent with the design token system while preserving existing functionality and performance.

This phase focuses on correcting information hierarchy, improving accessibility (landmarks, aria, keyboard support, focus management), aligning component styling with tokens, and standardizing empty/filtered states. The approach is component-scoped, with minimal architectural change. We will also add lightweight accessibility checks and visual validation to reduce regressions. Where current components already meet standards, we will codify them via tests and small refinements (e.g., focus and aria-live feedback on filter actions).

[Types]
Introduce small type reinforcements in filter state to reduce UI edge cases and improve readability.

Add/adjust TypeScript shapes:
- File: src/components/AdvancedFilters.tsx
  - Interface UsageFilterOptions
    - dateRange: { start: string; end: string; }  // ISO yyyy-mm-dd
    - providers: string[]
    - models: string[]
    - projects: string[]
    - apiKeys: string[]
    - serviceTiers: string[]
  - Validation rules:
    - start <= end when both present (ignore if either blank)
    - arrays deduplicated on change
- File: src/components/FilterableAnalyticsDashboard.tsx
  - Type UsageEventWithMetadata (already present in src/types/usage):
    - Ensure windowStart/windowEnd parsing uses UTC dates only for bucketing
    - Add helper functions:
      - getEventDate(e: UsageEventWithMetadata): Date (prefers windowStart; falls back to timestamp)
      - getEventDateKey(e): string (yyyy-mm-dd from UTC)
- File: src/components/UsageChart.tsx
  - Props: { data: Array<{ date: string; tokens: number; cost: number }>, type: 'tokens' | 'cost' }
  - Validation: coerce negatives to 0 in render path to avoid visual glitches

[Files]
We will modify existing files and add a small utility component to support skip navigation.

- New files to be created:
  - src/components/ui/SkipLink.tsx
    - Purpose: Visible-on-focus “Skip to content” link anchored to #main-content; improves keyboard/screen-reader navigation.

- Existing files to be modified:
  - src/app/layout.tsx
    - Add a visually hidden on-load “SkipLink” before header; give <main> an id="main-content".
  - src/app/analytics/page.tsx
    - Confirm/standardize <main className="container ..."> with aria-labelledby; ensure order: Overview KPIs → Charts → Filters → Alerts → Reports.
  - src/components/FilterableAnalyticsDashboard.tsx
    - Ensure section ids/aria-labelledby pairs exist and are unique; maintain KPIs-first order; add role="status" for filter counts; unify empty/filtered states.
  - src/components/AdvancedFilters.tsx
    - Expand/collapse button already semantic; add focus management on expand (focus panel region); add aria-live="polite" status text for Apply/Clear confirmations; guard dateRange validity.
  - src/components/UsageSummary.tsx
    - Neutralize KPI tiles to ensure contrast: retain bg-muted/40 and move accent coloration to numbers only; confirm headings hierarchy.
  - src/components/UsageChart.tsx
    - Use tokens for strokes and tooltip surfaces; ensure cost line uses accent (not muted) for contrast; verify tooltip contrast against popover tokens.
  - src/components/ui/NavMenu.tsx
    - Active state improvement: treat nested route matches (startsWith) as active; retain aria-current.

- Files to be deleted or moved:
  - None.

- Configuration file updates:
  - None required. Tailwind tokens already mapped to CSS variables in tailwind.config.js.

[Functions]
- New functions:
  - src/components/ui/SkipLink.tsx
    - export function SkipLink({ targetId = "main-content" }): JSX.Element
      - Renders: <a href={`#${targetId}`} className="sr-only focus:not-sr-only ...">Skip to content</a>

- Modified functions:
  - src/app/layout.tsx
    - RootLayout: insert <SkipLink /> at top of <body>, add id="main-content" to main content wrapper.
  - src/components/FilterableAnalyticsDashboard.tsx
    - add active filter status region with role="status", aria-live="polite"
    - ensure all section headings use h2 (Overview/Trends/Filters/Alerts/Reports) with matching aria-labelledby
  - src/components/AdvancedFilters.tsx
    - applyFilters(): after state update, announce via aria-live region; optionally move focus to top of results region
    - clearAllFilters(): announce cleared via aria-live region
    - on expand toggle: when expanded, programmatically focus the region container (ref.focus()) for keyboard continuity
    - add date validation (ignore apply when start > end; show inline message)
  - src/components/UsageChart.tsx
    - select strokeColor by tokens: primary; cost: accent (hsl(var(--accent))); ensure tooltip surfaces use popover tokens; clamp negatives
  - src/components/UsageSummary.tsx
    - retain neutral surfaces; ensure numeric emphasis via text-primary only; audit text-muted-foreground usage for contrast
  - src/components/ui/NavMenu.tsx
    - isActive = pathname === href || (href !== "/" && pathname.startsWith(href))

- Removed functions:
  - None.

[Classes]
- New classes:
  - .sr-only / focus-visible variants already available; use utility: "sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
- Modified classes:
  - AdvancedFilters chip classes to maintain aria-pressed states with neutral inactive tokens (already implemented); ensure contrast on active states
  - UsageChart container and tooltip classes to ensure popover tokens and border tokens applied
  - UsageSummary tiles keep bg-muted/40 + border-border/60; numbers with text-primary

[Dependencies]
No required runtime dependencies.

Optional dev dependencies (if automated a11y tests are desired in a separate task):
- jest-axe or axe-core (node-based a11y checks)
- @testing-library/react (if adding component-level a11y tests)
Note: Current repo uses tsx test runner; introducing a new test harness would be a separate phase.

[Testing]
Manual and lightweight validation for this phase:
- Keyboard navigation:
  - Tab sequence: SkipLink → Nav → main overview → charts → filters …
  - Expand Advanced Filters: focus moves into region; Escape or collapse returns focus to toggle
  - Filter chips toggle via Space/Enter; aria-pressed reflects state
- Screen reader checks:
  - aria-live messages for “Filters updated ✓” and “Filters cleared”
  - headings map: page h1, section h2, no skipped levels
- Visual checks:
  - Contrast of KPI tiles, charts, and tooltips in both light/dark themes
  - Empty/filtered states maintain tokenized surfaces (bg-card/muted, border-border)
- Quick scripts:
  - Add a temporary page-level console assertion (development only) that warns if start > end on filters

[Implementation Order]
1) Layout scaffolding
   - Add SkipLink component and wire into src/app/layout.tsx
   - Add id="main-content" to the main content wrapper
2) Analytics semantics & order
   - Verify/adjust src/app/analytics/page.tsx section order and aria-labelledby
   - Ensure KPIs → charts → filters → alerts → reports sequence
3) Filters accessibility
   - In AdvancedFilters: focus management on expand; aria-live messages on apply/clear; dateRange validation & message
   - Maintain chip aria-pressed states and neutral inactive styles
4) Visual alignment
   - UsageSummary tiles: confirm neutral backgrounds; emphasize numbers with text-primary
   - UsageChart: accent color for cost line; ensure tooltip uses popover tokens and border tokens; clamp negative values
5) Navigation feedback
   - NavMenu: nested route isActive support via startsWith; retain aria-current
6) Empty/filtered states standardization
   - Unify role="status" and token-based surfaces for empty and “no data with filters” cases
7) Validation pass
   - Manual a11y sweep (keyboard + SR)
   - Light/dark theme visual pass; confirm contrast on chart lines and tooltips
8) Documentation & clean-up
   - Add brief notes in memorybank/daily_usage_progress.md about UX changes and a11y validations
