# @shapeshift-labs/frontier-loom-ui

Full-height dark operator UI for Loom and Frontier swarm runs.

The UI reads the dashboard snapshot API from `@shapeshift-labs/frontier-swarm-codex`. It does not parse swarm internals directly, and the browser surface is read-only: it focuses on run health, lane selection, jobs, evidence/admission status, recent events, and loaded sources.

The overview and success views surface landed/applied ledger counts, run health, token load, and timing summaries with compact dark cards. The metrics view includes small, dependency-free dark chart primitives for API-provided run health, bucketed time-series progress, context/token load, failure and ownership pressure, and semantic admission counts when those fields are present in the snapshot. Older snapshots still render from jobs and events as a fallback. The page remains full-height with scroll-contained panels so dense runs do not push the document body.

```sh
frontier-loom-ui --run agent-runs/my-run
frontier-loom-ui --collection agent-runs/my-run/collected
frontier-loom-ui --continuation agent-runs/my-run/continuation
```

Loom can launch the same package:

```sh
loom ui --collection agent-runs/my-run/collected
loom swarm dashboard --run agent-runs/my-run
```

The browser app is rendered with Frontier DOM JSX via `@shapeshift-labs/frontier-dom/jsx-runtime`; `frontier.config.mjs` declares the Frontier Framework surface and route evidence. The app frame separates API availability from run health, so an online dashboard with rejected or attention-needed jobs is shown as an online service with run issues rather than as an offline UI.

## Near-term UI Backlog

- `History`: a read-only git-style graph of worker outputs, coordinator joins, semantic replay outcomes, and landed changes. The tab should focus on the visual graph first, with hover/details for ticket id, files, evidence, tests, model/panel result, and acceptance or rejection reason.
- `Performance`: a chart-first view of tokens, runtime, cache hit rate, waste, and outcome quality over time. This needs a charting-library research pass before implementation, and should include whether panel, tournament, or RSI routing changes are improving workflow efficiency across runs.
- `Testing`: a high-level quality view for active work and the broader project. It should show pass/fail state, fuzzing results, oracle coverage, recent failures, and whether each active task has enough verification evidence. Raw run artifacts should remain ticket drill-downs rather than becoming the top-level tab.
