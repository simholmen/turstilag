import { LINE_COLORS, LINE_KINDS, TRAIL_COLOR } from '../../models/networks'

// A short piece of line in a stinettverk style, for the picker and the legend
export function LineSwatch({ color, kind, width = 34 }) {
  const stroke = LINE_COLORS[color]?.color || TRAIL_COLOR
  return (
    <svg className="wl-legend-swatch" width={width} height="12" viewBox={`0 0 ${width} 12`} aria-hidden="true">
      <line x1="0" y1="6" x2={width} y2="6" stroke="#fff" strokeWidth="7" />
      <line x1="0" y1="6" x2={width} y2="6" stroke={stroke} strokeWidth="4" strokeDasharray={LINE_KINDS[kind]?.dash || undefined} />
    </svg>
  )
}

// Colour and line type for a stretch of a stinettverk. A null value is a network where it varies:
// nothing is selected until one is picked.
export default function StylePicker({ label, color, kind, onChange, hint }) {
  return (
    <div className="wl-field">
      <span className="wl-label">{label}</span>
      <div className="wl-segmented">
        {Object.entries(LINE_COLORS).map(([key, c]) => (
          <button key={key} type="button" className={color === key ? 'on' : ''} aria-pressed={color === key} onClick={() => onChange({ color: key })}>
            <span className="wl-diff-swatch" style={{ background: c.color }} />{c.label}
          </button>
        ))}
      </div>
      <div className="wl-segmented wl-kind-picker">
        {Object.entries(LINE_KINDS).map(([key, k]) => (
          <button key={key} type="button" className={kind === key ? 'on' : ''} aria-pressed={kind === key} onClick={() => onChange({ kind: key })}>
            <LineSwatch color={color} kind={key} width={22} />{k.label}
          </button>
        ))}
      </div>
      {hint && <span className="wl-hint">{hint}</span>}
    </div>
  )
}
