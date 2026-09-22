import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { aggregateRepository, normalizeEvent, WINDOW_DAYS } from './stats-core.mjs'

const owner = process.env.GITHUB_OWNER || 'Cindy00F'
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
const output = resolve('public/data/github-stats.json')
const api = 'https://api.github.com'

if (!token) {
  try {
    const snapshot = JSON.parse(await readFile(output, 'utf8'))
    console.warn(`GH_TOKEN is not set; keeping local fallback snapshot from ${snapshot.generatedAt}.`)
    process.exit(0)
  } catch {
    console.error('GH_TOKEN is not set and no fallback snapshot exists.')
    process.exit(1)
  }
}

async function request(path) {
  const response = await fetch(`${api}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ai-monitor-dashboard-collector',
    },
  })
  if (!response.ok) throw new Error(`GitHub API ${response.status} for ${path}: ${await response.text()}`)
  return response.json()
}

async function paginate(path, maxPages = 10) {
  const items = []
  for (let page = 1; page <= maxPages; page += 1) {
    const separator = path.includes('?') ? '&' : '?'
    const batch = await request(`${path}${separator}per_page=100&page=${page}`)
    if (!Array.isArray(batch)) throw new Error(`Expected an array from ${path}`)
    items.push(...batch)
    if (batch.length < 100) break
  }
  return items
}

function compactRun(run, repoName) {
  const started = run.run_started_at ?? run.created_at
  const ended = run.updated_at
  return {
    id: run.id, repo: repoName, name: run.name, status: run.status, conclusion: run.conclusion,
    event: run.event, createdAt: run.created_at, startedAt: started, updatedAt: ended,
    durationSeconds: started && ended ? Math.max(0, Math.round((Date.parse(ended) - Date.parse(started)) / 1000)) : null,
    url: run.html_url,
  }
}

async function collectRepository(repo, publicEvents, since) {
  const [runsResponse, commitResponse] = await Promise.all([
    request(`/repos/${owner}/${repo.name}/actions/runs?per_page=30`).catch((error) => {
      if (error.message.includes('404')) return { workflow_runs: [] }
      throw error
    }),
    request(`/repos/${owner}/${repo.name}/commits?author=${encodeURIComponent(owner)}&since=${encodeURIComponent(since)}&per_page=100`).catch((error) => {
      if (error.message.includes('409')) return []
      throw error
    }),
  ])
  const runs = (runsResponse.workflow_runs ?? []).map((run) => compactRun(run, repo.name))
  const commits = commitResponse.map((commit) => ({ sha: commit.sha, date: commit.commit?.author?.date ?? commit.commit?.committer?.date ?? null }))
  return aggregateRepository(repo, runs, commits, publicEvents.filter((event) => event.repo === repo.name))
}

try {
  const generatedAt = new Date().toISOString()
  const sinceDate = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString()
  const [repos, rawEvents] = await Promise.all([
    paginate(`/users/${owner}/repos?type=public&sort=updated`, 10),
    paginate(`/users/${owner}/events/public`, 3),
  ])
  const events = rawEvents
    .filter((event) => ['PushEvent', 'PullRequestEvent', 'PullRequestReviewEvent', 'IssuesEvent', 'ReleaseEvent', 'CreateEvent'].includes(event.type))
    .map(normalizeEvent)
  const repositories = []
  for (const repo of repos.filter((item) => !item.private)) repositories.push(await collectRepository(repo, events, sinceDate))
  const allRuns = repositories.flatMap((repo) => repo.runs).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const snapshot = {
    schemaVersion: 1, owner, generatedAt, source: 'github-actions', isFallback: false,
    window: { days: WINDOW_DAYS, commitLimitPerRepository: 100, eventPages: 3, runLimitPerRepository: 30, note: 'Sampled public commits authored by Cindy00F; not GitHub contribution totals.' },
    repositories,
    all: {
      repositoryCount: repositories.length,
      sizeKb: repositories.reduce((sum, repo) => sum + repo.sizeKb, 0),
      sampledCommits: repositories.reduce((sum, repo) => sum + repo.sampledCommits, 0),
      runs: allRuns,
      events: events.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 30),
    },
  }
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(`Collected ${repositories.length} public repositories into ${output}.`)
} catch (error) {
  console.error(`GitHub collection failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
