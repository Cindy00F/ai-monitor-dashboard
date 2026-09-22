import assert from 'node:assert/strict'
import test from 'node:test'
import { aggregateRepository, createHeatmap, normalizeEvent, radarFor, summarizeRuns } from './stats-core.mjs'

test('creates a fixed 56-day heatmap and ignores missing dates', () => {
  const result = createHeatmap(
    [{ date: '2026-09-22T01:00:00Z' }, { date: '2026-09-22T22:00:00Z' }, { date: null }],
    new Date('2026-09-22T12:00:00Z'),
  )
  assert.equal(result.length, 56)
  assert.deepEqual(result.at(-1), { date: '2026-09-22', count: 2 })
})

test('summarizes empty and mixed workflow runs safely', () => {
  assert.deepEqual(summarizeRuns([]), { total: 0, failures: 0, inProgress: 0, successRate: null })
  assert.deepEqual(summarizeRuns([
    { status: 'completed', conclusion: 'success' },
    { status: 'completed', conclusion: 'failure' },
    { status: 'completed', conclusion: 'cancelled' },
    { status: 'in_progress', conclusion: null },
  ]), { total: 4, failures: 1, inProgress: 1, successRate: 33 })
})

test('normalizes events with repository fallback links', () => {
  const event = normalizeEvent({ id: 12, type: 'IssuesEvent', created_at: '2026-09-20T00:00:00Z', repo: { name: 'Cindy00F/demo' }, payload: {} })
  assert.equal(event.repo, 'demo')
  assert.equal(event.label, 'Issue')
  assert.equal(event.url, 'https://github.com/Cindy00F/demo')
})

test('radar values are bounded and aggregate handles null language', () => {
  const commits = Array.from({ length: 30 }, () => ({ date: '2026-09-22T00:00:00Z' }))
  assert.equal(radarFor({ commits, events: [], runs: [{ status: 'completed', conclusion: 'success' }] }).commits, 100)
  const aggregate = aggregateRepository({ name: 'empty', html_url: 'https://github.com/x/empty', language: null, size: 0 }, [], [], [])
  assert.equal(aggregate.language, 'Other')
  assert.equal(aggregate.latestRun, null)
  assert.equal(aggregate.heatmap.length, 56)
})
