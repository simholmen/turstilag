import { useEffect, useRef } from 'react'
import { imageUrl } from '../../lib/images'
import { TYPES, formatDate } from '../../models/worklog'
import TypeDot from './TypeDot'
import pencil from 'lucide-static/icons/pencil.svg?raw'

const PENCIL = pencil.slice(pencil.indexOf('<svg'))

// Shared by AreaDetail and OwnerDetail. `onEditEntry` is only passed in admin.
export default function EntryList({ entries, entryId, onToggleEntry, onEditEntry, emptyText = 'Ingen registrert arbeid her ennå.' }) {
  const openRef = useRef(null)

  // Bring the selected entry into view, e.g. after clicking its pin on the map
  useEffect(() => {
    if (entryId) openRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [entryId])

  return (
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
      {entries.length === 0 && <p className="wl-empty">{emptyText}</p>}
    </div>
  )
}
