import { imageUrl } from '../../lib/images'
import { daaText, plural } from '../../models/owners'
import TypeDot from './TypeDot'
import EntryList from './EntryList'
import pencil from 'lucide-static/icons/pencil.svg?raw'
import listIcon from 'lucide-static/icons/list.svg?raw'

const PENCIL = pencil.slice(pencil.indexOf('<svg'))
const LIST = listIcon.slice(listIcon.indexOf('<svg'))

// onEditArea / onNewEntry / onEditEntry are only passed in admin. `layers` decides whether the
// Grunneiere and Utført arbeid sections show at all — they mirror the map's layer toggles.
export default function AreaDetail({
  area, areaOwners = [], layers, entryId, filter, onBack, onFilter, onToggleEntry, onSelectOwner, onEditArea, onNewEntry, onEditEntry,
}) {
  const entries = area.list.filter((e) => !filter || e.type === filter)
  const chips = [{ key: null, label: 'Alle', count: area.count }, ...area.types]

  return (
    <>
      <div className="wl-pad wl-back-row">
        <button type="button" className="wl-link-btn" onClick={onBack}>← Alle områder</button>
      </div>

      <div className="wl-hero wl-hatch">
        {area.images[0] && <img src={imageUrl(area.images[0])} alt="" />}
        {onEditArea && (
          <button type="button" className="wl-hero-edit" onClick={onEditArea}>
            <span className="wl-ico" dangerouslySetInnerHTML={{ __html: PENCIL }} />Rediger område
          </button>
        )}
        <div className="wl-hero-caption"><h1>{area.name}</h1></div>
      </div>

      <div className="wl-stats">
        <div><span className="wl-label">Registrert arbeid</span><strong>{area.count} innsatser</strong></div>
        <div><span className="wl-label">Siste arbeid</span><strong>{area.last}</strong></div>
      </div>

      {area.desc && <p className="wl-area-desc">{area.desc}</p>}

      {layers.owners && (
        <>
          <div className="wl-heading wl-subheading">
            <h2 className="wl-h2">Grunneiere</h2>
            <span className="wl-mono">{plural(areaOwners.length, 'grunneier', 'grunneiere')}</span>
          </div>
          <div className="wl-list">
            {areaOwners.map((o) => (
              <button key={o.id} type="button" className="wl-area-row" onClick={() => onSelectOwner(o.id)}>
                <div className="wl-owner-swatch-box" style={{ background: o.fill, boxShadow: `inset 0 0 0 2px ${o.color}` }}>
                  {o.name.charAt(0).toUpperCase()}
                </div>
                <div className="wl-area-row-main">
                  <span className="wl-area-name">{o.name}</span>
                  <span className="wl-mono">{plural(o.parcels.length, 'teig', 'teiger')}</span>
                </div>
                <div className="wl-area-count">
                  <span className="wl-big-number">{daaText(o.daa)}</span>
                  <span className="wl-mono small">daa</span>
                </div>
              </button>
            ))}
            {areaOwners.length === 0 && <p className="wl-empty">Ingen grunneiere registrert i dette området ennå.</p>}
          </div>
        </>
      )}

      {layers.work && (
        <>
          <div className="wl-heading wl-subheading">
            <h2 className="wl-h2">Utført arbeid</h2>
            <span className="wl-mono">{entries.length} av {area.count}</span>
          </div>

          <div className="wl-row wl-wrap wl-pad">
            {chips.map((c) => (
              <button key={c.key ?? 'all'} type="button" className={`wl-chip pill ${filter === c.key ? 'on' : ''}`} onClick={() => onFilter(c.key)}>
                {c.key ? <TypeDot type={c.key} /> : (
                  <span className="wl-dot" style={{ width: 20, height: 20, background: '#5b6259' }}>
                    <span className="wl-ico" style={{ width: 11, height: 11 }} dangerouslySetInnerHTML={{ __html: LIST }} />
                  </span>
                )}
                {c.label}
                <span className="wl-mono-inline">{c.count}</span>
              </button>
            ))}
          </div>

          {onNewEntry && (
            <div className="wl-pad"><button type="button" className="wl-dashed-btn" onClick={onNewEntry}>+ Registrer arbeid i {area.name}</button></div>
          )}

          <EntryList entries={entries} entryId={entryId} onToggleEntry={onToggleEntry} onEditEntry={onEditEntry} />
        </>
      )}
    </>
  )
}
