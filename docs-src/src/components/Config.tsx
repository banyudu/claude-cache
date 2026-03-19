import { motion } from 'framer-motion'

const configLines = [
  { text: '# .claude/cache-control.yaml', color: 'var(--text-muted)' },
  { text: '', color: '' },
  { text: 'thresholds:', color: 'var(--accent-purple)' },
  { text: '  warnTokens: 80000', color: 'var(--color-warn)' },
  { text: '  blockTokens: 800000', color: 'var(--color-block)' },
  { text: '  warnCumulativeTokens: 1000000', color: 'var(--accent-amber)' },
  { text: '', color: '' },
  { text: 'protectClaudeMd: true', color: 'var(--color-protect)' },
  { text: '', color: '' },
  { text: '# Per-tool overrides', color: 'var(--text-muted)' },
  { text: 'tools:', color: 'var(--accent-purple)' },
  { text: '  Read:', color: 'var(--accent-cyan)' },
  { text: '    warnTokens: 100000', color: 'var(--color-warn)' },
  { text: '  Write:', color: 'var(--accent-cyan)' },
  { text: '    warnTokens: 20000', color: 'var(--color-warn)' },
  { text: '  Edit:', color: 'var(--accent-cyan)' },
  { text: '    warnTokens: 40000', color: 'var(--color-warn)' },
]

export function Config() {
  return (
    <section className="section">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="section-title">Fully Configurable</h2>
        <p className="section-subtitle">
          Override defaults with YAML config. Per-user or per-project, with per-tool overrides.
        </p>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>
        {/* Config file */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
        >
          <div className="terminal">
            <div className="terminal-header">
              <div className="terminal-dot red" />
              <div className="terminal-dot yellow" />
              <div className="terminal-dot green" />
              <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>cache-control.yaml</span>
            </div>
            <div className="terminal-body" style={{ padding: '16px 20px' }}>
              {configLines.map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.03, duration: 0.3 }}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    lineHeight: 1.7,
                    color: line.color || 'transparent',
                    minHeight: line.text ? undefined : 12,
                    whiteSpace: 'pre',
                  }}
                >
                  {line.text}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Config features */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 16 }}
        >
          {[
            {
              title: 'Layered Config',
              path: 'project > user > built-in defaults',
              desc: 'Project-level config overrides user-level, which extends built-in defaults. Zero config required to get started.',
            },
            {
              title: 'Config Paths',
              path: '~/.claude/cache-control.yaml · .claude/cache-control.yaml',
              desc: 'Global thresholds across all projects or project-specific tuning checked into your repo.',
            },
            {
              title: 'Per-Tool Overrides',
              path: 'tools.Read · tools.Write · tools.Edit',
              desc: 'Set different thresholds for each tool. Allow larger reads but warn earlier on writes.',
            },
            {
              title: 'CLAUDE.md Protection',
              path: 'protectClaudeMd: true',
              desc: 'CLAUDE.md files anchor the prompt cache. Always confirm before modifying them.',
            },
            {
              title: 'Session Tracking',
              path: '/status · /reset',
              desc: 'View cumulative token impact with /status, reset counters with /reset.',
            },
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + i * 0.1 }}
              style={{
                padding: 16,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{feature.title}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-cyan)', marginBottom: 6 }}>
                {feature.path}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {feature.desc}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Responsive override for mobile */}
      <style>{`
        @media (max-width: 768px) {
          .section > div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  )
}
