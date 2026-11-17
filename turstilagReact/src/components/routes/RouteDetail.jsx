import { imageUrl } from '../../lib/images'
import { fmtKm } from '../../models/worklog'
import { DIFFICULTY, buildAlong, fmtTime, routeVariant } from '../../models/routes'
import KindSquare from '../info/KindSquare'
import AlongStrip from './AlongStrip'
import pencil from 'lucide-static/icons/pencil.svg?raw'

const PENCIL = pencil.slice(pencil.indexOf('<svg'))

// Which way to walk it, for a route with variants: each with its length and time, the chosen one marked
function VariantChooser({ route, variantId, onSelect }) {
  return (
    <div className="wl-variants" role="radiogroup" aria-label="Velg variant">
      {route.variants.map((v) => {
        const on = (variantId ?? null) === v.id
        const difficulty = v.difficulty || route.difficulty
        return (
          <button
            key={v.id ?? 'standard'}
            type="button"
            role="radio"
            aria-checked={on}
            className={`wl-variant-row ${on ? 'on' : ''}`}
            onClick={() => onSelect(v.id)}
          >
            <span className="wl-variant-check" aria-hidden="true" />
            <span className="wl-diff-swatch" style={{ background: DIFFICULTY[difficulty].color }} title={DIFFICULTY[difficulty].label} />
            <span className="wl-area-row-main">
              <span className="wl-entry-title">{v.name}</span>
              {on && v.desc && <span className="wl-variant-desc">{v.desc}</span>}
            </span>
            <span className="wl-mono wl-variant-stats">{fmtKm(v.km)} km · {fmtTime(v.km, v.climb || route.climb)}</span>
          </button>
        )
      })}
    </div>
  )
}

// Route detail (design 2b): stats, the "Langs ruta" strip, and everything along the route in km
// order — all for the chosen variant (`variantId`, null for Standard). `onEditRoute` is admin-only.
export default function RouteDetail({ route: wholeRoute, variantId, onSelectVariant, owners, onBack, onSelectPoint, onSelectOwner, onEditRoute }) {
  const route = routeVariant(wholeRoute, variantId)
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

      {wholeRoute.variants.length > 1 && (
        <>
          <div className="wl-heading wl-subheading">
            <h2 className="wl-h2">Varianter</h2>
            <span className="wl-mono">Trykk i kartet eller her</span>
          </div>
          <VariantChooser route={wholeRoute} variantId={route.variantId} onSelect={onSelectVariant} />
        </>
      )}

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
            <h2 className="wl-h2">Eiendommer langs ruta</h2>
          </div>
          <div className="wl-list">
            {routeOwners.map((o) => (
              <button key={o.id} type="button" className="wl-area-row" onClick={() => onSelectOwner(o.id)}>
                <div className="wl-owner-swatch-box" style={{ background: o.fill, boxShadow: `inset 0 0 0 2px ${o.color}` }}>{o.name.charAt(0).toUpperCase()}</div>
                <div className="wl-area-row-main">
                  <span className="wl-area-name">{o.name}</span>
                  <span className="wl-mono">{[o.dyr, o.contacts.find((c) => c.phone)?.phone].filter(Boolean).join(' · ') || 'Ingen kontaktinfo'}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
