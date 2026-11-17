import { LINE_COLORS, LINE_KINDS, LINE_LAYER_ORDER, TRAIL_COLOR, lineLayers } from '../../models/networks'

// A short piece of line in a stinettverk style, for the picker and the legend — drawn like the map does
export function LineSwatch({ color, kind, width = 34 }) {
  const layers = lineLayers(kind, LINE_COLORS[color]?.color || TRAIL_COLOR)
  // Inset by the track's round cap so the ends aren't clipped
  const inset = layers.track.weight / 2
  const height = 14
  return (
    <svg className="wl-legend-swatch" style={{ width, height }} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {LINE_LAYER_ORDER.map((key) => {
        const layer = layers[key]
        return (
          <line
            key={key}
            x1={inset} y1={height / 2} x2={width - inset} y2={height / 2}
            stroke={layer.color}
            strokeOpacity={layer.opacity}
            strokeWidth={layer.weight}
            strokeDasharray={layer.dashArray || undefined}
            strokeLinecap={layer.lineCap}
          />
        )
      })}
    </svg>
  )
}

// Colour and line type for a stretch of a stinettverk. A null value is a network where it varies:
// nothing is selected until one is picked.
export default function StylePicker({ label, color, kind, onChange, hint }) {
  return (
    <div className="wl-field">
      <span className="wl-label">{label}</span>
      <div className="wl-segmented wl-colour-picker">
        {Object.entries(LINE_COLORS).map(([key, c]) => (
          <button key={key} type="button" className={color === key ? 'on' : ''} aria-pressed={color === key} onClick={() => onChange({ color: key })}>
            <span className="wl-diff-swatch" style={{ background: c.color }} />{c.meaning}
          </button>
        ))}
      </div>
      <div className="wl-segmented wl-kind-picker">
        {Object.entries(LINE_KINDS).map(([key, k]) => (
          <button key={key} type="button" className={kind === key ? 'on' : ''} aria-pressed={kind === key} onClick={() => onChange({ kind: key })}>
            <LineSwatch color={color} kind={key} width={30} />{k.label}
          </button>
        ))}
      </div>
      {hint && <span className="wl-hint">{hint}</span>}
    </div>
  )
}
