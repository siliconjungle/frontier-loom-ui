import { watch, type FSWatcher } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readCodexDashboardSnapshot,
  type FrontierCodexDashboardSnapshotInput
} from '@shapeshift-labs/frontier-swarm-codex';

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const HEALTH_JSON_PARSE_MAX_BYTES = 16 * 1024 * 1024;
const TASK_DETAIL_PATCH_MAX_BYTES = 512 * 1024;
const TASK_DETAIL_FILE_DIFF_MAX_CHARS = 24_000;
const ARTIFACT_VIEW_MAX_BYTES = 768 * 1024;
const ARTIFACT_DIRECTORY_MAX_ENTRIES = 200;
const HUMAN_ACTION_ANSWER_MAX_BYTES = 16 * 1024;
const CODEX_EVENTS_USAGE_MAX_BYTES = 8 * 1024 * 1024;
const LIFETIME_DASHBOARD_MAX_SOURCES = 80;
const LIFETIME_DASHBOARD_MAX_JOBS = 800;
const LIFETIME_DASHBOARD_SCAN_MAX_FILES = 600;
const LIFETIME_DASHBOARD_SCAN_MAX_DEPTH = 5;
const LIFETIME_DASHBOARD_MAX_DRAIN_RUNS = 6;
const LIFETIME_DASHBOARD_MAX_QUEUE_TASKS = 500;
const LIFETIME_DASHBOARD_RESET_FILE = '.loom-ui-reset.json';
const REVIEW_DECISIONS_FILE = '.loom-ui-review-decisions.json';
const dashboardStreamListeners = new Set<() => void>();

export interface FrontierLoomUiServerOptions extends FrontierCodexDashboardSnapshotInput {
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
    writeJson(response, 200, await readDashboardSnapshot(options));
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
      const snapshot = await readDashboardSnapshot(options);
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
    return watch(root, { recursive }, onChange);
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

function dashboardInput(options: FrontierLoomUiServerOptions & { cwd: string }): FrontierCodexDashboardSnapshotInput {
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

async function readScopedDashboardSnapshot(options: NormalizedLoomUiServerOptions): Promise<unknown> {
  const snapshot = await readCodexDashboardSnapshot(dashboardInput(options));
  const activeRunSnapshot = await readActiveRunSnapshot(options);
  const reviewDecisions = await readCoordinatorReviewDecisions(options.cwd);
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return activeRunSnapshot ?? snapshot;
  const answers = await readHumanActionAnswers(options);
  const record = snapshot as unknown as Record<string, unknown>;
  const jobs = Array.isArray(record.jobs) ? record.jobs : [];
  const activeJobs = recordArray(activeRunSnapshot?.jobs);
  if (shouldPreferActiveRunSnapshot(jobs, activeJobs)) {
    return {
      ...activeRunSnapshot,
      collectionJobs: jobs,
      humanActions: recordArray(record.humanActions),
      humanActionAnswers: answers,
      sources: {
        ...recordValue(record.sources),
        ...recordValue(activeRunSnapshot?.sources),
        ...(reviewDecisions.length ? { coordinatorReviewDecisions: coordinatorReviewDecisionPath(options.cwd) } : {}),
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
  const mergedJobs = applyCoordinatorReviewDecisions(mergeActiveRunJobTelemetry(jobs, activeJobs), reviewDecisions);
  return {
    ...normalizeCoordinatorFacingSnapshot(record),
    jobs: mergedJobs,
    humanActionAnswers: answers,
    sources: {
      ...recordValue(record.sources),
      ...(reviewDecisions.length ? { coordinatorReviewDecisions: coordinatorReviewDecisionPath(options.cwd) } : {}),
      ...(answers.length ? { humanActionAnswers: await humanActionAnswerLogPath(options) } : {})
    }
  };
}

async function readLifetimeDashboardSnapshot(options: NormalizedLoomUiServerOptions): Promise<Record<string, unknown>> {
  const sources = await discoverLifetimeDashboardSources(options.cwd);
  const snapshots: Array<{ source: LifetimeDashboardSource; snapshot: Record<string, unknown> }> = [];
  for (const source of sources.slice(0, LIFETIME_DASHBOARD_MAX_SOURCES)) {
    try {
      const snapshot = recordValue(await readScopedDashboardSnapshot({
        ...options,
        run: source.run,
        collection: source.collection,
        continuation: source.continuation
      }));
      if (Object.keys(snapshot).length) snapshots.push({ source, snapshot });
    } catch {
      continue;
    }
  }
  const lifetime = combineLifetimeDashboardSnapshots(
    options,
    sources,
    snapshots,
    await readCoordinatorReviewDecisions(options.cwd),
    await readLifetimeQueueBacklog(options.cwd)
  );
  return mergeLifetimeDrainCoordinatorSnapshot(lifetime, await readLatestDrainCoordinatorSnapshot(options.cwd));
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
    const hasRun = entry.files.has('swarm-results.json') || entry.files.has('pids.json') || entry.files.has('coordinator-dashboard.json');
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
  return textValue(job.originalJobId ?? job.taskId ?? job.id ?? job.jobId, '').trim();
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
  return textValue(job.originalJobId ?? job.jobId ?? job.taskId, '').trim();
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

function combineLifetimeDashboardSnapshots(
  options: NormalizedLoomUiServerOptions,
  discoveredSources: LifetimeDashboardSource[],
  snapshots: Array<{ source: LifetimeDashboardSource; snapshot: Record<string, unknown> }>,
  reviewDecisions: CoordinatorReviewDecision[],
  queueBacklog: LifetimeQueueBacklog
): Record<string, unknown> {
  const jobs = dedupeLifetimeDashboardJobs(collapseSupersededLifetimeReviewJobs(applyCoordinatorReviewDecisions(snapshots.flatMap(({ source, snapshot }) => {
    return recordArray(snapshot.jobs).map((job) => ({
      ...job,
      id: lifetimeScopedId(source, textValue(job.id ?? job.jobId ?? job.taskId, 'job')),
      originalJobId: textValue(job.id ?? job.jobId ?? job.taskId, 'job'),
      sourceRun: source.run,
      sourceCollection: source.collection,
      sourceContinuation: source.continuation,
      sourceLabel: source.label,
      generatedAt: numberValue(job.generatedAt) || numberValue(snapshot.generatedAt) || source.mtimeMs
    }));
  }), reviewDecisions))).slice(0, LIFETIME_DASHBOARD_MAX_JOBS);
  const humanActionAnswers = recordArray(awaitNoop([]));
  const summary = lifetimeDashboardSummary(jobs);
  const latestGeneratedAt = Math.max(Date.now(), numberValue(queueBacklog.generatedAt), ...snapshots.map((entry) => numberValue(entry.snapshot.generatedAt)), ...discoveredSources.map((source) => source.mtimeMs));
  const events = snapshots.flatMap(({ source, snapshot }) => recordArray(snapshot.events).map((event) => ({
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
      loadedSourceCount: snapshots.length,
      queueSourceCount: queueBacklog.sourceCount,
      ...(reviewDecisions.length ? { coordinatorReviewDecisions: coordinatorReviewDecisionPath(options.cwd) } : {})
    },
    summary,
    semantic: lifetimeSemanticSummary(jobs),
    health: lifetimeHealthSummary(jobs),
    quality: {},
    timeSeries: lifetimeTimeSeries(jobs, events),
    lanes: lifetimeLaneRows(jobs),
    capacity: lifetimeCapacitySummary(queueBacklog, jobs),
    jobs,
    humanActions: snapshots.flatMap(({ snapshot }) => recordArray(snapshot.humanActions)).slice(-100),
    humanActionAnswers,
    events,
    routing: lifetimeRoutingSummary(snapshots.map((entry) => entry.snapshot)),
    backlog: {
      id: 'workspace-lifetime',
      entryCount: queueBacklog.entries.length + snapshots.reduce((sum, entry) => sum + numberValue(recordValue(entry.snapshot.backlog).entryCount), 0),
      readyCount: queueBacklog.entries.filter((entry) => textValue(entry.status, '') === 'todo').length + snapshots.reduce((sum, entry) => sum + numberValue(recordValue(entry.snapshot.backlog).readyCount), 0),
      entries: queueBacklog.entries
    },
    raw: {
      lifetime: {
        mode: 'workspace',
        sourceCount: discoveredSources.length,
        loadedSourceCount: snapshots.length,
        sources: discoveredSources.slice(0, LIFETIME_DASHBOARD_MAX_SOURCES),
        manifests: queueBacklog.manifests,
        queueSources: queueBacklog.paths
      }
    }
  };
}

function lifetimeScopedId(source: LifetimeDashboardSource, id: string): string {
  return `${source.id}:${id}`.replaceAll(/[^\w:.-]+/g, '-');
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
  return {
    id: jobId,
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
  };
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
  return {
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
    changedPathCount: 0,
    collectReasonClasses: status === 'running' ? [`active drain ${runKind}`] : [`drain ${runKind}`],
    mergeReadiness: status,
    sourceRun: path.relative(cwd, coordinatorRunDir),
    sourceLabel: path.relative(cwd, coordinatorRunDir),
    generatedAt: numberValue(finishedAt) || numberValue(eventStat?.mtimeMs) || now
  };
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
    summary: lifetimeDashboardSummary(jobs),
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

function normalizeCoordinatorFacingJob(record: Record<string, unknown>): Record<string, unknown> {
  const normalizedRecord: Record<string, unknown> = {
    ...record,
    bucket: coordinatorFacingMachineLabel(record.bucket),
    status: coordinatorFacingMachineLabel(record.status),
    disposition: coordinatorFacingMachineLabel(record.disposition),
    mergeReadiness: coordinatorFacingMachineLabel(record.mergeReadiness)
  };
  if (!isResolvedCoordinatorReviewRecord(normalizedRecord)) return normalizedRecord;
  return markCoordinatorReviewResolved(normalizedRecord, textValue(normalizedRecord.coordinatorDecisionStatus ?? normalizedRecord.disposition, 'review-resolved'));
}

function markCoordinatorReviewResolved(record: Record<string, unknown>, disposition: string): Record<string, unknown> {
  return {
    ...record,
    reviewResolved: true,
    originalBucket: record.originalBucket ?? record.bucket,
    originalStatus: record.originalStatus ?? record.status,
    bucket: 'review-resolved',
    status: 'completed',
    disposition: disposition || 'review-resolved',
    mergeReadiness: 'review-resolved',
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
    cachedInputTokens: jobs.reduce((sum, job) => sum + numberValue(job.cachedInputTokens), 0),
    uncachedInputTokens: jobs.reduce((sum, job) => sum + numberValue(job.uncachedInputTokens), 0),
    bucketCounts: countJobsByBucket(jobs)
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

function lifetimeCapacitySummary(queueBacklog: LifetimeQueueBacklog, jobs: Array<Record<string, unknown>>): Record<string, unknown> {
  const manifest = queueBacklog.manifests[0];
  const laneRows = new Map<string, Record<string, unknown>>();
  const terminalTaskIds = new Set(jobs
    .filter((job) => ['completed', 'failed', 'blocked'].includes(textValue(job.status, '').toLowerCase()))
    .flatMap(recordIdentityKeys));
  const representedTaskIds = new Set(jobs.flatMap(recordIdentityKeys));
  const openEntries = queueBacklog.entries.filter((entry) => {
    const ids = recordIdentityKeys(entry);
    return !ids.some((id) => terminalTaskIds.has(id) || representedTaskIds.has(id));
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
    }).flatMap(recordIdentityKeys),
    ...runningJobs.flatMap(recordIdentityKeys),
    ...queuedJobs.flatMap(recordIdentityKeys)
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
  const buckets = new Map<number, { at: number; terminalJobCount: number; warningJobCount: number; failureJobCount: number; durationMs: number; actualInputTokens: number; uncachedInputTokens: number; eventCount: number }>();
  for (const job of jobs) {
    const at = numberValue(job.finishedAt) || numberValue(job.generatedAt) || numberValue(job.startedAt);
    if (!at) continue;
    const bucketAt = startOfLocalDay(at);
    const bucket = buckets.get(bucketAt) ?? { at: bucketAt, terminalJobCount: 0, warningJobCount: 0, failureJobCount: 0, durationMs: 0, actualInputTokens: 0, uncachedInputTokens: 0, eventCount: 0 };
    if (['completed', 'failed', 'blocked'].includes(textValue(job.status, '').toLowerCase())) bucket.terminalJobCount += 1;
    if (textValue(job.health, '') === 'warning') bucket.warningJobCount += 1;
    if (isLifetimeFailedJob(job)) bucket.failureJobCount += 1;
    bucket.durationMs += numberValue(job.durationMs);
    bucket.actualInputTokens += numberValue(job.actualInputTokens);
    bucket.uncachedInputTokens += numberValue(job.uncachedInputTokens);
    buckets.set(bucketAt, bucket);
  }
  for (const event of events) {
    const at = numberValue(event.at);
    if (!at) continue;
    const bucketAt = startOfLocalDay(at);
    const bucket = buckets.get(bucketAt) ?? { at: bucketAt, terminalJobCount: 0, warningJobCount: 0, failureJobCount: 0, durationMs: 0, actualInputTokens: 0, uncachedInputTokens: 0, eventCount: 0 };
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
      uncachedInputTokens: points.reduce((sum, point) => sum + point.uncachedInputTokens, 0),
      missingTimestampJobCount: jobs.filter((job) => !numberValue(job.finishedAt) && !numberValue(job.generatedAt) && !numberValue(job.startedAt)).length
    }
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

function lifetimeRoutingSummary(snapshots: Record<string, unknown>[]): Record<string, unknown> | undefined {
  const routingRows = snapshots.map((snapshot) => recordValue(snapshot.routing)).filter((entry) => Object.keys(entry).length);
  if (!routingRows.length) return undefined;
  return {
    policyId: 'workspace-lifetime',
    preferenceCount: routingRows.reduce((sum, row) => sum + numberValue(row.preferenceCount), 0),
    preferCount: routingRows.reduce((sum, row) => sum + numberValue(row.preferCount), 0),
    avoidCount: routingRows.reduce((sum, row) => sum + numberValue(row.avoidCount), 0),
    tournamentObservationCount: routingRows.reduce((sum, row) => sum + numberValue(row.tournamentObservationCount), 0),
    tournamentRecommendationCount: routingRows.reduce((sum, row) => sum + numberValue(row.tournamentRecommendationCount), 0)
  };
}

function isLifetimeFailedJob(job: Record<string, unknown>): boolean {
  if (isResolvedCoordinatorReviewRecord(job)) return false;
  const status = textValue(job.status, '').toLowerCase();
  const health = textValue(job.health, '').toLowerCase();
  const bucket = textValue(job.bucket, '').toLowerCase();
  return status === 'failed' || health === 'failed' || bucket === 'failed-evidence';
}

function awaitNoop<T>(value: T): T {
  return value;
}

function shouldPreferActiveRunSnapshot(jobs: unknown[], activeJobs: Array<Record<string, unknown>>): boolean {
  if (!activeJobs.length) return false;
  const runningCount = activeJobs.filter((job) => textValue(job.status, '') === 'running').length;
  if (runningCount > 0) return true;
  return activeJobs.length > jobs.length;
}

async function readActiveRunSnapshot(options: NormalizedLoomUiServerOptions): Promise<Record<string, unknown> | undefined> {
  const runDir = await resolveRunDirectory(options);
  if (!runDir) return undefined;
  const pidPath = path.join(runDir, 'pids.json');
  const pidManifest = recordValue(await readJsonFile(pidPath));
  const entries = recordArray(pidManifest.entries).filter((entry) => textValue(entry.role, '') === 'codex');
  if (!entries.length) return undefined;
  const planPath = path.join(runDir, 'swarm-plan.json');
  const plan = recordValue(await readJsonFile(planPath));
  const planJobs = new Map(recordArray(plan.jobs).map((job) => [textValue(job.id, ''), job]));
  const now = Date.now();
  const jobs = await Promise.all(entries.map((entry) => activeRunJob(runDir, entry, planJobs.get(textValue(entry.jobId, '')), now)));
  const runningCount = jobs.filter((job) => textValue(job.status, '') === 'running').length;
  const completedCount = jobs.filter((job) => textValue(job.status, '') === 'completed').length;
  const failedCount = jobs.filter((job) => textValue(job.status, '') === 'failed').length;
  const actualInputTokens = jobs.reduce((sum, job) => sum + numberValue(job.actualInputTokens), 0);
  const estimatedInputTokens = jobs.reduce((sum, job) => sum + numberValue(job.estimatedInputTokens), 0);
  const cachedInputTokens = jobs.reduce((sum, job) => sum + numberValue(job.cachedInputTokens), 0);
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
      }
    },
    lanes: activeRunLanes(jobs),
    jobs,
    events: activeRunEvents(jobs),
    sources: {
      run: runDir,
      activeRun: pidPath,
      plan: planPath
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

async function activeRunJob(
  runDir: string,
  entry: Record<string, unknown>,
  planJob: Record<string, unknown> | undefined,
  now: number
): Promise<Record<string, unknown>> {
  const jobId = textValue(entry.jobId, 'job');
  const jobDir = path.join(runDir, jobId);
  const lastMessagePath = path.join(jobDir, 'last-message.md');
  const mergePath = path.join(jobDir, 'merge.json');
  const eventsPath = path.join(jobDir, 'codex-events.jsonl');
  const lastMessage = await fs.stat(lastMessagePath).catch(() => undefined);
  const merge = recordValue(await readJsonFile(mergePath));
  const live = isProcessLive(numberValue(entry.pid), entry);
  const quotaDeferred = !live && !lastMessage && !Object.keys(merge).length && await codexEventsHaveQuotaLimit(eventsPath);
  const status = live && !lastMessage ? 'running' : quotaDeferred ? 'queued' : lastMessage || Object.keys(merge).length ? 'completed' : 'failed';
  const startedAt = numberValue(entry.startedAt);
  const finishedAt = status === 'running' ? undefined : Math.max(numberValue(lastMessage?.mtimeMs), numberValue(merge.generatedAt));
  const cwd = optionsSafeCwd(runDir);
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
  const usage = await readCodexEventUsageSummary(eventsPath);
  const task = recordValue(planJob?.task);
  const compute = recordValue(planJob?.compute);
  const changedPaths = uniquePaths([
    ...stringArray(merge.changedPaths),
    ...await readPatchChangedPathList(cwd, rawPatchPath)
  ]);
  return {
    id: jobId,
    taskId: textValue(planJob?.taskId ?? task.id, jobId),
    title: textValue(planJob?.title ?? task.title, jobId),
    lane: textValue(planJob?.lane ?? task.lane, 'active-run'),
    status,
    bucket: status === 'running' ? 'running' : status === 'completed' ? 'completed' : status === 'queued' ? 'queued' : 'failed-evidence',
    disposition: status === 'running' ? 'active' : status === 'queued' ? 'quota-deferred' : status,
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
    commandsPassed: recordArray(merge.commandsPassed),
    commandsFailed: recordArray(merge.commandsFailed),
    collectReasonClasses: status === 'running' ? ['active worker'] : quotaDeferred ? ['quota deferred'] : [],
    mergeReadiness: textValue(merge.mergeReadiness, status)
  };
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

function mergeActiveRunJobTelemetry(jobs: unknown[], activeJobs: Array<Record<string, unknown>>): unknown[] {
  if (!activeJobs.length) return jobs;
  const byKey = new Map<string, Record<string, unknown>>();
  for (const activeJob of activeJobs) {
    if (!hasTokenTelemetry(activeJob)) continue;
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
      ...(numberValue(activeJob.actualInputTokens) ? { actualInputTokens: numberValue(activeJob.actualInputTokens) } : {}),
      ...(numberValue(activeJob.inputTokens) ? { inputTokens: numberValue(activeJob.inputTokens) } : {}),
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

function optionsSafeCwd(runDir: string): string {
  return path.dirname(path.dirname(runDir));
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
  return {
    ok: true,
    jobId,
    ...(patchPath ? { patchArtifact: artifactRecord(patchPath) } : {}),
    files: patchPath ? await readPatchFiles(options, patchPath) : [],
    commandsPassed: recordArray(bundle.commandsPassed).slice(0, 20),
    commandsFailed: recordArray(bundle.commandsFailed).slice(0, 20),
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
  return {
    bundle: {
      jobId: path.basename(match),
      patchPath,
      changedPaths: await readPatchChangedPathList(options.cwd, patchPath),
      evidencePaths,
      commandsPassed: [],
      commandsFailed: []
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
  return path.join(packageDir, '..', 'node_modules', '@shapeshift-labs', 'frontier-dom', 'dist', 'jsx-runtime.js');
}

function contentType(file: string): string {
  if (file.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  return 'application/octet-stream';
}
