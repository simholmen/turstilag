import { imageUrl } from '../../lib/images'
import { TYPES, fmtKm } from '../../models/worklog'
import { DIFFICULTY, SHAPES, fmtTime } from '../../models/routes'

const Icon = ({ html }) => <span className="wl-ico" dangerouslySetInnerHTML={{ __html: html }} />

// Turruter list. Lengths and point counts all come from the database views. `onNewRoute` is admin-only.
export default function RouteList({ routes, difficulty, onDifficulty, onSelect, onNewRoute, heading = true }) {
  const shown = difficulty ? routes.filter((r) => r.difficulty === difficulty) : routes
  const totalKm = routes.reduce((sum, r) => sum + r.km, 0)
  const counts = {}
  routes.forEach((r) => { counts[r.difficulty] = (counts[r.difficulty] || 0) + 1 })

  return (
    <>
      <div className={`wl-heading ${heading ? '' : 'wl-subheading'}`}>
        {heading ? <h1 className="wl-h1">Turruter</h1> : <h2 className="wl-h2">Turruter</h2>}
        <span className="wl-mono">{routes.length} ruter · {fmtKm(totalKm)} km</span>
      </div>

      <div className="wl-row wl-pad wl-diff-chips">
        {Object.entries(DIFFICULTY).map(([key, d]) => (
          <button
            key={key}
            type="button"
            className={`wl-chip pill ${difficulty === key ? 'on' : ''}`}
            style={{ opacity: counts[key] ? 1 : 0.45 }}
            aria-pressed={difficulty === key}
            onClick={() => onDifficulty(difficulty === key ? null : key)}
          >
            <span className="wl-diff-swatch" style={{ background: d.color }} />{d.label}
            <span className="wl-mono-inline">{counts[key] || 0}</span>
          </button>
        ))}
      </div>

      {onNewRoute && (
        <div className="wl-pad"><button type="button" className="wl-dashed-btn" onClick={onNewRoute}>+ Ny turrute</button></div>
      )}

      <div className="wl-list wl-route-list">
        {shown.map((route) => (
          <button type="button" key={route.id} className="wl-area-row wl-route-row" onClick={() => onSelect(route.id)}>
            <div className="wl-thumb wl-hatch wl-route-thumb" style={{ '--diff': DIFFICULTY[route.difficulty].color }}>
              {route.images[0] && <img src={imageUrl(route.images[0])} alt="" loading="lazy" />}
            </div>
            <div className="wl-area-row-main">
              <span className="wl-area-name">{route.title}</span>
              <span className="wl-mono">{DIFFICULTY[route.difficulty].label} · {SHAPES[route.shape]} · {fmtTime(route.km, route.climb)}</span>
              <div className="wl-route-badges">
                <span className="wl-route-badge" title="Kryssningspunkter" style={{ background: TYPES.gjerdeklyver.color }}>
                  <Icon html={TYPES.gjerdeklyver.icon} />{route.gjerdeCount}
                </span>
                <span className="wl-route-badge" title="Tilrettelegginger" style={{ background: TYPES.tilrettelegging.color }}>
                  <Icon html={TYPES.tilrettelegging.icon} />{route.tilretteCount}
                </span>
              </div>
            </div>
            <div className="wl-area-count">
              <span className="wl-big-number">{fmtKm(route.km)}</span>
              <span className="wl-mono small">km</span>
            </div>
          </button>
        ))}
        {shown.length === 0 && <p className="wl-empty">{routes.length ? 'Ingen ruter med valgt vanskelighetsgrad.' : 'Ingen turruter registrert ennå.'}</p>}
      </div>
    </>
  )
}
