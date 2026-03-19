import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type Decision = 'pass' | 'warn' | 'block' | 'protect'

interface ToolCall {
  tool: string
  file: string
  sizeKB: number
  tokens: number
  decision: Decision
  reason: string
}

const examples: ToolCall[] = [
  { tool: 'Read', file: 'src/utils.ts', sizeKB: 4, tokens: 1000, decision: 'pass', reason: 'under threshold' },
  { tool: 'Read', file: 'data/fixtures.json', sizeKB: 200, tokens: 50000, decision: 'warn', reason: '50K tokens > 40K warn' },
  { tool: 'Edit', file: 'CLAUDE.md', sizeKB: 2, tokens: 500, decision: 'protect', reason: 'cache anchor file' },
  { tool: 'Write', file: 'dist/bundle.js', sizeKB: 1800, tokens: 450000, decision: 'block', reason: '450K > 400K block' },
  { tool: 'Read', file: 'package.json', sizeKB: 3, tokens: 750, decision: 'pass', reason: 'under threshold' },
  { tool: 'Read', file: 'src/generated/schema.ts', sizeKB: 320, tokens: 80000, decision: 'warn', reason: '80K tokens > 40K warn' },
]

const decisionColors: Record<Decision, string> = {
  pass: 'var(--color-safe)',
  warn: 'var(--color-warn)',
  block: 'var(--color-block)',
  protect: 'var(--color-protect)',
}

const decisionLabels: Record<Decision, string> = {
  pass: 'PASS',
  warn: 'WARN',
  block: 'BLOCK',
  protect: 'PROTECT',
}

type Phase = 'idle' | 'estimating' | 'result'

export function AnimatedDemo() {
  const [callIdx, setCallIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [cumulative, setCumulative] = useState(0)
  const [history, setHistory] = useState<{ call: ToolCall; cumTokens: number }[]>([])
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const call = examples[callIdx]

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    if (paused) return
    clearTimer()
    setPhase('idle')

    timerRef.current = setTimeout(() => {
      if (pausedRef.current) return
      setPhase('estimating')

      timerRef.current = setTimeout(() => {
        if (pausedRef.current) return
        setPhase('result')

        const newCum = cumulative + call.tokens
        setCumulative(newCum)
        setHistory(prev => [...prev.slice(-4), { call, cumTokens: newCum }])

        timerRef.current = setTimeout(() => {
          if (pausedRef.current) return
          setCallIdx(i => {
            if (i + 1 >= examples.length) {
              setCumulative(0)
              setHistory([])
              return 0
            }
            return i + 1
          })
        }, 2000)
      }, 1200)
    }, 600)

    return clearTimer
  }, [callIdx, paused])

  const formatTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : `${n}`

  return (
    <section className="section">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="section-title">See It In Action</h2>
        <p className="section-subtitle">
          Watch how each tool call is estimated and tracked in real time.
        </p>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>
        {/* Main terminal */}
        <div className="terminal">
          <div className="terminal-header">
            <div className="terminal-dot red" />
            <div className="terminal-dot yellow" />
            <div className="terminal-dot green" />
            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>cache estimation</span>
            <button
              onClick={() => setPaused(!paused)}
              style={{
                marginLeft: 'auto',
                padding: '2px 10px',
                borderRadius: 4,
                border: '1px solid var(--border)',
                background: paused ? 'rgba(251,191,36,0.1)' : 'transparent',
                color: paused ? 'var(--accent-amber)' : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              {paused ? 'Play' : 'Pause'}
            </button>
          </div>
          <div className="terminal-body" style={{ padding: 24, minHeight: 240 }}>
            {/* Current tool call */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Tool Call
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: 4,
                  background: 'rgba(96,165,250,0.15)',
                  color: 'var(--accent-blue)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  fontWeight: 600,
                }}>
                  {call.tool}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-primary)' }}>
                  {call.file}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                  ({call.sizeKB} KB)
                </span>
              </div>
            </div>

            {/* Estimation phase */}
            <AnimatePresence mode="wait">
              {phase === 'estimating' && (
                <motion.div
                  key="estimating"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{ marginBottom: 20 }}
                >
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Estimating
                  </div>
                  <div style={{
                    height: 4,
                    borderRadius: 2,
                    background: 'var(--bg-secondary)',
                    overflow: 'hidden',
                  }}>
                    <motion.div
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 1, ease: 'easeInOut' }}
                      style={{
                        height: '100%',
                        borderRadius: 2,
                        background: `linear-gradient(90deg, var(--accent-blue), var(--accent-amber))`,
                      }}
                    />
                  </div>
                  <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                    {call.sizeKB} KB x ~4 chars/token = ~{formatTokens(call.tokens)} tokens
                  </div>
                </motion.div>
              )}

              {phase === 'result' && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Result
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: 16,
                    borderRadius: 8,
                    border: `1px solid ${decisionColors[call.decision]}40`,
                    background: `${decisionColors[call.decision]}08`,
                  }}>
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      style={{
                        padding: '6px 16px',
                        borderRadius: 6,
                        fontSize: 16,
                        fontWeight: 800,
                        fontFamily: 'var(--font-mono)',
                        textTransform: 'uppercase',
                        color: decisionColors[call.decision],
                        background: `${decisionColors[call.decision]}15`,
                        border: `1px solid ${decisionColors[call.decision]}30`,
                      }}
                    >
                      {decisionLabels[call.decision]}
                    </motion.span>
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-primary)' }}>
                        ~{formatTokens(call.tokens)} tokens
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                        {call.reason}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Session tracker sidebar */}
        <div className="terminal">
          <div className="terminal-header">
            <div className="terminal-dot red" />
            <div className="terminal-dot yellow" />
            <div className="terminal-dot green" />
            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>session</span>
          </div>
          <div className="terminal-body" style={{ padding: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Cumulative
              </div>
              <motion.div
                key={cumulative}
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 24,
                  fontWeight: 700,
                  color: cumulative > 500000 ? 'var(--color-block)' : cumulative > 200000 ? 'var(--color-warn)' : 'var(--color-safe)',
                }}
              >
                {formatTokens(cumulative)}
              </motion.div>
              <div style={{
                marginTop: 8,
                height: 4,
                borderRadius: 2,
                background: 'var(--bg-secondary)',
                overflow: 'hidden',
              }}>
                <motion.div
                  animate={{ width: `${Math.min((cumulative / 500000) * 100, 100)}%` }}
                  transition={{ duration: 0.5 }}
                  style={{
                    height: '100%',
                    borderRadius: 2,
                    background: cumulative > 500000 ? 'var(--color-block)' : cumulative > 200000 ? 'var(--color-warn)' : 'var(--color-safe)',
                  }}
                />
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                / 500K warn threshold
              </div>
            </div>

            {/* History */}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              History
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <AnimatePresence>
                {history.map((h, i) => (
                  <motion.div
                    key={`${h.call.file}-${i}`}
                    initial={{ opacity: 0, x: -10, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: 'auto' }}
                    exit={{ opacity: 0 }}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '4px 8px',
                      borderRadius: 4,
                      background: 'var(--bg-secondary)',
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                      {h.call.file}
                    </span>
                    <span style={{ color: decisionColors[h.call.decision], fontWeight: 600, flexShrink: 0 }}>
                      {decisionLabels[h.call.decision]}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {history.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  no operations yet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Responsive override */}
      <style>{`
        @media (max-width: 768px) {
          .section > div[style*="grid-template-columns: 1fr 300px"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  )
}
