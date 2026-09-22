import { useEffect, useMemo, useState } from 'react'

const heatPattern = [
  1, 2, 0, 3, 0, 1, 0, 2, 0, 1, 2,
  3, 1, 3, 1, 0, 2, 0, 3, 0, 1, 0,
  2, 1, 3, 1, 3, 0, 2, 1, 3, 0, 1,
  3, 1, 0, 0, 2, 3, 0, 1, 3, 0, 1,
]

const radarPoints = [
  [56, 45],
  [126, 19],
  [111, 115],
  [60, 92],
] as const

function useDashboardClock() {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  const phase = Math.floor(tick / 7) % 2
  return {
    tick,
    safe: phase === 1,
    storage: phase ? 5.31 : 3.52,
    resolved: phase ? 153712 : 153320 + (tick % 7) * 56,
  }
}

function CountdownCard({ tick }: { tick: number }) {
  const seconds = 36 + tick
  const time = `01:${String(51 + Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <section className="card countdown-card" aria-label="Countdown">
      <div className="card-glow blue-glow" />
      <div className="countdown-top">
        <div className="mini-switch"><span>✦</span></div>
        <div className="points-pill"><b>×</b> 21</div>
      </div>
      <div className="countdown-time tabular">{time}</div>
      <div className="duration-row"><b>57m</b><i>•</i><b>24m</b><i>•</i><span>26m</span></div>
      <div className="segment-track">
        <span className="seg s1" /><span className="seg s2" /><span className="seg s3" />
        <span className="seg s4" /><span className="seg s5" />
      </div>
      <div className="micro-dots" aria-hidden="true">
        <span>•••</span><span>•</span><span>•••••</span><span>••</span><span>•••</span>
      </div>
    </section>
  )
}

function SecurityCard({ safe, value }: { safe: boolean; value: number }) {
  return (
    <section className={`card security-card ${safe ? 'is-safe' : 'is-risk'}`} aria-live="polite">
      <div className="security-sheen" />
      <div className="security-title">{safe ? 'All Threats Resolved' : 'Security Is at Risk'}</div>
      <div className="security-number tabular">{value.toLocaleString('en-US').replace(',', ' ')}</div>
      <div className="scan-row"><span>{safe ? '8s ago' : '287s ago'}</span><button>Quick scan</button></div>
      <div className="security-status">
        <span className="status-icon">{safe ? '✓' : '▲'}</span>
        <strong>{safe ? 'System Protected' : '2 Items'}</strong>
      </div>
    </section>
  )
}

function StorageCard({ storage, tick }: { storage: number; tick: number }) {
  const cells = useMemo(() => Array.from({ length: 60 }, (_, index) => index), [])
  const activeCount = Math.round((storage / 16) * 60) + 13

  return (
    <section className="card storage-card">
      <div className="card-glow violet-glow" />
      <div className="storage-head">
        <div><strong className="storage-value tabular">{storage.toFixed(2)}</strong><span>/16 GB</span></div>
        <button className="spinner" aria-label="Storage settings">✣</button>
      </div>
      <div className="storage-percent"><span className="ring-dot" /> {Math.round(storage / 16 * 100)}%</div>
      <div className="pixel-grid">
        {cells.map((index) => {
          const animatedIndex = (index + tick) % cells.length
          const active = animatedIndex < activeCount
          return <span key={index} className={`pixel p${index % 5} ${active ? 'active' : ''}`} style={{ '--delay': `${index * 18}ms` } as React.CSSProperties} />
        })}
      </div>
      <div className="storage-legend"><span>5.90</span><span>2.15</span><span>2.59</span><b>GB</b></div>
    </section>
  )
}

function ScheduleCard({ tick }: { tick: number }) {
  return (
    <section className="card schedule-card">
      <div className="schedule-head"><strong>Mon 27 Feb</strong><button aria-label="Add event">+</button></div>
      <div className="timeline">
        <div className="grid-lines" />
        <div className="event design">Design</div>
        <div className="event todo">Things to be Done&nbsp; Part 2</div>
        <div className="event meet">Daily Meet.</div>
        <div className="now-line" style={{ '--now': `${38 + (tick % 24) * 0.35}%` } as React.CSSProperties}><span /></div>
        <div className="time-labels"><span>15:00</span><span>15:30</span><span>16:00</span></div>
      </div>
    </section>
  )
}

function Radar() {
  const polygon = radarPoints.map(([x, y]) => `${x},${y}`).join(' ')
  return (
    <div className="radar-wrap">
      <svg viewBox="0 0 150 150" role="img" aria-label="Contribution radar chart">
        <defs>
          <radialGradient id="radarFill">
            <stop offset="0" stopColor="#35e46f" stopOpacity=".32" />
            <stop offset="1" stopColor="#35e46f" stopOpacity=".08" />
          </radialGradient>
          <linearGradient id="scanFill" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#36ff78" stopOpacity=".42" />
            <stop offset="1" stopColor="#36ff78" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="radar-grid">
          <circle cx="75" cy="75" r="53" /><circle cx="75" cy="75" r="37" /><circle cx="75" cy="75" r="20" />
          <path d="M75 22V128M22 75H128M38 38L112 112M112 38L38 112" />
        </g>
        <path className="radar-scan" d="M75 75 L128 75 A53 53 0 0 1 104 119 Z" fill="url(#scanFill)" />
        <polygon className="radar-shape" points={polygon} fill="url(#radarFill)" />
        {radarPoints.map(([x, y]) => <circle className="radar-node" key={`${x}-${y}`} cx={x} cy={y} r="4.2" />)}
      </svg>
      <span className="radar-label commits">Commits</span>
      <span className="radar-label review">Code Rev.</span>
      <span className="radar-label issues">Issues</span>
      <span className="radar-label pulls">Pull Req.</span>
    </div>
  )
}

function ContributionCard({ tick }: { tick: number }) {
  return (
    <section className="card contribution-card">
      <div className="card-glow green-glow" />
      <div className="contribution-left">
        <div className="stats"><strong>154</strong><span>Total</span><strong>51</strong><span>Best</span></div>
        <div className="heat-grid">
          {heatPattern.map((level, index) => (
            <button
              aria-label={`${level} contributions`}
              className={`heat level-${level} ${((index + Math.floor(tick / 2)) % 11) === 0 ? 'wave' : ''}`}
              key={index}
            />
          ))}
        </div>
        <p>Click squares to add commits</p>
      </div>
      <Radar />
    </section>
  )
}

export default function App() {
  const { tick, safe, storage, resolved } = useDashboardClock()

  return (
    <main>
      <div className="dashboard">
        <CountdownCard tick={tick} />
        <SecurityCard safe={safe} value={resolved} />
        <StorageCard storage={storage} tick={tick} />
        <ScheduleCard tick={tick} />
        <ContributionCard tick={tick} />
      </div>
    </main>
  )
}
