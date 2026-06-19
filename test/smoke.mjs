import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createLoomUiViewManifest, startLoomUiServer } from '../dist/index.js';

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'frontier-loom-ui-'));
const collectionDir = path.join(tmp, 'collected');
const continuationDir = path.join(tmp, 'continuation');
const activeRunDir = path.join(tmp, 'active-run');
const lifetimeCurrentDir = path.join(tmp, 'agent-runs', 'lifetime-dedupe-run', 'collected-current');
const lifetimeResolvedDir = path.join(tmp, 'agent-runs', 'lifetime-dedupe-run', 'collected-resolved');
const lifetimeDrainedRunDir = path.join(tmp, 'agent-runs', 'drained-autonomous-run', 'run-1');
const lifetimeDrainedCollectionDir = path.join(lifetimeDrainedRunDir, 'auto-drain', 'collection-01-post-apply');
const lifetimeDirtySkipRunDir = path.join(tmp, 'agent-runs', 'dirty-autodrain-run', 'run-1');
const lifetimeRedrainCollectionDir = path.join(tmp, 'agent-runs', 'redrain-regression-run', 'collection-01');
const lifetimeRedrainLedgerDir = path.join(tmp, 'agent-runs', 'redrain-regression-run-redrain-01');
const queueDir = path.join(tmp, '.loom', 'queues', 'capacity-proof');
await fs.mkdir(collectionDir, { recursive: true });
await fs.mkdir(continuationDir, { recursive: true });
await fs.mkdir(path.join(activeRunDir, 'active-live', 'evidence'), { recursive: true });
await fs.mkdir(path.join(activeRunDir, 'active-done', 'evidence'), { recursive: true });
await fs.mkdir(lifetimeCurrentDir, { recursive: true });
await fs.mkdir(lifetimeResolvedDir, { recursive: true });
await fs.mkdir(lifetimeDrainedCollectionDir, { recursive: true });
await fs.mkdir(lifetimeDirtySkipRunDir, { recursive: true });
await fs.mkdir(lifetimeRedrainCollectionDir, { recursive: true });
await fs.mkdir(lifetimeRedrainLedgerDir, { recursive: true });
await fs.mkdir(queueDir, { recursive: true });
await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
await fs.writeFile(path.join(tmp, 'src', 'board.ts'), [
  'export const oldBoard = true;',
  'export const taskTickets = true;',
  'export const fileDiffs = true;',
  ''
].join('\n'));
await fs.writeFile(path.join(collectionDir, 'ui-evidence.json'), JSON.stringify({ ok: true, proof: 'linked evidence' }, null, 2) + '\n');
const patchPath = path.join(collectionDir, 'ui-job.patch');
await fs.writeFile(patchPath, [
  'diff --git a/src/board.ts b/src/board.ts',
  'index 1111111..2222222 100644',
  '--- a/src/board.ts',
  '+++ b/src/board.ts',
  '@@ -1,2 +1,3 @@',
  ' export const oldBoard = true;',
  '-export const staleBoard = true;',
  '+export const taskTickets = true;',
  '+export const fileDiffs = true;',
  ''
].join('\n'));
await fs.writeFile(path.join(collectionDir, 'collection.json'), JSON.stringify({
  ok: true,
  runDir: tmp,
  outDir: collectionDir,
  generatedAt: Date.now(),
  summary: {
    total: 3,
    'ready-to-apply': 1,
    'needs-human-port': 1,
    'failed-evidence': 1,
    'stale-against-head': 0,
    semanticImportExpectedCount: 2,
    semanticImportExpectedSatisfiedCount: 1,
    semanticImportCandidateCount: 3,
    semanticEditScriptAutoMergeCandidates: 1,
    semanticEditReplayAcceptedClean: 1,
    semanticEditReplayConflicts: 1,
    semanticEditAdmission: {
      statusCounts: { accepted: 2, blocked: 1 },
      autoMergeCandidateCount: 1,
      cleanEligibleCount: 1,
      portableCount: 1,
      cleanEligibleCandidateCount: 1
    },
    semanticEditScriptAdmission: {
      statusCounts: { clean: 1, conflict: 1 },
      autoMergeCandidateCount: 1,
      cleanEligibleCount: 1,
      portableCount: 1,
      cleanEligibleCandidateCount: 1
    },
    landed: 1,
    landedJobIds: ['ui-job'],
    applyLedger: {
      total: 1,
      applied: 1,
      committed: 0,
      skipped: 0,
      failed: 0,
      landed: 1
    }
  },
  dashboard: {
    humanActions: [{
      id: 'question-product-scope',
      code: 'Q-SCOPE',
      status: 'open',
      priority: 'important',
      type: 'question',
      title: 'Choose dashboard question scope',
      question: 'Should agent questions be shown for the whole run or only when they block the current goal?',
      detail: 'This is a product decision for the read-only dashboard, not a merge admission task.',
      why: 'The answer changes how quickly a human sees important questions without adding operational noise.',
      requestedAnswer: 'Answer with Q-SCOPE and either whole run or goal blockers.',
      defaultAction: 'Answer in Codex using Q-SCOPE.',
      askedBy: 'ux-review-worker',
      scope: 'product',
      options: [
        { label: 'Whole run', detail: 'Higher visibility, more noise.' },
        { label: 'Goal blockers', detail: 'Lower noise, easier focus.' }
      ]
    }, {
      id: 'concern-routing-settings',
      code: 'C-ROUTING',
      status: 'open',
      priority: 'info',
      type: 'concern',
      title: 'Routing setting should not render as a question',
      question: 'This concern must not create an answer textarea.',
      detail: 'Non-question human actions belong outside the focused Questions tab.',
      defaultAction: 'Do not answer from the Questions tab.',
      askedBy: 'routing-audit-worker',
      scope: 'settings'
    }, {
      id: 'question-resolved',
      code: 'Q-DONE',
      status: 'resolved',
      priority: 'important',
      type: 'question',
      title: 'Already resolved question',
      question: 'This resolved question should not render as open.',
      detail: 'Resolved questions must not create answer inputs.',
      defaultAction: 'No action needed.',
      askedBy: 'ux-review-worker',
      scope: 'product'
    }]
  },
  buckets: {
    'ready-to-apply': [{ bucket: 'ready-to-apply', jobId: 'ui-job', mergePath: 'merge-ui.json', outputDir: collectionDir, bundle: { jobId: 'ui-job', taskId: 'ui-task', lane: 'ui', status: 'completed', mergeReadiness: 'ready-to-apply', disposition: 'ready', patchPath, evidencePaths: ['ui-evidence.json'], reasons: [], commandsPassed: [{ command: 'npm test', summary: 'all smoke checks passed' }], commandsFailed: [], durationMs: 125000 } }],
    'needs-human-port': [{ bucket: 'needs-human-port', jobId: 'runtime-job', mergePath: 'merge-runtime.json', outputDir: collectionDir, bundle: { jobId: 'runtime-job', taskId: 'runtime-task', lane: 'runtime', status: 'completed', mergeReadiness: 'needs-port', disposition: 'needs-port', evidencePaths: ['runtime-evidence.json'], reasons: ['manual port required'], contextBudget: { status: 'warning', action: 'continue', measured: { promptBytes: 64000, estimatedInputTokens: 16000 }, usage: { inputTokens: 28000 }, warnings: ['actual input tokens 28000 exceeded warning budget 20000'], errors: [] } } }],
    'failed-evidence': [{ bucket: 'failed-evidence', jobId: 'review-job', mergePath: 'merge-review.json', outputDir: collectionDir, bundle: { jobId: 'review-job', taskId: 'review-task', lane: 'review', status: 'failed', mergeReadiness: 'blocked', disposition: 'blocked', evidencePaths: [], reasons: ['missing proof'] } }],
    'stale-against-head': []
  }
}, null, 2) + '\n');
await fs.writeFile(path.join(lifetimeCurrentDir, 'collection.json'), JSON.stringify({
  ok: false,
  generatedAt: Date.now() - 1000,
  summary: {
    total: 1,
    'needs-human-port': 1,
    'failed-evidence': 0
  },
  buckets: {
    'needs-human-port': [{
      bucket: 'needs-human-port',
      jobId: 'dedupe-job',
      bundle: {
        jobId: 'dedupe-job',
        taskId: 'dedupe-task',
        lane: 'dedupe',
        status: 'completed',
        mergeReadiness: 'patch-candidate',
        disposition: 'needs-port',
        evidencePaths: []
      }
    }]
  }
}, null, 2) + '\n');
await fs.writeFile(path.join(lifetimeResolvedDir, 'collection.json'), JSON.stringify({
  ok: true,
  generatedAt: Date.now(),
  summary: {
    total: 4,
    'resolved-review': 1,
    'ready-to-apply': 1,
    'stale-against-head': 1,
    'failed-evidence': 1,
    'needs-human-port': 0
  },
  buckets: {
    'resolved-review': [{
      bucket: 'resolved-review',
      jobId: 'dedupe-job',
      bundle: {
        jobId: 'dedupe-job',
        taskId: 'dedupe-task',
        lane: 'dedupe',
        status: 'completed',
        mergeReadiness: 'patch-candidate',
        disposition: 'accepted-applied',
        evidencePaths: []
      }
    }],
    'ready-to-apply': [{
      bucket: 'ready-to-apply',
      jobId: 'historical-ready',
      bundle: {
        jobId: 'historical-ready',
        taskId: 'historical-ready-task',
        lane: 'dedupe',
        status: 'completed',
        mergeReadiness: 'ready-to-apply',
        disposition: 'ready',
        evidencePaths: []
      }
    }],
    'stale-against-head': [{
      bucket: 'stale-against-head',
      jobId: 'historical-stale',
      bundle: {
        jobId: 'historical-stale',
        taskId: 'historical-stale-task',
        lane: 'dedupe',
        status: 'completed',
        mergeReadiness: 'stale-against-head',
        disposition: 'stale',
        evidencePaths: []
      }
    }],
    'failed-evidence': [{
      bucket: 'failed-evidence',
      jobId: 'historical-failed',
      bundle: {
        jobId: 'historical-failed',
        taskId: 'historical-failed-task',
        lane: 'dedupe',
        status: 'failed',
        mergeReadiness: 'blocked',
        disposition: 'failed',
        evidencePaths: []
      }
    }]
  }
}, null, 2) + '\n');
await fs.writeFile(path.join(lifetimeDrainedRunDir, 'swarm-results.json'), JSON.stringify({
  ok: true,
  outDir: lifetimeDrainedRunDir,
  run: {
    id: 'drained-run-proof',
    status: 'completed',
    jobs: [{
      id: 'drained-job',
      taskId: 'drained-task',
      title: 'Drained autonomous task',
      lane: 'drained',
      status: 'completed'
    }],
    results: [{
      jobId: 'drained-job',
      status: 'completed',
      startedAt: Date.now() - 1000,
      finishedAt: Date.now(),
      durationMs: 1000
    }]
  },
  proof: {
    summary: {
      jobCount: 1,
      completedCount: 1,
      failedCount: 0,
      blockedCount: 0
    }
  },
  autoDrain: {
    summary: {
      terminalCount: 1,
      committedDecisionCount: 1,
      remainingReadyCount: 0,
      blockedCount: 0,
      conflictBlockedCount: 0,
      humanBlockedCount: 0,
      humanBlockedDecisionCount: 0,
      rerunTaskCount: 0,
      rerunManifestTerminalState: 'drained'
    },
    finalGateSummary: {
      ok: true,
      state: 'not-configured',
      decisions: [{
        jobId: 'drained-job',
        taskId: 'drained-task',
        status: 'committed',
        reason: 'patch committed after git apply check'
      }]
    }
  },
  autoDrainArtifacts: {
    summary: {
      decisionCount: 1,
      committedDecisionCount: 1,
      remainingReadyCount: 0,
      rerunTaskCount: 0,
      rerunManifestTerminalState: 'drained'
    }
  }
}, null, 2) + '\n');
await fs.mkdir(path.join(lifetimeDrainedRunDir, 'drained-job'), { recursive: true });
await fs.writeFile(path.join(lifetimeDrainedRunDir, 'drained-job', 'last-message.md'), 'Drained autonomous task completed.\n');
await fs.writeFile(path.join(lifetimeDrainedRunDir, 'pids.json'), JSON.stringify({
  kind: 'frontier.swarm-codex.pid-manifest',
  version: 1,
  runId: 'drained-run-proof',
  entries: [
    { pid: process.pid, role: 'parent', runId: 'drained-run-proof', startedAt: Date.now() - 1000 },
    { pid: 99999998, role: 'codex', jobId: 'drained-job', startedAt: Date.now() - 1000 }
  ]
}, null, 2) + '\n');
await fs.writeFile(path.join(lifetimeDrainedRunDir, 'swarm-plan.json'), JSON.stringify({
  jobs: [{
    id: 'drained-job',
    taskId: 'drained-task',
    title: 'Drained autonomous task',
    lane: 'drained',
    compute: { id: 'codex.proof', model: 'gpt-5.5' },
    task: { id: 'drained-task', title: 'Drained autonomous task', lane: 'drained' }
  }],
  graph: {
    nodes: ['drained-job'],
    edges: [],
    dependentsByJobId: { 'drained-job': [] },
    dependenciesByJobId: { 'drained-job': [] },
    roots: ['drained-job'],
    leaves: ['drained-job'],
    issues: []
  }
}, null, 2) + '\n');
await fs.writeFile(path.join(lifetimeDrainedCollectionDir, 'collection.json'), JSON.stringify({
  kind: 'frontier.swarm-codex.collection',
  version: 1,
  ok: true,
  runDir: lifetimeDrainedRunDir,
  outDir: lifetimeDrainedCollectionDir,
  generatedAt: Date.now() + 1000,
  summary: {
    total: 1,
    'stale-against-head': 1
  },
  buckets: {
    'stale-against-head': [{
      bucket: 'stale-against-head',
      jobId: 'drained-job',
      bundle: {
        jobId: 'drained-job',
        taskId: 'drained-task',
        lane: 'drained',
        status: 'completed',
        mergeReadiness: 'stale-against-head',
        disposition: 'stale',
        evidencePaths: []
      }
    }]
  }
}, null, 2) + '\n');
await fs.writeFile(path.join(lifetimeDirtySkipRunDir, 'swarm-results.json'), JSON.stringify({
  ok: false,
  outDir: lifetimeDirtySkipRunDir,
  run: {
    id: 'dirty-skip-proof',
    status: 'completed',
    jobs: [{
      id: 'dirty-skip-job',
      taskId: 'dirty-skip-task',
      title: 'Dirty checkout delayed apply',
      lane: 'dirty-delay',
      status: 'completed'
    }],
    results: [{
      jobId: 'dirty-skip-job',
      status: 'completed',
      startedAt: Date.now() - 2000,
      finishedAt: Date.now() - 1000,
      durationMs: 1000
    }]
  },
  proof: {
    summary: {
      jobCount: 1,
      completedCount: 1,
      failedCount: 0,
      blockedCount: 0
    }
  },
  autoDrain: {
    ok: false,
    skippedReason: 'dirty-worktree',
    dirtyPaths: ['packages/frontier-swarm/src/index.ts'],
    generatedAt: Date.now() - 500,
    summary: {
      remainingReadyCount: 1,
      terminalCount: 0,
      blockedCount: 0,
      rerunManifestTerminalState: 'drained'
    }
  }
}, null, 2) + '\n');
await fs.writeFile(path.join(lifetimeRedrainCollectionDir, 'collection.json'), JSON.stringify({
  ok: false,
  generatedAt: Date.now() - 500,
  summary: {
    total: 1,
    'ready-to-apply': 1
  },
  buckets: {
    'ready-to-apply': [{
      bucket: 'ready-to-apply',
      jobId: 'redrain-job',
      bundle: {
        jobId: 'redrain-job',
        taskId: 'redrain-task',
        lane: 'redrain',
        status: 'completed',
        mergeReadiness: 'ready-to-apply',
        disposition: 'ready',
        evidencePaths: []
      }
    }]
  }
}, null, 2) + '\n');
await fs.writeFile(path.join(lifetimeRedrainLedgerDir, 'autonomous-merge-decisions.jsonl'), JSON.stringify({
  kind: 'frontier.swarm-codex.autonomous-merge-decision',
  version: 1,
  id: 'decision:redrain-job',
  jobId: 'redrain-job',
  taskId: 'redrain-task',
  queueItemIds: ['redrain-task'],
  status: 'committed',
  reason: 'patch committed and verification passed',
  finishedAt: Date.now() + 1500
}) + '\n');
await fs.writeFile(path.join(tmp, 'agent-runs', '.loom-ui-review-decisions.json'), JSON.stringify({
  decisions: [
    {
      jobId: 'historical-ready',
      taskId: 'historical-ready-task',
      status: 'applied',
      source: 'historical-review-drain-test',
      latestPath: 'agent-runs/lifetime-dedupe-run/collected-resolved/queue-overlay.json',
      decidedAt: new Date().toISOString()
    },
    {
      jobId: 'historical-stale',
      taskId: 'historical-stale-task',
      status: 'rerun',
      source: 'historical-review-drain-test',
      latestPath: 'agent-runs/lifetime-dedupe-run/collected-resolved/queue-overlay.json',
      decidedAt: new Date().toISOString()
    },
    {
      jobId: 'historical-failed',
      taskId: 'historical-failed-task',
      status: 'rejected',
      source: 'historical-review-drain-test',
      latestPath: 'agent-runs/lifetime-dedupe-run/collected-resolved/queue-overlay.json',
      decidedAt: new Date().toISOString()
    },
    {
      jobId: 'active-live',
      status: 'rejected',
      source: 'historical-review-drain-test',
      latestPath: 'agent-runs/some-old-run/auto-drain/collection-01/queue-overlay.json',
      decidedAt: new Date().toISOString()
    }
  ]
}, null, 2) + '\n');
await fs.writeFile(path.join(continuationDir, 'continuation.json'), JSON.stringify({
  ok: true,
  nextRoutingPolicy: { id: 'policy', defaultMode: 'fill' },
  nextBacklog: { id: 'backlog', entries: [{ id: 'follow-up' }], summary: { readyCount: 1 } },
  childBacklogPaths: ['backlog-children.json'],
  summary: {
    childBacklogEntryCount: 1,
    totalRoutingFeedbackCount: 1,
    routingPreferenceCount: 2,
    nextJobCount: 1,
    routingPreferences: { preferCount: 1, avoidCount: 1 },
    tournamentObservationCount: 1,
    tournamentRecommendationCount: 1
  }
}, null, 2) + '\n');
await fs.writeFile(path.join(queueDir, 'manifest.high-concurrency.json'), JSON.stringify({
  id: 'capacity-proof-manifest',
  title: 'Capacity proof manifest',
  compute: [{ id: 'codex.proof', model: 'gpt-5.5', maxConcurrency: 6 }],
  policy: { defaultCompute: 'codex.proof', defaultConcurrency: 6 },
  lanes: [
    { id: 'dedupe', title: 'Dedupe lane', layer: 'review', compute: 'codex.proof', maxConcurrency: 2 },
    { id: 'queued', title: 'Queued lane', layer: 'implementation', compute: 'codex.proof', maxConcurrency: 4 }
  ]
}, null, 2) + '\n');
await fs.writeFile(path.join(queueDir, 'tasks.remaining-proof.json'), JSON.stringify([
  { id: 'queued-task', title: 'Queued task', lane: 'queued', status: 'todo' },
  { id: 'dedupe-task', title: 'Dedupe follow-up', lane: 'dedupe', status: 'todo' }
], null, 2) + '\n');
const activeWorker = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', 'codex', 'active-live'], { stdio: 'ignore' });
assert.ok(activeWorker.pid);
await fs.writeFile(path.join(activeRunDir, 'pids.json'), JSON.stringify({
  kind: 'frontier.swarm-codex.pid-manifest',
  version: 1,
  runId: 'active-run-proof',
  entries: [
    { pid: process.pid, role: 'parent', runId: 'active-run-proof', startedAt: Date.now() - 120000 },
    { pid: activeWorker.pid, role: 'codex', jobId: 'active-live', startedAt: Date.now() - 90000, command: ['codex', 'active-live'] },
    { pid: 99999999, role: 'codex', jobId: 'active-done', startedAt: Date.now() - 180000 }
  ]
}, null, 2) + '\n');
await fs.writeFile(path.join(activeRunDir, 'active-done', 'last-message.md'), 'Completed active run proof.\n');
await fs.writeFile(path.join(activeRunDir, 'swarm-plan.json'), JSON.stringify({
  jobs: [
    { id: 'active-live', taskId: 'live-task', title: 'Live worker proof', lane: 'verification', compute: { id: 'codex.fast', model: 'gpt-5.5', reasoningEffort: 'medium' }, task: { id: 'live-task', title: 'Live worker proof', lane: 'verification' } },
    { id: 'active-done', taskId: 'done-task', title: 'Completed worker proof', lane: 'verification', compute: { id: 'codex.fast', model: 'gpt-5.5', reasoningEffort: 'medium' }, task: { id: 'done-task', title: 'Completed worker proof', lane: 'verification' } }
  ]
}, null, 2) + '\n');

const manifest = createLoomUiViewManifest();
assert.equal(manifest.id, 'frontier-loom-ui.dashboard');
assert.equal(manifest.metadata.theme, 'dark');
const cli = await import('../dist/cli.js');
assert.equal(typeof cli.runFrontierLoomUiCli, 'function');

const server = await startLoomUiServer({ cwd: tmp, collection: collectionDir, continuation: continuationDir });
try {
  const health = await fetchJson(new URL('/api/health', server.url));
  assert.equal(health.ok, true);
  assert.equal(health.service, 'frontier-loom-ui');

  const dashboard = await fetchJson(new URL('/api/dashboard', server.url));
  assert.equal(dashboard.ok, true);
  assert.equal(dashboard.summary.jobCount, 3);
  assert.equal(dashboard.summary.completedCount, 2);
  assert.equal(dashboard.summary.failedCount, 1);
  assert.equal(dashboard.summary.childBacklogEntryCount, 1);
  assert.equal(dashboard.summary.bucketCounts['needs-coordinator-review'], 1);
  assert.equal(dashboard.health.summary.jobCount, 3);
  assert.equal(dashboard.health.summary.healthyJobCount, 1);
  assert.equal(dashboard.health.summary.warningJobCount, 1);
  assert.equal(dashboard.health.summary.failedJobCount, 1);
  assert.equal(dashboard.timeSeries.bucketMs, 60000);
  assert.equal(dashboard.timeSeries.summary.missingTimestampJobCount, 3);
  assert.equal(dashboard.semantic.import.expectedCount, 2);
  assert.equal(dashboard.semantic.replay.acceptedCleanCount, 1);
  assert.equal(dashboard.semantic.admission.jobs.statusCounts.accepted, 2);
  assert.ok(Array.isArray(dashboard.humanActions));
  assert.equal(dashboard.humanActions.length, 2);
  assert.deepEqual(dashboard.humanActions.map((action) => action.code).sort(), ['C-ROUTING', 'Q-SCOPE']);
  assert.equal(dashboard.humanActions[0].code, 'Q-SCOPE');
  assert.equal(dashboard.humanActions[0].question, 'Should agent questions be shown for the whole run or only when they block the current goal?');

  const activeServer = await startLoomUiServer({ cwd: tmp, run: activeRunDir });
  try {
    const activeDashboard = await fetchJson(new URL('/api/dashboard', activeServer.url));
    assert.equal(activeDashboard.ok, true);
    assert.equal(activeDashboard.summary.jobCount, 2);
    assert.equal(activeDashboard.summary.runningCount, 1);
    assert.equal(activeDashboard.summary.completedCount, 1);
    assert.equal(activeDashboard.jobs[0].model, 'gpt-5.5');
    const liveJob = activeDashboard.jobs.find((job) => job.id === 'active-live' || job.jobId === 'active-live');
    assert.ok(liveJob);
    assert.equal(liveJob.status, 'running');
    assert.notEqual(liveJob.bucket, 'review-resolved');
    assert.match(activeDashboard.sources.activeRun, /pids\.json$/);
  } finally {
    await activeServer.close();
  }
  const lifetimeServer = await startLoomUiServer({ cwd: tmp });
  try {
    const lifetimeDashboard = await fetchJson(new URL('/api/dashboard', lifetimeServer.url));
    assert.equal(lifetimeDashboard.kind, 'frontier.loom-ui.lifetime-dashboard');
    assert.ok(lifetimeDashboard.sources.sourceCount >= 2);
    assert.ok(lifetimeDashboard.sources.loadedSourceCount >= 1);
    assert.equal(lifetimeDashboard.sources.queueSourceCount, 1);
    assert.equal(lifetimeDashboard.summary.jobCount, 7);
    assert.equal(lifetimeDashboard.summary.coordinationDelayCount, 1);
    assert.equal(lifetimeDashboard.summary.dirtyAutoDrainSkipCount, 1);
    assert.equal(lifetimeDashboard.summary.bucketCounts?.['needs-coordinator-review'] ?? 0, 0);
    assert.equal(lifetimeDashboard.summary.bucketCounts?.['ready-to-apply'] ?? 0, 0);
    assert.equal(lifetimeDashboard.summary.bucketCounts?.['stale-against-head'] ?? 0, 0);
    assert.equal(lifetimeDashboard.summary.bucketCounts?.['failed-evidence'] ?? 0, 0);
    assert.equal(lifetimeDashboard.summary.bucketCounts?.['review-resolved'] ?? 0, 5);
    assert.equal(lifetimeDashboard.health.summary.readyToApplyJobCount, 0);
    assert.equal(lifetimeDashboard.health.summary.failedJobCount, 0);
    const dedupeJob = lifetimeDashboard.jobs.find((job) => job.originalJobId === 'dedupe-job');
    assert.ok(dedupeJob);
    assert.match(dedupeJob.sourceLabel, /collected-resolved/);
    assert.equal(lifetimeDashboard.jobs.find((job) => job.originalJobId === 'historical-ready').bucket, 'review-resolved');
    assert.equal(lifetimeDashboard.jobs.find((job) => job.originalJobId === 'historical-stale').bucket, 'review-resolved');
    assert.equal(lifetimeDashboard.jobs.find((job) => job.originalJobId === 'historical-failed').bucket, 'review-resolved');
    const drainedJob = lifetimeDashboard.jobs.find((job) => job.originalJobId === 'drained-job');
    assert.ok(drainedJob);
    assert.equal(drainedJob.status, 'completed');
    assert.notEqual(drainedJob.bucket, 'stale-against-head');
    const redrainJob = lifetimeDashboard.jobs.find((job) => job.originalJobId === 'redrain-job');
    assert.ok(redrainJob);
    assert.equal(redrainJob.status, 'completed');
    assert.equal(redrainJob.bucket, 'review-resolved');
    assert.equal(redrainJob.coordinatorDecisionStatus, 'committed');
    const dirtySkipJob = lifetimeDashboard.jobs.find((job) => job.originalJobId === 'dirty-skip-job');
    assert.ok(dirtySkipJob);
    assert.equal(dirtySkipJob.status, 'completed');
    assert.equal(dirtySkipJob.coordinationDelay, 'apply-delayed-by-dirty-worktree');
    assert.equal(dirtySkipJob.autoDrainSkippedReason, 'dirty-worktree');
    assert.equal(lifetimeDashboard.raw.lifetime.autoDrainDelays.length, 1);
    assert.equal(lifetimeDashboard.capacity.manifestId, 'capacity-proof-manifest');
    assert.equal(lifetimeDashboard.capacity.maxConcurrency, 6);
    assert.equal(lifetimeDashboard.capacity.openLaneCount, 1);
    assert.equal(lifetimeDashboard.capacity.queuedTaskCount, 1);
    assert.equal(lifetimeDashboard.capacity.lanes.find((lane) => lane.id === 'dedupe').completedCount, 4);
    assert.equal(lifetimeDashboard.capacity.lanes.find((lane) => lane.id === 'queued').queuedTaskCount, 1);
  } finally {
    await lifetimeServer.close();
  }
  assert.deepEqual(dashboard.lanes.map((lane) => lane.id), ['review', 'runtime', 'ui']);
  assert.equal(dashboard.jobs.find((job) => job.id === 'runtime-job').bucket, 'needs-coordinator-review');
  assert.equal(dashboard.jobs.find((job) => job.id === 'review-job').status, 'failed');
  const taskDetails = await fetchJson(new URL('/api/task-details?id=ui-job', server.url));
  assert.equal(taskDetails.ok, true);
  assert.equal(taskDetails.jobId, 'ui-job');
  assert.equal(taskDetails.files.length, 1);
  assert.equal(taskDetails.files[0].path, 'src/board.ts');
  assert.equal(taskDetails.files[0].additions, 2);
  assert.equal(taskDetails.files[0].deletions, 1);
  assert.match(taskDetails.files[0].diff, /taskTickets/);
  assert.equal(taskDetails.files[0].language, 'typescript');
  assert.equal(taskDetails.files[0].artifactPath, 'src/board.ts');
  assert.equal(taskDetails.files[0].hunks.some((hunk) => hunk.lines.some((line) => line.kind === 'add' && line.content.includes('taskTickets'))), true);
  assert.equal(taskDetails.evidenceArtifacts[0].label, 'ui-evidence.json');
  assert.equal(taskDetails.commandsPassed[0].command, 'npm test');
  const sourceArtifact = await fetchJson(new URL('/api/artifact?path=src%2Fboard.ts', server.url));
  assert.equal(sourceArtifact.ok, true);
  assert.equal(sourceArtifact.kind, 'file');
  assert.match(sourceArtifact.content, /fileDiffs/);
  const evidenceArtifact = await fetchJson(new URL('/api/artifact?path=ui-evidence.json', server.url));
  assert.equal(evidenceArtifact.ok, true);
  assert.match(evidenceArtifact.content, /linked evidence/);
  const rawArtifact = await fetchText(new URL('/api/artifact/raw?path=src%2Fboard.ts', server.url), 'application/javascript|application/octet-stream|text/plain');
  assert.match(rawArtifact, /taskTickets/);
  const revealArtifact = await fetchJson(new URL('/api/artifact/reveal', server.url), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: 'src/board.ts', dryRun: true })
  });
  assert.equal(revealArtifact.ok, true);
  assert.equal(revealArtifact.dryRun, true);
  assert.match(revealArtifact.revealedPath.replace(/\\/g, '/'), /src\/board\.ts$/);
  assert.equal(typeof revealArtifact.command, 'string');
  assert.equal(Array.isArray(revealArtifact.args), true);
  const answerResponse = await fetchJson(new URL('/api/human-actions/answer', server.url), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: 'Q-SCOPE', answer: 'Q-SCOPE goal blockers' })
  });
  assert.equal(answerResponse.ok, true);
  assert.equal(answerResponse.code, 'Q-SCOPE');
  const answerLog = await fs.readFile(path.join(collectionDir, 'human-action-answers.jsonl'), 'utf8');
  assert.match(answerLog, /"type":"human-action.answer"/);
  assert.match(answerLog, /Q-SCOPE goal blockers/);
  const answeredDashboard = await fetchJson(new URL('/api/dashboard', server.url));
  assert.equal(answeredDashboard.humanActionAnswers.length, 1);
  assert.equal(answeredDashboard.humanActionAnswers[0].code, 'Q-SCOPE');
  assert.match(answeredDashboard.humanActionAnswers[0].answer, /goal blockers/);
  assert.match(answeredDashboard.sources.humanActionAnswers.replace(/\\/g, '/'), /human-action-answers\.jsonl$/);
  const streamText = await fetchStreamPrefix(new URL('/api/dashboard/stream', server.url));
  assert.match(streamText, /data: /);
  assert.match(streamText, /"ok":true/);
  assert.match(streamText, /humanActionAnswers/);
  const idleStreamText = await fetchStreamWindow(new URL('/api/dashboard/stream', server.url), 2600);
  assert.equal((idleStreamText.match(/^data: /gm) ?? []).length, 1);
  const liveStreamText = await fetchStreamAfterInitialData(
    new URL('/api/dashboard/stream', server.url),
    async () => {
      const liveAnswer = await fetchJson(new URL('/api/human-actions/answer', server.url), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'Q-STREAM', answer: 'Q-STREAM live update proof' })
      });
      assert.equal(liveAnswer.ok, true);
    },
    'Q-STREAM live update proof',
    4500
  );
  assert.ok((liveStreamText.match(/^data: /gm) ?? []).length >= 2);
  assert.match(liveStreamText, /Q-STREAM live update proof/);

  const html = await fetchText(server.url, 'text/html');
  assert.match(html, /<div id="app"><\/div>/);
  assert.match(html, /href="\/styles.css"/);
  assert.match(html, /src="\/client.js"/);
  assert.match(html, /@shapeshift-labs\/frontier-dom\/jsx-runtime/);

  const styles = await fetchText(new URL('/styles.css', server.url), 'text/css');
  assert.match(styles, /100dvh/);
  assert.match(styles, /overflow: hidden/);
  assert.match(styles, /scrollbar-gutter: stable/);
  assert.match(styles, /table-layout: fixed/);
  assert.match(styles, /overflow-wrap: anywhere/);
  assert.match(styles, /operator-grid/);
  assert.match(styles, /quality-layout/);
  assert.match(styles, /quality-signal-list/);
  assert.match(styles, /timeline-layout/);
  assert.match(styles, /timeline-series-track/);
  assert.match(styles, /timeline-progress-track/);
  assert.match(styles, /bottleneck-row/);
  assert.match(styles, /chart-grid/);
  assert.match(styles, /overview-snapshot/);
  assert.match(styles, /snapshot-tile/);
  assert.match(styles, /pressure-grid/);
  assert.match(styles, /pressure-card/);
  assert.match(styles, /bar-fill\.warn/);
  assert.match(styles, /sparkline/);
  assert.match(styles, /health-summary/);
  assert.match(styles, /health-card\.warn/);
  assert.match(styles, /overview-card-scroll[\s\S]*overflow: auto/);
  assert.match(styles, /time-series-summary/);
  assert.match(styles, /metric-bar-fill\.good/);
  assert.match(styles, /contribution-card/);
  assert.match(styles, /contribution-day\.level-4/);
  assert.match(styles, /chart-popover/);
  assert.match(styles, /contribution-scroll[\s\S]*overflow-x: auto/);
  assert.match(styles, /contribution-card\.prominent/);
  assert.match(styles, /task-board-scroll[\s\S]*overflow-x: auto/);
  assert.match(styles, /grid-auto-flow: column/);
  assert.match(styles, /task-column-body[\s\S]*overflow-y: auto/);
  assert.match(styles, /touch-action: pan-x pan-y/);
  assert.match(styles, /task-modal-backdrop/);
  assert.match(styles, /task-dialog/);
  assert.match(styles, /task-id-copy/);
  assert.match(styles, /task-file-diff/);
  assert.match(styles, /diff-renderer/);
  assert.match(styles, /diff-line-add/);
  assert.match(styles, /diff-token\.keyword/);
  assert.match(styles, /artifact-link/);
	  assert.match(styles, /agent-work-layout/);
	  assert.match(styles, /swarm-capacity-panel/);
	  assert.match(styles, /swarm-capacity-summary/);
	  assert.match(styles, /swarm-lane-strip/);
	  assert.match(styles, /swarm-lane-row/);
	  assert.match(styles, /agent-roster-panel/);
  assert.match(styles, /agent-roster-head/);
  assert.match(styles, /agent-worker-card/);
  assert.match(styles, /agent-cell-agent/);
  assert.match(styles, /agent-cell-runtime/);
  assert.match(styles, /agent-model-pill/);
  assert.match(styles, /agent-task-row/);
  assert.match(styles, /agent-file-list/);
  assert.match(styles, /action-answer-form/);
  assert.doesNotMatch(styles, /box-shadow:\s*inset/);
  assert.doesNotMatch(styles, /border-left:/);
  assert.doesNotMatch(styles, /artifact-viewer/);
  assert.match(styles, /task-result-row/);
  assert.doesNotMatch(styles, /task-card\.failed[\s\S]{0,120}box-shadow: inset 3px/);
  assert.match(styles, /grid-auto-rows: minmax\(190px, auto\)/);
  assert.match(styles, /overview-grid \.panel[\s\S]*max-height: clamp\(190px, 28vh, 282px\)/);
  assert.match(styles, /overscroll-behavior: contain/);
  assert.match(styles, /max-height: clamp\(190px, 34vh, 300px\)/);
  assert.match(styles, /grid-template-rows: minmax\(34px, auto\) 50px minmax\(14px, auto\)/);
  assert.match(styles, /aligned-chart/);
  assert.match(styles, /contain: content/);
  assert.match(styles, /grid-template-columns: minmax\(140px, 1\.1fr\) minmax\(120px, 2\.4fr\) 84px/);
  assert.match(styles, /\.metric-bar-value/);
  assert.match(styles, /white-space: normal/);
  assert.match(styles, /width: var\(--contribution-cell\)/);
  assert.match(styles, /goal-progress-track/);
  assert.match(styles, /work-cost-metrics/);
  assert.match(styles, /work-layout/);
  assert.match(styles, /action-layout/);
  assert.match(styles, /performance-layout/);
  assert.match(styles, /performance-summary/);
  assert.match(styles, /optimization-signal-grid/);
  assert.match(styles, /optimization-behavior-grid/);
  assert.match(styles, /optimization-behavior-row/);
  assert.match(styles, /history-layout/);
  assert.match(styles, /git-history-viewport/);
  assert.match(styles, /git-graph-svg/);
  assert.match(styles, /git-graph-merge/);
  assert.match(styles, /git-history-row/);
  assert.match(styles, /testing-layout/);
  assert.match(styles, /testing-summary/);
  assert.match(styles, /testing-notice/);
  assert.match(styles, /testing-evidence-grid/);
  assert.match(styles, /spark-bars/);
  assert.match(styles, /efficiency-layout/);
  assert.match(styles, /merge-layout/);
  assert.match(styles, /evidence-layout/);
  assert.match(styles, /action-row/);
  assert.match(styles, /data-copy-code|action-code/);
  assert.doesNotMatch(styles, /action-options/);
  assert.doesNotMatch(styles, /action-scope/);
  assert.match(styles, /merge-flow/);
  assert.match(styles, /version-tree/);
  assert.match(styles, /simple-row/);

  const runtime = await fetchText(new URL('/vendor/frontier-dom/jsx-runtime.js', server.url), 'application/javascript');
  assert.ok(runtime.length > 0);

  const client = await fetchText(new URL('/client.js', server.url), 'application/javascript');
  assertBundleContains(client, [
    '/api/dashboard',
    '/api/dashboard/stream',
    '/api/task-details',
    '/api/artifact',
    '/api/artifact/reveal',
    '/api/human-actions/answer',
    'humanActionAnswers',
    'EventSource',
    'data-scroll-id',
    'data-copy-code',
    'role',
    'tablist',
    'aria-selected',
    'aria-controls',
    'Home',
    'captureScrollPositions',
    'Overview',
    'Board',
    'Swarm',
    'Performance',
    'History',
    'Testing',
    'Demo fixture',
    'Live run snapshot',
    'Active agents',
    'active agents',
    'agent-roster-panel',
    'agent-cell-agent',
    'agent-cell-runtime',
    'agent-model-pill',
    'agent-task-row',
    'agent-file-list',
    'action-answer-form',
    'Submit answer',
    'textarea',
    'AGENT_DESCRIPTION_WORDS',
    'AGENT_ANIMAL_NAMES',
    'hashchange',
    'ticket',
    'Goal',
    'goal-progress-track',
    'Task board',
    'AI tasks',
    'Backlog',
    'To do',
    'Copy ID',
    'Ticket',
    'Files changed',
    'diff-renderer',
    'diff-line-${line.kind}',
    'data-diff-renderer',
    'data-reveal-artifact-path',
    'in Finder',
    'task-file-diff',
    'task-id-copy',
    'data-contribution-grid',
    'data-task-card',
    'task-board-scroll',
    'task-column-body',
    'task-dialog',
    'aria-modal',
    'data-contribution-tooltip',
    'contribution-weeks',
    'chart-popover',
    'Questions for you',
    'Copy',
    'Questions',
    'data-human-question-code',
    'isExplicitAgentQuestion',
    'pruneResolvedHumanActionDrafts',
    'Progress by day',
    'January through December',
    'Calendar year',
    'Done signals',
    'Daily progress activity',
    'Token cost',
    'Token cost estimate',
    'Total input',
    'Uncached input',
    'Cached input',
    'Budget warnings',
    'Performance over time',
    'Y: ${entry.yLabel',
    'data-chart-tooltip',
    'MODEL_PRICES_PER_MILLION',
    'inputTokenBreakdownForJob',
    'gpt-5-chat-latest',
    'Estimated cost',
    'Optimization signals',
    'Workflow behavior trend',
    'optimization-behavior-grid',
    'Panel influence',
    'Tournament loop',
    'RSI routing loop',
    'Cache hit',
    'Waste signals',
    'Panel decisions',
    'Tournament signals',
    'RSI / routing feedback',
    'Version history',
    'git-history-viewport',
    'git-graph-svg',
    'git-graph-merge',
    'Merge state',
    'Quality status',
    'No testing metadata was reported',
    'Evidence mix',
    'Recent check output'
  ]);
  assert.doesNotMatch(client, /Read-only operator shell|Frontier swarm operations|selectedLane|selected lane|data-lane-filter|Lane efficiency|Lane load|Epics \/ task groups|Merge readiness|Quality gates|Agent questions only|Artifact viewer|action-options|action-scope/);
  assertNoOperatorSteeringSurface(`${html}\n${client}`);
} finally {
  await server.close();
  activeWorker.kill('SIGTERM');
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  assert.equal(response.ok, true);
  assert.match(response.headers.get('content-type') ?? '', /application\/json/);
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  return response.json();
}

async function fetchText(url, expectedContentType) {
  const response = await fetch(url);
  assert.equal(response.ok, true);
  if (expectedContentType) {
    assert.match(response.headers.get('content-type') ?? '', new RegExp(expectedContentType.replace('/', '\\/')));
  }
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  return response.text();
}

async function fetchStreamPrefix(url) {
  const controller = new AbortController();
  const response = await fetch(url, { signal: controller.signal });
  assert.equal(response.ok, true);
  assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);
  assert.ok(response.body);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  try {
    for (let index = 0; index < 5 && !text.includes('data: '); index += 1) {
      const result = await reader.read();
      if (result.done) break;
      text += decoder.decode(result.value, { stream: true });
    }
  } finally {
    controller.abort();
  }
  return text;
}

async function fetchStreamWindow(url, durationMs) {
  const controller = new AbortController();
  const response = await fetch(url, { signal: controller.signal });
  assert.equal(response.ok, true);
  assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);
  assert.ok(response.body);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const deadline = Date.now() + durationMs;
  let text = '';
  try {
    while (Date.now() < deadline) {
      const remaining = Math.max(0, deadline - Date.now());
      const result = await Promise.race([
        reader.read(),
        sleep(Math.min(remaining, 100)).then(() => undefined)
      ]);
      if (!result) continue;
      if (result.done) break;
      text += decoder.decode(result.value, { stream: true });
    }
  } finally {
    controller.abort();
  }
  return text;
}

async function fetchStreamAfterInitialData(url, action, marker, durationMs) {
  const controller = new AbortController();
  const response = await fetch(url, { signal: controller.signal });
  assert.equal(response.ok, true);
  assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);
  assert.ok(response.body);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const deadline = Date.now() + durationMs;
  let text = '';
  let actionStarted = false;
  try {
    while (Date.now() < deadline && !text.includes(marker)) {
      const remaining = Math.max(0, deadline - Date.now());
      const result = await Promise.race([
        reader.read(),
        sleep(Math.min(remaining, 100)).then(() => undefined)
      ]);
      if (result) {
        if (result.done) break;
        text += decoder.decode(result.value, { stream: true });
      }
      if (!actionStarted && text.includes('data: ')) {
        actionStarted = true;
        await action();
      }
    }
  } finally {
    controller.abort();
  }
  return text;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertBundleContains(client, markers) {
  for (const marker of markers) {
    assert.ok(client.includes(marker), `client bundle should contain ${marker}`);
  }
}

function assertNoOperatorSteeringSurface(surface) {
  for (const marker of [
    '/api/steering',
    'steering-form',
    'Steering',
    'Write steering intent',
    'Routing mode',
    'Max concurrency',
    'Lane focus',
    'Model tier',
    'Next-wave note'
  ]) {
    assert.ok(!surface.includes(marker), `operator surface should not include ${marker}`);
  }
}
