import { existsSync, watch, type FSWatcher } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { estimateCodexModelCost, readCodexDashboardSnapshot } from '@shapeshift-labs/frontier-swarm-codex';

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const HEALTH_JSON_PARSE_MAX_BYTES = 16 * 1024 * 1024;
const TASK_DETAIL_PATCH_MAX_BYTES = 512 * 1024;
const TASK_DETAIL_FILE_DIFF_MAX_CHARS = 24_000;
const ARTIFACT_VIEW_MAX_BYTES = 768 * 1024;
const ARTIFACT_DIRECTORY_MAX_ENTRIES = 200;
const HUMAN_ACTION_ANSWER_MAX_BYTES = 16 * 1024;
const CODEX_EVENTS_USAGE_MAX_BYTES = 8 * 1024 * 1024;
const DASHBOARD_SNAPSHOT_CACHE_MS = 5000;
const LIFETIME_DASHBOARD_MAX_SOURCES = 24;
const LIFETIME_DASHBOARD_MAX_JOBS = 800;
const LIFETIME_DASHBOARD_SCAN_MAX_FILES = 600;
const LIFETIME_DASHBOARD_SCAN_MAX_DEPTH = 5;
const LIFETIME_DASHBOARD_MAX_AUTONOMOUS_DECISION_FILES = 400;
const LIFETIME_DASHBOARD_MAX_DRAIN_RUNS = 6;
const LIFETIME_DASHBOARD_MAX_ACTIVE_PID_RUNS = 32;
const LIFETIME_DASHBOARD_MAX_QUEUE_TASKS = 500;
const LIFETIME_DASHBOARD_SOURCE_TIMEOUT_MS = 2500;
const LIFETIME_DASHBOARD_RESET_FILE = '.loom-ui-reset.json';
const REVIEW_DECISIONS_FILE = '.loom-ui-review-decisions.json';
const LIVE_RUN_GRAPH_EVENTS_FILE = 'live-run-graph-events.jsonl';
const dashboardStreamListeners = new Set<() => void>();

let dashboardSnapshotCache: {
  key: string;
  at: number;
  value?: unknown;
  pending?: Promise<unknown>;
} | undefined;

export interface FrontierLoomUiServerOptions {
  cwd?: string;
  run?: string;
  collection?: string;
  continuation?: string;
  host?: string;
  port?: number;
  staticDir?: string;
}

export type FrontierLoomUiHealthSourceStatus = 'not-configured' | 'ready' | 'missing' | 'invalid';

export interface FrontierLoomUiHealthSource {
  configured: boolean;
  status: FrontierLoomUiHealthSourceStatus;
  input?: string;
  file?: string;
  dir?: string;
  error?: string;
}

export interface FrontierLoomUiHealthResponse {
  ok: boolean;
  service: 'frontier-loom-ui';
  generatedAt: number;
  cwd: string;
  sources: {
    run: FrontierLoomUiHealthSource;
    collection: FrontierLoomUiHealthSource;
    continuation: FrontierLoomUiHealthSource;
  };
}

export interface FrontierLoomUiTaskFileDiff {
  path: string;
  additions: number;
  deletions: number;
  diff: string;
  language: string;
  artifactPath: string;
  hunks: FrontierLoomUiDiffHunk[];
  truncated: boolean;
}

export type FrontierLoomUiDiffLineKind = 'meta' | 'hunk' | 'context' | 'add' | 'delete';

export interface FrontierLoomUiDiffLine {
  kind: FrontierLoomUiDiffLineKind;
  oldLine?: number;
  newLine?: number;
  content: string;
}

export interface FrontierLoomUiDiffHunk {
  header: string;
  lines: FrontierLoomUiDiffLine[];
}

export interface FrontierLoomUiTaskArtifact {
  path: string;
  label: string;
  kind?: 'file' | 'directory' | 'missing';
}

interface CodexEventUsageSummary {
  inputTokens: number;
  cachedInputTokens: number;
  uncachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  estimatedInputTokens: number;
  estimatedFromEventBytes: number;
  eventCount: number;
}

type CoordinatorReviewDecision = Record<string, unknown>;

export interface FrontierLoomUiTaskDetailsResponse {
  ok: boolean;
  jobId: string;
  patchArtifact?: FrontierLoomUiTaskArtifact;
  files: FrontierLoomUiTaskFileDiff[];
  commandsPassed: Array<Record<string, unknown>>;
  commandsFailed: Array<Record<string, unknown>>;
  evidenceArtifacts: FrontierLoomUiTaskArtifact[];
  error?: string;
}

export interface FrontierLoomUiArtifactEntry {
  name: string;
  path: string;
  kind: 'file' | 'directory';
  size?: number;
}

export interface FrontierLoomUiArtifactResponse {
  ok: boolean;
  path: string;
  label: string;
  kind?: 'file' | 'directory';
  size?: number;
  contentType?: string;
  content?: string;
  truncated?: boolean;
  entries?: FrontierLoomUiArtifactEntry[];
  error?: string;
}

export interface FrontierLoomUiArtifactRevealResponse {
  ok: boolean;
  path: string;
  revealedPath?: string;
  command?: string;
  args?: string[];
  dryRun?: boolean;
  error?: string;
}

export interface FrontierLoomUiHumanActionAnswerResponse {
  ok: boolean;
  code: string;
  answerPath?: string;
  error?: string;
}

export interface FrontierLoomUiHumanActionAnswerRecord {
  type: 'human-action.answer';
  at: number;
  code: string;
  answer: string;
  source: 'frontier-loom-ui';
}

interface NormalizedLoomUiServerOptions extends FrontierLoomUiServerOptions {
  cwd: string;
  host: string;
  port: number;
  staticDir: string;
}

export interface FrontierLoomUiServer {
  server: http.Server;
  url?: string;
  close(): Promise<void>;
}

export interface FrontierLoomUiStartResult extends FrontierLoomUiServer {
  url: string;
}

export function createLoomUiServer(options: FrontierLoomUiServerOptions = {}): FrontierLoomUiServer {
  const normalized = normalizeServerOptions(options);
  const server = http.createServer(async (request, response) => {
    try {
      await handleRequest(request, response, normalized);
    } catch (error) {
      writeJson(response, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });
  return {
    server,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  };
}

export async function startLoomUiServer(options: FrontierLoomUiServerOptions = {}): Promise<FrontierLoomUiStartResult> {
  const normalized = normalizeServerOptions(options);
  const created = createLoomUiServer(normalized);
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      created.server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      created.server.off('error', onError);
      resolve();
    };
    created.server.once('error', onError);
    created.server.once('listening', onListening);
    created.server.listen(normalized.port, normalized.host);
  });
  const address = created.server.address();
  const actualPort = typeof address === 'object' && address ? address.port : normalized.port;
  return { ...created, url: `http://${formatUrlHost(normalized.host)}:${actualPort}/` };
}

async function handleRequest(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  options: NormalizedLoomUiServerOptions
): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (request.method === 'GET' && url.pathname === '/api/health') {
    writeJson(response, 200, await readHealth(options));
  } else if (request.method === 'GET' && url.pathname === '/api/dashboard/stream') {
    await streamDashboard(request, response, options);
  } else if (request.method === 'GET' && url.pathname === '/api/dashboard') {
    writeJson(response, 200, await readDashboardSnapshotCached(options));
  } else if (request.method === 'GET' && url.pathname === '/api/task-details') {
    writeJson(response, 200, await readTaskDetails(
      options,
      textValue(url.searchParams.get('id'), ''),
      textValue(url.searchParams.get('sourceRun'), '')
    ));
  } else if (request.method === 'GET' && url.pathname === '/api/artifact') {
    writeJson(response, 200, await readArtifact(options, textValue(url.searchParams.get('path'), '')));
  } else if (request.method === 'GET' && url.pathname === '/api/artifact/raw') {
    await serveArtifactRaw(response, options, textValue(url.searchParams.get('path'), ''));
  } else if (request.method === 'POST' && url.pathname === '/api/artifact/reveal') {
    const body = recordValue(await readJsonBody(request, 8 * 1024));
    writeJson(response, 200, await revealArtifactInFileManager(options, textValue(body.path, ''), Boolean(body.dryRun)));
  } else if (request.method === 'POST' && url.pathname === '/api/human-actions/answer') {
    const body = recordValue(await readJsonBody(request, HUMAN_ACTION_ANSWER_MAX_BYTES));
    writeJson(response, 200, await writeHumanActionAnswer(options, body));
  } else if (request.method === 'GET' && url.pathname === '/client.js') {
    await serveFile(response, path.join(packageDir, 'client.js'), 'application/javascript; charset=utf-8');
  } else if (request.method === 'GET' && url.pathname === '/vendor/frontier-dom/jsx-runtime.js') {
    await serveFile(response, resolveFrontierDomRuntime(), 'application/javascript; charset=utf-8');
  } else if (request.method === 'GET' && url.pathname === '/favicon.ico') {
    serveFavicon(response);
  } else if (request.method === 'GET') {
    const file = staticFile(options.staticDir, url.pathname);
    await serveFile(response, file, contentType(file));
  } else {
    writeJson(response, 405, { ok: false, error: 'method not allowed' });
  }
}

async function streamDashboard(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  options: NormalizedLoomUiServerOptions
): Promise<void> {
  response.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store, max-age=0',
    connection: 'keep-alive',
    pragma: 'no-cache',
    'x-accel-buffering': 'no'
  });
  response.write(': connected\n\n');

  let closed = false;
  let pending = false;
  let lastSignature = '';
  const send = async () => {
    if (closed || pending) return;
    pending = true;
    try {
      const snapshot = await readDashboardSnapshotCached(options);
      const signature = dashboardStreamSignature(snapshot);
      const body = JSON.stringify(snapshot);
      if (signature !== lastSignature) {
        lastSignature = signature;
        response.write(`data: ${body}\n\n`);
      }
    } catch (error) {
      response.write(`event: error\ndata: ${JSON.stringify({ ok: false, error: errorMessage(error) })}\n\n`);
    } finally {
      pending = false;
    }
  };

  const trigger = debounce(send, 120);
  const directTrigger = () => {
    void send();
  };
  const watchers = await createDashboardWatchers(options, trigger);
  dashboardStreamListeners.add(directTrigger);
  const tick = setInterval(trigger, 2000);
  const heartbeat = setInterval(() => {
    if (!closed) response.write(': heartbeat\n\n');
  }, 15000);
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(tick);
    clearInterval(heartbeat);
    dashboardStreamListeners.delete(directTrigger);
    for (const watcher of watchers) watcher.close();
    response.end();
  };

  request.on('close', close);
  response.on('close', close);
  await send();
}

function dashboardStreamSignature(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return JSON.stringify(snapshot);
  const { generatedAt: _generatedAt, ...stableSnapshot } = snapshot as Record<string, unknown>;
  return JSON.stringify(stableSnapshot);
}

function debounce(fn: () => void | Promise<void>, delayMs: number): () => void {
  let timer: NodeJS.Timeout | undefined;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void fn();
    }, delayMs);
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function createDashboardWatchers(options: NormalizedLoomUiServerOptions, onChange: () => void): Promise<FSWatcher[]> {
  const roots = await dashboardWatchRoots(options);
  const watchers: FSWatcher[] = [];
  for (const root of roots) {
    const recursive = watchDirectory(root, true, onChange);
    if (recursive) {
      watchers.push(recursive);
      continue;
    }
    const shallow = watchDirectory(root, false, onChange);
    if (shallow) watchers.push(shallow);
  }
  return watchers;
}

function watchDirectory(root: string, recursive: boolean, onChange: () => void): FSWatcher | undefined {
  try {
    return watch(root, { recursive }, () => {
      invalidateDashboardSnapshotCache();
      onChange();
    });
  } catch {
    return undefined;
  }
}

async function dashboardWatchRoots(options: NormalizedLoomUiServerOptions): Promise<string[]> {
  const inputs = [options.run, options.collection, options.continuation].filter((value): value is string => Boolean(value));
  const roots: string[] = [];
  for (const input of inputs) {
    const absolute = path.resolve(options.cwd, input);
    const stat = await fs.lstat(absolute).catch(() => undefined);
    if (!stat) continue;
    roots.push(stat.isDirectory() ? absolute : path.dirname(absolute));
  }
  if (!inputs.length) {
    const agentRuns = path.join(options.cwd, 'agent-runs');
    if (await fileExists(agentRuns)) roots.push(agentRuns);
    const loomQueues = path.join(options.cwd, '.loom', 'queues');
    if (await fileExists(loomQueues)) roots.push(loomQueues);
  }
  return uniquePaths(roots);
}

function uniquePaths(values: string[]): string[] {
  return Array.from(new Set(values));
}

function normalizeServerOptions(options: FrontierLoomUiServerOptions): NormalizedLoomUiServerOptions {
  return {
    ...options,
    cwd: path.resolve(options.cwd ?? process.cwd()),
    host: options.host ?? '127.0.0.1',
    port: normalizePort(options.port),
    staticDir: path.resolve(options.staticDir ?? path.join(packageDir, 'public'))
  };
}

function normalizePort(port: number | undefined): number {
  if (port === undefined) return 0;
  if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new Error(`invalid port: ${port}`);
  return port;
}

function formatUrlHost(host: string): string {
  return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
}

function dashboardInput(options: FrontierLoomUiServerOptions & { cwd: string }) {
  return {
    cwd: options.cwd,
    run: options.run,
    collection: options.collection,
    continuation: options.continuation
  };
}

async function readDashboardSnapshot(options: NormalizedLoomUiServerOptions): Promise<unknown> {
  if (!options.run && !options.collection && !options.continuation) return readLifetimeDashboardSnapshot(options);
  return readScopedDashboardSnapshot(options);
}

async function readDashboardSnapshotCached(options: NormalizedLoomUiServerOptions): Promise<unknown> {
  const key = JSON.stringify(dashboardInput(options));
  const now = Date.now();
  if (dashboardSnapshotCache?.key === key) {
    if (dashboardSnapshotCache.value !== undefined && now - dashboardSnapshotCache.at < DASHBOARD_SNAPSHOT_CACHE_MS) {
      return dashboardSnapshotCache.value;
    }
    if (dashboardSnapshotCache.pending) return dashboardSnapshotCache.pending;
  }
  const pending = readDashboardSnapshot(options).then((value) => {
    dashboardSnapshotCache = { key, at: Date.now(), value };
    return value;
  }, (error) => {
    if (dashboardSnapshotCache?.key === key) {
      dashboardSnapshotCache = dashboardSnapshotCache.value === undefined
        ? undefined
        : { key, at: dashboardSnapshotCache.at, value: dashboardSnapshotCache.value };
    }
    throw error;
  });
  dashboardSnapshotCache = { key, at: now, value: dashboardSnapshotCache?.key === key ? dashboardSnapshotCache.value : undefined, pending };
  return pending;
}

function invalidateDashboardSnapshotCache(): void {
  dashboardSnapshotCache = undefined;
}

async function readScopedDashboardSnapshot(
  options: NormalizedLoomUiServerOptions,
  readOptions: { includeActiveRun?: boolean } = {}
): Promise<unknown> {
  const snapshot = await readCodexDashboardSnapshot(dashboardInput(options));
  const activeRunSnapshot = readOptions.includeActiveRun === false ? undefined : await readActiveRunSnapshot(options);
  const reviewDecisions = await readCoordinatorReviewDecisions(options.cwd);
  const autonomousDecisions = await readAutonomousMergeDecisions(options.cwd);
  const decisions = mergeReviewDecisionLists(reviewDecisions, autonomousDecisions);
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return activeRunSnapshot ?? snapshot;
  const answers = await readHumanActionAnswers(options);
  const record = snapshot as unknown as Record<string, unknown>;
  const collectionGraph = await readDashboardRunGraphSummary(options, record);
  const jobs = Array.isArray(record.jobs) ? record.jobs : [];
  const activeJobs = recordArray(activeRunSnapshot?.jobs);
  if (shouldPreferActiveRunSnapshot(jobs, activeJobs)) {
    const activeAgentRows = activeAgentsFromJobs(activeJobs);
    const activeGraph = recordValue(activeRunSnapshot?.graph);
    const graph = Object.keys(activeGraph).length ? activeGraph : collectionGraph;
    return {
      ...activeRunSnapshot,
      collectionJobs: jobs,
      activeAgents: activeAgentRows,
      health: lifetimeHealthSummary(activeJobs),
      humanActions: recordArray(record.humanActions),
      humanActionAnswers: answers,
      ...(graph ? { graph } : {}),
      summary: {
        ...recordValue(activeRunSnapshot?.summary),
        ...(graph ? { graph } : {})
      },
      sources: {
        ...recordValue(record.sources),
        ...recordValue(activeRunSnapshot?.sources),
        ...(reviewDecisions.length ? { coordinatorReviewDecisions: coordinatorReviewDecisionPath(options.cwd) } : {}),
        ...(autonomousDecisions.length ? { autonomousMergeDecisions: autonomousDecisionSourceSummary(autonomousDecisions) } : {}),
        ...(answers.length ? { humanActionAnswers: await humanActionAnswerLogPath(options) } : {})
      },
      raw: {
        ...recordValue(activeRunSnapshot?.raw),
        collectionSnapshot: {
          jobCount: jobs.length,
          humanActionCount: recordArray(record.humanActions).length,
          sourceCount: Object.keys(recordValue(record.sources)).length
        }
      }
    };
  }
  const normalizedSnapshot = normalizeCoordinatorFacingSnapshot(record);
  const mergedJobs = applyCoordinatorReviewDecisions(mergeActiveRunJobTelemetry(jobs, activeJobs), decisions).map(withRecomputedCostFields);
  const normalizedSummary = recordValue(normalizedSnapshot.summary);
  const adjustedSummary = reviewDecisionAdjustedSummary(normalizedSummary, mergedJobs);
  const rawCollectionSummary = recordValue(recordValue(recordValue(record.raw).collection).summary);
  const semanticSummary = {
    ...rawCollectionSummary,
    ...adjustedSummary,
    bucketCounts: recordValue(normalizedSummary.bucketCounts)
  };
  const graph = withDashboardRunGraphJobHealth(collectionGraph, mergedJobs);
  return {
    ...normalizedSnapshot,
    ...(graph ? { graph } : {}),
    summary: {
      ...adjustedSummary,
      ...(graph ? { graph } : {})
    },
    health: lifetimeHealthSummary(mergedJobs),
    semantic: semanticWithHealth(recordValue(normalizedSnapshot.semantic), semanticSummary, mergedJobs),
    jobs: mergedJobs,
    activeAgents: activeAgentsFromJobs(mergedJobs),
    humanActionAnswers: answers,
    sources: {
      ...recordValue(record.sources),
      ...(reviewDecisions.length ? { coordinatorReviewDecisions: coordinatorReviewDecisionPath(options.cwd) } : {}),
      ...(autonomousDecisions.length ? { autonomousMergeDecisions: autonomousDecisionSourceSummary(autonomousDecisions) } : {}),
      ...(answers.length ? { humanActionAnswers: await humanActionAnswerLogPath(options) } : {})
    }
  };
}

async function readDashboardRunGraphSummary(
  options: NormalizedLoomUiServerOptions,
  snapshot: Record<string, unknown>
): Promise<Record<string, unknown> | undefined> {
  const embedded = recordValue(recordValue(recordValue(snapshot.raw).collection).runGraph);
  if (Object.keys(embedded).length) {
    return summarizeDashboardRunGraph(embedded, {
      sourceFile: textValue(embedded.id, 'embedded'),
      sourceKind: 'embedded-run-graph',
      sourceStatus: 'collected'
    });
  }
  const source = await resolveDashboardRunGraphSource(options, snapshot);
  if (source?.file) {
    return summarizeDashboardRunGraph(recordValue(await readJsonFile(source.file)), {
      sourceFile: path.relative(options.cwd, source.file).replaceAll(path.sep, '/'),
      sourceKind: 'collected-run-graph',
      sourceStatus: 'collected'
    });
  }
  if (source?.expectedFile) {
    return missingDashboardRunGraphSummary(options.cwd, {
      expectedFile: source.expectedFile,
      sourceKind: 'collected-run-graph',
      warning: 'Collected dashboard source has no run-graph.json.'
    });
  }
  return undefined;
}

async function resolveDashboardRunGraphSource(
  options: NormalizedLoomUiServerOptions,
  snapshot: Record<string, unknown>
): Promise<{ file?: string; expectedFile?: string } | undefined> {
  const sources = recordValue(snapshot.sources);
  const candidates = uniquePaths([
    textValue(options.collection, ''),
    textValue(sources.collectionDir, ''),
    path.dirname(textValue(sources.collectionFile, ''))
  ].filter(Boolean));
  let expectedFile: string | undefined;
  for (const candidate of candidates) {
    const absolute = path.resolve(options.cwd, candidate);
    if (!isPathInside(options.cwd, absolute)) continue;
    const stat = await fs.lstat(absolute).catch(() => undefined);
    if (!stat) continue;
    const file = stat.isDirectory()
      ? path.join(absolute, 'run-graph.json')
      : path.basename(absolute) === 'run-graph.json'
        ? absolute
        : path.join(path.dirname(absolute), 'run-graph.json');
    expectedFile ??= file;
    const fileStat = await fs.stat(file).catch(() => undefined);
    if (fileStat?.isFile() && isPathInside(options.cwd, file)) return { file, expectedFile: file };
  }
  return expectedFile ? { expectedFile } : undefined;
}

function missingDashboardRunGraphSummary(
  cwd: string,
  input: { expectedFile: string; sourceKind: string; warning: string }
): Record<string, unknown> {
  const sourceFile = path.relative(cwd, input.expectedFile).replaceAll(path.sep, '/');
  const warning = `${input.warning} Expected ${sourceFile}.`;
  return {
    sourceFile,
    sourceFiles: [sourceFile],
    sourceKind: input.sourceKind,
    sourceKinds: [input.sourceKind],
    sourceStatus: 'missing',
    sourceStatuses: ['missing'],
    graphMissing: true,
    graphMissingWarningCount: 1,
    graphMissingWarnings: [warning],
    nodeCount: 0,
    edgeCount: 0,
    blockerCount: 0,
    openBlockerCount: 0,
    humanQuestionCount: 0,
    openHumanQuestionCount: 0,
    safeMergeCandidateCount: 0,
    decisionCount: 0,
    terminalDecisionCount: 0,
    terminalAcceptedCount: 0,
    terminalRejectedCount: 0,
    terminalRerunCount: 0,
    gateCount: 0,
    gatePassedCount: 0,
    gateFailedCount: 0,
    staleCount: 0,
    openStaleCount: 0,
    rerunCount: 0,
    openRerunCount: 0,
    staleRerunCleanupCount: 0,
    status: 'missing',
    summaryLine: warning,
    recentEvents: []
  };
}

function summarizeDashboardRunGraph(
  graph: Record<string, unknown>,
  input: {
    sourceFile: string;
    sourceKind: string;
    sourceStatus: string;
    graphMissing?: boolean;
    graphMissingWarnings?: string[];
    liveEventCount?: number;
  }
): Record<string, unknown> | undefined {
  const summary = recordValue(graph.summary);
  const nodes = recordArray(graph.nodes);
  const edges = recordArray(graph.edges);
  const nodeCount = numberValue(summary.nodeCount) || nodes.length;
  const edgeCount = numberValue(summary.edgeCount) || edges.length;
  if (!nodeCount && !edgeCount && !input.graphMissing) return undefined;
  const gateNodes = nodes.filter((node) => normalized(node.kind) === 'gate');
  const decisionNodes = nodes.filter((node) => normalized(node.kind) === 'decision');
  const terminalDecisionNodes = decisionNodes.filter(runGraphNodeIsTerminalDecision);
  const recentEvents = nodes
    .filter((node) => numberValue(node.generatedAt))
    .sort((left, right) => numberValue(left.generatedAt) - numberValue(right.generatedAt))
    .slice(-8)
    .map((node) => ({
      type: textValue(node.kind, 'graph'),
      at: numberValue(node.generatedAt),
      jobId: textValue(node.jobId, ''),
      taskId: textValue(node.taskId, ''),
      status: textValue(node.status ?? node.outcome, ''),
      message: textValue(node.label ?? node.id, 'graph node')
    }));
  const blockerCount = nodes.filter(runGraphNodeIsBlocker).length;
  const humanQuestionCount = nodes.filter(runGraphNodeIsHumanQuestion).length;
  const safeMergeCandidateCount = nodes.filter(runGraphNodeIsSafeMergeCandidate).length;
  const terminalAcceptedCount = terminalDecisionNodes.filter(runGraphNodeIsAcceptedTerminalDecision).length;
  const terminalRejectedCount = terminalDecisionNodes.filter(runGraphNodeIsRejectedTerminalDecision).length;
  const terminalRerunCount = terminalDecisionNodes.filter(runGraphNodeIsRerunTerminalDecision).length;
  const gateFailedCount = gateNodes.filter((node) => normalized(node.status) === 'failed').length;
  const staleCount = firstNumber(summary.staleCount, summary.staleAgainstHeadCount, summary['stale-against-head']) || nodes.filter(runGraphNodeIsStale).length;
  const rerunCount = firstNumber(summary.rerunCount, summary['rerun-work']) || nodes.filter(runGraphNodeIsRerun).length;
  const staleRerunCleanupCount = nodes.filter(runGraphNodeIsStaleRerunCleanup).length;
  const graphMissingWarnings = uniquePaths(input.graphMissingWarnings ?? []);
  const status = blockerCount
    ? 'blocked'
    : humanQuestionCount
      ? 'questions'
      : gateFailedCount
        ? 'review'
        : terminalRerunCount
          ? 'rerun'
          : input.graphMissing && !safeMergeCandidateCount
            ? 'missing'
            : safeMergeCandidateCount || terminalAcceptedCount
              ? 'ready'
              : 'clear';
  return {
    sourceFile: input.sourceFile,
    sourceFiles: input.sourceFile ? [input.sourceFile] : [],
    sourceKind: input.sourceKind,
    sourceKinds: [input.sourceKind],
    sourceStatus: input.sourceStatus,
    sourceStatuses: [input.sourceStatus],
    graphMissing: input.graphMissing === true,
    graphMissingWarningCount: graphMissingWarnings.length,
    graphMissingWarnings,
    ...(input.liveEventCount !== undefined ? { liveEventCount: input.liveEventCount } : {}),
    nodeCount,
    edgeCount,
    blockerCount,
    openBlockerCount: blockerCount,
    humanQuestionCount,
    openHumanQuestionCount: humanQuestionCount,
    safeMergeCandidateCount,
    decisionCount: numberValue(summary.decisionCount) || decisionNodes.length,
    terminalDecisionCount: terminalDecisionNodes.length,
    terminalAcceptedCount,
    terminalRejectedCount,
    terminalRerunCount,
    gateCount: numberValue(summary.gateCount) || gateNodes.length,
    gatePassedCount: gateNodes.filter((node) => normalized(node.status) === 'passed').length,
    gateFailedCount,
    staleCount,
    openStaleCount: staleCount,
    rerunCount,
    openRerunCount: rerunCount,
    staleRerunCleanupCount,
    status,
    summaryLine: `${nodeCount} nodes, ${edgeCount} edges, ${numberValue(summary.decisionCount) || decisionNodes.length} decisions, and ${numberValue(summary.gateCount) || gateNodes.length} gates.`,
    recentEvents
  };
}

function runGraphNodeIsBlocker(node: Record<string, unknown>): boolean {
  const status = normalized(node.status);
  const outcome = normalized(node.outcome);
  return status === 'blocked' || outcome === 'blocked' || outcome === 'conflict' || outcome === 'human-needed';
}

function runGraphNodeIsHumanQuestion(node: Record<string, unknown>): boolean {
  const status = normalized(node.status);
  const outcome = normalized(node.outcome);
  return status.includes('human') || outcome.includes('human') || status.includes('question') || outcome.includes('question');
}

function runGraphNodeIsSafeMergeCandidate(node: Record<string, unknown>): boolean {
  if (normalized(node.kind) !== 'candidate') return false;
  const bucket = normalized(node.bucket);
  const data = recordValue(node.data);
  return bucket === 'ready-to-apply' || data.autoMergeable === true || normalized(data.mergeReadiness) === 'ready-to-apply';
}

function runGraphNodeIsTerminalDecision(node: Record<string, unknown>): boolean {
  const kind = normalized(node.kind);
  if (kind === 'terminal-outcome') return true;
  if (kind !== 'decision') return false;
  return textValue(node.id, '').startsWith('decision:terminal:')
    || normalized(recordValue(node.data).terminal) === 'true'
    || runGraphTerminalOutcome(node) !== '';
}

function runGraphNodeIsAcceptedTerminalDecision(node: Record<string, unknown>): boolean {
  return ['accepted', 'accepted-applied', 'applied', 'committed', 'completed', 'ok', 'ready', 'ready-to-apply', 'verified-patch'].includes(runGraphTerminalOutcome(node));
}

function runGraphNodeIsRejectedTerminalDecision(node: Record<string, unknown>): boolean {
  return ['blocked', 'conflict', 'conflict-blocked', 'failed', 'rejected'].includes(runGraphTerminalOutcome(node));
}

function runGraphNodeIsRerunTerminalDecision(node: Record<string, unknown>): boolean {
  return ['needs-rerun', 'rerun', 'rerun-work', 'stale', 'stale-against-head'].includes(runGraphTerminalOutcome(node));
}

function runGraphTerminalOutcome(node: Record<string, unknown>): string {
  const data = recordValue(node.data);
  const values = [
    node.outcome,
    node.status,
    data.outcome,
    data.status,
    data.mergeReadiness,
    data.disposition
  ].map(normalized).filter(Boolean);
  return values.find((value) => [
    'accepted',
    'accepted-applied',
    'applied',
    'blocked',
    'committed',
    'completed',
    'conflict',
    'conflict-blocked',
    'failed',
    'needs-rerun',
    'ok',
    'ready',
    'ready-to-apply',
    'rejected',
    'rerun',
    'rerun-work',
    'stale',
    'stale-against-head',
    'verified-patch'
  ].includes(value)) ?? '';
}

function runGraphNodeIsStale(node: Record<string, unknown>): boolean {
  if (normalized(node.kind) === 'bucket') return false;
  const data = recordValue(node.data);
  const values = [
    node.bucket,
    node.status,
    node.outcome,
    data.disposition,
    data.mergeReadiness,
    ...(stringArray(data.reasons))
  ].map(normalized);
  return data.staleAgainstHead === true || values.some((value) => value.includes('stale'));
}

function runGraphNodeIsRerun(node: Record<string, unknown>): boolean {
  if (normalized(node.kind) === 'bucket') return false;
  const data = recordValue(node.data);
  const values = [
    node.bucket,
    node.status,
    node.outcome,
    data.disposition,
    data.mergeReadiness,
    ...(stringArray(data.reasons))
  ].map(normalized);
  return values.some((value) => value.includes('rerun'));
}

function runGraphNodeIsStaleRerunCleanup(node: Record<string, unknown>): boolean {
  if (!runGraphNodeIsTerminalDecision(node)) return false;
  if (!runGraphNodeIsStale(node) && !runGraphNodeIsRerun(node)) return false;
  return runGraphNodeIsAcceptedTerminalDecision(node) || runGraphNodeIsRejectedTerminalDecision(node) || runGraphNodeIsRerunTerminalDecision(node);
}

async function readLifetimeDashboardSnapshot(options: NormalizedLoomUiServerOptions): Promise<Record<string, unknown>> {
  const sources = await discoverLifetimeDashboardSources(options.cwd);
  const snapshots: Array<{ source: LifetimeDashboardSource; snapshot: Record<string, unknown> }> = [];
  let skippedSourceCount = 0;
  let timedOutSourceCount = 0;
  for (const source of sources.slice(0, LIFETIME_DASHBOARD_MAX_SOURCES)) {
    try {
      const snapshot = await withTimeout(
        (async () => {
          const scopedSnapshot = await readScopedDashboardSnapshot({
            ...options,
            run: source.run,
            collection: source.collection,
            continuation: source.continuation
          }, { includeActiveRun: false });
          return enrichLifetimeRunSnapshotEvidence(options.cwd, source, recordValue(scopedSnapshot));
        })(),
        LIFETIME_DASHBOARD_SOURCE_TIMEOUT_MS,
        `lifetime source timed out: ${source.path}`
      );
      if (Object.keys(snapshot).length) snapshots.push({ source, snapshot });
    } catch (error) {
      skippedSourceCount++;
      if (error instanceof Error && error.message.startsWith('lifetime source timed out:')) timedOutSourceCount++;
      continue;
    }
  }
  const lifetime = await combineLifetimeDashboardSnapshots(
    options,
    sources,
    snapshots,
    mergeReviewDecisionLists(await readCoordinatorReviewDecisions(options.cwd), await readAutonomousMergeDecisions(options.cwd)),
    await readLifetimeQueueBacklog(options.cwd)
  );
  const lifetimeWithSourceHealth = {
    ...lifetime,
    sources: {
      ...recordValue(lifetime.sources),
      skippedSourceCount,
      timedOutSourceCount
    }
  };
  return mergeLifetimeActiveRunSnapshot(
    mergeLifetimeDrainCoordinatorSnapshot(lifetimeWithSourceHealth, await readLatestDrainCoordinatorSnapshot(options.cwd)),
    await readLifetimeActiveRunSnapshot(options)
  );
}

interface LifetimeDashboardSource {
  id: string;
  label: string;
  path: string;
  kind: 'run' | 'collection' | 'continuation';
  mtimeMs: number;
  run?: string;
  collection?: string;
  continuation?: string;
}

async function discoverLifetimeDashboardSources(cwd: string): Promise<LifetimeDashboardSource[]> {
  const root = path.join(cwd, 'agent-runs');
  const stat = await fs.stat(root).catch(() => undefined);
  if (!stat?.isDirectory()) return [];
  const resetAt = await readLifetimeDashboardResetCutoff(root);
  const files = await findLifetimeDashboardArtifactFiles(root, {
    maxDepth: LIFETIME_DASHBOARD_SCAN_MAX_DEPTH,
    maxFiles: LIFETIME_DASHBOARD_SCAN_MAX_FILES,
    resetAt
  });
  const byDir = new Map<string, { files: Set<string>; mtimeMs: number }>();
  for (const file of files) {
    const dir = path.dirname(file);
    const name = path.basename(file);
    const fileStat = await fs.stat(file).catch(() => undefined);
    const entry = byDir.get(dir) ?? { files: new Set<string>(), mtimeMs: 0 };
    entry.files.add(name);
    entry.mtimeMs = Math.max(entry.mtimeMs, fileStat?.mtimeMs ?? 0);
    byDir.set(dir, entry);
  }
  const out: LifetimeDashboardSource[] = [];
  for (const [dir, entry] of byDir) {
    if (entry.mtimeMs <= resetAt) continue;
    const relative = path.relative(cwd, dir);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) continue;
    const hasCollection = entry.files.has('collection.json') || entry.files.has('coordinator-query.json');
    const hasContinuation = entry.files.has('continuation.json');
    const hasRun = entry.files.has('swarm-results.json') || entry.files.has('coordinator-dashboard.json');
    if (hasCollection) {
      out.push({
        id: `collection:${relative}`,
        label: lifetimeSourceLabel(relative),
        path: relative,
        kind: 'collection',
        mtimeMs: entry.mtimeMs,
        collection: relative
      });
      continue;
    }
    if (hasContinuation) {
      out.push({
        id: `continuation:${relative}`,
        label: lifetimeSourceLabel(relative),
        path: relative,
        kind: 'continuation',
        mtimeMs: entry.mtimeMs,
        continuation: relative
      });
      continue;
    }
    if (hasRun) {
      out.push({
        id: `run:${relative}`,
        label: lifetimeSourceLabel(relative),
        path: relative,
        kind: 'run',
        mtimeMs: entry.mtimeMs,
        run: relative
      });
    }
  }
  return dedupeLifetimeDashboardSources(out).sort((left, right) => right.mtimeMs - left.mtimeMs || left.path.localeCompare(right.path));
}

function dedupeLifetimeDashboardSources(sources: LifetimeDashboardSource[]): LifetimeDashboardSource[] {
  const preferredCollections = preferredLifetimeCollectionsByFamily(sources);
  const runs = new Set(sources.filter((source) => source.kind === 'run').map(lifetimeRunFamilyKey));
  return sources.filter((source) => {
    const family = lifetimeRunFamilyKey(source);
    if (source.kind === 'collection' && preferredCollections.get(family) !== source) return false;
    if (source.kind === 'collection' && source.path.endsWith('/collected-missing') && runs.has(family)) return false;
    return true;
  });
}

function preferredLifetimeCollectionsByFamily(sources: LifetimeDashboardSource[]): Map<string, LifetimeDashboardSource> {
  const out = new Map<string, LifetimeDashboardSource>();
  for (const source of sources) {
    if (source.kind !== 'collection') continue;
    const family = lifetimeRunFamilyKey(source);
    const current = out.get(family);
    if (!current || compareLifetimeCollectionPreference(source, current) > 0) out.set(family, source);
  }
  return out;
}

function compareLifetimeCollectionPreference(left: LifetimeDashboardSource, right: LifetimeDashboardSource): number {
  return lifetimeCollectionPreference(left) - lifetimeCollectionPreference(right)
    || left.mtimeMs - right.mtimeMs
    || right.path.localeCompare(left.path);
}

function lifetimeCollectionPreference(source: LifetimeDashboardSource): number {
  const pathLabel = normalized(source.path);
  if (pathLabel.endsWith('/post-coordinator-collected') || pathLabel.includes('/post-coordinator-collected')) return 80;
  if (pathLabel.endsWith('/coordinator-collected') || pathLabel.includes('/coordinator-collected')) return 70;
  if (pathLabel.endsWith('/collected-resolved') || pathLabel.includes('/collected-resolved-')) return 60;
  if (pathLabel.endsWith('/collected-with-decisions') || pathLabel.includes('/collected-with-decisions-')) return 55;
  if (pathLabel.endsWith('/collected')) return 50;
  if (pathLabel.includes('/collected-current')) return 30;
  if (pathLabel.includes('/collected-partial')) return 20;
  if (pathLabel.includes('/collected-missing')) return 10;
  return 40;
}

function lifetimeRunFamilyKey(source: LifetimeDashboardSource): string {
  const parts = source.path.split(/[\\/]/g).filter(Boolean);
  if (!parts.length) return source.path;
  const agentRunsIndex = parts.lastIndexOf('agent-runs');
  const start = agentRunsIndex >= 0 ? agentRunsIndex + 1 : 0;
  return parts[start] ?? source.path;
}

function lifetimeRunRootKey(source: LifetimeDashboardSource): string {
  const parts = source.path.split(/[\\/]/g).filter(Boolean);
  if (!parts.length) return source.path;
  const agentRunsIndex = parts.lastIndexOf('agent-runs');
  const start = agentRunsIndex >= 0 ? agentRunsIndex + 1 : 0;
  const rootParts = parts.slice(start, start + 2);
  return rootParts.length ? rootParts.join('/') : source.path;
}

function isDrainedAutonomousRunSnapshot(snapshot: Record<string, unknown>): boolean {
  const rawRun = recordValue(recordValue(snapshot.raw).run);
  const autoDrain = recordValue(rawRun.autoDrain);
  const autoDrainSummary = recordValue(autoDrain.summary);
  const artifactSummary = recordValue(recordValue(rawRun.autoDrainArtifacts).summary);
  const summary = Object.keys(autoDrainSummary).length ? autoDrainSummary : artifactSummary;
  if (!Object.keys(summary).length) return false;
  if (textValue(summary.rerunManifestTerminalState, '') !== 'drained') return false;
  if (numberValue(summary.remainingReadyCount) > 0) return false;
  if (numberValue(summary.humanBlockedCount) > 0 || numberValue(summary.humanBlockedDecisionCount) > 0) return false;
  if (numberValue(summary.conflictBlockedCount) > 0 || numberValue(summary.rerunTaskCount) > 0) return false;
  return numberValue(summary.committedDecisionCount) > 0 || numberValue(summary.terminalCount) > 0 || numberValue(summary.decisionCount) > 0;
}

function collapseSupersededLifetimeReviewJobs(jobs: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const resolvedAtByJob = new Map<string, number>();
  for (const job of jobs) {
    if (!isResolvedCoordinatorReviewRecord(job)) continue;
    const key = lifetimeReviewDedupeKey(job);
    if (!key) continue;
    resolvedAtByJob.set(key, Math.max(resolvedAtByJob.get(key) ?? 0, numberValue(job.generatedAt)));
  }
  return jobs.filter((job) => {
    if (!isOpenCoordinatorReviewRecord(job)) return true;
    const key = lifetimeReviewDedupeKey(job);
    if (!key) return true;
    return (resolvedAtByJob.get(key) ?? 0) < numberValue(job.generatedAt);
  });
}

function dedupeLifetimeDashboardJobs(jobs: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const byTask = new Map<string, Record<string, unknown>>();
  for (const job of jobs) {
    const key = lifetimeJobDedupeKey(job);
    if (!key) continue;
    const current = byTask.get(key);
    if (!current || compareLifetimeJobPreference(job, current) > 0) byTask.set(key, job);
  }
  return Array.from(byTask.values()).sort((left, right) => {
    return numberValue(right.generatedAt) - numberValue(left.generatedAt)
      || textValue(left.lane, '').localeCompare(textValue(right.lane, ''))
      || textValue(left.title, '').localeCompare(textValue(right.title, ''));
  });
}

function lifetimeJobDedupeKey(job: Record<string, unknown>): string {
  return canonicalLifetimeTaskKey(textValue(job.originalJobId ?? job.taskId ?? job.id ?? job.jobId, ''));
}

function compareLifetimeJobPreference(left: Record<string, unknown>, right: Record<string, unknown>): number {
  return lifetimeJobPreference(left) - lifetimeJobPreference(right)
    || numberValue(left.generatedAt) - numberValue(right.generatedAt)
    || textValue(right.sourceLabel, '').localeCompare(textValue(left.sourceLabel, ''));
}

function lifetimeJobPreference(job: Record<string, unknown>): number {
  const status = normalized(job.status);
  const bucket = normalized(job.bucket);
  const liveness = normalized(job.liveness);
  let score = 0;
  if (status === 'running') score += 120;
  else if (status === 'completed') score += 100;
  else if (status === 'failed' || status === 'blocked') score += 70;
  else if (['queued', 'pending', 'todo', 'open'].includes(status) || ['queued', 'todo'].includes(bucket)) score += 40;
  if (liveness === 'missing' || status === 'planned') score -= 60;
  if (numberValue(job.changedPathCount)) score += 12;
  if (numberValue(job.evidencePathCount)) score += 8;
  if (numberValue(job.actualInputTokens) || numberValue(job.estimatedInputTokens)) score += 4;
  return score;
}

function lifetimeReviewDedupeKey(job: Record<string, unknown>): string {
  return canonicalLifetimeTaskKey(textValue(job.originalJobId ?? job.jobId ?? job.taskId, ''));
}

function canonicalLifetimeTaskKey(value: string): string {
  return unscopedLifetimeTaskKey(value)
    .trim()
    .replace(/(?:-continuation)?-rerun(?:-\d+)?$/u, '')
    .replace(/(?:-continuation)?-retry(?:-\d+)?$/u, '');
}

function unscopedLifetimeTaskKey(value: string): string {
  const trimmed = value.trim();
  const match = /^(?:run|collection|continuation):.+:([^:]+)$/u.exec(trimmed);
  return match?.[1] ?? trimmed;
}

function isOpenCoordinatorReviewRecord(job: Record<string, unknown>): boolean {
  if (isResolvedCoordinatorReviewRecord(job)) return false;
  return isCoordinatorPortBucket(job.bucket)
    || isCoordinatorPortBucket(job.disposition)
    || isCoordinatorPortBucket(job.mergeReadiness)
    || normalized(job.status) === 'needs-review';
}

function isResolvedCoordinatorReviewRecord(job: Record<string, unknown>): boolean {
  const bucket = normalized(job.bucket);
  if (bucket === 'review-resolved' || bucket === 'resolved-review' || job.reviewResolved === true) return true;
  const status = textValue(job.coordinatorDecisionStatus ?? recordValue(job.coordinatorDecision).status, '');
  return Boolean(status) && isResolvedCoordinatorDecision(status);
}

interface LifetimeQueueBacklog {
  entries: Array<Record<string, unknown>>;
  manifests: LifetimeQueueCapacityManifest[];
  sourceCount: number;
  paths: string[];
  generatedAt: number;
}

interface LifetimeQueueCapacityManifest {
  path: string;
  id: string;
  title: string;
  defaultConcurrency: number;
  computeMaxConcurrency: number;
  maxConcurrency: number;
  lanes: LifetimeQueueCapacityManifestLane[];
}

interface LifetimeQueueCapacityManifestLane {
  id: string;
  title: string;
  layer: string;
  compute: string;
  model: string;
  maxConcurrency: number;
}

async function readLifetimeQueueBacklog(cwd: string): Promise<LifetimeQueueBacklog> {
  const root = path.join(cwd, '.loom', 'queues');
  const stat = await fs.stat(root).catch(() => undefined);
  if (!stat?.isDirectory()) return { entries: [], manifests: [], sourceCount: 0, paths: [], generatedAt: 0 };
  const queueDirs = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const entriesById = new Map<string, Record<string, unknown>>();
  const manifests: LifetimeQueueCapacityManifest[] = [];
  const paths: string[] = [];
  let generatedAt = 0;
  for (const queueDir of queueDirs) {
    if (!queueDir.isDirectory()) continue;
    const dir = path.join(root, queueDir.name);
    const manifestFile = await preferredQueueManifestFile(dir);
    if (manifestFile) {
      const manifestStat = await fs.stat(manifestFile).catch(() => undefined);
      generatedAt = Math.max(generatedAt, manifestStat?.mtimeMs ?? 0);
      const manifest = await readQueueCapacityManifest(cwd, manifestFile);
      if (manifest) manifests.push(manifest);
    }
    for (const taskFile of await queueTaskFiles(dir)) {
      const fileStat = await fs.stat(taskFile).catch(() => undefined);
      generatedAt = Math.max(generatedAt, fileStat?.mtimeMs ?? 0);
      paths.push(path.relative(cwd, taskFile));
      const tasks = await readQueueTaskFile(taskFile);
      for (const task of tasks) {
        const id = textValue(task.id ?? task.taskId ?? task.title, '');
        if (!id) continue;
        entriesById.set(id, normalizeQueueBacklogEntry(cwd, queueDir.name, taskFile, task));
        if (entriesById.size >= LIFETIME_DASHBOARD_MAX_QUEUE_TASKS) break;
      }
      if (entriesById.size >= LIFETIME_DASHBOARD_MAX_QUEUE_TASKS) break;
    }
    if (entriesById.size >= LIFETIME_DASHBOARD_MAX_QUEUE_TASKS) break;
  }
  return {
    entries: Array.from(entriesById.values()),
    manifests,
    sourceCount: paths.length,
    paths,
    generatedAt
  };
}

async function queueTaskFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const candidates: Array<{ file: string; mtimeMs: number; preferred: number }> = [];
  for (const entry of entries) {
    if (!entry.isFile() || !/^tasks(?:\.(?:remaining|backlog)-[\w.-]+)?\.json$/.test(entry.name)) continue;
    const file = path.join(dir, entry.name);
    const stat = await fs.stat(file).catch(() => undefined);
    candidates.push({
      file,
      mtimeMs: stat?.mtimeMs ?? 0,
      preferred: entry.name.startsWith('tasks.backlog-') ? 2 : entry.name.startsWith('tasks.remaining-') ? 1 : 0
    });
  }
  return candidates
    .sort((left, right) => left.mtimeMs - right.mtimeMs || left.preferred - right.preferred || left.file.localeCompare(right.file))
    .map((candidate) => candidate.file);
}

async function preferredQueueManifestFile(dir: string): Promise<string | undefined> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const candidates: Array<{ file: string; mtimeMs: number; preferred: number }> = [];
  for (const entry of entries) {
    if (!entry.isFile() || !/^manifest(?:\.[\w.-]+)?\.json$/.test(entry.name)) continue;
    const file = path.join(dir, entry.name);
    const stat = await fs.stat(file).catch(() => undefined);
    candidates.push({
      file,
      mtimeMs: stat?.mtimeMs ?? 0,
      preferred: entry.name.includes('high-concurrency') ? 2 : entry.name === 'manifest.json' ? 1 : 0
    });
  }
  return candidates.sort((left, right) => right.preferred - left.preferred || right.mtimeMs - left.mtimeMs || left.file.localeCompare(right.file))[0]?.file;
}

async function readQueueCapacityManifest(cwd: string, file: string): Promise<LifetimeQueueCapacityManifest | undefined> {
  const raw = recordValue(await readJsonFile(file));
  if (!Object.keys(raw).length) return undefined;
  const computeRows = recordArray(raw.compute);
  const computeById = new Map(computeRows.map((entry) => [textValue(entry.id, ''), entry]));
  const defaultComputeId = textValue(recordValue(raw.policy).defaultCompute, textValue(computeRows[0]?.id, ''));
  const defaultCompute = recordValue(computeById.get(defaultComputeId) ?? computeRows[0]);
  const defaultConcurrency = numberValue(recordValue(raw.policy).defaultConcurrency);
  const computeMaxConcurrency = computeRows.reduce((max, entry) => Math.max(max, numberValue(entry.maxConcurrency)), 0);
  const manifestMaxConcurrency = numberValue(raw.maxConcurrency);
  const lanes = recordArray(raw.lanes).map((lane) => {
    const computeId = textValue(lane.compute, defaultComputeId);
    const compute = recordValue(computeById.get(computeId) ?? defaultCompute);
    return {
      id: textValue(lane.id, 'lane'),
      title: textValue(lane.title ?? lane.id, 'Lane'),
      layer: textValue(lane.layer, ''),
      compute: computeId,
      model: textValue(compute.model, textValue(compute.id, '')),
      maxConcurrency: numberValue(lane.maxConcurrency) || 1
    };
  });
  return {
    path: path.relative(cwd, file),
    id: textValue(raw.id, path.basename(file, '.json')),
    title: textValue(raw.title, 'Swarm manifest'),
    defaultConcurrency,
    computeMaxConcurrency,
    maxConcurrency: manifestMaxConcurrency || defaultConcurrency || computeMaxConcurrency || lanes.reduce((sum, lane) => sum + lane.maxConcurrency, 0),
    lanes
  };
}

async function readQueueTaskFile(file: string): Promise<Array<Record<string, unknown>>> {
  const raw = await readJsonFile(file);
  if (Array.isArray(raw)) return raw.map(recordValue).filter((entry) => Object.keys(entry).length);
  const record = recordValue(raw);
  return recordArray(record.tasks ?? record.entries ?? record.items);
}

function normalizeQueueBacklogEntry(cwd: string, queueId: string, file: string, task: Record<string, unknown>): Record<string, unknown> {
  const id = textValue(task.id ?? task.taskId ?? task.title, 'task');
  const queueStatus = textValue(task.status ?? task.state, 'open');
  const status = ['done', 'completed', 'failed', 'blocked'].includes(normalized(queueStatus)) ? queueStatus : 'todo';
  const sourceRefs = stringArray(task.sourceRefs);
  const targetRefs = stringArray(task.targetRefs);
  const allowedWrites = stringArray(task.allowedWrites);
  const files = uniquePaths([...targetRefs, ...allowedWrites, ...sourceRefs]).slice(0, 40);
  return {
    id,
    taskId: id,
    title: textValue(task.title ?? task.objective ?? id, id),
    objective: textValue(task.objective ?? task.summary, ''),
    status,
    queueStatus,
    ready: status === 'todo',
    lane: textValue(task.lane ?? task.groupId ?? task.epicId, queueId),
    group: textValue(task.groupId ?? task.epicId, queueId),
    epicId: textValue(task.epicId, ''),
    priority: numberValue(task.priority),
    changedPaths: files,
    changedPathCount: files.length,
    sourceRefs,
    targetRefs,
    allowedWrites,
    acceptance: stringArray(task.acceptance),
    verification: recordArray(task.verification),
    tags: stringArray(task.tags),
    sourceLabel: path.relative(cwd, file),
    sourceQueue: queueId
  };
}

async function readLifetimeDashboardResetCutoff(root: string): Promise<number> {
  const reset = recordValue(await readJsonFile(path.join(root, LIFETIME_DASHBOARD_RESET_FILE)));
  return numberValue(reset.resetAt ?? reset.generatedAt);
}

async function findLifetimeDashboardArtifactFiles(
  root: string,
  input: { maxDepth: number; maxFiles: number; resetAt?: number }
): Promise<string[]> {
  const names = new Set(['swarm-results.json', 'pids.json', 'coordinator-dashboard.json', 'collection.json', 'coordinator-query.json', 'continuation.json']);
  const skipDirs = new Set(['.git', 'node_modules', 'dist', 'coverage', 'evidence', 'streams', 'patch-scores', 'apply-ledger', 'artifact-index']);
  const out: string[] = [];
  async function walk(current: string, depth: number): Promise<void> {
    if (out.length >= input.maxFiles || depth > input.maxDepth) return;
    const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (out.length >= input.maxFiles) return;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name) || entry.name.startsWith('.')) continue;
        if (input.resetAt && depth === 0) {
          const dirStat = await fs.stat(absolute).catch(() => undefined);
          if ((dirStat?.mtimeMs ?? 0) <= input.resetAt) continue;
        }
        await walk(absolute, depth + 1);
      } else if (entry.isFile() && names.has(entry.name)) {
        out.push(absolute);
      }
    }
  }
  await walk(root, 0);
  return out;
}

async function combineLifetimeDashboardSnapshots(
  options: NormalizedLoomUiServerOptions,
  discoveredSources: LifetimeDashboardSource[],
  snapshots: Array<{ source: LifetimeDashboardSource; snapshot: Record<string, unknown> }>,
  reviewDecisions: CoordinatorReviewDecision[],
  queueBacklog: LifetimeQueueBacklog
): Promise<Record<string, unknown>> {
  const drainedRunRoots = new Set(snapshots
    .filter((entry) => entry.source.kind === 'run' && isDrainedAutonomousRunSnapshot(entry.snapshot))
    .map((entry) => lifetimeRunRootKey(entry.source)));
  const visibleSnapshots = snapshots.filter((entry) => {
    if (entry.source.kind !== 'collection') return true;
    return !drainedRunRoots.has(lifetimeRunRootKey(entry.source));
  });
  const autoDrainDelays = lifetimeAutoDrainDelayRecords(visibleSnapshots);
  const jobs = dedupeLifetimeDashboardJobs(collapseSupersededLifetimeReviewJobs(applyCoordinatorReviewDecisions(visibleSnapshots.flatMap(({ source, snapshot }) => {
    const autoDrainDelay = lifetimeAutoDrainDelayRecord(source, snapshot);
    return recordArray(snapshot.jobs).map((job) => {
      const sourceJobId = textValue(job.id ?? job.jobId ?? job.taskId, 'job');
      return withRecomputedCostFields({
        ...job,
        id: lifetimeScopedId(source, sourceJobId),
        sourceJobId,
        originalJobId: unscopedLifetimeTaskKey(sourceJobId),
        sourceRun: source.run,
        sourceCollection: source.collection,
        sourceContinuation: source.continuation,
        sourceLabel: source.label,
        ...(autoDrainDelay ? {
          coordinationDelay: autoDrainDelay.reason,
          autoDrainSkippedReason: autoDrainDelay.skippedReason,
          autoDrainDirtyPathCount: autoDrainDelay.dirtyPathCount
        } : {}),
        generatedAt: numberValue(job.generatedAt) || numberValue(snapshot.generatedAt) || source.mtimeMs
      });
    });
  }), reviewDecisions))).slice(0, LIFETIME_DASHBOARD_MAX_JOBS);
  const humanActionAnswers = await readHumanActionAnswers(options);
  const graph = withDashboardRunGraphJobHealth(lifetimeDecisionGraphSummary(visibleSnapshots), jobs);
  const summary = {
    ...lifetimeDashboardSummary(jobs),
    coordinationDelayCount: autoDrainDelays.length,
    dirtyAutoDrainSkipCount: autoDrainDelays.filter((record) => record.skippedReason === 'dirty-worktree').length,
    ...(graph ? { graph } : {})
  };
  const queueOverlay = lifetimeQueueBacklogOverlay(queueBacklog, jobs);
  const latestGeneratedAt = Math.max(Date.now(), numberValue(queueBacklog.generatedAt), ...visibleSnapshots.map((entry) => numberValue(entry.snapshot.generatedAt)), ...discoveredSources.map((source) => source.mtimeMs));
  const events = visibleSnapshots.flatMap(({ source, snapshot }) => recordArray(snapshot.events).map((event) => ({
    ...event,
    sourceLabel: source.label,
    message: textValue(event.message, textValue(event.type, 'event')),
    at: numberValue(event.at) || source.mtimeMs
  }))).sort((left, right) => numberValue(left.at) - numberValue(right.at)).slice(-160);
  return {
    kind: 'frontier.loom-ui.lifetime-dashboard',
    version: 1,
    ok: true,
    generatedAt: latestGeneratedAt,
    cwd: options.cwd,
    sources: {
      workspace: options.cwd,
      lifetimeRoot: path.join(options.cwd, 'agent-runs'),
      queueRoot: path.join(options.cwd, '.loom', 'queues'),
      sourceCount: discoveredSources.length,
      loadedSourceCount: visibleSnapshots.length,
      suppressedCollectionSourceCount: snapshots.length - visibleSnapshots.length,
      queueSourceCount: queueBacklog.sourceCount,
      coordinationDelayCount: autoDrainDelays.length,
      ...(humanActionAnswers.length ? { humanActionAnswers: await humanActionAnswerLogPath(options) } : {}),
      ...(reviewDecisions.length ? { coordinatorReviewDecisions: coordinatorReviewDecisionPath(options.cwd) } : {})
    },
    summary,
    semantic: semanticWithHealth(lifetimeSemanticSummary(jobs), summary, jobs),
    health: lifetimeHealthSummary(jobs),
    quality: {},
    timeSeries: lifetimeTimeSeries(jobs, events),
    ...(graph ? { graph } : {}),
    lanes: lifetimeLaneRows(jobs),
    capacity: lifetimeCapacitySummary(queueBacklog, jobs, queueOverlay.entries),
    jobs,
    humanActions: visibleSnapshots.flatMap(({ snapshot }) => recordArray(snapshot.humanActions)).slice(-100),
    humanActionAnswers,
    events,
    routing: await lifetimeRoutingSummary(options.cwd, visibleSnapshots),
    backlog: {
      id: 'workspace-lifetime',
      entryCount: queueOverlay.totalCount,
      readyCount: queueOverlay.readyCount,
      activeCount: queueOverlay.activeCount,
      doneCount: queueOverlay.doneCount,
      failedCount: queueOverlay.failedCount,
      representedCount: queueOverlay.representedCount,
      entries: queueOverlay.entries
    },
    raw: {
      lifetime: {
        mode: 'workspace',
        sourceCount: discoveredSources.length,
        loadedSourceCount: visibleSnapshots.length,
        suppressedCollectionSourceCount: snapshots.length - visibleSnapshots.length,
        autoDrainDelays,
        ...(graph ? { graphSourceFiles: graph.sourceFiles } : {}),
        sources: discoveredSources.slice(0, LIFETIME_DASHBOARD_MAX_SOURCES),
        manifests: queueBacklog.manifests,
        queueSources: queueBacklog.paths
      }
    }
  };
}

function lifetimeDecisionGraphSummary(
  snapshots: Array<{ source: LifetimeDashboardSource; snapshot: Record<string, unknown> }>
): Record<string, unknown> | undefined {
  const graphs = snapshots.map(({ source, snapshot }) => {
    const graph = recordValue(snapshot.graph ?? recordValue(snapshot.summary).graph);
    return Object.keys(graph).length ? { source, graph } : undefined;
  }).filter((entry): entry is { source: LifetimeDashboardSource; graph: Record<string, unknown> } => Boolean(entry));
  if (!graphs.length) return undefined;
  const sourceFiles = uniquePaths(graphs.flatMap(({ graph }) => stringArray(graph.sourceFiles).length
    ? stringArray(graph.sourceFiles)
    : [textValue(graph.sourceFile, '')]).filter(Boolean));
  const sourceKinds = uniquePaths(graphs.map(({ graph }) => textValue(graph.sourceKind, '')).filter(Boolean));
  const sourceStatuses = uniquePaths(graphs.map(({ graph }) => textValue(graph.sourceStatus, '')).filter(Boolean));
  const graphMissingWarnings = uniquePaths(graphs.flatMap(({ graph }) => stringArray(graph.graphMissingWarnings)));
  const nodeCount = graphNumberSum(graphs, 'nodeCount');
  const edgeCount = graphNumberSum(graphs, 'edgeCount');
  const blockerCount = graphNumberSum(graphs, 'blockerCount');
  const openBlockerCount = graphNumberSum(graphs, 'openBlockerCount');
  const humanQuestionCount = graphNumberSum(graphs, 'humanQuestionCount');
  const openHumanQuestionCount = graphNumberSum(graphs, 'openHumanQuestionCount');
  const safeMergeCandidateCount = graphNumberSum(graphs, 'safeMergeCandidateCount');
  const decisionCount = graphNumberSum(graphs, 'decisionCount');
  const terminalDecisionCount = graphNumberSum(graphs, 'terminalDecisionCount');
  const terminalAcceptedCount = graphNumberSum(graphs, 'terminalAcceptedCount');
  const terminalRejectedCount = graphNumberSum(graphs, 'terminalRejectedCount');
  const terminalRerunCount = graphNumberSum(graphs, 'terminalRerunCount');
  const gateCount = graphNumberSum(graphs, 'gateCount');
  const gateFailedCount = graphNumberSum(graphs, 'gateFailedCount');
  const staleCount = graphNumberSum(graphs, 'staleCount');
  const openStaleCount = graphNumberSum(graphs, 'openStaleCount');
  const rerunCount = graphNumberSum(graphs, 'rerunCount');
  const openRerunCount = graphNumberSum(graphs, 'openRerunCount');
  const staleRerunCleanupCount = graphNumberSum(graphs, 'staleRerunCleanupCount');
  const recentEvents = graphs.flatMap(({ source, graph }) => recordArray(graph.recentEvents).map((event) => ({
    ...event,
    sourceLabel: source.label,
    at: numberValue(event.at) || source.mtimeMs
  }))).sort((left, right) => numberValue(left.at) - numberValue(right.at)).slice(-12);
  const status = openBlockerCount ? 'blocked' : openHumanQuestionCount ? 'questions' : gateFailedCount ? 'review' : safeMergeCandidateCount ? 'ready' : 'clear';
  return {
    sourceFile: sourceFiles[0],
    sourceFiles,
    sourceKind: 'lifetime-rollup',
    sourceKinds,
    sourceStatus: sourceStatuses.length === 1 ? sourceStatuses[0] : sourceStatuses.length ? 'mixed' : 'unknown',
    sourceStatuses,
    graphMissing: graphMissingWarnings.length > 0,
    graphMissingWarningCount: graphMissingWarnings.length,
    graphMissingWarnings: graphMissingWarnings.slice(0, 12),
    nodeCount,
    edgeCount,
    blockerCount,
    openBlockerCount,
    humanQuestionCount,
    openHumanQuestionCount,
    safeMergeCandidateCount,
    decisionCount,
    terminalDecisionCount,
    terminalAcceptedCount,
    terminalRejectedCount,
    terminalRerunCount,
    gateCount,
    gatePassedCount: graphNumberSum(graphs, 'gatePassedCount'),
    gateFailedCount,
    staleCount,
    openStaleCount,
    rerunCount,
    openRerunCount,
    staleRerunCleanupCount,
    status,
    summaryLine: `${nodeCount} nodes, ${edgeCount} edges, ${decisionCount} decisions, and ${gateCount} gates across loaded runs.`,
    recentEvents
  };
}

function graphNumberSum(graphs: Array<{ graph: Record<string, unknown> }>, key: string): number {
  return graphs.reduce((sum, entry) => sum + numberValue(entry.graph[key]), 0);
}

function withDashboardRunGraphJobHealth(
  graph: Record<string, unknown> | undefined,
  jobs: Array<Record<string, unknown>>
): Record<string, unknown> | undefined {
  if (!graph) return undefined;
  const staleJobs = jobs.filter(dashboardGraphJobIsStale);
  const rerunJobs = jobs.filter(dashboardGraphJobIsRerun);
  const staleCleanupCount = staleJobs.filter(dashboardGraphJobIsCleanup).length;
  const rerunCleanupCount = rerunJobs.filter(dashboardGraphJobIsCleanup).length;
  const staleCount = Math.max(numberValue(graph.staleCount), staleJobs.length);
  const rerunCount = Math.max(numberValue(graph.rerunCount), rerunJobs.length);
  const staleRerunCleanupCount = Math.max(numberValue(graph.staleRerunCleanupCount), staleCleanupCount + rerunCleanupCount);
  return {
    ...graph,
    staleCount,
    rerunCount,
    staleRerunCleanupCount,
    openStaleCount: Math.max(numberValue(graph.openStaleCount), Math.max(0, staleJobs.length - staleCleanupCount)),
    openRerunCount: Math.max(numberValue(graph.openRerunCount), Math.max(0, rerunJobs.length - rerunCleanupCount))
  };
}

function dashboardGraphJobIsStale(job: Record<string, unknown>): boolean {
  const values = [
    job.bucket,
    job.originalBucket,
    job.status,
    job.originalStatus,
    job.disposition,
    job.originalDisposition,
    job.mergeReadiness,
    ...(stringArray(job.reasons)),
    ...(stringArray(job.originalReasons))
  ].map(normalized);
  return job.staleAgainstHead === true || values.some((value) => value.includes('stale'));
}

function dashboardGraphJobIsRerun(job: Record<string, unknown>): boolean {
  const values = [
    job.bucket,
    job.originalBucket,
    job.status,
    job.originalStatus,
    job.disposition,
    job.originalDisposition,
    job.mergeReadiness,
    ...(stringArray(job.reasons)),
    ...(stringArray(job.originalReasons))
  ].map(normalized);
  return values.some((value) => value.includes('rerun'));
}

function dashboardGraphJobIsCleanup(job: Record<string, unknown>): boolean {
  if (isResolvedCoordinatorReviewRecord(job)) return true;
  const status = normalized(job.status);
  const decision = normalized(job.coordinatorDecisionStatus ?? recordValue(job.coordinatorDecision).status);
  return status === 'completed' && ['accepted', 'accepted-applied', 'applied', 'committed', 'rejected', 'rerun', 'superseded'].includes(decision);
}

function lifetimeScopedId(source: LifetimeDashboardSource, id: string): string {
  return `${source.id}:${id}`.replaceAll(/[^\w:.-]+/g, '-');
}

interface LifetimeAutoDrainDelayRecord {
  source: string;
  sourceLabel: string;
  reason: string;
  skippedReason: string;
  dirtyPathCount: number;
  dirtyPaths: string[];
  remainingReadyCount: number;
  generatedAt: number;
}

function lifetimeAutoDrainDelayRecords(
  entries: Array<{ source: LifetimeDashboardSource; snapshot: Record<string, unknown> }>
): LifetimeAutoDrainDelayRecord[] {
  return entries
    .map(({ source, snapshot }) => lifetimeAutoDrainDelayRecord(source, snapshot))
    .filter((record): record is LifetimeAutoDrainDelayRecord => Boolean(record));
}

function lifetimeAutoDrainDelayRecord(
  source: LifetimeDashboardSource,
  snapshot: Record<string, unknown>
): LifetimeAutoDrainDelayRecord | undefined {
  const rawRun = recordValue(recordValue(snapshot.raw).run);
  const autoDrain = recordValue(rawRun.autoDrain);
  const skippedReason = textValue(autoDrain.skippedReason, '');
  if (skippedReason !== 'dirty-worktree') return undefined;
  const summary = recordValue(autoDrain.summary);
  const dirtyPaths = stringArray(autoDrain.dirtyPaths);
  return {
    source: source.path,
    sourceLabel: source.label,
    reason: 'apply-delayed-by-dirty-worktree',
    skippedReason,
    dirtyPathCount: dirtyPaths.length,
    dirtyPaths: dirtyPaths.slice(0, 12),
    remainingReadyCount: numberValue(summary.remainingReadyCount),
    generatedAt: numberValue(autoDrain.generatedAt) || numberValue(snapshot.generatedAt) || source.mtimeMs
  };
}

async function enrichLifetimeRunSnapshotEvidence(
  cwd: string,
  source: LifetimeDashboardSource,
  snapshot: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (source.kind !== 'run' || !source.run) return snapshot;
  const runRoot = safeCwdRelativeDirectory(cwd, source.run);
  if (!runRoot) return snapshot;
  const jobs = recordArray(snapshot.jobs);
  if (!jobs.length) return snapshot;
  const enrichedJobs = await Promise.all(jobs.map((job) => enrichLifetimeRunJobEvidence(cwd, runRoot, job)));
  return {
    ...snapshot,
    jobs: enrichedJobs
  };
}

async function enrichLifetimeRunJobEvidence(
  cwd: string,
  runRoot: string,
  job: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const jobDir = await findBestRawRunJobDir(runRoot, rawRunJobIdCandidates(job));
  if (!jobDir) return job;
  const evidenceDir = path.join(jobDir, 'evidence');
  const eventsPath = path.join(jobDir, 'codex-events.jsonl');
  const rootMerge = recordValue(await readJsonFile(path.join(jobDir, 'merge.json')));
  const evidenceMerge = recordValue(await readJsonFile(path.join(evidenceDir, 'merge.json')));
  const evidenceRecord = recordValue(await readJsonFile(path.join(evidenceDir, 'evidence.json')));
  const merge = Object.keys(rootMerge).length ? rootMerge : evidenceMerge;
  const rawPatchPath = await firstExistingRelativePath(cwd, rawRunPatchCandidates(jobDir));
  const usage = await readCodexEventUsageSummary(eventsPath);
  const evidencePaths = await existingRelativePaths(cwd, [
    path.join(jobDir, 'last-message.md'),
    eventsPath,
    path.join(jobDir, 'merge.json'),
    path.join(evidenceDir, 'last-message.md'),
    path.join(evidenceDir, 'handoff.md'),
    path.join(evidenceDir, 'evidence.json'),
    path.join(evidenceDir, 'merge.json'),
    path.join(evidenceDir, 'human-question.json'),
    path.join(evidenceDir, 'resource-allocation.json'),
    path.join(evidenceDir, 'model-availability.json'),
    ...rawRunPatchCandidates(jobDir)
  ]);
  if (!evidencePaths.length && !rawPatchPath && !Object.keys(merge).length) return job;

  const patchChangedPaths = await readPatchChangedPathList(cwd, rawPatchPath);
  const changedPaths = uniquePaths([
    ...stringArray(job.changedPaths),
    ...stringArray(merge.changedPaths),
    ...patchChangedPaths
  ]);
  const ownershipViolations = uniquePaths([
    ...stringArray(job.ownershipViolations),
    ...stringArray(merge.ownershipViolations)
  ]);
  const status = lifetimeRunEvidenceStatus(job, merge, evidencePaths);
  const bucket = lifetimeRunEvidenceBucket(job, status, evidencePaths, rawPatchPath);
  const collectReasonClasses = uniquePaths([
    ...stringArray(job.collectReasonClasses),
    status === 'failed' && evidencePaths.length ? 'worker failed with evidence' : 'raw run evidence discovered'
  ]);
  const mergedEvidencePaths = uniquePaths([...stringArray(job.evidencePaths), ...evidencePaths]);
  const commandEvidence = commandEvidenceFromRecords(job, merge, evidenceRecord);
  return withRecomputedCostFields({
    ...job,
    status,
    bucket,
    disposition: textValue(merge.disposition, textValue(job.disposition, status)),
    mergeReadiness: textValue(merge.mergeReadiness, textValue(job.mergeReadiness, status)),
    ...(rawPatchPath ? { patchPath: rawPatchPath, artifactPaths: uniquePaths([rawPatchPath, ...stringArray(job.artifactPaths)]) } : {}),
    changedPaths,
    changedPathCount: changedPaths.length || numberValue(job.changedPathCount),
    ownershipViolations,
    ownershipViolationCount: ownershipViolations.length || numberValue(job.ownershipViolationCount),
    ...(usage.inputTokens ? { actualInputTokens: usage.inputTokens, inputTokens: usage.inputTokens } : {}),
    ...(!usage.inputTokens && usage.estimatedInputTokens ? { estimatedInputTokens: usage.estimatedInputTokens } : {}),
    ...(usage.cachedInputTokens ? { cachedInputTokens: usage.cachedInputTokens } : {}),
    ...(usage.uncachedInputTokens ? { uncachedInputTokens: usage.uncachedInputTokens } : {}),
    ...(usage.outputTokens ? { actualOutputTokens: usage.outputTokens, outputTokens: usage.outputTokens } : {}),
    ...(usage.reasoningOutputTokens ? { reasoningOutputTokens: usage.reasoningOutputTokens } : {}),
    ...(usage.eventCount || usage.estimatedInputTokens ? {
      usage: {
        ...recordValue(job.usage),
        input_tokens: usage.inputTokens,
        cached_input_tokens: usage.cachedInputTokens,
        uncached_input_tokens: usage.uncachedInputTokens,
        output_tokens: usage.outputTokens,
        reasoning_output_tokens: usage.reasoningOutputTokens,
        estimated_input_tokens: usage.estimatedInputTokens,
        estimated_from_event_bytes: usage.estimatedFromEventBytes,
        source: usage.eventCount ? 'codex-events.jsonl' : 'codex-events.jsonl-estimate',
        event_count: usage.eventCount
      }
    } : {}),
    evidencePaths: mergedEvidencePaths,
    evidencePathCount: mergedEvidencePaths.length,
    reasons: stringArray(job.reasons).length ? stringArray(job.reasons) : stringArray(merge.reasons),
    commandsPassed: commandEvidence.passed,
    commandsFailed: commandEvidence.failed,
    collectReasonClasses,
    runEvidenceRecovered: true
  });
}

function rawRunJobIdCandidates(job: Record<string, unknown>): string[] {
  const values = [
    textValue(job.originalJobId, ''),
    textValue(job.jobId, ''),
    textValue(job.id, ''),
    textValue(job.taskId, '')
  ].filter(Boolean);
  const out = new Set<string>();
  for (const value of values) {
    out.add(value);
    const parts = value.split(':').filter(Boolean);
    if (parts.length) out.add(parts[parts.length - 1]);
  }
  return Array.from(out);
}

async function findBestRawRunJobDir(runRoot: string, candidates: string[]): Promise<string | undefined> {
  const matches = new Map<string, number>();
  for (const candidate of candidates) {
    const direct = path.join(runRoot, candidate);
    if (await rawRunJobHasArtifacts(direct)) matches.set(direct, await rawRunJobEvidenceScore(direct));
    for (const match of await findRawRunJobDirs(runRoot, candidate, 0)) {
      matches.set(match, await rawRunJobEvidenceScore(match));
    }
  }
  return Array.from(matches.entries()).sort((left, right) => right[1] - left[1] || right[0].localeCompare(left[0]))[0]?.[0];
}

async function rawRunJobEvidenceScore(jobDir: string): Promise<number> {
  let score = 0;
  for (const [relative, weight] of [
    ['last-message.md', 100],
    ['evidence/merge.json', 80],
    ['merge.json', 80],
    ['evidence/evidence.json', 50],
    ['evidence/changes.patch', 40],
    ['changes.patch', 40],
    ['codex-events.jsonl', 20]
  ] as const) {
    const stat = await fs.stat(path.join(jobDir, relative)).catch(() => undefined);
    if (stat?.isFile()) score += weight + Math.min(10, Math.floor(stat.size / 1024));
  }
  const stat = await fs.stat(jobDir).catch(() => undefined);
  return score + Math.floor((stat?.mtimeMs ?? 0) / 1_000_000_000);
}

function lifetimeRunEvidenceStatus(
  job: Record<string, unknown>,
  merge: Record<string, unknown>,
  evidencePaths: string[]
): string {
  const mergeStatus = textValue(coordinatorFacingMachineLabel(merge.status), '');
  if (mergeStatus) return mergeStatus;
  const status = textValue(coordinatorFacingMachineLabel(job.status), '');
  if (status) return status === 'failed' && evidencePaths.some((entry) => entry.endsWith('last-message.md')) ? 'completed' : status;
  return evidencePaths.some((entry) => entry.endsWith('last-message.md')) ? 'completed' : 'failed';
}

function lifetimeRunEvidenceBucket(
  job: Record<string, unknown>,
  status: string,
  evidencePaths: string[],
  patchPath: string | undefined
): string {
  const bucket = textValue(coordinatorFacingMachineLabel(job.bucket), '');
  if (status === 'running') return 'running';
  if (status === 'completed') return bucket && bucket !== 'failed-evidence' ? bucket : 'completed';
  if (status === 'failed' && (evidencePaths.length || patchPath)) return 'worker-failed';
  return bucket || (status === 'failed' ? 'failed-evidence' : status);
}

async function readLatestDrainCoordinatorSnapshot(cwd: string): Promise<Record<string, unknown> | undefined> {
  const root = path.join(cwd, 'agent-runs', 'frontier-swarm-codex');
  const drains = await findDrainCoordinatorRunDirs(root);
  const activeDrainRoot = drains[0] ? drainRootForRunDir(drains[0]) : '';
  const runDirs = drains
    .filter((runDir) => drainRootForRunDir(runDir) === activeDrainRoot)
    .slice(0, LIFETIME_DASHBOARD_MAX_DRAIN_RUNS);
  const jobs: Array<Record<string, unknown>> = [];
  for (const runDir of runDirs) jobs.push(...await readDrainCoordinatorJobs(cwd, runDir));
  if (!jobs.length) return undefined;
  const generatedAt = Math.max(...jobs.map((job) => numberValue(job.generatedAt)), Date.now());
  return {
    ok: true,
    generatedAt,
    cwd,
    sources: {
      activeDrain: runDirs[0],
      activeDrainSources: runDirs
    },
    summary: lifetimeDashboardSummary(jobs),
    lanes: lifetimeLaneRows(jobs),
    jobs,
    events: activeRunEvents(jobs),
    raw: {
      activeDrain: {
        runDirs,
        jobCount: jobs.length,
        runningCount: jobs.filter((job) => textValue(job.status, '') === 'running').length
      }
    }
  };
}

async function findDrainCoordinatorRunDirs(root: string): Promise<string[]> {
  const out: Array<{ dir: string; mtimeMs: number }> = [];
  const rootEntries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  for (const drain of rootEntries) {
    if (!drain.isDirectory() || !drain.name.startsWith('drain-')) continue;
    const drainDir = path.join(root, drain.name);
    const iterationEntries = await fs.readdir(drainDir, { withFileTypes: true }).catch(() => []);
    for (const iteration of iterationEntries) {
      if (!iteration.isDirectory() || !iteration.name.startsWith('iteration-')) continue;
      for (const runDirName of ['coordinator-run', 'worker-run']) {
        const runDir = path.join(drainDir, iteration.name, runDirName);
        const stat = await fs.stat(runDir).catch(() => undefined);
        if (stat?.isDirectory()) out.push({ dir: runDir, mtimeMs: stat.mtimeMs });
      }
    }
  }
  return out.sort((left, right) => right.mtimeMs - left.mtimeMs || right.dir.localeCompare(left.dir)).map((entry) => entry.dir);
}

function drainRootForRunDir(runDir: string): string {
  return path.dirname(path.dirname(runDir));
}

async function readDrainCoordinatorJobs(cwd: string, coordinatorRunDir: string): Promise<Array<Record<string, unknown>>> {
  const entries = await fs.readdir(coordinatorRunDir, { withFileTypes: true }).catch(() => []);
  const liveLines = liveProcessLinesForPath(coordinatorRunDir);
  const now = Date.now();
  const jobs: Array<Record<string, unknown>> = [];
  const seenJobIds = new Set<string>();
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'streams') continue;
    seenJobIds.add(entry.name);
    jobs.push(await readDrainCoordinatorJob(cwd, coordinatorRunDir, path.join(coordinatorRunDir, entry.name), liveLines, now));
  }
  const pidEntries = await readRunPidEntries(coordinatorRunDir);
  const planJobs = await readRunPlanJobs(coordinatorRunDir);
  for (const entry of pidEntries) {
    const jobId = textValue(entry.jobId, '');
    if (!jobId || seenJobIds.has(jobId)) continue;
    jobs.push(readDrainPidManifestJob(cwd, coordinatorRunDir, entry, planJobs.get(jobId), now));
  }
  return jobs.sort((left, right) => textValue(left.lane, '').localeCompare(textValue(right.lane, '')));
}

async function readRunPidEntries(runDir: string): Promise<Array<Record<string, unknown>>> {
  const pidManifest = recordValue(await readJsonFile(path.join(runDir, 'pids.json')));
  return recordArray(pidManifest.entries).filter((entry) => textValue(entry.role, '') === 'codex');
}

async function readRunPlanJobs(runDir: string): Promise<Map<string, Record<string, unknown>>> {
  const plan = recordValue(await readJsonFile(path.join(runDir, 'swarm-plan.json')));
  const entries: Array<[string, Record<string, unknown>]> = [];
  for (const job of recordArray(plan.jobs)) {
    const id = textValue(job.id, '');
    if (id) entries.push([id, job]);
  }
  return new Map(entries);
}

function readDrainPidManifestJob(
  cwd: string,
  coordinatorRunDir: string,
  entry: Record<string, unknown>,
  planJob: Record<string, unknown> | undefined,
  now: number
): Record<string, unknown> {
  const jobId = textValue(entry.jobId, 'job');
  const runKind = path.basename(coordinatorRunDir) === 'worker-run' ? 'worker' : 'coordinator';
  const task = recordValue(planJob?.task);
  const compute = recordValue(planJob?.compute);
  const command = stringArray(entry.command);
  const live = isProcessLive(numberValue(entry.pid), entry);
  const status = live ? 'running' : 'failed';
  const startedAt = numberValue(entry.startedAt);
  const lane = textValue(planJob?.lane ?? task.lane, drainCoordinatorLane(jobId, runKind));
  return withRecomputedCostFields({
    id: jobId,
    jobId,
    originalJobId: jobId,
    taskId: textValue(planJob?.taskId ?? task.id, jobId),
    title: textValue(planJob?.title ?? task.title, runKind === 'coordinator' ? `Coordinate lane review for ${lane}` : `Continue ${lane} work`),
    lane,
    status,
    bucket: status === 'running' ? 'running' : 'failed-evidence',
    disposition: status === 'running' ? 'active' : 'failed',
    agentId: jobId,
    workerId: jobId,
    model: textValue(compute.model, commandOptionValue(command, '--model') || 'gpt-5.5'),
    computeId: textValue(compute.id, runKind === 'coordinator' ? 'coordinator-agent' : 'continuation-worker'),
    reasoningEffort: textValue(compute.reasoningEffort, ''),
    startedAt: startedAt || undefined,
    durationMs: startedAt ? Math.max(0, now - startedAt) : 0,
    evidencePaths: [],
    evidencePathCount: 0,
    changedPathCount: 0,
    collectReasonClasses: status === 'running' ? [`active drain ${runKind}`] : [`missing ${runKind} output`],
    mergeReadiness: status,
    sourceRun: path.relative(cwd, coordinatorRunDir),
    sourceLabel: path.relative(cwd, coordinatorRunDir),
    generatedAt: now
  });
}

function commandOptionValue(command: readonly string[], option: string): string {
  const index = command.indexOf(option);
  return index >= 0 ? textValue(command[index + 1], '') : '';
}

async function readDrainCoordinatorJob(
  cwd: string,
  coordinatorRunDir: string,
  jobDir: string,
  liveLines: readonly string[],
  now: number
): Promise<Record<string, unknown>> {
  const jobId = path.basename(jobDir);
  const runKind = path.basename(coordinatorRunDir) === 'worker-run' ? 'worker' : 'coordinator';
  const evidenceDir = path.join(jobDir, 'evidence');
  const eventsPath = path.join(jobDir, 'codex-events.jsonl');
  const lastMessagePath = path.join(jobDir, 'last-message.md');
  const decisionsJson = path.join(evidenceDir, 'coordinator-decisions.json');
  const decisionsJsonl = path.join(evidenceDir, 'coordinator-decisions.jsonl');
  const modelAvailability = recordValue(await readJsonFile(path.join(evidenceDir, 'model-availability.json')));
  const evidenceRecord = recordValue(await readJsonFile(path.join(evidenceDir, 'evidence.json')));
  const eventStat = await fs.stat(eventsPath).catch(() => undefined);
  const lastMessageStat = await fs.stat(lastMessagePath).catch(() => undefined);
  const decisionJsonStat = await fs.stat(decisionsJson).catch(() => undefined);
  const decisionJsonlStat = await fs.stat(decisionsJsonl).catch(() => undefined);
  const live = liveLines.some((line) => line.includes(jobDir) || line.includes(jobId));
  const hasDecision = Boolean(decisionJsonStat?.isFile() || decisionJsonlStat?.isFile());
  const failed = !live && !lastMessageStat && !hasDecision && await codexEventsHaveFailure(eventsPath);
  const status = live && !lastMessageStat
    ? 'running'
    : lastMessageStat || hasDecision
      ? 'completed'
      : 'failed';
  const startedAt = numberValue(eventStat?.birthtimeMs ?? eventStat?.ctimeMs ?? eventStat?.mtimeMs);
  const finishedAt = status === 'running'
    ? undefined
    : Math.max(numberValue(lastMessageStat?.mtimeMs), numberValue(decisionJsonStat?.mtimeMs), numberValue(decisionJsonlStat?.mtimeMs), numberValue(eventStat?.mtimeMs));
  const usage = await readCodexEventUsageSummary(eventsPath);
  const lane = drainCoordinatorLane(jobId, runKind);
  const evidencePaths = await existingRelativePaths(cwd, [
    eventsPath,
    lastMessagePath,
    decisionsJson,
    decisionsJsonl,
    path.join(evidenceDir, 'merge.json'),
    path.join(evidenceDir, 'evidence.json'),
    path.join(evidenceDir, 'human-question.json'),
    path.join(evidenceDir, 'resource-allocation.json'),
    path.join(evidenceDir, 'model-availability.json')
  ]);
  const commandEvidence = commandEvidenceFromRecords(evidenceRecord);
  return withRecomputedCostFields({
    id: jobId,
    originalJobId: jobId,
    taskId: jobId,
    title: runKind === 'coordinator' ? `Coordinate lane review for ${lane}` : `Continue ${lane} work`,
    lane,
    status,
    bucket: status === 'running' ? 'running' : status === 'completed' ? 'completed' : 'failed-evidence',
    disposition: status === 'running' ? 'active' : status,
    agentId: jobId,
    workerId: jobId,
    model: textValue(modelAvailability.effectiveModel ?? modelAvailability.requestedModel, 'gpt-5.5'),
    computeId: runKind === 'coordinator' ? 'coordinator-agent' : 'continuation-worker',
    startedAt: startedAt || undefined,
    ...(finishedAt ? { finishedAt } : {}),
    durationMs: startedAt ? Math.max(0, (finishedAt ?? now) - startedAt) : 0,
    ...(usage.inputTokens ? { actualInputTokens: usage.inputTokens, inputTokens: usage.inputTokens } : {}),
    ...(!usage.inputTokens && usage.estimatedInputTokens ? { estimatedInputTokens: usage.estimatedInputTokens } : {}),
    ...(usage.cachedInputTokens ? { cachedInputTokens: usage.cachedInputTokens } : {}),
    ...(usage.uncachedInputTokens ? { uncachedInputTokens: usage.uncachedInputTokens } : {}),
    ...(usage.outputTokens ? { actualOutputTokens: usage.outputTokens, outputTokens: usage.outputTokens } : {}),
    ...(usage.reasoningOutputTokens ? { reasoningOutputTokens: usage.reasoningOutputTokens } : {}),
    ...(usage.eventCount ? { usage: { ...usage, source: 'codex-events.jsonl' } } : {}),
    evidencePaths,
    evidencePathCount: evidencePaths.length,
    commandsPassed: commandEvidence.passed,
    commandsFailed: commandEvidence.failed,
    changedPathCount: 0,
    collectReasonClasses: status === 'running' ? [`active drain ${runKind}`] : [`drain ${runKind}`],
    mergeReadiness: status,
    sourceRun: path.relative(cwd, coordinatorRunDir),
    sourceLabel: path.relative(cwd, coordinatorRunDir),
    generatedAt: numberValue(finishedAt) || numberValue(eventStat?.mtimeMs) || now
  });
}

function liveProcessLinesForPath(needle: string): string[] {
  const result = spawnSync('pgrep', ['-fl', needle], { encoding: 'utf8' });
  if (result.status !== 0 && !result.stdout) return [];
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

async function existingRelativePaths(cwd: string, files: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const file of files) {
    const stat = await fs.stat(file).catch(() => undefined);
    if (stat?.isFile()) out.push(path.relative(cwd, file));
  }
  return out;
}

async function firstExistingRelativePath(cwd: string, files: string[]): Promise<string | undefined> {
  for (const file of files) {
    const stat = await fs.stat(file).catch(() => undefined);
    if (stat?.isFile()) return path.relative(cwd, file);
  }
  return undefined;
}

function rawRunPatchCandidates(jobDir: string): string[] {
  return [
    path.join(jobDir, 'changes.patch'),
    path.join(jobDir, 'source.patch'),
    path.join(jobDir, 'evidence', 'changes.patch'),
    path.join(jobDir, 'evidence', 'source.patch')
  ];
}

async function readPatchChangedPathList(cwd: string, patchPath: string | undefined): Promise<string[]> {
  if (!patchPath) return [];
  const absolute = path.resolve(cwd, patchPath);
  if (!isPathInside(cwd, absolute)) return [];
  const stat = await fs.stat(absolute).catch(() => undefined);
  if (!stat?.isFile() || stat.size > TASK_DETAIL_PATCH_MAX_BYTES) return [];
  const patch = await fs.readFile(absolute, 'utf8');
  return uniquePaths(parseUnifiedPatchFiles(patch).map((file) => file.path).filter(Boolean));
}

async function codexEventsHaveFailure(file: string): Promise<boolean> {
  const text = await fs.readFile(file, 'utf8').catch(() => '');
  return /"type":"(?:error|turn\.failed)"/.test(text);
}

async function codexEventsHaveQuotaLimit(file: string): Promise<boolean> {
  const text = await fs.readFile(file, 'utf8').catch(() => '');
  return /usage limit|quota|purchase more credits/i.test(text);
}

function drainCoordinatorLane(jobId: string, runKind = 'coordinator'): string {
  if (runKind === 'worker') {
    for (const marker of [
      '-continuation-rerun-',
      '-continuation-supersede-',
      '-continuation-reject-',
      '-continuation-',
      '-queue-candidate-package-'
    ]) {
      const index = jobId.indexOf(marker);
      if (index > 0) return jobId.slice(0, index);
    }
  }
  const marker = '-coordinator-agent-';
  const index = jobId.indexOf(marker);
  return index > 0 ? jobId.slice(0, index) : jobId;
}

function mergeLifetimeDrainCoordinatorSnapshot(
  lifetime: Record<string, unknown>,
  drain: Record<string, unknown> | undefined
): Record<string, unknown> {
  const drainJobs = recordArray(drain?.jobs);
  if (!drainJobs.length) return lifetime;
  const existingJobs = recordArray(lifetime.jobs).filter((job) => {
    const source = textValue(job.sourceRun ?? job.sourceLabel, '');
    return !/agent-runs\/frontier-swarm-codex\/drain-.*\/(?:coordinator-run|worker-run)/.test(source);
  });
  const jobs = [...drainJobs, ...existingJobs].slice(0, LIFETIME_DASHBOARD_MAX_JOBS);
  const events = [...recordArray(lifetime.events), ...recordArray(drain?.events)]
    .sort((left, right) => numberValue(left.at) - numberValue(right.at))
    .slice(-160);
  return {
    ...lifetime,
    generatedAt: Math.max(numberValue(lifetime.generatedAt), numberValue(drain?.generatedAt), Date.now()),
    sources: {
      ...recordValue(lifetime.sources),
      ...recordValue(drain?.sources)
    },
    summary: lifetimeSummaryWithExistingGraph(lifetime, jobs),
    health: lifetimeHealthSummary(jobs),
    lanes: lifetimeLaneRows(jobs),
    jobs,
    events,
    raw: {
      ...recordValue(lifetime.raw),
      activeDrain: recordValue(recordValue(drain?.raw).activeDrain)
    }
  };
}

function mergeLifetimeActiveRunSnapshot(
  lifetime: Record<string, unknown>,
  active: Record<string, unknown> | undefined
): Record<string, unknown> {
  const activeJobs = recordArray(active?.jobs).filter((job) => textValue(job.status, '') === 'running');
  if (!activeJobs.length) return lifetime;
  const activeKeys = new Set(activeJobs.map(lifetimeJobDedupeKey).filter(Boolean));
  const existingJobs = recordArray(lifetime.jobs).filter((job) => !activeKeys.has(lifetimeJobDedupeKey(job)));
  const jobs = [...activeJobs, ...existingJobs].slice(0, LIFETIME_DASHBOARD_MAX_JOBS);
  const activeAgents = activeAgentsFromJobs(jobs);
  const events = [...recordArray(lifetime.events), ...recordArray(active?.events)]
    .sort((left, right) => numberValue(left.at) - numberValue(right.at))
    .slice(-160);
  return {
    ...lifetime,
    generatedAt: Math.max(numberValue(lifetime.generatedAt), numberValue(active?.generatedAt), Date.now()),
    sources: {
      ...recordValue(lifetime.sources),
      ...recordValue(active?.sources)
    },
    summary: lifetimeSummaryWithExistingGraph(lifetime, jobs),
    health: lifetimeHealthSummary(jobs),
    lanes: lifetimeLaneRows(jobs),
    capacity: lifetimeCapacitySummary(
      {
        entries: recordArray(recordValue(lifetime.backlog).entries),
        manifests: recordArray(recordValue(recordValue(lifetime.raw).lifetime).manifests) as unknown as LifetimeQueueCapacityManifest[],
        sourceCount: numberValue(recordValue(lifetime.backlog).entryCount),
        paths: stringArray(recordValue(recordValue(lifetime.raw).lifetime).queueSources),
        generatedAt: numberValue(lifetime.generatedAt)
      },
      jobs,
      recordArray(recordValue(lifetime.backlog).entries)
    ),
    jobs,
    activeAgents,
    events,
    raw: {
      ...recordValue(lifetime.raw),
      activeRuns: recordValue(recordValue(active?.raw).activeRuns)
    }
  };
}

async function readLifetimeActiveRunSnapshot(options: NormalizedLoomUiServerOptions): Promise<Record<string, unknown> | undefined> {
  const jobs = await readLiveCodexProcessJobs(options.cwd);
  const sources = uniquePaths(jobs.map((job) => textValue(job.sourceRun, '')).filter(Boolean));
  if (!jobs.length) return undefined;
  const generatedAt = Date.now();
  return {
    ok: true,
    generatedAt,
    cwd: options.cwd,
    sources: {
      activeRuns: sources,
      activeRunCount: sources.length
    },
    summary: lifetimeDashboardSummary(jobs),
    lanes: lifetimeLaneRows(jobs),
    jobs,
    activeAgents: activeAgentsFromJobs(jobs),
    events: activeRunEvents(jobs),
    raw: {
      activeRuns: {
        runDirs: sources,
        jobCount: jobs.length,
        runningCount: jobs.length
      }
    }
  };
}

async function readLiveCodexProcessJobs(cwd: string): Promise<Array<Record<string, unknown>>> {
  if (process.platform === 'win32') return [];
  const result = spawnSync('ps', ['-axo', 'pid,ppid,etime,command'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  });
  if (result.status !== 0 && !result.stdout) return [];
  const agentWorktreeRoot = `${path.join(cwd, 'agent-worktrees')}/`;
  const now = Date.now();
  const byWorker = new Map<string, {
    pid: number;
    etime: string;
    cd: string;
    model: string;
    outputLastMessage: string;
    runDir: string;
    jobId: string;
  }>();
  for (const line of result.stdout.split(/\r?\n/)) {
    if (!line.includes('codex ') || !line.includes(' exec ') || !line.includes(agentWorktreeRoot)) continue;
    const fields = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.+)$/.exec(line);
    if (!fields) continue;
    const command = fields[4];
    const cd = commandOptionValue(splitCommandWords(command), '--cd') || regexCommandOption(command, '--cd');
    if (!cd.startsWith(agentWorktreeRoot)) continue;
    const outputLastMessage = commandOptionValue(splitCommandWords(command), '--output-last-message') || regexCommandOption(command, '--output-last-message');
    const model = commandOptionValue(splitCommandWords(command), '--model') || regexCommandOption(command, '--model') || '';
    const runDir = outputLastMessage ? path.dirname(path.dirname(outputLastMessage)) : '';
    const jobId = outputLastMessage ? path.basename(path.dirname(outputLastMessage)) : path.basename(cd);
    const key = outputLastMessage || cd;
    const pid = Number(fields[1]);
    const current = byWorker.get(key);
    if (!current || pid < current.pid) byWorker.set(key, { pid, etime: fields[3], cd, model, outputLastMessage, runDir, jobId });
  }
  const planCache = new Map<string, Promise<Map<string, Record<string, unknown>>>>();
  const jobs: Array<Record<string, unknown>> = [];
  for (const worker of byWorker.values()) {
    const relativeRun = worker.runDir && isPathInside(cwd, worker.runDir) ? path.relative(cwd, worker.runDir) : '';
    const planJobs = worker.runDir
      ? await (planCache.get(worker.runDir) ?? planCache.set(worker.runDir, readRunPlanJobs(worker.runDir)).get(worker.runDir)!)
      : new Map<string, Record<string, unknown>>();
    const planJob = planJobs.get(worker.jobId);
    const task = recordValue(planJob?.task);
    const compute = recordValue(planJob?.compute);
    const startedAt = now - parsePsElapsedMs(worker.etime);
    const title = textValue(planJob?.title ?? task.title, humanizeWorkerJobId(worker.jobId));
    const lane = textValue(planJob?.lane ?? task.lane, inferLaneFromWorkerJobId(worker.jobId));
    jobs.push({
      id: relativeRun ? `run:${relativeRun.replaceAll(/[^\w:.-]+/g, '-')}:${worker.jobId}` : worker.jobId,
      originalJobId: worker.jobId,
      taskId: textValue(planJob?.taskId ?? task.id, worker.jobId),
      title,
      lane,
      status: 'running',
      bucket: 'running',
      disposition: 'active',
      agentId: worker.jobId,
      workerId: worker.jobId,
      model: textValue(compute.model, worker.model),
      computeId: textValue(compute.id, ''),
      reasoningEffort: textValue(compute.reasoningEffort, ''),
      startedAt,
      durationMs: Math.max(0, now - startedAt),
      evidencePaths: worker.outputLastMessage && isPathInside(cwd, worker.outputLastMessage) ? [path.relative(cwd, worker.outputLastMessage)] : [],
      evidencePathCount: worker.outputLastMessage ? 1 : 0,
      changedPathCount: 0,
      collectReasonClasses: ['active worker process'],
      mergeReadiness: 'running',
      sourceRun: relativeRun,
      sourceLabel: relativeRun ? lifetimeSourceLabel(relativeRun) : 'active-process',
      generatedAt: now
    });
  }
  return jobs.sort((left, right) => textValue(left.lane, '').localeCompare(textValue(right.lane, '')) || textValue(left.title, '').localeCompare(textValue(right.title, '')));
}

function regexCommandOption(command: string, option: string): string {
  const escaped = option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escaped}\\s+([^\\s]+)`).exec(command);
  return match?.[1] ?? '';
}

function splitCommandWords(command: string): string[] {
  return command.match(/"[^"]*"|'[^']*'|\S+/g)?.map((word) => word.replace(/^(['"])(.*)\1$/u, '$2')) ?? [];
}

function parsePsElapsedMs(value: string): number {
  const daySplit = value.split('-');
  const days = daySplit.length === 2 ? Number(daySplit[0]) || 0 : 0;
  const time = daySplit.at(-1) ?? '';
  const parts = time.split(':').map((part) => Number(part) || 0);
  const [hours, minutes, seconds] = parts.length === 3 ? parts : [0, parts[0] ?? 0, parts[1] ?? 0];
  return (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
}

function inferLaneFromWorkerJobId(jobId: string): string {
  const parts = jobId.split('-');
  const half = Math.floor(parts.length / 2);
  if (half > 0 && parts.slice(0, half).join('-') === parts.slice(half, half * 2).join('-')) return parts.slice(0, half).join('-');
  return parts.slice(0, Math.max(1, parts.length - 1)).join('-');
}

function humanizeWorkerJobId(jobId: string): string {
  return inferLaneFromWorkerJobId(jobId).split('-').filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ') || jobId;
}

async function findLifetimeActiveRunDirs(cwd: string): Promise<string[]> {
  const root = path.join(cwd, 'agent-runs');
  const stat = await fs.stat(root).catch(() => undefined);
  if (!stat?.isDirectory()) return [];
  const resetAt = await readLifetimeDashboardResetCutoff(root);
  const files = await findPidManifestFiles(root, LIFETIME_DASHBOARD_SCAN_MAX_DEPTH, LIFETIME_DASHBOARD_SCAN_MAX_FILES, resetAt);
  const candidates = await Promise.all(files.map(async (file) => ({
    file,
    dir: path.dirname(file),
    mtimeMs: (await fs.stat(file).catch(() => undefined))?.mtimeMs ?? 0
  })));
  const out: string[] = [];
  for (const candidate of candidates.sort((left, right) => right.mtimeMs - left.mtimeMs || right.file.localeCompare(left.file))) {
    if (out.length >= LIFETIME_DASHBOARD_MAX_ACTIVE_PID_RUNS) break;
    if (await pidManifestHasLiveCodexEntry(candidate.file)) out.push(candidate.dir);
  }
  return uniquePaths(out);
}

async function findPidManifestFiles(root: string, maxDepth: number, maxFiles: number, resetAt: number): Promise<string[]> {
  const out: string[] = [];
  const skipDirs = new Set(['.git', 'node_modules', 'dist', 'coverage', 'evidence', 'streams', 'patch-scores', 'apply-ledger', 'artifact-index']);
  async function walk(current: string, depth: number): Promise<void> {
    if (out.length >= maxFiles || depth > maxDepth) return;
    const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (out.length >= maxFiles) return;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name) || entry.name.startsWith('.')) continue;
        if (resetAt && depth === 0) {
          const dirStat = await fs.stat(absolute).catch(() => undefined);
          if ((dirStat?.mtimeMs ?? 0) <= resetAt) continue;
        }
        await walk(absolute, depth + 1);
      } else if (entry.isFile() && entry.name === 'pids.json') {
        out.push(absolute);
      }
    }
  }
  await walk(root, 0);
  return out;
}

async function pidManifestHasLiveCodexEntry(file: string): Promise<boolean> {
  const manifest = recordValue(await readJsonFile(file));
  return recordArray(manifest.entries)
    .filter((entry) => textValue(entry.role, '') === 'codex')
    .some((entry) => isProcessLive(numberValue(entry.pid), entry));
}

async function readCoordinatorReviewDecisions(cwd: string): Promise<CoordinatorReviewDecision[]> {
  const file = coordinatorReviewDecisionPath(cwd);
  const raw = await readJsonFile(file);
  if (Array.isArray(raw)) return raw.map(recordValue).filter((entry) => Object.keys(entry).length);
  const record = recordValue(raw);
  return recordArray(record.decisions ?? record.entries);
}

function coordinatorReviewDecisionPath(cwd: string): string {
  return path.join(cwd, 'agent-runs', REVIEW_DECISIONS_FILE);
}

async function readAutonomousMergeDecisions(cwd: string): Promise<CoordinatorReviewDecision[]> {
  const root = path.join(cwd, 'agent-runs');
  const stat = await fs.stat(root).catch(() => undefined);
  if (!stat?.isDirectory()) return [];
  const files = await findAutonomousMergeDecisionFiles(root);
  const out: CoordinatorReviewDecision[] = [];
  for (const file of files) {
    const text = await fs.readFile(file, 'utf8').catch(() => '');
    for (const line of text.split(/\r?\n/u)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const raw = safeJsonObject(trimmed);
      if (!raw) continue;
      const normalizedDecision = normalizeAutonomousMergeDecision(cwd, file, raw);
      if (normalizedDecision) out.push(normalizedDecision);
    }
  }
  return out.sort(compareCoordinatorReviewDecisionRecency);
}

async function findAutonomousMergeDecisionFiles(root: string): Promise<string[]> {
  const out: Array<{ file: string; mtimeMs: number }> = [];
  async function walk(current: string, depth: number): Promise<void> {
    if (out.length >= LIFETIME_DASHBOARD_MAX_AUTONOMOUS_DECISION_FILES || depth > LIFETIME_DASHBOARD_SCAN_MAX_DEPTH) return;
    const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (out.length >= LIFETIME_DASHBOARD_MAX_AUTONOMOUS_DECISION_FILES) return;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'artifact-store' || entry.name.startsWith('.')) continue;
        await walk(absolute, depth + 1);
      } else if (entry.isFile() && entry.name === 'autonomous-merge-decisions.jsonl') {
        const stat = await fs.stat(absolute).catch(() => undefined);
        out.push({ file: absolute, mtimeMs: stat?.mtimeMs ?? 0 });
      }
    }
  }
  await walk(root, 0);
  return out.sort((left, right) => right.mtimeMs - left.mtimeMs || right.file.localeCompare(left.file)).map((entry) => entry.file);
}

function normalizeAutonomousMergeDecision(cwd: string, file: string, raw: Record<string, unknown>): CoordinatorReviewDecision | undefined {
  const status = autonomousDecisionStatus(textValue(raw.status ?? raw.decision, ''));
  if (!status) return undefined;
  const ids = Array.from(new Set([
    textValue(raw.jobId, ''),
    textValue(raw.taskId, ''),
    ...stringArray(raw.queueItemIds),
    ...stringArray(raw.queueKeys).map((key) => key.replace(/^(?:queue|task|job):/u, ''))
  ].filter(Boolean)));
  if (!ids.length) return undefined;
  const decidedAtMs = Math.max(
    numberValue(raw.finishedAt),
    numberValue(raw.startedAt),
    Date.parse(textValue(raw.finishedAtIso ?? raw.decidedAt ?? raw.generatedAt, '')) || 0
  );
  const relativeFile = path.relative(cwd, file);
  return {
    id: textValue(raw.id, ids[0]),
    jobId: textValue(raw.jobId, ''),
    taskId: textValue(raw.taskId, ''),
    matchIds: ids,
    status,
    decision: status,
    reason: textValue(raw.reason, ''),
    decidedAt: decidedAtMs ? new Date(decidedAtMs).toISOString() : '',
    decidedAtMs,
    sourceArtifact: relativeFile,
    sourceKind: 'autonomous-merge-decision',
    latestPath: textValue(raw.bundlePath ?? raw.patchPath, relativeFile),
    autonomousDecision: raw
  };
}

function autonomousDecisionStatus(value: string): string {
  const status = normalized(value);
  if (status === 'committed' || status === 'applied') return status;
  if (status === 'accepted' || status === 'accepted-applied') return 'applied';
  if (status === 'rejected' || status === 'rerun' || status === 'superseded') return status;
  if (status === 'conflict' || status === 'conflict-blocked') return 'conflict-blocked';
  if (status === 'human-blocked' || status === 'human-question') return 'human-blocked';
  return status;
}

function mergeReviewDecisionLists(...groups: CoordinatorReviewDecision[][]): CoordinatorReviewDecision[] {
  return groups.flat().sort(compareCoordinatorReviewDecisionRecency);
}

function compareCoordinatorReviewDecisionRecency(left: CoordinatorReviewDecision, right: CoordinatorReviewDecision): number {
  return decisionTime(right) - decisionTime(left)
    || textValue(right.sourceArtifact ?? right.latestPath, '').localeCompare(textValue(left.sourceArtifact ?? left.latestPath, ''));
}

function decisionTime(decision: CoordinatorReviewDecision): number {
  return numberValue(decision.decidedAtMs)
    || numberValue(decision.finishedAt)
    || numberValue(decision.startedAt)
    || Date.parse(textValue(decision.decidedAt, ''))
    || 0;
}

function autonomousDecisionSourceSummary(decisions: CoordinatorReviewDecision[]): Record<string, unknown> {
  const files = Array.from(new Set(decisions.map((decision) => textValue(decision.sourceArtifact, '')).filter(Boolean)));
  return {
    count: decisions.length,
    fileCount: files.length,
    files: files.slice(0, 20)
  };
}

function safeJsonObject(value: string): Record<string, unknown> | undefined {
  try {
    return recordValue(JSON.parse(value));
  } catch {
    return undefined;
  }
}

function applyCoordinatorReviewDecisions(jobs: unknown[], decisions: CoordinatorReviewDecision[]): Array<Record<string, unknown>> {
  const records = jobs
    .map(recordValue)
    .filter((job) => Object.keys(job).length)
    .map(normalizeCoordinatorFacingJob);
  if (!decisions.length) return records;
  return records.map((record) => {
    const decision = decisions.find((entry) => coordinatorReviewDecisionMatches(record, entry));
    if (!decision) return record;
    const status = textValue(decision.status ?? decision.decision, 'resolved');
    const resolved = isResolvedCoordinatorDecision(status);
    const decided = {
      ...record,
      coordinatorDecision: decision,
      coordinatorDecisionStatus: status,
      coordinatorDecisionAt: textValue(decision.decidedAt, ''),
      reviewResolved: resolved,
      ...(resolved ? { disposition: status } : {})
    };
    return resolved ? markCoordinatorReviewResolved(decided, status) : decided;
  });
}

function reviewDecisionAdjustedSummary(
  summary: Record<string, unknown>,
  jobs: Array<Record<string, unknown>>
): Record<string, unknown> {
  const recomputed = lifetimeDashboardSummary(jobs);
  const bucketCounts = countJobsByBucket(jobs);
  const openReviewCount = jobs.filter(isOpenCoordinatorReviewRecord).length;
  const resolvedReviewCount = jobs.filter(isResolvedCoordinatorReviewRecord).length;
  return {
    ...summary,
    ...recomputed,
    bucketCounts: {
      total: jobs.length,
      ...bucketCounts
    },
    needsCoordinatorReviewCount: openReviewCount,
    reviewResolvedCount: resolvedReviewCount
  };
}

function normalizeCoordinatorFacingJob(record: Record<string, unknown>): Record<string, unknown> {
  const status = coordinatorFacingMachineLabel(record.status);
  let bucket = coordinatorFacingMachineLabel(record.bucket);
  if (!bucket && status === 'completed') bucket = 'completed';
  else if (!bucket && status === 'running') bucket = 'running';
  else if (!bucket && status === 'failed') bucket = 'failed-evidence';
  else if (!bucket && status === 'blocked') bucket = 'blocked';
  let normalizedRecord: Record<string, unknown> = {
    ...record,
    bucket,
    status,
    disposition: coordinatorFacingMachineLabel(record.disposition),
    mergeReadiness: coordinatorFacingMachineLabel(record.mergeReadiness)
  };
  normalizedRecord = normalizeUnreasonedBlockedJob(normalizedRecord);
  normalizedRecord = normalizeHistoricalEvidenceFailureJob(normalizedRecord);
  if (!isResolvedCoordinatorReviewRecord(normalizedRecord)) return normalizedRecord;
  return markCoordinatorReviewResolved(normalizedRecord, textValue(normalizedRecord.coordinatorDecisionStatus ?? normalizedRecord.disposition, 'review-resolved'));
}

function normalizeUnreasonedBlockedJob(record: Record<string, unknown>): Record<string, unknown> {
  const status = normalized(record.status);
  const bucket = normalized(record.bucket);
  if (status !== 'blocked' && bucket !== 'blocked') return record;
  if (hasExplicitBlockedEvidence(record)) return record;
  return {
    ...record,
    originalBucket: record.originalBucket ?? record.bucket,
    originalStatus: record.originalStatus ?? record.status,
    originalDisposition: record.originalDisposition ?? record.disposition,
    bucket: 'needs-coordinator-review',
    status: 'completed',
    disposition: 'needs-coordinator-review',
    mergeReadiness: 'needs-coordinator-review',
    reasons: uniquePaths([...stringArray(record.reasons), 'blocked-status-without-blocker-evidence']),
    collectReasonClasses: uniquePaths([...stringArray(record.collectReasonClasses), 'run status needs coordinator classification'])
  };
}

function hasExplicitBlockedEvidence(record: Record<string, unknown>): boolean {
  const fields = [
    record.disposition,
    record.mergeReadiness,
    record.semanticReadiness,
    record.outcome,
    record.health
  ].map(normalized);
  if (fields.some((field) => ['blocked', 'conflict', 'conflict-blocked', 'human-blocked', 'human-needed'].includes(field))) return true;
  if (numberValue(record.blockerCount) > 0 || numberValue(record.openBlockerCount) > 0) return true;
  if (numberValue(record.humanActionCount) > 0 || numberValue(record.openHumanQuestionCount) > 0) return true;
  if (numberValue(record.commandsFailed) > 0 || numberValue(record.failedCheckCount) > 0) return true;
  const classes = [
    ...stringArray(record.reasons),
    ...stringArray(record.collectReasonClasses),
    ...stringArray(record.blockers),
    ...stringArray(record.humanQuestions)
  ].map(normalized);
  return classes.some((value) => /\b(?:blocked|blocker|conflict|human-needed|human-blocked|human-question|failed-evidence|quota-deferred|timeout|denied)\b/u.test(value));
}

function normalizeHistoricalEvidenceFailureJob(record: Record<string, unknown>): Record<string, unknown> {
  if (!isHistoricalOwnershipRescopeCandidate(record)) return record;
  return {
    ...record,
    reviewResolved: false,
    originalBucket: record.originalBucket ?? record.bucket,
    originalStatus: record.originalStatus ?? record.status,
    originalDisposition: record.originalDisposition ?? record.disposition,
    bucket: 'rerun-work',
    status: 'completed',
    disposition: 'needs-rerun',
    mergeReadiness: 'needs-rerun',
    evidenceFailureNormalized: true,
    collectReasonClasses: uniquePaths([...stringArray(record.collectReasonClasses), 'ownership-rescope-rerun'])
  };
}

function isHistoricalOwnershipRescopeCandidate(record: Record<string, unknown>): boolean {
  const bucket = normalized(record.bucket);
  const status = normalized(record.status);
  const disposition = normalized(record.disposition);
  const readiness = normalized(record.mergeReadiness);
  const failedEvidence = bucket === 'failed-evidence'
    || bucket === 'worker-failed'
    || status === 'failed'
    || disposition === 'rejected'
    || disposition === 'failed'
    || readiness === 'rejected'
    || readiness === 'blocked';
  if (!failedEvidence) return false;
  const ownershipViolationCount = numberValue(record.ownershipViolationCount)
    || stringArray(record.ownershipViolations).length;
  if (!ownershipViolationCount) return false;
  const changedPathCount = numberValue(record.changedPathCount)
    || stringArray(record.changedPaths).length;
  if (!changedPathCount) return false;
  return Boolean(textValue(record.patchPath, '') || textValue(record.patchArtifactPath, '') || changedPathCount);
}

function markCoordinatorReviewResolved(record: Record<string, unknown>, disposition: string): Record<string, unknown> {
  const existingOriginalReasons = stringArray(record.originalReasons);
  const originalReasons = existingOriginalReasons.length ? existingOriginalReasons : stringArray(record.reasons);
  const retainedReasons = originalReasons.filter((reason) => !isOpenCoordinatorReviewReason(reason));
  const decisionReason = textValue(recordValue(record.coordinatorDecision).reason, '');
  const reasons = uniquePaths([
    ...retainedReasons,
    ...(decisionReason ? [decisionReason] : [])
  ]);
  return {
    ...record,
    reviewResolved: true,
    originalBucket: record.originalBucket ?? record.bucket,
    originalStatus: record.originalStatus ?? record.status,
    ...(originalReasons.length ? { originalReasons } : {}),
    bucket: 'review-resolved',
    status: 'completed',
    disposition: disposition || 'review-resolved',
    mergeReadiness: 'review-resolved',
    reasons,
    health: ['failed', 'warning'].includes(normalized(record.health)) ? 'resolved' : record.health
  };
}

function normalizeCoordinatorFacingSnapshot(record: Record<string, unknown>): Record<string, unknown> {
  return {
    ...record,
    summary: normalizeCoordinatorFacingSummary(recordValue(record.summary))
  };
}

function normalizeCoordinatorFacingSummary(summary: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(summary)) {
    if (key === 'bucketCounts') {
      out.bucketCounts = normalizeCoordinatorFacingCountMap(recordValue(value));
      continue;
    }
    const nextKey = coordinatorFacingMachineKey(key);
    if (typeof value === 'number' && typeof out[nextKey] === 'number') out[nextKey] = (out[nextKey] as number) + value;
    else out[nextKey] = value;
  }
  const coordinatorReview = numberValue(out['needs-coordinator-review']);
  if (coordinatorReview && out.needsCoordinatorReviewCount === undefined) out.needsCoordinatorReviewCount = coordinatorReview;
  return out;
}

function normalizeCoordinatorFacingCountMap(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const nextKey = coordinatorFacingMachineKey(key);
    if (typeof value === 'number' && typeof out[nextKey] === 'number') out[nextKey] = (out[nextKey] as number) + value;
    else out[nextKey] = value;
  }
  return out;
}

function isCoordinatorPortBucket(value: unknown): boolean {
  const bucket = normalized(value);
  return bucket === 'needs-human-port'
    || bucket === 'needs-human-review'
    || bucket === 'needs-human-decision'
    || bucket === 'needs-coordinator-port'
    || bucket === 'needs-coordinator-review'
    || bucket === 'needs-coordinator-decision';
}

function isOpenCoordinatorReviewReason(value: unknown): boolean {
  const reason = normalized(value);
  return isCoordinatorPortBucket(reason)
    || reason === 'needs-port'
    || reason === 'needs-review'
    || reason === 'manual-port-required'
    || reason === 'manual port required';
}

function coordinatorFacingMachineKey(value: string): string {
  return textValue(coordinatorFacingMachineLabel(value), value);
}

function coordinatorFacingMachineLabel(value: unknown): unknown {
  const raw = textValue(value, '');
  const current = normalized(raw);
  if (current === 'needs-human-port') return 'needs-coordinator-review';
  if (current === 'needs-coordinator-port') return 'needs-coordinator-review';
  if (current === 'needs-human-review') return 'needs-coordinator-review';
  if (current === 'needs-human-decision') return 'needs-coordinator-decision';
  if (current === 'needshumancount') return 'needsCoordinatorReviewCount';
  if (current === 'needshumanportcount') return 'needsCoordinatorReviewCount';
  if (current === 'needscoordinatorportcount') return 'needsCoordinatorReviewCount';
  return value;
}

function coordinatorReviewDecisionMatches(job: Record<string, unknown>, decision: CoordinatorReviewDecision): boolean {
  const decisionIds = coordinatorDecisionIds(decision);
  if (!decisionIds.length) return false;
  const jobIds = coordinatorDecisionIds(job);
  const idMatches = decisionIds.some((id) => jobIds.includes(id) || jobIds.includes(sanitizeDecisionId(id)));
  if (!idMatches) return false;
  const decisionSource = textValue(decision.source ?? decision.sourceCollection ?? decision.sourceRun ?? decision.sourceLabel, '');
  if (!decisionSource) return true;
  if (isHistoricalReviewDrainDecision(decision)) return historicalReviewDrainDecisionMatches(job, decision);
  const jobSources = [
    textValue(job.sourceLabel, ''),
    textValue(job.sourceCollection, ''),
    textValue(job.sourceRun, ''),
    textValue(job.sourceContinuation, '')
  ].filter(Boolean);
  return jobSources.some((source) => source === decisionSource || source.endsWith(decisionSource) || decisionSource.endsWith(source));
}

function isHistoricalReviewDrainDecision(decision: CoordinatorReviewDecision): boolean {
  const sources = [
    textValue(decision.source, ''),
    textValue(decision.sourceCollection, ''),
    textValue(decision.sourceRun, ''),
    textValue(decision.sourceLabel, ''),
    textValue(decision.sourceArtifact, '')
  ];
  return sources.some((source) => normalized(source).includes('historical-review-drain'));
}

function historicalReviewDrainDecisionMatches(job: Record<string, unknown>, decision: CoordinatorReviewDecision): boolean {
  if (normalized(job.status) === 'running' || normalized(job.bucket) === 'running') return false;
  const latestPath = textValue(decision.latestPath, '');
  if (!latestPath) return false;
  const latestRoot = historicalReviewDrainSourceRoot(latestPath);
  if (!latestRoot) return false;
  const jobSources = [
    textValue(job.sourceLabel, ''),
    textValue(job.sourceCollection, ''),
    textValue(job.sourceRun, ''),
    textValue(job.sourceContinuation, '')
  ].filter(Boolean);
  return jobSources.some((source) => {
    const jobRoot = historicalReviewDrainSourceRoot(source);
    return Boolean(jobRoot) && (jobRoot === latestRoot || jobRoot.endsWith(latestRoot) || latestRoot.endsWith(jobRoot));
  });
}

function historicalReviewDrainSourceRoot(value: string): string {
  const normalizedPath = value.replaceAll('\\', '/').replace(/\/(?:queue-overlay|collection|coordinator-query|swarm-results|coordinator-dashboard)\.json$/u, '');
  const autoDrainIndex = normalizedPath.indexOf('/auto-drain/');
  if (autoDrainIndex >= 0) return normalizedPath.slice(0, autoDrainIndex);
  const collectionIndex = normalizedPath.search(/\/(?:collection|collected|post-coordinator-collected|coordinator-collected)[^/]*(?:\/|$)/u);
  if (collectionIndex >= 0) return normalizedPath.slice(0, collectionIndex);
  return normalizedPath.replace(/\/$/u, '');
}

function coordinatorDecisionIds(record: Record<string, unknown>): string[] {
  return Array.from(new Set([
    textValue(record.id, ''),
    textValue(record.originalJobId, ''),
    textValue(record.jobId, ''),
    textValue(record.taskId, ''),
    ...stringArray(record.matchIds)
  ].filter(Boolean).flatMap((id) => [id, sanitizeDecisionId(id)])));
}

function sanitizeDecisionId(value: string): string {
  return value.replaceAll(/[^\w:.-]+/g, '-');
}

function isResolvedCoordinatorDecision(status: string): boolean {
  const value = normalized(status);
  return Boolean(value) && !['open', 'pending', 'deferred', 'needs-review'].includes(value);
}

function lifetimeSourceLabel(relative: string): string {
  const parts = relative.split(/[\\/]/g).filter(Boolean);
  return parts.slice(-3).join('/');
}

function lifetimeDashboardSummary(jobs: Array<Record<string, unknown>>): Record<string, unknown> {
  const completedCount = jobs.filter((job) => textValue(job.status, '').toLowerCase() === 'completed').length;
  const failedCount = jobs.filter((job) => isLifetimeFailedJob(job)).length;
  const blockedCount = jobs.filter((job) => textValue(job.status, '').toLowerCase() === 'blocked').length;
  const runningCount = jobs.filter((job) => textValue(job.status, '').toLowerCase() === 'running').length;
  const terminalCount = jobs.filter((job) => ['completed', 'failed', 'blocked'].includes(textValue(job.status, '').toLowerCase())).length;
  const durationMs = jobs.reduce((sum, job) => sum + numberValue(job.durationMs), 0);
  return {
    jobCount: jobs.length,
    completedCount,
    failedCount,
    runningCount,
    blockedCount,
    changedPathCount: jobs.reduce((sum, job) => sum + numberValue(job.changedPathCount), 0),
    ownershipViolationCount: jobs.reduce((sum, job) => sum + numberValue(job.ownershipViolationCount), 0),
    sourceOwnershipViolationCount: jobs.reduce((sum, job) => sum + numberValue(job.sourceOwnershipViolationCount), 0),
    ignoredOwnershipViolationCount: jobs.reduce((sum, job) => sum + numberValue(job.ignoredOwnershipViolationCount), 0),
    quarantinedChangedPathCount: jobs.reduce((sum, job) => sum + numberValue(job.quarantinedChangedPathCount), 0),
    ignoredChangedPathCount: jobs.reduce((sum, job) => sum + numberValue(job.ignoredChangedPathCount), 0),
    terminalCount,
    failureCount: failedCount + blockedCount,
    warningCount: jobs.filter((job) => textValue(job.health, '') === 'warning').length,
    contextWarningCount: jobs.filter((job) => numberValue(job.contextBudgetWarningCount) > 0).length,
    contextFailedCount: jobs.filter((job) => numberValue(job.contextBudgetErrorCount) > 0).length,
    semanticCleanCount: jobs.filter((job) => textValue(job.semanticReadiness, '') === 'clean').length,
    semanticCandidateCount: jobs.filter((job) => textValue(job.semanticReadiness, '') === 'candidate').length,
    semanticBlockedCount: jobs.filter((job) => textValue(job.semanticReadiness, '') === 'blocked').length,
    durationMs,
    averageDurationMs: jobs.length ? Math.round(durationMs / jobs.length) : 0,
    maxDurationMs: jobs.reduce((max, job) => Math.max(max, numberValue(job.durationMs)), 0),
    actualInputTokens: jobs.reduce((sum, job) => sum + numberValue(job.actualInputTokens), 0),
    estimatedInputTokens: jobs.reduce((sum, job) => sum + numberValue(job.estimatedInputTokens), 0),
    cachedInputTokens: jobs.reduce((sum, job) => sum + numberValue(job.cachedInputTokens), 0),
    uncachedInputTokens: jobs.reduce((sum, job) => sum + numberValue(job.uncachedInputTokens), 0),
    estimatedCostUsd: roundUsd(jobs.reduce((sum, job) => sum + numberValue(job.estimatedCostUsd), 0)),
    estimatedInputCostUsd: roundUsd(jobs.reduce((sum, job) => sum + numberValue(job.estimatedInputCostUsd), 0)),
    estimatedCachedInputCostUsd: roundUsd(jobs.reduce((sum, job) => sum + numberValue(job.estimatedCachedInputCostUsd), 0)),
    estimatedUncachedInputCostUsd: roundUsd(jobs.reduce((sum, job) => sum + numberValue(job.estimatedUncachedInputCostUsd), 0)),
    estimatedOutputCostUsd: roundUsd(jobs.reduce((sum, job) => sum + numberValue(job.estimatedOutputCostUsd), 0)),
    estimatedCostMicroUsd: jobs.reduce((sum, job) => sum + numberValue(job.estimatedCostMicroUsd), 0),
    priceKnownJobCount: jobs.filter((job) => job.priceKnown === true).length,
    bucketCounts: countJobsByBucket(jobs)
  };
}

function lifetimeSummaryWithExistingGraph(lifetime: Record<string, unknown>, jobs: Array<Record<string, unknown>>): Record<string, unknown> {
  const graph = recordValue(lifetime.graph ?? recordValue(lifetime.summary).graph);
  return {
    ...lifetimeDashboardSummary(jobs),
    ...(Object.keys(graph).length ? { graph } : {})
  };
}

function countJobsByBucket(jobs: Array<Record<string, unknown>>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const job of jobs) {
    const bucket = textValue(job.bucket, 'unknown') || 'unknown';
    counts[bucket] = (counts[bucket] ?? 0) + 1;
  }
  return counts;
}

function lifetimeHealthSummary(jobs: Array<Record<string, unknown>>): Record<string, unknown> {
  const summary = lifetimeDashboardSummary(jobs);
  const failedJobCount = numberValue(summary.failedCount);
  const blockedJobCount = numberValue(summary.blockedCount);
  const runningJobCount = numberValue(summary.runningCount);
  const warningJobCount = jobs.filter((job) => textValue(job.health, '') === 'warning').length;
  const status = failedJobCount || blockedJobCount ? 'failed' : runningJobCount ? 'running' : warningJobCount ? 'warning' : jobs.length ? 'healthy' : 'unknown';
  return {
    status,
    summary: {
      jobCount: jobs.length,
      healthyJobCount: Math.max(0, jobs.length - failedJobCount - blockedJobCount - warningJobCount),
      warningJobCount,
      failedJobCount,
      blockedJobCount,
      runningJobCount,
      terminalJobCount: numberValue(summary.terminalCount),
      readyToApplyJobCount: jobs.filter((job) => textValue(job.bucket, '') === 'ready-to-apply').length,
      contextWarningJobCount: numberValue(summary.contextWarningCount),
      semanticCleanJobCount: numberValue(summary.semanticCleanCount),
      semanticCandidateJobCount: numberValue(summary.semanticCandidateCount),
      completionRatio: jobs.length ? numberValue(summary.terminalCount) / jobs.length : 0,
      failureRatio: jobs.length ? (failedJobCount + blockedJobCount) / jobs.length : 0
    }
  };
}

function lifetimeLaneRows(jobs: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const byLane = new Map<string, Array<Record<string, unknown>>>();
  for (const job of jobs) {
    const lane = textValue(job.lane, 'workspace');
    byLane.set(lane, [...(byLane.get(lane) ?? []), job]);
  }
  return Array.from(byLane.entries()).map(([id, entries]) => ({
    id,
    jobCount: entries.length,
    completedCount: entries.filter((job) => textValue(job.status, '') === 'completed').length,
    failedCount: entries.filter(isLifetimeFailedJob).length,
    runningCount: entries.filter((job) => textValue(job.status, '') === 'running').length
  }));
}

function lifetimeQueueBacklogOverlay(queueBacklog: LifetimeQueueBacklog, jobs: Array<Record<string, unknown>>): {
  entries: Array<Record<string, unknown>>;
  totalCount: number;
  readyCount: number;
  activeCount: number;
  doneCount: number;
  failedCount: number;
  representedCount: number;
} {
  const jobsByKey = new Map<string, Array<Record<string, unknown>>>();
  for (const job of jobs) {
    for (const key of recordIdentityKeys(job).map(canonicalLifetimeTaskKey).filter(Boolean)) {
      jobsByKey.set(key, [...(jobsByKey.get(key) ?? []), job]);
    }
  }
  let activeCount = 0;
  let doneCount = 0;
  let failedCount = 0;
  let representedCount = 0;
  const entries: Array<Record<string, unknown>> = [];
  for (const entry of queueBacklog.entries) {
    const matchedJobs = Array.from(new Set(recordIdentityKeys(entry).map(canonicalLifetimeTaskKey).flatMap((key) => jobsByKey.get(key) ?? [])));
    if (!matchedJobs.length) {
      entries.push(entry);
      continue;
    }
    representedCount += 1;
    if (matchedJobs.some((job) => textValue(job.status, '') === 'running')) activeCount += 1;
    else if (matchedJobs.some(isLifetimeFailedJob)) failedCount += 1;
    else if (matchedJobs.some((job) => textValue(job.status, '') === 'completed' || isResolvedCoordinatorReviewRecord(job))) doneCount += 1;
    else activeCount += 1;
  }
  return {
    entries,
    totalCount: queueBacklog.entries.length,
    readyCount: entries.filter((entry) => textValue(entry.status, '') === 'todo').length,
    activeCount,
    doneCount,
    failedCount,
    representedCount
  };
}

function lifetimeCapacitySummary(queueBacklog: LifetimeQueueBacklog, jobs: Array<Record<string, unknown>>, openQueueEntries = queueBacklog.entries): Record<string, unknown> {
  const manifest = queueBacklog.manifests[0];
  const laneRows = new Map<string, Record<string, unknown>>();
  const terminalTaskIds = new Set(jobs
    .filter((job) => ['completed', 'failed', 'blocked'].includes(textValue(job.status, '').toLowerCase()))
    .flatMap((job) => recordIdentityKeys(job).map(canonicalLifetimeTaskKey)));
  const representedTaskIds = new Set(jobs.flatMap((job) => recordIdentityKeys(job).map(canonicalLifetimeTaskKey)));
  const openEntries = openQueueEntries.filter((entry) => {
    const ids = recordIdentityKeys(entry);
    return !ids.some((id) => terminalTaskIds.has(canonicalLifetimeTaskKey(id)) || representedTaskIds.has(canonicalLifetimeTaskKey(id)));
  });
  const queuedByLane = groupRecordsByText(openEntries, (entry) => textValue(entry.lane ?? entry.group ?? entry.sourceQueue, 'unassigned'));
  const jobsByLane = groupRecordsByText(jobs, (job) => textValue(job.lane, 'unassigned'));
  const manifestLanes = manifest?.lanes ?? [];
  for (const lane of manifestLanes) {
    laneRows.set(lane.id, capacityLaneRow(lane, queuedByLane.get(lane.id) ?? [], jobsByLane.get(lane.id) ?? []));
  }
  for (const [laneId, entries] of queuedByLane) {
    if (!laneRows.has(laneId)) laneRows.set(laneId, capacityLaneRow({ id: laneId, title: laneId, layer: '', compute: '', model: '', maxConcurrency: 1 }, entries, jobsByLane.get(laneId) ?? []));
  }
  for (const [laneId, entries] of jobsByLane) {
    if (!laneRows.has(laneId)) laneRows.set(laneId, capacityLaneRow({ id: laneId, title: laneId, layer: '', compute: '', model: '', maxConcurrency: 1 }, queuedByLane.get(laneId) ?? [], entries));
  }
  const lanes = Array.from(laneRows.values()).sort((left, right) => {
    const pressure = numberValue(right.runningCount) - numberValue(left.runningCount)
      || numberValue(right.queuedTaskCount) - numberValue(left.queuedTaskCount);
    return pressure || textValue(left.id, '').localeCompare(textValue(right.id, ''));
  });
  const runningAgentCount = jobs.filter((job) => textValue(job.status, '') === 'running').length;
  const queuedTaskCount = lanes.reduce((sum, lane) => sum + numberValue(lane.queuedTaskCount), 0);
  return {
    manifestPath: manifest?.path ?? '',
    manifestId: manifest?.id ?? '',
    title: manifest?.title ?? 'Swarm capacity',
    defaultConcurrency: manifest?.defaultConcurrency ?? 0,
    computeMaxConcurrency: manifest?.computeMaxConcurrency ?? 0,
    maxConcurrency: manifest?.maxConcurrency ?? 0,
    laneCount: lanes.length,
    openLaneCount: lanes.filter((lane) => numberValue(lane.queuedTaskCount) > 0 || numberValue(lane.runningCount) > 0).length,
    activeLaneCount: lanes.filter((lane) => numberValue(lane.runningCount) > 0).length,
    runningAgentCount,
    assignedAgentCount: lanes.reduce((sum, lane) => sum + numberValue(lane.assignedAgentCount), 0),
    queuedTaskCount,
    totalTaskCount: queueBacklog.entries.length,
    completedTaskCount: jobs.filter((job) => textValue(job.status, '') === 'completed').length,
    lanes,
    queueSources: queueBacklog.paths
  };
}

function capacityLaneRow(
  lane: LifetimeQueueCapacityManifestLane,
  queuedEntries: Array<Record<string, unknown>>,
  laneJobs: Array<Record<string, unknown>>
): Record<string, unknown> {
  const runningJobs = laneJobs.filter((job) => textValue(job.status, '') === 'running');
  const queuedJobs = laneJobs.filter((job) => textValue(job.status, '') === 'queued');
  const assignedAgents = Array.from(new Set(runningJobs.map((job) => textValue(job.agentId ?? job.workerId ?? job.id, '')).filter(Boolean))).slice(0, 6);
  const queuedKeys = new Set([
    ...queuedEntries.filter((entry) => {
      const status = normalized(entry.status ?? entry.queueStatus);
      return !status || ['todo', 'queued', 'pending', 'ready', 'open'].includes(status);
    }).map(primaryRecordIdentityKey).filter(Boolean),
    ...queuedJobs.map(primaryRecordIdentityKey).filter(Boolean)
  ]);
  return {
    id: lane.id,
    title: lane.title || lane.id,
    layer: lane.layer,
    compute: lane.compute,
    model: lane.model,
    maxConcurrency: lane.maxConcurrency,
    queuedTaskCount: queuedKeys.size,
    totalTaskCount: queuedEntries.length,
    runningCount: runningJobs.length,
    completedCount: laneJobs.filter((job) => textValue(job.status, '') === 'completed').length,
    failedCount: laneJobs.filter(isLifetimeFailedJob).length,
    assignedAgentCount: assignedAgents.length,
    assignedAgents
  };
}

function recordIdentityKeys(record: Record<string, unknown>): string[] {
  return Array.from(new Set([
    textValue(record.id, ''),
    textValue(record.originalJobId, ''),
    textValue(record.jobId, ''),
    textValue(record.taskId, '')
  ].filter(Boolean)));
}

function primaryRecordIdentityKey(record: Record<string, unknown>): string {
  return canonicalLifetimeTaskKey(textValue(record.taskId, ''))
    || canonicalLifetimeTaskKey(textValue(record.originalJobId, ''))
    || canonicalLifetimeTaskKey(textValue(record.jobId, ''))
    || canonicalLifetimeTaskKey(textValue(record.id, ''));
}

function groupRecordsByText(
  records: Array<Record<string, unknown>>,
  keyFor: (record: Record<string, unknown>) => string
): Map<string, Array<Record<string, unknown>>> {
  const groups = new Map<string, Array<Record<string, unknown>>>();
  for (const record of records) {
    const key = keyFor(record) || 'unassigned';
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return groups;
}

function lifetimeTimeSeries(jobs: Array<Record<string, unknown>>, events: Array<Record<string, unknown>>): Record<string, unknown> {
  const bucketMs = 24 * 60 * 60 * 1000;
  const buckets = new Map<number, { at: number; terminalJobCount: number; warningJobCount: number; failureJobCount: number; durationMs: number; actualInputTokens: number; estimatedInputTokens: number; uncachedInputTokens: number; estimatedCostUsd: number; estimatedCostMicroUsd: number; eventCount: number }>();
  for (const job of jobs) {
    const at = numberValue(job.finishedAt) || numberValue(job.generatedAt) || numberValue(job.startedAt);
    if (!at) continue;
    const bucketAt = startOfLocalDay(at);
    const bucket = buckets.get(bucketAt) ?? emptyLifetimeTimeBucket(bucketAt);
    if (['completed', 'failed', 'blocked'].includes(textValue(job.status, '').toLowerCase())) bucket.terminalJobCount += 1;
    if (textValue(job.health, '') === 'warning') bucket.warningJobCount += 1;
    if (isLifetimeFailedJob(job)) bucket.failureJobCount += 1;
    bucket.durationMs += numberValue(job.durationMs);
    bucket.actualInputTokens += numberValue(job.actualInputTokens);
    bucket.estimatedInputTokens += numberValue(job.estimatedInputTokens);
    bucket.uncachedInputTokens += numberValue(job.uncachedInputTokens);
    bucket.estimatedCostUsd = roundUsd(bucket.estimatedCostUsd + numberValue(job.estimatedCostUsd));
    bucket.estimatedCostMicroUsd += numberValue(job.estimatedCostMicroUsd);
    buckets.set(bucketAt, bucket);
  }
  for (const event of events) {
    const at = numberValue(event.at);
    if (!at) continue;
    const bucketAt = startOfLocalDay(at);
    const bucket = buckets.get(bucketAt) ?? emptyLifetimeTimeBucket(bucketAt);
    bucket.eventCount += 1;
    buckets.set(bucketAt, bucket);
  }
  const points = Array.from(buckets.values()).sort((left, right) => left.at - right.at);
  return {
    bucketMs,
    points,
    summary: {
      pointCount: points.length,
      terminalJobCount: points.reduce((sum, point) => sum + point.terminalJobCount, 0),
      warningJobCount: points.reduce((sum, point) => sum + point.warningJobCount, 0),
      failureJobCount: points.reduce((sum, point) => sum + point.failureJobCount, 0),
      durationMs: points.reduce((sum, point) => sum + point.durationMs, 0),
      actualInputTokens: points.reduce((sum, point) => sum + point.actualInputTokens, 0),
      estimatedInputTokens: points.reduce((sum, point) => sum + point.estimatedInputTokens, 0),
      uncachedInputTokens: points.reduce((sum, point) => sum + point.uncachedInputTokens, 0),
      estimatedCostUsd: roundUsd(points.reduce((sum, point) => sum + point.estimatedCostUsd, 0)),
      estimatedCostMicroUsd: points.reduce((sum, point) => sum + point.estimatedCostMicroUsd, 0),
      missingTimestampJobCount: jobs.filter((job) => !numberValue(job.finishedAt) && !numberValue(job.generatedAt) && !numberValue(job.startedAt)).length
    }
  };
}

function emptyLifetimeTimeBucket(at: number): { at: number; terminalJobCount: number; warningJobCount: number; failureJobCount: number; durationMs: number; actualInputTokens: number; estimatedInputTokens: number; uncachedInputTokens: number; estimatedCostUsd: number; estimatedCostMicroUsd: number; eventCount: number } {
  return {
    at,
    terminalJobCount: 0,
    warningJobCount: 0,
    failureJobCount: 0,
    durationMs: 0,
    actualInputTokens: 0,
    estimatedInputTokens: 0,
    uncachedInputTokens: 0,
    estimatedCostUsd: 0,
    estimatedCostMicroUsd: 0,
    eventCount: 0
  };
}

function startOfLocalDay(value: number): number {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function lifetimeSemanticSummary(jobs: Array<Record<string, unknown>>): Record<string, unknown> {
  return {
    expected: jobs.length,
    satisfied: jobs.filter((job) => textValue(job.semanticReadiness, '') === 'clean').length,
    autoMerge: jobs.filter((job) => Boolean(job.semanticAutoMergeCandidate)).length,
    acceptedClean: jobs.filter((job) => textValue(job.semanticReadiness, '') === 'clean').length,
    conflicts: jobs.filter((job) => textValue(job.semanticReadiness, '') === 'blocked').length
  };
}

function semanticWithHealth(
  semantic: Record<string, unknown>,
  summary: Record<string, unknown>,
  jobs: Array<Record<string, unknown>>
): Record<string, unknown> {
  const existingHealth = recordValue(semantic.health);
  const sourceSummary = { ...recordValue(summary.bucketCounts), ...summary };
  const imports = recordValue(semantic.import);
  const edit = recordValue(semantic.edit);
  const script = recordValue(edit.script);
  const projection = recordValue(edit.projection);
  const replay = recordValue(semantic.replay);
  const admission = recordValue(semantic.admission);
  const jobAdmission = recordValue(admission.jobs);
  const scriptAdmission = recordValue(admission.scripts);
  const jobAdmissionStatusCounts = numberRecordValue(recordValue(jobAdmission.statusCounts));
  const scriptAdmissionStatusCounts = numberRecordValue(recordValue(scriptAdmission.statusCounts));
  const parserLosses = firstNumber(sourceSummary.semanticImportLossCount, imports.lossCount);
  const parserLossSeverityCounts = numberRecordValue(recordValue(sourceSummary.semanticImportLossesBySeverity ?? imports.lossSeverityCounts));
  const parserWarnings = firstNumber(sourceSummary.semanticImportWarningCount, imports.warningCount);
  const expectedMissingReasonCodes = uniquePaths([
    ...stringArray(sourceSummary.semanticImportExpectedMissingReasonCodes),
    ...stringArray(imports.expectedMissingReasonCodes)
  ]);
  const ledger = recordValue(sourceSummary.applyLedger);
  const ledgerFailed = numberValue(ledger.failed);
  const ledgerSkipped = numberValue(ledger.skipped);
  const ledgerLanded = firstNumber(ledger.landed, sourceSummary.landed);
  const autoMergeCandidates = Math.max(
    firstNumber(sourceSummary.semanticEditScriptAutoMergeCandidates, script.autoMergeCandidateCount, semantic.autoMerge),
    numberValue(jobAdmission.autoMergeCandidateCount),
    numberValue(scriptAdmission.autoMergeCandidateCount)
  );
  const scriptConflicts = firstNumber(sourceSummary.semanticEditScriptConflicts, script.conflictCount);
  const replayConflicts = firstNumber(sourceSummary.semanticEditReplayConflicts, replay.conflictCount, semantic.conflicts);
  const conflictCount = scriptConflicts + replayConflicts +
    admissionStatusCount(jobAdmissionStatusCounts, 'conflict') +
    admissionStatusCount(scriptAdmissionStatusCounts, 'conflict');
  const scriptBlocked = firstNumber(sourceSummary.semanticEditScriptBlocked, script.blockedCount);
  const projectionBlocked = firstNumber(sourceSummary.semanticEditProjectionBlocked, projection.blockedCount);
  const replayBlocked = firstNumber(sourceSummary.semanticEditReplayBlocked, replay.blockedCount);
  const lineageBlocked = firstNumber(sourceSummary.semanticLineageBlocked);
  const blockedCount = scriptBlocked + projectionBlocked + replayBlocked + lineageBlocked +
    admissionStatusCount(jobAdmissionStatusCounts, 'blocked') +
    admissionStatusCount(scriptAdmissionStatusCounts, 'blocked');
  const staleCount = firstNumber(sourceSummary.semanticEditScriptStale, script.staleCount) +
    firstNumber(sourceSummary.semanticEditReplayStale, replay.staleCount);
  const needsPortCount = firstNumber(sourceSummary.semanticEditScriptNeedsPort, script.needsPortCount) +
    firstNumber(sourceSummary.semanticEditReplayNeedsPort, replay.needsPortCount);
  const reviewRequiredCount = firstNumber(sourceSummary.semanticEditScriptReviewRequired, script.reviewRequiredCount) +
    firstNumber(sourceSummary.semanticLineageNeedsReview) +
    firstNumber(sourceSummary.semanticLineageAmbiguous) +
    admissionStatusCount(jobAdmissionStatusCounts, 'review-required') +
    admissionStatusCount(scriptAdmissionStatusCounts, 'review-required');
  const reviewReasonCodes = uniquePaths([
    ...expectedMissingReasonCodes,
    ...stringArray(sourceSummary.semanticLineageReasonCodes),
    ...stringArray(sourceSummary.semanticEditScriptReasonCodes),
    ...stringArray(sourceSummary.semanticEditProjectionReasonCodes),
    ...stringArray(sourceSummary.semanticEditReplayReasonCodes),
    ...stringArray(replay.reasonCodes)
  ]).slice(0, 12);
  const proofFailed = firstNumber(sourceSummary.semanticProofSpecFailedObligations);
  const openCoordinatorReviewCount = jobs.filter(isOpenCoordinatorReviewRecord).length;
  const synthesizedResearchCompleteCount = jobs.filter(isSynthesizedResearchCompleteRecord).length;
  const failedCount = numberValue(parserLossSeverityCounts.error) + proofFailed + ledgerFailed + conflictCount + blockedCount;
  const warningCount = parserWarnings + reviewRequiredCount + ledgerSkipped + staleCount + needsPortCount + openCoordinatorReviewCount;
  const passedCount = firstNumber(replay.acceptedCleanCount, semantic.acceptedClean) +
    numberValue(replay.alreadyAppliedCount) +
    ledgerLanded +
    autoMergeCandidates;
  const gateReasonCodes = uniquePaths([
    ...reviewReasonCodes,
    ...(numberValue(parserLossSeverityCounts.error) ? ['semantic-parser-error-loss'] : []),
    ...(proofFailed ? ['semantic-proof-obligation-failed'] : []),
    ...(ledgerFailed ? ['apply-ledger-failed'] : []),
    ...(conflictCount ? ['semantic-conflict'] : []),
    ...(blockedCount ? ['semantic-blocked'] : []),
    ...(openCoordinatorReviewCount ? ['open-coordinator-review'] : [])
  ]).slice(0, 12);
  const parserHealth = {
    lossCount: parserLosses,
    lossSeverityCounts: parserLossSeverityCounts,
    warningCount: parserWarnings,
    expectedMissingReasonCodes
  };
  const ledgerHealth = {
    totalCount: numberValue(ledger.total),
    landedCount: ledgerLanded,
    skippedCount: ledgerSkipped,
    failedCount: ledgerFailed
  };
  const mergeHealth = {
    autoMergeCandidateCount: autoMergeCandidates,
    reviewRequiredCount,
    conflictCount,
    staleCount,
    blockedCount,
    needsPortCount,
    reasonCodes: reviewReasonCodes
  };
  const gatesHealth = {
    status: semanticGateStatus({ failedCount, warningCount, passedCount }),
    passedCount,
    warningCount,
    failedCount,
    reasonCodes: gateReasonCodes
  };
  const outcomesHealth = {
    openCoordinatorReviewCount,
    synthesizedResearchCompleteCount
  };
  return {
    ...semantic,
    import: {
      ...imports,
      lossCount: parserLosses,
      lossSeverityCounts: parserLossSeverityCounts
    },
    health: {
      ...existingHealth,
      parser: { ...parserHealth, ...recordValue(existingHealth.parser) },
      ledger: { ...ledgerHealth, ...recordValue(existingHealth.ledger) },
      merge: { ...mergeHealth, ...recordValue(existingHealth.merge) },
      gates: { ...gatesHealth, ...recordValue(existingHealth.gates) },
      outcomes: { ...outcomesHealth, ...recordValue(existingHealth.outcomes) },
      admission: semanticAdmissionHealth({
        sourceSummary,
        semantic,
        existingHealth,
        imports,
        replay,
        jobAdmission,
        scriptAdmission,
        jobAdmissionStatusCounts,
        scriptAdmissionStatusCounts,
        jobs,
        parserLosses,
        parserWarnings,
        ledgerLanded,
        autoMergeCandidates,
        conflictCount,
        staleCount,
        reviewRequiredCount,
        openCoordinatorReviewCount,
        expectedMissingReasonCodes
      })
    }
  };
}

const SEMANTIC_ADMISSION_STATUS_KEYS = [
  'safe-merged',
  'safe-with-losses',
  'conflict',
  'no-op',
  'stale',
  'missing-sidecar',
  'coordinator-review',
  'tests-missing'
] as const;

type SemanticAdmissionStatusKey = typeof SEMANTIC_ADMISSION_STATUS_KEYS[number];

function semanticAdmissionHealth(input: {
  sourceSummary: Record<string, unknown>;
  semantic: Record<string, unknown>;
  existingHealth: Record<string, unknown>;
  imports: Record<string, unknown>;
  replay: Record<string, unknown>;
  jobAdmission: Record<string, unknown>;
  scriptAdmission: Record<string, unknown>;
  jobAdmissionStatusCounts: Record<string, number>;
  scriptAdmissionStatusCounts: Record<string, number>;
  jobs: Array<Record<string, unknown>>;
  parserLosses: number;
  parserWarnings: number;
  ledgerLanded: number;
  autoMergeCandidates: number;
  conflictCount: number;
  staleCount: number;
  reviewRequiredCount: number;
  openCoordinatorReviewCount: number;
  expectedMissingReasonCodes: string[];
}): Record<string, unknown> {
  const existingAdmission = recordValue(input.existingHealth.admission);
  const reasonCodeCounts = semanticAdmissionReasonCodeCounts(input);
  const statusCounts = emptySemanticAdmissionStatusCounts();
  addSemanticAdmissionStatusCounts(statusCounts, input.jobAdmissionStatusCounts);
  addSemanticAdmissionStatusCounts(statusCounts, input.scriptAdmissionStatusCounts);
  addSemanticAdmissionStatusCounts(statusCounts, numberRecordValue(recordValue(existingAdmission.statusCounts)));
  const replaySafeCount = firstNumber(input.replay.acceptedCleanCount, input.semantic.acceptedClean) +
    numberValue(input.replay.alreadyAppliedCount);
  setRecordMinimum(statusCounts, 'safe-merged', Math.max(replaySafeCount, input.ledgerLanded, input.autoMergeCandidates));
  setRecordMinimum(statusCounts, 'safe-with-losses', Math.max(
    numberValue(reasonCodeCounts['lossy-import']),
    input.parserLosses + input.parserWarnings > 0 && numberValue(statusCounts['safe-merged']) > 0 ? input.parserLosses + input.parserWarnings : 0
  ));
  setRecordMinimum(statusCounts, 'conflict', Math.max(
    input.conflictCount,
    numberValue(reasonCodeCounts['symbol-conflict']) + numberValue(reasonCodeCounts['effect-conflict'])
  ));
  setRecordMinimum(statusCounts, 'stale', Math.max(
    input.staleCount,
    numberValue(reasonCodeCounts['stale-source-hash']),
    numberValue(input.sourceSummary['stale-against-head'])
  ));
  setRecordMinimum(statusCounts, 'missing-sidecar', Math.max(
    numberValue(reasonCodeCounts['missing-sidecar']),
    input.expectedMissingReasonCodes.filter((reason) => semanticAdmissionReasonCode(reason) === 'missing-sidecar').length
  ));
  setRecordMinimum(statusCounts, 'coordinator-review', Math.max(
    input.reviewRequiredCount,
    input.openCoordinatorReviewCount,
    numberValue(input.sourceSummary['needs-coordinator-review'])
  ));
  setRecordMinimum(statusCounts, 'tests-missing', numberValue(reasonCodeCounts['tests-missing']));
  return {
    ...existingAdmission,
    statusCounts,
    reasonCodeCounts,
    totalCount: sumNumberRecordValues(statusCounts),
    reasonTotalCount: sumNumberRecordValues(reasonCodeCounts)
  };
}

function emptySemanticAdmissionStatusCounts(): Record<string, number> {
  return SEMANTIC_ADMISSION_STATUS_KEYS.reduce<Record<string, number>>((out, key) => {
    out[key] = 0;
    return out;
  }, {});
}

function addSemanticAdmissionStatusCounts(
  out: Record<string, number>,
  counts: Record<string, number>
): void {
  for (const [status, count] of Object.entries(counts)) {
    const key = semanticAdmissionStateKey(status);
    if (key && count > 0) out[key] += count;
  }
}

function semanticAdmissionReasonCodeCounts(input: {
  sourceSummary: Record<string, unknown>;
  semantic: Record<string, unknown>;
  existingHealth: Record<string, unknown>;
  imports: Record<string, unknown>;
  replay: Record<string, unknown>;
  jobAdmission: Record<string, unknown>;
  scriptAdmission: Record<string, unknown>;
  jobs: Array<Record<string, unknown>>;
  parserLosses: number;
  parserWarnings: number;
  conflictCount: number;
  staleCount: number;
  reviewRequiredCount: number;
  openCoordinatorReviewCount: number;
  expectedMissingReasonCodes: string[];
}): Record<string, number> {
  const counts: Record<string, number> = {};
  const existingAdmission = recordValue(input.existingHealth.admission);
  const admission = recordValue(input.semantic.admission);
  addReasonCodeCountRecord(counts, recordValue(input.sourceSummary.semanticAdmissionReasonCodeCounts));
  addReasonCodeCountRecord(counts, recordValue(input.sourceSummary.semanticCollectAdmissionReasonCodeCounts));
  addReasonCodeCountRecord(counts, recordValue(input.sourceSummary.semanticEditAdmissionReasonCodeCounts));
  addReasonCodeCountRecord(counts, recordValue(input.sourceSummary.semanticEditScriptAdmissionReasonCodeCounts));
  addReasonCodeCountRecord(counts, recordValue(admission.reasonCodeCounts));
  addReasonCodeCountRecord(counts, recordValue(input.jobAdmission.reasonCodeCounts));
  addReasonCodeCountRecord(counts, recordValue(input.scriptAdmission.reasonCodeCounts));
  addReasonCodeCountRecord(counts, recordValue(existingAdmission.reasonCodeCounts));
  addReasonCodeSignals(counts, [
    ...stringArray(input.sourceSummary.semanticAdmissionReasonCodes),
    ...stringArray(input.sourceSummary.semanticCollectAdmissionReasonCodes),
    ...stringArray(input.sourceSummary.semanticImportExpectedMissingReasonCodes),
    ...stringArray(input.sourceSummary.semanticLineageReasonCodes),
    ...stringArray(input.sourceSummary.semanticEditScriptReasonCodes),
    ...stringArray(input.sourceSummary.semanticEditProjectionReasonCodes),
    ...stringArray(input.sourceSummary.semanticEditReplayReasonCodes),
    ...input.expectedMissingReasonCodes,
    ...stringArray(input.imports.expectedMissingReasonCodes),
    ...stringArray(input.replay.reasonCodes)
  ]);
  for (const job of input.jobs) {
    addReasonCodeSignals(counts, [
      textValue(job.semanticAdmissionStatus, ''),
      textValue(job.semanticReadiness, ''),
      textValue(job.bucket, ''),
      textValue(job.disposition, ''),
      textValue(job.mergeReadiness, ''),
      ...stringArray(job.semanticReadinessReasons),
      ...stringArray(job.collectReasonClasses),
      ...stringArray(job.reasons)
    ]);
  }
  setRecordMinimum(counts, 'lossy-import', input.parserLosses + input.parserWarnings);
  setRecordMinimum(counts, 'stale-source-hash', input.staleCount);
  setRecordMinimum(counts, 'symbol-conflict', input.conflictCount);
  setRecordMinimum(counts, 'coordinator-review', input.reviewRequiredCount + input.openCoordinatorReviewCount);
  return counts;
}

function addReasonCodeCountRecord(out: Record<string, number>, counts: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(counts)) {
    const count = numberValue(value);
    if (count <= 0) continue;
    const code = semanticAdmissionReasonCode(key) ?? normalizedStatusKey(key);
    out[code] = (out[code] ?? 0) + count;
  }
}

function addReasonCodeSignals(out: Record<string, number>, values: string[]): void {
  for (const value of values) {
    const code = semanticAdmissionReasonCode(value);
    if (code) out[code] = (out[code] ?? 0) + 1;
  }
}

function semanticAdmissionStateKey(value: unknown): SemanticAdmissionStatusKey | undefined {
  const signal = normalizedStatusKey(value);
  if (!signal) return undefined;
  if (signal === 'safe-merged' ||
    signal === 'safe' ||
    signal === 'accepted' ||
    signal === 'accepted-clean' ||
    signal === 'clean' ||
    signal === 'ready' ||
    signal === 'pass' ||
    signal === 'auto-merge-candidate' ||
    signal === 'already-applied' ||
    signal === 'portable') return 'safe-merged';
  if (signal === 'safe-with-losses' ||
    signal === 'lossy' ||
    signal === 'lossy-import' ||
    signal === 'warning' ||
    signal === 'warnings' ||
    signal === 'clean-with-losses') return 'safe-with-losses';
  if (signal === 'conflict' ||
    signal === 'conflicts' ||
    signal === 'symbol-conflict' ||
    signal === 'effect-conflict' ||
    signal === 'blocked') return 'conflict';
  if (signal === 'no-op' ||
    signal === 'noop' ||
    signal === 'not-applicable' ||
    signal === 'no-semantic-edit-script' ||
    signal === 'evidence-only') return 'no-op';
  if (signal === 'stale' ||
    signal === 'rerun' ||
    signal === 'stale-against-head' ||
    signal === 'stale-source-hash') return 'stale';
  if (signal === 'missing-sidecar' ||
    signal === 'empty-sidecar') return 'missing-sidecar';
  if (signal === 'coordinator-review' ||
    signal === 'needs-coordinator-review' ||
    signal === 'needs-coordinator-port' ||
    signal === 'needs-human-port' ||
    signal === 'needs-human-review' ||
    signal === 'review' ||
    signal === 'review-required' ||
    signal === 'needs-review' ||
    signal === 'needs-port') return 'coordinator-review';
  if (signal === 'tests-missing' ||
    signal === 'missing-tests') return 'tests-missing';
  return undefined;
}

function semanticAdmissionReasonCode(value: unknown): string | undefined {
  const signal = normalizedStatusKey(value);
  if (!signal) return undefined;
  if (signal.includes('tests-missing') || signal.includes('missing-tests') || (signal.includes('test') && signal.includes('missing'))) return 'tests-missing';
  if (signal.includes('missing-sidecar') ||
    signal.includes('empty-sidecar') ||
    signal.includes('missing-semantic-import-sidecar') ||
    (signal.includes('missing') && signal.includes('sidecar'))) return 'missing-sidecar';
  if (signal.includes('stale-source-hash') ||
    signal.includes('stale-against-head') ||
    signal.includes('stale') ||
    ((signal.includes('current') || signal.includes('head')) && (signal.includes('hash') || signal.includes('anchor') || signal.includes('source') || signal.includes('base')))) return 'stale-source-hash';
  if (signal.includes('effect-conflict') || (signal.includes('effect') && (signal.includes('conflict') || signal.includes('mismatch') || signal.includes('blocked')))) return 'effect-conflict';
  if (signal.includes('symbol-conflict') ||
    signal.includes('semantic-conflict') ||
    signal.includes('symbol-anchor') ||
    signal.includes('anchor-content-mismatch') ||
    signal.includes('anchor-changed') ||
    signal.includes('conflict')) return 'symbol-conflict';
  if (signal.includes('lossy-import') ||
    signal.includes('parser-error-loss') ||
    signal.includes('loss')) return 'lossy-import';
  if (signal.includes('coordinator-review') ||
    signal.includes('open-coordinator-review') ||
    signal.includes('review-required') ||
    signal.includes('needs-review') ||
    signal.includes('needs-port') ||
    signal.includes('human-port')) return 'coordinator-review';
  return undefined;
}

function setRecordMinimum(record: Record<string, number>, key: string, value: number): void {
  if (value > (record[key] ?? 0)) record[key] = value;
}

function sumNumberRecordValues(record: Record<string, number>): number {
  return Object.values(record).reduce((sum, value) => sum + numberValue(value), 0);
}

function isSynthesizedResearchCompleteRecord(job: Record<string, unknown>): boolean {
  if (normalized(job.status) !== 'completed' || isOpenCoordinatorReviewRecord(job)) return false;
  const signals = [
    job.lane,
    job.title,
    job.workKind,
    job.disposition,
    job.mergeReadiness,
    ...stringArray(job.reasons),
    ...stringArray(job.collectReasonClasses)
  ].map(normalized);
  return signals.some((signal) => signal === 'discovery-only' ||
    signal.includes('research') ||
    signal.includes('synthesized') ||
    signal.includes('collector-workspace-only-recovery') ||
    signal.includes('generated-by-collector'));
}

function numberRecordValue(value: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    const count = numberValue(entry);
    if (count > 0) out[key] = count;
  }
  return out;
}

function admissionStatusCount(record: Record<string, number>, wanted: string): number {
  return Object.entries(record).reduce((sum, [key, value]) => normalizedStatusKey(key) === wanted ? sum + value : sum, 0);
}

function normalizedStatusKey(value: unknown): string {
  return textValue(value, '').trim().replace(/[\s_]+/g, '-').toLowerCase();
}

function semanticGateStatus(input: { failedCount: number; warningCount: number; passedCount: number }): string {
  if (input.failedCount > 0) return 'blocked';
  if (input.warningCount > 0) return 'review';
  if (input.passedCount > 0) return 'pass';
  return 'unknown';
}

function firstNumber(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return 0;
}

async function lifetimeRoutingSummary(
  cwd: string,
  entries: Array<{ source: LifetimeDashboardSource; snapshot: Record<string, unknown> }>
): Promise<Record<string, unknown> | undefined> {
  const routingRows = entries.map(({ snapshot }) => recordValue(snapshot.routing)).filter((entry) => Object.keys(entry).length);
  const sidecars = await readLifetimeRoutingSidecars(cwd, entries.map(({ source }) => source));
  if (!routingRows.length && !sidecars.tournamentCount && !sidecars.feedbackArtifactCount && !sidecars.historyCount) return undefined;
  return {
    policyId: 'workspace-lifetime',
    preferenceCount: routingRows.reduce((sum, row) => sum + numberValue(row.preferenceCount), 0),
    preferCount: routingRows.reduce((sum, row) => sum + numberValue(row.preferCount), 0),
    avoidCount: routingRows.reduce((sum, row) => sum + numberValue(row.avoidCount), 0),
    feedbackCount: routingRows.reduce((sum, row) => sum + numberValue(row.feedbackCount), 0) + sidecars.feedbackSignalCount,
    tournamentObservationCount: routingRows.reduce((sum, row) => sum + numberValue(row.tournamentObservationCount), 0) + sidecars.tournamentObservationCount,
    tournamentRecommendationCount: routingRows.reduce((sum, row) => sum + numberValue(row.tournamentRecommendationCount), 0) + sidecars.tournamentRecommendationCount,
    tournamentCount: sidecars.tournamentCount,
    tournamentMatchCount: sidecars.tournamentMatchCount,
    tournamentVerifiedCount: sidecars.tournamentVerifiedCount,
    tournamentTopStrategyId: sidecars.topStrategyId,
    tournamentDecisionGrade: sidecars.decisionGrade,
    strategyHistoryCount: sidecars.historyCount,
    feedbackArtifactCount: sidecars.feedbackArtifactCount
  };
}

async function readLifetimeRoutingSidecars(
  cwd: string,
  sources: LifetimeDashboardSource[]
): Promise<{
  tournamentCount: number;
  tournamentMatchCount: number;
  tournamentVerifiedCount: number;
  tournamentObservationCount: number;
  tournamentRecommendationCount: number;
  feedbackSignalCount: number;
  feedbackArtifactCount: number;
  historyCount: number;
  topStrategyId: string;
  decisionGrade: string;
}> {
  const out = {
    tournamentCount: 0,
    tournamentMatchCount: 0,
    tournamentVerifiedCount: 0,
    tournamentObservationCount: 0,
    tournamentRecommendationCount: 0,
    feedbackSignalCount: 0,
    feedbackArtifactCount: 0,
    historyCount: 0,
    topStrategyId: '',
    decisionGrade: ''
  };
  const seen = new Set<string>();
  for (const source of sources) {
    const dir = lifetimeRoutingSidecarDir(cwd, source);
    if (!dir || seen.has(dir)) continue;
    seen.add(dir);
    const tournament = recordValue(await readJsonFile(path.join(dir, 'strategy-tournament.json')));
    const tournamentSummary = recordValue(tournament.summary);
    if (Object.keys(tournament).length) {
      out.tournamentCount += 1;
      out.tournamentMatchCount += numberValue(tournamentSummary.matchCount);
      out.tournamentVerifiedCount += numberValue(tournamentSummary.verifiedCount);
      out.tournamentObservationCount += numberValue(tournamentSummary.matchCount) || recordArray(tournament.matches).length;
      out.tournamentRecommendationCount += textValue(tournament.winnerId ?? tournamentSummary.topStrategyId, '') ? 1 : 0;
      if (!out.topStrategyId) out.topStrategyId = textValue(tournamentSummary.topStrategyId ?? tournament.winnerId, '');
      if (!out.decisionGrade) out.decisionGrade = textValue(tournamentSummary.decisionGrade, '');
    }
    const feedback = recordValue(await readJsonFile(path.join(dir, 'tournament-adaptive-feedback.json')));
    const feedbackSummary = recordValue(feedback.summary);
    if (Object.keys(feedback).length) {
      out.feedbackArtifactCount += 1;
      out.tournamentObservationCount += numberValue(feedbackSummary.observationCount) || recordArray(feedback.observations).length;
      out.tournamentRecommendationCount += numberValue(feedbackSummary.recommendationCount) || recordArray(feedback.recommendations).length;
      out.feedbackSignalCount += numberValue(feedbackSummary.reduceSignals) + numberValue(feedbackSummary.increaseSignals) + numberValue(feedbackSummary.holdSignals);
    }
    const history = recordValue(await readJsonFile(path.join(dir, 'strategy-history.json')));
    if (Object.keys(history).length) {
      out.historyCount += recordArray(history.tournaments).length || 1;
    }
  }
  return out;
}

function lifetimeRoutingSidecarDir(cwd: string, source: LifetimeDashboardSource): string | undefined {
  const relative = source.collection ?? source.continuation ?? source.run;
  if (!relative) return undefined;
  const absolute = path.resolve(cwd, relative);
  return isPathInside(cwd, absolute) ? absolute : undefined;
}

function isLifetimeFailedJob(job: Record<string, unknown>): boolean {
  if (isResolvedCoordinatorReviewRecord(job)) return false;
  const status = textValue(job.status, '').toLowerCase();
  const health = textValue(job.health, '').toLowerCase();
  const bucket = textValue(job.bucket, '').toLowerCase();
  if (bucket === 'rerun-work') return false;
  return status === 'failed' || health === 'failed' || bucket === 'failed-evidence';
}

function shouldPreferActiveRunSnapshot(jobs: unknown[], activeJobs: Array<Record<string, unknown>>): boolean {
  if (!activeJobs.length) return false;
  const runningCount = activeJobs.filter((job) => textValue(job.status, '') === 'running').length;
  if (runningCount > 0) return true;
  return activeJobs.length > jobs.length;
}

async function readActiveRunSnapshot(
  options: NormalizedLoomUiServerOptions,
  readOptions: { runningOnly?: boolean; includeUsage?: boolean } = {}
): Promise<Record<string, unknown> | undefined> {
  const runDir = await resolveRunDirectory(options);
  if (!runDir) return undefined;
  const pidPath = path.join(runDir, 'pids.json');
  const pidManifest = recordValue(await readJsonFile(pidPath));
  let entries = recordArray(pidManifest.entries).filter((entry) => textValue(entry.role, '') === 'codex');
  if (readOptions.runningOnly) entries = entries.filter((entry) => isProcessLive(numberValue(entry.pid), entry));
  if (!entries.length) return undefined;
  const planPath = path.join(runDir, 'swarm-plan.json');
  const plan = recordValue(await readJsonFile(planPath));
  const planJobs = new Map(recordArray(plan.jobs).map((job) => [textValue(job.id, ''), job]));
  const now = Date.now();
  const jobs = await Promise.all(entries.map((entry) => activeRunJob(options.cwd, runDir, entry, planJobs.get(textValue(entry.jobId, '')), now, readOptions)));
  const runningCount = jobs.filter((job) => textValue(job.status, '') === 'running').length;
  const completedCount = jobs.filter((job) => textValue(job.status, '') === 'completed').length;
  const failedCount = jobs.filter((job) => textValue(job.status, '') === 'failed').length;
  const actualInputTokens = jobs.reduce((sum, job) => sum + numberValue(job.actualInputTokens), 0);
  const estimatedInputTokens = jobs.reduce((sum, job) => sum + numberValue(job.estimatedInputTokens), 0);
  const cachedInputTokens = jobs.reduce((sum, job) => sum + numberValue(job.cachedInputTokens), 0);
  const graph = await readDashboardLiveRunGraphSummary(options.cwd, runDir, jobs, now);
  return {
    ok: true,
    generatedAt: now,
    cwd: options.cwd,
    summary: {
      jobCount: jobs.length,
      completedCount,
      failedCount,
      runningCount,
      blockedCount: 0,
      actualInputTokens,
      estimatedInputTokens,
      cachedInputTokens,
      uncachedInputTokens: Math.max(0, actualInputTokens - cachedInputTokens),
      durationMs: jobs.reduce((sum, job) => Math.max(sum, numberValue(job.durationMs)), 0),
      bucketCounts: {
        total: jobs.length,
        running: runningCount,
        completed: completedCount,
        'failed-evidence': failedCount
      },
      ...(graph ? { graph } : {})
    },
    health: lifetimeHealthSummary(jobs),
    lanes: activeRunLanes(jobs),
    jobs,
    activeAgents: activeAgentsFromJobs(jobs),
    events: activeRunEvents(jobs),
    ...(graph ? { graph } : {}),
    sources: {
      run: runDir,
      activeRun: pidPath,
      plan: planPath,
      ...(graph ? { graph: textValue(graph.sourceFile, '') } : {})
    },
    raw: {
      activeRun: {
        runId: textValue(pidManifest.runId, ''),
        launchedCount: entries.length,
        runningCount
      }
    }
  };
}

async function readDashboardLiveRunGraphSummary(
  cwd: string,
  runDir: string,
  jobs: Array<Record<string, unknown>>,
  now: number
): Promise<Record<string, unknown> | undefined> {
  const file = path.join(runDir, LIVE_RUN_GRAPH_EVENTS_FILE);
  const stat = await fs.stat(file).catch(() => undefined);
  if (stat?.isFile() && stat.size <= CODEX_EVENTS_USAGE_MAX_BYTES) {
    const events = await readLiveRunGraphEvents(file);
    if (events.length) {
      return summarizeDashboardRunGraph(liveRunGraphFromEvents(events, path.basename(runDir), now), {
        sourceFile: path.relative(cwd, file).replaceAll(path.sep, '/'),
        sourceKind: 'live-run-graph-events',
        sourceStatus: 'live',
        liveEventCount: events.length
      });
    }
  }
  return activeRunGraphFallback(cwd, runDir, jobs, now, stat?.isFile() && stat.size > CODEX_EVENTS_USAGE_MAX_BYTES
    ? `${LIVE_RUN_GRAPH_EVENTS_FILE} is too large to parse for dashboard health.`
    : `${LIVE_RUN_GRAPH_EVENTS_FILE} is missing; projected graph health from the active PID manifest.`);
}

async function readLiveRunGraphEvents(file: string): Promise<Array<Record<string, unknown>>> {
  const text = await fs.readFile(file, 'utf8').catch(() => '');
  const out: Array<Record<string, unknown>> = [];
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parsed = safeJsonObject(trimmed);
    if (parsed && textValue(parsed.kind, '') === 'frontier.swarm-codex.live-run-graph-event') out.push(parsed);
  }
  return out;
}

function liveRunGraphFromEvents(events: Array<Record<string, unknown>>, runId: string, generatedAt: number): Record<string, unknown> {
  const nodes = new Map<string, Record<string, unknown>>();
  const edges = new Map<string, Record<string, unknown>>();
  let latestGeneratedAt = generatedAt;
  for (const event of events) {
    latestGeneratedAt = Math.max(latestGeneratedAt, numberValue(event.generatedAt));
    for (const node of recordArray(event.nodes)) {
      const id = textValue(node.id, '');
      if (!id) continue;
      const current = nodes.get(id);
      nodes.set(id, current ? mergeDashboardRunGraphNode(current, node) : node);
    }
    for (const edge of recordArray(event.edges)) {
      const id = textValue(edge.id, `${textValue(edge.kind, 'edge')}:${textValue(edge.from, '')}->${textValue(edge.to, '')}`);
      if (id) edges.set(id, { ...edge, id });
    }
  }
  const nodeList = Array.from(nodes.values());
  const edgeList = Array.from(edges.values());
  return {
    kind: 'frontier.swarm-codex.run-graph',
    version: 1,
    id: `live:${runId}`,
    generatedAt: latestGeneratedAt,
    nodes: nodeList,
    edges: edgeList,
    summary: {
      nodeCount: nodeList.length,
      edgeCount: edgeList.length,
      decisionCount: nodeList.filter((node) => normalized(node.kind) === 'decision').length,
      gateCount: nodeList.filter((node) => normalized(node.kind) === 'gate').length
    }
  };
}

function mergeDashboardRunGraphNode(left: Record<string, unknown>, right: Record<string, unknown>): Record<string, unknown> {
  return {
    ...left,
    ...right,
    data: {
      ...recordValue(left.data),
      ...recordValue(right.data)
    }
  };
}

function activeRunGraphFallback(
  cwd: string,
  runDir: string,
  jobs: Array<Record<string, unknown>>,
  now: number,
  warning: string
): Record<string, unknown> | undefined {
  if (!jobs.length) return undefined;
  const nodes: Array<Record<string, unknown>> = [];
  const edges: Array<Record<string, unknown>> = [];
  for (const job of jobs) {
    const jobId = textValue(job.id ?? job.jobId, 'job');
    const jobNodeId = `job:${jobId}`;
    nodes.push({
      id: jobNodeId,
      kind: 'job',
      label: textValue(job.title ?? jobId, jobId),
      jobId,
      taskId: textValue(job.taskId, ''),
      lane: textValue(job.lane, ''),
      status: textValue(job.status, ''),
      generatedAt: numberValue(job.generatedAt) || now
    });
    if (textValue(job.status, '') !== 'running') {
      const decisionNodeId = `decision:terminal:${jobId}`;
      nodes.push({
        id: decisionNodeId,
        kind: 'decision',
        label: textValue(job.status, 'terminal'),
        jobId,
        taskId: textValue(job.taskId, ''),
        lane: textValue(job.lane, ''),
        status: textValue(job.status, ''),
        outcome: textValue(job.disposition ?? job.mergeReadiness ?? job.status, ''),
        generatedAt: numberValue(job.finishedAt) || numberValue(job.generatedAt) || now
      });
      edges.push({
        id: `decides:${decisionNodeId}->${jobNodeId}`,
        kind: 'decides',
        from: decisionNodeId,
        to: jobNodeId
      });
    }
  }
  return summarizeDashboardRunGraph({
    kind: 'frontier.swarm-codex.run-graph',
    version: 1,
    id: `active-pid:${path.basename(runDir)}`,
    generatedAt: now,
    nodes,
    edges,
    summary: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      decisionCount: nodes.filter((node) => normalized(node.kind) === 'decision').length,
      gateCount: 0
    }
  }, {
    sourceFile: path.relative(cwd, path.join(runDir, LIVE_RUN_GRAPH_EVENTS_FILE)).replaceAll(path.sep, '/'),
    sourceKind: 'active-pid-fallback',
    sourceStatus: 'live',
    graphMissing: true,
    graphMissingWarnings: [warning]
  });
}

async function activeRunJob(
  cwd: string,
  runDir: string,
  entry: Record<string, unknown>,
  planJob: Record<string, unknown> | undefined,
  now: number,
  readOptions: { includeUsage?: boolean } = {}
): Promise<Record<string, unknown>> {
  const jobId = textValue(entry.jobId, 'job');
  const jobDir = path.join(runDir, jobId);
  const lastMessagePath = path.join(jobDir, 'last-message.md');
  const mergePath = path.join(jobDir, 'merge.json');
  const eventsPath = path.join(jobDir, 'codex-events.jsonl');
  const evidenceRecord = recordValue(await readJsonFile(path.join(jobDir, 'evidence', 'evidence.json')));
  const lastMessage = await fs.stat(lastMessagePath).catch(() => undefined);
  const merge = recordValue(await readJsonFile(mergePath));
  const live = isProcessLive(numberValue(entry.pid), entry);
  const quotaDeferred = !live && !lastMessage && !Object.keys(merge).length && await codexEventsHaveQuotaLimit(eventsPath);
  const status = live && !lastMessage ? 'running' : quotaDeferred ? 'completed' : lastMessage || Object.keys(merge).length ? 'completed' : 'failed';
  const startedAt = numberValue(entry.startedAt);
  const finishedAt = status === 'running' ? undefined : Math.max(numberValue(lastMessage?.mtimeMs), numberValue(merge.generatedAt));
  const rawPatchPath = await firstExistingRelativePath(cwd, rawRunPatchCandidates(jobDir));
  const evidencePaths = await existingRelativePaths(cwd, [
    lastMessagePath,
    eventsPath,
    path.join(jobDir, 'evidence', 'last-message.md'),
    path.join(jobDir, 'evidence', 'handoff.md'),
    path.join(jobDir, 'evidence', 'evidence.json'),
    path.join(jobDir, 'evidence', 'resource-allocation.json'),
    ...rawRunPatchCandidates(jobDir),
    ...(Object.keys(merge).length ? [mergePath] : [])
  ]);
  const usage = readOptions.includeUsage === false ? emptyCodexEventUsageSummary() : await readCodexEventUsageSummary(eventsPath);
  const task = recordValue(planJob?.task);
  const compute = recordValue(planJob?.compute);
  const changedPaths = uniquePaths([
    ...stringArray(merge.changedPaths),
    ...await readPatchChangedPathList(cwd, rawPatchPath)
  ]);
  const commandEvidence = commandEvidenceFromRecords(merge, evidenceRecord);
  return withRecomputedCostFields({
    id: jobId,
    jobId,
    originalJobId: jobId,
    taskId: textValue(planJob?.taskId ?? task.id, jobId),
    title: textValue(planJob?.title ?? task.title, jobId),
    lane: textValue(planJob?.lane ?? task.lane, 'active-run'),
    status,
    bucket: quotaDeferred ? 'review-resolved' : status === 'running' ? 'running' : status === 'completed' ? 'completed' : 'failed-evidence',
    disposition: status === 'running' ? 'active' : quotaDeferred ? 'quota-deferred' : status,
    ...(quotaDeferred ? {
      reviewResolved: true,
      coordinatorDecisionStatus: 'quota-deferred',
      originalStatus: 'queued',
      originalBucket: 'queued'
    } : {}),
    agentId: jobId,
    workerId: jobId,
    model: textValue(compute.model, ''),
    computeId: textValue(compute.id, ''),
    reasoningEffort: textValue(compute.reasoningEffort, ''),
    startedAt: startedAt || undefined,
    ...(finishedAt ? { finishedAt } : {}),
    durationMs: startedAt ? Math.max(0, (finishedAt ?? now) - startedAt) : 0,
    ...(usage.inputTokens ? { actualInputTokens: usage.inputTokens, inputTokens: usage.inputTokens } : {}),
    ...(!usage.inputTokens && usage.estimatedInputTokens ? { estimatedInputTokens: usage.estimatedInputTokens } : {}),
    ...(usage.cachedInputTokens ? { cachedInputTokens: usage.cachedInputTokens } : {}),
    ...(usage.uncachedInputTokens ? { uncachedInputTokens: usage.uncachedInputTokens } : {}),
    ...(usage.outputTokens ? { actualOutputTokens: usage.outputTokens, outputTokens: usage.outputTokens } : {}),
    ...(usage.reasoningOutputTokens ? { reasoningOutputTokens: usage.reasoningOutputTokens } : {}),
    ...(usage.eventCount ? {
      usage: {
        input_tokens: usage.inputTokens,
        cached_input_tokens: usage.cachedInputTokens,
        uncached_input_tokens: usage.uncachedInputTokens,
        output_tokens: usage.outputTokens,
        reasoning_output_tokens: usage.reasoningOutputTokens,
        estimated_input_tokens: usage.estimatedInputTokens,
        estimated_from_event_bytes: usage.estimatedFromEventBytes,
        source: 'codex-events.jsonl',
        event_count: usage.eventCount
      }
    } : {}),
    changedPaths,
    changedPathCount: changedPaths.length || numberValue(merge.changedPathCount),
    ...(rawPatchPath ? { patchPath: rawPatchPath, artifactPaths: [rawPatchPath] } : {}),
    evidencePaths,
    evidencePathCount: evidencePaths.length,
    commandsPassed: commandEvidence.passed,
    commandsFailed: commandEvidence.failed,
    collectReasonClasses: status === 'running' ? ['active worker'] : quotaDeferred ? ['quota deferred'] : [],
    mergeReadiness: quotaDeferred ? 'quota-deferred' : textValue(merge.mergeReadiness, status)
  });
}

function activeRunLanes(jobs: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const byLane = new Map<string, Array<Record<string, unknown>>>();
  for (const job of jobs) {
    const lane = textValue(job.lane, 'active-run');
    byLane.set(lane, [...(byLane.get(lane) ?? []), job]);
  }
  return Array.from(byLane.entries()).map(([id, entries]) => ({
    id,
    jobCount: entries.length,
    runningCount: entries.filter((job) => textValue(job.status, '') === 'running').length,
    completedCount: entries.filter((job) => textValue(job.status, '') === 'completed').length,
    failedCount: entries.filter((job) => textValue(job.status, '') === 'failed').length,
    blockedCount: 0,
    evidenceCount: entries.reduce((sum, job) => sum + numberValue(job.evidencePathCount), 0)
  }));
}

function activeRunEvents(jobs: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return jobs.map((job) => ({
    at: numberValue(job.startedAt) || Date.now(),
    type: textValue(job.status, '') === 'running' ? 'worker.started' : 'worker.finished',
    lane: textValue(job.lane, ''),
    jobId: textValue(job.id, ''),
    message: `${textValue(job.title, 'worker')} ${textValue(job.status, 'running')}`
  }));
}

function activeAgentsFromJobs(jobs: unknown[]): Array<Record<string, unknown>> {
  return jobs
    .map(recordValue)
    .filter((job) => textValue(job.status, '') === 'running')
    .map((job) => {
      const id = textValue(job.agentId ?? job.workerId ?? job.originalJobId ?? job.id, 'agent');
      return {
        id,
        agentId: id,
        workerId: textValue(job.workerId ?? job.agentId ?? id, id),
        jobId: textValue(job.originalJobId ?? job.id ?? job.taskId, id),
        taskId: textValue(job.taskId ?? job.originalJobId ?? job.id, id),
        title: textValue(job.title, id),
        lane: textValue(job.lane, ''),
        status: 'active',
        model: textValue(job.model, ''),
        computeId: textValue(job.computeId, ''),
        reasoningEffort: textValue(job.reasoningEffort, ''),
        startedAt: numberValue(job.startedAt) || undefined,
        durationMs: numberValue(job.durationMs),
        inputTokens: numberValue(job.inputTokens || job.actualInputTokens || job.estimatedInputTokens),
        uncachedInputTokens: numberValue(job.uncachedInputTokens),
        cachedInputTokens: numberValue(job.cachedInputTokens),
        outputTokens: numberValue(job.outputTokens || job.actualOutputTokens),
        changedPaths: stringArray(job.changedPaths),
        changedPathCount: numberValue(job.changedPathCount) || stringArray(job.changedPaths).length,
        evidencePaths: stringArray(job.evidencePaths),
        evidencePathCount: numberValue(job.evidencePathCount) || stringArray(job.evidencePaths).length,
        sourceRun: textValue(job.sourceRun, ''),
        sourceLabel: textValue(job.sourceLabel, '')
      };
    });
}

function mergeActiveRunJobTelemetry(jobs: unknown[], activeJobs: Array<Record<string, unknown>>): unknown[] {
  if (!activeJobs.length) return jobs;
  const byKey = new Map<string, Record<string, unknown>>();
  for (const activeJob of activeJobs) {
    if (!hasActiveRunJobState(activeJob)) continue;
    for (const key of jobTelemetryKeys(activeJob)) byKey.set(key, activeJob);
  }
  if (!byKey.size) return jobs;
  return jobs.map((job) => {
    const record = recordValue(job);
    if (!Object.keys(record).length) return job;
    const activeJob = jobTelemetryKeys(record).map((key) => byKey.get(key)).find(Boolean);
    if (!activeJob) return record;
    return {
      ...record,
      ...activeRunJobStateFields(activeJob),
      ...(numberValue(activeJob.actualInputTokens) ? { actualInputTokens: numberValue(activeJob.actualInputTokens) } : {}),
      ...(numberValue(activeJob.inputTokens) ? { inputTokens: numberValue(activeJob.inputTokens) } : {}),
      ...(numberValue(activeJob.estimatedInputTokens) ? { estimatedInputTokens: numberValue(activeJob.estimatedInputTokens) } : {}),
      ...(numberValue(activeJob.cachedInputTokens) ? { cachedInputTokens: numberValue(activeJob.cachedInputTokens) } : {}),
      ...(numberValue(activeJob.uncachedInputTokens) ? { uncachedInputTokens: numberValue(activeJob.uncachedInputTokens) } : {}),
      ...(numberValue(activeJob.actualOutputTokens) ? { actualOutputTokens: numberValue(activeJob.actualOutputTokens) } : {}),
      ...(numberValue(activeJob.outputTokens) ? { outputTokens: numberValue(activeJob.outputTokens) } : {}),
      ...(numberValue(activeJob.reasoningOutputTokens) ? { reasoningOutputTokens: numberValue(activeJob.reasoningOutputTokens) } : {}),
      usage: {
        ...recordValue(record.usage),
        ...recordValue(activeJob.usage)
      }
    };
  });
}

function hasActiveRunJobState(job: Record<string, unknown>): boolean {
  return hasTokenTelemetry(job)
    || Boolean(textValue(job.status, ''))
    || stringArray(job.evidencePaths).length > 0
    || stringArray(job.changedPaths).length > 0
    || Boolean(textValue(job.patchPath, ''));
}

function activeRunJobStateFields(job: Record<string, unknown>): Record<string, unknown> {
  const evidencePaths = stringArray(job.evidencePaths);
  const changedPaths = stringArray(job.changedPaths);
  const artifactPaths = stringArray(job.artifactPaths);
  return {
    ...(textValue(job.status, '') ? { status: textValue(job.status, '') } : {}),
    ...(textValue(job.bucket, '') ? { bucket: textValue(job.bucket, '') } : {}),
    ...(textValue(job.disposition, '') ? { disposition: textValue(job.disposition, '') } : {}),
    ...(textValue(job.mergeReadiness, '') ? { mergeReadiness: textValue(job.mergeReadiness, '') } : {}),
    ...(textValue(job.patchPath, '') ? { patchPath: textValue(job.patchPath, '') } : {}),
    ...(artifactPaths.length ? { artifactPaths: uniquePaths([...artifactPaths, ...stringArray(job.artifactPaths)]) } : {}),
    ...(changedPaths.length ? { changedPaths, changedPathCount: changedPaths.length } : {}),
    ...(evidencePaths.length ? { evidencePaths, evidencePathCount: evidencePaths.length } : {}),
    ...(numberValue(job.commandsPassed) ? { commandsPassed: numberValue(job.commandsPassed) } : {}),
    ...(numberValue(job.commandsFailed) ? { commandsFailed: numberValue(job.commandsFailed) } : {}),
    ...(stringArray(job.collectReasonClasses).length ? { collectReasonClasses: stringArray(job.collectReasonClasses) } : {})
  };
}

function jobTelemetryKeys(job: Record<string, unknown>): string[] {
  return Array.from(new Set([
    textValue(job.id, ''),
    textValue(job.jobId, ''),
    textValue(job.taskId, ''),
    textValue(job.workerId, ''),
    textValue(job.agentId, '')
  ].filter(Boolean)));
}

function hasTokenTelemetry(job: Record<string, unknown>): boolean {
  return numberValue(job.actualInputTokens)
    + numberValue(job.inputTokens)
    + numberValue(job.estimatedInputTokens)
    + numberValue(job.cachedInputTokens)
    + numberValue(job.uncachedInputTokens)
    + numberValue(job.outputTokens)
    + numberValue(job.actualOutputTokens) > 0;
}

async function readCodexEventUsageSummary(file: string): Promise<CodexEventUsageSummary> {
  const empty = emptyCodexEventUsageSummary();
  const stat = await fs.stat(file).catch(() => undefined);
  if (!stat?.isFile() || stat.size > CODEX_EVENTS_USAGE_MAX_BYTES) return empty;
  const text = await fs.readFile(file, 'utf8').catch(() => '');
  if (!text) return empty;
  const summary = emptyCodexEventUsageSummary();
  summary.estimatedFromEventBytes = Buffer.byteLength(text, 'utf8');
  for (const line of text.split(/\r?\n/g)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let event: unknown;
    try {
      event = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const usages = collectCodexUsageRecords(event);
    for (const usage of usages) {
      const normalized = normalizeCodexUsageRecord(usage);
      if (!hasCodexUsageValues(normalized)) continue;
      summary.eventCount += 1;
      summary.inputTokens = Math.max(summary.inputTokens, normalized.inputTokens);
      summary.cachedInputTokens = Math.max(summary.cachedInputTokens, normalized.cachedInputTokens);
      summary.uncachedInputTokens = Math.max(summary.uncachedInputTokens, normalized.uncachedInputTokens);
      summary.outputTokens = Math.max(summary.outputTokens, normalized.outputTokens);
      summary.reasoningOutputTokens = Math.max(summary.reasoningOutputTokens, normalized.reasoningOutputTokens);
    }
  }
  if (summary.inputTokens && !summary.uncachedInputTokens) {
    summary.uncachedInputTokens = Math.max(0, summary.inputTokens - summary.cachedInputTokens);
  }
  if (!hasCodexUsageValues(summary)) {
    summary.estimatedInputTokens = estimateInputTokensFromEventText(text);
  }
  return summary;
}

function emptyCodexEventUsageSummary(): CodexEventUsageSummary {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    uncachedInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
    estimatedInputTokens: 0,
    estimatedFromEventBytes: 0,
    eventCount: 0
  };
}

function estimateInputTokensFromEventText(text: string): number {
  const compactText = text.replace(/\s+/g, ' ').trim();
  if (!compactText) return 0;
  return Math.max(1, Math.ceil(compactText.length / 4));
}

function collectCodexUsageRecords(value: unknown, depth = 0): Array<Record<string, unknown>> {
  if (depth > 5 || !value || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectCodexUsageRecords(entry, depth + 1));
  }
  const record = value as Record<string, unknown>;
  const records: Array<Record<string, unknown>> = [];
  if (looksLikeCodexUsageRecord(record)) records.push(record);
  for (const key of ['usage', 'tokenUsage', 'token_usage', 'openaiUsage', 'openAIUsage']) {
    records.push(...collectCodexUsageRecords(record[key], depth + 1));
  }
  for (const [key, child] of Object.entries(record)) {
    if (['usage', 'tokenUsage', 'token_usage', 'openaiUsage', 'openAIUsage'].includes(key)) continue;
    if (child && typeof child === 'object') records.push(...collectCodexUsageRecords(child, depth + 1));
  }
  return records;
}

function looksLikeCodexUsageRecord(record: Record<string, unknown>): boolean {
  return firstPositiveTokenNumber(
    record.input_tokens,
    record.prompt_tokens,
    record.cached_input_tokens,
    record.cached_prompt_tokens,
    record.output_tokens,
    record.completion_tokens,
    record.reasoning_output_tokens
  ) > 0;
}

function normalizeCodexUsageRecord(record: Record<string, unknown>): CodexEventUsageSummary {
  const inputTokens = firstPositiveTokenNumber(
    record.input_tokens,
    record.prompt_tokens,
    record.inputTokens,
    record.promptTokens
  );
  const cachedInputTokens = Math.min(inputTokens || Number.MAX_SAFE_INTEGER, firstPositiveTokenNumber(
    record.cached_input_tokens,
    record.cached_prompt_tokens,
    record.cached_tokens,
    record.cachedInputTokens,
    record.cachedPromptTokens
  ));
  const uncachedInputTokens = firstPositiveTokenNumber(record.uncached_input_tokens, record.uncachedInputTokens)
    || (inputTokens ? Math.max(0, inputTokens - cachedInputTokens) : 0);
  const outputTokens = firstPositiveTokenNumber(
    record.output_tokens,
    record.completion_tokens,
    record.response_tokens,
    record.generated_tokens,
    record.outputTokens,
    record.completionTokens
  );
  const outputDetails = recordValue(record.output_tokens_details ?? record.completion_tokens_details ?? record.outputTokensDetails);
  const reasoningOutputTokens = firstPositiveTokenNumber(
    record.reasoning_output_tokens,
    record.reasoning_tokens,
    record.reasoningOutputTokens,
    outputDetails.reasoning_tokens,
    outputDetails.reasoningTokens
  );
  return {
    inputTokens,
    cachedInputTokens: cachedInputTokens === Number.MAX_SAFE_INTEGER ? 0 : cachedInputTokens,
    uncachedInputTokens,
    outputTokens,
    reasoningOutputTokens,
    estimatedInputTokens: 0,
    estimatedFromEventBytes: 0,
    eventCount: hasCodexUsageValues({ inputTokens, cachedInputTokens, uncachedInputTokens, outputTokens, reasoningOutputTokens }) ? 1 : 0
  };
}

function hasCodexUsageValues(usage: Pick<CodexEventUsageSummary, 'inputTokens' | 'cachedInputTokens' | 'uncachedInputTokens' | 'outputTokens' | 'reasoningOutputTokens'>): boolean {
  return usage.inputTokens + usage.cachedInputTokens + usage.uncachedInputTokens + usage.outputTokens + usage.reasoningOutputTokens > 0;
}

function firstPositiveTokenNumber(...values: unknown[]): number {
  for (const value of values) {
    const number = numberValue(value);
    if (number > 0) return number;
  }
  return 0;
}

async function resolveRunDirectory(options: NormalizedLoomUiServerOptions): Promise<string | undefined> {
  if (!options.run) return undefined;
  const absolute = path.resolve(options.cwd, options.run);
  if (!isPathInside(options.cwd, absolute)) return undefined;
  const stat = await fs.lstat(absolute).catch(() => undefined);
  if (!stat) return undefined;
  return stat.isDirectory() ? absolute : path.dirname(absolute);
}

async function readJsonFile(file: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return undefined;
  }
}

function withRecomputedCostFields(record: Record<string, unknown>): Record<string, unknown> {
  const sourceRecord = withSourceOutputState(record);
  const model = textValue(record.model ?? record.pricingModel ?? record.pricingMatchedModel, '');
  if (!model || !hasCostTokenEvidence(record)) return sourceRecord;
  const cost = estimateCodexModelCost({
    model,
    estimatedInputTokens: firstCostTokenNumber(record.estimatedInputTokens, record.estimated_input_tokens),
    actualInputTokens: firstCostTokenNumber(record.actualInputTokens, record.inputTokens, record.promptTokens, record.actual_input_tokens, record.input_tokens, record.prompt_tokens),
    cachedInputTokens: firstCostTokenNumber(record.cachedInputTokens, record.cachedPromptTokens, record.cached_input_tokens, record.cached_prompt_tokens),
    uncachedInputTokens: firstCostTokenNumber(record.uncachedInputTokens, record.uncached_input_tokens),
    outputTokens: optionalCostTokenNumber(record.actualOutputTokens, record.outputTokens, record.completionTokens, record.responseTokens, record.actual_output_tokens, record.output_tokens, record.completion_tokens, record.response_tokens)
  });
  return {
    ...sourceRecord,
    billableInputTokens: cost.billableInputTokens,
    priceKnown: cost.priceKnown,
    ...(cost.pricingModel ? { pricingModel: cost.pricingModel } : {}),
    ...(cost.pricingMatchedModel ? { pricingMatchedModel: cost.pricingMatchedModel } : {}),
    ...(cost.pricingSource ? { pricingSource: cost.pricingSource } : {}),
    ...(cost.pricingUpdatedAt ? { pricingUpdatedAt: cost.pricingUpdatedAt } : {}),
    estimatedCostUsd: cost.estimatedCostUsd,
    estimatedInputCostUsd: cost.estimatedInputCostUsd,
    estimatedCachedInputCostUsd: cost.estimatedCachedInputCostUsd,
    estimatedUncachedInputCostUsd: cost.estimatedUncachedInputCostUsd,
    estimatedOutputCostUsd: cost.estimatedOutputCostUsd,
    estimatedCostMicroUsd: cost.estimatedCostMicroUsd,
    costEstimateInputOnly: cost.costEstimateInputOnly,
    costEstimateEstimatedInput: cost.costEstimateEstimatedInput,
    costEstimateMissingOutputTokens: cost.costEstimateMissingOutputTokens,
    costEstimateLongContext: cost.costEstimateLongContext,
    ...(cost.unknownPricingReason ? { unknownPricingReason: cost.unknownPricingReason } : { unknownPricingReason: undefined })
  };
}

function withSourceOutputState(record: Record<string, unknown>): Record<string, unknown> {
  if (textValue(record.sourceOutputState, '')) return record;
  const summary = sourceOutputSummary(record);
  if (!summary.state) return record;
  return {
    ...record,
    sourceOutputState: summary.state,
    sourceOutputLabel: summary.label,
    sourceOutputDetail: summary.detail
  };
}

function sourceOutputSummary(record: Record<string, unknown>): { state: string; label: string; detail: string } {
  const changedPathCount = numberValue(record.changedPathCount) || stringArray(record.changedPaths).length;
  const evidencePathCount = numberValue(record.evidencePathCount) || stringArray(record.evidencePaths).length;
  const hasPatch = sourceOutputHasPatchArtifact(record);
  const signals = sourceOutputSignals(record);
  const recoveryStatus = sourceOutputRecoveryStatus(record);
  const workspaceRecovery = Boolean(recoveryStatus) || signals.some((signal) => signal.includes('collector-workspace-only-recovery'));
  const failedPatch = recoveryStatus === 'failed-patch'
    || signals.some((signal) => signal.includes('collector-workspace-only-recovery-failed-patch') || signal === 'empty patch' || signal === 'empty-patch');

  if (failedPatch) return {
    state: 'recovered-patch-failed',
    label: changedPathCount ? `${changedPathCount} ${changedPathCount === 1 ? 'path' : 'paths'}, patch failed` : 'patch generation failed',
    detail: changedPathCount
      ? 'Source changed, but recovered patch generation failed.'
      : 'Patch generation failed before a source diff could be attached.'
  };
  if (workspaceRecovery && (hasPatch || changedPathCount)) return {
    state: 'recovered-patch',
    label: changedPathCount ? `${changedPathCount} recovered ${changedPathCount === 1 ? 'path' : 'paths'}` : 'recovered patch',
    detail: changedPathCount
      ? 'Source changed and the collector recovered a patch from the worker workspace.'
      : 'The collector recovered a patch, but changed paths are not indexed yet.'
  };
  if (!changedPathCount && hasPatch) return {
    state: 'patch-unindexed',
    label: 'patch not indexed yet',
    detail: 'A patch artifact exists, but changed paths are not indexed yet.'
  };
  if (!changedPathCount && evidencePathCount) return {
    state: 'evidence-only',
    label: 'evidence only',
    detail: 'No source files changed; this task produced evidence only.'
  };
  if (!changedPathCount) return {
    state: 'no-source-files',
    label: 'no source files',
    detail: 'No source files are reported for this task.'
  };
  return { state: '', label: '', detail: '' };
}

function sourceOutputSignals(record: Record<string, unknown>): string[] {
  return uniquePaths([
    ...stringArray(record.collectReasonClasses),
    ...stringArray(record.reasons),
    ...stringArray(record.semanticReadinessReasons),
    textValue(record.disposition, ''),
    textValue(record.mergeReadiness, ''),
    textValue(record.status, '')
  ].map(normalized));
}

function sourceOutputRecoveryStatus(record: Record<string, unknown>): string {
  const metadata = recordValue(record.metadata);
  const swarmCodex = recordValue(metadata.frontierSwarmCodex);
  const workspaceOnly = recordValue(swarmCodex.workspaceOnlyCollection);
  return normalized(workspaceOnly.recoveryStatus);
}

function sourceOutputHasPatchArtifact(record: Record<string, unknown>): boolean {
  const paths = [
    textValue(record.patchPath, ''),
    textValue(record.patchArtifactPath, ''),
    ...stringArray(record.artifactPaths),
    ...stringArray(record.evidencePaths)
  ];
  return paths.some((entry) => /\.patch(?:$|[?#])/.test(entry));
}

function hasCostTokenEvidence(record: Record<string, unknown>): boolean {
  return [
    record.actualInputTokens,
    record.inputTokens,
    record.promptTokens,
    record.estimatedInputTokens,
    record.cachedInputTokens,
    record.uncachedInputTokens,
    record.actualOutputTokens,
    record.outputTokens,
    record.completionTokens,
    record.responseTokens,
    record.actual_input_tokens,
    record.input_tokens,
    record.prompt_tokens,
    record.estimated_input_tokens,
    record.cached_input_tokens,
    record.uncached_input_tokens,
    record.actual_output_tokens,
    record.output_tokens,
    record.completion_tokens,
    record.response_tokens
  ].some((value) => optionalCostTokenNumber(value) !== undefined && optionalCostTokenNumber(value)! > 0);
}

function firstCostTokenNumber(...values: unknown[]): number {
  for (const value of values) {
    const number = optionalCostTokenNumber(value);
    if (number !== undefined && number > 0) return number;
  }
  return 0;
}

function optionalCostTokenNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
  }
  return undefined;
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}

interface CommandEvidence {
  passed: Array<Record<string, unknown>>;
  failed: Array<Record<string, unknown>>;
}

async function commandEvidenceFromArtifactPaths(
  cwd: string,
  evidencePaths: readonly string[],
  outputDir = ''
): Promise<CommandEvidence> {
  let out = emptyCommandEvidence();
  for (const evidencePath of evidencePaths.slice(0, 60)) {
    if (!evidencePath.endsWith('.json')) continue;
    const displayPath = resolveRelativeArtifactPath(outputDir, evidencePath);
    const absolute = path.isAbsolute(displayPath) ? displayPath : path.resolve(cwd, displayPath);
    const roots = uniquePaths([cwd, outputDir].filter(Boolean).map((root) => path.resolve(root)));
    if (!roots.some((root) => isPathInside(root, absolute))) continue;
    out = mergeCommandEvidence(out, commandEvidenceFromRecords(recordValue(await readJsonFile(absolute))));
  }
  return out;
}

function commandEvidenceFromRecords(...records: Array<Record<string, unknown>>): CommandEvidence {
  let out = emptyCommandEvidence();
  for (const record of records) {
    out = mergeCommandEvidence(out, {
      passed: [
        ...commandRecordsFromKnownBucket(record.commandsPassed, 'passed'),
        ...commandRecordsFromKnownBucket(record.passedCommands, 'passed')
      ],
      failed: [
        ...commandRecordsFromKnownBucket(record.commandsFailed, 'failed'),
        ...commandRecordsFromKnownBucket(record.failedCommands, 'failed')
      ]
    });
    for (const key of ['verification', 'commands', 'checks', 'testResults', 'results']) {
      const classified = classifyCommandRecords(recordArray(record[key]));
      out = mergeCommandEvidence(out, classified);
    }
  }
  return out;
}

function commandRecordsFromKnownBucket(value: unknown, fallbackStatus: 'passed' | 'failed'): Array<Record<string, unknown>> {
  return recordArray(value)
    .map((record) => normalizedCommandRecord(record, fallbackStatus))
    .filter((record): record is Record<string, unknown> => Boolean(record));
}

function classifyCommandRecords(records: Array<Record<string, unknown>>): CommandEvidence {
  const out = emptyCommandEvidence();
  for (const record of records) {
    const classified = classifyCommandRecord(record);
    if (classified.status === 'passed') out.passed.push(classified.record);
    else if (classified.status === 'failed') out.failed.push(classified.record);
  }
  return normalizeCommandEvidence(out);
}

function classifyCommandRecord(record: Record<string, unknown>): { status: 'passed' | 'failed' | ''; record: Record<string, unknown> } {
  const statusText = normalized(record.status ?? record.result ?? record.outcome ?? record.state);
  const exitCode = hasOwnKey(record, 'exitCode') ? numberValue(record.exitCode) : undefined;
  const status = commandStatus(statusText, exitCode);
  return { status, record: normalizedCommandRecord(record, status || undefined) ?? record };
}

function commandStatus(statusText: string, exitCode: number | undefined): 'passed' | 'failed' | '' {
  if (['passed', 'pass', 'ok', 'success', 'succeeded', 'completed', 'green'].includes(statusText)) return 'passed';
  if (['failed', 'fail', 'failure', 'error', 'errored', 'red', 'timeout', 'timed-out', 'blocked', 'nonzero'].includes(statusText)) return 'failed';
  if (exitCode !== undefined) return exitCode === 0 ? 'passed' : 'failed';
  return '';
}

function normalizedCommandRecord(
  record: Record<string, unknown>,
  fallbackStatus?: 'passed' | 'failed'
): Record<string, unknown> | undefined {
  const command = textValue(record.command ?? record.cmd ?? record.name ?? record.label, '');
  const cwd = textValue(record.cwd ?? record.dir, '');
  const status = textValue(record.status ?? record.result ?? record.outcome ?? record.state, fallbackStatus ?? '');
  if (!command && !cwd && !status) return undefined;
  return {
    ...record,
    ...(command && !record.command ? { command } : {}),
    ...(cwd && !record.cwd ? { cwd } : {}),
    ...(status && !record.status ? { status } : {})
  };
}

function mergeCommandEvidence(...entries: CommandEvidence[]): CommandEvidence {
  return normalizeCommandEvidence({
    passed: entries.flatMap((entry) => entry.passed),
    failed: entries.flatMap((entry) => entry.failed)
  });
}

function normalizeCommandEvidence(evidence: CommandEvidence): CommandEvidence {
  return {
    passed: uniqueCommandRecords(evidence.passed),
    failed: uniqueCommandRecords(evidence.failed)
  };
}

function uniqueCommandRecords(records: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const seen = new Set<string>();
  const out: Array<Record<string, unknown>> = [];
  for (const record of records) {
    const key = [
      textValue(record.command ?? record.name, ''),
      textValue(record.cwd, ''),
      normalized(record.status ?? record.result ?? record.outcome)
    ].join('\0');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(record);
  }
  return out;
}

function emptyCommandEvidence(): CommandEvidence {
  return { passed: [], failed: [] };
}

function hasOwnKey(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isProcessLive(pid: number, entry?: Record<string, unknown>): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    if (process.platform !== 'win32') {
      const status = spawnSync('ps', ['-o', 'stat=', '-p', String(pid)], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });
      const stat = status.stdout.trim();
      if (stat.startsWith('Z')) return false;
      const commandResult = spawnSync('ps', ['-o', 'command=', '-p', String(pid)], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });
      const command = commandResult.stdout.trim();
      if (!processCommandMatchesPidManifest(command, entry)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function processCommandMatchesPidManifest(command: string, entry: Record<string, unknown> | undefined): boolean {
  if (!entry) return true;
  const role = textValue(entry.role, '');
  const jobId = textValue(entry.jobId, '');
  const expected = stringArray(entry.command).join(' ');
  if (role === 'codex' && !/\bcodex\b|Codex\.app/i.test(command)) return false;
  if (jobId && !command.includes(jobId)) return false;
  if (expected && expected.includes('codex') && !/\bcodex\b|Codex\.app/i.test(command)) return false;
  return true;
}

async function readTaskDetails(
  options: NormalizedLoomUiServerOptions,
  jobId: string,
  sourceRun = ''
): Promise<FrontierLoomUiTaskDetailsResponse> {
  if (!jobId) return { ok: false, jobId, files: [], commandsPassed: [], commandsFailed: [], evidenceArtifacts: [], error: 'missing job id' };
  const entry = await findCollectionBundle(options, jobId) ?? await findRawRunTaskBundle(options, jobId, sourceRun);
  if (!entry) return { ok: false, jobId, files: [], commandsPassed: [], commandsFailed: [], evidenceArtifacts: [], error: 'task not found in collection' };
  const { bundle, outputDir } = entry;
  const patchPath = textValue(bundle.patchPath, '');
  const evidencePaths = stringArray(bundle.evidencePaths).slice(0, 40);
  const evidenceCommands = await commandEvidenceFromArtifactPaths(options.cwd, evidencePaths, outputDir);
  const commandEvidence = mergeCommandEvidence(commandEvidenceFromRecords(bundle), evidenceCommands);
  return {
    ok: true,
    jobId,
    ...(patchPath ? { patchArtifact: artifactRecord(patchPath) } : {}),
    files: patchPath ? await readPatchFiles(options, patchPath) : [],
    commandsPassed: commandEvidence.passed.slice(0, 20),
    commandsFailed: commandEvidence.failed.slice(0, 20),
    evidenceArtifacts: evidencePaths.map((evidencePath) => artifactRecord(resolveRelativeArtifactPath(outputDir, evidencePath), evidencePath))
  };
}

async function findRawRunTaskBundle(
  options: NormalizedLoomUiServerOptions,
  jobId: string,
  sourceRun = ''
): Promise<{ bundle: Record<string, unknown>; outputDir?: string } | undefined> {
  const sourceRunRoot = sourceRun ? safeCwdRelativeDirectory(options.cwd, sourceRun) : undefined;
  const hintedRoot = sourceRunRoot ?? rawRunSourceHint(options.cwd, jobId);
  const root = hintedRoot ?? path.join(options.cwd, 'agent-runs');
  const stat = await fs.stat(root).catch(() => undefined);
  if (!stat?.isDirectory()) return undefined;
  const matches = await findRawRunJobDirs(root, jobId, 0);
  if (!matches.length) return undefined;
  const scoredMatches = await Promise.all(matches.map(async (match) => {
    const patchPath = await firstExistingRelativePath(options.cwd, rawRunPatchCandidates(match));
    const matchStat = await fs.stat(match).catch(() => undefined);
    return { match, patchPath, mtimeMs: matchStat?.mtimeMs ?? 0 };
  }));
  scoredMatches.sort((left, right) => {
    const patchScore = Number(Boolean(right.patchPath)) - Number(Boolean(left.patchPath));
    if (patchScore) return patchScore;
    const timeScore = right.mtimeMs - left.mtimeMs;
    if (timeScore) return timeScore;
    return right.match.localeCompare(left.match);
  });
  const { match, patchPath } = scoredMatches[0];
  const evidencePaths = await existingRelativePaths(options.cwd, [
    path.join(match, 'last-message.md'),
    path.join(match, 'codex-events.jsonl'),
    path.join(match, 'evidence', 'last-message.md'),
    path.join(match, 'evidence', 'handoff.md'),
    path.join(match, 'evidence', 'evidence.json'),
    path.join(match, 'evidence', 'resource-allocation.json'),
    ...rawRunPatchCandidates(match)
  ]);
  const evidenceCommands = await commandEvidenceFromArtifactPaths(options.cwd, evidencePaths);
  return {
    bundle: {
      jobId: path.basename(match),
      patchPath,
      changedPaths: await readPatchChangedPathList(options.cwd, patchPath),
      evidencePaths,
      commandsPassed: evidenceCommands.passed,
      commandsFailed: evidenceCommands.failed
    }
  };
}

function rawRunSourceHint(cwd: string, jobId: string): string | undefined {
  const match = /(?:^|:)(agent-runs\/[^:]+)/.exec(jobId);
  if (!match) return undefined;
  const absolute = path.resolve(cwd, match[1]);
  return isPathInside(cwd, absolute) ? absolute : undefined;
}

function safeCwdRelativeDirectory(cwd: string, input: string): string | undefined {
  const absolute = path.resolve(cwd, input);
  if (!isPathInside(cwd, absolute)) return undefined;
  return absolute;
}

async function findRawRunJobDirs(root: string, jobId: string, depth: number): Promise<string[]> {
  if (depth > 5) return [];
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const matches: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'streams' || entry.name === 'artifact-store' || entry.name.startsWith('.')) continue;
    const absolute = path.join(root, entry.name);
    if (rawRunJobIdMatches(jobId, entry.name) && await rawRunJobHasArtifacts(absolute)) matches.push(absolute);
    matches.push(...await findRawRunJobDirs(absolute, jobId, depth + 1));
  }
  return matches;
}

async function rawRunJobHasArtifacts(jobDir: string): Promise<boolean> {
  for (const file of [
    path.join(jobDir, 'last-message.md'),
    path.join(jobDir, 'codex-events.jsonl'),
    ...rawRunPatchCandidates(jobDir)
  ]) {
    const stat = await fs.stat(file).catch(() => undefined);
    if (stat?.isFile()) return true;
  }
  return false;
}

function rawRunJobIdMatches(requestedId: string, jobId: string): boolean {
  return requestedId === jobId || requestedId.endsWith(`:${jobId}`) || requestedId.endsWith(`-${jobId}`);
}

async function findCollectionBundle(
  options: NormalizedLoomUiServerOptions,
  jobId: string
): Promise<{ bundle: Record<string, unknown>; outputDir?: string } | undefined> {
  const collectionFile = await resolveArtifactFile(options.cwd, options.collection, ['collection.json', 'coordinator-query.json']);
  if (!collectionFile) return undefined;
  const collection = JSON.parse(await fs.readFile(collectionFile, 'utf8')) as Record<string, unknown>;
  const buckets = recordValue(collection.buckets);
  for (const entries of Object.values(buckets)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const row = recordValue(entry);
      const bundle = recordValue(row.bundle);
      if (textValue(row.jobId, '') === jobId || textValue(bundle.jobId, '') === jobId) {
        return { bundle, outputDir: textValue(row.outputDir, '') };
      }
    }
  }
  const jobs = Array.isArray(collection.jobs) ? collection.jobs : [];
  for (const job of jobs) {
    const row = recordValue(job);
    if (textValue(row.id ?? row.jobId, '') === jobId) return { bundle: row, outputDir: textValue(row.outputDir, '') };
  }
  return undefined;
}

async function resolveArtifactFile(cwd: string, input: string | undefined, names: string[]): Promise<string | undefined> {
  if (!input) return undefined;
  const absolute = path.resolve(cwd, input);
  const stat = await fs.lstat(absolute).catch(() => undefined);
  if (!stat) return undefined;
  if (!isPathInside(cwd, absolute)) return undefined;
  if (!stat.isDirectory()) return absolute;
  for (const name of names) {
    const candidate = path.join(absolute, name);
    const candidateStat = await fs.stat(candidate).catch(() => undefined);
    if (candidateStat?.isFile()) return candidate;
  }
  return undefined;
}

async function writeHumanActionAnswer(
  options: NormalizedLoomUiServerOptions,
  body: Record<string, unknown>
): Promise<FrontierLoomUiHumanActionAnswerResponse> {
  const code = textValue(body.code, '').trim();
  const answer = textValue(body.answer, '').trim();
  if (!code) return { ok: false, code, error: 'missing question code' };
  if (!answer) return { ok: false, code, error: 'missing answer' };
  if (answer.length > HUMAN_ACTION_ANSWER_MAX_BYTES) return { ok: false, code, error: 'answer is too large' };

  const answerPath = await humanActionAnswerLogPath(options);
  await fs.mkdir(path.dirname(answerPath), { recursive: true });
  const record: FrontierLoomUiHumanActionAnswerRecord = {
    type: 'human-action.answer',
    at: Date.now(),
    code,
    answer,
    source: 'frontier-loom-ui'
  };
  await fs.appendFile(answerPath, JSON.stringify(record) + '\n', 'utf8');
  notifyDashboardStreams();
  return { ok: true, code, answerPath };
}

function notifyDashboardStreams(): void {
  invalidateDashboardSnapshotCache();
  for (const listener of dashboardStreamListeners) listener();
}

async function readHumanActionAnswers(options: NormalizedLoomUiServerOptions): Promise<FrontierLoomUiHumanActionAnswerRecord[]> {
  const answerPath = await humanActionAnswerLogPath(options);
  const body = await fs.readFile(answerPath, 'utf8').catch(() => '');
  if (!body.trim()) return [];
  const rows: FrontierLoomUiHumanActionAnswerRecord[] = [];
  for (const line of body.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const record = recordValue(JSON.parse(line));
      const code = textValue(record.code, '').trim();
      const answer = textValue(record.answer, '').trim();
      const at = Number(record.at);
      if (!code || !answer || !Number.isFinite(at)) continue;
      rows.push({
        type: 'human-action.answer',
        at,
        code,
        answer,
        source: 'frontier-loom-ui'
      });
    } catch {
      continue;
    }
  }
  return rows
    .sort((left, right) => left.at - right.at)
    .slice(-200);
}

async function humanActionAnswerLogPath(options: NormalizedLoomUiServerOptions): Promise<string> {
  return path.join(await humanActionAnswerDir(options), 'human-action-answers.jsonl');
}

async function humanActionAnswerDir(options: NormalizedLoomUiServerOptions): Promise<string> {
  if (options.run) {
    const absolute = path.resolve(options.cwd, options.run);
    const stat = await fs.lstat(absolute).catch(() => undefined);
    if (stat?.isDirectory()) return absolute;
    if (stat) return path.dirname(absolute);
  }
  if (options.collection) {
    const absolute = path.resolve(options.cwd, options.collection);
    const stat = await fs.lstat(absolute).catch(() => undefined);
    if (stat?.isDirectory()) return absolute;
    if (stat) return path.dirname(absolute);
  }
  return path.join(options.cwd, 'agent-runs', 'loom-ui-human-actions');
}

async function readPatchFiles(options: NormalizedLoomUiServerOptions, patchPath: string): Promise<FrontierLoomUiTaskFileDiff[]> {
  const absolute = path.resolve(options.cwd, patchPath);
  if (!isPathInside(options.cwd, absolute)) return [];
  const stat = await fs.stat(absolute).catch(() => undefined);
  if (!stat?.isFile() || stat.size > TASK_DETAIL_PATCH_MAX_BYTES) return [];
  const patch = await fs.readFile(absolute, 'utf8');
  return parseUnifiedPatchFiles(patch).slice(0, 40);
}

function parseUnifiedPatchFiles(patch: string): FrontierLoomUiTaskFileDiff[] {
  const sections = splitUnifiedPatchSections(patch);
  return sections.flatMap((section) => {
    const lines = section.split('\n');
    const pathLine = lines.find((line) => line.startsWith('+++ ')) ?? lines.find((line) => line.startsWith('diff --git '));
    const filePath = patchFilePath(pathLine ?? '');
    if (!filePath) return [];
    const additions = lines.filter((line) => line.startsWith('+') && !line.startsWith('+++')).length;
    const deletions = lines.filter((line) => line.startsWith('-') && !line.startsWith('---')).length;
    const truncated = section.length > TASK_DETAIL_FILE_DIFF_MAX_CHARS;
    return [{
      path: filePath,
      additions,
      deletions,
      diff: truncated ? `${section.slice(0, TASK_DETAIL_FILE_DIFF_MAX_CHARS)}\n... truncated ...` : section,
      language: languageForPath(filePath),
      artifactPath: filePath,
      hunks: parseUnifiedPatchHunks(truncated ? section.slice(0, TASK_DETAIL_FILE_DIFF_MAX_CHARS) : section),
      truncated
    }];
  });
}

function splitUnifiedPatchSections(patch: string): string[] {
  if (/^diff --git /m.test(patch)) {
    return patch.split(/\n(?=diff --git )/g).filter((section) => section.trim().length > 0);
  }
  const lines = patch.split('\n');
  const sections: string[] = [];
  let current: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const next = lines[index + 1] ?? '';
    const startsPlainFile = line.startsWith('--- ') && next.startsWith('+++ ');
    if (startsPlainFile && current.length) {
      sections.push(current.join('\n'));
      current = [];
    }
    current.push(line);
  }
  if (current.some((line) => line.trim().length > 0)) sections.push(current.join('\n'));
  return sections;
}

function parseUnifiedPatchHunks(section: string): FrontierLoomUiDiffHunk[] {
  const hunks: FrontierLoomUiDiffHunk[] = [];
  let current: FrontierLoomUiDiffHunk = { header: 'File header', lines: [] };
  let oldLine = 0;
  let newLine = 0;
  for (const line of section.split('\n')) {
    const hunk = /^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@(.*)$/.exec(line);
    if (hunk) {
      if (current.lines.length) hunks.push(current);
      current = { header: line, lines: [{ kind: 'hunk', content: line }] };
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      continue;
    }
    if (!current.lines.length && line.startsWith('diff --git ')) current.header = line;
    if (line.startsWith('+') && !line.startsWith('+++')) {
      current.lines.push({ kind: 'add', newLine, content: line.slice(1) });
      newLine += 1;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      current.lines.push({ kind: 'delete', oldLine, content: line.slice(1) });
      oldLine += 1;
    } else if (line.startsWith(' ')) {
      current.lines.push({ kind: 'context', oldLine, newLine, content: line.slice(1) });
      oldLine += 1;
      newLine += 1;
    } else {
      current.lines.push({ kind: line.startsWith('@@') ? 'hunk' : 'meta', content: line });
    }
  }
  if (current.lines.length) hunks.push(current);
  return hunks;
}

function patchFilePath(line: string): string {
  const plus = /^\+\+\+\s+(?:b\/)?(.+)$/.exec(line);
  if (plus && plus[1] !== '/dev/null') return normalizePatchDisplayPath(plus[1]);
  const diff = /^diff --git\s+a\/(.+?)\s+b\/(.+)$/.exec(line);
  return normalizePatchDisplayPath(diff?.[2] ?? '');
}

function normalizePatchDisplayPath(value: string): string {
  let clean = value.trim().split(/\t/g)[0]?.trim() ?? '';
  clean = clean.replace(/^(?:a|b)\//, '');
  const packageIndex = clean.indexOf('/packages/');
  if (packageIndex >= 0) clean = clean.slice(packageIndex + 1);
  const repoPackageIndex = clean.indexOf('packages/');
  if (repoPackageIndex > 0) clean = clean.slice(repoPackageIndex);
  return clean === '/dev/null' ? '' : clean;
}

function artifactRecord(pathValue: string, label = pathValue): FrontierLoomUiTaskArtifact {
  return {
    path: pathValue,
    label: shortArtifactLabel(label)
  };
}

function shortArtifactLabel(value: string): string {
  const clean = value.replace(/\/+$/g, '');
  return clean.split(/[\\/]/g).filter(Boolean).pop() ?? clean;
}

function resolveRelativeArtifactPath(base: string | undefined, artifactPath: string): string {
  if (!artifactPath || path.isAbsolute(artifactPath) || !base) return artifactPath;
  return path.join(base, artifactPath);
}

function languageForPath(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (['.ts', '.tsx', '.mts', '.cts'].includes(extension)) return 'typescript';
  if (['.js', '.jsx', '.mjs', '.cjs'].includes(extension)) return 'javascript';
  if (extension === '.json') return 'json';
  if (extension === '.css') return 'css';
  if (extension === '.html') return 'html';
  if (['.md', '.markdown'].includes(extension)) return 'markdown';
  return 'text';
}

async function readArtifact(options: NormalizedLoomUiServerOptions, artifactPath: string): Promise<FrontierLoomUiArtifactResponse> {
  const resolved = await resolveViewableArtifact(options, artifactPath);
  if (!resolved.ok) return { ok: false, path: artifactPath, label: shortArtifactLabel(artifactPath), error: resolved.error };
  const stat = await fs.stat(resolved.path).catch(() => undefined);
  if (!stat) return { ok: false, path: artifactPath, label: shortArtifactLabel(artifactPath), error: 'artifact not found' };
  if (stat.isDirectory()) {
    const entries = await artifactDirectoryEntries(resolved.path);
    return {
      ok: true,
      path: artifactPath,
      label: shortArtifactLabel(artifactPath),
      kind: 'directory',
      entries
    };
  }
  if (!stat.isFile()) return { ok: false, path: artifactPath, label: shortArtifactLabel(artifactPath), error: 'artifact is not a file' };
  const size = stat.size;
  const readBytes = Math.min(size, ARTIFACT_VIEW_MAX_BYTES);
  const handle = await fs.open(resolved.path, 'r');
  try {
    const buffer = Buffer.alloc(readBytes);
    await handle.read(buffer, 0, readBytes, 0);
    return {
      ok: true,
      path: artifactPath,
      label: shortArtifactLabel(artifactPath),
      kind: 'file',
      size,
      contentType: contentType(resolved.path),
      content: buffer.toString('utf8'),
      truncated: size > ARTIFACT_VIEW_MAX_BYTES
    };
  } finally {
    await handle.close();
  }
}

async function serveArtifactRaw(
  response: http.ServerResponse,
  options: NormalizedLoomUiServerOptions,
  artifactPath: string
): Promise<void> {
  const resolved = await resolveViewableArtifact(options, artifactPath);
  if (!resolved.ok) {
    writeJson(response, 404, { ok: false, error: resolved.error });
    return;
  }
  const stat = await fs.stat(resolved.path).catch(() => undefined);
  if (!stat) {
    writeJson(response, 404, { ok: false, error: 'artifact not found' });
    return;
  }
  if (stat.isDirectory()) {
    writeJson(response, 200, {
      ok: true,
      path: artifactPath,
      kind: 'directory',
      entries: await artifactDirectoryEntries(resolved.path)
    });
    return;
  }
  await serveFile(response, resolved.path, contentType(resolved.path));
}

async function revealArtifactInFileManager(
  options: NormalizedLoomUiServerOptions,
  artifactPath: string,
  dryRun: boolean
): Promise<FrontierLoomUiArtifactRevealResponse> {
  const resolved = await resolveViewableArtifact(options, artifactPath);
  if (!resolved.ok) return { ok: false, path: artifactPath, error: resolved.error };
  const stat = await fs.stat(resolved.path).catch(() => undefined);
  if (!stat) return { ok: false, path: artifactPath, error: 'artifact not found' };
  const target = fileManagerTarget(resolved.path, stat.isDirectory());
  if (!target) return { ok: false, path: artifactPath, revealedPath: resolved.path, error: 'no supported file manager command for this platform' };
  const result: FrontierLoomUiArtifactRevealResponse = {
    ok: true,
    path: artifactPath,
    revealedPath: resolved.path,
    command: target.command,
    args: target.args,
    dryRun
  };
  if (dryRun) return result;
  await spawnDetached(target.command, target.args);
  return result;
}

function fileManagerTarget(filePath: string, isDirectory: boolean): { command: string; args: string[] } | undefined {
  if (process.platform === 'darwin') {
    return isDirectory
      ? { command: 'open', args: [filePath] }
      : { command: 'open', args: ['-R', filePath] };
  }
  if (process.platform === 'win32') {
    return isDirectory
      ? { command: 'explorer.exe', args: [filePath] }
      : { command: 'explorer.exe', args: [`/select,${filePath}`] };
  }
  if (process.platform === 'linux' || process.platform === 'freebsd' || process.platform === 'openbsd') {
    return { command: 'xdg-open', args: [isDirectory ? filePath : path.dirname(filePath)] };
  }
  return undefined;
}

async function spawnDetached(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', resolve);
    child.unref();
  });
}

async function artifactDirectoryEntries(root: string): Promise<FrontierLoomUiArtifactEntry[]> {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const rows: FrontierLoomUiArtifactEntry[] = [];
  for (const entry of entries.slice(0, ARTIFACT_DIRECTORY_MAX_ENTRIES)) {
    if (entry.name.startsWith('.')) continue;
    const entryPath = path.join(root, entry.name);
    const stat = await fs.stat(entryPath).catch(() => undefined);
    rows.push({
      name: entry.name,
      path: entryPath,
      kind: entry.isDirectory() ? 'directory' : 'file',
      ...(stat?.isFile() ? { size: stat.size } : {})
    });
  }
  return rows;
}

async function resolveViewableArtifact(
  options: NormalizedLoomUiServerOptions,
  artifactPath: string
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (!artifactPath) return { ok: false, error: 'missing artifact path' };
  if (hasHiddenPathSegment(artifactPath)) return { ok: false, error: 'hidden files are not viewable' };
  const roots = await dashboardArtifactRoots(options);
  const candidates = path.isAbsolute(artifactPath)
    ? [path.resolve(artifactPath)]
    : roots.map((root) => path.resolve(root, artifactPath));
  for (const candidate of candidates) {
    if (hasHiddenPathSegment(path.relative(path.dirname(candidate), candidate))) continue;
    if (!roots.some((root) => isPathInside(root, candidate))) continue;
    const stat = await fs.stat(candidate).catch(() => undefined);
    if (stat) return { ok: true, path: candidate };
  }
  return { ok: false, error: 'artifact not found or outside configured roots' };
}

async function dashboardArtifactRoots(options: NormalizedLoomUiServerOptions): Promise<string[]> {
  const roots = [options.cwd];
  for (const input of [options.run, options.collection, options.continuation]) {
    if (!input) continue;
    const absolute = path.resolve(options.cwd, input);
    const stat = await fs.lstat(absolute).catch(() => undefined);
    if (!stat) continue;
    roots.push(stat.isDirectory() ? absolute : path.dirname(absolute));
  }
  return uniquePaths(roots.map((root) => path.resolve(root)));
}

function hasHiddenPathSegment(value: string): boolean {
  return value.split(/[\\/]/g).some((segment) => segment.startsWith('.') && segment.length > 1);
}

function recordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.map(recordValue).filter((entry) => Object.keys(entry).length > 0) : [];
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function textValue(value: unknown, fallback: string): string {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function numberValue(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function normalized(value: unknown): string {
  return textValue(value, '').trim().toLowerCase();
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function isPathInside(root: string, value: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(value));
  return relative === '' || Boolean(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

async function readHealth(options: NormalizedLoomUiServerOptions): Promise<FrontierLoomUiHealthResponse> {
  const sources = {
    run: await inspectHealthSource(options.cwd, options.run, 'swarm-results.json'),
    collection: await inspectHealthSource(options.cwd, options.collection, 'collection.json'),
    continuation: await inspectHealthSource(options.cwd, options.continuation, 'continuation.json')
  };
  const configuredSources = Object.values(sources).filter((source) => source.configured);
  return {
    ok: configuredSources.every((source) => source.status === 'ready'),
    service: 'frontier-loom-ui',
    generatedAt: Date.now(),
    cwd: options.cwd,
    sources
  };
}

async function inspectHealthSource(cwd: string, input: string | undefined, defaultFile: string): Promise<FrontierLoomUiHealthSource> {
  if (!input) return { configured: false, status: 'not-configured' };
  const absolute = path.resolve(cwd, input);
  const stat = await fs.lstat(absolute).catch((error: unknown) => ({ error }));
  if (!stat || 'error' in stat) {
    return {
      configured: true,
      status: 'missing',
      input,
      file: absolute,
      error: errorMessage(stat && 'error' in stat ? stat.error : undefined)
    };
  }
  const file = stat.isDirectory() ? path.join(absolute, defaultFile) : absolute;
  try {
    const fileStat = await fs.stat(file);
    if (fileStat.size <= HEALTH_JSON_PARSE_MAX_BYTES) {
      const text = await fs.readFile(file, 'utf8');
      JSON.parse(text);
    }
    return {
      configured: true,
      status: 'ready',
      input,
      file,
      dir: stat.isDirectory() ? absolute : path.dirname(file)
    };
  } catch (error) {
    return {
      configured: true,
      status: (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' : 'invalid',
      input,
      file,
      dir: stat.isDirectory() ? absolute : path.dirname(file),
      error: errorMessage(error)
    };
  }
}

function errorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : error === undefined ? undefined : String(error);
}

function staticFile(root: string, pathname: string): string {
  const clean = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const resolved = path.resolve(root, clean);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) return path.join(root, 'index.html');
  return resolved;
}

async function serveFile(response: http.ServerResponse, file: string, type: string): Promise<void> {
  try {
    const body = await fs.readFile(file);
    response.writeHead(200, responseHeaders(type));
    response.end(body);
  } catch {
    writeJson(response, 404, { ok: false, error: 'not found' });
  }
}

function writeJson(response: http.ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, responseHeaders('application/json; charset=utf-8'));
  response.end(JSON.stringify(value, null, 2));
}

function serveFavicon(response: http.ServerResponse): void {
  response.writeHead(200, responseHeaders('image/svg+xml; charset=utf-8'));
  response.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="4" fill="#0b0d0f"/><path d="M4 5h8v2H6v2h5v2H4z" fill="#d6d9de"/></svg>');
}

async function readJsonBody(request: http.IncomingMessage, maxBytes: number): Promise<unknown> {
  let bytes = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > maxBytes) throw new Error('request body too large');
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  return JSON.parse(text);
}

function responseHeaders(contentType: string): Record<string, string> {
  return {
    'content-type': contentType,
    'cache-control': 'no-store, max-age=0',
    pragma: 'no-cache'
  };
}

function resolveFrontierDomRuntime(): string {
  const candidates = [
    path.join(packageDir, '..', 'node_modules', '@shapeshift-labs', 'frontier-dom', 'dist', 'jsx-runtime.js'),
    path.join(packageDir, '..', '..', 'frontier-dom', 'dist', 'jsx-runtime.js')
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function contentType(file: string): string {
  if (file.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  return 'application/octet-stream';
}
