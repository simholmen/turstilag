import ModeTabs from './ModeTabs'

// `modes`/`mode`/`onMode` render the public mode switcher; admin passes a `badge` instead
export default function SiteHeader({ children, badge, modes, mode, onMode }) {
  return (
    <header className="wl-header">
      <div className="wl-header-brand">
        <a href="https://atursti.no/" className="wl-logo-link">
          <img src="/assets/logo.png" alt="Ålgård turstilag – lett på tur" className="wl-logo" />
        </a>
        {badge && <span className="wl-admin-badge">{badge}</span>}
      </div>
      {modes && <ModeTabs modes={modes} active={mode} onChange={onMode} />}
      <div className="wl-header-right">{children}</div>
    </header>
  )
}
