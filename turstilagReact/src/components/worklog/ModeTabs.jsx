// Segmented control for the app's top-level modes. `modes` is [{ id, label, icon }] with raw lucide SVG icons.
const svg = (raw) => raw.slice(raw.indexOf('<svg'))

export default function ModeTabs({ modes, active, onChange }) {
  return (
    <nav className="wl-mode-tabs" aria-label="Visning">
      {modes.map((m) => (
        <button
          key={m.id}
          type="button"
          className={`wl-mode-tab ${active === m.id ? 'on' : ''}`}
          aria-current={active === m.id ? 'page' : undefined}
          onClick={() => onChange(m.id)}
        >
          {m.icon && <span className="wl-ico" dangerouslySetInnerHTML={{ __html: svg(m.icon) }} />}
          <span className="wl-mode-tab-label">{m.label}</span>
        </button>
      ))}
    </nav>
  )
}
