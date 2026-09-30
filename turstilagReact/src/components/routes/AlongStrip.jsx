import { DIFFICULTY, buildStrip } from '../../models/routes'
import { plural } from '../../models/owners'

const Icon = ({ html }) => <span className="wl-ico" dangerouslySetInnerHTML={{ __html: html }} />

// "Langs ruta": the route as a bar in its difficulty colour, facilitated stretches as bands (planks,
// or solid for a bridge — the same pattern as on the map) and points as markers at their km.
export default function AlongStrip({ route, along }) {
  const strip = buildStrip(route, along)
  const passes = along.filter((a) => a.kind === 'gjerdeklyver').length
  const facilitated = Math.round(route.features.filter((f) => f.kmFra != null).reduce((sum, f) => sum + f.lengthM, 0))

  return (
    <div className="wl-along">
      <div className="wl-along-head">
        <span className="wl-label">Langs ruta</span>
        <span className="wl-mono">{plural(passes, 'kryssningspunkt', 'kryssningspunkter')} · {facilitated} m tilrettelagt</span>
      </div>
      <div className="wl-along-scroll">
        <div className="wl-along-track">
          <div className="wl-along-bar" style={{ background: DIFFICULTY[route.difficulty].color }}>
            {strip.bands.map((b) => <span key={b.key} className="wl-along-band" style={{ left: b.left, width: b.width, background: b.bg }} />)}
          </div>
          {strip.markers.map((m) => (
            <span key={m.key} className="wl-along-marker" style={{ left: m.left, background: m.color }} title={m.title}><Icon html={m.icon} /></span>
          ))}
          <div className="wl-along-axis wl-mono">{strip.axis.map((label, i) => <span key={i}>{label}</span>)}</div>
        </div>
      </div>
    </div>
  )
}
