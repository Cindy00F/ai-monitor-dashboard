export const WINDOW_DAYS = 365
export const HEATMAP_DAYS = 365

export function toDay(value) {
  return new Date(value).toISOString().slice(0, 10)
}

export function createHeatmap(commits, now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (HEATMAP_DAYS - 1))
  const counts = new Map()
  for (const commit of commits) {
    if (!commit.date) continue
    const day = toDay(commit.date)
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  return Array.from({ length: HEATMAP_DAYS }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    const day = toDay(date)
    return { date: day, count: counts.get(day) ?? 0 }
  })
}

export function summarizeRuns(runs) {
  const completed = runs.filter((run) => run.status === 'completed')
  const failureConclusions = ['failure', 'timed_out', 'action_required', 'startup_failure']
  const failures = completed.filter((run) => failureConclusions.includes(run.conclusion))
  const inProgress = runs.filter((run) => run.status !== 'completed')
  const successes = completed.filter((run) => run.conclusion === 'success')
  return {
    total: runs.length,
    failures: failures.length,
    inProgress: inProgress.length,
    successRate: completed.length ? Math.round((successes.length / completed.length) * 100) : null,
  }
}

export function radarFor({ commits, events, runs }) {
  const pullEvents = events.filter((event) => ['PullRequestEvent', 'PullRequestReviewEvent'].includes(event.type)).length
  const issueEvents = events.filter((event) => event.type === 'IssuesEvent').length
  return {
    commits: Math.min(100, commits.length * 5),
    pullRequests: Math.min(100, pullEvents * 20),
    issues: Math.min(100, issueEvents * 20),
    actions: summarizeRuns(runs).successRate ?? 0,
  }
}

export function normalizeEvent(event) {
  const repo = event.repo?.name?.split('/').pop() ?? 'unknown'
  const type = event.type ?? 'Event'
  const labels = {
    PushEvent: 'Push',
    PullRequestEvent: 'Pull request',
    PullRequestReviewEvent: 'Code review',
    IssuesEvent: 'Issue',
    ReleaseEvent: 'Release',
    CreateEvent: 'Created',
  }
  const target = event.payload?.pull_request?.html_url ?? event.payload?.issue?.html_url ??
    event.payload?.release?.html_url ?? `https://github.com/${event.repo?.name ?? ''}`
  return { id: String(event.id), repo, type, label: labels[type] ?? type.replace(/Event$/, ''), createdAt: event.created_at, url: target }
}

export function aggregateRepository(repo, runs, commits, events) {
  return {
    name: repo.name,
    url: repo.html_url,
    language: repo.language ?? 'Other',
    sizeKb: repo.size ?? 0,
    stars: repo.stargazers_count ?? 0,
    forks: repo.forks_count ?? 0,
    updatedAt: repo.updated_at,
    runs,
    runSummary: summarizeRuns(runs),
    latestRun: runs[0] ?? null,
    events,
    heatmap: createHeatmap(commits),
    sampledCommits: commits.length,
    radar: radarFor({ commits, events, runs }),
  }
}
