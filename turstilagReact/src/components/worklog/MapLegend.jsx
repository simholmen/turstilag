import { useState } from 'react'
import { TYPES } from '../../models/worklog'
import { BRIDGE_COLOR, DIFFICULTY, PLANK_BG } from '../../models/routes'
import KindSquare from '../info/KindSquare'
import OwnerSymbol from './OwnerSymbol'
import TypeDot from './TypeDot'

// `usedTypes` decides whether the fallback "Annet" type is listed. Grunneiere get one row with the
// shared symbol rather than one per owner — each owner's colour is on the map itself. `mode` switches
// between the Arbeidslogg legend (circles, area counts) and the sign-symbol modes, where the listed
// kinds follow the map's kind toggles.
export default function MapLegend({ isMobile, usedTypes, layers, hasOwners = false, mode = 'arbeidslogg' }) {
  const [open, setOpen] = useState(null)
  const isOpen = open ?? !isMobile
  const worklog = mode === 'arbeidslogg'
  const shownKinds = worklog ? (layers.work ? Object.keys(TYPES) : []) : layers.kinds
  const types = shownKinds.filter((t) => t !== 'annet' || usedTypes.has('annet'))
  const showRoutes = layers.routes || mode === 'ruter'
  const showOwners = layers.owners && hasOwners

  return (
    <div className="wl-legend">
      <button type="button" className="wl-legend-toggle" onClick={() => setOpen(!isOpen)}>
        Tegnforklaring {isOpen ? '▲' : '▼'}
      </button>
      {isOpen && (
        <div className="wl-legend-panel">
          {types.map((t) => (
            <div key={t} className="wl-legend-row">
              {worklog ? <TypeDot type={t} /> : <KindSquare type={t} />}{TYPES[t].label}
            </div>
          ))}
          {worklog && layers.work && <div className="wl-legend-row wl-legend-area"><span className="wl-count-badge">5</span>Turområde · antall</div>}
          {showOwners && (
            <div className={`wl-legend-row ${types.length ? 'wl-legend-area' : ''}`}>
              <OwnerSymbol />Grunneier · eiendom
            </div>
          )}
          {showRoutes && (
            <>
              {Object.entries(DIFFICULTY).map(([key, d], i) => (
                <div key={key} className={`wl-legend-row ${i === 0 && (types.length || showOwners) ? 'wl-legend-area' : ''}`}>
                  <span className="wl-legend-line" style={{ background: d.color }} />{d.label} rute
                </div>
              ))}
              <div className="wl-legend-row wl-legend-area"><span className="wl-legend-line plank" style={{ background: PLANK_BG }} />Klopp</div>
              <div className="wl-legend-row"><span className="wl-legend-line plank" style={{ background: BRIDGE_COLOR }} />Bru</div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
