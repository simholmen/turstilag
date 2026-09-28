import { daaText, plural } from '../../models/owners'
import EntryList from './EntryList'
import pencil from 'lucide-static/icons/pencil.svg?raw'
import phoneIcon from 'lucide-static/icons/phone.svg?raw'
import mailIcon from 'lucide-static/icons/mail.svg?raw'

const PENCIL = pencil.slice(pencil.indexOf('<svg'))
const PHONE = phoneIcon.slice(phoneIcon.indexOf('<svg'))
const MAIL = mailIcon.slice(mailIcon.indexOf('<svg'))

// onEditOwner / onNewParcel / onEditParcel are only passed in admin
export default function OwnerDetail({ owner, areas, entryId, onBack, onToggleEntry, onSelectArea, onEditOwner, onNewParcel, onEditParcel }) {
  const ownerAreas = areas.filter((a) => owner.hubIds.includes(a.id))

  return (
    <>
      <div className="wl-pad wl-back-row">
        <button type="button" className="wl-link-btn" onClick={onBack}>← Alle områder</button>
      </div>

      <div className="wl-owner-card" style={{ background: owner.fill, boxShadow: `inset 0 0 0 2px ${owner.color}` }}>
        <span className="wl-label">Grunneier</span>
        <h1>{owner.name}</h1>
        {onEditOwner && (
          <button type="button" className="wl-hero-edit" onClick={onEditOwner}>
            <span className="wl-ico" dangerouslySetInnerHTML={{ __html: PENCIL }} />Rediger grunneier
          </button>
        )}
      </div>

      {ownerAreas.length > 0 && (
        <div className="wl-row wl-wrap wl-owner-areas">
          {ownerAreas.map((a) => (
            <button key={a.id} type="button" className="wl-chip square" onClick={() => onSelectArea(a.id)}>{a.name}</button>
          ))}
        </div>
      )}

      <div className="wl-stats">
        <div><span className="wl-label">Eiendommer</span><strong>{plural(owner.parcels.length, 'teig', 'teiger')}</strong></div>
        <div><span className="wl-label">Areal</span><strong>{daaText(owner.daa)} daa</strong></div>
      </div>

      <div className="wl-heading wl-subheading">
        <h2 className="wl-h2">Kontakt</h2>
        <span className="wl-mono">Hvis noe skjer på eiendommen</span>
      </div>

      <div className="wl-contact-card">
        <div className="wl-contact-row">
          <span className="wl-label">Kontaktperson</span>
          <strong>{owner.contact || '—'}</strong>
        </div>
        {owner.phone && (
          <a href={`tel:${owner.phone.replace(/\s/g, '')}`} className="wl-contact-link">
            <span className="wl-contact-link-main">
              <span className="wl-label">Telefon</span>
              <span className="wl-contact-value">{owner.phone}</span>
            </span>
            <span className="wl-contact-btn dark"><span className="wl-ico" dangerouslySetInnerHTML={{ __html: PHONE }} />Ring</span>
          </a>
        )}
        {owner.email && (
          <a
            href={`mailto:${owner.email}?subject=${encodeURIComponent(`Henvendelse fra Ålgård turstilag – ${owner.name}`)}`}
            className="wl-contact-link"
          >
            <span className="wl-contact-link-main">
              <span className="wl-label">E-post</span>
              <span className="wl-contact-value truncate">{owner.email}</span>
            </span>
            <span className="wl-contact-btn"><span className="wl-ico" dangerouslySetInnerHTML={{ __html: MAIL }} />Send e-post</span>
          </a>
        )}
        {owner.note && <p className="wl-contact-note">{owner.note}</p>}
      </div>

      <div className="wl-heading wl-subheading">
        <h2 className="wl-h2">Eiendommer</h2>
        <span className="wl-mono">{daaText(owner.daa)} daa</span>
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
                <span className="wl-ico" dangerouslySetInnerHTML={{ __html: PENCIL }} />
              </button>
            )}
          </div>
        ))}
        {owner.parcels.length === 0 && <p className="wl-empty">Ingen eiendommer registrert ennå.</p>}
      </div>
      <p className="wl-hint wl-pad">Eiendomsgrensene er omtrentlige og kun veiledende.</p>

      <div className="wl-heading wl-subheading">
        <h2 className="wl-h2">Arbeid på eiendommen</h2>
        <span className="wl-mono">{plural(owner.count, 'innsats', 'innsatser')}</span>
      </div>

      <EntryList entries={owner.list} entryId={entryId} onToggleEntry={onToggleEntry} emptyText="Ingen registrert arbeid her ennå." />
    </>
  )
}
