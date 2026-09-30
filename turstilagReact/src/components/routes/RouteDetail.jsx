import { imageUrl } from '../../lib/images'
import { fmtKm } from '../../models/worklog'
import { DIFFICULTY, buildAlong, fmtTime } from '../../models/routes'
import KindSquare from '../info/KindSquare'
import AlongStrip from './AlongStrip'
import pencil from 'lucide-static/icons/pencil.svg?raw'

const PENCIL = pencil.slice(pencil.indexOf('<svg'))

// Route detail (design 2b): stats, the "Langs ruta" strip, and everything along the route in km
// order. `onEditRoute` is admin-only.
export default function RouteDetail({ route, owners, onBack, onSelectPoint, onSelectOwner, onEditRoute }) {
  const along = buildAlong(route)
  const routeOwners = owners.filter((o) => route.ownerIds.includes(o.id))

  return (
    <>
      <div className="wl-pad wl-back-row">
        <button type="button" className="wl-link-btn" onClick={onBack}>← Alle turruter</button>
      </div>

      <div className="wl-hero wl-hatch">
        {route.images[0] && <img src={imageUrl(route.images[0])} alt="" />}
        {onEditRoute && (
          <button type="button" className="wl-hero-edit" onClick={onEditRoute}>
            <span className="wl-ico" dangerouslySetInnerHTML={{ __html: PENCIL }} />Rediger rute
          </button>
        )}
        <div className="wl-hero-caption">
          <span className="wl-hero-badge" style={{ background: DIFFICULTY[route.difficulty].color }}>{route.badge}</span>
          <h1>{route.title}</h1>
        </div>
      </div>

      <div className="wl-stats wl-stats-3">
        <div><span className="wl-label">Lengde</span><strong>{fmtKm(route.km)} km</strong></div>
        <div><span className="wl-label">Tid</span><strong>{fmtTime(route.km, route.climb)}</strong></div>
        <div><span className="wl-label">Stigning</span><strong>{route.climb || '—'}</strong></div>
      </div>

      {route.desc && <p className="wl-area-desc">{route.desc}</p>}

      <AlongStrip route={route} along={along} />

      <div className="wl-heading wl-subheading">
        <h2 className="wl-h2">Underveis</h2>
        {route.direction && <span className="wl-mono">{route.direction}</span>}
      </div>
      <div className="wl-list wl-underveis">
        {along.map((a) => (
          <button key={a.key} type="button" className="wl-underveis-row" onClick={() => onSelectPoint(a.key)}>
            <span className="wl-mono wl-underveis-km">{a.kmTo != null ? `${fmtKm(a.km)}–${fmtKm(a.kmTo)}` : `km ${fmtKm(a.km)}`}</span>
            <KindSquare type={a.kind} size={24} />
            <span className="wl-area-row-main">
              <span className="wl-entry-title">{a.title}</span>
              <span className="wl-mono">{a.sub}</span>
            </span>
          </button>
        ))}
        {along.length === 0 && <p className="wl-empty">Ingen registrerte punkter langs ruta ennå.</p>}
      </div>

      {routeOwners.length > 0 && (
        <>
          <div className="wl-heading wl-subheading">
            <h2 className="wl-h2">Grunneiere langs ruta</h2>
          </div>
          <div className="wl-list">
            {routeOwners.map((o) => (
              <button key={o.id} type="button" className="wl-area-row" onClick={() => onSelectOwner(o.id)}>
                <div className="wl-owner-swatch-box" style={{ background: o.fill, boxShadow: `inset 0 0 0 2px ${o.color}` }}>{o.name.charAt(0).toUpperCase()}</div>
                <div className="wl-area-row-main">
                  <span className="wl-area-name">{o.name}</span>
                  <span className="wl-mono">{[o.dyr, o.phone].filter(Boolean).join(' · ') || 'Ingen kontaktinfo'}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
