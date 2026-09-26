import { useState } from 'react'
import { TYPES } from '../../models/worklog'
import TypeDot from './TypeDot'

// `usedTypes` decides whether the fallback "Annet" type is listed
export default function MapLegend({ isMobile, usedTypes }) {
  const [open, setOpen] = useState(null)
  const isOpen = open ?? !isMobile
  const types = Object.keys(TYPES).filter((t) => t !== 'annet' || usedTypes.has('annet'))

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
          <div className="wl-legend-row wl-legend-area"><span className="wl-count-badge">5</span>Turområde · antall</div>
        </div>
      )}
    </div>
  )
}
