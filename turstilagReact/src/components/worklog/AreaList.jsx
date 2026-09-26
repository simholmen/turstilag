import { imageUrl } from '../../lib/images'
import TypeDot from './TypeDot'

const SORTS = [['recent', 'Sist oppdatert'], ['az', 'A–Å']]

// `areas` are view models from useAreaViews. `onNewArea` is only passed in admin.
export default function AreaList({ areas, entryCount, sort, onSort, onSelect, onNewArea }) {
  const sorted = [...areas].sort((a, b) => (
    sort === 'az' ? a.name.localeCompare(b.name, 'nb') : b.lastRaw.localeCompare(a.lastRaw)
  ))

  return (
    <>
      <div className="wl-heading">
        <h1 className="wl-h1">Turområdene</h1>
        <span className="wl-mono">{areas.length} områder · {entryCount} innsatser</span>
      </div>

      <div className="wl-row wl-pad">
        {SORTS.map(([key, label]) => (
          <button key={key} type="button" className={`wl-chip square ${sort === key ? 'on' : ''}`} onClick={() => onSort(key)}>
            {label}
          </button>
        ))}
      </div>

      {onNewArea && (
        <div className="wl-pad"><button type="button" className="wl-dashed-btn" onClick={onNewArea}>+ Nytt turområde</button></div>
      )}

      <div className="wl-list wl-area-list">
        {sorted.map((area) => (
          <button type="button" key={area.id} className="wl-area-row" onClick={() => onSelect(area.id)}>
            <div className="wl-thumb wl-hatch">
              {area.images[0] && <img src={imageUrl(area.images[0])} alt="" loading="lazy" />}
            </div>
            <div className="wl-area-row-main">
              <span className="wl-area-name">{area.name}</span>
              <span className="wl-mono">Siste arbeid {area.last}</span>
              <div className="wl-type-dots">
                {area.types.map((t) => <TypeDot key={t.key} type={t.key} />)}
              </div>
            </div>
            <div className="wl-area-count">
              <span className="wl-big-number">{area.count}</span>
              <span className="wl-mono small">innsatser</span>
            </div>
          </button>
        ))}
      </div>
    </>
  )
}
