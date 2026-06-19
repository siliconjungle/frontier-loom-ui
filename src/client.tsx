/** @jsxImportSource @shapeshift-labs/frontier-dom */
type Dashboard = {
  kind?: string;
  ok: boolean;
  generatedAt?: number;
  cwd?: string;
  summary: Record<string, unknown>;
  health?: DashboardHealthMetrics;
  quality?: Record<string, unknown>;
  timeSeries?: DashboardTimeSeries;
  lanes: Array<Record<string, unknown>>;
  jobs: Array<Record<string, unknown>>;
  humanActions?: Array<Record<string, unknown>>;
  humanActionAnswers?: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  routing?: Record<string, unknown>;
  backlog?: Record<string, unknown>;
  capacity?: Record<string, unknown>;
  semantic?: Record<string, unknown>;
  sources: Record<string, unknown>;
  raw?: Record<string, unknown>;
};

type LaneRollup = {
  id: string;
  jobCount: number;
  completedCount: number;
  failedCount: number;
  runningCount: number;
  blockedCount: number;
  needsCoordinatorReviewCount: number;
  staleCount: number;
  evidenceCount: number;
  eventCount: number;
};

type AttentionSummary = {
  failedCount: number;
  staleCount: number;
  needsCoordinatorReviewCount: number;
  blockedCount: number;
  evidenceCount: number;
};

type SuccessSummary = {
  completedCount: number;
  readyCount: number;
  cleanSourceCount: number;
  evidenceCompleteCount: number;
  appliedCount: number;
  applyTotalCount: number;
  applyFailedCount: number;
  landedCount: number;
  semanticAcceptedClean: number;
  semanticAlreadyApplied: number;
};

type ChartTone = 'neutral' | 'good' | 'warn' | 'bad' | 'review';

type DashboardHealthMetrics = {
  status?: string;
  summary?: Record<string, unknown>;
  points?: Array<Record<string, unknown>>;
};

type DashboardTimeSeries = {
  bucketMs?: number;
  summary?: Record<string, unknown>;
  points?: Array<Record<string, unknown>>;
};

type ChartPoint = {
  label: string;
  value: number;
  detail?: string;
  tone?: ChartTone;
};

type ChartSeries = {
  id: string;
  title: string;
  value: string;
  detail: string;
  points: ChartPoint[];
  tone?: ChartTone;
  xLabel?: string;
  yLabel?: string;
};

type OptimizationBehaviorCard = {
  label: string;
  value: string;
  detail: string;
  tone: ChartTone;
};

type OptimizationBehaviorRow = {
  label: string;
  value: string;
  detail: string;
  tone: ChartTone;
};

type ModelPrice = {
  input: number;
  cachedInput: number;
  output: number;
};

type ModelPriceEntry = {
  id: string;
  aliases?: string[];
  price: ModelPrice;
  source?: string;
  notes?: string;
  longContextThreshold?: number;
  longContextPrice?: ModelPrice;
};

type InputTokenBreakdown = {
  inputTokens: number;
  uncachedInputTokens: number;
  cachedInputTokens: number;
  estimatedInput: boolean;
};

type ScrollPosition = {
  left: number;
  top: number;
};

type RouteState = {
  tab: ContentTab;
  taskId?: string;
  ticket?: string;
};

type ContentTab = 'work' | 'board' | 'swarm' | 'performance' | 'history' | 'testing' | 'actions';

type TimelinePoint = {
  at: number;
  type: string;
  lane: string;
  jobId: string;
  message: string;
  progressPercent: number;
};

type TimelineSummary = {
  totalJobs: number;
  terminalJobs: number;
  runningJobs: number;
  attentionJobs: number;
  progressPercent: number;
  points: TimelinePoint[];
  firstAt?: number;
  lastAt?: number;
  exactTimingAvailable: boolean;
  eventWindowLimited: boolean;
};

type TimelineBottleneck = {
  label: string;
  value: number;
  detail: string;
  tone: 'bad' | 'warn' | 'neutral';
};

type ContributionDay = {
  date: string;
  label: string;
  count: number;
  completed: number;
  events: number;
  level: number;
  inYear: boolean;
};

type ContributionGrid = {
  year: number;
  days: ContributionDay[];
  weeks: ContributionDay[][];
  maxCount: number;
  totalDone: number;
  totalEvents: number;
  activeDays: number;
};

type TokenTimeSummary = {
  tokenValue: string;
  tokenDetail: string;
  durationValue: string;
  durationDetail: string;
  tokenTone: ChartTone;
  timeTone: ChartTone;
  warningCount: number;
  missingTimestampCount: number;
};

type WarningPressureSummary = {
  total: number;
  severe: number;
  budget: number;
  tone: ChartTone;
  headline: string;
  detail: string;
  rows: Array<{ label: string; value: number; detail?: string; tone?: ChartTone }>;
};

type HumanActionRow = {
  id?: string;
  code: string;
  status?: string;
  priority: 'blocking' | 'important' | 'info';
  type: 'question' | 'concern' | 'review' | 'approval';
  title: string;
  question: string;
  scope: string;
  detail: string;
  why?: string;
  requestedAnswer?: string;
  defaultAction: string;
  askedBy?: string;
  source?: string;
  jobId?: string;
  lane?: string;
  options: Array<{ label: string; detail?: string }>;
};

type TaskBoardColumnId = 'backlog' | 'todo' | 'active' | 'review' | 'ready' | 'done' | 'blocked';

type TaskBoardItem = Record<string, unknown> & {
  boardKind?: 'job' | 'backlog';
  boardColumn?: TaskBoardColumnId;
};

type TaskBoardColumn = {
  id: TaskBoardColumnId;
  title: string;
  detail: string;
  empty: string;
  items: TaskBoardItem[];
};

type AgentStatus = 'active' | 'waiting' | 'review' | 'done' | 'blocked' | 'idle';

type AgentWorker = {
  key: string;
  name: string;
  color: string;
  status: AgentStatus;
  jobs: TaskBoardItem[];
  currentJobs: TaskBoardItem[];
};

type TaskFileDiff = {
  path: string;
  additions: number;
  deletions: number;
  diff: string;
  language?: string;
  artifactPath?: string;
  hunks?: DiffHunk[];
  truncated?: boolean;
};

type DiffLineKind = 'meta' | 'hunk' | 'context' | 'add' | 'delete';

type DiffLine = {
  kind: DiffLineKind;
  oldLine?: number;
  newLine?: number;
  content: string;
};

type HistoryGraphLane = {
  id: string;
  label: string;
  x: number;
  color: string;
};

type HistoryGraphRow = {
  id: string;
  laneId: string;
  laneIndex: number;
  x: number;
  y: number;
  title: string;
  subtitle: string;
  meta: string;
  tooltip: string;
  tone: ChartTone;
  merged: boolean;
};

type HistoryGraph = {
  lanes: HistoryGraphLane[];
  rows: HistoryGraphRow[];
  width: number;
  height: number;
  rowHeight: number;
  trunkX: number;
};

type DiffHunk = {
  header: string;
  lines: DiffLine[];
};

type TaskArtifact = {
  path: string;
  label: string;
  kind?: 'file' | 'directory' | 'missing';
};

type TaskDetails = {
  ok: boolean;
  jobId: string;
  patchArtifact?: TaskArtifact;
  files?: TaskFileDiff[];
  commandsPassed?: Array<Record<string, unknown>>;
  commandsFailed?: Array<Record<string, unknown>>;
  evidenceArtifacts?: TaskArtifact[];
  error?: string;
};

const contentTabs: Array<{ id: ContentTab; label: string }> = [
  { id: 'work', label: 'Overview' },
  { id: 'board', label: 'Board' },
  { id: 'swarm', label: 'Swarm' },
  { id: 'performance', label: 'Performance' },
  { id: 'history', label: 'History' },
  { id: 'testing', label: 'Testing' },
  { id: 'actions', label: 'Questions' }
];
const root = document.getElementById('app');
const scrollPositions = new Map<string, ScrollPosition>();
const initialRoute = routeStateFromLocation();
let selectedTab: ContentTab = initialRoute.tab;
let currentDashboard: Dashboard | undefined;
let renderedDashboardSignature: string | undefined;
let pendingFocusTab: ContentTab | undefined;
let selectedTaskCardId: string | undefined = initialRoute.taskId;
let selectedTicketId: string | undefined = initialRoute.ticket;
let chartPopover: HTMLElement | undefined;
let activeContributionTarget: HTMLElement | undefined;
const taskDetailsCache = new Map<string, TaskDetails>();
const taskDetailsPending = new Set<string>();
const taskFileDiffOpenStates = new Map<string, boolean>();
const humanAnswerDrafts = new Map<string, string>();
const humanAnswerStates = new Map<string, { status: 'submitting' | 'submitted' | 'error'; message: string }>();

root?.addEventListener('click', (event) => {
  const copyTarget = event.target instanceof Element
    ? event.target.closest<HTMLElement>('[data-copy-code]')
    : null;
  if (copyTarget) {
    event.preventDefault();
    event.stopPropagation();
    const code = copyTarget.dataset.copyCode ?? '';
    if (code) void copyTextToClipboard(code, copyTarget);
    return;
  }

  const revealTarget = event.target instanceof Element
    ? event.target.closest<HTMLElement>('[data-reveal-artifact-path]')
    : null;
  if (revealTarget) {
    event.preventDefault();
    event.stopPropagation();
    const artifactPath = revealTarget.dataset.revealArtifactPath ?? '';
    if (artifactPath) void revealArtifactInFinder(artifactPath);
    return;
  }

  const modalClose = event.target instanceof Element
    ? event.target.closest<HTMLElement>('[data-modal-close]')
    : null;
  const modalBackdrop = event.target instanceof HTMLElement && event.target.dataset.modalBackdrop === 'true';
  if (modalClose || modalBackdrop) {
    closeTaskDialog();
    return;
  }

  const tab = event.target instanceof Element
    ? event.target.closest<HTMLElement>('[data-content-tab]')
    : null;
  if (tab) {
    selectContentTab(asContentTab(tab.dataset.contentTab));
    return;
  }

  const taskCard = event.target instanceof Element
    ? event.target.closest<HTMLElement>('[data-task-card]')
    : null;
  if (taskCard) {
    openTaskCard(taskCard.dataset.taskCard);
    return;
  }
  return;
});

root?.addEventListener('toggle', (event) => {
  const target = event.target instanceof Element
    ? event.target.closest<HTMLDetailsElement>('details[data-task-file-diff-key]')
    : null;
  if (!target) return;
  setTaskFileDiffOpenState(target);
}, true);

root?.addEventListener('input', (event) => {
  const target = event.target instanceof Element
    ? event.target.closest<HTMLTextAreaElement>('textarea[data-human-answer-code]')
    : null;
  if (!target) return;
  humanAnswerDrafts.set(target.dataset.humanAnswerCode ?? '', target.value);
});

root?.addEventListener('submit', (event) => {
  const form = event.target instanceof Element
    ? event.target.closest<HTMLFormElement>('[data-human-answer-form]')
    : null;
  if (!form) return;
  event.preventDefault();
  void submitHumanActionAnswer(form);
});

root?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && selectedTaskCardId) {
    closeTaskDialog();
    return;
  }

  const taskCard = event.target instanceof Element
    ? event.target.closest<HTMLElement>('[data-task-card]')
    : null;
  if (taskCard && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    openTaskCard(taskCard.dataset.taskCard);
    return;
  }

  const target = event.target instanceof Element
    ? event.target.closest<HTMLElement>('[data-content-tab]')
    : null;
  if (!target || !isTabNavigationKey(event.key)) return;

  const tabs = contentTabButtons();
  const currentIndex = tabs.indexOf(target);
  if (currentIndex < 0) return;

  event.preventDefault();
  const nextIndex = nextTabIndex(event.key, currentIndex, tabs.length);
  const nextTab = asContentTab(tabs[nextIndex]?.dataset.contentTab);
  pendingFocusTab = nextTab;
  selectContentTab(nextTab);
});

root?.addEventListener('focusin', (event) => {
  const target = chartTooltipTarget(event.target);
  if (target) showChartPopover(target);
});

root?.addEventListener('focusout', (event) => {
  const target = chartTooltipTarget(event.target);
  if (target) hideChartPopover();
});

root?.addEventListener('wheel', (event) => {
  const target = event.target instanceof Element
    ? event.target.closest<HTMLElement>('.task-column-body, .task-board-column')
    : null;
  if (!target) return;
  const board = target.closest<HTMLElement>('.task-board-scroll');
  if (!board) return;
  const horizontalDelta = event.deltaX || (event.shiftKey ? event.deltaY : 0);
  if (!horizontalDelta || Math.abs(horizontalDelta) < Math.abs(event.deltaY)) return;
  board.scrollLeft += horizontalDelta;
  event.preventDefault();
}, { passive: false });

root?.addEventListener('pointerover', (event) => {
  const target = nearestChartPopoverTarget(event);
  if (!target) {
    hideChartPopover();
    return;
  }
  activeContributionTarget = target;
  showChartPopover(target);
});

root?.addEventListener('mouseover', (event) => {
  const target = nearestChartPopoverTarget(event);
  if (!target) {
    hideChartPopover();
    return;
  }
  activeContributionTarget = target;
  showChartPopover(target);
});

root?.addEventListener('pointermove', (event) => {
  const target = nearestChartPopoverTarget(event);
  if (!target) {
    hideChartPopover();
    return;
  }
  activeContributionTarget = target;
  showChartPopover(target, event.clientX, event.clientY);
});

root?.addEventListener('mousemove', (event) => {
  const target = nearestChartPopoverTarget(event);
  if (!target) {
    hideChartPopover();
    return;
  }
  activeContributionTarget = target;
  showChartPopover(target, event.clientX, event.clientY);
});

root?.addEventListener('pointerout', (event) => {
  if (isStillInsideContributionGrid(event)) return;
  hideChartPopover();
});

root?.addEventListener('mouseout', (event) => {
  if (isStillInsideContributionGrid(event)) return;
  hideChartPopover();
});

window.addEventListener('hashchange', () => {
  const route = routeStateFromLocation();
  selectedTab = route.tab;
  selectedTaskCardId = route.taskId;
  selectedTicketId = route.ticket;
  if (currentDashboard) renderDashboard(currentDashboard);
});

void refresh();
const dashboardStreamConnected = connectDashboardStream();
window.setInterval(refresh, dashboardStreamConnected ? 30000 : 2000);

function connectDashboardStream(): boolean {
  if (!('EventSource' in window)) return false;
  const source = new EventSource('/api/dashboard/stream');
  source.addEventListener('message', (event) => {
    try {
      const dashboard = JSON.parse(event.data) as Dashboard;
      currentDashboard = dashboard;
      const signature = dashboardSignature(dashboard);
      if (root?.hasChildNodes() && signature === renderedDashboardSignature) return;
      renderDashboard(dashboard, signature);
    } catch {
      void refresh();
    }
  });
  source.addEventListener('error', () => {
    source.close();
    window.setTimeout(connectDashboardStream, 2000);
  });
  return true;
}

async function refresh(): Promise<void> {
  let dashboard: Dashboard;
  try {
    const response = await fetch('/api/dashboard');
    if (!response.ok) throw new Error(`dashboard fetch failed: ${response.status}`);
    dashboard = await response.json() as Dashboard;
  } catch (error) {
    dashboard = offlineDashboard(error);
  }
  currentDashboard = dashboard;
  const signature = dashboardSignature(dashboard);
  if (root?.hasChildNodes() && signature === renderedDashboardSignature) return;
  renderDashboard(dashboard, signature);
}

function renderDashboard(dashboard: Dashboard, signature = dashboardSignature(dashboard)): void {
  hideChartPopover();
  captureScrollPositions();
  captureTaskFileDiffOpenStates();
  pruneResolvedHumanActionDrafts(dashboard);
  const lanes = laneRollups(dashboard);
  root?.replaceChildren(<DashboardView dashboard={dashboard} lanes={lanes} />);
  renderedDashboardSignature = signature;
  restoreScrollPositions();
}

function dashboardSignature(dashboard: Dashboard): string {
  return JSON.stringify({
    ok: dashboard.ok,
    cwd: dashboard.cwd,
    summary: dashboard.summary,
    health: dashboard.health,
    quality: dashboard.quality,
    timeSeries: dashboard.timeSeries,
    lanes: dashboard.lanes,
    jobs: dashboard.jobs,
    humanActions: dashboard.humanActions,
    humanActionAnswers: dashboard.humanActionAnswers,
    events: dashboard.events,
    routing: dashboard.routing,
    backlog: dashboard.backlog,
    semantic: dashboard.semantic,
    sources: dashboard.sources
  });
}

function DashboardView({ dashboard, lanes }: { dashboard: Dashboard; lanes: LaneRollup[] }): Node {
  const attention = attentionSummary(dashboard.jobs);
  const sourceEntries = sourceRows(dashboard);
  const visibleJobs = dashboard.jobs;
  const visibleEvents = dashboard.events;
  const audit = auditSummary(dashboard, visibleJobs);
  const success = successSummary(dashboard, visibleJobs);
  const selectedTask = selectedTaskItem(dashboard, visibleJobs);
  if (selectedTask) void fetchTaskDetails(selectedTask);

  return <main className="shell">
    <section className="operator-grid">
      <section className="operator-main">
        <nav className="content-tabs" role="tablist" aria-label="Dashboard sections">
          {contentTabs.map((tab) => contentTab(tab.id, tab.label, tabMeta(tab.id, {
            jobs: visibleJobs.length,
            questions: humanActionRows(visibleJobs, audit, dashboard).length,
            events: visibleEvents.length,
            sources: sourceEntries.length
          })))}
        </nav>
        <section
          id={`${selectedTab}-panel`}
          className="content-shell"
          data-scroll-id={`content-${selectedTab}`}
          role="tabpanel"
          aria-labelledby={`${selectedTab}-tab`}
        >
          {contentPanel(selectedTab, {
            dashboard,
            lanes,
            sourceEntries,
            visibleJobs,
            visibleEvents,
            attention,
            audit,
            success
          })}
        </section>
      </section>
    </section>
    {selectedTask ? <TaskDetailDialog job={selectedTask} dashboard={dashboard} /> : null}
  </main>;
}

function contentPanel(tab: ContentTab, input: {
  dashboard: Dashboard;
  lanes: LaneRollup[];
  sourceEntries: Array<{ label: string; value: string }>;
  visibleJobs: Array<Record<string, unknown>>;
  visibleEvents: Array<Record<string, unknown>>;
  attention: AttentionSummary;
  audit: AuditSummary;
  success: SuccessSummary;
}): Node {
  const boardItems = taskBoardItems(input.dashboard, input.visibleJobs);
  if (tab === 'work') return <Panel title="Overview" meta={`${text(input.visibleJobs.length)} tasks`} hideHead>
    <WorkOverview dashboard={input.dashboard} lanes={input.lanes} jobs={input.visibleJobs} attention={input.attention} audit={input.audit} success={input.success} />
  </Panel>;
  if (tab === 'board') return <Panel title="Task board" meta={`${text(boardItems.length)} active-visible tasks`}>
    <TaskBoard dashboard={input.dashboard} jobs={input.visibleJobs} />
  </Panel>;
  if (tab === 'swarm') {
    const sourceKind = dashboardSourceKind(input.dashboard);
    const activeCount = activeAgentTaskCount(input.dashboard, input.visibleJobs);
    return <Panel title={sourceKind === 'demo' ? 'Demo agents' : 'Active agents'} meta={sourceKind === 'demo' ? 'fixture examples' : activeCount ? `${text(activeCount)} running` : 'none running'}>
    <AgentWork dashboard={input.dashboard} jobs={input.visibleJobs} />
  </Panel>;
  }
  if (tab === 'performance') return <Panel title="Performance" meta={performanceTabMeta(input.dashboard, input.visibleJobs)}>
    <PerformanceView dashboard={input.dashboard} jobs={input.visibleJobs} attention={input.attention} audit={input.audit} />
  </Panel>;
  if (tab === 'history') return <Panel title="History" meta={historyTabMeta(input.dashboard, input.visibleJobs, input.success)}>
    <HistoryView dashboard={input.dashboard} jobs={input.visibleJobs} events={input.visibleEvents} success={input.success} attention={input.attention} />
  </Panel>;
  if (tab === 'testing') return <Panel title="Testing" meta={testingTabMeta(input.visibleJobs)}>
    <TestingView jobs={input.visibleJobs} events={input.visibleEvents} />
  </Panel>;
  return <Panel title="Questions for you" meta={`${text(humanActionRows(input.visibleJobs, input.audit, input.dashboard).length)} open`}>
    <HumanActionQueue dashboard={input.dashboard} jobs={input.visibleJobs} audit={input.audit} />
  </Panel>;
}

function Panel({ title, meta, children, className, hideHead = false }: { title: string; meta?: string; children: unknown; className?: string; hideHead?: boolean }): Node {
  return <section className={className ? `panel ${className}` : 'panel'}>
    {hideHead ? null : <div className="panel-head">
      <h2>{title}</h2>
      {meta ? <span>{meta}</span> : null}
    </div>}
    {children}
  </section>;
}

function contentTab(id: ContentTab, label: string, meta: string): Node {
  const active = selectedTab === id;
  return <button
    id={`${id}-tab`}
    type="button"
    className={active ? 'content-tab active' : 'content-tab'}
    data-content-tab={id}
    role="tab"
    aria-selected={active ? 'true' : 'false'}
    aria-controls={`${id}-panel`}
    tabIndex={active ? 0 : -1}
  >
    <span>{label}</span>
    <small>{meta}</small>
  </button>;
}

function WorkOverview({ dashboard, lanes, jobs, attention, audit, success }: {
  dashboard: Dashboard;
  lanes: LaneRollup[];
  jobs: Array<Record<string, unknown>>;
  attention: AttentionSummary;
  audit: AuditSummary;
  success: SuccessSummary;
}): Node {
  const health = dashboardHealthSummary(dashboard, jobs, attention);
  const contribution = contributionGrid(dashboard, jobs, dashboard.events);
  const resolvedWorkCount = resolvedWorkJobCount(jobs);
  const workerSuccessCount = successLikeJobCount(jobs);
  const progressRatio = health.jobCount ? resolvedWorkCount / health.jobCount : 0;
  const workerReliabilityRatio = health.jobCount ? workerSuccessCount / health.jobCount : 0;
  const progressLabel = formatPercent(progressRatio);
  const progressWidth = Math.max(0, Math.min(100, progressRatio * 100));
  const cost = workCostSummary(dashboard, jobs);
  void lanes;
  void audit;
  void success;
  return <div className="work-layout" data-scroll-id="work">
    <section className="goal-card">
      <div>
        <span>Goal</span>
        <h3>{currentGoalTitle(dashboard)}</h3>
        <p>{goalProgressText(jobs, health, resolvedWorkCount)}</p>
      </div>
      <div className="goal-progress">
        <div className="goal-progress-head">
          <b>{progressLabel}</b>
          <span>{text(resolvedWorkCount)} of {text(health.jobCount)} tasks resolved</span>
        </div>
        <div className="goal-progress-track" role="img" aria-label={`${progressLabel} resolved work progress`}>
          <span className={`goal-progress-fill ${progressTone(progressRatio, workerReliabilityRatio)}`} style={`width:${progressWidth}%`} />
        </div>
        <small className="goal-reliability">Worker reliability {formatPercent(workerReliabilityRatio)} · {text(workerSuccessCount)} clean completions</small>
      </div>
    </section>

    <section className="work-section work-contribution-section">
      <div className="metric-section-head">
        <h3>Progress by day</h3>
        <span>{text(contribution.year)} · January through December</span>
      </div>
      <ContributionGraph grid={contribution} prominent />
    </section>

    <section className="work-section">
      <div className="metric-section-head">
        <h3>Token cost estimate</h3>
        <span>{cost.detail}</span>
      </div>
      <div className="work-cost-metrics">
        {costMetric('Total input', cost.totalInput, cost.totalDetail)}
        {costMetric('Uncached input', cost.freshInput, cost.freshDetail)}
        {costMetric('Cached input', cost.cachedInput, cost.cachedDetail)}
        {costMetric('Budget warnings', cost.budgetWarnings, cost.budgetDetail)}
      </div>
    </section>
  </div>;
}

function currentGoalTitle(dashboard: Dashboard): string {
  const backlog = recordValue(dashboard.backlog);
  const explicit = textValue(backlog.title ?? backlog.goal ?? backlog.objective ?? backlog.summary, '');
  if (explicit) return explicit;
  const id = textValue(backlog.id, '');
  if (id && id !== 'backlog' && id !== 'next-backlog') return sentenceCaseIdentifier(id);
  return 'Rewrite the Frontier swarm dashboard';
}

function sentenceCaseIdentifier(value: string): string {
  const spaced = value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!spaced) return value;
  return spaced[0].toUpperCase() + spaced.slice(1);
}

function goalProgressText(jobs: Array<Record<string, unknown>>, health: ReturnType<typeof dashboardHealthSummary>, resolvedWorkCount: number): string {
  if (!health.jobCount) return 'No active swarm work is loaded yet.';
  const unresolvedAttentionCount = jobs.filter(isCoordinatorReviewJob).length;
  if (resolvedWorkCount >= health.jobCount) return 'Every tracked task has either completed or been resolved by the coordinator.';
  if (health.runningJobCount) {
    return `The swarm is working through ${text(health.jobCount)} tracked tasks. ${text(health.runningJobCount)} are still running.`;
  }
  if (health.terminalJobCount >= health.jobCount) {
    return unresolvedAttentionCount
      ? `Execution has finished, but ${text(unresolvedAttentionCount)} tasks still need coordinator action.`
      : 'Execution has finished and coordinator decisions have collapsed the open review queue.';
  }
  return `No agents are running right now. ${text(Math.max(0, health.jobCount - health.terminalJobCount))} tasks remain queued and ${text(unresolvedAttentionCount)} need coordinator action.`;
}

function progressTone(progressRatio: number, workerReliabilityRatio: number): ChartTone {
  if (progressRatio >= 0.8 && workerReliabilityRatio >= 0.5) return 'good';
  if (progressRatio >= 0.5) return 'warn';
  return 'bad';
}

function workCostSummary(dashboard: Dashboard, jobs: Array<Record<string, unknown>>): {
  totalInput: string;
  totalDetail: string;
  freshInput: string;
  freshDetail: string;
  cachedInput: string;
  cachedDetail: string;
  budgetWarnings: string;
  budgetDetail: string;
  detail: string;
} {
  const telemetry = tokenTimeSummary(dashboard, jobs);
  const context = contextPressureSummary(jobs);
  return {
    totalInput: telemetry.tokenValue,
    totalDetail: telemetry.tokenDetail,
    freshInput: context.uncachedInputTokens ? formatNumber(context.uncachedInputTokens) : '-',
    freshDetail: context.estimatedInputTokens ? `${formatRatio(context.uncachedRatio)} of estimate` : 'uncached model input',
    cachedInput: context.cachedInputTokens ? formatNumber(context.cachedInputTokens) : '-',
    cachedDetail: context.actualInputTokens ? `${formatRatio(context.cachedInputTokens / Math.max(1, context.actualInputTokens))} of reported` : 'reported cache reuse',
    budgetWarnings: formatNumber(context.warningCount + context.failedCount),
    budgetDetail: `${formatNumber(context.failedCount)} failed budget`,
    detail: telemetry.durationValue === '-' ? 'token estimates and budget pressure' : `${telemetry.durationValue} runtime estimate`
  };
}

function costMetric(label: string, value: string, detail: string): Node {
  return <article className="cost-metric">
    <span>{label}</span>
    <b>{value}</b>
    <small>{detail}</small>
  </article>;
}

function TaskBoard({ dashboard, jobs }: { dashboard: Dashboard; jobs: Array<Record<string, unknown>> }): Node {
  const items = taskBoardItems(dashboard, jobs);
  const columns = taskBoardColumns(items);
  const activeCount = columns.reduce((sum, column) => column.id === 'done' ? sum : sum + column.items.length, 0);
  return <div className="task-board-layout" data-scroll-id="task-board">
    <div className="task-board-scroll" data-scroll-id="task-board-x" aria-label={`${text(items.length)} AI-managed tasks, ${text(activeCount)} not done`}>
      {columns.map((column) => <section className={`task-board-column ${column.id}`} aria-label={`${column.title}: ${text(column.items.length)} tasks`}>
        <header className="task-column-head">
          <div>
            <h3>{column.title}</h3>
            <span>{column.detail}</span>
          </div>
          <b>{text(column.items.length)}</b>
        </header>
        <div className="task-column-body" data-scroll-id={`task-column-${column.id}`}>
          {column.items.length
            ? column.items.map((job) => <TaskBoardCard job={job} />)
            : <p className="empty tight">{column.empty}</p>}
        </div>
      </section>)}
    </div>
  </div>;
}

function AgentWork({ dashboard, jobs }: { dashboard: Dashboard; jobs: Array<Record<string, unknown>> }): Node {
  const items = taskBoardItems(dashboard, jobs).filter(isActiveAgentJob);
  const workers = agentWorkers(items);
  return <div className="agent-work-layout" data-scroll-id="swarm">
    <SwarmCapacityPanel dashboard={dashboard} workers={workers} />
    <section className="agent-roster-panel" aria-label="Active agent roster">
      <div className="agent-roster-head">
        <span>Agent</span>
        <span>Current work</span>
        <span>Model</span>
        <span>Run time</span>
        <span>Input</span>
        <span>Files</span>
      </div>
      <div className="agent-roster-list" data-scroll-id="swarm-roster">
        {workers.length
          ? workers.map((worker, index) => <AgentWorkerCard worker={worker} index={index} now={timeValue(dashboard.generatedAt) ?? Date.now()} />)
          : <p className="agent-roster-empty">No active agents are running right now.</p>}
      </div>
    </section>
  </div>;
}

function SwarmCapacityPanel({ dashboard, workers }: { dashboard: Dashboard; workers: AgentWorker[] }): Node {
  const capacity = recordValue(dashboard.capacity);
  const lanes = arrayRecords(capacity.lanes);
  const openLaneCount = numberValue(capacity.openLaneCount);
  const activeLaneCount = numberValue(capacity.activeLaneCount);
  const maxConcurrency = numberValue(capacity.maxConcurrency);
  const runningAgentCount = numberValue(capacity.runningAgentCount) || workers.filter((worker) => worker.status === 'active').length;
  const queuedTaskCount = numberValue(capacity.queuedTaskCount);
  const laneRows = lanes.slice(0, 8);
  const hiddenLaneCount = Math.max(0, lanes.length - laneRows.length);
  const manifestLabel = textValue(capacity.manifestId, textValue(capacity.title, 'manifest'));
  return <section className="swarm-capacity-panel" aria-label="Swarm capacity">
    <div className="swarm-capacity-summary">
      <div>
        <span>Concurrency</span>
        <b>{maxConcurrency ? `${text(runningAgentCount)} / ${text(maxConcurrency)}` : text(runningAgentCount)}</b>
        <small>{manifestLabel}</small>
      </div>
      <div>
        <span>Lanes</span>
        <b>{text(openLaneCount || lanes.length)}</b>
        <small>{text(activeLaneCount)} active · {text(lanes.length)} defined</small>
      </div>
      <div>
        <span>Open tasks</span>
        <b>{text(queuedTaskCount)}</b>
        <small>{text(numberValue(capacity.totalTaskCount))} manifest tasks</small>
      </div>
      <div>
        <span>Source</span>
        <b>{text(numberValue(capacity.computeMaxConcurrency) || maxConcurrency || runningAgentCount)}</b>
        <small>{artifactLabel(textValue(capacity.manifestPath, 'manifest'))}</small>
      </div>
    </div>
    <div className="swarm-lane-strip" aria-label="Lane assignments">
      {laneRows.length
        ? laneRows.map((lane) => <SwarmLaneRow lane={lane} />)
        : <p className="swarm-lane-empty">No manifest lanes loaded yet.</p>}
      {hiddenLaneCount ? <p className="swarm-lane-more">+{text(hiddenLaneCount)} more lanes</p> : null}
    </div>
  </section>;
}

function SwarmLaneRow({ lane }: { lane: Record<string, unknown> }): Node {
  const agents = stringArray(lane.assignedAgents);
  const running = numberValue(lane.runningCount);
  const cap = numberValue(lane.maxConcurrency);
  const queued = numberValue(lane.queuedTaskCount);
  const model = textValue(lane.model, textValue(lane.compute, 'model'));
  return <article className="swarm-lane-row">
    <div className="swarm-lane-main">
      <b>{textValue(lane.title, textValue(lane.id, 'lane'))}</b>
      <small>{textValue(lane.layer, 'lane')} · {model}</small>
    </div>
    <div className="swarm-lane-numbers">
      <span>{text(running)} / {text(cap || 1)} active</span>
      <span>{text(queued)} open</span>
    </div>
    <div className="swarm-lane-agents">
      {agents.length
        ? agents.slice(0, 3).map((agent) => <code>{shortAgentId(agent)}</code>)
        : <span>idle</span>}
      {agents.length > 3 ? <span>+{text(agents.length - 3)}</span> : null}
    </div>
  </article>;
}

function AgentWorkerCard({ worker, index, now }: { worker: AgentWorker; index: number; now: number }): Node {
  const model = agentModelSummary(worker);
  const files = agentTouchedFiles(worker);
  const evidenceCount = agentEvidenceCount(worker);
  const fileFallback = evidenceCount ? 'Evidence only' : worker.status === 'active' ? 'Files pending' : 'No source files';
  const visibleJobs = worker.currentJobs.slice(0, 2);
  const hiddenJobCount = Math.max(0, worker.currentJobs.length - visibleJobs.length);
  return <article
    className={`agent-worker-card ${worker.status}`}
    style={`--agent-color:${worker.color}`}
    draggable="false"
    aria-label={`${agentDisplayName(worker, index)} assigned to ${text(worker.currentJobs.length)} current tasks`}
  >
    <div className="agent-cell agent-cell-agent">
      <span className="agent-status-dot" aria-hidden="true" />
      <div>
        <b>{agentDisplayName(worker, index)}</b>
        <small>{agentStatusLabel(worker.status)}</small>
      </div>
    </div>
    <div className="agent-cell agent-cell-task">
      <div className="agent-task-list">
        {visibleJobs.map((job) => <button type="button" className="agent-task-row" data-task-card={taskCardId(job)}>
          <code>{ticketId(job)}</code>
          <span>{taskTitle(job)}</span>
          <small>{jobRuntimeLabel(job, now)}</small>
        </button>)}
        {hiddenJobCount ? <small className="agent-overflow-note">+{text(hiddenJobCount)} more active {hiddenJobCount === 1 ? 'ticket' : 'tickets'}</small> : null}
      </div>
    </div>
    <div className="agent-cell agent-cell-model">
      <span className="agent-model-pill"><span>{model}</span></span>
    </div>
    <div className="agent-cell agent-cell-runtime">
      <b>{agentRuntimeValue(worker, now)}</b>
      <small>{worker.currentJobs.length === 1 ? 'current ticket' : `${text(worker.currentJobs.length)} tickets`}</small>
    </div>
    <div className="agent-cell agent-cell-cost">
      <b>{agentTokenValue(worker)}</b>
      <small>{agentUncachedTokenValue(worker)} uncached</small>
    </div>
    <div className="agent-cell agent-cell-files">
      <div className="agent-file-list">
        {files.slice(0, 2).map((file) => <ArtifactLink path={file} label={artifactLabel(file)} className="agent-file-tag" />)}
        {files.length > 2 ? <span className="agent-file-more">+{text(files.length - 2)}</span> : null}
        {!files.length ? <span className="agent-file-empty">{fileFallback}</span> : null}
      </div>
      {evidenceCount ? <small>{text(evidenceCount)} evidence {evidenceCount === 1 ? 'artifact' : 'artifacts'}</small> : null}
    </div>
  </article>;
}

function TaskBoardCard({ job }: { job: TaskBoardItem }): Node {
  const id = taskCardId(job);
  const ticket = ticketId(job);
  const risk = jobRisk(job);
  return <article
    className={`task-card ${risk}`}
    data-task-card={id}
    role="button"
    tabIndex={0}
    draggable="false"
    aria-label={`Open task ${taskTitle(job)}`}
  >
    <div className="task-card-top">
      <code className="task-ticket">{ticket}</code>
      <button type="button" className="task-id-copy" data-copy-code={ticket} title={`Copy ${ticket}`}>Copy</button>
    </div>
    <span className="task-card-kicker">{taskCardStatus(job)}</span>
    <b>{taskTitle(job)}</b>
    <small>{laneOf(job)} · {taskStatusDetail(job)}</small>
    <div className="task-card-foot">
      <span>{pathSummaryText(job)}</span>
      <span>{evidenceSummaryText(job)}</span>
    </div>
  </article>;
}

function TaskDetailDialog({ job, dashboard }: { job: TaskBoardItem; dashboard: Dashboard }): Node {
  const title = taskTitle(job);
  const reasons = taskReasonItems(job);
  const ticket = ticketId(job);
  const id = taskCardId(job);
  const details = taskDetailsCache.get(id);
  const tokenSummary = taskTokenSummary(job);
  void dashboard;
  return <div className="task-modal-backdrop" data-modal-backdrop="true">
    <section className={`task-dialog ${jobRisk(job)}`} role="dialog" aria-modal="true" aria-labelledby="task-dialog-title">
      <header className="task-dialog-head">
        <div>
          <span>{taskCardStatus(job)}</span>
          <h3 id="task-dialog-title">{title}</h3>
          <p>{taskDetailSummary(job)}</p>
        </div>
        <div className="task-dialog-actions">
          <button type="button" data-copy-code={ticket}>Copy ID</button>
          <button type="button" data-modal-close="true" aria-label="Close task details">Close</button>
        </div>
      </header>
      <div className="task-dialog-body" data-scroll-id={taskDialogScrollId(id)}>
        <section className="task-dialog-grid" aria-label="Task facts">
          {taskFact('Ticket', ticket)}
          {taskFact('Task', text(job.taskId ?? job.id))}
          {taskFact('Lane', laneOf(job))}
          {taskFact('Status', text(job.status))}
          {taskFact('Column', taskBoardColumnTitle(taskBoardColumnId(job)))}
          {taskFact('Merge', text(job.mergeReadiness ?? job.disposition ?? job.bucket))}
          {taskFact('Cost', tokenSummary)}
        </section>

        <section className="task-dialog-section">
          <h4>Details</h4>
          <p>{taskMarkdownSummary(job)}</p>
        </section>

        <section className="task-dialog-section split">
          <div>
            <h4>Reasons</h4>
            {reasons.length ? <ul>{reasons.map((reason) => <li>{reason}</li>)}</ul> : <p className="empty tight">No reasons reported.</p>}
          </div>
          <div>
            <h4>Output</h4>
            <ul>
              <li>{formatNumber(numberValue(job.changedPathCount))} changed paths reported.</li>
              <li>{formatNumber(numberValue(job.evidencePathCount))} evidence artifacts reported.</li>
              <li>{pathSummaryText(job)}.</li>
            </ul>
          </div>
        </section>

        <TaskFileDiffs job={job} details={details} />
        <TaskResultDetails job={job} details={details} />
      </div>
    </section>
  </div>;
}

function TaskFileDiffs({ job, details }: { job: TaskBoardItem; details?: TaskDetails }): Node {
  const changedPaths = stringArray(job.changedPaths).slice(0, 12);
  if (!details && job.boardKind !== 'backlog') return <section className="task-dialog-section">
    <h4>Files changed</h4>
    <p className="empty tight">Loading file diffs...</p>
  </section>;
  if (details?.files?.length) return <section className="task-dialog-section">
    <h4>Files changed</h4>
    <div className="task-file-list">
      {details.files.map((file) => {
        const keys = taskFileDiffKeys(job, file);
        return <details
          className="task-file-diff"
          data-task-file-diff-key={keys[0] ?? ''}
          data-task-file-diff-keys={keys.join('\t')}
          open={isTaskFileDiffOpen(job, file) ? 'open' : undefined}
        >
          <summary>
            <span className="task-file-name">{file.path}</span>
            <small>+{text(file.additions)} -{text(file.deletions)}{file.truncated ? ' · truncated' : ''}</small>
            <ArtifactLink path={file.artifactPath ?? file.path} label="Reveal" className="task-file-reveal" />
          </summary>
          <DiffRenderer file={file} />
        </details>;
      })}
    </div>
  </section>;
  if (changedPaths.length) return <section className="task-dialog-section">
    <h4>Files changed</h4>
    <p className="empty tight">{details?.error ? `Diff unavailable: ${details.error}` : 'No patch diff was available in the collected evidence.'}</p>
    <ArtifactPathList paths={changedPaths} />
  </section>;
  return <section className="task-dialog-section">
    <h4>Files changed</h4>
    <p className="empty tight">{job.boardKind === 'backlog' ? 'No files yet. This item has not produced an implementation patch.' : 'No changed files reported.'}</p>
  </section>;
}

function TaskResultDetails({ job, details }: { job: TaskBoardItem; details?: TaskDetails }): Node {
  const evidenceArtifacts = artifactListFromDetails(job, details).slice(0, 10);
  const passed = details?.commandsPassed ?? [];
  const failed = details?.commandsFailed ?? [];
  if (passed.length || failed.length) return <section className="task-dialog-section">
    <h4>Results</h4>
    <div className="task-result-list">
      {failed.map((entry) => taskResultRow(entry, 'failed'))}
      {passed.map((entry) => taskResultRow(entry, 'passed'))}
    </div>
    {evidenceArtifacts.length ? <div className="task-section-subblock">
      <h5>Evidence</h5>
      <ArtifactList artifacts={evidenceArtifacts} />
    </div> : null}
  </section>;
  if (!evidenceArtifacts.length) return <section className="task-dialog-section">
    <h4>Results</h4>
    <p className="empty tight">No test or evidence output is attached to this task yet.</p>
  </section>;
  return <section className="task-dialog-section">
    <h4>Evidence</h4>
    <ArtifactList artifacts={evidenceArtifacts} />
  </section>;
}

function DiffRenderer({ file }: { file: TaskFileDiff }): Node {
  const hunks = file.hunks?.length ? file.hunks : fallbackDiffHunks(file.diff);
  return <div className={`diff-renderer language-${file.language ?? 'text'}`} data-diff-renderer="true">
    {hunks.map((hunk) => <section className="diff-hunk" aria-label={hunk.header}>
      {hunk.lines.map((line) => diffLineNode(line, file.language ?? 'text'))}
    </section>)}
  </div>;
}

function diffLineNode(line: DiffLine, language: string): Node {
  const prefix = line.kind === 'add' ? '+' : line.kind === 'delete' ? '-' : line.kind === 'context' ? ' ' : '';
  return <div className={`diff-line diff-line-${line.kind}`}>
    <span className="diff-line-old">{line.oldLine === undefined ? '' : text(line.oldLine)}</span>
    <span className="diff-line-new">{line.newLine === undefined ? '' : text(line.newLine)}</span>
    <span className="diff-line-prefix">{prefix}</span>
    <code className="diff-line-code">{line.kind === 'add' || line.kind === 'delete' || line.kind === 'context'
      ? highlightCode(line.content, language)
      : line.content}</code>
  </div>;
}

function fallbackDiffHunks(diff: string): DiffHunk[] {
  return [{
    header: 'Raw patch',
    lines: diff.split('\n').map((line) => {
      if (line.startsWith('+') && !line.startsWith('+++')) return { kind: 'add', content: line.slice(1) };
      if (line.startsWith('-') && !line.startsWith('---')) return { kind: 'delete', content: line.slice(1) };
      if (line.startsWith('@@')) return { kind: 'hunk', content: line };
      if (line.startsWith(' ')) return { kind: 'context', content: line.slice(1) };
      return { kind: 'meta', content: line };
    })
  }];
}

function ArtifactPathList({ paths }: { paths: string[] }): Node {
  return <div className="task-path-list">{paths.map((entry) => <ArtifactLink path={entry} label={entry} />)}</div>;
}

function ArtifactList({ artifacts }: { artifacts: TaskArtifact[] }): Node {
  return <div className="task-path-list">{artifacts.map((artifact) => <ArtifactLink path={artifact.path} label={artifact.label || artifact.path} />)}</div>;
}

function ArtifactLink({ path, label, className }: { path: string; label: string; className?: string }): Node {
  return <button
    type="button"
    className={className ? `artifact-link ${className}` : 'artifact-link'}
    data-reveal-artifact-path={path}
    title={`Reveal ${path} in Finder`}
  >{label}</button>;
}

function artifactListFromDetails(job: TaskBoardItem, details?: TaskDetails): TaskArtifact[] {
  const detailArtifacts = details?.evidenceArtifacts ?? [];
  const legacy = stringArray(job.evidencePaths).map((entry) => ({ path: entry, label: artifactLabel(entry) }));
  const byPath = new Map<string, TaskArtifact>();
  for (const artifact of [...detailArtifacts, ...legacy]) byPath.set(artifact.path, artifact);
  return Array.from(byPath.values());
}

function highlightCode(value: string, language: string): unknown[] {
  if (!shouldHighlightLanguage(language) || !value) return [value];
  const pattern = /(\/\/.*$|\/\*.*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:async|await|break|case|catch|class|const|continue|default|else|export|extends|false|for|from|function|if|import|interface|let|new|null|of|return|switch|true|try|type|undefined|var|while)\b|\b\d+(?:\.\d+)?\b)/g;
  const out: unknown[] = [];
  let lastIndex = 0;
  for (const match of value.matchAll(pattern)) {
    const token = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) out.push(value.slice(lastIndex, index));
    out.push(<span className={`diff-token ${tokenClass(token)}`}>{token}</span>);
    lastIndex = index + token.length;
  }
  if (lastIndex < value.length) out.push(value.slice(lastIndex));
  return out.length ? out : [value];
}

function shouldHighlightLanguage(language: string): boolean {
  return ['typescript', 'javascript', 'json', 'css', 'html', 'markdown'].includes(language);
}

function tokenClass(token: string): string {
  if (token.startsWith('//') || token.startsWith('/*')) return 'comment';
  if (token.startsWith('"') || token.startsWith("'") || token.startsWith('`')) return 'string';
  if (/^\d/.test(token)) return 'number';
  return 'keyword';
}

function artifactLabel(path: string): string {
  const clean = path.replace(/\/+$/g, '');
  return clean.split(/[\\/]/g).filter(Boolean).pop() ?? clean;
}

function taskResultRow(entry: Record<string, unknown>, state: 'passed' | 'failed'): Node {
  const command = textValue(entry.command ?? entry.cmd ?? entry.name ?? entry.label, state === 'passed' ? 'passed command' : 'failed command');
  const detail = textValue(entry.summary ?? entry.output ?? entry.error ?? entry.exitCode, '');
  return <article className={`task-result-row ${state}`}>
    <span>{state}</span>
    <b>{command}</b>
    {detail ? <small>{detail}</small> : null}
  </article>;
}

function taskBoardItems(dashboard: Dashboard, jobs: Array<Record<string, unknown>>): TaskBoardItem[] {
  return [
    ...jobs.filter(isTaskBoardVisibleJob).map((job) => ({ ...job, boardKind: 'job' as const })),
    ...backlogBoardItems(dashboard)
  ];
}

function isTaskBoardVisibleJob(job: Record<string, unknown>): boolean {
  return !isResolvedCoordinatorReviewJob(job);
}

function isResolvedCoordinatorReviewJob(job: Record<string, unknown>): boolean {
  const bucket = normalized(job.bucket);
  const status = coordinatorDecisionStatus(job);
  if (bucket === 'review-resolved' || bucket === 'resolved-review' || job.reviewResolved === true) return true;
  return Boolean(status) && isResolvedCoordinatorDecisionStatus(status);
}

function isResolvedCoordinatorDecisionStatus(status: string): boolean {
  const value = normalized(status);
  return Boolean(value) && !['open', 'pending', 'deferred', 'needs-review'].includes(value);
}

function activeAgentTaskCount(dashboard: Dashboard, jobs: Array<Record<string, unknown>>): number {
  return taskBoardItems(dashboard, jobs).filter(isActiveAgentJob).length;
}

function backlogBoardItems(dashboard: Dashboard): TaskBoardItem[] {
  const direct = recordValue(dashboard.backlog);
  const raw = recordValue(dashboard.raw);
  const continuation = recordValue(raw.continuation);
  const nextBacklog = recordValue(continuation.nextBacklog);
  const entries = [
    ...arrayRecords(direct.entries),
    ...arrayRecords(nextBacklog.entries)
  ];
  return entries.map((entry, index) => {
    const id = textValue(entry.id ?? entry.taskId ?? entry.title, `backlog-${index + 1}`);
    const status = normalized(entry.status ?? entry.state);
    const column: TaskBoardColumnId = ['todo', 'ready', 'queued', 'pending'].includes(status) || Boolean(entry.ready)
      ? 'todo'
      : 'backlog';
    return {
      ...entry,
      boardKind: 'backlog' as const,
      boardColumn: column,
      id: `backlog:${id}`,
      taskId: id,
      title: textValue(entry.title ?? entry.objective ?? entry.summary ?? id, id),
      status: textValue(entry.status ?? entry.state, column === 'todo' ? 'todo' : 'backlog'),
      lane: textValue(entry.lane ?? entry.group ?? entry.owner, 'backlog'),
      changedPathCount: numberValue(entry.changedPathCount),
      evidencePathCount: numberValue(entry.evidencePathCount)
    };
  });
}

function taskBoardColumns(items: TaskBoardItem[]): TaskBoardColumn[] {
  const columns: TaskBoardColumn[] = [
    { id: 'backlog', title: 'Backlog', detail: 'not scheduled yet', empty: 'No backlog items.', items: [] },
    { id: 'todo', title: 'To do', detail: 'ready to start', empty: 'No queued tasks.', items: [] },
    { id: 'active', title: 'Active', detail: 'running work', empty: 'No active tasks.', items: [] },
    { id: 'review', title: 'Coordinator review', detail: 'needs decision', empty: 'No tasks need coordinator review.', items: [] },
    { id: 'ready', title: 'Ready', detail: 'ready to apply', empty: 'No ready patches.', items: [] },
    { id: 'done', title: 'Done', detail: 'completed output', empty: 'No completed tasks.', items: [] },
    { id: 'blocked', title: 'Blocked', detail: 'waiting or impossible', empty: 'No genuinely blocked tasks.', items: [] }
  ];
  const byId = new Map(columns.map((column) => [column.id, column]));
  for (const job of items) byId.get(taskBoardColumnId(job))?.items.push(job);
  for (const column of columns) column.items.sort(taskBoardJobSort);
  return columns;
}

const AGENT_DESCRIPTION_WORDS = [
  'curious',
  'steady',
  'sharp',
  'patient',
  'bright',
  'quiet',
  'focused',
  'careful',
  'swift',
  'calm',
  'clear',
  'brave',
  'nimble',
  'keen',
  'warm',
  'exact'
];

const AGENT_ANIMAL_NAMES = [
  'fox',
  'otter',
  'hawk',
  'lynx',
  'raven',
  'badger',
  'heron',
  'marten',
  'falcon',
  'orca',
  'hare',
  'wolf',
  'owl',
  'seal',
  'ibis',
  'koala'
];

const AGENT_COLORS = [
  '#9fb7cf',
  '#b7ad83',
  '#9fbea8',
  '#c3a0a0',
  '#b2a6c8',
  '#96b8b3',
  '#c2b08f',
  '#a9b1bb',
  '#8fb29d',
  '#baa0b4',
  '#a5b8d0',
  '#c0aa96'
];

function agentWorkers(jobs: TaskBoardItem[]): AgentWorker[] {
  const byAgent = new Map<string, AgentWorker>();
  for (const job of jobs) {
    const key = agentIdentityKey(job);
    let worker = byAgent.get(key);
    if (!worker) {
      worker = {
        key,
        name: generatedAgentName(key),
        color: agentColor(key),
        status: 'idle',
        jobs: [],
        currentJobs: []
      };
      byAgent.set(key, worker);
    }
    worker.jobs.push(job);
    if (isActiveAgentJob(job)) worker.currentJobs.push(job);
  }
  const workers = Array.from(byAgent.values());
  for (const worker of workers) {
    worker.jobs.sort(agentWorkerSort);
    worker.currentJobs.sort(agentWorkerSort);
    worker.status = coordinatorStatus(agentStatusCounts(worker.jobs));
    if (!worker.currentJobs.length) worker.currentJobs = worker.jobs.slice(0, 3);
  }
  return workers.sort((left, right) => agentStatusRank(left.status) - agentStatusRank(right.status) || left.name.localeCompare(right.name));
}

function agentIdentityKey(job: TaskBoardItem): string {
  return textValue(job.agentId ?? job.workerId ?? job.worker ?? job.assignee ?? job.assignedAgent ?? job.computeId ?? job.taskId ?? job.id, taskCardId(job));
}

function generatedAgentName(key: string): string {
  const hash = stableNumber(key);
  const description = AGENT_DESCRIPTION_WORDS[hash % AGENT_DESCRIPTION_WORDS.length] ?? 'curious';
  const animal = AGENT_ANIMAL_NAMES[Math.floor(hash / AGENT_DESCRIPTION_WORDS.length) % AGENT_ANIMAL_NAMES.length] ?? 'fox';
  return `${description} ${animal}`;
}

function agentDisplayName(worker: AgentWorker, index: number): string {
  if (worker.name) return worker.name;
  return `Agent ${String(index + 1).padStart(2, '0')}`;
}

function shortAgentId(value: string): string {
  const clean = value.split(/[\\/]/g).pop() ?? value;
  const parts = clean.split('-').filter(Boolean);
  if (parts.length <= 3) return clean;
  return parts.slice(-3).join('-');
}

function agentColor(key: string): string {
  return AGENT_COLORS[stableNumber(key) % AGENT_COLORS.length] ?? AGENT_COLORS[0];
}

function stableNumber(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function agentStatusCounts(items: TaskBoardItem[]): Record<AgentStatus, number> {
  const counts = emptyAgentStatusCounts();
  for (const item of items) counts[agentStatus(item)] += 1;
  return counts;
}

function emptyAgentStatusCounts(): Record<AgentStatus, number> {
  return { active: 0, waiting: 0, review: 0, done: 0, blocked: 0, idle: 0 };
}

function agentStatus(job: TaskBoardItem): AgentStatus {
  const status = normalized(job.status ?? job.state);
  const bucket = normalized(job.bucket);
  const disposition = normalized(job.disposition ?? job.mergeReadiness);
  if (['running', 'active', 'working', 'in-progress', 'in progress'].includes(status)) return 'active';
  if (status === 'idle' || bucket === 'idle') return 'idle';
  if (isBlockedJob(job)) return 'blocked';
  if (isCoordinatorReviewJob(job) || isReadyJob(job) || disposition.includes('review')) return 'review';
  if (isCompletedJob(job) || ['done', 'landed', 'applied'].includes(bucket) || ['done', 'landed', 'applied'].includes(disposition)) return 'done';
  if (['queued', 'pending', 'todo', 'waiting', 'scheduled'].includes(status) || ['queued', 'pending'].includes(bucket)) return 'waiting';
  return 'waiting';
}

function isActiveAgentJob(job: TaskBoardItem): boolean {
  return agentStatus(job) === 'active';
}

function coordinatorStatus(counts: Record<AgentStatus, number>): AgentStatus {
  if (counts.active) return 'active';
  if (counts.review) return 'review';
  if (counts.blocked) return 'blocked';
  if (counts.waiting) return 'waiting';
  if (counts.done) return 'done';
  return 'idle';
}

function agentStatusLabel(status: AgentStatus): string {
  if (status === 'active') return 'Active';
  if (status === 'waiting') return 'Waiting';
  if (status === 'review') return 'Review';
  if (status === 'done') return 'Done';
  if (status === 'blocked') return 'Blocked';
  return 'Idle';
}

function agentModelLabel(job: TaskBoardItem): string {
  const value = textValue(job.model ?? job.modelTier ?? job.profile ?? job.computeProfile ?? job.routingMode, '');
  return value || 'model unknown';
}

function agentModelSummary(worker: AgentWorker): string {
  const models = uniqueStrings(worker.jobs.map(agentModelLabel)).filter((model) => model !== 'model unknown');
  if (!models.length) return 'model unknown';
  if (models.length === 1) return models[0];
  return `${models.slice(0, 2).join(' + ')}${models.length > 2 ? ` +${models.length - 2}` : ''}`;
}

function agentStatusDetail(job: TaskBoardItem): string {
  const status = agentStatus(job);
  if (status === 'active') return 'Working on the assigned task now.';
  if (status === 'waiting') return 'Waiting to start, resume, or receive a lease.';
  if (status === 'review') return 'Output is waiting for coordinator review or application.';
  if (status === 'blocked') return taskReasonItems(job).slice(0, 2).join(', ') || 'Explicitly blocked by a dependency, missing decision, or impossible task.';
  if (status === 'done') return 'Worker output is complete.';
  return 'Worker is idle.';
}

function agentTokenValue(worker: AgentWorker): string {
  const actual = worker.jobs.reduce((sum, job) => sum + numberValue(job.actualInputTokens), 0);
  const estimated = worker.jobs.reduce((sum, job) => sum + numberValue(job.estimatedInputTokens), 0);
  const prompt = worker.jobs.reduce((sum, job) => sum + numberValue(job.promptBytes), 0);
  if (actual) return formatNumber(actual);
  if (estimated) return `${formatNumber(estimated)} est`;
  if (prompt) return formatBytes(prompt);
  return '-';
}

function agentUncachedTokenValue(worker: AgentWorker): string {
  const uncached = worker.jobs.reduce((sum, job) => sum + uncachedInputTokensForJob(job), 0);
  return uncached ? formatNumber(uncached) : '-';
}

function agentRuntimeValue(worker: AgentWorker, now: number): string {
  const durations = worker.currentJobs.map((job) => jobRuntimeMs(job, now)).filter((value) => value > 0);
  if (!durations.length) return '-';
  return formatDuration(Math.max(...durations));
}

function jobRuntimeLabel(job: TaskBoardItem, now: number): string {
  const duration = jobRuntimeMs(job, now);
  return duration ? formatDuration(duration) : 'no timing';
}

function jobRuntimeMs(job: Record<string, unknown>, now: number): number {
  const explicit = numberValue(job.durationMs ?? job.elapsedMs ?? job.runtimeMs ?? job.wallTimeMs);
  if (explicit > 0) return explicit;
  const started = timeValue(job.startedAt ?? job.startTime ?? job.createdAt ?? job.leaseStartedAt);
  const ended = timeValue(job.finishedAt ?? job.completedAt ?? job.endedAt ?? job.updatedAt);
  if (started && ended && ended >= started) return ended - started;
  if (started && isActiveAgentJob(job as TaskBoardItem)) return Math.max(0, now - started);
  return 0;
}

function agentTouchedFiles(worker: AgentWorker): string[] {
  const paths = worker.jobs.flatMap((job) => stringArray(job.changedPaths));
  if (paths.length) return uniqueStrings(paths);
  return worker.jobs
    .map((job) => textValue(job.changedPath, ''))
    .filter(Boolean);
}

function agentEvidencePaths(worker: AgentWorker): string[] {
  return uniqueStrings(worker.jobs.flatMap((job) => stringArray(job.evidencePaths)));
}

function agentEvidenceCount(worker: AgentWorker): number {
  const paths = agentEvidencePaths(worker);
  if (paths.length) return paths.length;
  return worker.jobs.reduce((sum, job) => sum + numberValue(job.evidencePathCount), 0);
}

function agentWorkerSort(left: TaskBoardItem, right: TaskBoardItem): number {
  return agentStatusRank(agentStatus(left)) - agentStatusRank(agentStatus(right))
    || taskBoardJobSort(left, right);
}

function agentStatusRank(status: AgentStatus): number {
  if (status === 'active') return 0;
  if (status === 'review') return 1;
  if (status === 'blocked') return 2;
  if (status === 'waiting') return 3;
  if (status === 'idle') return 4;
  return 5;
}

function taskBoardColumnId(job: TaskBoardItem): TaskBoardColumnId {
  if (job.boardColumn) return job.boardColumn;
  if (job.boardKind === 'backlog') return 'backlog';
  if (isBlockedJob(job)) return 'blocked';
  if (isCoordinatorReviewJob(job)) return 'review';
  if (isReadyJob(job)) return 'ready';
  if (['queued', 'pending', 'todo'].includes(normalized(job.status))) return 'todo';
  if (!isTerminalJob(job) || normalized(job.status) === 'running') return 'active';
  return 'done';
}

function taskBoardColumnTitle(id: TaskBoardColumnId): string {
  if (id === 'backlog') return 'Backlog';
  if (id === 'todo') return 'To do';
  if (id === 'active') return 'Active';
  if (id === 'review') return 'Coordinator review';
  if (id === 'ready') return 'Ready';
  if (id === 'done') return 'Done';
  return 'Blocked';
}

function taskBoardJobSort(left: Record<string, unknown>, right: Record<string, unknown>): number {
  return taskSortRank(left) - taskSortRank(right)
    || taskTitle(left).localeCompare(taskTitle(right));
}

function taskSortRank(job: Record<string, unknown>): number {
  if (job.boardKind === 'backlog') return 0;
  if (isBlockedJob(job)) return 0;
  if (isNeedsCoordinatorPortJob(job)) return 1;
  if (isFailedJob(job) || isStaleJob(job)) return 2;
  if (normalized(job.status) === 'running') return 3;
  if (isReadyJob(job)) return 4;
  return 5;
}

function taskCardId(job: Record<string, unknown>): string {
  return textValue(job.id ?? job.taskId ?? job.title, 'task');
}

function ticketId(job: Record<string, unknown>): string {
  return `T-${stableHash(taskCardId(job)).slice(0, 5).toUpperCase()}`;
}

function stableHash(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36).padStart(6, '0');
}

function taskTitle(job: Record<string, unknown>): string {
  return sentenceCaseIdentifier(textValue(job.title ?? job.taskId ?? job.id, 'Untitled task'));
}

function taskCardStatus(job: Record<string, unknown>): string {
  const decision = coordinatorDecisionStatus(job);
  if (decision) return coordinatorDecisionLabel(decision);
  const column = taskBoardColumnId(job);
  if (column === 'backlog') return 'Backlog';
  if (column === 'todo') return 'To do';
  if (column === 'review') return 'Coordinator review';
  if (column === 'ready') return 'Ready';
  if (column === 'blocked') return 'Blocked';
  if (column === 'done') return 'Done';
  return textValue(job.status, 'Active');
}

function taskStatusDetail(job: Record<string, unknown>): string {
  const decision = recordValue(job.coordinatorDecision);
  const reason = textValue(decision.reason, '');
  if (reason) return reason;
  return coordinatorFacingSignalLabel(job.bucket ?? job.disposition ?? job.mergeReadiness ?? job.status);
}

function taskDetailSummary(job: Record<string, unknown>): string {
  const decision = recordValue(job.coordinatorDecision);
  const reason = textValue(decision.reason, '');
  if (reason) return `Coordinator decision: ${coordinatorDecisionLabel(textValue(job.coordinatorDecisionStatus ?? decision.status, 'resolved'))}. ${reason}`;
  const column = taskBoardColumnId(job);
  if (column === 'backlog') return 'This is planned work that is not scheduled into the active swarm yet.';
  if (column === 'todo') return 'This work is queued for the AI-managed task backlog.';
  if (column === 'review') return 'The worker produced output that the coordinator should review before it is treated as landed work.';
  if (column === 'ready') return 'This task appears ready to apply or already has a clean readiness signal.';
  if (column === 'blocked') return 'This task is explicitly blocked by a dependency, missing decision, or an impossible requirement.';
  if (column === 'done') return 'This task has completed and is being kept visible as successful swarm output.';
  return 'This task is still active or queued in the swarm run.';
}

function taskMarkdownSummary(job: Record<string, unknown>): string {
  const changed = formatNumber(numberValue(job.changedPathCount));
  const evidence = formatNumber(numberValue(job.evidencePathCount));
  const reasons = taskReasonItems(job);
  const reasonText = reasons.length ? ` Main signal: ${reasons[0]}.` : '';
  return `${taskTitle(job)} is in ${taskBoardColumnTitle(taskBoardColumnId(job)).toLowerCase()} with ${changed} changed paths and ${evidence} evidence artifacts.${reasonText}`;
}

function coordinatorDecisionStatus(job: Record<string, unknown>): string {
  return textValue(job.coordinatorDecisionStatus ?? recordValue(job.coordinatorDecision).status, '');
}

function coordinatorDecisionLabel(status: string): string {
  const value = normalized(status);
  if (value.includes('superseded')) return 'Superseded';
  if (value.includes('not-applicable')) return 'Not applicable';
  if (value.includes('accepted') || value.includes('applied')) return 'Accepted';
  if (value.includes('rejected')) return 'Rejected';
  return sentenceCaseIdentifier(status || 'resolved');
}

function coordinatorFacingSignalLabel(value: unknown): string {
  const raw = textValue(value, 'tracked task');
  const normalizedValue = normalized(raw);
  if (normalizedValue === 'needs-human-port' || normalizedValue === 'needs-coordinator-port') return 'needs coordinator review';
  if (normalizedValue === 'needs-human-review' || normalizedValue === 'needs-coordinator-review') return 'needs coordinator review';
  if (normalizedValue === 'needs-human-decision' || normalizedValue === 'needs-coordinator-decision') return 'needs coordinator decision';
  if (normalizedValue === 'failed-evidence') return 'failed evidence';
  if (normalizedValue === 'ready-to-apply') return 'ready to apply';
  if (normalizedValue === 'patch-candidate') return 'patch candidate';
  return sentenceCaseIdentifier(raw);
}

function taskTokenSummary(job: Record<string, unknown>): string {
  const actual = numberValue(job.actualInputTokens);
  const uncached = numberValue(job.uncachedInputTokens);
  const estimated = numberValue(job.estimatedInputTokens);
  if (actual) return `${formatNumber(actual)} input`;
  if (uncached) return `${formatNumber(uncached)} uncached`;
  if (estimated) return `${formatNumber(estimated)} est`;
  return '-';
}

function taskReasonItems(job: Record<string, unknown>): string[] {
  return uniqueStrings([
    ...stringArray(job.collectReasonClasses),
    ...stringArray(job.reasons),
    ...stringArray(job.contextBudgetWarnings),
    ...stringArray(job.semanticReadinessReasons)
  ]).slice(0, 8);
}

function taskFact(label: string, value: string): Node {
  return <div className="task-fact">
    <span>{label}</span>
    <b>{value || '-'}</b>
  </div>;
}

function workKpi(label: string, value: unknown, detail: string): Node {
  return <article className="work-kpi">
    <span>{label}</span>
    <b>{text(value)}</b>
    <small>{detail}</small>
  </article>;
}

function HumanActionQueue({ dashboard, jobs, audit }: { dashboard: Dashboard; jobs: Array<Record<string, unknown>>; audit: AuditSummary }): Node {
  const rows = humanActionRows(jobs, audit, dashboard);
  return <div className="action-layout" data-scroll-id="actions">
    <ActionList rows={rows} expanded />
  </div>;
}

function ActionList({ rows, expanded = false }: { rows: HumanActionRow[]; expanded?: boolean }): Node {
  if (!rows.length) return <p className="empty tight">No open questions from agents right now.</p>;
  return <div className={expanded ? 'action-list expanded' : 'action-list'}>
    {rows.map((row) => <article className={`action-row ${row.priority}`} data-human-question-code={row.code}>
      <div className="action-code">
        <b>{row.code}</b>
        <button type="button" data-copy-code={row.code} title={`Copy ${row.code}`}>Copy</button>
      </div>
      <div className="action-copy">
        <span>{row.askedBy || 'Agent question'}{row.scope ? ` · ${row.scope}` : ''}</span>
        <h4>{row.title}</h4>
        <p>{row.question}</p>
        {expanded && row.why ? <small>Why: {row.why}</small> : null}
        {expanded && row.detail !== row.question ? <small>Context: {row.detail}</small> : null}
        {expanded ? <small>Requested answer: {row.requestedAnswer || row.defaultAction}</small> : null}
        {expanded ? <HumanActionAnswerForm row={row} /> : null}
      </div>
    </article>)}
  </div>;
}

function HumanActionAnswerForm({ row }: { row: HumanActionRow }): Node {
  const state = humanAnswerStates.get(row.code);
  const answer = humanAnswerDrafts.get(row.code) ?? '';
  return <form className="action-answer-form" data-human-answer-form="true" data-human-answer-code={row.code}>
    <textarea
      name="answer"
      data-human-answer-code={row.code}
      rows={3}
      placeholder={`Answer ${row.code}...`}
      aria-label={`Answer ${row.code}`}
    >{answer}</textarea>
    <div>
      <button type="submit" disabled={state?.status === 'submitting'}>{state?.status === 'submitting' ? 'Submitting...' : 'Submit answer'}</button>
      {state ? <small className={`action-answer-status ${state.status}`}>{state.message}</small> : null}
    </div>
  </form>;
}

function PerformanceView({ dashboard, jobs, attention, audit }: {
  dashboard: Dashboard;
  jobs: Array<Record<string, unknown>>;
  attention: AttentionSummary;
  audit: AuditSummary;
}): Node {
  const telemetry = tokenTimeSummary(dashboard, jobs);
  const context = contextPressureSummary(jobs);
  const cost = modelCostSummary(jobs);
  const timeCharts = performanceTimeChartSeries(dashboard, jobs);
  const optimization = optimizationSignalSummary(dashboard, jobs);
  const behavior = optimizationBehaviorSummary(dashboard, jobs);
  const topContext = contextOffenderRows(jobs);
  const topCosts = modelCostRows(jobs);
  return <div className="performance-layout" data-scroll-id="performance" data-smoke-marker="performance-tab">
    <section className="performance-summary">
      {workKpi('Estimated cost', cost.value, cost.detail)}
      {workKpi('Input tokens', telemetry.tokenValue, telemetry.tokenDetail)}
      {workKpi('Runtime', telemetry.durationValue, telemetry.durationDetail)}
      {workKpi('Cache hit', context.cacheHitRatio ? formatPercent(context.cacheHitRatio) : '-', context.actualInputTokens ? `${formatNumber(context.cachedInputTokens)} cached` : 'no cache data')}
      {workKpi('Waste signals', context.warningCount + context.failedCount + attention.failedCount + attention.blockedCount + generatedNoiseCount(audit), 'budget, failure, blocked, and generated-noise signals')}
    </section>

    <section className="work-section performance-chart-section">
      <div className="metric-section-head">
        <h3>Performance over time</h3>
        <span>{performanceTimeDetail(dashboard)}</span>
      </div>
      <MiniCharts series={timeCharts} />
    </section>

    <section className="work-section performance-chart-section">
      <div className="metric-section-head">
        <h3>Optimization signals</h3>
        <span>{optimization.status}</span>
      </div>
      <div className="optimization-signal-grid">
        {optimization.rows.map((row) => <article className={`optimization-signal ${row.tone}`}>
          <span>{row.label}</span>
          <b>{row.value}</b>
          <small>{row.detail}</small>
        </article>)}
      </div>
    </section>

    <section className="work-section optimization-behavior-section">
      <div className="metric-section-head">
        <h3>Workflow behavior trend</h3>
        <span>{behavior.status}</span>
      </div>
      <div className="optimization-behavior-grid">
        {behavior.cards.map((card) => <article className={`optimization-behavior-card ${card.tone}`}>
          <span>{card.label}</span>
          <b>{card.value}</b>
          <small>{card.detail}</small>
        </article>)}
      </div>
      <div className="optimization-behavior-list">
        {behavior.rows.map((row) => <article className={`optimization-behavior-row ${row.tone}`}>
          <div>
            <b>{row.label}</b>
            <small>{row.detail}</small>
          </div>
          <span>{row.value}</span>
        </article>)}
      </div>
    </section>

    <section className="work-section performance-split">
      <div>
        <div className="metric-section-head">
          <h3>Top cost drivers</h3>
          <span>{text(Math.max(topCosts.length, topContext.length))} tasks</span>
        </div>
        <SimpleRows rows={topCosts.length ? topCosts : topContext.map((job) => ({
          label: job.label,
          value: formatNumber(job.uncachedInputTokens || job.actualInputTokens || job.estimatedInputTokens),
          detail: contextDriverDetail(job)
        }))} />
      </div>
      <div>
        <div className="metric-section-head">
          <h3>Waste breakdown</h3>
          <span>{riskStatusLabel(dashboard, attention, jobs.length > 0)}</span>
        </div>
        <BarRows rows={performanceWasteRows(jobs, attention, audit, context)} />
      </div>
    </section>
  </div>;
}

function HistoryView({ dashboard, jobs, events, success, attention }: {
  dashboard: Dashboard;
  jobs: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  success: SuccessSummary;
  attention: AttentionSummary;
}): Node {
  const graph = historyGitGraph(dashboard, jobs);
  return <div className="history-layout" data-scroll-id="history" data-smoke-marker="history-tab">
    <section className="work-section history-graph-section git-history-section">
      <div className="metric-section-head">
        <h3>Version history</h3>
        <span>{text(graph.rows.length)} nodes · {text(graph.lanes.length)} lanes</span>
      </div>
      <HistoryGitGraph graph={graph} />
    </section>
    <section className="work-section history-split">
      <div>
        <div className="metric-section-head">
          <h3>Merge state</h3>
          <span>{formatNumber(success.appliedCount)} applied · {formatNumber(success.landedCount)} landed</span>
        </div>
        <SimpleRows rows={[
          { label: 'Ready', value: formatNumber(success.readyCount), detail: 'outputs that appear ready to apply' },
          { label: 'Coordinator review', value: formatNumber(attention.needsCoordinatorReviewCount), detail: 'outputs waiting on coordinator judgement' },
          { label: 'Review / blocked', value: formatNumber(attention.failedCount + attention.needsCoordinatorReviewCount + attention.staleCount + attention.blockedCount), detail: 'outputs needing coordinator decision or explicit unblock' },
          { label: 'Snapshot', value: formatTime(dashboard.generatedAt), detail: dashboardSourceLabel(dashboard) }
        ]} />
      </div>
      <div>
        <div className="metric-section-head">
          <h3>Recent events</h3>
          <span>{text(events.length)} visible</span>
        </div>
        <HistoryEventRows events={events} />
      </div>
    </section>
  </div>;
}

function HistoryGitGraph({ graph }: { graph: HistoryGraph }): Node {
  if (!graph.rows.length) return <p className="empty tight">No task history has been reported yet.</p>;
  return <div className="git-history-viewport">
    <div
      className="git-history-grid"
      style={`--history-row-height:${graph.rowHeight}px; --history-graph-width:${graph.width}px; --history-graph-height:${graph.height}px`}
    >
      <div className="git-graph-canvas" aria-hidden="true">
        <svg className="git-graph-svg" viewBox={`0 0 ${graph.width} ${graph.height}`} width={graph.width} height={graph.height}>
          {graph.lanes.map((lane) => <path className="git-graph-rail" d={`M ${lane.x} 14 V ${Math.max(14, graph.height - 14)}`} stroke={lane.color} />)}
          {graph.rows.filter((row) => row.laneIndex > 0).map((row) => <path
            className={row.merged ? 'git-graph-merge' : 'git-graph-branch'}
            d={historyCurvePath(graph.trunkX, row.x, row.y)}
            stroke={historyLaneColor(graph, row.laneId)}
          />)}
          {graph.rows.filter((row) => row.merged && row.laneIndex > 0).map((row) => <circle
            className={`git-graph-node trunk ${row.tone}`}
            cx={graph.trunkX}
            cy={row.y}
            r="4"
            stroke={historyLaneColor(graph, 'main')}
            data-chart-tooltip={`${row.title}\nMerged to main\n${row.meta}`}
          />)}
          {graph.rows.map((row) => <circle
            className={`git-graph-node ${row.tone}`}
            cx={row.x}
            cy={row.y}
            r="5"
            stroke={historyLaneColor(graph, row.laneId)}
            data-chart-tooltip={row.tooltip}
          />)}
        </svg>
      </div>
      <div className="git-history-rows">
        {graph.rows.map((row) => <button
          type="button"
          className={`git-history-row ${row.tone}`}
          data-task-card={row.id}
          data-chart-tooltip={row.tooltip}
          aria-label={row.tooltip.replace(/\n/g, '. ')}
          style={`height:${graph.rowHeight}px`}
        >
          <div>
            <b>{row.title}</b>
            <small>{row.subtitle}</small>
          </div>
          <span>{row.meta}</span>
        </button>)}
      </div>
    </div>
  </div>;
}

function LegacyHistoryBranchList({ jobs }: { jobs: Array<Record<string, unknown>> }): Node {
  const branches = historyBranchRows(jobs);
  return <section className="work-section">
      <div className="metric-section-head">
        <h3>Version lanes</h3>
        <span>{text(branches.length)} recent task outputs</span>
      </div>
      <div className="history-branches">
        {branches.length ? branches.map((job) => <article className={`history-branch ${jobRisk(job)}`}>
          <span className="history-branch-rail" aria-hidden="true" />
          <div>
            <b>{ticketId(job)} · {taskTitle(job)}</b>
            <small>{laneOf(job)} · {taskCardStatus(job)} · {pathSummaryText(job)}</small>
          </div>
          <span>{jobRuntimeLabel(job as TaskBoardItem, Date.now())}</span>
        </article>) : <p className="empty tight">No task outputs are available for this history view yet.</p>}
      </div>
    </section>;
}

function TestingView({ jobs, events }: {
  jobs: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
}): Node {
  const summary = testingSummary(jobs, events);
  return <div className="testing-layout" data-scroll-id="testing" data-smoke-marker="testing-tab">
    <section className="testing-summary">
      {workKpi('Checks passing', summary.totalChecks ? `${formatNumber(summary.passedChecks)}/${formatNumber(summary.totalChecks)}` : '-', summary.totalChecks ? `${formatNumber(summary.failedChecks)} failing` : 'no command metadata')}
      {workKpi('Active work', summary.activeJobs ? formatNumber(summary.activeJobs) : '0', summary.activeJobs ? 'verification still pending' : 'no running tasks')}
      {workKpi('Browser evidence', summary.browserEvidence ? formatNumber(summary.browserEvidence) : '-', 'Playwright, screenshot, DOM, or browser artifacts')}
      {workKpi('Fuzzing', summary.fuzzEvidence ? formatNumber(summary.fuzzEvidence) : '-', 'fuzz or property-test evidence paths')}
      {workKpi('Oracles', summary.oracleEvidence ? formatNumber(summary.oracleEvidence) : '-', 'oracle, golden, fixture, or snapshot evidence')}
    </section>
    {summary.notice ? <p className={`testing-notice ${summary.noticeTone}`}>{summary.notice}</p> : null}
    <section className="work-section testing-split">
      <div>
        <div className="metric-section-head">
          <h3>Quality status</h3>
          <span>{summary.status}</span>
        </div>
        <BarRows rows={[
          { label: 'Passed checks', value: summary.passedChecks, detail: formatNumber(summary.passedChecks), tone: summary.passedChecks ? 'good' : 'neutral' },
          { label: 'Failed checks', value: summary.failedChecks, detail: formatNumber(summary.failedChecks), tone: summary.failedChecks ? 'bad' : 'neutral' },
          { label: 'Active work', value: summary.activeJobs, detail: `${formatNumber(summary.activeJobs)} tasks`, tone: summary.activeJobs ? 'warn' : 'neutral' },
          { label: 'Missing metadata', value: summary.noMetadataTasks, detail: `${formatNumber(summary.noMetadataTasks)} tasks`, tone: summary.noMetadataTasks ? 'warn' : 'neutral' },
          { label: 'Evidence-backed tasks', value: summary.evidenceTasks, detail: `${formatNumber(summary.evidenceTasks)} tasks`, tone: 'neutral' },
          { label: 'Open failures', value: summary.openFailures, detail: `${formatNumber(summary.openFailures)} tasks`, tone: summary.openFailures ? 'bad' : 'neutral' }
        ]} />
      </div>
      <div>
        <div className="metric-section-head">
          <h3>Evidence mix</h3>
          <span>{formatNumber(summary.evidencePaths)} paths</span>
        </div>
        <div className="testing-evidence-grid">
          {testingEvidenceCard('Browser', summary.browserEvidence, 'UI, screenshot, DOM, or Playwright')}
          {testingEvidenceCard('Fuzzing', summary.fuzzEvidence, 'fuzz/property runs')}
          {testingEvidenceCard('Oracle', summary.oracleEvidence, 'golden/reference checks')}
          {testingEvidenceCard('Unit / smoke', summary.unitEvidence, 'test, smoke, or spec output')}
        </div>
      </div>
    </section>
    <section className="work-section">
      <div className="metric-section-head">
        <h3>Recent check output</h3>
        <span>{formatNumber(summary.rows.length)} tasks</span>
      </div>
      <div className="testing-rows">
        {summary.rows.length ? summary.rows.map((row) => <article className={`testing-row ${row.tone}`}>
          <div className="testing-row-copy">
            <b>{row.label}</b>
            <div className="testing-row-meta">
              {row.detailParts.map((part) => <small>{part}</small>)}
            </div>
          </div>
          <span>{row.value}</span>
        </article>) : <p className="empty tight">No check metadata has been reported yet. This is not the same as passing tests.</p>}
      </div>
    </section>
  </div>;
}

function Metrics({ dashboard, lanes, jobs, events, attention, audit }: {
  dashboard: Dashboard;
  lanes: LaneRollup[];
  jobs: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  attention: AttentionSummary;
  audit: AuditSummary;
}): Node {
  const telemetry = tokenTimeSummary(dashboard, jobs);
  const context = contextPressureSummary(jobs);
  const topContext = contextOffenderRows(jobs);
  const usefulOutput = jobs.length ? successLikeJobCount(jobs) / jobs.length : 0;
  void lanes;
  return <div className="efficiency-layout" data-scroll-id="efficiency">
    <section className="efficiency-summary">
      {workKpi('Useful output rate', formatPercent(usefulOutput), `${text(successLikeJobCount(jobs))} useful of ${text(jobs.length)}`)}
      {workKpi('Uncached tokens', formatNumber(context.uncachedInputTokens), `${telemetry.tokenValue} total input`)}
      {workKpi('Budget warnings', context.warningCount + context.failedCount, `${text(context.failedCount)} failed budget`)}
      {workKpi('Runtime', telemetry.durationValue, telemetry.durationDetail)}
      {workKpi('Events', events.length, 'visible event rows')}
    </section>
    <section className="work-section">
      <div className="metric-section-head">
        <h3>Top cost drivers</h3>
        <span>{text(topContext.length)} tasks</span>
      </div>
      <SimpleRows rows={topContext.map((job) => ({
        label: job.label,
        value: formatNumber(job.uncachedInputTokens || job.actualInputTokens || job.estimatedInputTokens),
        detail: contextDriverDetail(job)
      }))} />
    </section>
    <section className="work-section">
      <div className="metric-section-head">
        <h3>Performance concerns</h3>
        <span>{riskStatusLabel(dashboard, attention, jobs.length > 0)}</span>
      </div>
      <SimpleRows rows={[
        { label: 'Coordinator review', value: text(attention.failedCount + attention.needsCoordinatorReviewCount + attention.staleCount), detail: 'failed, stale, or coordinator-review outputs' },
        { label: 'Blocked', value: text(attention.blockedCount), detail: 'explicit dependency or impossible-task blocks' },
        { label: 'Source ownership risk', value: text(audit.sourceOwnershipViolationCount), detail: 'outside declared source ownership' },
        { label: 'Generated noise', value: text(generatedNoiseCount(audit)), detail: 'ignored generated/cache output' },
        { label: 'Context warning jobs', value: text(context.warningCount), detail: 'higher token/cost risk' }
      ]} />
    </section>
  </div>;
}

function MergeView({ dashboard, jobs, success, attention }: {
  dashboard: Dashboard;
  jobs: Array<Record<string, unknown>>;
  success: SuccessSummary;
  attention: AttentionSummary;
}): Node {
  const semantic = semanticMetrics(dashboard.semantic);
  const stages = [
    { id: 'workers', label: 'Worker outputs', value: jobs.length, tone: 'neutral' as ChartTone },
    { id: 'review', label: 'Coordinator review', value: attention.needsCoordinatorReviewCount, tone: attention.needsCoordinatorReviewCount ? 'warn' as ChartTone : 'neutral' as ChartTone },
    { id: 'ready', label: 'Ready', value: success.readyCount, tone: success.readyCount ? 'good' as ChartTone : 'neutral' as ChartTone },
    { id: 'applied', label: 'Applied', value: success.appliedCount, tone: success.appliedCount ? 'good' as ChartTone : 'neutral' as ChartTone },
    { id: 'blocked', label: 'Blocked', value: attention.failedCount + attention.staleCount, tone: attention.failedCount + attention.staleCount ? 'bad' as ChartTone : 'neutral' as ChartTone }
  ];
  return <div className="merge-layout" data-scroll-id="merge">
    <section className="merge-flow" aria-label="Semantic merge and patch flow">
      {stages.map((stage) => <article className={`merge-node ${stage.tone}`}>
        <span>{stage.label}</span>
        <b>{text(stage.value)}</b>
      </article>)}
    </section>
    <section className="work-section">
      <div className="metric-section-head">
        <h3>Semantic merge status</h3>
        <span>{formatNumber(semantic.total)} signals</span>
      </div>
      <SimpleRows rows={[
        { label: 'Auto-merge candidates', value: formatNumber(semantic.autoMerge), detail: 'semantic scripts that may be portable' },
        { label: 'Replay accepted clean', value: formatNumber(semantic.acceptedClean), detail: 'clean semantic replay outcomes' },
        { label: 'Replay conflicts', value: formatNumber(semantic.conflicts), detail: 'must be reviewed before merge' },
        { label: 'Expected imports satisfied', value: `${formatNumber(semantic.satisfied)}/${formatNumber(semantic.expected)}`, detail: 'semantic import coverage' }
      ]} />
    </section>
    <section className="work-section">
      <div className="metric-section-head">
        <h3>Patch/version tree</h3>
        <span>{text(jobs.length)} worker leaves</span>
      </div>
      <div className="version-tree">
        {jobs.slice(0, 18).map((job) => <article className={`version-leaf ${jobRisk(job)}`}>
          <b>{text(job.id)}</b>
          <small>{text(job.disposition ?? job.mergeReadiness ?? job.status)} · {pathSummaryText(job)}</small>
        </article>)}
      </div>
    </section>
  </div>;
}

function EvidenceView({ jobs, events, sourceEntries, dashboard }: {
  jobs: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  sourceEntries: Array<{ label: string; value: string }>;
  dashboard: Dashboard;
}): Node {
  return <div className="evidence-layout" data-scroll-id="evidence">
    <section className="work-section">
      <div className="metric-section-head"><h3>Jobs</h3><span>{text(jobs.length)} visible</span></div>
      <Jobs jobs={jobs} />
    </section>
    <section className="work-section">
      <div className="metric-section-head"><h3>Events</h3><span>{text(events.length)} visible</span></div>
      <Events events={events} />
    </section>
    <section className="work-section">
      <div className="metric-section-head"><h3>Sources</h3><span>{text(sourceEntries.length)} paths</span></div>
      <Sources entries={sourceEntries} />
    </section>
    <section className="work-section">
      <div className="metric-section-head"><h3>Run context</h3><span>readonly</span></div>
      <RunContext routing={dashboard.routing} backlog={dashboard.backlog} />
    </section>
  </div>;
}

function Overview({ dashboard, lanes, jobs, events, attention, audit, success }: {
  dashboard: Dashboard;
  lanes: LaneRollup[];
  jobs: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  attention: AttentionSummary;
  audit: AuditSummary;
  success: SuccessSummary;
}): Node {
  const health = dashboardHealthSummary(dashboard, jobs, attention);
  const telemetry = tokenTimeSummary(dashboard, jobs);
  const pressure = warningPressureSummary(attention, audit, health, telemetry);
  const progressCharts = progressChartSeries(dashboard, jobs, events).slice(0, 3);
  return <section className="overview-grid">
    <section className="overview-snapshot" data-smoke-marker="landed-health-summary" aria-label="Landed success, health, warning pressure, token, and time snapshot">
      {snapshotTile('Run health', health.status, `${formatPercent(health.completionRatio)} complete · ${text(health.failedJobCount + health.blockedJobCount)} failed/blocked`, health.tone)}
      {snapshotTile('Applied / landed', `${formatNumber(success.appliedCount)}/${formatNumber(success.applyTotalCount || success.appliedCount || success.landedCount)}`, `${formatNumber(success.landedCount)} landed · ${formatNumber(success.applyFailedCount)} ledger failed`, success.applyFailedCount ? 'bad' : success.appliedCount || success.landedCount ? 'good' : 'neutral')}
      {snapshotTile('Warning pressure', pressure.headline, pressure.detail, pressure.tone)}
      {snapshotTile('Token load', telemetry.tokenValue, telemetry.tokenDetail, telemetry.tokenTone)}
      {snapshotTile('Run time', telemetry.durationValue, telemetry.durationDetail, telemetry.timeTone)}
    </section>
    <Panel title="Run health" meta={`${text(jobs.length)} visible jobs`}>
      <div className="overview-card-scroll">
        <RunHealthSummary health={health} />
        <div className="overview-metrics">
          {compactMetric('Healthy', health.healthyJobCount)}
          {compactMetric('Warning', health.warningJobCount)}
          {compactMetric('Failed', health.failedJobCount)}
          {compactMetric('Terminal', health.terminalJobCount)}
          {compactMetric('Ready', health.readyToApplyJobCount)}
          {compactMetric('Semantic clean', health.semanticCleanJobCount)}
        </div>
        <MiniCharts series={progressCharts} compact />
      </div>
    </Panel>
    <Panel title="Warning pressure" meta={`${formatNumber(pressure.total)} signals`}>
      <div className="overview-card-scroll pressure-panel" data-smoke-marker="warning-pressure">
        <div className="pressure-grid">
          {pressureCell('Merge blockers', pressure.severe, pressure.severe ? 'failed, blocked, or source' : 'none')}
          {pressureCell('Budget warnings', pressure.budget, pressure.budget ? 'context load' : 'within budget')}
          {pressureCell('Timing gaps', telemetry.missingTimestampCount, telemetry.missingTimestampCount ? 'estimated spans' : 'current timestamps')}
        </div>
        <BarRows rows={pressure.rows} />
      </div>
    </Panel>
    <Panel title="Workspace audit" meta={`${text(audit.changedPathCount)} changed paths`}>
      <div className="overview-card-scroll">
        <div className="audit-list">
          {auditRow('Patch candidates', audit.changedPathCount)}
          {auditRow('Source violations', audit.sourceOwnershipViolationCount)}
          {auditRow('Generated noise', generatedNoiseCount(audit))}
          {auditRow('Quarantined paths', audit.quarantinedChangedPathCount)}
        </div>
        <ReasonClasses audit={audit} />
      </div>
    </Panel>
    <Panel title="Recent activity" meta={`${text(events.length)} visible events`}>
      <div className="overview-card-scroll">
        <Events events={events.slice(-10)} />
      </div>
    </Panel>
  </section>;
}

function snapshotTile(label: string, value: string, detail: string, tone: ChartTone): Node {
  return <article className={`snapshot-tile ${tone}`}>
    <span>{label}</span>
    <b>{value}</b>
    <small>{detail}</small>
  </article>;
}

function Success({ dashboard, jobs, success }: {
  dashboard: Dashboard;
  jobs: Array<Record<string, unknown>>;
  success: SuccessSummary;
}): Node {
  const completedJobs = jobs.filter(isCompletedJob);
  const readyJobs = jobs.filter(isReadyJob);
  const cleanJobs = jobs.filter((job) => sourceOwnershipViolations(job).length === 0 && numberValue(job.quarantinedChangedPathCount) === 0);
  const semanticRows = semanticSuccessRows(dashboard.semantic);
  return <div className="success-layout" data-scroll-id="success">
    <section className="success-summary" data-smoke-marker="success-summary">
      {successKpi('Completed jobs', success.completedCount, `${text(completedJobs.length)} visible`)}
      {successKpi('Ready patches', success.readyCount, 'direct apply candidates')}
      {successKpi('Applied patches', success.appliedCount, `${text(success.applyTotalCount)} ledger total`)}
      {successKpi('Landed patches', success.landedCount, 'apply ledger entries')}
      {successKpi('Source-clean jobs', success.cleanSourceCount, 'no source ownership flags')}
      {successKpi('Evidence complete', success.evidenceCompleteCount, 'jobs with artifacts')}
      {successKpi('Replay clean', success.semanticAcceptedClean, 'semantic replay accepted')}
      {successKpi('Already applied', success.semanticAlreadyApplied, 'semantic edits recognized')}
    </section>
    <section className="success-section">
      <div className="metric-section-head">
        <h3>Successful worker output</h3>
        <span>{text(completedJobs.length)} visible completed jobs</span>
      </div>
      <SuccessRows jobs={completedJobs.slice(0, 24)} />
    </section>
    <section className="success-section">
      <div className="metric-section-head">
        <h3>Ready or clean signals</h3>
        <span>{text(readyJobs.length)} ready · {text(cleanJobs.length)} source-clean</span>
      </div>
      <BarRows rows={[
        { label: 'Completed', value: success.completedCount, tone: 'good' },
        { label: 'Ready patches', value: success.readyCount, tone: success.readyCount ? 'good' : 'neutral' },
        { label: 'Applied patches', value: success.appliedCount, tone: success.applyFailedCount ? 'bad' : success.appliedCount ? 'good' : 'neutral' },
        { label: 'Landed patches', value: success.landedCount, tone: success.landedCount ? 'good' : 'neutral' },
        { label: 'Source-clean', value: success.cleanSourceCount, tone: 'good' },
        { label: 'Evidence complete', value: success.evidenceCompleteCount, tone: 'good' }
      ]} />
    </section>
    {semanticRows.length ? <section className="success-section wide">
      <div className="metric-section-head">
        <h3>Semantic success</h3>
        <span>{text(success.semanticAcceptedClean + success.semanticAlreadyApplied)} accepted/applied</span>
      </div>
      <BarRows rows={semanticRows} />
    </section> : null}
  </div>;
}

function successKpi(label: string, value: unknown, detail: string): Node {
  return <div className="success-kpi">
    <span>{label}</span>
    <b>{text(value)}</b>
    <small>{detail}</small>
  </div>;
}

function SuccessRows({ jobs }: { jobs: Array<Record<string, unknown>> }): Node {
  if (!jobs.length) return <p className="empty tight">No completed jobs in this run.</p>;
  return <div className="success-list">
    {jobs.map((job) => <article className="success-row">
      <span className="mono">{text(job.id)}</span>
      <b>{text(job.disposition ?? job.mergeReadiness ?? job.status)}</b>
      <small>{text(laneOf(job))} · {text(job.evidencePathCount)} evidence · {pathSummaryText(job)}</small>
    </article>)}
  </div>;
}

function Jobs({ jobs }: { jobs: Array<Record<string, unknown>> }): Node {
  if (!jobs.length) return <div className="table-scroll jobs-scroll" data-scroll-id="jobs">
    <p className="empty">No jobs are available for this run.</p>
  </div>;
  return <div className="table-scroll jobs-scroll" data-scroll-id="jobs">
    <table className="jobs-table">
      <thead>
        <tr>
          <th className="nowrap">Risk</th>
          <th>Job / task</th>
          <th className="nowrap">Lane</th>
          <th className="nowrap">Status</th>
          <th>Bucket / disposition</th>
          <th>Paths</th>
          <th className="nowrap">Evidence</th>
          <th>Reasons</th>
        </tr>
      </thead>
      <tbody>
        {jobs.slice(0, 160).map((job) => <tr className={`risk-${jobRisk(job)}`}>
          <td><span className={`risk-pill ${jobRisk(job)}`}>{jobRiskLabel(job)}</span></td>
          <td>
            <span className="mono strong">{text(job.id)}</span>
            <small>{text(job.taskId ?? job.title)}</small>
          </td>
          <td className="lane-cell" title={text(job.lane)}>{text(job.lane)}</td>
          <td className="nowrap">{text(job.status)}</td>
          <td>
            <span>{text(job.bucket)}</span>
            <small>{text(job.disposition ?? job.mergeReadiness)}</small>
          </td>
          <td>{pathSummary(job)}</td>
          <td className="numeric">{text(job.evidencePathCount)}</td>
          <td>{jobReasonText(job)}</td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}

function statCell(label: string, value: string): Node {
  return <div className="stat-cell">
    <span>{label}</span>
    <b>{value}</b>
  </div>;
}

function ContextPressure({ jobs }: { jobs: Array<Record<string, unknown>> }): Node {
  const summary = contextPressureSummary(jobs);
  const offenders = contextOffenderRows(jobs);
  return <div className="context-pressure" data-smoke-marker="context-pressure">
    <div className="stat-grid">
      {statCell('Budget warnings', formatNumber(summary.warningCount))}
      {statCell('Uncached input', summary.uncachedInputTokens ? formatNumber(summary.uncachedInputTokens) : '-')}
      {statCell('Uncached / estimated', summary.uncachedRatio ? formatRatio(summary.uncachedRatio) : '-')}
    </div>
    <BarRows rows={[
      { label: 'Uncached input', value: summary.uncachedInputTokens, detail: formatNumber(summary.uncachedInputTokens), tone: summary.warningCount || summary.failedCount ? 'warn' : 'neutral' },
      { label: 'Cached input', value: summary.cachedInputTokens, detail: formatNumber(summary.cachedInputTokens) },
      { label: 'Actual total', value: summary.actualInputTokens, detail: formatNumber(summary.actualInputTokens) },
      { label: 'Estimated tokens', value: summary.estimatedInputTokens, detail: formatNumber(summary.estimatedInputTokens) },
      { label: 'P95 uncached', value: summary.p95UncachedInputTokens, detail: formatNumber(summary.p95UncachedInputTokens), tone: summary.p95UncachedInputTokens > summary.estimatedInputTokens / Math.max(1, jobs.length) ? 'warn' : 'neutral' }
    ]} />
    <div className="context-offender-list" aria-label="Top context offenders">
      {offenders.length ? offenders.map((job) => <article className="context-offender-row">
        <span className="mono">{text(job.id)}</span>
        <b>{formatNumber(job.uncachedInputTokens || job.actualInputTokens || job.estimatedInputTokens)}</b>
        <small>{text(job.lane)} · {job.statusLabel}</small>
      </article>) : <p className="empty tight">No context pressure reported for visible jobs.</p>}
    </div>
  </div>;
}

function MiniCharts({ series, compact = false }: { series: ChartSeries[]; compact?: boolean }): Node {
  if (!series.length) return <p className="empty tight">No chart data.</p>;
  return <div className={compact ? 'chart-grid compact' : 'chart-grid'}>
    {series.map((entry) => <article className={`chart-card ${entry.tone ?? 'neutral'}`} data-chart-id={entry.id}>
      <div className="chart-card-head">
        <span>{entry.title}</span>
        <b>{entry.value}</b>
      </div>
      <Sparkline points={entry.points} tone={entry.tone ?? 'neutral'} label={`${entry.title}: ${entry.value}`} />
      {compact ? null : <small>{chartDetailLabel(entry)}</small>}
    </article>)}
  </div>;
}

function chartDetailLabel(entry: ChartSeries): string {
  const axis = entry.xLabel || entry.yLabel
    ? `Y: ${entry.yLabel ?? 'value'} · X: ${entry.xLabel ?? 'series'}`
    : '';
  return axis ? `${axis} · ${entry.detail}` : entry.detail;
}

function RunHealthSummary({ health }: { health: ReturnType<typeof dashboardHealthSummary> }): Node {
  return <div className="health-summary" data-smoke-marker="health-summary">
    <article className={`health-card ${health.tone}`}>
      <span>Run status</span>
      <b>{health.status}</b>
      <small>{formatPercent(health.completionRatio)} complete · {formatPercent(health.failureRatio)} failed/blocked</small>
    </article>
    <article className={health.warningJobCount ? 'health-card warn' : 'health-card good'}>
      <span>Warnings</span>
      <b>{text(health.warningJobCount)}</b>
      <small>{text(health.contextWarningJobCount)} context · {text(health.semanticCandidateJobCount)} semantic candidates</small>
    </article>
    <article className={health.failedJobCount || health.blockedJobCount ? 'health-card bad' : 'health-card good'}>
      <span>Success</span>
      <b>{text(health.healthyJobCount)}</b>
      <small>{text(health.readyToApplyJobCount)} ready · {text(health.semanticCleanJobCount)} semantic clean</small>
    </article>
  </div>;
}

function Sparkline({ points, tone, label }: { points: ChartPoint[]; tone: ChartTone; label: string }): Node {
  const visible = points.length ? points : [{ label: 'No data', value: 0 }];
  const max = Math.max(1, ...visible.map((point) => point.value));
  return <div className={`sparkline aligned-chart ${tone}`} role="img" aria-label={label} data-chart-points={text(visible.length)}>
    <div className="spark-bars">
      {visible.map((point) => <span
        className={`spark-bar ${point.tone ?? tone}`}
        data-chart-tooltip={`${point.label}\n${point.detail ?? formatNumber(point.value)}`}
        title={`${point.label}: ${point.detail ?? formatNumber(point.value)}`}
        style={`height:${point.value ? Math.max(8, Math.round((point.value / max) * 100)) : 3}%`}
      />)}
    </div>
  </div>;
}

function BarRows({ rows }: { rows: Array<{ label: string; value: number; detail?: string; tone?: ChartTone }> }): Node {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return <div className="metric-bars">
    {rows.map((row) => <div className="metric-bar-row">
      <span className="metric-bar-label">{row.label}</span>
      <span className="metric-bar-track"><span className={`metric-bar-fill ${row.tone ?? 'neutral'}`} style={`width:${row.value ? Math.max(3, Math.round((row.value / max) * 100)) : 0}%`} /></span>
      <span className="metric-bar-value">{row.detail ?? formatNumber(row.value)}</span>
    </div>)}
  </div>;
}

function Quality({ jobs, attention, audit }: {
  jobs: Array<Record<string, unknown>>;
  attention: AttentionSummary;
  audit: AuditSummary;
}): Node {
  const sourceOwnershipCount = audit.sourceOwnershipViolationCount;
  const ignoredCount = generatedNoiseCount(audit);
  const quarantinedCount = audit.quarantinedChangedPathCount;
  const blockerCount = attention.failedCount + attention.needsCoordinatorReviewCount + attention.staleCount + sourceOwnershipCount;
  const noiseCount = ignoredCount + quarantinedCount;
  return <div className="quality-layout" data-smoke-marker="quality-signal-panel" data-scroll-id="quality">
    <section className="quality-summary" data-smoke-marker="quality-summary">
      {qualityKpi('Admission blockers', blockerCount, blockerCount ? 'Review before merge' : 'Clear')}
      {qualityKpi('Generated workspace noise', noiseCount, noiseCount ? 'Separated from source' : 'None')}
      {qualityKpi('Visible jobs', jobs.length, 'Current lane filter')}
    </section>
    <section className="quality-group blocker" data-smoke-marker="quality-real-blockers">
      <div className="quality-group-head">
        <h3>Real blockers</h3>
        <span>{text(blockerCount)} signals</span>
      </div>
      <div className="quality-signal-list">
        {qualitySignal('Failed jobs', attention.failedCount, 'Blocks admission', 'Worker failed, evidence failed, or merge readiness failed.', 'failed-jobs')}
        {qualitySignal('Coordinator review', attention.needsCoordinatorReviewCount, 'Coordinator decision', 'Patch needs review or cannot be applied directly.', 'needs-coordinator')}
        {qualitySignal('Stale', attention.staleCount, 'Rerun or rebase', 'Output was collected against an older source state.', 'stale')}
        {qualitySignal('Source violations', sourceOwnershipCount, 'Out of scope source', 'Changed source paths are outside the job ownership boundary.', 'source-ownership')}
      </div>
    </section>
    <section className="quality-group noise" data-smoke-marker="quality-generated-noise">
      <div className="quality-group-head">
        <h3>Generated workspace noise</h3>
        <span>{text(noiseCount)} separated paths</span>
      </div>
      <div className="quality-signal-list compact">
        {qualitySignal('Ignored', ignoredCount, 'Not a source blocker', 'Build, cache, dist, and dependency paths stay out of patch candidates.', 'ignored')}
        {qualitySignal('Quarantined', quarantinedCount, 'Held back', 'Disallowed generated changes were separated from source patch review.', 'quarantined')}
      </div>
    </section>
  </div>;
}

function qualityKpi(label: string, value: unknown, detail: string): Node {
  return <div className="quality-kpi">
    <span>{label}</span>
    <b>{text(value)}</b>
    <small>{detail}</small>
  </div>;
}

function qualitySignal(label: string, value: number, status: string, description: string, marker: string): Node {
  return <article className={value ? 'quality-signal active' : 'quality-signal'} data-smoke-marker={`quality-signal-${marker}`}>
    <div>
      <b>{label}</b>
      <p>{description}</p>
    </div>
    <span className="quality-signal-count">{text(value)}</span>
    <span className="quality-signal-status">{value ? status : 'Clear'}</span>
  </article>;
}

function Timeline({ dashboard, jobs, events, audit }: {
  dashboard: Dashboard;
  jobs: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  audit: AuditSummary;
}): Node {
  const summary = timelineSummary(dashboard, jobs, events);
  const contribution = contributionGrid(dashboard, jobs, events);
  const bottlenecks = timelineBottlenecks(jobs, audit);
  const aria = `${text(summary.progressPercent)} percent terminal progress, ${text(summary.runningJobs)} running jobs, ${text(summary.attentionJobs)} attention jobs`;
  return <div className="timeline-layout" data-scroll-id="timeline">
    <section className="timeline-section wide contribution-section">
      <div className="metric-section-head">
        <h3>Progress by day</h3>
        <span>{text(contribution.activeDays)} active days · {text(contribution.totalDone)} done signals</span>
      </div>
      <ContributionGraph grid={contribution} />
    </section>

    <section className="timeline-section">
      <div className="metric-section-head">
        <h3>Run progress</h3>
        <span>{text(summary.terminalJobs)} / {text(summary.totalJobs)} terminal</span>
      </div>
      <div className="timeline-progress-row">
        <div className="timeline-progress-copy">
          <b>{text(summary.progressPercent)}%</b>
          <span>{text(summary.runningJobs)} running · {text(summary.attentionJobs)} attention</span>
        </div>
        <div className="timeline-progress-track" role="img" aria-label={aria}>
          <span className="timeline-progress-fill" style={`width:${summary.progressPercent}%`} />
        </div>
      </div>
      <TimelineNote summary={summary} />
      <TimeSeriesSummary dashboard={dashboard} />
    </section>

    <section className="timeline-section">
      <div className="metric-section-head">
        <h3>Event series</h3>
        <span>{summary.points.length ? `${formatTime(summary.firstAt)} to ${formatTime(summary.lastAt)}` : 'no timestamps'}</span>
      </div>
      <TimelineSeries summary={summary} />
    </section>

    <section className="timeline-section">
      <div className="metric-section-head">
        <h3>Bottlenecks</h3>
        <span>{text(bottlenecks.reduce((sum, row) => sum + row.value, 0))} signals</span>
      </div>
      <BottleneckStrip rows={bottlenecks} />
    </section>

    <section className="timeline-section wide">
      <div className="metric-section-head">
        <h3>Recent timeline</h3>
        <span>{text(summary.points.length)} timestamped events</span>
      </div>
      <TimelineEventList points={summary.points} />
    </section>
  </div>;
}

function ContributionGraph({ grid, prominent = false }: { grid: ContributionGrid; prominent?: boolean }): Node {
  const weekTemplate = `repeat(${grid.weeks.length}, var(--contribution-cell))`;
  return <div className={prominent ? 'contribution-card prominent' : 'contribution-card'} data-smoke-marker="progress-by-day">
    <div className="contribution-summary">
      {statCell('Calendar year', String(grid.year))}
      {statCell('Done signals', formatNumber(grid.totalDone))}
      {statCell('Active days', formatNumber(grid.activeDays))}
      {statCell('Peak day', formatNumber(grid.maxCount))}
    </div>
    <div className="contribution-scroll" data-contribution-grid="true" role="img" aria-label={`Daily progress activity across calendar year ${text(grid.year)}, January through December`}>
      <div className="contribution-months" style={`grid-template-columns:${weekTemplate}`}>
        {grid.weeks.map((week, index) => <span>{contributionMonthLabel(week, index, grid.weeks)}</span>)}
      </div>
      <div className="contribution-body">
        <div className="contribution-weekdays" aria-hidden="true">
          <span />
          <span>Mon</span>
          <span />
          <span>Wed</span>
          <span />
          <span>Fri</span>
          <span />
        </div>
        <div className="contribution-weeks" style={`grid-template-columns:${weekTemplate}`}>
          {grid.weeks.map((week) => <div className="contribution-week">
            {week.map((day) => day.inYear
              ? <span
                className={`contribution-day level-${day.level}`}
                data-contribution-tooltip={contributionTooltip(day)}
                aria-label={`${day.label}: ${formatNumber(day.count)} total activity`}
              />
              : <span className="contribution-day empty" aria-hidden="true" />)}
          </div>)}
        </div>
      </div>
      <div className="contribution-legend" aria-hidden="true">
        <span>Less</span>
        <i className="contribution-day level-0" />
        <i className="contribution-day level-1" />
        <i className="contribution-day level-2" />
        <i className="contribution-day level-3" />
        <i className="contribution-day level-4" />
        <span>More</span>
      </div>
    </div>
  </div>;
}

function contributionTooltip(day: ContributionDay): string {
  return `${day.label}\n${formatNumber(day.count)} total activity\n${formatNumber(day.completed)} done signals · ${formatNumber(day.events)} events`;
}

function TimelineNote({ summary }: { summary: TimelineSummary }): Node {
  if (summary.exactTimingAvailable && !summary.eventWindowLimited) return <p className="timeline-note">Exact job spans are available for this dashboard snapshot.</p>;
  const note = summary.points.length
    ? 'Exact job spans are unavailable. Showing the recent event window plus current job states.'
    : 'No timestamped events are available for this run. Showing current job progress only.';
  return <p className="timeline-note">{note}</p>;
}

function TimeSeriesSummary({ dashboard }: { dashboard: Dashboard }): Node {
  const summary = recordValue(dashboard.timeSeries?.summary);
  const pointCount = numberValue(summary.pointCount);
  if (!pointCount) return <p className="empty tight">No bucketed time-series metrics in this snapshot.</p>;
  return <div className="time-series-summary" data-smoke-marker="time-series-summary">
    {statCell('Buckets', formatNumber(pointCount))}
    {statCell('Terminal jobs', formatNumber(numberValue(summary.terminalJobCount)))}
    {statCell('Warnings', formatNumber(numberValue(summary.warningJobCount)))}
    {statCell('Missing time', formatNumber(numberValue(summary.missingTimestampJobCount)))}
  </div>;
}

function TimelineSeries({ summary }: { summary: TimelineSummary }): Node {
  if (!summary.points.length) return <p className="empty tight">No timestamped events for this run.</p>;
  return <div
    className="timeline-series"
    role="img"
    aria-label={`Event timeline from ${formatTime(summary.firstAt)} to ${formatTime(summary.lastAt)}`}
  >
    <div className="timeline-series-track">
      {summary.points.slice(-48).map((point) => <span
        className={`timeline-point ${timelinePointTone(point)}`}
        style={`left:${timelinePointLeft(point, summary)}%`}
        title={`${formatTime(point.at)} ${point.type} ${point.jobId}`}
      />)}
    </div>
    <div className="timeline-axis" aria-hidden="true">
      <span>{formatTime(summary.firstAt)}</span>
      <span>{formatTime(summary.lastAt)}</span>
    </div>
  </div>;
}

function BottleneckStrip({ rows }: { rows: TimelineBottleneck[] }): Node {
  const active = rows.filter((row) => row.value > 0);
  if (!active.length) return <p className="empty tight">No current bottlenecks in this run.</p>;
  return <div className="bottleneck-list">
    {active.map((row) => <div className={`bottleneck-row ${row.tone}`}>
      <span>{row.label}</span>
      <b>{text(row.value)}</b>
      <small>{row.detail}</small>
    </div>)}
  </div>;
}

function TimelineEventList({ points }: { points: TimelinePoint[] }): Node {
  if (!points.length) return <p className="empty tight">No recent event rows to show.</p>;
  return <div className="timeline-events" role="list">
    {points.slice(-24).reverse().map((point) => <article className={`timeline-event ${timelinePointTone(point)}`} role="listitem">
      <time dateTime={new Date(point.at).toISOString()}>{formatTime(point.at)}</time>
      <div>
        <b>{point.type}</b>
        <span>{point.message}</span>
      </div>
      <small>{point.lane} · {point.jobId} · {text(point.progressPercent)}%</small>
    </article>)}
  </div>;
}

function Events({ events }: { events: Array<Record<string, unknown>> }): Node {
  if (!events.length) return <p className="empty">No recent events for this run.</p>;
  return <div className="table-scroll compact" data-scroll-id="events">
    <table className="events-table">
      <thead><tr><th>Time</th><th>Event</th><th>Lane</th><th>Job</th><th>Message</th></tr></thead>
      <tbody>
        {events.slice(-36).reverse().map((event) => <tr>
          <td>{formatTime(event.at)}</td>
          <td>{text(event.type)}</td>
          <td>{text(event.lane)}</td>
          <td className="mono">{text(event.jobId)}</td>
          <td>{text(event.message)}</td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}

function Sources({ entries }: { entries: Array<{ label: string; value: string }> }): Node {
  if (!entries.length) return <p className="empty">No source paths were reported by the dashboard snapshot.</p>;
  return <div className="table-scroll compact" data-scroll-id="sources">
    <table className="sources-table">
      <tbody>
        {entries.map((entry) => <tr>
          <th>{entry.label}</th>
          <td className="mono">{entry.value}</td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}

function RunContext({ routing, backlog }: { routing?: Record<string, unknown>; backlog?: Record<string, unknown> }): Node {
  return <div className="context-grid">
    <dl className="kv">
      <dt>Policy</dt><dd>{text(routing?.policyId)}</dd>
      <dt>Mode</dt><dd>{text(routing?.defaultMode)}</dd>
      <dt>Prefer / avoid</dt><dd>{text(routing?.preferCount)} / {text(routing?.avoidCount)}</dd>
      <dt>Feedback</dt><dd>{text(routing?.preferenceCount)}</dd>
    </dl>
    <dl className="kv">
      <dt>Backlog</dt><dd>{text(backlog?.id)}</dd>
      <dt>Entries</dt><dd>{text(backlog?.entryCount)}</dd>
      <dt>Ready</dt><dd>{text(backlog?.readyCount)}</dd>
      <dt>Children</dt><dd>{text(Array.isArray(backlog?.childBacklogPaths) ? backlog?.childBacklogPaths.length : undefined)}</dd>
    </dl>
  </div>;
}

type AuditSummary = {
  changedPathCount: number;
  ownershipViolationCount: number;
  sourceOwnershipViolationCount: number;
  ignoredOwnershipViolationCount: number;
  ignoredChangedPathCount: number;
  quarantinedChangedPathCount: number;
  reasonCounts: Array<{ reason: string; count: number }>;
};

function auditSummary(dashboard: Dashboard, jobs: Array<Record<string, unknown>>): AuditSummary {
  const summary = dashboard.summary ?? {};
  const changedPathCount = numberValue(summary.changedPathCount)
    || jobs.reduce((sum, job) => sum + numberValue(job.changedPathCount), 0);
  const ownershipViolationCount = numberValue(summary.ownershipViolationCount)
    || jobs.reduce((sum, job) => sum + numberValue(job.ownershipViolationCount), 0);
  const sourceOwnershipViolationCount = numberValue(summary.sourceOwnershipViolationCount)
    || jobs.reduce((sum, job) => sum + sourceOwnershipViolations(job).length, 0);
  const ignoredOwnershipViolationCount = numberValue(summary.ignoredOwnershipViolationCount)
    || jobs.reduce((sum, job) => sum + ignoredOwnershipViolations(job).length, 0);
  const ignoredChangedPathCount = numberValue(summary.ignoredChangedPathCount)
    || jobs.reduce((sum, job) => sum + numberValue(job.ignoredChangedPathCount), 0);
  const quarantinedChangedPathCount = numberValue(summary.quarantinedChangedPathCount)
    || jobs.reduce((sum, job) => sum + numberValue(job.quarantinedChangedPathCount), 0);
  const reasonMap = new Map<string, number>();
  for (const job of jobs) {
    for (const reason of stringArray(job.collectReasonClasses)) {
      reasonMap.set(reason, (reasonMap.get(reason) ?? 0) + 1);
    }
  }
  return {
    changedPathCount,
    ownershipViolationCount,
    sourceOwnershipViolationCount,
    ignoredOwnershipViolationCount,
    ignoredChangedPathCount,
    quarantinedChangedPathCount,
    reasonCounts: Array.from(reasonMap.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason))
      .slice(0, 8)
  };
}

function metric(label: string, value: unknown, tone: ChartTone, detail?: string): Node {
  return <article className={`metric ${tone}`}>
    <span>{label}</span>
    <b>{text(value)}</b>
    {detail ? <small>{detail}</small> : null}
  </article>;
}

function compactMetric(label: string, value: unknown): Node {
  return <div className="compact-metric"><span>{label}</span><b>{text(value)}</b></div>;
}

function auditRow(label: string, value: unknown): Node {
  return <div className="audit-row"><span>{label}</span><b>{text(value)}</b></div>;
}

function pressureCell(label: string, value: unknown, detail: string): Node {
  return <div className="pressure-card"><span>{label}</span><b>{text(value)}</b><small>{detail}</small></div>;
}

function generatedNoiseCount(audit: AuditSummary): number {
  return audit.ignoredOwnershipViolationCount + audit.ignoredChangedPathCount;
}

function ReasonClasses({ audit }: { audit: AuditSummary }): Node {
  if (!audit.reasonCounts.length) return <p className="empty tight">No collect reason classes.</p>;
  return <div className="reason-list">
    {audit.reasonCounts.map((entry) => <div className="reason-row">
      <span>{entry.reason}</span>
      <b>{text(entry.count)}</b>
    </div>)}
  </div>;
}

function SimpleRows({ rows }: { rows: Array<{ label: string; value: string; detail: string }> }): Node {
  if (!rows.length) return <p className="empty tight">No rows for this run.</p>;
  return <div className="simple-rows">
    {rows.map((row) => <article className="simple-row">
      <div>
        <b>{row.label}</b>
        <small>{row.detail}</small>
      </div>
      <span>{row.value}</span>
    </article>)}
  </div>;
}

function humanActionRows(jobs: Array<Record<string, unknown>>, audit: AuditSummary, dashboard?: Dashboard): HumanActionRow[] {
  void audit;
  return snapshotHumanActionRows(dashboard, jobs);
}

function snapshotHumanActionRows(dashboard: Dashboard | undefined, jobs: Array<Record<string, unknown>>): HumanActionRow[] {
  if (!dashboard || !Array.isArray(dashboard.humanActions)) return [];
  const visibleJobIds = new Set(jobs.map((job) => textValue(job.id ?? job.taskId, '')).filter(Boolean));
  const answeredCodes = answeredHumanActionCodes(dashboard);
  const rows = dashboard.humanActions
    .map(snapshotHumanActionRow)
    .filter((row): row is HumanActionRow => Boolean(row))
    .filter(isExplicitAgentQuestion)
    .filter(isOpenHumanActionRow)
    .filter((row) => !answeredCodes.has(row.code))
    .filter((row) => !row.jobId || visibleJobIds.has(row.jobId));
  return dedupeHumanActionRows(rows)
    .sort((left, right) => priorityRank(left.priority) - priorityRank(right.priority) || left.code.localeCompare(right.code));
}

function answeredHumanActionCodes(dashboard: Dashboard): Set<string> {
  return new Set(
    Array.isArray(dashboard.humanActionAnswers)
      ? dashboard.humanActionAnswers.map((answer) => textValue(answer.code, '')).filter(Boolean)
      : []
  );
}

function pruneResolvedHumanActionDrafts(dashboard: Dashboard): void {
  const openCodes = new Set(snapshotHumanActionRows(dashboard, dashboard.jobs).map((row) => row.code));
  for (const code of humanAnswerDrafts.keys()) if (!openCodes.has(code)) humanAnswerDrafts.delete(code);
  for (const code of humanAnswerStates.keys()) if (!openCodes.has(code)) humanAnswerStates.delete(code);
}

function snapshotHumanActionRow(value: Record<string, unknown>): HumanActionRow | undefined {
  const code = textValue(value.code, '');
  if (!code) return undefined;
  const type = normalizeHumanActionType(textValue(value.type, 'concern'));
  const priority = normalizeHumanActionPriority(textValue(value.priority, 'info'));
  const title = textValue(value.title, code);
  const question = textValue(value.question ?? value.prompt ?? value.detail ?? value.text, title);
  const detail = textValue(value.detail ?? value.context ?? value.text, question);
  return {
    id: textValue(value.id, code),
    code,
    status: textValue(value.status, 'open'),
    priority,
    type,
    title,
    question,
    scope: textValue(value.scope ?? value.lane, 'workspace'),
    detail,
    why: textValue(value.why ?? value.reason, ''),
    requestedAnswer: textValue(value.requestedAnswer ?? value.answerFormat ?? value.expectedAnswer, ''),
    defaultAction: textValue(value.defaultAction, 'Answer in Codex so the coordinator can resolve the item.'),
    askedBy: textValue(value.askedBy ?? value.agentId ?? value.jobId, ''),
    source: textValue(value.source, 'dashboard'),
    jobId: textValue(value.jobId, ''),
    lane: textValue(value.lane, ''),
    options: humanActionOptions(value.options)
  };
}

function humanActionOptions(value: unknown): HumanActionRow['options'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === 'string') return [{ label: entry }];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const option = entry as Record<string, unknown>;
    const label = textValue(option.label ?? option.title ?? option.value, '');
    if (!label) return [];
    const detail = textValue(option.detail ?? option.description ?? option.impact, '');
    return [{ label, ...(detail ? { detail } : {}) }];
  }).slice(0, 6);
}

function normalizeHumanActionType(value: string): HumanActionRow['type'] {
  if (value === 'question' || value === 'concern' || value === 'review' || value === 'approval') return value;
  return 'concern';
}

function isExplicitAgentQuestion(row: HumanActionRow): boolean {
  return row.type === 'question' && Boolean(row.question.trim());
}

function normalizeHumanActionPriority(value: string): HumanActionRow['priority'] {
  if (value === 'blocking' || value === 'important' || value === 'info') return value;
  return 'info';
}

function isOpenHumanActionRow(row: HumanActionRow): boolean {
  const status = (row.status ?? 'open').toLowerCase();
  return !['answered', 'resolved', 'dismissed', 'cancelled', 'canceled', 'closed'].includes(status);
}

function dedupeHumanActionRows(rows: HumanActionRow[]): HumanActionRow[] {
  const out = new Map<string, HumanActionRow>();
  for (const row of rows) if (!out.has(row.code)) out.set(row.code, row);
  return Array.from(out.values()).slice(0, 60);
}

function priorityRank(priority: HumanActionRow['priority']): number {
  if (priority === 'blocking') return 0;
  if (priority === 'important') return 1;
  return 2;
}

function successLikeJobCount(jobs: Array<Record<string, unknown>>): number {
  return jobs.filter((job) => isCompletedJob(job) && !isFailedJob(job) && !isStaleJob(job)).length;
}

function resolvedWorkJobCount(jobs: Array<Record<string, unknown>>): number {
  return jobs.filter((job) => isResolvedCoordinatorReviewJob(job) || (isCompletedJob(job) && !isFailedJob(job) && !isStaleJob(job))).length;
}

function laneLoadTone(lane: LaneRollup): ChartTone {
  if (lane.failedCount || lane.blockedCount) return 'bad';
  if (lane.staleCount || lane.needsCoordinatorReviewCount) return 'warn';
  if (lane.completedCount && lane.completedCount === lane.jobCount) return 'good';
  return 'neutral';
}

function captureScrollPositions(): void {
  root?.querySelectorAll<HTMLElement>('[data-scroll-id]').forEach((element) => {
    const id = element.dataset.scrollId;
    if (!id) return;
    scrollPositions.set(id, { left: element.scrollLeft, top: element.scrollTop });
  });
}

function restoreScrollPositions(): void {
  window.requestAnimationFrame(() => {
    root?.querySelectorAll<HTMLElement>('[data-scroll-id]').forEach((element) => {
      const id = element.dataset.scrollId;
      const position = id ? scrollPositions.get(id) : undefined;
      if (!position) return;
      element.scrollLeft = position.left;
      element.scrollTop = position.top;
    });
    if (pendingFocusTab) {
      const focusTab = pendingFocusTab;
      pendingFocusTab = undefined;
      contentTabButtons().find((tab) => tab.dataset.contentTab === focusTab)?.focus();
    }
  });
}

function selectContentTab(tab: ContentTab): void {
  selectedTab = tab;
  writeRouteState();
  if (currentDashboard) renderDashboard(currentDashboard);
}

function openTaskCard(id: string | undefined): void {
  if (!id) return;
  if (selectedTaskCardId !== id) scrollPositions.delete(taskDialogScrollId(id));
  selectedTaskCardId = id;
  selectedTicketId = undefined;
  if (!currentDashboard) return;
  const item = taskBoardItems(currentDashboard, currentDashboard.jobs).find((job) => taskCardId(job) === id);
  if (item) selectedTicketId = ticketId(item);
  writeRouteState();
  if (item) void fetchTaskDetails(item);
  renderDashboard(currentDashboard);
}

function taskDialogScrollId(id: string): string {
  return `task-dialog-${id}`;
}

function captureTaskFileDiffOpenStates(): void {
  root?.querySelectorAll<HTMLDetailsElement>('details[data-task-file-diff-key]').forEach((entry) => {
    setTaskFileDiffOpenState(entry);
  });
}

function taskFileDiffKeys(job: TaskBoardItem, file: TaskFileDiff): string[] {
  const filePath = textValue(file.path, '');
  if (!filePath) return [];
  return uniqueStrings([
    taskCardId(job),
    textValue(job.originalJobId, ''),
    textValue(job.jobId, ''),
    textValue(job.taskId, ''),
    textValue(job.workerId, ''),
    textValue(job.agentId, ''),
    ticketId(job)
  ].filter(Boolean)).map((id) => `${id}::${filePath}`);
}

function isTaskFileDiffOpen(job: TaskBoardItem, file: TaskFileDiff): boolean {
  return taskFileDiffKeys(job, file).some((key) => taskFileDiffOpenStates.get(key));
}

function taskFileDiffElementKeys(entry: HTMLDetailsElement): string[] {
  const keys = textValue(entry.dataset.taskFileDiffKeys, '').split('\t').filter(Boolean);
  const primary = textValue(entry.dataset.taskFileDiffKey, '');
  return uniqueStrings([...keys, primary].filter(Boolean));
}

function setTaskFileDiffOpenState(entry: HTMLDetailsElement): void {
  for (const key of taskFileDiffElementKeys(entry)) taskFileDiffOpenStates.set(key, entry.open);
}

async function fetchTaskDetails(job: TaskBoardItem): Promise<void> {
  const id = taskCardId(job);
  if (!id || taskDetailsCache.has(id) || taskDetailsPending.has(id)) return;
  if (job.boardKind === 'backlog') {
    taskDetailsCache.set(id, { ok: true, jobId: id, files: [], commandsPassed: [], commandsFailed: [], evidenceArtifacts: [] });
    return;
  }
  taskDetailsPending.add(id);
  try {
    const params = new URLSearchParams({ id });
    const sourceRun = textValue(job.sourceRun, '');
    if (sourceRun) params.set('sourceRun', sourceRun);
    const response = await fetch(`/api/task-details?${params}`);
    const details = await response.json() as TaskDetails;
    taskDetailsCache.set(id, details);
  } catch (error) {
    taskDetailsCache.set(id, {
      ok: false,
      jobId: id,
      files: [],
      commandsPassed: [],
      commandsFailed: [],
      evidenceArtifacts: [],
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    taskDetailsPending.delete(id);
    if (selectedTaskCardId === id && currentDashboard) renderDashboard(currentDashboard);
  }
}

async function revealArtifactInFinder(pathValue: string): Promise<void> {
  try {
    const response = await fetch('/api/artifact/reveal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: pathValue })
    });
    const result = await response.json() as { ok?: boolean; error?: string };
    if (!response.ok || !result.ok) console.warn('Unable to reveal artifact in Finder:', result.error ?? response.statusText);
  } catch (error) {
    console.warn('Unable to reveal artifact in Finder:', error);
  }
}

async function submitHumanActionAnswer(form: HTMLFormElement): Promise<void> {
  const code = form.dataset.humanAnswerCode ?? '';
  const field = form.querySelector<HTMLTextAreaElement>('textarea[name="answer"]');
  const answer = field?.value.trim() ?? '';
  if (!code) return;
  if (!answer) {
    humanAnswerStates.set(code, { status: 'error', message: 'Enter an answer first.' });
    if (currentDashboard) renderDashboard(currentDashboard);
    return;
  }

  humanAnswerDrafts.set(code, answer);
  humanAnswerStates.set(code, { status: 'submitting', message: 'Submitting...' });
  if (currentDashboard) renderDashboard(currentDashboard);

  try {
    const response = await fetch('/api/human-actions/answer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, answer })
    });
    const result = await response.json() as { ok?: boolean; error?: string };
    if (!response.ok || !result.ok) throw new Error(result.error ?? response.statusText);
    humanAnswerDrafts.delete(code);
    humanAnswerStates.set(code, { status: 'submitted', message: 'Answer submitted.' });
    void refresh();
  } catch (error) {
    humanAnswerStates.set(code, { status: 'error', message: error instanceof Error ? error.message : String(error) });
  } finally {
    if (currentDashboard) renderDashboard(currentDashboard);
  }
}

async function copyTextToClipboard(value: string, target?: HTMLElement): Promise<void> {
  let copied = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      copied = true;
    }
  } catch {
    copied = fallbackCopyText(value);
  }
  if (!copied) copied = fallbackCopyText(value);
  if (!target) return;

  const previousText = target.textContent ?? '';
  target.dataset.copyState = copied ? 'copied' : 'failed';
  target.textContent = copied ? 'Copied' : 'Copy failed';
  window.setTimeout(() => {
    target.textContent = previousText;
    delete target.dataset.copyState;
  }, 900);
}

function fallbackCopyText(value: string): boolean {
  const field = document.createElement('textarea');
  field.value = value;
  field.setAttribute('readonly', 'true');
  field.style.position = 'fixed';
  field.style.left = '-9999px';
  field.style.top = '0';
  document.body.append(field);
  field.focus();
  field.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  } finally {
    field.remove();
  }
  return copied;
}

function closeTaskDialog(): void {
  selectedTaskCardId = undefined;
  selectedTicketId = undefined;
  writeRouteState();
  if (currentDashboard) renderDashboard(currentDashboard);
}

function selectedTaskItem(dashboard: Dashboard, jobs: Array<Record<string, unknown>>): TaskBoardItem | undefined {
  if (!selectedTaskCardId && !selectedTicketId) return undefined;
  const items = taskBoardItems(dashboard, jobs);
  const byTask = selectedTaskCardId ? items.find((job) => taskCardId(job) === selectedTaskCardId) : undefined;
  const item = byTask ?? (selectedTicketId ? items.find((job) => ticketId(job) === selectedTicketId) : undefined);
  if (!item) {
    selectedTaskCardId = undefined;
    selectedTicketId = undefined;
    window.setTimeout(writeRouteState, 0);
    return undefined;
  }
  selectedTaskCardId = taskCardId(item);
  selectedTicketId = ticketId(item);
  return item;
}

function routeStateFromLocation(): RouteState {
  const raw = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(raw.includes('=') ? raw : raw ? `tab=${raw}` : '');
  return {
    tab: asContentTab(params.get('tab')),
    taskId: textValue(params.get('task'), '') || undefined,
    ticket: textValue(params.get('ticket'), '') || undefined
  };
}

function writeRouteState(): void {
  const params = new URLSearchParams();
  params.set('tab', selectedTab);
  if (selectedTaskCardId) params.set('task', selectedTaskCardId);
  if (selectedTicketId) params.set('ticket', selectedTicketId);
  const next = `${window.location.pathname}${window.location.search}#${params.toString()}`;
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== next) {
    window.history.replaceState(null, '', next);
  }
}

function contentTabButtons(): HTMLElement[] {
  return Array.from(root?.querySelectorAll<HTMLElement>('[data-content-tab]') ?? []);
}

function isTabNavigationKey(key: string): boolean {
  return key === 'ArrowRight' || key === 'ArrowLeft' || key === 'Home' || key === 'End';
}

function nextTabIndex(key: string, currentIndex: number, count: number): number {
  if (key === 'Home') return 0;
  if (key === 'End') return Math.max(0, count - 1);
  if (key === 'ArrowLeft') return (currentIndex - 1 + count) % count;
  return (currentIndex + 1) % count;
}

function asContentTab(value: unknown): ContentTab {
  if (value === 'agents') return 'swarm';
  return contentTabs.some((tab) => tab.id === value) ? value as ContentTab : 'work';
}

function contributionTooltipTarget(value: EventTarget | null): HTMLElement | undefined {
  return value instanceof Element
    ? value.closest<HTMLElement>('[data-contribution-tooltip]') ?? undefined
    : undefined;
}

function chartTooltipTarget(value: EventTarget | null): HTMLElement | undefined {
  return value instanceof Element
    ? value.closest<HTMLElement>('[data-chart-tooltip]') ?? undefined
    : undefined;
}

function contributionGridTarget(value: EventTarget | null): HTMLElement | undefined {
  return value instanceof Element
    ? value.closest<HTMLElement>('[data-contribution-grid]') ?? undefined
    : undefined;
}

function nearestContributionTarget(event: MouseEvent): HTMLElement | undefined {
  const exact = contributionTooltipTarget(event.target);
  if (exact) return exact;
  const grid = contributionGridTarget(event.target);
  if (!grid) return undefined;
  const weeks = grid.querySelector<HTMLElement>('.contribution-weeks');
  if (!weeks) return undefined;
  const weeksRect = weeks.getBoundingClientRect();
  if (
    event.clientX < weeksRect.left ||
    event.clientX > weeksRect.right ||
    event.clientY < weeksRect.top ||
    event.clientY > weeksRect.bottom
  ) {
    return undefined;
  }
  let best: HTMLElement | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const target of Array.from(weeks.querySelectorAll<HTMLElement>('[data-contribution-tooltip]'))) {
    const rect = target.getBoundingClientRect();
    const dx = event.clientX < rect.left ? rect.left - event.clientX : event.clientX > rect.right ? event.clientX - rect.right : 0;
    const dy = event.clientY < rect.top ? rect.top - event.clientY : event.clientY > rect.bottom ? event.clientY - rect.bottom : 0;
    const distance = dx * dx + dy * dy;
    if (distance >= bestDistance) continue;
    best = target;
    bestDistance = distance;
  }
  return best;
}

function nearestChartPopoverTarget(event: MouseEvent): HTMLElement | undefined {
  return chartTooltipTarget(event.target) ?? nearestContributionTarget(event);
}

function isStillInsideContributionGrid(event: MouseEvent): boolean {
  const grid = contributionGridTarget(event.target);
  return Boolean(grid && event.relatedTarget instanceof Node && grid.contains(event.relatedTarget));
}

function showChartPopover(target: HTMLElement, pointerX?: number, pointerY?: number): void {
  const popover = ensureChartPopover();
  popover.textContent = target.dataset.chartTooltip ?? target.dataset.contributionTooltip ?? '';
  popover.classList.add('visible');
  positionChartPopover(target, pointerX, pointerY);
}

function hideChartPopover(): void {
  activeContributionTarget = undefined;
  chartPopover?.classList.remove('visible', 'below');
}

function ensureChartPopover(): HTMLElement {
  if (chartPopover && document.body.contains(chartPopover)) return chartPopover;
  chartPopover = document.createElement('div');
  chartPopover.className = 'chart-popover';
  chartPopover.setAttribute('role', 'tooltip');
  document.body.appendChild(chartPopover);
  return chartPopover;
}

function positionChartPopover(target: HTMLElement, pointerX?: number, pointerY?: number): void {
  if (!chartPopover) return;
  const rect = target.getBoundingClientRect();
  const width = Math.min(240, Math.max(180, chartPopover.offsetWidth || 200));
  const leftSource = pointerX ?? rect.left + rect.width / 2;
  const left = Math.max(12 + width / 2, Math.min(window.innerWidth - 12 - width / 2, leftSource));
  const aboveTop = (pointerY ?? rect.top) - 12;
  const below = aboveTop < 42;
  const top = below ? rect.bottom + 10 : aboveTop;
  chartPopover.style.left = `${left}px`;
  chartPopover.style.top = `${top}px`;
  chartPopover.style.maxWidth = `${width}px`;
  chartPopover.classList.toggle('below', below);
}

function laneRollups(dashboard: Dashboard): LaneRollup[] {
  const rows = new Map<string, LaneRollup>();
  for (const lane of dashboard.lanes) {
    const id = textValue(lane.id, 'unassigned');
    rows.set(id, {
      id,
      jobCount: numberValue(lane.jobCount),
      completedCount: numberValue(lane.completedCount),
      failedCount: numberValue(lane.failedCount),
      runningCount: numberValue(lane.runningCount),
      blockedCount: 0,
      needsCoordinatorReviewCount: 0,
      staleCount: 0,
      evidenceCount: 0,
      eventCount: 0
    });
  }

  if (dashboard.jobs.length > 0) {
    for (const row of rows.values()) {
      row.jobCount = 0;
      row.completedCount = 0;
      row.failedCount = 0;
      row.runningCount = 0;
    }
  }

  for (const job of dashboard.jobs) {
    const lane = ensureLane(rows, laneOf(job));
    lane.jobCount += 1;
    if (normalized(job.status) === 'completed') lane.completedCount += 1;
    if (normalized(job.status) === 'running') lane.runningCount += 1;
    if (isFailedJob(job)) lane.failedCount += 1;
    if (isBlockedJob(job)) lane.blockedCount += 1;
    if (isNeedsCoordinatorReviewJob(job)) lane.needsCoordinatorReviewCount += 1;
    if (isStaleJob(job)) lane.staleCount += 1;
    lane.evidenceCount += numberValue(job.evidencePathCount);
  }

  for (const event of dashboard.events) {
    const laneId = textValue(event.lane, '');
    if (!laneId) continue;
    ensureLane(rows, laneId).eventCount += 1;
  }

  return Array.from(rows.values()).sort((left, right) => {
    const risk = (right.failedCount + right.staleCount + right.needsCoordinatorReviewCount) - (left.failedCount + left.staleCount + left.needsCoordinatorReviewCount);
    return risk || left.id.localeCompare(right.id);
  });
}

function ensureLane(rows: Map<string, LaneRollup>, id: string): LaneRollup {
  const existing = rows.get(id);
  if (existing) return existing;
  const row = {
    id,
    jobCount: 0,
    completedCount: 0,
    failedCount: 0,
    runningCount: 0,
    blockedCount: 0,
    needsCoordinatorReviewCount: 0,
    staleCount: 0,
    evidenceCount: 0,
    eventCount: 0
  };
  rows.set(id, row);
  return row;
}

function emptyLane(id: string): LaneRollup {
  return {
    id,
    jobCount: 0,
    completedCount: 0,
    failedCount: 0,
    runningCount: 0,
    blockedCount: 0,
    needsCoordinatorReviewCount: 0,
    staleCount: 0,
    evidenceCount: 0,
    eventCount: 0
  };
}

function attentionSummary(jobs: Array<Record<string, unknown>>): AttentionSummary {
  return jobs.reduce<AttentionSummary>((summary, job) => ({
    failedCount: summary.failedCount + (isFailedJob(job) ? 1 : 0),
    staleCount: summary.staleCount + (isStaleJob(job) ? 1 : 0),
    needsCoordinatorReviewCount: summary.needsCoordinatorReviewCount + (isNeedsCoordinatorReviewJob(job) ? 1 : 0),
    blockedCount: summary.blockedCount + (isBlockedJob(job) ? 1 : 0),
    evidenceCount: summary.evidenceCount + numberValue(job.evidencePathCount)
  }), { failedCount: 0, staleCount: 0, needsCoordinatorReviewCount: 0, blockedCount: 0, evidenceCount: 0 });
}

function successSummary(dashboard: Dashboard, jobs: Array<Record<string, unknown>>): SuccessSummary {
  const semantic = semanticMetrics(dashboard.semantic);
  const replay = recordValue(recordValue(dashboard.semantic).replay);
  const ledger = dashboardApplyLedgerSummary(dashboard);
  return {
    completedCount: jobs.filter(isCompletedJob).length,
    readyCount: jobs.filter(isReadyJob).length,
    cleanSourceCount: jobs.filter((job) => sourceOwnershipViolations(job).length === 0 && numberValue(job.quarantinedChangedPathCount) === 0).length,
    evidenceCompleteCount: jobs.filter((job) => numberValue(job.evidencePathCount) > 0).length,
    appliedCount: ledger.applied,
    applyTotalCount: ledger.total,
    applyFailedCount: ledger.failed,
    landedCount: ledger.landed,
    semanticAcceptedClean: semantic.acceptedClean,
    semanticAlreadyApplied: numberValue(replay.alreadyAppliedCount)
  };
}

function dashboardApplyLedgerSummary(dashboard: Dashboard): {
  total: number;
  applied: number;
  committed: number;
  skipped: number;
  failed: number;
  landed: number;
} {
  const summary = recordValue(dashboard.summary);
  const summaryLedger = recordValue(summary.applyLedger);
  const raw = recordValue(dashboard.raw);
  const collection = recordValue(raw.collection);
  const collectionSummary = recordValue(collection.summary);
  const collectionLedger = recordValue(collectionSummary.applyLedger);
  const compact = recordValue(raw.compactDashboard);
  const compactLedger = recordValue(compact.applyLedger);
  const rawLedger = recordValue(raw.applyLedger);
  const rawLedgerSummary = recordValue(rawLedger.summary);
  const ledgers = [summaryLedger, collectionLedger, compactLedger, rawLedger, rawLedgerSummary];
  const landedIds = stringArray(summary.landedJobIds).length
    || stringArray(collectionSummary.landedJobIds).length
    || stringArray(compact.landedJobIds).length;
  const applied = firstLedgerCount(ledgers, 'applied');
  const committed = firstLedgerCount(ledgers, 'committed');
  const failed = firstLedgerCount(ledgers, 'failed');
  const skipped = firstLedgerCount(ledgers, 'skipped');
  const landed = numberValue(summary.landed)
    || numberValue(summary.landedCount)
    || numberValue(summary.applyLedgerLandedCount)
    || numberValue(summaryLedger.landed)
    || numberValue(collectionSummary.landed)
    || numberValue(collectionSummary.landedCount)
    || numberValue(collectionLedger.landed)
    || numberValue(compact.landedCount)
    || numberValue(compactLedger.landed)
    || landedIds;
  const appliedCount = applied || landed;
  return {
    total: firstLedgerCount(ledgers, 'total') || appliedCount + committed + failed + skipped || landed,
    applied: appliedCount,
    committed,
    skipped,
    failed,
    landed
  };
}

function firstLedgerCount(ledgers: Array<Record<string, unknown>>, key: string): number {
  for (const ledger of ledgers) {
    const value = numberValue(ledger[key]);
    if (value > 0) return value;
  }
  return 0;
}

function tokenTimeSummary(dashboard: Dashboard, jobs: Array<Record<string, unknown>>): TokenTimeSummary {
  const timeSummary = recordValue(dashboard.timeSeries?.summary);
  const context = contextPressureSummary(jobs);
  const actualInputTokens = numberValue(timeSummary.actualInputTokens) || context.actualInputTokens;
  const estimatedInputTokens = numberValue(timeSummary.estimatedInputTokens) || context.estimatedInputTokens;
  const uncachedInputTokens = numberValue(timeSummary.uncachedInputTokens) || context.uncachedInputTokens;
  const durationMs = numberValue(timeSummary.durationMs) || sumJobNumber(jobs, 'durationMs');
  const pointCount = numberValue(timeSummary.pointCount);
  const missingTimestampCount = numberValue(timeSummary.missingTimestampJobCount);
  const warningCount = context.warningCount + context.failedCount;
  const tokenValue = actualInputTokens ? formatNumber(actualInputTokens) : estimatedInputTokens ? formatNumber(estimatedInputTokens) : '-';
  const tokenDetail = actualInputTokens
    ? `${formatNumber(uncachedInputTokens)} uncached · ${formatNumber(estimatedInputTokens)} est`
    : estimatedInputTokens
    ? 'estimated input tokens'
    : 'no token data';
  const durationDetail = pointCount
    ? `${formatNumber(pointCount)} buckets · ${formatNumber(missingTimestampCount)} missing time`
    : durationMs
    ? 'summed worker duration'
    : 'no timing data';
  return {
    tokenValue,
    tokenDetail,
    durationValue: durationMs ? formatDuration(durationMs) : '-',
    durationDetail,
    tokenTone: warningCount ? 'warn' : 'neutral',
    timeTone: missingTimestampCount ? 'warn' : 'neutral',
    warningCount,
    missingTimestampCount
  };
}

function warningPressureSummary(
  attention: AttentionSummary,
  audit: AuditSummary,
  health: ReturnType<typeof dashboardHealthSummary>,
  telemetry: TokenTimeSummary
): WarningPressureSummary {
  const failedBlocked = health.failedJobCount + health.blockedJobCount;
  const coordinatorStale = attention.needsCoordinatorReviewCount + attention.staleCount;
  const sourceViolations = audit.sourceOwnershipViolationCount;
  const generatedNoise = generatedNoiseCount(audit) + audit.quarantinedChangedPathCount;
  const budget = Math.max(health.contextWarningJobCount, telemetry.warningCount);
  const missingTime = telemetry.missingTimestampCount;
  const severe = failedBlocked + sourceViolations;
  const rows = [
    { label: 'Failed / blocked', value: failedBlocked, detail: `${text(health.failedJobCount)} failed · ${text(health.blockedJobCount)} blocked`, tone: failedBlocked ? 'bad' as ChartTone : 'neutral' as ChartTone },
    { label: 'Coordinator / stale', value: coordinatorStale, detail: `${text(attention.needsCoordinatorReviewCount)} coordinator · ${text(attention.staleCount)} stale`, tone: coordinatorStale ? 'warn' as ChartTone : 'neutral' as ChartTone },
    { label: 'Context budget', value: budget, detail: `${text(health.contextWarningJobCount)} context · ${text(telemetry.warningCount)} token`, tone: budget ? 'warn' as ChartTone : 'neutral' as ChartTone },
    { label: 'Source violations', value: sourceViolations, detail: 'outside owned source globs', tone: sourceViolations ? 'bad' as ChartTone : 'neutral' as ChartTone },
    { label: 'Generated / quarantined', value: generatedNoise, detail: `${text(generatedNoiseCount(audit))} ignored · ${text(audit.quarantinedChangedPathCount)} quarantined`, tone: generatedNoise ? 'warn' as ChartTone : 'neutral' as ChartTone },
    { label: 'Missing timing', value: missingTime, detail: 'jobs without timestamps', tone: missingTime ? 'warn' as ChartTone : 'neutral' as ChartTone }
  ];
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return {
    total,
    severe,
    budget,
    tone: severe ? 'bad' : total ? 'warn' : 'neutral',
    headline: total ? formatNumber(total) : 'clear',
    detail: total ? `${formatNumber(severe)} blockers · ${formatNumber(budget)} budget` : 'no warning pressure',
    rows
  };
}

function sourceRows(dashboard: Dashboard): Array<{ label: string; value: string }> {
  const entries: Array<{ label: string; value: string }> = [];
  if (dashboard.cwd) entries.push({ label: 'cwd', value: dashboard.cwd });
  if (dashboard.generatedAt) entries.push({ label: 'snapshot', value: formatTime(dashboard.generatedAt) });
  for (const [key, value] of Object.entries(dashboard.sources ?? {})) {
    const text = textValue(value, '');
    if (text) entries.push({ label: sourceLabel(key), value: text });
  }
  return entries;
}

function dashboardSourceLabel(dashboard: Dashboard): string {
  const kind = dashboardSourceKind(dashboard);
  const generated = dashboard.generatedAt ? ` · snapshot ${formatTime(dashboard.generatedAt)}` : '';
  const activeCount = activeAgentTaskCount(dashboard, dashboard.jobs);
  const sources = recordValue(dashboard.sources);
  if (kind === 'demo') return `Demo fixture data · example agents, not a live run${generated}`;
  if (kind === 'lifetime') return `Workspace lifetime · ${text(numberValue(sources.loadedSourceCount) || numberValue(sources.sourceCount))} sources · ${text(activeCount)} active ${activeCount === 1 ? 'agent' : 'agents'}${generated}`;
  if (kind === 'live') return `Live run snapshot · ${text(activeCount)} active ${activeCount === 1 ? 'agent' : 'agents'}${generated}`;
  if (kind === 'stopped') return `Run snapshot · no active agents${generated}`;
  return `Snapshot${generated}`;
}

function dashboardSourceKind(dashboard: Dashboard): 'demo' | 'lifetime' | 'live' | 'stopped' | 'snapshot' {
  const sources = recordValue(dashboard.sources);
  const sourceText = Object.values(sources).map((value) => textValue(value, '')).join(' ');
  const cwd = textValue(dashboard.cwd, '');
  const source = `${cwd} ${sourceText}`;
  if (/loom-ui-demo-populated|demo-populated|fixture/i.test(source)) return 'demo';
  if (textValue(dashboard.kind, '') === 'frontier.loom-ui.lifetime-dashboard' || textValue(sources.lifetimeRoot, '')) return 'lifetime';
  if (/agent-runs|activeRun|pids\.json/i.test(source)) return activeAgentTaskCount(dashboard, dashboard.jobs) > 0 ? 'live' : 'stopped';
  return 'snapshot';
}

function dashboardSourceSmokeMarker(kind: ReturnType<typeof dashboardSourceKind>): string {
  if (kind === 'demo') return 'demo-source-strip';
  if (kind === 'lifetime') return 'lifetime-source-strip';
  if (kind === 'live') return 'live-source-strip';
  if (kind === 'stopped') return 'stopped-source-strip';
  return 'snapshot-source-strip';
}

function riskStatusLabel(dashboard: Dashboard, attention: AttentionSummary, loaded: boolean): string {
  if (attention.failedCount || attention.staleCount || attention.needsCoordinatorReviewCount || attention.blockedCount) return 'Attention needed';
  if (!loaded) return 'No run loaded';
  return dashboard.ok ? 'Admission clean' : 'Run degraded';
}

function jobRisk(job: Record<string, unknown>): string {
  if (isBlockedJob(job)) return 'failed';
  if (isNeedsCoordinatorPortJob(job)) return 'review';
  if (isFailedJob(job)) return 'failed';
  if (isStaleJob(job)) return 'stale';
  if (normalized(job.status) === 'running') return 'running';
  if (normalized(job.bucket) === 'ready-to-apply') return 'ready';
  if (normalized(job.status) === 'completed') return 'done';
  return 'unknown';
}

function isCompletedJob(job: Record<string, unknown>): boolean {
  return normalized(job.status) === 'completed';
}

function isReadyJob(job: Record<string, unknown>): boolean {
  if (isResolvedCoordinatorReviewJob(job)) return false;
  return normalized(job.bucket) === 'ready-to-apply'
    || normalized(job.disposition) === 'ready-to-apply'
    || normalized(job.mergeReadiness).includes('ready');
}

function jobRiskLabel(job: Record<string, unknown>): string {
  const risk = jobRisk(job);
  if (isBlockedJob(job)) return 'blocked';
  if (risk === 'failed') return 'failed';
  if (risk === 'stale') return 'stale';
  if (risk === 'review') return 'review';
  if (risk === 'ready') return 'ready';
  if (risk === 'done') return 'done';
  return text(job.status);
}

function isFailedJob(job: Record<string, unknown>): boolean {
  if (isResolvedCoordinatorReviewJob(job)) return false;
  const status = normalized(job.status);
  const bucket = normalized(job.bucket);
  const disposition = normalized(job.disposition);
  const readiness = normalized(job.mergeReadiness);
  return status === 'failed'
    || bucket === 'failed-evidence'
    || disposition === 'rejected'
    || disposition === 'failed'
    || readiness.includes('failed');
}

function isBlockedJob(job: Record<string, unknown>): boolean {
  if (isResolvedCoordinatorReviewJob(job)) return false;
  const status = normalized(job.status);
  const bucket = normalized(job.bucket);
  const disposition = normalized(job.disposition);
  const readiness = normalized(job.mergeReadiness);
  return status === 'blocked'
    || bucket === 'blocked'
    || bucket === 'waiting-on-human'
    || bucket === 'waiting-on-dependency'
    || disposition === 'blocked'
    || readiness === 'blocked';
}

function isNeedsCoordinatorReviewJob(job: Record<string, unknown>): boolean {
  return isNeedsCoordinatorPortJob(job);
}

function isNeedsCoordinatorPortJob(job: Record<string, unknown>): boolean {
  const bucket = normalized(job.bucket);
  const disposition = normalized(job.disposition);
  const readiness = normalized(job.mergeReadiness);
  return bucket === 'needs-human-port'
    || bucket === 'needs-human-review'
    || bucket === 'needs-human-decision'
    || bucket === 'needs-coordinator-port'
    || bucket === 'needs-coordinator-review'
    || bucket === 'needs-coordinator-decision'
    || disposition.includes('needs')
    || readiness.includes('needs')
    || normalized(job.status) === 'needs-review';
}

function isCoordinatorReviewJob(job: Record<string, unknown>): boolean {
  if (isResolvedCoordinatorReviewJob(job)) return false;
  return isNeedsCoordinatorPortJob(job)
    || normalized(job.disposition).includes('review')
    || normalized(job.mergeReadiness).includes('review');
}

function isStaleJob(job: Record<string, unknown>): boolean {
  if (isResolvedCoordinatorReviewJob(job)) return false;
  return normalized(job.bucket).includes('stale')
    || normalized(job.disposition).includes('stale')
    || normalized(job.mergeReadiness).includes('stale');
}

function isTerminalJob(job: Record<string, unknown>): boolean {
  const status = normalized(job.status);
  return status === 'completed'
    || status === 'failed'
    || status === 'blocked'
    || Boolean(textValue(job.bucket, ''));
}

function laneOf(job: Record<string, unknown>): string {
  return textValue(job.lane, 'unassigned');
}

function reasonText(value: unknown): string {
  if (Array.isArray(value) && value.length) return value.slice(0, 3).map(String).join(', ');
  return '-';
}

function jobReasonText(job: Record<string, unknown>): string {
  const values = [...stringArray(job.collectReasonClasses), ...stringArray(job.reasons)];
  return reasonText(values);
}

function pathSummary(job: Record<string, unknown>): Node {
  const ownershipViolationCount = numberValue(job.ownershipViolationCount);
  const sourceOwnership = sourceOwnershipViolations(job);
  const ignoredOwnership = ignoredOwnershipViolations(job);
  const ignoredChangedPathCount = numberValue(job.ignoredChangedPathCount);
  const quarantinedChangedPathCount = numberValue(job.quarantinedChangedPathCount);
  const quarantinedChangedPaths = stringArray(job.quarantinedChangedPaths);
  const ignoredCount = ignoredOwnership.length + ignoredChangedPathCount;
  const issueText = sourceOwnership.length
    ? `${text(sourceOwnership.length)} source: ${pathList(sourceOwnership)}`
    : ignoredOwnership.length
    ? `${text(ignoredCount)} generated noise: ${pathList(ignoredOwnership)}`
    : quarantinedChangedPaths.length
    ? `${text(quarantinedChangedPathCount)} quarantined: ${pathList(quarantinedChangedPaths)}`
    : ownershipViolationCount || ignoredCount || quarantinedChangedPathCount
    ? `${text(sourceOwnership.length)} source · ${text(ignoredCount)} generated · ${text(quarantinedChangedPathCount)} quarantined`
    : 'clean';
  return <span className="path-summary">
    <b>{text(job.changedPathCount)}</b>
    <small>{issueText}</small>
  </span>;
}

function pathSummaryText(job: Record<string, unknown>): string {
  const sourceOwnership = sourceOwnershipViolations(job);
  const ignoredOwnership = ignoredOwnershipViolations(job);
  const ignoredChangedPathCount = numberValue(job.ignoredChangedPathCount);
  const quarantinedChangedPathCount = numberValue(job.quarantinedChangedPathCount);
  const changedPathCount = numberValue(job.changedPathCount);
  const evidencePathCount = numberValue(job.evidencePathCount);
  const ignoredCount = ignoredOwnership.length + ignoredChangedPathCount;
  if (sourceOwnership.length) return `${text(sourceOwnership.length)} source issue`;
  if (quarantinedChangedPathCount) return `${text(quarantinedChangedPathCount)} quarantined`;
  if (ignoredCount) return `${text(ignoredCount)} generated noise`;
  if (!changedPathCount && hasPatchArtifact(job)) return 'patch not indexed yet';
  if (!changedPathCount && evidencePathCount) return 'evidence only';
  if (!changedPathCount && isActiveAgentJob(job as TaskBoardItem)) return 'files pending';
  return `${text(changedPathCount)} changed ${changedPathCount === 1 ? 'path' : 'paths'}`;
}

function hasPatchArtifact(job: Record<string, unknown>): boolean {
  const paths = [
    textValue(job.patchPath, ''),
    ...stringArray(job.artifactPaths),
    ...stringArray(job.evidencePaths)
  ];
  return paths.some((entry) => /\.patch(?:$|[?#])/.test(entry));
}

function evidenceSummaryText(job: Record<string, unknown>): string {
  const count = numberValue(job.evidencePathCount);
  if (!count) return 'no evidence yet';
  return `${formatNumber(count)} evidence ${count === 1 ? 'artifact' : 'artifacts'}`;
}

function sourceOwnershipViolations(job: Record<string, unknown>): string[] {
  const explicit = stringArray(job.sourceOwnershipViolations);
  if (explicit.length) return explicit.filter((path) => !isGeneratedPath(path));
  return stringArray(job.ownershipViolations).filter((path) => !isGeneratedPath(path));
}

function ignoredOwnershipViolations(job: Record<string, unknown>): string[] {
  const explicit = stringArray(job.ignoredOwnershipViolations);
  return uniqueStrings([...explicit, ...stringArray(job.sourceOwnershipViolations).filter(isGeneratedPath), ...stringArray(job.ownershipViolations).filter(isGeneratedPath)]);
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function isGeneratedPath(value: string): boolean {
  const path = value.replace(/\\/g, '/');
  return path.includes('/.cache/')
    || path.startsWith('.cache/')
    || path.endsWith('.tsbuildinfo')
    || path.includes('/dist/')
    || path.startsWith('dist/')
    || path.includes('/node_modules/')
    || path.startsWith('node_modules/');
}

function pathList(paths: string[]): string {
  const visible = paths.slice(0, 2);
  const more = paths.length > visible.length ? ` +${paths.length - visible.length}` : '';
  return `${visible.join(', ')}${more}`;
}

function contributionGrid(dashboard: Dashboard, jobs: Array<Record<string, unknown>>, events: Array<Record<string, unknown>>): ContributionGrid {
  const anchor = Math.max(Date.now(), timeValue(dashboard.generatedAt) ?? 0, ...events.map((event) => timeValue(event.at) ?? 0), ...jobs.map(jobCompletionTime));
  const year = new Date(anchor).getFullYear();
  const yearStart = new Date(year, 0, 1).getTime();
  const yearEnd = new Date(year, 11, 31).getTime();
  const gridStart = addLocalDays(yearStart, -new Date(yearStart).getDay());
  const gridEnd = addLocalDays(yearEnd, 6 - new Date(yearEnd).getDay());
  const dayStarts = localDayRange(gridStart, gridEnd);
  const weekCount = Math.ceil(dayStarts.length / 7);
  const rows = new Map<string, ContributionDay>();

  for (const at of dayStarts) {
    const date = dateKey(at);
    const inYear = at >= yearStart && at <= yearEnd;
    rows.set(date, {
      date,
      label: formatDay(at),
      count: 0,
      completed: 0,
      events: 0,
      level: 0,
      inYear
    });
  }

  for (const event of events) {
    const at = timeValue(event.at);
    if (at === undefined) continue;
    const row = rows.get(dateKey(at));
    if (!row) continue;
    row.events += 1;
    if (isProgressEvent(event)) row.completed += 1;
  }

  for (const job of jobs) {
    if (!isPositiveProgressJob(job)) continue;
    const at = jobCompletionTime(job) || timeValue(dashboard.generatedAt);
    if (at === undefined) continue;
    const row = rows.get(dateKey(at));
    if (!row) continue;
    row.completed += 1;
  }

  const days = Array.from(rows.values()).map((row) => ({
    ...row,
    count: row.completed + row.events
  }));
  const yearDays = days.filter((day) => day.inYear);
  const maxCount = Math.max(0, ...yearDays.map((day) => day.count));
  const levelled = days.map((day) => ({
    ...day,
    level: contributionLevel(day.count, maxCount)
  }));
  const weeks = Array.from({ length: weekCount }, (_, index) => levelled.slice(index * 7, index * 7 + 7));
  return {
    year,
    days: levelled.filter((day) => day.inYear),
    weeks,
    maxCount,
    totalDone: yearDays.reduce((sum, day) => sum + day.completed, 0),
    totalEvents: yearDays.reduce((sum, day) => sum + day.events, 0),
    activeDays: yearDays.filter((day) => day.count > 0).length
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(value: number): number {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function addLocalDays(value: number, days: number): number {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days).getTime();
}

function localDayRange(start: number, end: number): number[] {
  const out: number[] = [];
  for (let at = startOfLocalDay(start); at <= end; at = addLocalDays(at, 1)) {
    out.push(at);
  }
  return out;
}

function dateKey(value: number): string {
  const date = new Date(startOfLocalDay(value));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDay(value: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(value));
}

function contributionLevel(count: number, maxCount: number): number {
  if (!count) return 0;
  if (maxCount <= 1) return 1;
  return Math.min(4, Math.max(1, Math.ceil((count / maxCount) * 4)));
}

function contributionMonthLabel(week: ContributionDay[], index: number, weeks: ContributionDay[][]): string {
  const firstInYear = week.find((day) => day.inYear);
  if (!firstInYear) return '';
  const startsMonth = week.find((day) => day.inYear && day.date.endsWith('-01'));
  if (index > 0 && !startsMonth) return '';
  const day = startsMonth ?? firstInYear;
  const previousMonth = weeks[index - 1]?.find((entry) => entry.inYear)?.date.slice(5, 7);
  const month = day.date.slice(5, 7);
  if (!startsMonth && previousMonth === month) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(`${day.date}T00:00:00`));
}

function jobCompletionTime(job: Record<string, unknown>): number {
  return timeValue(job.finishedAt)
    ?? timeValue(job.completedAt)
    ?? timeValue(job.endedAt)
    ?? timeValue(job.updatedAt)
    ?? 0;
}

function isPositiveProgressJob(job: Record<string, unknown>): boolean {
  return isCompletedJob(job)
    || isReadyJob(job)
    || normalized(job.bucket) === 'applied'
    || normalized(job.bucket) === 'landed'
    || normalized(job.disposition) === 'applied'
    || normalized(job.disposition) === 'landed';
}

function timelineSummary(dashboard: Dashboard, jobs: Array<Record<string, unknown>>, events: Array<Record<string, unknown>>): TimelineSummary {
  const totalJobs = jobs.length || numberValue(dashboard.summary.jobCount);
  const terminalJobs = jobs.filter(isTerminalJob).length;
  const runningJobs = jobs.filter((job) => normalized(job.status) === 'running').length;
  const attentionJobs = jobs.filter((job) => isFailedJob(job) || isNeedsCoordinatorReviewJob(job) || isStaleJob(job) || isBlockedJob(job)).length;
  const progressPercent = totalJobs ? percentNumber(terminalJobs / totalJobs) : 0;
  const timestamped = events
    .map((event) => ({ event, at: timeValue(event.at) }))
    .filter((entry): entry is { event: Record<string, unknown>; at: number } => entry.at !== undefined)
    .sort((left, right) => left.at - right.at);
  const finished = new Set<string>();
  const points = timestamped.map(({ event, at }) => {
    const type = text(event.type);
    const jobId = textValue(event.jobId, '');
    if (jobId && normalized(type) === 'agent.finished') finished.add(jobId);
    const pointProgress = normalized(type) === 'swarm.finished'
      ? progressPercent
      : totalJobs
      ? Math.min(progressPercent, percentNumber(finished.size / totalJobs))
      : 0;
    return {
      at,
      type,
      lane: text(event.lane),
      jobId: jobId || '-',
      message: text(event.message),
      progressPercent: pointProgress
    };
  });
  return {
    totalJobs,
    terminalJobs,
    runningJobs,
    attentionJobs,
    progressPercent,
    points,
    firstAt: points[0]?.at,
    lastAt: points[points.length - 1]?.at,
    exactTimingAvailable: jobs.some((job) => timeValue(job.startedAt) !== undefined && (timeValue(job.finishedAt) !== undefined || numberValue(job.durationMs) > 0)),
    eventWindowLimited: events.length >= 80
  };
}

function timelineBottlenecks(jobs: Array<Record<string, unknown>>, audit: AuditSummary): TimelineBottleneck[] {
  return [
    { label: 'Failed', value: jobs.filter(isFailedJob).length, detail: 'failed or rejected jobs', tone: 'bad' },
    { label: 'Coordinator review', value: jobs.filter(isNeedsCoordinatorReviewJob).length, detail: 'outputs waiting on coordinator review', tone: 'warn' },
    { label: 'Stale', value: jobs.filter(isStaleJob).length, detail: 'stale against current head', tone: 'warn' },
    { label: 'Blocked', value: jobs.filter(isBlockedJob).length, detail: 'scheduler or dependency blocked', tone: 'bad' },
    { label: 'Source violations', value: audit.sourceOwnershipViolationCount, detail: 'changed paths outside owned source globs', tone: 'bad' },
    {
      label: 'Truncated logs',
      value: jobs.filter((job) => numberValue(job.eventBytesTruncated) + numberValue(job.stderrBytesTruncated) > 0).length,
      detail: 'lost event or stderr detail',
      tone: 'warn'
    }
  ];
}

function dashboardHealthSummary(dashboard: Dashboard, jobs: Array<Record<string, unknown>>, attention: AttentionSummary): {
  status: string;
  tone: ChartTone;
  jobCount: number;
  healthyJobCount: number;
  warningJobCount: number;
  failedJobCount: number;
  blockedJobCount: number;
  runningJobCount: number;
  terminalJobCount: number;
  readyToApplyJobCount: number;
  contextWarningJobCount: number;
  semanticCleanJobCount: number;
  semanticCandidateJobCount: number;
  completionRatio: number;
  failureRatio: number;
} {
  const summary = recordValue(dashboard.health?.summary);
  const jobCount = numberValue(summary.jobCount) || jobs.length;
  const failedJobCount = numberValue(summary.failedJobCount) || attention.failedCount;
  const blockedJobCount = numberValue(summary.blockedJobCount) || attention.blockedCount;
  const warningJobCount = numberValue(summary.warningJobCount) || attention.needsCoordinatorReviewCount + attention.staleCount;
  const terminalJobCount = numberValue(summary.terminalJobCount) || jobs.filter(isTerminalJob).length;
  const status = textValue(dashboard.health?.status, failedJobCount || blockedJobCount ? 'failed' : warningJobCount ? 'warning' : jobCount ? 'healthy' : 'unknown');
  return {
    status,
    tone: healthTone(status),
    jobCount,
    healthyJobCount: numberValue(summary.healthyJobCount) || Math.max(0, jobCount - failedJobCount - blockedJobCount - warningJobCount),
    warningJobCount,
    failedJobCount,
    blockedJobCount,
    runningJobCount: numberValue(summary.runningJobCount) || jobs.filter((job) => normalized(job.status) === 'running').length,
    terminalJobCount,
    readyToApplyJobCount: numberValue(summary.readyToApplyJobCount) || jobs.filter(isReadyJob).length,
    contextWarningJobCount: numberValue(summary.contextWarningJobCount) || jobs.filter(isContextBudgetWarningJob).length,
    semanticCleanJobCount: numberValue(summary.semanticCleanJobCount) || jobs.filter((job) => normalized(job.semanticReadiness) === 'clean').length,
    semanticCandidateJobCount: numberValue(summary.semanticCandidateJobCount) || jobs.filter((job) => normalized(job.semanticReadiness) === 'candidate').length,
    completionRatio: numberValue(summary.completionRatio) || (jobCount ? terminalJobCount / jobCount : 0),
    failureRatio: numberValue(summary.failureRatio) || (jobCount ? (failedJobCount + blockedJobCount) / jobCount : 0)
  };
}

function dashboardHealthRows(dashboard: Dashboard, jobs: Array<Record<string, unknown>>, attention: AttentionSummary): Array<{ label: string; value: number; detail?: string; tone?: ChartTone }> {
  const health = dashboardHealthSummary(dashboard, jobs, attention);
  return [
    { label: 'Healthy', value: health.healthyJobCount, tone: 'good' },
    { label: 'Warnings', value: health.warningJobCount, tone: health.warningJobCount ? 'warn' : 'neutral' },
    { label: 'Failed', value: health.failedJobCount, tone: health.failedJobCount ? 'bad' : 'neutral' },
    { label: 'Blocked', value: health.blockedJobCount, tone: health.blockedJobCount ? 'bad' : 'neutral' },
    { label: 'Running', value: health.runningJobCount, tone: 'neutral' },
    { label: 'Semantic clean', value: health.semanticCleanJobCount, tone: health.semanticCleanJobCount ? 'good' : 'neutral' }
  ];
}

function healthTone(value: string): ChartTone {
  const status = normalized(value);
  if (status === 'healthy') return 'good';
  if (status === 'warning' || status === 'running') return 'warn';
  if (status === 'failed' || status === 'blocked') return 'bad';
  return 'neutral';
}

function timelinePointLeft(point: TimelinePoint, summary: TimelineSummary): number {
  const first = summary.firstAt ?? point.at;
  const last = summary.lastAt ?? point.at;
  if (last <= first) return 0;
  return Math.max(0, Math.min(100, Math.round(((point.at - first) / (last - first)) * 100)));
}

function timelinePointTone(point: TimelinePoint): 'bad' | 'warn' | 'good' | 'neutral' {
  const type = normalized(point.type);
  const message = normalized(point.message);
  if (type.includes('failed') || message.includes('failed') || message.includes('blocked')) return 'bad';
  if (type.includes('adaptive') || message.includes('stale') || message.includes('human')) return 'warn';
  if (type.includes('finished')) return 'good';
  return 'neutral';
}

function tabMeta(tab: ContentTab, input: { jobs: number; questions: number; events: number; sources: number }): string {
  void input.events;
  void input.sources;
  if (tab === 'work') return `${text(input.jobs)} tasks`;
  if (tab === 'board') return 'AI tasks';
  if (tab === 'swarm') return 'active agents';
  if (tab === 'performance') return 'cost trends';
  if (tab === 'history') return 'change graph';
  if (tab === 'testing') return 'quality checks';
  return `${text(input.questions)} open`;
}

function sourceLabel(value: string): string {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, (first) => first.toUpperCase());
}

function offlineDashboard(error: unknown): Dashboard {
  return {
    ok: false,
    generatedAt: Date.now(),
    summary: {
      jobCount: 0,
      completedCount: 0,
      failedCount: 0,
      runningCount: 0,
      blockedCount: 0,
      bucketCounts: { total: 0, 'ready-to-apply': 0 }
    },
    lanes: [],
    jobs: [],
    events: [],
    sources: { error: error instanceof Error ? error.message : String(error) }
  };
}

function text(value: unknown): string {
  return textValue(value, '-');
}

function textValue(value: unknown, fallback: string): string {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function numberValue(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function timeValue(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  if (Number.isFinite(number) && number > 0) return number;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

function sumJobNumber(jobs: Array<Record<string, unknown>>, key: string): number {
  return jobs.reduce((sum, job) => sum + numberValue(job[key]), 0);
}

function progressChartSeries(dashboard: Dashboard, jobs: Array<Record<string, unknown>>, events: Array<Record<string, unknown>>): ChartSeries[] {
  const timeSeries = timeSeriesChartSeries(dashboard);
  if (timeSeries.length) return timeSeries;
  const completed = jobs.filter((job) => normalized(job.status) === 'completed').length;
  const attention = jobs.filter((job) => isFailedJob(job) || isStaleJob(job) || isNeedsCoordinatorReviewJob(job)).length;
  const progressEvents = events.filter(isProgressEvent).length;
  const attentionEvents = events.filter(isAttentionEvent).length;
  return [
    {
      id: 'event-activity',
      title: 'Activity',
      value: formatNumber(events.length),
      detail: 'event cadence',
      points: eventBucketPoints(events, () => true)
    },
    {
      id: 'progress-events',
      title: 'Progress',
      value: progressEvents ? formatNumber(progressEvents) : `${formatNumber(completed)}/${formatNumber(jobs.length)}`,
      detail: progressEvents ? 'ready/completed events' : 'completed jobs',
      tone: 'good',
      points: eventBucketPoints(events, isProgressEvent, 'good')
    },
    {
      id: 'attention-events',
      title: 'Attention',
      value: attentionEvents ? formatNumber(attentionEvents) : formatNumber(attention),
      detail: attentionEvents ? 'risk events' : 'jobs with risk',
      tone: attention || attentionEvents ? 'bad' : 'neutral',
      points: eventBucketPoints(events, isAttentionEvent, attention || attentionEvents ? 'bad' : 'neutral')
    }
  ];
}

function timeSeriesChartSeries(dashboard: Dashboard): ChartSeries[] {
  const points = timeSeriesPoints(dashboard);
  if (!points.length) return [];
  const summary = recordValue(dashboard.timeSeries?.summary);
  const terminal = numberValue(summary.terminalJobCount);
  const warnings = numberValue(summary.warningJobCount);
  const failures = numberValue(summary.failureJobCount) + numberValue(summary.blockedJobCount);
  const durationMs = numberValue(summary.durationMs);
  return [
    {
      id: 'time-series-terminal',
      title: 'Terminal jobs',
      value: formatNumber(terminal),
      detail: `${formatBucketSize(dashboard.timeSeries?.bucketMs)} buckets`,
      tone: 'good',
      points: points.map((point) => timeSeriesPoint(point, 'terminalJobCount', 'terminal jobs', 'good'))
    },
    {
      id: 'time-series-warnings',
      title: 'Warnings',
      value: formatNumber(warnings),
      detail: 'warning jobs by bucket',
      tone: warnings ? 'warn' : 'neutral',
      points: points.map((point) => timeSeriesPoint(point, 'warningJobCount', 'warnings', warnings ? 'warn' : 'neutral'))
    },
    {
      id: 'time-series-failures',
      title: 'Failures',
      value: formatNumber(failures),
      detail: 'failed and blocked jobs',
      tone: failures ? 'bad' : 'neutral',
      points: points.map((point) => ({
        ...timeSeriesPoint(point, 'failureJobCount', 'failures', failures ? 'bad' : 'neutral'),
        value: numberValue(point.failureJobCount) + numberValue(point.blockedJobCount)
      }))
    },
    {
      id: 'time-series-duration',
      title: 'Duration',
      value: formatDuration(durationMs),
      detail: 'bucketed worker duration',
      points: points.map((point) => timeSeriesPoint(point, 'durationMs', 'duration', 'neutral', formatDuration))
    }
  ];
}

function contextLoadChartSeries(dashboard: Dashboard, jobs: Array<Record<string, unknown>>): ChartSeries[] {
  const points = timeSeriesPoints(dashboard);
  if (points.length) {
    const summary = recordValue(dashboard.timeSeries?.summary);
    const actualInputTokens = numberValue(summary.actualInputTokens);
    return [
      {
        id: 'time-series-estimated-tokens',
        title: 'Estimated tokens',
        value: formatNumber(numberValue(summary.estimatedInputTokens)),
        detail: 'bucketed input estimate',
        points: points.map((point) => timeSeriesPoint(point, 'estimatedInputTokens', 'estimated tokens'))
      },
      {
        id: 'time-series-actual-tokens',
        title: 'Actual tokens',
        value: actualInputTokens ? formatNumber(actualInputTokens) : '-',
        detail: 'reported usage',
        points: points.map((point) => timeSeriesPoint(point, 'actualInputTokens', 'actual tokens'))
      },
      {
        id: 'time-series-uncached-tokens',
        title: 'Uncached input',
        value: formatNumber(numberValue(summary.uncachedInputTokens)),
        detail: 'uncached input tokens',
        points: points.map((point) => timeSeriesPoint(point, 'uncachedInputTokens', 'uncached input'))
      }
    ];
  }
  const promptBytes = sumJobNumber(jobs, 'promptBytes');
  const estimatedInputTokens = sumJobNumber(jobs, 'estimatedInputTokens');
  const actualInputTokens = sumJobNumber(jobs, 'actualInputTokens');
  const rows: ChartSeries[] = [
    {
      id: 'prompt-bytes',
      title: 'Prompt bytes',
      value: formatBytes(promptBytes),
      detail: 'per visible job',
      points: jobValuePoints(jobs, 'promptBytes', formatBytes)
    },
    {
      id: 'estimated-tokens',
      title: 'Estimated tokens',
      value: formatNumber(estimatedInputTokens),
      detail: 'per visible job',
      points: jobValuePoints(jobs, 'estimatedInputTokens', formatNumber)
    }
  ];
  if (actualInputTokens) {
    rows.push({
      id: 'actual-tokens',
      title: 'Actual tokens',
      value: formatNumber(actualInputTokens),
      detail: 'reported usage',
      points: jobValuePoints(jobs, 'actualInputTokens', formatNumber)
    });
  }
  return rows;
}

function performanceTabMeta(dashboard: Dashboard, jobs: Array<Record<string, unknown>>): string {
  const telemetry = tokenTimeSummary(dashboard, jobs);
  return telemetry.tokenValue === '-' ? 'cost trends' : `${telemetry.tokenValue} input`;
}

function historyTabMeta(dashboard: Dashboard, jobs: Array<Record<string, unknown>>, success: SuccessSummary): string {
  void dashboard;
  if (success.landedCount) return `${formatNumber(success.landedCount)} landed`;
  if (success.appliedCount) return `${formatNumber(success.appliedCount)} applied`;
  return `${formatNumber(jobs.length)} branches`;
}

function testingTabMeta(jobs: Array<Record<string, unknown>>): string {
  const summary = testingSummary(jobs, []);
  if (summary.failedChecks) return `${formatNumber(summary.failedChecks)} failing`;
  if (summary.activeJobs) return `${formatNumber(summary.activeJobs)} pending`;
  if (summary.totalChecks) return `${formatNumber(summary.passedChecks)}/${formatNumber(summary.totalChecks)} passing`;
  if (summary.noMetadataTasks || !jobs.length) return 'no check metadata';
  return 'quality checks';
}

function performanceTimeDetail(dashboard: Dashboard): string {
  const points = timeSeriesPoints(dashboard);
  if (!points.length) return 'per-task fallback';
  return `${formatNumber(points.length)} ${formatBucketSize(dashboard.timeSeries?.bucketMs)} buckets`;
}

function historyBranchRows(jobs: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return [...jobs]
    .sort((left, right) => taskSortRank(left) - taskSortRank(right) || ticketId(left).localeCompare(ticketId(right)))
    .slice(0, 12);
}

const HISTORY_GRAPH_COLORS = ['#8b949e', '#58a6ff', '#bc8cff', '#3fb950', '#d29922', '#f778ba', '#39c5cf'];

function historyGitGraph(dashboard: Dashboard, jobs: Array<Record<string, unknown>>): HistoryGraph {
  void dashboard;
  const ordered = historyGraphJobs(jobs).slice(0, 28);
  const laneKeys = historyGraphLaneKeys(ordered);
  const laneGap = 22;
  const rowHeight = 54;
  const lanes: HistoryGraphLane[] = [
    { id: 'main', label: 'main', x: 16, color: HISTORY_GRAPH_COLORS[0] ?? '#8b949e' },
    ...laneKeys.map((id, index) => ({
      id,
      label: id,
      x: 16 + laneGap * (index + 1),
      color: HISTORY_GRAPH_COLORS[(index + 1) % HISTORY_GRAPH_COLORS.length] ?? '#58a6ff'
    }))
  ];
  const laneById = new Map(lanes.map((lane, index) => [lane.id, { lane, index }]));
  const rows = ordered.map((job, index) => {
    const laneId = historyGraphLaneId(job, laneKeys);
    const laneEntry = laneById.get(laneId) ?? laneById.get('main');
    const lane = laneEntry?.lane ?? lanes[0];
    const laneIndex = laneEntry?.index ?? 0;
    const y = index * rowHeight + Math.round(rowHeight / 2);
    const tone = historyGraphTone(job);
    const runtime = jobRuntimeLabel(job as TaskBoardItem, Date.now());
    const time = historyJobTime(job);
    const title = `${ticketId(job)} · ${taskTitle(job)}`;
    const subtitle = `${laneOf(job)} · ${taskCardStatus(job)} · ${pathSummaryText(job)}`;
    const meta = `${time ? formatTime(time) : 'no timing'} · ${runtime}`;
    return {
      id: taskCardId(job),
      laneId,
      laneIndex,
      x: lane.x,
      y,
      title,
      subtitle,
      meta,
      tooltip: `${title}\n${subtitle}\n${meta}\n${text(job.disposition ?? job.mergeReadiness ?? job.bucket ?? job.status)}`,
      tone,
      merged: historyJobMerged(job)
    };
  });
  return {
    lanes,
    rows,
    width: Math.max(72, 32 + laneGap * Math.max(1, lanes.length)),
    height: Math.max(rowHeight, rows.length * rowHeight),
    rowHeight,
    trunkX: lanes[0]?.x ?? 16
  };
}

function historyGraphJobs(jobs: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return [...jobs]
    .sort((left, right) => historyJobSortTime(right) - historyJobSortTime(left)
      || taskSortRank(left) - taskSortRank(right)
      || ticketId(left).localeCompare(ticketId(right)));
}

function historyGraphLaneKeys(jobs: Array<Record<string, unknown>>): string[] {
  const raw = uniqueStrings(jobs.map(historyRawLaneKey).filter((value) => value !== 'main'));
  return raw.slice(0, 6);
}

function historyGraphLaneId(job: Record<string, unknown>, laneKeys: string[]): string {
  const raw = historyRawLaneKey(job);
  if (laneKeys.includes(raw)) return raw;
  if (!laneKeys.length) return 'main';
  const index = Number.parseInt(stableHash(raw || taskCardId(job)), 36) % laneKeys.length;
  return laneKeys[index] ?? 'main';
}

function historyRawLaneKey(job: Record<string, unknown>): string {
  const worker = textValue(job.workerId ?? job.agentId ?? job.assignedAgent ?? job.workerName, '');
  const lane = textValue(job.lane, '');
  return sanitizeHistoryLane(worker || lane || 'main');
}

function sanitizeHistoryLane(value: string): string {
  const clean = value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
  return clean || 'main';
}

function historyGraphTone(job: Record<string, unknown>): ChartTone {
  if (isFailedJob(job) || isBlockedJob(job) || isStaleJob(job)) return 'bad';
  if (isNeedsCoordinatorReviewJob(job) || taskBoardColumnId(job) === 'review') return 'warn';
  if (isPositiveProgressJob(job) || isReadyJob(job)) return 'good';
  return 'neutral';
}

function historyJobMerged(job: Record<string, unknown>): boolean {
  if (isFailedJob(job) || isBlockedJob(job) || isStaleJob(job)) return false;
  return isPositiveProgressJob(job)
    || isReadyJob(job)
    || normalized(job.bucket) === 'ready-to-apply'
    || normalized(job.disposition).includes('applied')
    || normalized(job.disposition).includes('landed')
    || normalized(job.mergeReadiness).includes('ready');
}

function historyJobSortTime(job: Record<string, unknown>): number {
  return historyJobTime(job) || 0;
}

function historyJobTime(job: Record<string, unknown>): number | undefined {
  return timeValue(job.finishedAt)
    ?? timeValue(job.completedAt)
    ?? timeValue(job.endedAt)
    ?? timeValue(job.updatedAt)
    ?? timeValue(job.startedAt)
    ?? timeValue(job.createdAt);
}

function historyCurvePath(trunkX: number, laneX: number, y: number): string {
  const mid = Math.round((trunkX + laneX) / 2);
  return `M ${trunkX} ${y} C ${mid} ${y}, ${mid} ${y}, ${laneX} ${y}`;
}

function historyLaneColor(graph: HistoryGraph, laneId: string): string {
  return graph.lanes.find((lane) => lane.id === laneId)?.color ?? HISTORY_GRAPH_COLORS[0] ?? '#8b949e';
}

function HistoryEventRows({ events }: { events: Array<Record<string, unknown>> }): Node {
  const rows = events.slice(-6).reverse();
  if (!rows.length) return <p className="empty tight">No recent events are available.</p>;
  return <div className="history-events">
    {rows.map((event) => <article className={`history-event ${timelinePointTone(eventToTimelinePoint(event))}`}>
      <time>{formatTime(event.at)}</time>
      <div>
        <b>{text(event.type ?? event.message ?? 'event')}</b>
        <small>{text(event.message ?? event.jobId ?? event.lane)}</small>
      </div>
    </article>)}
  </div>;
}

function eventToTimelinePoint(event: Record<string, unknown>): TimelinePoint {
  return {
    at: numberValue(event.at),
    type: textValue(event.type, ''),
    lane: textValue(event.lane, ''),
    jobId: textValue(event.jobId, ''),
    message: textValue(event.message, ''),
    progressPercent: 0
  };
}

function testingSummary(jobs: Array<Record<string, unknown>>, events: Array<Record<string, unknown>>): {
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  evidenceTasks: number;
  evidencePaths: number;
  browserEvidence: number;
  fuzzEvidence: number;
  oracleEvidence: number;
  unitEvidence: number;
  activeJobs: number;
  noMetadataTasks: number;
  openFailures: number;
  status: string;
  notice?: string;
  noticeTone: ChartTone;
  rows: Array<{ label: string; value: string; detailParts: string[]; tone: ChartTone }>;
} {
  const signals = jobs.map(testingJobSignals);
  const passedChecks = signals.reduce((sum, signal) => sum + signal.passedChecks, 0);
  const failedChecks = signals.reduce((sum, signal) => sum + signal.failedChecks, 0);
  const evidencePaths = signals.reduce((sum, signal) => sum + signal.evidencePaths.length, 0);
  const browserEvidence = signals.filter((signal) => signal.browserEvidence).length;
  const fuzzEvidence = signals.filter((signal) => signal.fuzzEvidence).length;
  const oracleEvidence = signals.filter((signal) => signal.oracleEvidence).length;
  const unitEvidence = signals.filter((signal) => signal.unitEvidence).length;
  const activeJobs = signals.filter((signal) => signal.active).length;
  const noMetadataTasks = signals.filter((signal) => !signal.hasMetadata).length;
  const openFailures = jobs.filter((job) => isFailedJob(job) || isBlockedJob(job) || isStaleJob(job)).length;
  const totalChecks = passedChecks + failedChecks;
  const rows = signals
    .filter((signal) => signal.passedChecks || signal.failedChecks || signal.evidencePaths.length || signal.openFailure || signal.active || !signal.hasMetadata)
    .sort((left, right) => Number(right.openFailure) - Number(left.openFailure)
      || Number(right.active) - Number(left.active)
      || Number(!right.hasMetadata) - Number(!left.hasMetadata)
      || right.failedChecks - left.failedChecks
      || right.passedChecks - left.passedChecks
      || left.label.localeCompare(right.label))
    .slice(0, 10)
    .map((signal) => ({
      label: signal.label,
      value: signal.failedChecks
        ? `${formatNumber(signal.failedChecks)} failed`
        : signal.passedChecks
          ? `${formatNumber(signal.passedChecks)} passed`
          : signal.active
            ? 'pending'
            : signal.hasMetadata
              ? `${formatNumber(signal.evidencePaths.length)} evidence`
              : 'no metadata',
      detailParts: signal.detailParts,
      tone: signal.failedChecks || signal.openFailure
        ? 'bad' as ChartTone
        : signal.active || !signal.hasMetadata
          ? 'warn' as ChartTone
          : signal.passedChecks
            ? 'good' as ChartTone
            : 'neutral' as ChartTone
    }));
  const testEvents = events.filter((event) => /\b(test|fuzz|oracle|playwright|smoke|spec)\b/i.test(`${text(event.type)} ${text(event.message)}`)).length;
  const status = failedChecks || openFailures
    ? 'attention needed'
    : activeJobs
      ? 'active work pending verification'
      : totalChecks
        ? 'checks reported'
        : evidencePaths
          ? 'evidence reported; check results missing'
          : 'no check metadata yet';
  const notice = failedChecks || openFailures
    ? undefined
    : activeJobs
      ? `${formatNumber(activeJobs)} active ${activeJobs === 1 ? 'task is' : 'tasks are'} still running; do not treat this snapshot as fully verified.`
      : totalChecks
        ? undefined
        : evidencePaths
          ? 'Evidence paths are present, but no pass/fail command metadata was reported.'
          : 'No testing metadata was reported. This empty state means unknown, not passing.';
  return {
    totalChecks,
    passedChecks,
    failedChecks,
    evidenceTasks: signals.filter((signal) => signal.evidencePaths.length > 0).length,
    evidencePaths,
    browserEvidence,
    fuzzEvidence,
    oracleEvidence,
    unitEvidence: unitEvidence || testEvents,
    activeJobs,
    noMetadataTasks,
    openFailures,
    status,
    notice,
    noticeTone: activeJobs || noMetadataTasks ? 'warn' : 'neutral',
    rows
  };
}

function testingJobSignals(job: Record<string, unknown>): {
  label: string;
  detailParts: string[];
  passedChecks: number;
  failedChecks: number;
  evidencePaths: string[];
  browserEvidence: boolean;
  fuzzEvidence: boolean;
  oracleEvidence: boolean;
  unitEvidence: boolean;
  openFailure: boolean;
  active: boolean;
  hasMetadata: boolean;
} {
  const passed = arrayRecords(job.commandsPassed);
  const failed = arrayRecords(job.commandsFailed);
  const evidencePaths = uniqueStrings([
    ...stringArray(job.evidencePaths),
    ...stringArray(job.proofPaths),
    ...stringArray(job.artifactPaths)
  ]);
  const evidenceText = evidencePaths.join(' ').toLowerCase();
  const commandText = [...passed, ...failed].map((entry) => text(entry.command ?? entry.name ?? entry.summary)).join(' ').toLowerCase();
  const combined = `${evidenceText} ${commandText}`;
  const passedChecks = passed.length + numberValue(job.commandsPassedCount ?? job.passedCommandCount ?? job.testPassedCount);
  const failedChecks = failed.length + numberValue(job.commandsFailedCount ?? job.failedCommandCount ?? job.testFailedCount);
  const hasCommandMetadata = hasOwn(job, 'commandsPassed')
    || hasOwn(job, 'commandsFailed')
    || hasOwn(job, 'commandsPassedCount')
    || hasOwn(job, 'passedCommandCount')
    || hasOwn(job, 'testPassedCount')
    || hasOwn(job, 'commandsFailedCount')
    || hasOwn(job, 'failedCommandCount')
    || hasOwn(job, 'testFailedCount');
  const hasMetadata = hasCommandMetadata || evidencePaths.length > 0;
  return {
    label: `${ticketId(job)} · ${taskTitle(job)}`,
    detailParts: [
      laneOf(job),
      taskCardStatus(job),
      hasMetadata ? evidencePaths.length ? `${formatNumber(evidencePaths.length)} evidence paths` : 'command metadata only' : 'no check metadata'
    ],
    passedChecks,
    failedChecks,
    evidencePaths,
    browserEvidence: /\b(browser|playwright|screenshot|dom|visual)\b/.test(combined),
    fuzzEvidence: /\b(fuzz|property|random|quickcheck)\b/.test(combined),
    oracleEvidence: /\b(oracle|golden|reference|fixture|snapshot)\b/.test(combined),
    unitEvidence: /\b(test|smoke|spec|vitest|jest|node --test|npm test)\b/.test(combined),
    openFailure: isFailedJob(job) || isBlockedJob(job) || isStaleJob(job),
    active: isActiveAgentJob(job as TaskBoardItem),
    hasMetadata
  };
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function testingEvidenceCard(label: string, value: number, detail: string): Node {
  return <article className="testing-evidence-card">
    <span>{label}</span>
    <b>{value ? formatNumber(value) : '-'}</b>
    <small>{detail}</small>
  </article>;
}

function performanceTimeChartSeries(dashboard: Dashboard, jobs: Array<Record<string, unknown>>): ChartSeries[] {
  const points = timeSeriesPoints(dashboard);
  if (!points.length) return performanceJobFallbackSeries(jobs);
  const summary = recordValue(dashboard.timeSeries?.summary);
  const bucketLabel = `${formatBucketSize(dashboard.timeSeries?.bucketMs)} buckets`;
  const actualInput = numberValue(summary.actualInputTokens);
  const estimatedInput = numberValue(summary.estimatedInputTokens);
  const cachedInput = numberValue(summary.cachedInputTokens);
  const durationMs = numberValue(summary.durationMs);
  const cacheHit = actualInput > 0 ? cachedInput / actualInput : 0;
  const waste = numberValue(summary.warningJobCount)
    + numberValue(summary.failureJobCount)
    + numberValue(summary.blockedJobCount)
    + numberValue(summary.contextBudgetWarningCount)
    + numberValue(summary.contextBudgetFailedCount);
  const inputKey = actualInput ? 'actualInputTokens' : 'estimatedInputTokens';
  return [
    {
      id: 'performance-input-tokens',
      title: actualInput ? 'Input tokens' : 'Estimated input',
      value: actualInput ? formatNumber(actualInput) : formatNumber(estimatedInput),
      detail: actualInput ? `${formatNumber(cachedInput)} cached · ${formatNumber(numberValue(summary.uncachedInputTokens))} uncached` : 'estimated by bucket',
      xLabel: bucketLabel,
      yLabel: 'tokens',
      points: points.map((point) => timeSeriesPoint(point, inputKey, actualInput ? 'input tokens' : 'estimated input'))
    },
    {
      id: 'performance-runtime',
      title: 'Runtime',
      value: durationMs ? formatDuration(durationMs) : '-',
      detail: 'bucketed worker duration',
      xLabel: bucketLabel,
      yLabel: 'duration',
      points: points.map((point) => timeSeriesPoint(point, 'durationMs', 'runtime', 'neutral', formatDuration))
    },
    {
      id: 'performance-cache-hit',
      title: 'Cache hit',
      value: cacheHit ? formatPercent(cacheHit) : '-',
      detail: cachedInput ? `${formatNumber(cachedInput)} cached tokens` : 'no cache data',
      tone: cacheHit >= 0.25 ? 'good' : cacheHit ? 'warn' : 'neutral',
      xLabel: bucketLabel,
      yLabel: 'percent cached',
      points: points.map(cacheHitPoint)
    },
    {
      id: 'performance-waste',
      title: 'Waste signals',
      value: formatNumber(waste),
      detail: 'warnings, failures, blocked, and budget signals',
      tone: waste ? 'warn' : 'good',
      xLabel: bucketLabel,
      yLabel: 'signal count',
      points: points.map(wasteSignalPoint)
    }
  ];
}

function performanceJobFallbackSeries(jobs: Array<Record<string, unknown>>): ChartSeries[] {
  const context = contextPressureSummary(jobs);
  return [
    {
      id: 'performance-job-input',
      title: 'Input tokens',
      value: context.actualInputTokens ? formatNumber(context.actualInputTokens) : formatNumber(context.estimatedInputTokens),
      detail: 'per-task usage fallback',
      xLabel: 'tasks',
      yLabel: 'tokens',
      points: jobValuePoints(jobs, context.actualInputTokens ? 'actualInputTokens' : 'estimatedInputTokens', formatNumber)
    },
    {
      id: 'performance-job-runtime',
      title: 'Runtime',
      value: formatDuration(sumJobNumber(jobs, 'durationMs')),
      detail: 'per-task duration fallback',
      xLabel: 'tasks',
      yLabel: 'duration',
      points: jobValuePoints(jobs, 'durationMs', formatDuration)
    },
    {
      id: 'performance-job-cache-hit',
      title: 'Cache hit',
      value: context.cacheHitRatio ? formatPercent(context.cacheHitRatio) : '-',
      detail: context.cachedInputTokens ? `${formatNumber(context.cachedInputTokens)} cached tokens` : 'no cache data',
      tone: context.cacheHitRatio >= 0.25 ? 'good' : context.cacheHitRatio ? 'warn' : 'neutral',
      xLabel: 'tasks',
      yLabel: 'percent cached',
      points: jobs.slice(-18).map(cacheHitJobPoint)
    },
    {
      id: 'performance-job-waste',
      title: 'Waste signals',
      value: formatNumber(jobs.filter((job) => isFailedJob(job) || isBlockedJob(job) || isContextBudgetWarningJob(job) || isContextBudgetFailedJob(job)).length),
      detail: 'per-task warning fallback',
      tone: jobs.some((job) => isFailedJob(job) || isBlockedJob(job) || isContextBudgetWarningJob(job) || isContextBudgetFailedJob(job)) ? 'warn' : 'good',
      xLabel: 'tasks',
      yLabel: 'signal count',
      points: jobs.slice(-18).map(wasteSignalJobPoint)
    }
  ];
}

function cacheHitPoint(point: Record<string, unknown>): ChartPoint {
  const actual = numberValue(point.actualInputTokens);
  const cached = numberValue(point.cachedInputTokens);
  const ratio = actual > 0 && cached > 0 ? cached / actual : 0;
  return {
    label: formatTime(point.at),
    value: Math.round(ratio * 100),
    detail: ratio ? `${formatPercent(ratio)} cache hit` : 'no cache hit reported',
    tone: ratio >= 0.25 ? 'good' : ratio ? 'warn' : 'neutral'
  };
}

function cacheHitJobPoint(job: Record<string, unknown>): ChartPoint {
  const actual = numberValue(job.actualInputTokens);
  const cached = numberValue(job.cachedInputTokens);
  const ratio = actual > 0 && cached > 0 ? cached / actual : 0;
  return {
    label: textValue(job.id ?? job.taskId ?? job.title, 'job'),
    value: Math.round(ratio * 100),
    detail: ratio ? `${formatPercent(ratio)} cache hit` : 'no cache hit reported',
    tone: ratio >= 0.25 ? 'good' : ratio ? 'warn' : 'neutral'
  };
}

function wasteSignalPoint(point: Record<string, unknown>): ChartPoint {
  const value = numberValue(point.warningJobCount)
    + numberValue(point.failureJobCount)
    + numberValue(point.blockedJobCount)
    + numberValue(point.contextBudgetWarningCount)
    + numberValue(point.contextBudgetFailedCount);
  return {
    label: formatTime(point.at),
    value,
    detail: `${formatNumber(value)} waste signals`,
    tone: value ? 'warn' : 'good'
  };
}

function wasteSignalJobPoint(job: Record<string, unknown>): ChartPoint {
  const value = (isFailedJob(job) ? 1 : 0)
    + (isBlockedJob(job) ? 1 : 0)
    + (isContextBudgetWarningJob(job) ? 1 : 0)
    + (isContextBudgetFailedJob(job) ? 1 : 0);
  return {
    label: textValue(job.id ?? job.taskId ?? job.title, 'job'),
    value,
    detail: value ? `${formatNumber(value)} waste signals` : 'no waste signal',
    tone: value ? 'warn' : 'good'
  };
}

function performanceWasteRows(
  jobs: Array<Record<string, unknown>>,
  attention: AttentionSummary,
  audit: AuditSummary,
  context: ReturnType<typeof contextPressureSummary>
): Array<{ label: string; value: number; detail?: string; tone?: ChartTone }> {
  return [
    { label: 'Budget warnings', value: context.warningCount, detail: `${formatNumber(context.failedCount)} failed budget`, tone: context.warningCount || context.failedCount ? 'warn' : 'neutral' },
    { label: 'Coordinator review', value: attention.failedCount + attention.needsCoordinatorReviewCount + attention.staleCount, detail: `${formatNumber(attention.failedCount)} failed · ${formatNumber(attention.needsCoordinatorReviewCount)} coordinator · ${formatNumber(attention.staleCount)} stale`, tone: attention.failedCount + attention.needsCoordinatorReviewCount + attention.staleCount ? 'warn' : 'neutral' },
    { label: 'Blocked', value: attention.blockedCount, detail: 'explicit dependency or impossible-task blocks', tone: attention.blockedCount ? 'bad' : 'neutral' },
    { label: 'Coordinator review', value: attention.needsCoordinatorReviewCount, detail: 'needs coordinator review', tone: attention.needsCoordinatorReviewCount ? 'review' : 'neutral' },
    { label: 'Generated noise', value: generatedNoiseCount(audit), detail: 'ignored generated/cache output', tone: generatedNoiseCount(audit) ? 'warn' : 'neutral' },
    { label: 'P95 uncached', value: context.p95UncachedInputTokens, detail: formatNumber(context.p95UncachedInputTokens), tone: context.p95UncachedInputTokens ? 'warn' : 'neutral' },
    { label: 'Tasks without timing', value: jobs.filter((job) => !jobRuntimeMs(job, Date.now())).length, detail: 'missing duration/start/end', tone: jobs.some((job) => !jobRuntimeMs(job, Date.now())) ? 'warn' : 'neutral' }
  ];
}

function optimizationSignalSummary(dashboard: Dashboard, jobs: Array<Record<string, unknown>>): {
  status: string;
  rows: Array<{ label: string; value: string; detail: string; tone: ChartTone }>;
} {
  const summary = dashboard.summary ?? {};
  const routing = recordValue(dashboard.routing);
  const panelSignals = firstPositiveNumber(
    routing.panelDecisionCount,
    routing.panelResultCount,
    summary.panelDecisionCount,
    summary.panelResultCount,
    summary.fusionPanelCount
  );
  const tournamentObservations = firstPositiveNumber(routing.tournamentObservationCount, summary.tournamentObservationCount);
  const tournamentRecommendations = firstPositiveNumber(routing.tournamentRecommendationCount, summary.tournamentRecommendationCount);
  const routingFeedback = firstPositiveNumber(routing.feedbackCount, routing.preferenceCount, summary.routingFeedbackCount, summary.routingPreferenceCount);
  const rsiSignals = firstPositiveNumber(routing.rsiSignalCount, routing.selfOptimizationCount, summary.rsiSignalCount, summary.selfOptimizationCount);
  const models = uniqueStrings(jobs.map(agentModelLabel).filter((model) => model !== 'model unknown'));
  const usefulOutput = jobs.length ? successLikeJobCount(jobs) / jobs.length : 0;
  const available = panelSignals + tournamentObservations + tournamentRecommendations + routingFeedback + rsiSignals;
  return {
    status: available ? 'optimization telemetry available' : 'no panel/tournament/RSI telemetry yet',
    rows: [
      {
        label: 'Panel decisions',
        value: panelSignals ? formatNumber(panelSignals) : '-',
        detail: panelSignals ? 'panel/fusion outputs reported by the run' : 'not emitted by this run yet',
        tone: panelSignals ? 'good' : 'neutral'
      },
      {
        label: 'Tournament signals',
        value: tournamentObservations || tournamentRecommendations ? `${formatNumber(tournamentObservations)}/${formatNumber(tournamentRecommendations)}` : '-',
        detail: 'observations / recommendations',
        tone: tournamentObservations || tournamentRecommendations ? 'good' : 'neutral'
      },
      {
        label: 'RSI / routing feedback',
        value: routingFeedback || rsiSignals ? formatNumber(routingFeedback + rsiSignals) : '-',
        detail: routingFeedback || rsiSignals ? 'feedback available for future routing' : 'answers are not yet fed into model routing here',
        tone: routingFeedback || rsiSignals ? 'good' : 'neutral'
      },
      {
        label: 'Model diversity',
        value: models.length ? formatNumber(models.length) : '-',
        detail: models.length ? models.slice(0, 3).join(', ') : 'no model labels reported',
        tone: models.length > 1 ? 'good' : 'neutral'
      },
      {
        label: 'Useful output',
        value: jobs.length ? formatPercent(usefulOutput) : '-',
        detail: `${formatNumber(successLikeJobCount(jobs))} useful of ${formatNumber(jobs.length)}`,
        tone: usefulOutput >= 0.8 ? 'good' : usefulOutput ? 'warn' : 'neutral'
      }
    ]
  };
}

function optimizationBehaviorSummary(dashboard: Dashboard, jobs: Array<Record<string, unknown>>): {
  status: string;
  cards: OptimizationBehaviorCard[];
  rows: OptimizationBehaviorRow[];
} {
  const summary = dashboard.summary ?? {};
  const routing = recordValue(dashboard.routing);
  const points = timeSeriesPoints(dashboard);
  const panelSignals = currentPanelSignalCount(routing, summary);
  const tournamentObservations = firstPositiveNumber(routing.tournamentObservationCount, summary.tournamentObservationCount);
  const tournamentRecommendations = firstPositiveNumber(routing.tournamentRecommendationCount, summary.tournamentRecommendationCount);
  const routingFeedback = firstPositiveNumber(routing.feedbackCount, routing.preferenceCount, summary.routingFeedbackCount, summary.routingPreferenceCount);
  const rsiSignals = firstPositiveNumber(routing.rsiSignalCount, routing.selfOptimizationCount, summary.rsiSignalCount, summary.selfOptimizationCount);
  const available = panelSignals + tournamentObservations + tournamentRecommendations + routingFeedback + rsiSignals;
  const signalBuckets = points.filter((point) => (optimizationBucketSignalCount(point) ?? 0) > 0).length;
  const rows = optimizationBehaviorRows(points, jobs);
  const improving = rows.filter((row) => row.tone === 'good').length;
  const comparable = rows.filter((row) => row.tone !== 'neutral').length;
  const status = !available
    ? 'no optimization telemetry yet'
    : !points.length
      ? 'current optimization totals only'
      : !signalBuckets
        ? `${formatNumber(available)} current signals; no bucketed signal trend`
        : `${formatNumber(improving)}/${formatNumber(comparable || rows.length)} workflow indicators improving`;
  return {
    status,
    cards: [
      {
        label: 'Panel influence',
        value: panelSignals ? formatNumber(panelSignals) : '-',
        detail: panelSignals ? 'panel/fusion decisions reported' : 'no panel fields reported',
        tone: panelSignals ? 'good' : 'neutral'
      },
      {
        label: 'Tournament loop',
        value: tournamentObservations || tournamentRecommendations ? `${formatNumber(tournamentObservations)}/${formatNumber(tournamentRecommendations)}` : '-',
        detail: 'observations / recommendations',
        tone: tournamentObservations || tournamentRecommendations ? 'good' : 'neutral'
      },
      {
        label: 'RSI routing loop',
        value: routingFeedback || rsiSignals ? formatNumber(routingFeedback + rsiSignals) : '-',
        detail: routingFeedback || rsiSignals ? `${formatNumber(routingFeedback)} feedback · ${formatNumber(rsiSignals)} RSI` : 'no feedback fields reported',
        tone: routingFeedback || rsiSignals ? 'good' : 'neutral'
      },
      {
        label: 'Trend coverage',
        value: points.length ? `${formatNumber(signalBuckets)}/${formatNumber(points.length)}` : '-',
        detail: points.length ? 'buckets with optimization counters' : 'time series unavailable',
        tone: signalBuckets ? 'good' : points.length ? 'warn' : 'neutral'
      }
    ],
    rows
  };
}

function optimizationBehaviorRows(points: Array<Record<string, unknown>>, jobs: Array<Record<string, unknown>>): OptimizationBehaviorRow[] {
  const signalTrend = bucketTrend(points, optimizationBucketSignalCount, false);
  const wasteTrend = bucketTrend(points, optimizationBucketWasteCount, true);
  const cacheTrend = bucketTrend(points, optimizationBucketCacheRatio, false);
  const usefulTrend = bucketTrend(points, optimizationBucketUsefulRatio, false);
  const fallbackUseful = jobs.length ? successLikeJobCount(jobs) / jobs.length : 0;
  return [
    trendRow(
      'Optimization signal cadence',
      signalTrend,
      'panel, tournament, RSI, and routing feedback counters by bucket',
      formatNumber,
      'no bucketed optimization counters'
    ),
    trendRow(
      'Waste pressure',
      wasteTrend,
      'warnings, failures, blocked jobs, and context budget signals',
      formatNumber,
      'no bucketed waste counters'
    ),
    trendRow(
      'Cache behavior',
      cacheTrend,
      'cached input share by bucket',
      formatPercent,
      'no bucketed cache data'
    ),
    usefulTrend.hasData
      ? trendRow(
        'Useful throughput',
        usefulTrend,
        'healthy terminal share by bucket',
        formatPercent,
        'no bucketed terminal data'
      )
      : {
        label: 'Useful throughput',
        value: jobs.length ? formatPercent(fallbackUseful) : '-',
        detail: jobs.length ? `${formatNumber(successLikeJobCount(jobs))} useful of ${formatNumber(jobs.length)} visible tasks; no bucketed terminal trend` : 'no visible tasks',
        tone: 'neutral'
      }
  ];
}

function trendRow(
  label: string,
  trend: ReturnType<typeof bucketTrend>,
  detail: string,
  formatter: (value: number) => string,
  unavailable: string
): OptimizationBehaviorRow {
  if (!trend.hasData) return { label, value: '-', detail: unavailable, tone: 'neutral' };
  const direction = trend.delta === 0 ? 'flat' : trend.improving ? 'improving' : 'worsening';
  return {
    label,
    value: trendDeltaLabel(trend.delta, formatter),
    detail: `${direction}; ${formatter(trend.first)} early to ${formatter(trend.last)} recent · ${detail}`,
    tone: trend.delta === 0 ? 'neutral' : trend.improving ? 'good' : 'warn'
  };
}

function bucketTrend(
  points: Array<Record<string, unknown>>,
  valueOf: (point: Record<string, unknown>) => number | undefined,
  lowerIsBetter: boolean
): { hasData: boolean; first: number; last: number; delta: number; improving: boolean } {
  const values = points.map(valueOf).filter((value): value is number => value !== undefined && Number.isFinite(value));
  if (values.length < 2) return { hasData: false, first: 0, last: 0, delta: 0, improving: false };
  const split = Math.max(1, Math.floor(values.length / 2));
  const first = average(values.slice(0, split));
  const last = average(values.slice(split));
  const delta = last - first;
  return { hasData: true, first, last, delta, improving: lowerIsBetter ? delta < 0 : delta > 0 };
}

function optimizationBucketSignalCount(point: Record<string, unknown>): number | undefined {
  const panel = firstKnownBucketNumber(point, ['panelDecisionCount', 'panelResultCount', 'fusionPanelCount']);
  const tournament = sumKnownBucketNumbers(point, ['tournamentObservationCount', 'tournamentRecommendationCount']);
  const feedback = sumKnownBucketNumbers(point, ['feedbackCount', 'preferenceCount', 'routingFeedbackCount', 'routingPreferenceCount', 'rsiSignalCount', 'selfOptimizationCount']);
  if (panel === undefined && tournament === undefined && feedback === undefined) return undefined;
  return (panel ?? 0) + (tournament ?? 0) + (feedback ?? 0);
}

function optimizationBucketWasteCount(point: Record<string, unknown>): number | undefined {
  return sumKnownBucketNumbers(point, ['warningJobCount', 'failureJobCount', 'blockedJobCount', 'contextBudgetWarningCount', 'contextBudgetFailedCount']);
}

function optimizationBucketCacheRatio(point: Record<string, unknown>): number | undefined {
  if (!hasNumberField(point, 'actualInputTokens') || !hasNumberField(point, 'cachedInputTokens')) return undefined;
  const actual = numberValue(point.actualInputTokens);
  const cached = numberValue(point.cachedInputTokens);
  return actual > 0 ? cached / actual : 0;
}

function optimizationBucketUsefulRatio(point: Record<string, unknown>): number | undefined {
  if (!hasNumberField(point, 'terminalJobCount')) return undefined;
  const terminal = numberValue(point.terminalJobCount);
  if (!terminal) return 0;
  const warnings = numberValue(point.warningJobCount);
  const failures = numberValue(point.failureJobCount);
  const blocked = numberValue(point.blockedJobCount);
  return Math.max(0, terminal - warnings - failures - blocked) / terminal;
}

function currentPanelSignalCount(routing: Record<string, unknown>, summary: Record<string, unknown>): number {
  return firstPositiveNumber(
    routing.panelDecisionCount,
    routing.panelResultCount,
    summary.panelDecisionCount,
    summary.panelResultCount,
    summary.fusionPanelCount
  );
}

function firstKnownBucketNumber(point: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    if (hasNumberField(point, key)) return numberValue(point[key]);
  }
  return undefined;
}

function sumKnownBucketNumbers(point: Record<string, unknown>, keys: string[]): number | undefined {
  let hasValue = false;
  let sum = 0;
  for (const key of keys) {
    if (!hasNumberField(point, key)) continue;
    hasValue = true;
    sum += numberValue(point[key]);
  }
  return hasValue ? sum : undefined;
}

function hasNumberField(record: Record<string, unknown>, key: string): boolean {
  return record[key] !== undefined && record[key] !== null && record[key] !== '' && Number.isFinite(Number(record[key]));
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function trendDeltaLabel(delta: number, formatter: (value: number) => string): string {
  if (!delta) return 'flat';
  if (formatter === formatPercent) return `${delta > 0 ? '+' : ''}${Math.round(delta * 100)}pp`;
  const prefix = delta > 0 ? '+' : '';
  return `${prefix}${formatter(delta)}`;
}

function firstPositiveNumber(...values: unknown[]): number {
  for (const value of values) {
    const number = numberValue(value);
    if (number > 0) return number;
  }
  return 0;
}

const OPENAI_STANDARD_PRICING_SOURCE = 'OpenAI standard pricing';

const MODEL_PRICES_PER_MILLION: ModelPriceEntry[] = [
  { id: 'gpt-5.5-pro', price: { input: 30, cachedInput: 30, output: 180 }, longContextPrice: { input: 60, cachedInput: 60, output: 270 }, source: OPENAI_STANDARD_PRICING_SOURCE, notes: 'no cached-input discount listed' },
  { id: 'gpt-5.5', price: { input: 5, cachedInput: 0.5, output: 30 }, longContextThreshold: 272_000, longContextPrice: { input: 10, cachedInput: 1, output: 45 }, source: OPENAI_STANDARD_PRICING_SOURCE },
  { id: 'gpt-5.4-pro', price: { input: 30, cachedInput: 30, output: 180 }, longContextPrice: { input: 60, cachedInput: 60, output: 270 }, source: OPENAI_STANDARD_PRICING_SOURCE, notes: 'no cached-input discount listed' },
  { id: 'gpt-5.4-mini', price: { input: 0.75, cachedInput: 0.075, output: 4.5 }, source: OPENAI_STANDARD_PRICING_SOURCE },
  { id: 'gpt-5.4-nano', price: { input: 0.2, cachedInput: 0.02, output: 1.25 }, source: OPENAI_STANDARD_PRICING_SOURCE },
  { id: 'gpt-5.4', price: { input: 2.5, cachedInput: 0.25, output: 15 }, longContextPrice: { input: 5, cachedInput: 0.5, output: 22.5 }, source: OPENAI_STANDARD_PRICING_SOURCE },
  { id: 'gpt-5.3-codex', aliases: ['gpt-5.3-codex-spark'], price: { input: 1.75, cachedInput: 0.175, output: 14 }, source: OPENAI_STANDARD_PRICING_SOURCE },
  { id: 'gpt-5.2', price: { input: 1.75, cachedInput: 0.175, output: 14 }, source: OPENAI_STANDARD_PRICING_SOURCE },
  { id: 'gpt-5.1-codex-max', price: { input: 1.25, cachedInput: 0.125, output: 10 }, source: OPENAI_STANDARD_PRICING_SOURCE },
  { id: 'gpt-5.1-codex-mini', price: { input: 0.25, cachedInput: 0.025, output: 2 }, source: OPENAI_STANDARD_PRICING_SOURCE },
  { id: 'gpt-5-codex', price: { input: 1.25, cachedInput: 0.125, output: 10 }, source: OPENAI_STANDARD_PRICING_SOURCE },
  { id: 'gpt-5-chat-latest', aliases: ['chat-latest'], price: { input: 5, cachedInput: 0.5, output: 30 }, source: OPENAI_STANDARD_PRICING_SOURCE },
  { id: 'gpt-5-mini', price: { input: 0.25, cachedInput: 0.025, output: 2 }, source: OPENAI_STANDARD_PRICING_SOURCE },
  { id: 'gpt-5-nano', price: { input: 0.05, cachedInput: 0.005, output: 0.4 }, source: OPENAI_STANDARD_PRICING_SOURCE },
  { id: 'gpt-5', price: { input: 1.25, cachedInput: 0.125, output: 10 }, source: OPENAI_STANDARD_PRICING_SOURCE },
  { id: 'gpt-4.1-mini', price: { input: 0.4, cachedInput: 0.1, output: 1.6 }, source: OPENAI_STANDARD_PRICING_SOURCE },
  { id: 'gpt-4.1-nano', price: { input: 0.1, cachedInput: 0.025, output: 0.4 }, source: OPENAI_STANDARD_PRICING_SOURCE },
  { id: 'gpt-4.1', price: { input: 2, cachedInput: 0.5, output: 8 }, source: OPENAI_STANDARD_PRICING_SOURCE },
  { id: 'o4-mini-deep-research', price: { input: 1, cachedInput: 1, output: 4 }, source: OPENAI_STANDARD_PRICING_SOURCE, notes: 'cached-input discount not listed for deep research' },
  { id: 'o4-mini', price: { input: 1.1, cachedInput: 0.275, output: 4.4 }, source: OPENAI_STANDARD_PRICING_SOURCE }
];

function modelCostSummary(jobs: Array<Record<string, unknown>>): { value: string; detail: string } {
  const allCosts = jobs.map(modelCostForJob);
  const costs = allCosts.filter((entry) => entry.price);
  const unpricedCount = allCosts.length - costs.length;
  const total = costs.reduce((sum, entry) => sum + entry.cost, 0);
  if (!costs.length) return { value: '-', detail: 'no priced model labels in this run' };
  const billableTokenJobs = costs.filter((entry) => entry.uncachedInputTokens > 0 || entry.cachedInputTokens > 0 || entry.outputTokens > 0).length;
  const models = uniqueStrings(costs.map((entry) => entry.model));
  const outputJobs = costs.filter((entry) => entry.outputTokens > 0).length;
  const estimated = costs.filter((entry) => entry.estimatedInput).length;
  const longContextJobs = costs.filter((entry) => entry.longContext).length;
  const pricingSources = uniqueStrings(costs.map((entry) => entry.pricingSource).filter((value): value is string => Boolean(value)));
  const modelText = models.length > 3 ? `${models.slice(0, 3).join(', ')} +${models.length - 3}` : models.join(', ');
  const sourceText = pricingSources.length ? ` · ${pricingSources.join(', ')}` : '';
  const unpricedText = unpricedCount ? ` · ${formatNumber(unpricedCount)} unpriced jobs` : '';
  if (!billableTokenJobs || total <= 0) {
    return { value: 'unknown', detail: `priced models found, awaiting billable token counts · ${modelText}${sourceText}${unpricedText}` };
  }
  const scope = outputJobs === 0 ? 'input-only' : outputJobs === costs.length ? 'input+output' : 'input+partial output';
  const estimatedText = estimated ? ` · ${formatNumber(estimated)} estimated-input jobs` : '';
  const longContextText = longContextJobs ? ` · ${formatNumber(longContextJobs)} long-context priced` : '';
  const missingOutputText = outputJobs > 0 && outputJobs < costs.length ? ` · ${formatNumber(costs.length - outputJobs)} without output tokens` : '';
  const noOutputText = outputJobs === 0 ? ' · no output tokens reported' : '';
  return { value: formatUsd(total), detail: `${scope} estimate · ${modelText}${sourceText}${longContextText}${estimatedText}${missingOutputText}${noOutputText}${unpricedText}` };
}

function modelCostRows(jobs: Array<Record<string, unknown>>): Array<{ label: string; value: string; detail: string }> {
  return jobs
    .map((job) => ({ job, cost: modelCostForJob(job) }))
    .filter((entry) => entry.cost.price && entry.cost.cost > 0)
    .sort((left, right) => right.cost.cost - left.cost.cost)
    .slice(0, 5)
    .map(({ job, cost }) => ({
      label: `${ticketId(job)} · ${taskTitle(job)}`,
      value: formatUsd(cost.cost),
      detail: `${cost.model} estimate · ${formatNumber(cost.uncachedInputTokens)} uncached · ${formatNumber(cost.cachedInputTokens)} cached${cost.outputTokens ? ` · ${formatNumber(cost.outputTokens)} output` : ''}${cost.longContext ? ' · long context' : ''}${cost.estimatedInput ? ' · estimated input' : ''}`
    }));
}

function modelCostForJob(job: Record<string, unknown>): {
  model: string;
  price?: ModelPrice;
  pricingSource?: string;
  inputTokens: number;
  uncachedInputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  estimatedInput: boolean;
  longContext: boolean;
  cost: number;
} {
  const model = agentModelLabel(job as TaskBoardItem);
  const priceEntry = modelPriceEntryForModel(model);
  const input = inputTokenBreakdownForJob(job);
  const outputTokens = jobOutputTokens(job);
  const longContext = Boolean(priceEntry?.longContextPrice && priceEntry.longContextThreshold && input.inputTokens > priceEntry.longContextThreshold);
  const price = priceEntry ? (longContext ? priceEntry.longContextPrice ?? priceEntry.price : priceEntry.price) : undefined;
  if (!price) return { model, ...input, outputTokens, longContext: false, cost: 0 };
  const cost = ((input.uncachedInputTokens * price.input) + (input.cachedInputTokens * price.cachedInput) + (outputTokens * price.output)) / 1_000_000;
  return { model, price, pricingSource: priceEntry?.source, ...input, outputTokens, longContext, cost };
}

function modelPriceEntryForModel(model: string): ModelPriceEntry | undefined {
  const key = normalizedModelKey(model);
  return MODEL_PRICES_PER_MILLION.find((entry) => modelPriceEntryMatches(key, entry));
}

function modelPriceEntryMatches(key: string, entry: ModelPriceEntry): boolean {
  return [entry.id, ...(entry.aliases ?? [])].some((candidate) => {
    const normalizedCandidate = normalizedModelKey(candidate);
    return key === normalizedCandidate || isDatedModelVariant(key, normalizedCandidate);
  });
}

function isDatedModelVariant(key: string, base: string): boolean {
  if (!key.startsWith(`${base}-`)) return false;
  const suffix = key.slice(base.length + 1);
  return /^\d{4}-\d{2}-\d{2}(?:$|-)/.test(suffix);
}

function normalizedModelKey(value: string): string {
  const raw = value.toLowerCase().trim();
  const pathKey = raw.includes('/') ? raw.split('/').pop() ?? raw : raw;
  return pathKey.includes(':') ? pathKey.split(':').pop() ?? pathKey : pathKey;
}

function inputTokenBreakdownForJob(job: Record<string, unknown>): InputTokenBreakdown {
  const usage = usageRecord(job);
  const inputDetails = recordValue(job.inputTokensDetails ?? job.input_tokens_details ?? usage.input_tokens_details);
  const promptDetails = recordValue(job.promptTokensDetails ?? job.prompt_tokens_details ?? usage.prompt_tokens_details);
  const actualInput = firstPositiveNumber(
    job.actualInputTokens,
    job.inputTokens,
    job.promptTokens,
    job.actual_input_tokens,
    job.input_tokens,
    job.prompt_tokens,
    usage.input_tokens,
    usage.prompt_tokens
  );
  const estimatedInput = firstPositiveNumber(job.estimatedInputTokens, job.estimated_input_tokens);
  const reportedCached = firstPositiveNumber(
    job.cachedInputTokens,
    job.cachedPromptTokens,
    job.cached_input_tokens,
    job.cached_prompt_tokens,
    inputDetails.cached_tokens,
    promptDetails.cached_tokens,
    usage.cached_input_tokens,
    usage.cached_prompt_tokens,
    usage.cached_tokens
  );
  const reportedUncached = firstPositiveNumber(job.uncachedInputTokens, job.uncached_input_tokens, usage.uncached_input_tokens);
  const inputTokens = actualInput || estimatedInput || reportedCached + reportedUncached;
  if (!actualInput) {
    return {
      inputTokens,
      cachedInputTokens: 0,
      uncachedInputTokens: inputTokens,
      estimatedInput: inputTokens > 0
    };
  }

  let cachedInputTokens = reportedCached ? Math.min(actualInput, reportedCached) : 0;
  let uncachedInputTokens = reportedUncached ? Math.min(actualInput, reportedUncached) : Math.max(0, actualInput - cachedInputTokens);
  if (reportedUncached && !reportedCached) cachedInputTokens = Math.max(0, actualInput - uncachedInputTokens);
  if (cachedInputTokens + uncachedInputTokens > actualInput) {
    uncachedInputTokens = Math.min(actualInput, uncachedInputTokens);
    cachedInputTokens = Math.max(0, actualInput - uncachedInputTokens);
  }
  if (cachedInputTokens + uncachedInputTokens < actualInput) {
    uncachedInputTokens += actualInput - cachedInputTokens - uncachedInputTokens;
  }
  return {
    inputTokens: actualInput,
    cachedInputTokens,
    uncachedInputTokens,
    estimatedInput: false
  };
}

function usageRecord(job: Record<string, unknown>): Record<string, unknown> {
  return recordValue(job.usage ?? job.tokenUsage ?? job.openaiUsage ?? job.openAIUsage);
}

function jobOutputTokens(job: Record<string, unknown>): number {
  const usage = usageRecord(job);
  return firstPositiveNumber(
    job.actualOutputTokens,
    job.outputTokens,
    job.completionTokens,
    job.responseTokens,
    job.generatedTokens,
    job.actual_output_tokens,
    job.output_tokens,
    job.completion_tokens,
    job.response_tokens,
    job.generated_tokens,
    usage.output_tokens,
    usage.completion_tokens,
    usage.response_tokens,
    usage.generated_tokens
  );
}

function timeSeriesPoints(dashboard: Dashboard): Array<Record<string, unknown>> {
  const points = dashboard.timeSeries?.points;
  return Array.isArray(points) ? points : [];
}

function timeSeriesPoint(
  point: Record<string, unknown>,
  key: string,
  label: string,
  tone: ChartTone = 'neutral',
  formatter: (value: number) => string = formatNumber
): ChartPoint {
  const value = numberValue(point[key]);
  return {
    label: formatTime(point.at),
    value,
    detail: `${formatter(value)} ${label}`,
    tone
  };
}

function contextPressureLabel(jobs: Array<Record<string, unknown>>): string {
  const summary = contextPressureSummary(jobs);
  if (summary.failedCount) return `${text(summary.failedCount)} failed budget`;
  if (summary.warningCount) return `${text(summary.warningCount)} warnings`;
  if (summary.uncachedInputTokens) return `${formatRatio(summary.uncachedRatio)} uncached/estimated`;
  return 'no pressure';
}

function contextPressureSummary(jobs: Array<Record<string, unknown>>): {
  warningCount: number;
  failedCount: number;
  estimatedInputTokens: number;
  actualInputTokens: number;
  cachedInputTokens: number;
  uncachedInputTokens: number;
  p95ActualInputTokens: number;
  p95UncachedInputTokens: number;
  ratio: number;
  uncachedRatio: number;
  cacheHitRatio: number;
} {
  const inputBreakdowns = jobs.map(inputTokenBreakdownForJob);
  const actualValues = inputBreakdowns
    .filter((input) => !input.estimatedInput)
    .map((input) => input.inputTokens)
    .filter((value) => value > 0)
    .sort((left, right) => left - right);
  const uncachedValues = inputBreakdowns
    .map((input) => input.uncachedInputTokens)
    .filter((value) => value > 0)
    .sort((left, right) => left - right);
  const estimatedInputTokens = inputBreakdowns.reduce((sum, input) => sum + (input.estimatedInput ? input.inputTokens : 0), 0);
  const actualInputTokens = inputBreakdowns.reduce((sum, input) => sum + (input.estimatedInput ? 0 : input.inputTokens), 0);
  const cachedInputTokens = inputBreakdowns.reduce((sum, input) => sum + input.cachedInputTokens, 0);
  const uncachedInputTokens = inputBreakdowns.reduce((sum, input) => sum + input.uncachedInputTokens, 0);
  return {
    warningCount: jobs.filter(isContextBudgetWarningJob).length,
    failedCount: jobs.filter(isContextBudgetFailedJob).length,
    estimatedInputTokens,
    actualInputTokens,
    cachedInputTokens,
    uncachedInputTokens,
    p95ActualInputTokens: percentileValue(actualValues, 0.95),
    p95UncachedInputTokens: percentileValue(uncachedValues, 0.95),
    ratio: estimatedInputTokens > 0 && actualInputTokens > 0 ? actualInputTokens / estimatedInputTokens : 0,
    uncachedRatio: estimatedInputTokens > 0 && uncachedInputTokens > 0 ? uncachedInputTokens / estimatedInputTokens : 0,
    cacheHitRatio: actualInputTokens > 0 && cachedInputTokens > 0 ? cachedInputTokens / actualInputTokens : 0
  };
}

function contextOffenderRows(jobs: Array<Record<string, unknown>>): Array<{
  id: string;
  label: string;
  lane: string;
  sourceLabel: string;
  actualInputTokens: number;
  uncachedInputTokens: number;
  estimatedInputTokens: number;
  statusLabel: string;
}> {
  return jobs
    .map((job) => {
      const input = inputTokenBreakdownForJob(job);
      const actualInputTokens = input.estimatedInput ? 0 : input.inputTokens;
      const uncachedInputTokens = input.uncachedInputTokens;
      const estimatedInputTokens = input.estimatedInput ? input.inputTokens : 0;
      const warning = isContextBudgetWarningJob(job);
      const failed = isContextBudgetFailedJob(job);
      return {
        id: textValue(job.id ?? job.taskId ?? job.title, 'job'),
        label: `${ticketId(job)} · ${taskTitle(job)}`,
        lane: laneOf(job),
        sourceLabel: textValue(job.sourceLabel, ''),
        actualInputTokens,
        uncachedInputTokens,
        estimatedInputTokens,
        statusLabel: failed ? 'budget failed' : warning ? 'budget warning' : 'reported usage'
      };
    })
    .filter((job) => job.actualInputTokens > 0 || job.estimatedInputTokens > 0)
    .sort((left, right) => (right.uncachedInputTokens || right.actualInputTokens || right.estimatedInputTokens) - (left.uncachedInputTokens || left.actualInputTokens || left.estimatedInputTokens))
    .slice(0, 5);
}

function contextDriverDetail(job: { lane: string; sourceLabel: string; statusLabel: string }): string {
  return [job.lane, job.sourceLabel, job.statusLabel].filter(Boolean).join(' · ');
}

function uncachedInputTokensForJob(job: Record<string, unknown>): number {
  return inputTokenBreakdownForJob(job).uncachedInputTokens;
}

function isContextBudgetWarningJob(job: Record<string, unknown>): boolean {
  return numberValue(job.contextBudgetWarningCount) > 0
    || normalized(job.contextBudgetStatus) === 'warning';
}

function isContextBudgetFailedJob(job: Record<string, unknown>): boolean {
  return numberValue(job.contextBudgetErrorCount) > 0
    || normalized(job.contextBudgetStatus) === 'failed';
}

function percentileValue(values: number[], percentile: number): number {
  if (!values.length) return 0;
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * percentile) - 1));
  return values[index] ?? 0;
}

function failureOwnershipRows(attention: AttentionSummary, audit: AuditSummary): Array<{ label: string; value: number; detail?: string; tone?: ChartTone }> {
  return [
    { label: 'Failed jobs', value: attention.failedCount, tone: 'bad' },
    { label: 'Coordinator review', value: attention.needsCoordinatorReviewCount, tone: 'review' },
    { label: 'Stale jobs', value: attention.staleCount, tone: 'warn' },
    { label: 'Source violations', value: audit.sourceOwnershipViolationCount, tone: audit.sourceOwnershipViolationCount ? 'bad' : 'neutral' },
    { label: 'Generated noise', value: generatedNoiseCount(audit), tone: generatedNoiseCount(audit) ? 'warn' : 'neutral' },
    { label: 'Quarantined', value: audit.quarantinedChangedPathCount, tone: audit.quarantinedChangedPathCount ? 'warn' : 'neutral' }
  ];
}

function eventBucketPoints(events: Array<Record<string, unknown>>, predicate: (event: Record<string, unknown>) => boolean, tone: ChartTone = 'neutral'): ChartPoint[] {
  const count = 12;
  const buckets = Array.from({ length: count }, () => 0);
  const times = events
    .map((event) => Number(event.at))
    .filter((value) => Number.isFinite(value) && value > 0);
  const hasTimes = times.length > 0;
  const min = hasTimes ? Math.min(...times) : 0;
  const max = hasTimes ? Math.max(...times) : 0;
  const span = Math.max(1, max - min);
  events.forEach((event, index) => {
    if (!predicate(event)) return;
    const at = Number(event.at);
    const bucket = hasTimes && Number.isFinite(at) && at > 0
      ? Math.min(count - 1, Math.max(0, Math.floor(((at - min) / span) * (count - 1))))
      : Math.min(count - 1, Math.floor((index / Math.max(1, events.length)) * count));
    buckets[bucket] += 1;
  });
  return buckets.map((value, index) => ({
    label: hasTimes ? formatTime(min + Math.round((span * index) / Math.max(1, count - 1))) : `Bucket ${index + 1}`,
    value,
    detail: `${formatNumber(value)} events`,
    tone
  }));
}

function jobValuePoints(
  jobs: Array<Record<string, unknown>>,
  key: string,
  formatter: (value: number) => string
): ChartPoint[] {
  return jobs.slice(-18).map((job) => {
    const value = numberValue(job[key]);
    return {
      label: textValue(job.id ?? job.taskId ?? job.title, 'job'),
      value,
      detail: formatter(value)
    };
  });
}

function isProgressEvent(event: Record<string, unknown>): boolean {
  const value = `${textValue(event.type, '')} ${textValue(event.message, '')}`.toLowerCase();
  return value.includes('complete')
    || value.includes('ready')
    || value.includes('accepted')
    || value.includes('applied')
    || value.includes('success');
}

function isAttentionEvent(event: Record<string, unknown>): boolean {
  const value = `${textValue(event.type, '')} ${textValue(event.message, '')}`.toLowerCase();
  return value.includes('fail')
    || value.includes('error')
    || value.includes('reject')
    || value.includes('blocked')
    || value.includes('stale')
    || value.includes('needs');
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '$0.00';
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value < 10 ? 2 : 0 }).format(value);
}

function formatBytes(value: number): string {
  if (!value) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
}

function formatRatio(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '-';
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)}x`;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0%';
  const percent = value * 100;
  if (value < 1 && percent > 99) return `${floorToDecimal(percent, 1)}%`;
  if (Math.abs(percent - Math.round(percent)) >= 0.25) return `${percent.toFixed(1)}%`;
  return `${Math.round(percent)}%`;
}

function percentNumber(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const percent = value * 100;
  if (value < 1 && percent > 99) return floorToDecimal(percent, 1);
  return Math.round(percent * 10) / 10;
}

function floorToDecimal(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.floor(value * scale) / scale;
}

function formatDuration(value: number): string {
  if (!value) return '0 ms';
  if (value < 1000) return `${Math.round(value)} ms`;
  const seconds = value / 1000;
  if (seconds < 60) return `${seconds >= 10 ? Math.round(seconds) : seconds.toFixed(1)} s`;
  const minutes = seconds / 60;
  return `${minutes >= 10 ? Math.round(minutes) : minutes.toFixed(1)} min`;
}

function formatBucketSize(value: unknown): string {
  const ms = numberValue(value);
  if (!ms) return 'time';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)} s`;
  return `${Math.round(ms / 60000)} min`;
}

function semanticMetrics(value: unknown): {
  expected: number;
  satisfied: number;
  candidates: number;
  autoMerge: number;
  acceptedClean: number;
  conflicts: number;
  total: number;
  admissionRows: Array<{ label: string; value: number; detail?: string; tone?: ChartTone }>;
  admissionTotal: number;
} {
  const input = recordValue(value);
  const imports = recordValue(input.import);
  const edit = recordValue(input.edit);
  const script = recordValue(edit.script);
  const replay = recordValue(input.replay);
  const admission = recordValue(input.admission);
  const admissionRows = [
    ...semanticAdmissionRows(admission.jobs, 'Jobs'),
    ...semanticAdmissionRows(admission.scripts, 'Scripts')
  ];
  const metrics = {
    expected: numberValue(imports.expectedCount),
    satisfied: numberValue(imports.expectedSatisfiedCount),
    candidates: numberValue(imports.candidateCount),
    autoMerge: numberValue(script.autoMergeCandidateCount),
    acceptedClean: numberValue(replay.acceptedCleanCount),
    conflicts: numberValue(replay.conflictCount)
  };
  return {
    ...metrics,
    total: metrics.expected + metrics.satisfied + metrics.candidates + metrics.autoMerge + metrics.acceptedClean + metrics.conflicts,
    admissionRows,
    admissionTotal: admissionRows.reduce((sum, row) => sum + row.value, 0)
  };
}

function semanticSuccessRows(value: unknown): Array<{ label: string; value: number; detail?: string; tone?: ChartTone }> {
  const input = recordValue(value);
  const imports = recordValue(input.import);
  const edit = recordValue(input.edit);
  const script = recordValue(edit.script);
  const projection = recordValue(edit.projection);
  const replay = recordValue(input.replay);
  const rows = [
    { label: 'Imports satisfied', value: numberValue(imports.expectedSatisfiedCount), tone: 'good' as ChartTone },
    { label: 'Auto-merge candidates', value: numberValue(script.autoMergeCandidateCount), tone: 'good' as ChartTone },
    { label: 'Portable edit scripts', value: numberValue(script.portableCount), tone: 'good' as ChartTone },
    { label: 'Projected edits', value: numberValue(projection.appliedEditCount), tone: 'good' as ChartTone },
    { label: 'Replay accepted clean', value: numberValue(replay.acceptedCleanCount), tone: 'good' as ChartTone },
    { label: 'Already applied', value: numberValue(replay.alreadyAppliedCount), tone: 'good' as ChartTone }
  ];
  return rows.filter((row) => row.value > 0);
}

function semanticAdmissionRows(value: unknown, prefix: string): Array<{ label: string; value: number; detail?: string; tone?: ChartTone }> {
  const input = recordValue(value);
  const statusCounts = recordValue(input.statusCounts);
  const rows = Object.entries(statusCounts)
    .map(([label, count]) => ({
      label: `${prefix} ${label}`,
      value: numberValue(count),
      tone: admissionTone(label)
    }))
    .filter((row) => row.value > 0);
  for (const [key, label] of [
    ['autoMergeCandidateCount', 'auto-merge'],
    ['cleanEligibleCount', 'clean eligible'],
    ['portableCount', 'portable'],
    ['cleanEligibleCandidateCount', 'clean candidates']
  ] as const) {
    const value = numberValue(input[key]);
    if (value > 0) rows.push({ label: `${prefix} ${label}`, value, tone: admissionTone(label) });
  }
  return rows;
}

function admissionTone(value: string): ChartTone {
  const label = value.toLowerCase();
  if (label.includes('fail') || label.includes('reject') || label.includes('conflict') || label.includes('blocked') || label.includes('stale')) return 'bad';
  if (label.includes('needs') || label.includes('warning')) return 'warn';
  if (label.includes('clean') || label.includes('auto') || label.includes('portable') || label.includes('accept')) return 'good';
  return 'neutral';
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.map(recordValue).filter((entry) => Object.keys(entry).length > 0) : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function normalized(value: unknown): string {
  return textValue(value, '').toLowerCase();
}

function formatTime(value: unknown): string {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '-';
  return new Date(number).toISOString().replace('T', ' ').replace('.000Z', 'Z');
}

function bucketText(value: unknown): string {
  if (!value || typeof value !== 'object') return '-';
  const counts = value as Record<string, unknown>;
  return `${text(counts['ready-to-apply'])}/${text(counts.total)}`;
}
