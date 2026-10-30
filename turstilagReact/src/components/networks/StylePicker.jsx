import { LINE_COLORS, LINE_KINDS, TRAIL_COLOR, lineLayers } from '../../models/networks'

// A short piece of line in a stinettverk style, for the picker and the legend — drawn like the map does
export function LineSwatch({ color, kind, width = 34 }) {
  const stroke = LINE_COLORS[color]?.color || TRAIL_COLOR
  const { halo, line } = lineLayers(kind)
  // Inset by the halo's round cap so the ends aren't clipped
  const x1 = halo.weight / 2
  const x2 = width - halo.weight / 2
  return (
    <svg className="wl-legend-swatch" width={width} height="12" viewBox={`0 0 ${width} 12`} aria-hidden="true">
      {[[halo, '#fff'], [line, stroke]].map(([layer, colour]) => (
        <line
          key={colour}
          x1={x1} y1="6" x2={x2} y2="6"
          stroke={colour}
          strokeWidth={layer.weight}
          strokeDasharray={layer.dashArray || undefined}
          strokeLinecap={layer.lineCap}
        />
      ))}
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
