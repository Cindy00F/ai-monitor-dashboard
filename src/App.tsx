import { type CSSProperties, type PointerEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Run = {
  id: number
  repo: string
  name: string
  status: string
  conclusion: string | null
  event: string
  createdAt: string
  startedAt: string
  updatedAt: string
  durationSeconds: number | null
  url: string
}

type GitHubEvent = {
  id: string
  repo: string
  type: string
  label: string
  createdAt: string
  url: string
}

type HeatDay = { date: string; count: number }
type Radar = { commits: number; pullRequests: number; issues: number; actions: number }

type Repository = {
  name: string
  url: string
  language: string
  sizeKb: number
  stars: number
  forks: number
  updatedAt: string
  runs: Run[]
  latestRun: Run | null
  events: GitHubEvent[]
  heatmap: HeatDay[]
  sampledCommits: number
  radar: Radar
}

type Stats = {
  schemaVersion: number
  owner: string
  generatedAt: string
  source: string
  isFallback: boolean
  window: { days: number; commitLimitPerRepository: number; note: string }
  repositories: Repository[]
  all: { repositoryCount: number; sizeKb: number; sampledCommits: number; profileContributions: number; profileHeatmap: HeatDay[]; runs: Run[]; events: GitHubEvent[] }
}

type ViewData = {
  name: string
  sizeKb: number
  sampledCommits: number
  runs: Run[]
  events: GitHubEvent[]
  heatmap: HeatDay[]
  radar: Radar
  metricLabel: string
  heatmapNote: string
}

const actionsUrl = 'https://github.com/Cindy00F/ai-monitor-dashboard/actions/workflows/deploy-pages.yml'
const allActionsUrl = 'https://github.com/Cindy00F?tab=repositories'

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const remainder = safe % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function relativeTime(date: string) {
  const seconds = Math.round((Date.parse(date) - Date.now()) / 1000)
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (Math.abs(seconds) < 3600) return formatter.format(Math.round(seconds / 60), 'minute')
  if (Math.abs(seconds) < 86400) return formatter.format(Math.round(seconds / 3600), 'hour')
  return formatter.format(Math.round(seconds / 86400), 'day')
}

function mergeHeatmaps(repositories: Repository[]) {
  const days = new Map<string, number>()
  for (const repo of repositories) {
    for (const day of repo.heatmap) days.set(day.date, (days.get(day.date) ?? 0) + day.count)
  }
  return [...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }))
}

function combinedRadar(repositories: Repository[]): Radar {
  if (!repositories.length) return { commits: 0, pullRequests: 0, issues: 0, actions: 0 }
  const peak = (key: keyof Radar) => Math.max(...repositories.map((repo) => repo.radar[key]))
  return { commits: peak('commits'), pullRequests: peak('pullRequests'), issues: peak('issues'), actions: peak('actions') }
}

function useStats() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}data/github-stats.json?t=${Date.now()}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(`Data request returned ${response.status}`)
      const next = await response.json() as Stats
      if (next.schemaVersion !== 1 || !Array.isArray(next.repositories)) throw new Error('Unsupported data schema')
      setStats(next)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load GitHub data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  return { stats, loading, error, refresh: load }
}

function TiltCard({ className = '', children, label }: { className?: string; children: ReactNode; label: string }) {
  const ref = useRef<HTMLElement>(null)
  const raf = useRef<number | null>(null)

  const move = (event: PointerEvent<HTMLElement>) => {
    const element = ref.current
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const rect = element.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      element.style.setProperty('--rx', `${(0.5 - y) * 7}deg`)
      element.style.setProperty('--ry', `${(x - 0.5) * 7}deg`)
      element.style.setProperty('--mx', `${x * 100}%`)
      element.style.setProperty('--my', `${y * 100}%`)
    })
  }

  const reset = () => {
    if (raf.current) cancelAnimationFrame(raf.current)
    const element = ref.current
    if (!element) return
    element.style.setProperty('--rx', '0deg')
    element.style.setProperty('--ry', '0deg')
    element.style.setProperty('--mx', '50%')
    element.style.setProperty('--my', '0%')
  }

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current) }, [])

  return (
    <section ref={ref} className={`card ${className}`} aria-label={label} onPointerMove={move} onPointerLeave={reset} onPointerUp={reset} onPointerCancel={reset}>
      <div className="tilt-light" aria-hidden="true" />
      <div className="card-content">{children}</div>
    </section>
  )
}

function RunCard({ run }: { run: Run | null }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!run || run.status === 'completed') return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [run])
  const duration = run ? (run.status === 'completed' ? run.durationSeconds ?? 0 : (now - Date.parse(run.startedAt)) / 1000) : 0
  const progress = !run ? 0 : run.status === 'completed' ? 100 : run.status === 'queued' ? 15 : 68

  return (
    <TiltCard className="countdown-card" label="Latest workflow run">
      <div className="card-glow blue-glow" />
      <div className="countdown-top">
        <span className={`run-indicator ${run?.status ?? 'empty'}`}>◆ {run?.status.replace('_', ' ') ?? 'No runs'}</span>
        <span className="points-pill">{run?.repo ?? 'GitHub'}</span>
      </div>
      <div className="countdown-time tabular">{formatDuration(duration)}</div>
      <div className="duration-row"><b>{run?.name ?? 'No workflow data'}</b></div>
      <div className="segment-track" aria-label={`${progress}% workflow progress`}>
        {[0, 25, 50, 75, 90].map((threshold) => <span key={threshold} className={`seg ${progress > threshold ? 'active' : ''}`} />)}
      </div>
      {run ? <a className="card-link" href={run.url} target="_blank" rel="noreferrer">Open run ↗</a> : <span className="card-note">This repository has no public Actions runs.</span>}
    </TiltCard>
  )
}

function SecurityCard({ runs }: { runs: Run[] }) {
  const failures = runs.filter((run) => ['failure', 'timed_out', 'action_required', 'startup_failure'].includes(run.conclusion ?? '')).length
  const active = runs.filter((run) => run.status !== 'completed').length
  const healthy = failures === 0
  const failedUrl = failures ? `${actionsUrl}?query=conclusion%3Afailure` : actionsUrl
  return (
    <TiltCard className={`security-card ${healthy ? 'is-safe' : 'is-risk'}`} label="GitHub Actions health">
      <div className="security-sheen" />
      <div className="security-title">{healthy ? 'All Recent Runs Passed' : 'Actions Need Attention'}</div>
      <div className="security-number tabular">{failures}</div>
      <div className="scan-row"><span>{active} in progress</span><a href={failedUrl} target="_blank" rel="noreferrer">View runs</a></div>
      <div className="security-status">
        <span className="status-icon">{healthy ? '✓' : '▲'}</span>
        <strong>{healthy ? 'Workflows Healthy' : `${failures} Failed Runs`}</strong>
      </div>
    </TiltCard>
  )
}

function RepositoryCard({ view, repositories }: { view: ViewData; repositories: Repository[] }) {
  const maximum = Math.max(1, ...repositories.map((repo) => repo.sizeKb))
  const cells = Array.from({ length: 60 }, (_, index) => index)
  const activeCount = Math.max(view.sizeKb ? 1 : 0, Math.round((view.sizeKb / Math.max(maximum, view.sizeKb)) * 60))
  const mb = view.sizeKb / 1024
  return (
    <TiltCard className="storage-card" label="Public repository size visualization">
      <div className="card-glow violet-glow" />
      <div className="storage-head">
        <div><strong className="storage-value tabular">{mb.toFixed(mb >= 10 ? 1 : 2)}</strong><span>MB tracked</span></div>
        <span className="repo-count">{view.name === 'All repositories' ? repositories.length : 1} repos</span>
      </div>
      <div className="storage-percent">{view.name} · GitHub repository size</div>
      <div className="pixel-grid">
        {cells.map((index) => <span key={index} title={`${Math.min(index + 1, activeCount)} of ${activeCount} active size cells`} className={`pixel p${index % 5} ${index < activeCount ? 'active' : ''}`} />)}
      </div>
      <div className="storage-legend"><span>small</span><span>medium</span><span>large</span><b>KB from API</b></div>
    </TiltCard>
  )
}

function EventsCard({ events }: { events: GitHubEvent[] }) {
  return (
    <TiltCard className="schedule-card" label="Recent public GitHub activity">
      <div className="schedule-head"><strong>Recent activity</strong><span>{events.length} events</span></div>
      <div className="event-list">
        <div className="timeline-grid" aria-hidden="true" />
        {events.length ? events.slice(0, 3).map((event, index) => (
          <a className={`timeline-event event-${index + 1} ${event.type}`} href={event.url} target="_blank" rel="noreferrer" key={event.id}>
            <span>{event.label}</span><strong>{event.repo}</strong><time>{relativeTime(event.createdAt)}</time>
          </a>
        )) : <div className="empty-state">No matching public activity.</div>}
        <div className="timeline-cursor" aria-hidden="true" />
        <div className="timeline-labels" aria-hidden="true"><span>older</span><span>recent</span><span>now</span></div>
      </div>
    </TiltCard>
  )
}

function RadarChart({ radar }: { radar: Radar }) {
  const metrics: Array<[keyof Radar, string, number, number]> = [
    ['commits', 'Commits', 75, 22], ['pullRequests', 'PR / Review', 128, 75],
    ['issues', 'Issues', 75, 128], ['actions', 'Actions', 22, 75],
  ]
  const pointFor = (value: number, x: number, y: number) => `${75 + (x - 75) * value / 100},${75 + (y - 75) * value / 100}`
  const polygon = metrics.map(([key, , x, y]) => pointFor(radar[key], x, y)).join(' ')
  return (
    <div className="radar-wrap">
      <svg viewBox="0 0 150 150" role="img" aria-label={`Activity radar: commits ${radar.commits}, pull requests ${radar.pullRequests}, issues ${radar.issues}, Actions ${radar.actions}`}>
        <defs><radialGradient id="radarFill"><stop stopColor="#35e46f" stopOpacity=".34" /><stop offset="1" stopColor="#35e46f" stopOpacity=".07" /></radialGradient></defs>
        <g className="radar-grid"><circle cx="75" cy="75" r="53" /><circle cx="75" cy="75" r="35" /><circle cx="75" cy="75" r="18" /><path d="M75 22V128M22 75H128" /></g>
        <path className="radar-scan" d="M75 75 L128 75 A53 53 0 0 1 104 119 Z" />
        <polygon className="radar-shape" points={polygon} />
        {metrics.map(([key, label, x, y]) => {
          const [cx, cy] = pointFor(radar[key], x, y).split(',')
          return <circle key={key} className="radar-node" cx={cx} cy={cy} r="4"><title>{label}: {radar[key]}/100</title></circle>
        })}
      </svg>
      <span className="radar-label commits">Commits</span><span className="radar-label review">PR / Review</span>
      <span className="radar-label issues">Issues</span><span className="radar-label pulls">Actions</span>
    </div>
  )
}

function ContributionsCard({ view }: { view: ViewData }) {
  const visibleDays = view.heatmap.slice(-56)
  const max = Math.max(1, ...visibleDays.map((day) => day.count))
  const best = Math.max(0, ...view.heatmap.map((day) => day.count))
  return (
    <TiltCard className="contribution-card" label="Sampled commit activity and normalized radar">
      <div className="card-glow green-glow" />
      <div className="contribution-left">
        <div className="stats"><strong>{view.sampledCommits}</strong><span>{view.metricLabel}</span><strong>{best}</strong><span>Best day</span></div>
        <div className="heat-grid">
          {visibleDays.map((day) => {
            const level = day.count === 0 ? 0 : Math.max(1, Math.ceil((day.count / max) * 3))
            return <span className={`heat level-${level}`} key={day.date} tabIndex={0} aria-label={`${day.date}: ${day.count} ${view.metricLabel.toLowerCase()}`}><span className="tooltip">{day.date}<b>{day.count} {view.metricLabel.toLowerCase()}</b></span></span>
          })}
        </div>
        <p>Recent 8 weeks · {view.heatmapNote}</p>
      </div>
      <RadarChart radar={view.radar} />
    </TiltCard>
  )
}

function BrainIcon() {
  return (
    <svg viewBox="0 0 38 38" aria-hidden="true">
      <path d="M18.8 8.1a5.8 5.8 0 0 0-10.7 3.1A5.6 5.6 0 0 0 5 20.9a5.8 5.8 0 0 0 5.4 8 5.8 5.8 0 0 0 8.4-5.2V8.1Zm.4 0a5.8 5.8 0 0 1 10.7 3.1 5.6 5.6 0 0 1 3.1 9.7 5.8 5.8 0 0 1-5.4 8 5.8 5.8 0 0 1-8.4-5.2V8.1Z" />
      <path d="M12.2 12.5c3.2.3 4.2 2.3 3.8 5.2m-5.7 5.8c3.1-.1 5 1.2 5.7 3.7m9.8-14.7c-3.2.3-4.2 2.3-3.8 5.2m5.7 5.8c-3.1-.1-5 1.2-5.7 3.7" />
    </svg>
  )
}

function EffortCard() {
  const [effort, setEffort] = useState(72)
  const [showHelp, setShowHelp] = useState(false)
  const pixels = useMemo(() => Array.from({ length: 72 }, (_, index) => index), [])
  const rays = useMemo(() => Array.from({ length: 18 }, (_, index) => index), [])
  const particles = useMemo(() => Array.from({ length: 12 }, (_, index) => index), [])
  const mode = effort < 28 ? 'Faster' : effort < 62 ? 'Balanced' : effort < 88 ? 'Smarter' : 'Galaxy'
  const recommendation = effort >= 58 && effort <= 78
  const pixelOpacity = Math.max(0.035, Math.min(1, (effort - 68) / 26))
  const burstOpacity = Math.max(0, Math.min(1, (effort - 78) / 16))
  const smoothOpacity = Math.max(0.14, 0.9 - effort * 0.0075)
  const style = {
    '--effort': `${effort}%`,
    '--energy': effort / 100,
    '--brain-hue': 330 - effort * 0.78,
    '--pixel-opacity': pixelOpacity,
    '--burst-opacity': burstOpacity,
    '--smooth-opacity': smoothOpacity,
  } as CSSProperties

  return (
    <TiltCard className="effort-card" label="AI effort control">
      <div className="effort-aura" aria-hidden="true" />
      <div className="effort-head">
        <div>
          <span>Effort</span>
          <span className="effort-mode"><i aria-hidden="true">{mode}</i><strong>{mode}</strong></span>
        </div>
        <button type="button" className="effort-help" aria-label="Explain effort control" aria-expanded={showHelp} onClick={() => setShowHelp((value) => !value)}>?</button>
      </div>
      <div className="effort-labels" aria-hidden="true"><span>Faster</span><span>Smarter</span></div>
      <div className="effort-control" style={style}>
        <div className="effort-smooth" aria-hidden="true" />
        <div className="effort-pixels" aria-hidden="true">
          {pixels.map((pixel) => {
            const threshold = (pixel / (pixels.length - 1)) * 100
            const active = threshold <= effort
            return (
              <span
                key={pixel}
                className={active ? 'lit' : ''}
                style={{ '--pixel-seed': (pixel * 17) % 11, '--pixel-position': pixel / (pixels.length - 1) } as CSSProperties}
              />
            )
          })}
        </div>
        <div className="effort-ticks" aria-hidden="true"><span /><span /><span /><span /></div>
        <div className="effort-burst" aria-hidden="true">
          {rays.map((ray) => <i className="effort-ray" key={ray} style={{ '--ray': ray, '--ray-length': 12 + (ray * 11) % 22 } as CSSProperties} />)}
          {particles.map((particle) => <b key={particle} style={{ '--particle': particle, '--distance': 18 + (particle * 13) % 30 } as CSSProperties} />)}
        </div>
        <div className="brain-thumb" aria-hidden="true"><BrainIcon /></div>
        <input
          type="range"
          min="0"
          max="100"
          value={effort}
          onInput={(event) => setEffort(Number(event.currentTarget.value))}
          aria-label="AI effort from faster to smarter"
          aria-valuetext={`${mode}, ${effort} percent`}
        />
      </div>
      <div className="effort-foot">
        <span className={recommendation ? 'recommended active' : 'recommended'}>{recommendation ? 'Recommended' : `${effort}% effort`}</span>
        <output aria-live="polite">{effort}</output>
      </div>
      {showHelp && <p className="effort-help-text">Lower values favor speed. Higher values add reasoning depth and visual energy.</p>}
    </TiltCard>
  )
}

export default function App() {
  const { stats, loading, error, refresh } = useStats()
  const [selected, setSelected] = useState(() => new URLSearchParams(window.location.search).get('repo') || 'all')
  const stale = stats ? stats.isFallback || Date.now() - Date.parse(stats.generatedAt) > 2 * 3600_000 : false

  const selectRepository = (repository: string) => {
    setSelected(repository)
    const url = new URL(window.location.href)
    if (repository === 'all') url.searchParams.delete('repo')
    else url.searchParams.set('repo', repository)
    window.history.replaceState(null, '', url)
  }

  const view = useMemo<ViewData | null>(() => {
    if (!stats) return null
    if (selected !== 'all') {
      const repo = stats.repositories.find((item) => item.name === selected)
      if (repo) return {
        name: repo.name, sizeKb: repo.sizeKb, sampledCommits: repo.sampledCommits, runs: repo.runs,
        events: repo.events, heatmap: repo.heatmap, radar: repo.radar, metricLabel: 'Commits',
        heatmapNote: `${stats.window.days}-day public default-branch commit window`,
      }
    }
    return {
      name: 'All repositories', sizeKb: stats.all.sizeKb,
      runs: stats.all.runs, events: stats.all.events,
      heatmap: stats.all.profileHeatmap?.length ? stats.all.profileHeatmap : mergeHeatmaps(stats.repositories),
      radar: combinedRadar(stats.repositories), metricLabel: 'Contributions',
      sampledCommits: stats.all.profileContributions ?? stats.all.sampledCommits,
      heatmapNote: '1-year GitHub public contribution calendar',
    }
  }, [selected, stats])

  return (
    <>
      <a className="skip-link" href="#dashboard">Skip to dashboard</a>
      <main>
      <header className="dashboard-toolbar">
        <div className="brand-line"><span className="live-orb" aria-hidden="true" /><h1>Cindy00F</h1><p>GitHub pulse</p></div>
        <div className="toolbar-actions">
          <label><span className="sr-only">Repository</span>
            <select aria-label="Filter dashboard by repository" value={selected} onChange={(event) => selectRepository(event.target.value)} disabled={!stats}>
              <option value="all">All repositories</option>
              {stats?.repositories.map((repo) => <option value={repo.name} key={repo.name}>{repo.name}</option>)}
            </select>
          </label>
          <button className="icon-action" onClick={() => void refresh()} disabled={loading} aria-label="Reload deployed GitHub statistics" title="Refresh deployed data">{loading ? '…' : '↻'}</button>
          <a className="icon-action" href={actionsUrl} target="_blank" rel="noreferrer" aria-label="Open GitHub Actions collector" title="Open GitHub Actions">↗</a>
        </div>
        <div className={`data-status ${stale ? 'stale' : ''}`} role="status">
          {error ? `Data error · ${error}` : stats ? `${stale ? 'Snapshot' : 'Live'} · ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(stats.generatedAt))}` : 'Loading…'}
        </div>
      </header>
      {view && stats ? (
        <div className="dashboard" id="dashboard">
          <RunCard run={view.runs[0] ?? null} />
          <SecurityCard runs={view.runs} />
          <RepositoryCard view={view} repositories={stats.repositories} />
          <EventsCard events={view.events} />
          <ContributionsCard view={view} />
          <EffortCard />
        </div>
      ) : !loading && <div className="fatal-state"><strong>Dashboard data is unavailable.</strong><p>{error}</p><a href={allActionsUrl}>View Cindy00F repositories ↗</a></div>}
      </main>
    </>
  )
}
