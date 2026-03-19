export function Footer() {
  return (
    <footer style={{
      padding: '40px 24px',
      borderTop: '1px solid var(--border)',
      textAlign: 'center',
      color: 'var(--text-muted)',
      fontSize: 14,
    }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <p style={{ marginBottom: 12 }}>
          <a href="https://github.com/banyudu/claude-cache" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
            claude-cache
          </a>
          {' '}&mdash; Cache-aware cost guard for Claude Code
        </p>
        <p>MIT License &middot; Made by <a href="https://github.com/banyudu" target="_blank" rel="noopener noreferrer">banyudu</a></p>
      </div>
    </footer>
  )
}
