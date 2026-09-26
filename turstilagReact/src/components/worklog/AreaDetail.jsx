import { useEffect, useRef } from 'react'
import { imageUrl } from '../../lib/images'
import { TYPES, formatDate } from '../../models/worklog'
import TypeDot from './TypeDot'
import pencil from 'lucide-static/icons/pencil.svg?raw'
import listIcon from 'lucide-static/icons/list.svg?raw'

const PENCIL = pencil.slice(pencil.indexOf('<svg'))
const LIST = listIcon.slice(listIcon.indexOf('<svg'))

// onEditArea / onNewEntry / onEditEntry are only passed in admin
export default function AreaDetail({ area, entryId, filter, onBack, onFilter, onToggleEntry, onEditArea, onNewEntry, onEditEntry }) {
  const entries = area.list.filter((e) => !filter || e.type === filter)
  const chips = [{ key: null, label: 'Alle', count: area.count }, ...area.types]
  const openRef = useRef(null)

  // Bring the selected entry into view, e.g. after clicking its pin on the map
  useEffect(() => {
    if (entryId) openRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [entryId])

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

      <div className="wl-list wl-entry-list">
        {entries.map((entry) => {
          const open = entryId === entry.key
          return (
            <div key={entry.key} ref={open ? openRef : null} className={`wl-entry ${open ? 'open' : ''}`}>
              <div className={`wl-entry-row ${onEditEntry ? 'with-action' : ''}`} onClick={() => onToggleEntry(entry.key)}>
                <div className="wl-entry-thumb wl-hatch">
                  {entry.images[0] && <img src={imageUrl(entry.images[0])} alt="" loading="lazy" />}
                  <TypeDot type={entry.type} size={24} className="wl-entry-badge" />
                </div>
                <div className="wl-entry-main">
                  <span className="wl-mono">{TYPES[entry.type].label} · {formatDate(entry.date)}</span>
                  <span className="wl-entry-title">{entry.title}</span>
                  {!open && entry.desc && <span className="wl-entry-excerpt">{entry.desc}</span>}
                </div>
                {onEditEntry && (
                  <button
                    type="button"
                    className="wl-icon-btn"
                    title="Rediger arbeid"
                    onClick={(event) => { event.stopPropagation(); onEditEntry(entry) }}
                  >
                    <span className="wl-ico" dangerouslySetInnerHTML={{ __html: PENCIL }} />
                  </button>
                )}
              </div>
              {open && (
                <div className="wl-entry-detail">
                  {entry.desc && <p>{entry.desc}</p>}
                  {entry.images.length > 0 && (
                    <div className="wl-entry-images">
                      {entry.images.map((img) => <img key={img} src={imageUrl(img)} alt="" />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {entries.length === 0 && <p className="wl-empty">Ingen registrert arbeid her ennå.</p>}
      </div>
    </>
  )
}
