import {
  TYPES, entrySubtypeLabel, fmtArea, fmtDist, formatDate, hasField, subtypeAbout, subtypeLabel,
} from '../../models/worklog'
import { pointInGeometry } from '../../models/owners'
import { DIFFICULTY } from '../../models/routes'
import ImageGallery from './ImageGallery'
import OwnerSymbol from '../worklog/OwnerSymbol'
import pencil from 'lucide-static/icons/pencil.svg?raw'

const PENCIL = pencil.slice(pencil.indexOf('<svg'))

// One skeleton for every kind — which fact cards show depends on the entry's kind, subtype and
// geometry. `onEditEntry` is only passed in admin.
export default function PointDetail({ entry, areas, owners, parcels, routes, onBack, onSelectArea, onSelectOwner, onSelectRoute, onEditEntry }) {
  const t = TYPES[entry.type] || TYPES.annet
  const sub = entrySubtypeLabel(entry)
  // One "Om …" box per subtype that has shared copy (Annen type is described in the entry's own text)
  const abouts = entry.subtypes
    .map((s) => ({ key: s, label: subtypeLabel(entry.type, s), about: subtypeAbout(entry.type, s) }))
    .filter((a) => a.about)
  const area = areas.find((a) => a.id === entry.area)
  const lngLat = entry.ll && [entry.ll[1], entry.ll[0]]
  const ownersHere = lngLat
    ? owners.filter((o) => parcels.some((p) => p.ownerId === o.id && pointInGeometry(lngLat, p.geometry)))
    : []
  const onRoutes = routes.filter((r) => r.features.some((f) => f.key === entry.key))

  const facts = [
    sub && { key: entry.subtypes.length > 1 ? 'Typer' : 'Type', value: sub },
    area && { key: 'Turområde', value: area.name, onClick: () => onSelectArea(area.id) },
    entry.geomType === 'line' && entry.lengthM > 0 && { key: 'Lengde', value: fmtDist(entry.lengthM) },
    entry.geomType === 'poly' && entry.areaM2 > 0 && { key: 'Areal', value: fmtArea(entry.areaM2) },
    hasField(entry.type, 'plasser') && entry.plasser && { key: 'Plasser', value: entry.plasser },
    hasField(entry.type, 'hund') && entry.hund && { key: 'Hund', value: entry.hund },
  ].filter(Boolean)

  return (
    <>
      <div className="wl-pad wl-back-row">
        <button type="button" className="wl-link-btn" onClick={onBack}>← Alle {t.plural.toLowerCase()}</button>
      </div>

      <ImageGallery key={entry.key} images={entry.images} type={entry.type}>
        {onEditEntry && (
          <button type="button" className="wl-hero-edit" onClick={() => onEditEntry(entry)}>
            <span className="wl-ico" dangerouslySetInnerHTML={{ __html: PENCIL }} />Rediger punkt
          </button>
        )}
        <div className="wl-hero-caption">
          <span className="wl-hero-badge" style={{ background: t.color }}>{sub ? `${t.label} · ${sub}` : t.label}</span>
          <h1>{entry.title}</h1>
        </div>
      </ImageGallery>

      {facts.length > 0 && (
        <div className="wl-facts">
          {facts.map((f) => (
            <div key={f.key}>
              <span className="wl-label">{f.key}</span>
              {f.onClick
                ? <button type="button" className="wl-fact-link" onClick={f.onClick}>{f.value}</button>
                : <strong>{f.value}</strong>}
            </div>
          ))}
        </div>
      )}

      {ownersHere.map((o) => (
        <button key={o.id} type="button" className="wl-crosslink-card" onClick={() => onSelectOwner(o.id)}>
          <OwnerSymbol color={o.color} size={40} />
          <span className="wl-area-row-main">
            <span className="wl-label">Grunneier her</span>
            <span className="wl-area-name">{o.name}</span>
          </span>
          <span className="wl-crosslink-arrow">→</span>
        </button>
      ))}

      {entry.desc && <p className="wl-area-desc">{entry.desc}</p>}

      {abouts.map((a) => (
        <div key={a.key} className="wl-about-box">
          <span className="wl-label">Om {a.label.toLowerCase()}</span>
          <p>{a.about}</p>
        </div>
      ))}

      {onRoutes.length > 0 && (
        <>
          <div className="wl-heading wl-subheading">
            <h2 className="wl-h2">Ligger på</h2>
          </div>
          <div className="wl-row wl-wrap wl-pad">
            {onRoutes.map((r) => (
              <button key={r.id} type="button" className="wl-chip pill wl-route-chip" onClick={() => onSelectRoute(r.id)}>
                <span className="wl-diff-swatch" style={{ background: DIFFICULTY[r.difficulty].color }} />{r.title}
              </button>
            ))}
          </div>
        </>
      )}

      <p className="wl-mono wl-pad wl-updated">Sist oppdatert {formatDate((entry.date || entry.updatedAt || '').slice(0, 10) || null)}</p>
    </>
  )
}
