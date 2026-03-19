import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const examples = [
  { tool: 'Read', file: 'src/index.ts', tokens: '~2,400 tokens', decision: 'safe' as const },
  { tool: 'Read', file: 'node_modules/lodash/lodash.js', tokens: '~160,000 tokens', decision: 'warn' as const },
  { tool: 'Edit', file: 'CLAUDE.md', tokens: 'cache anchor', decision: 'protect' as const },
  { tool: 'Write', file: 'dist/bundle.min.js', tokens: '~520,000 tokens', decision: 'block' as const },
  { tool: 'Read', file: 'package.json', tokens: '~800 tokens', decision: 'safe' as const },
]

const decisionLabels = {
  safe: 'PASS',
  warn: 'WARN',
  block: 'BLOCK',
  protect: 'PROTECT',
}

const decisionColors = {
  safe: 'var(--color-safe)',
  warn: 'var(--color-warn)',
  block: 'var(--color-block)',
  protect: 'var(--color-protect)',
}

export function Hero() {
  const [exampleIdx, setExampleIdx] = useState(0)
  const [displayedChars, setDisplayedChars] = useState(0)
  const [showDecision, setShowDecision] = useState(false)
  const [copied, setCopied] = useState(false)

  const example = examples[exampleIdx]
  const fullText = `${example.tool}("${example.file}")`

  useEffect(() => {
    setDisplayedChars(0)
    setShowDecision(false)
    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayedChars(i)
      if (i >= fullText.length) {
        clearInterval(interval)
        setTimeout(() => setShowDecision(true), 300)
      }
    }, 35)
    return () => clearInterval(interval)
  }, [exampleIdx, fullText.length])

  useEffect(() => {
    if (!showDecision) return
    const timer = setTimeout(() => {
      setExampleIdx((i) => (i + 1) % examples.length)
    }, 2200)
    return () => clearTimeout(timer)
  }, [showDecision])

  const copyInstall = useCallback(() => {
    navigator.clipboard.writeText('/plugin marketplace add banyudu/claude-cache\n/plugin install cache@claude-cache')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  return (
    <section style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Gradient background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(251,191,36,0.12), transparent)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse 60% 40% at 70% 80%, rgba(167,139,250,0.08), transparent)',
        pointerEvents: 'none',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ textAlign: 'center', position: 'relative', zIndex: 1, maxWidth: 800 }}
      >
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 16px',
          borderRadius: 20,
          background: 'rgba(251,191,36,0.1)',
          border: '1px solid rgba(251,191,36,0.2)',
          fontSize: 13,
          color: 'var(--accent-amber)',
          fontWeight: 500,
          marginBottom: 24,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-safe)', display: 'inline-block' }} />
          Claude Code Plugin
        </div>

        <h1 style={{
          fontSize: 'clamp(2.5rem, 6vw, 4rem)',
          fontWeight: 800,
          lineHeight: 1.1,
          marginBottom: 20,
          background: 'linear-gradient(135deg, #fff 0%, var(--accent-amber) 50%, var(--color-warn) 100%)',
          backgroundSize: '200% 200%',
          animation: 'gradientShift 6s ease infinite',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          Claude Cache
        </h1>

        <p style={{
          fontSize: 'clamp(1.1rem, 2.5vw, 1.3rem)',
          color: 'var(--text-secondary)',
          maxWidth: 560,
          margin: '0 auto 48px',
          lineHeight: 1.6,
        }}>
          Cache-aware cost guard — estimates token impact,
          warns on expensive ops, protects your cache budget.
        </p>

        {/* Terminal demo */}
        <div className="terminal" style={{ maxWidth: 640, margin: '0 auto 36px', textAlign: 'left' }}>
          <div className="terminal-header">
            <div className="terminal-dot red" />
            <div className="terminal-dot yellow" />
            <div className="terminal-dot green" />
            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>cache guard</span>
          </div>
          <div className="terminal-body" style={{ minHeight: 100 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--accent-cyan)', userSelect: 'none' }}>{'>'}</span>
              <span style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                {fullText.slice(0, displayedChars)}
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse' }}
                  style={{ display: 'inline-block', width: 8, height: 18, background: 'var(--text-primary)', verticalAlign: 'text-bottom', marginLeft: 2 }}
                />
              </span>
            </div>
            <AnimatePresence mode="wait">
              {showDecision && (
                <motion.div
                  key={`decision-${exampleIdx}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: 'var(--text-muted)',
                  }}>
                    {example.tokens}
                  </span>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 14px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: decisionColors[example.decision],
                    background: `${decisionColors[example.decision]}15`,
                    border: `1px solid ${decisionColors[example.decision]}40`,
                  }}>
                    {decisionLabels[example.decision]}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Install */}
        <motion.button
          onClick={copyInstall}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 28px',
            borderRadius: 10,
            border: '1px solid var(--border-glow)',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            cursor: 'pointer',
            transition: 'border-color 0.2s',
          }}
        >
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <span><span style={{ color: 'var(--text-muted)' }}>&gt;</span> /plugin marketplace add banyudu/claude-cache</span>
            <span><span style={{ color: 'var(--text-muted)' }}>&gt;</span> /plugin install cache@claude-cache</span>
          </span>
          <span style={{ color: copied ? 'var(--color-safe)' : 'var(--text-muted)', fontSize: 12, minWidth: 40, alignSelf: 'center' }}>
            {copied ? 'Copied!' : 'Copy'}
          </span>
        </motion.button>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 24, fontSize: 14 }}>
          <a href="https://github.com/banyudu/claude-cache" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--text-secondary)' }}>
            GitHub
          </a>
          <a href="https://www.npmjs.com/package/claude-cache" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--text-secondary)' }}>
            npm
          </a>
        </div>
      </motion.div>
    </section>
  )
}
