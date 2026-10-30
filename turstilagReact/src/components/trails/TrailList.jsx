import { fmtDist, fmtKm } from '../../models/worklog'
import { TRAIL_COLOR, networkNodes, totalKm, trailName } from '../../models/trails'

// Stinettverk: every segment, grouped by turområde, longest first. `onNewTrail` is admin-only.
export default function TrailList({ trails, areas, onSelect, onNewTrail }) {
  const junctions = networkNodes(trails).filter((n) => n.degree >= 3).length
  const areaName = (id) => areas.find((a) => a.id === id)?.name || 'Uten turområde'
  const groups = {}
  trails.forEach((t) => {
    const key = t.hubId ?? ''
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  })
  const groupKeys = Object.keys(groups).sort((a, b) => areaName(a).localeCompare(areaName(b), 'nb'))

  return (
    <>
      <div className="wl-heading">
        <h1 className="wl-h1">Stinettverk</h1>
        <span className="wl-mono">{trails.length} stier · {fmtKm(totalKm(trails))} km · {junctions} kryss</span>
      </div>

      {onNewTrail && (
        <div className="wl-pad"><button type="button" className="wl-dashed-btn" onClick={onNewTrail}>+ Ny sti</button></div>
      )}

      {groupKeys.map((key) => (
        <div key={key || 'none'}>
          <div className="wl-heading wl-subheading">
            <h2 className="wl-h2">{areaName(key)}</h2>
            <span className="wl-mono">{fmtKm(totalKm(groups[key]))} km</span>
          </div>
          <div className="wl-list">
            {[...groups[key]].sort((a, b) => b.lengthM - a.lengthM).map((t) => (
              <button type="button" key={t.id} className="wl-area-row wl-trail-row" onClick={() => onSelect(t.id)}>
                <span className="wl-trail-swatch" style={{ background: TRAIL_COLOR }} />
                <span className="wl-area-row-main">
                  <span className="wl-area-name">{trailName(t)}</span>
                </span>
                <span className="wl-mono">{fmtDist(t.lengthM)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      {trails.length === 0 && <p className="wl-empty">Ingen stier registrert ennå.</p>}
    </>
  )
}
