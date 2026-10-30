import { junctionCount, startStyle } from '../../models/networks'
import { plural } from '../../models/owners'
import { LineSwatch } from './StylePicker'

// Every stinettverk, by name. `onNewNetwork` is admin-only.
export default function NetworkList({ networks, areas, onSelect, onNewNetwork }) {
  const areaName = (id) => areas.find((a) => a.id === id)?.name
  const sorted = [...networks].sort((a, b) => a.name.localeCompare(b.name, 'nb'))

  return (
    <>
      <div className="wl-heading">
        <h1 className="wl-h1">Stinettverk</h1>
        <span className="wl-mono">{plural(networks.length, 'nettverk', 'nettverk')}</span>
      </div>

      {onNewNetwork && (
        <div className="wl-pad"><button type="button" className="wl-dashed-btn" onClick={onNewNetwork}>+ Nytt stinettverk</button></div>
      )}

      <div className="wl-list">
        {sorted.map((n) => (
          <button type="button" key={n.id} className="wl-area-row wl-trail-row" onClick={() => onSelect(n.id)}>
            <LineSwatch {...startStyle(n)} width={22} />
            <span className="wl-area-row-main">
              <span className="wl-area-name">{n.name}</span>
              <span className="wl-mono">{[areaName(n.hubId), plural(junctionCount(n.parts), 'kryss', 'kryss')].filter(Boolean).join(' · ')}</span>
            </span>
          </button>
        ))}
        {networks.length === 0 && <p className="wl-empty">Ingen stinettverk registrert ennå.</p>}
      </div>
    </>
  )
}
