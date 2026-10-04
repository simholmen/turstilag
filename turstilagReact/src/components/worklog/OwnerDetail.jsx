import { OWNER_ICON, daaText, plural, pointInGeometry } from '../../models/owners'
import { fmtKm, sortEntriesByDistance } from '../../models/worklog'
import { DIFFICULTY } from '../../models/routes'
import { PointRow } from '../info/InfoList'
import EntryList from './EntryList'
import pencil from 'lucide-static/icons/pencil.svg?raw'
import phoneIcon from 'lucide-static/icons/phone.svg?raw'
import mailIcon from 'lucide-static/icons/mail.svg?raw'

const PENCIL = pencil.slice(pencil.indexOf('<svg'))
const PHONE = phoneIcon.slice(phoneIcon.indexOf('<svg'))
const MAIL = mailIcon.slice(mailIcon.indexOf('<svg'))

const Icon = ({ html }) => <span className="wl-ico" dangerouslySetInnerHTML={{ __html: html }} />

// A grunneier: hero with the owner symbol, facts, call button, hensyn, routes across the land and
// the points on it. `onSelectPoint` gives the Hva finnes point rows; without it (Arbeidslogg) the
// points are the expandable worklog entries driven by `entryId`/`onToggleEntry`.
// onEditOwner / onNewParcel / onEditParcel are only passed in admin.
export default function OwnerDetail({
  owner, areas, routes = [], userLocation, entryId, backLabel = '← Alle områder', onBack, onToggleEntry, onSelectPoint,
  onSelectArea, onSelectRoute, onEditOwner, onNewParcel, onEditParcel,
}) {
  const ownerAreas = areas.filter((a) => owner.hubIds.includes(a.id))
  const ownerRoutes = routes.filter((r) => r.ownerIds.includes(owner.id))
  const here = Boolean(userLocation) && owner.parcels.some((p) => pointInGeometry([userLocation[1], userLocation[0]], p.geometry))
  const areaName = (id) => areas.find((a) => a.id === id)?.name
  const points = userLocation ? sortEntriesByDistance(owner.list, userLocation) : owner.list

  const facts = [
    ownerAreas.length > 0 && {
      key: 'Turområde',
      value: ownerAreas.map((a, i) => (
        <span key={a.id}>
          {i > 0 && ', '}
          <button type="button" className="wl-fact-link" onClick={() => onSelectArea(a.id)}>{a.name}</button>
        </span>
      )),
    },
    owner.dyr && { key: 'Dyr', value: owner.dyr },
    owner.contact && { key: 'Kontakt', value: owner.contact },
    !owner.dyr && { key: 'Areal', value: `${daaText(owner.daa)} daa` },
  ].filter(Boolean)

  return (
    <>
      <div className="wl-pad wl-back-row">
        <button type="button" className="wl-link-btn" onClick={onBack}>{backLabel}</button>
      </div>

      <div className="wl-owner-hero" style={{ '--owner': owner.color }}>
        <span className="wl-owner-hero-symbol"><Icon html={OWNER_ICON} /></span>
        {here && <span className="wl-here-pill"><span className="wl-status-dot" />Du står her</span>}
        {onEditOwner && (
          <button type="button" className="wl-hero-edit" onClick={onEditOwner}>
            <Icon html={PENCIL} />Rediger grunneier
          </button>
        )}
        <div className="wl-owner-hero-caption">
          <span className="wl-owner-badge">Grunneier</span>
          <h1>{owner.name}</h1>
        </div>
      </div>

      {facts.length > 0 && (
        <div className="wl-facts">
          {facts.map((f) => (
            <div key={f.key}>
              <span className="wl-label">{f.key}</span>
              <strong>{f.value}</strong>
            </div>
          ))}
        </div>
      )}

      {owner.phone && (
        <a href={`tel:${owner.phone.replace(/\s/g, '')}`} className="wl-call-btn">
          <Icon html={PHONE} />Ring {owner.contact || owner.name} · {owner.phone}
        </a>
      )}
      {owner.email && (
        <a
          href={`mailto:${owner.email}?subject=${encodeURIComponent(`Henvendelse fra Ålgård turstilag – ${owner.name}`)}`}
          className="wl-call-btn secondary"
        >
          <Icon html={MAIL} /><span className="truncate">Send e-post · {owner.email}</span>
        </a>
      )}

      {owner.note && (
        <div className="wl-note-card">
          <span className="wl-label">Hensyn på eiendommen</span>
          <p>{owner.note}</p>
        </div>
      )}

      {ownerRoutes.length > 0 && (
        <div className="wl-pill-section">
          <span className="wl-label">Ruter over eiendommen</span>
          <div className="wl-row wl-wrap">
            {ownerRoutes.map((r) => (
              <button key={r.id} type="button" className="wl-route-pill" onClick={() => onSelectRoute?.(r.id)}>
                <span className="wl-route-pill-line" style={{ background: DIFFICULTY[r.difficulty].color }} />
                {r.title}
                <span className="wl-mono">{fmtKm(r.km)} km</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="wl-heading wl-subheading">
        <h2 className="wl-h2">På eiendommen</h2>
        <span className="wl-mono">{points.length}</span>
      </div>
      {onSelectPoint ? (
        <div className="wl-list wl-info-list">
          {points.map((e) => <PointRow key={e.key} entry={e} areaName={areaName(e.area)} dist={e.dist} onSelect={onSelectPoint} />)}
          {points.length === 0 && <p className="wl-empty">Ingen registrerte punkter her ennå.</p>}
        </div>
      ) : (
        <EntryList entries={owner.list} entryId={entryId} onToggleEntry={onToggleEntry} emptyText="Ingen registrert arbeid her ennå." />
      )}

      <div className="wl-heading wl-subheading">
        <h2 className="wl-h2">Eiendommer</h2>
        <span className="wl-mono">{plural(owner.parcels.length, 'teig', 'teiger')} · {daaText(owner.daa)} daa</span>
      </div>

      {onNewParcel && (
        <div className="wl-pad"><button type="button" className="wl-dashed-btn" onClick={onNewParcel}>+ Ny eiendom for {owner.name}</button></div>
      )}

      <div className="wl-list wl-parcel-list">
        {owner.parcels.map((parcel) => (
          <div key={parcel.id} className="wl-parcel-row">
            <div className="wl-parcel-main">
              <div className="wl-owner-swatch-box" style={{ background: owner.fill, boxShadow: `inset 0 0 0 2px ${owner.color}` }}>{parcel.teig}</div>
              <div className="wl-area-row-main">
                <span className="wl-area-name">Teig {parcel.teig}</span>
              </div>
              <div className="wl-area-count">
                <span className="wl-big-number">{daaText(parcel.daa)}</span>
                <span className="wl-mono small">daa</span>
              </div>
            </div>
            {onEditParcel && (
              <button type="button" className="wl-icon-btn" title="Rediger eiendom" onClick={() => onEditParcel(parcel)}>
                <Icon html={PENCIL} />
              </button>
            )}
          </div>
        ))}
        {owner.parcels.length === 0 && <p className="wl-empty">Ingen eiendommer registrert ennå.</p>}
      </div>
      <p className="wl-hint wl-pad">Eiendomsgrensene er omtrentlige og kun veiledende.</p>
    </>
  )
}
