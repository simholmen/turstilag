import { useState } from 'react'
import { TYPES } from '../../models/worklog'
import TypeDot from './TypeDot'

// `usedTypes` decides whether the fallback "Annet" type is listed. `owners`, when the
// grunneiere layer is on, is the set of owners currently drawn on the map.
export default function MapLegend({ isMobile, usedTypes, layers, owners = [] }) {
  const [open, setOpen] = useState(null)
  const isOpen = open ?? !isMobile
  const types = layers.work ? Object.keys(TYPES).filter((t) => t !== 'annet' || usedTypes.has('annet')) : []
  const showOwners = layers.owners && owners.length > 0

  return (
    <div className="wl-legend">
      <button type="button" className="wl-legend-toggle" onClick={() => setOpen(!isOpen)}>
        Tegnforklaring {isOpen ? '▲' : '▼'}
      </button>
      {isOpen && (
        <div className="wl-legend-panel">
          {types.map((t) => (
            <div key={t} className="wl-legend-row"><TypeDot type={t} />{TYPES[t].label}</div>
          ))}
          {layers.work && <div className="wl-legend-row wl-legend-area"><span className="wl-count-badge">5</span>Turområde · antall</div>}
          {showOwners && owners.map((o, i) => (
            <div key={o.id} className={`wl-legend-row ${i === 0 ? 'wl-legend-area' : ''}`}>
              <span className="wl-legend-swatch" style={{ background: o.fill, boxShadow: `inset 0 0 0 2px ${o.color}` }} />
              {o.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
