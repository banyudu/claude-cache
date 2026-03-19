import { useState } from 'react'
import { motion } from 'framer-motion'

const levels = [
  {
    name: 'Pass',
    desc: 'Operations under the warn threshold proceed silently',
    examples: ['< 40K tokens', '< 160 KB file'],
    color: 'var(--color-safe)',
    threshold: 'warnTokens: 40,000',
  },
  {
    name: 'Warn',
    desc: 'Large operations prompt for confirmation before proceeding',
    examples: ['40K-400K tokens', '160KB-1.6MB file'],
    color: 'var(--color-warn)',
    threshold: 'warnTokens-blockTokens',
  },
  {
    name: 'Block',
    desc: 'Extremely large operations are denied to protect the cache',
    examples: ['> 400K tokens', '> 1.6 MB file'],
    color: 'var(--color-block)',
    threshold: 'blockTokens: 400,000',
  },
  {
    name: 'Cumulative Warn',
    desc: 'When session total exceeds threshold, all subsequent operations trigger warnings',
    examples: ['session > 500K tokens', 'escalating alerts'],
    color: 'var(--accent-amber)',
    threshold: 'warnCumulativeTokens: 500,000',
  },
  {
    name: 'CLAUDE.md Protection',
    desc: 'Always prompts before modifying CLAUDE.md files — they anchor the prompt cache',
    examples: ['Edit CLAUDE.md', 'Write .claude/CLAUDE.md'],
    color: 'var(--color-protect)',
    threshold: 'protectClaudeMd: true',
  },
]

export function Thresholds() {
  const [activeIdx, setActiveIdx] = useState(-1)

  return (
    <section className="section">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="section-title">Threshold Levels</h2>
        <p className="section-subtitle">
          Operations are evaluated against configurable thresholds. Each level escalates the response.
        </p>
      </motion.div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 700 }}>
        {levels.map((level, i) => (
          <motion.div
            key={level.name}
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.4, delay: i * 0.1, type: 'spring', stiffness: 200 }}
            onMouseEnter={() => setActiveIdx(i)}
            onMouseLeave={() => setActiveIdx(-1)}
            style={{
              padding: 20,
              borderRadius: 10,
              border: `1px solid ${activeIdx === i ? level.color : 'var(--border)'}`,
              background: activeIdx === i ? `${level.color}08` : 'var(--bg-card)',
              cursor: 'default',
              transition: 'border-color 0.2s, background 0.2s',
              position: 'relative',
            }}
          >
            {/* Priority indicator */}
            <div style={{
              position: 'absolute',
              top: 20,
              left: -12,
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: 'var(--bg-primary)',
              border: `2px solid ${level.color}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: level.color,
            }}>
              {i + 1}
            </div>

            {/* Connecting line */}
            {i < levels.length - 1 && (
              <div style={{
                position: 'absolute',
                bottom: -13,
                left: -1,
                width: 2,
                height: 13,
                background: 'var(--border)',
              }} />
            )}

            <div style={{ marginLeft: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 15, color: level.color }}>
                    {level.name}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: 'var(--bg-terminal)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                  }}>
                    {level.threshold}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {level.desc}
                </div>
              </div>

              <motion.div
                initial={false}
                animate={{ opacity: activeIdx === i ? 1 : 0.5, y: activeIdx === i ? 0 : 4 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
              >
                {level.examples.map((ex) => (
                  <span
                    key={ex}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 4,
                      background: 'var(--bg-terminal)',
                      border: '1px solid var(--border)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ex}
                  </span>
                ))}
              </motion.div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
