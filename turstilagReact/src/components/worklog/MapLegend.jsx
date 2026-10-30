import { useState } from 'react'
import { SUBTYPES, TYPES } from '../../models/worklog'
import { DIFFICULTY, stretchStyle } from '../../models/routes'
import { TRAIL_COLOR } from '../../models/networks'
import KindSquare from '../info/KindSquare'
import OwnerSymbol from './OwnerSymbol'
import TypeDot from './TypeDot'

// A short piece of line drawn with the same style stack as on the map
function StretchSwatch({ subtypes, detailed }) {
  return (
    <svg className="wl-legend-swatch" width="28" height="12" viewBox="0 0 28 12" aria-hidden="true">
      {stretchStyle('stiforbedring', subtypes, detailed).map((s, i) => (
        <line
          key={i}
          x1="0" y1="6" x2="28" y2="6"
          stroke={s.color}
          strokeWidth={s.weight}
          strokeDasharray={s.dashArray}
          strokeLinecap={s.lineCap || 'butt'}
        />
      ))}
    </svg>
  )
}

// `usedTypes` decides whether the fallback "Annet" type is listed. Eiendommer get one row with the
// shared symbol rather than one per owner — each owner's colour is on the map itself. `mode` switches
// between the Arbeidslogg legend (circles, area counts) and the sign-symbol modes, where the listed
// kinds follow the map's kind toggles. `hideKinds` leaves the kinds out where their toggles already
// show each kind's symbol (the mobile filter menu).
export function LegendRows({ usedTypes, layers, hasOwners = false, mode = 'arbeidslogg', hideKinds = false }) {
  const worklog = mode === 'arbeidslogg'
  const shownKinds = hideKinds ? [] : worklog ? (layers.work ? Object.keys(TYPES) : []) : layers.kinds
  const types = shownKinds.filter((t) => t !== 'annet' || usedTypes.has('annet'))
  const showRoutes = layers.routes || mode === 'ruter'
  const showOwners = layers.owners && hasOwners
  const showTrails = Boolean(layers.trails)
  // Hva finnes tells the stiforbedring subtypes apart; Turruter only bru and the rest
  const detailedStretches = mode === 'finnes' && layers.kinds.includes('stiforbedring')

  return (
    <>
      {types.map((t) => (
        <div key={t} className="wl-legend-row">
          {worklog ? <TypeDot type={t} /> : <KindSquare type={t} />}{TYPES[t].label}
        </div>
      ))}
      {worklog && layers.work && <div className="wl-legend-row wl-legend-area"><span className="wl-count-badge">5</span>Turområde · antall</div>}
      {showTrails && (
        <>
          <div className={`wl-legend-row ${types.length ? 'wl-legend-area' : ''}`}>
            <span className="wl-legend-line" style={{ background: TRAIL_COLOR }} />Sti
          </div>
          {mode === 'stinettverk' && (
            <div className="wl-legend-row"><span className="wl-legend-node" style={{ background: TRAIL_COLOR }} />Kryss</div>
          )}
        </>
      )}
      {showOwners && (
        <div className={`wl-legend-row ${types.length ? 'wl-legend-area' : ''}`}>
          <OwnerSymbol />Eiendom · teig
        </div>
      )}
      {showRoutes && (
        <>
          {Object.entries(DIFFICULTY).map(([key, d], i) => (
            <div key={key} className={`wl-legend-row ${i === 0 && (types.length || showOwners) ? 'wl-legend-area' : ''}`}>
              <span className="wl-legend-line" style={{ background: d.color }} />{d.label} rute
            </div>
          ))}
          {!detailedStretches && (
            <>
              <div className="wl-legend-row wl-legend-area"><StretchSwatch subtypes={[]} />Stiforbedring</div>
              <div className="wl-legend-row"><StretchSwatch subtypes={['bru']} />Bru</div>
            </>
          )}
        </>
      )}
      {detailedStretches && Object.entries(SUBTYPES.stiforbedring).map(([key, sub], i) => (
        <div key={key} className={`wl-legend-row ${i === 0 && (types.length || showOwners || showRoutes) ? 'wl-legend-area' : ''}`}>
          <StretchSwatch subtypes={[key]} detailed />{sub.label}
        </div>
      ))}
    </>
  )
}

export default function MapLegend({ isMobile, ...rows }) {
  const [open, setOpen] = useState(null)
  const isOpen = open ?? !isMobile

  return (
    <div className="wl-legend">
      <button type="button" className="wl-legend-toggle" onClick={() => setOpen(!isOpen)}>
        Tegnforklaring {isOpen ? '▲' : '▼'}
      </button>
      {isOpen && (
        <div className="wl-legend-panel">
          <LegendRows {...rows} />
        </div>
      )}
    </div>
  )
}
