import pencil from 'lucide-static/icons/pencil.svg?raw'
import { fmtDist } from '../../models/worklog'
import { TRAIL_COLOR, networkNodes, trailName } from '../../models/trails'

const PENCIL = pencil.slice(pencil.indexOf('<svg'))
const Icon = ({ html }) => <span className="wl-ico" dangerouslySetInnerHTML={{ __html: html }} />

const ENDS_TEXT = ['Koblet i begge ender', 'Blindsti i én ende', 'Ikke koblet til andre stier']

// One segment of the stinettverk: its length, turområde and the segments it meets at either end.
// `onEditTrail` is admin-only.
export default function TrailDetail({ trail, trails, areas, onBack, onSelect, onEditTrail }) {
  const area = areas.find((a) => a.id === trail.hubId)
  const ends = networkNodes(trails).filter((n) => n.trailIds.includes(trail.id))
  const neighbours = trails.filter((t) => t.id !== trail.id && ends.some((n) => n.trailIds.includes(t.id)))
  // A segment that loops back to itself has one node for both ends
  const deadEnds = ends.length === 1 ? 0 : ends.filter((n) => n.degree === 1).length

  const facts = [
    { key: 'Lengde', value: fmtDist(trail.lengthM) },
    area && { key: 'Turområde', value: area.name },
    { key: 'Ender', value: ENDS_TEXT[deadEnds] },
  ].filter(Boolean)

  return (
    <>
      <div className="wl-pad wl-back-row">
        <button type="button" className="wl-link-btn" onClick={onBack}>← Stinettverk</button>
      </div>
      <div className="wl-heading wl-heading-tight">
        <h1 className="wl-h1">{trailName(trail)}</h1>
        {onEditTrail && (
          <button type="button" className="wl-btn small" onClick={onEditTrail}><Icon html={PENCIL} />Rediger sti</button>
        )}
      </div>

      <div className="wl-facts">
        {facts.map((f) => (
          <div key={f.key}>
            <span className="wl-label">{f.key}</span>
            <strong>{f.value}</strong>
          </div>
        ))}
      </div>

      <div className="wl-heading wl-subheading">
        <h2 className="wl-h2">Henger sammen med</h2>
        <span className="wl-mono">{neighbours.length}</span>
      </div>
      <div className="wl-list">
        {neighbours.map((t) => (
          <button type="button" key={t.id} className="wl-area-row wl-trail-row" onClick={() => onSelect(t.id)}>
            <span className="wl-trail-swatch" style={{ background: TRAIL_COLOR }} />
            <span className="wl-area-row-main">
              <span className="wl-area-name">{trailName(t)}</span>
            </span>
            <span className="wl-mono">{fmtDist(t.lengthM)}</span>
          </button>
        ))}
        {neighbours.length === 0 && <p className="wl-empty">Stien er ikke koblet til andre stier ennå.</p>}
      </div>
    </>
  )
}
